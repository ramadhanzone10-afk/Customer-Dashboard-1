import { useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileImage,
  Bell,
  MessageCircle,
  TrendingUp,
  Users as UsersIcon,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, useAuth } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Payment, User, AppNotification } from "@/lib/types";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

const NO_KELAS = "__none__";

function formatPhoneForWa(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

function getYearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`,
  );
}

export default function TeacherPayments() {
  const payments = useStore<Payment[]>("payments", []);
  const users = useStore<User[]>("users", []);
  const { user: teacher } = useAuth();

  const students = useMemo(
    () => users.filter((u) => u.role === "student" && u.teacherId === teacher?.id),
    [users, teacher],
  );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const availableYears = Array.from(
    { length: currentYear - 2023 },
    (_, i) => 2024 + i,
  ).concat([currentYear, currentYear + 1]);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const allYearMonths = getYearMonths(selectedYear);

  // Only payments from teacher's own students
  const myPayments = useMemo(
    () => {
      const myStudentIds = new Set(students.map((s) => s.id));
      return payments.filter((p) => myStudentIds.has(p.userId));
    },
    [payments, students],
  );

  const months = allYearMonths;

  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [kelasFilter, setKelasFilter] = useState<string>("all");

  function handleYearChange(val: string) {
    const y = Number(val);
    setSelectedYear(y);
    setActiveMonth(y === currentYear ? currentMonth : `${y}-01`);
  }
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);

  const monthPayments = useMemo(
    () => myPayments.filter((p) => p.month === activeMonth),
    [myPayments, activeMonth],
  );

  const grouped = useMemo(() => {
    const paymentByStudentId = new Map<string, Payment>();
    for (const p of monthPayments) paymentByStudentId.set(p.userId, p);

    const map = new Map<
      string,
      { kelas: string; rows: { p: Payment | null; student: User }[] }
    >();
    // Include ALL teacher's students, even those without a payment record
    for (const student of students) {
      const k = student.kelas?.trim() || NO_KELAS;
      if (!map.has(k)) map.set(k, { kelas: k, rows: [] });
      const p = paymentByStudentId.get(student.id) ?? null;
      map.get(k)!.rows.push({ p, student });
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.kelas === NO_KELAS) return 1;
      if (b.kelas === NO_KELAS) return -1;
      return a.kelas.localeCompare(b.kelas);
    });
    for (const g of arr) {
      g.rows.sort((a, b) => a.student.name.localeCompare(b.student.name));
    }
    return arr;
  }, [monthPayments, students]);

  const visibleGroups =
    kelasFilter === "all" ? grouped : grouped.filter((g) => g.kelas === kelasFilter);

  function verify(p: Payment) {
    const all = read("payments", []);
    write(
      "payments",
      all.map((x) =>
        x.id === p.id ? { ...x, status: "paid", verifiedAt: Date.now() } : x,
      ),
    );
    const notifs = read("notifications", []);
    const n: AppNotification = {
      id: uid("n_"),
      userId: p.userId,
      type: "payment_verified",
      title: "Pembayaran terverifikasi",
      message: `Pembayaran ${formatMonth(p.month)} telah dikonfirmasi.`,
      link: "/student/payments",
      createdAt: Date.now(),
      read: false,
    };
    write("notifications", [...notifs, n]);
    void mcApi.updatePayment(p.id, { status: "paid" as const, verifiedAt: Date.now(), notification: n }).catch(() => {});
  }

  function reject(p: Payment) {
    if (!confirm("Tolak pembayaran ini? Status akan diubah menjadi belum bayar."))
      return;
    const all = read("payments", []);
    write(
      "payments",
      all.map((x) =>
        x.id === p.id
          ? {
              ...x,
              status: "unpaid",
              proofDataUrl: undefined,
              proofFileName: undefined,
              uploadedAt: undefined,
            }
          : x,
      ),
    );
    void mcApi.updatePayment(p.id, { status: "unpaid" as const, proofDataUrl: undefined, proofFileName: undefined, uploadedAt: undefined }).catch(() => {});
  }

  function sendReminder(userId: string) {
    const u = students.find((s) => s.id === userId);
    if (!u) return;
    const notifs = read("notifications", []);
    const n: AppNotification = {
      id: uid("n_"),
      userId,
      type: "payment_due",
      title: "Pengingat pembayaran",
      message: `Mohon segera lakukan pembayaran SPP ${formatMonth(activeMonth)}.`,
      link: "/student/payments",
      createdAt: Date.now(),
      read: false,
    };
    write("notifications", [...notifs, n]);
    void mcApi.createNotification(n).catch(() => {});
    alert(`Pengingat dikirim ke ${u.name}.`);
  }

  function remindAllUnpaid(rows: { p: Payment | null; student: User }[]) {
    const unpaid = rows.filter((r) => !r.p || r.p.status === "unpaid");
    if (unpaid.length === 0) {
      alert("Tidak ada siswa yang belum bayar di kelas ini.");
      return;
    }
    if (!confirm(`Kirim pengingat ke ${unpaid.length} siswa yang belum bayar?`))
      return;
    const notifs = read("notifications", []);
    const newNotifs: AppNotification[] = unpaid.map((r) => ({
      id: uid("n_"),
      userId: r.student.id,
      type: "payment_due",
      title: "Pengingat pembayaran",
      message: `Mohon segera lakukan pembayaran SPP ${formatMonth(activeMonth)}.`,
      link: "/student/payments",
      createdAt: Date.now(),
      read: false,
    }));
    write("notifications", [...notifs, ...newNotifs]);
    void mcApi.createNotificationsBatch(newNotifs).catch(() => {});
    alert(`${unpaid.length} pengingat berhasil dikirim.`);
  }

  function waLink(student: User): string | null {
    const phone = formatPhoneForWa(student.phone);
    if (!phone) return null;
    const text = encodeURIComponent(
      `Halo ${student.name}, ini pengingat dari Math Core: pembayaran SPP bulan ${formatMonth(activeMonth)} sebesar ${formatCurrency(60000)} belum kami terima. Mohon segera melakukan pembayaran. Terima kasih.`,
    );
    return `https://wa.me/${phone}?text=${text}`;
  }

  const SPP = 60000;
  const totalCollected = monthPayments.filter((p) => p.status === "paid").reduce((acc, p) => acc + p.amount, 0);
  const totalStudents = students.length;
  const paidCount = monthPayments.filter((p) => p.status === "paid").length;
  const pendingCount = monthPayments.filter((p) => p.status === "pending").length;
  const unpaidCount = totalStudents - paidCount;

  return (
    <div className="space-y-6">
      {students.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Belum ada siswa terhubung dengan akun Anda.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Tertagih {formatMonth(activeMonth)}</div>
                <div className="text-2xl font-bold mt-1">{formatCurrency(totalCollected)}</div>
                <div className="text-xs text-muted-foreground mt-1">dari {formatCurrency(totalStudents * SPP)}</div>
                <Progress value={totalStudents ? (paidCount / totalStudents) * 100 : 0} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Sudah Lunas</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">{paidCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Pending verifikasi</div>
                <div className="text-2xl font-bold mt-1 text-amber-600">{pendingCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Belum bayar</div>
                <div className="text-2xl font-bold mt-1 text-destructive">{unpaidCount}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeMonth} onValueChange={setActiveMonth}>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-28" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TabsList className="flex-wrap h-auto gap-1">
                  {months.map((m) => (
                    <TabsTrigger key={m} value={m} data-testid={`tab-month-${m}`}
                      className={m === currentMonth ? "data-[state=active]:ring-2 data-[state=active]:ring-primary" : ""}>
                      {formatMonth(m).slice(0, 3)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter kelas:</span>
                <Select value={kelasFilter} onValueChange={setKelasFilter}>
                  <SelectTrigger className="w-44" data-testid="select-kelas-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua kelas</SelectItem>
                    {grouped.map((g) => (
                      <SelectItem key={g.kelas} value={g.kelas}>
                        {g.kelas === NO_KELAS ? "Tanpa kelas" : `Kelas ${g.kelas}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {months.map((m) => (
              <TabsContent key={m} value={m} className="mt-4 space-y-4">
                {visibleGroups.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada data untuk filter ini.
                    </CardContent>
                  </Card>
                )}
                {visibleGroups.map((g) => {
                  const paidRows = g.rows.filter((r) => r.p?.status === "paid");
                  const pendingRows = g.rows.filter((r) => r.p?.status === "pending");
                  const unpaidRows = g.rows.filter((r) => !r.p || r.p.status === "unpaid");
                  const collected = paidRows.reduce((a, r) => a + (r.p?.amount ?? SPP), 0);
                  const expected = g.rows.length * SPP;
                  const pct = expected ? (collected / expected) * 100 : 0;
                  return (
                    <Card key={g.kelas} data-testid={`group-${g.kelas}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base flex items-center gap-2">
                              <UsersIcon className="h-4 w-4 text-primary" />
                              {g.kelas === NO_KELAS ? "Tanpa Kelas" : `Kelas ${g.kelas}`}
                              <Badge variant="secondary">{g.rows.length} siswa</Badge>
                            </CardTitle>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1.5">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />{paidRows.length} lunas
                              </span>
                              {pendingRows.length > 0 && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Clock className="h-3 w-3" />{pendingRows.length} pending
                                </span>
                              )}
                              {unpaidRows.length > 0 && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertTriangle className="h-3 w-3" />{unpaidRows.length} belum bayar
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {formatCurrency(collected)} / {formatCurrency(expected)}
                              </span>
                            </div>
                            <Progress value={pct} className="mt-2 h-1.5 w-full max-w-md" />
                          </div>
                          {unpaidRows.length > 0 && (
                            <Button size="sm" variant="outline"
                              onClick={() => remindAllUnpaid(g.rows)}
                              data-testid={`button-remind-all-${g.kelas}`}>
                              <Bell className="h-3 w-3 mr-1" />
                              Ingatkan semua ({unpaidRows.length})
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="divide-y">
                          {g.rows.map(({ p, student }) => {
                            const wa = waLink(student);
                            return (
                              <div key={student.id} className="py-3 flex items-center gap-3 flex-wrap"
                                data-testid={`payment-${p?.id ?? student.id}`}>
                                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                                  style={{ background: student.avatarColor ?? "#6366f1" }}>
                                  {student.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{student.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatCurrency(p?.amount ?? SPP)}
                                    {p?.paymentMethod === "stor_koordinator" && " · Stor koordinator"}
                                    {p?.paymentMethod === "transfer" && " · Transfer bank"}
                                    {p?.uploadedAt && ` · upload ${formatDate(p.uploadedAt)}`}
                                    {p?.verifiedAt && ` · lunas ${formatDate(p.verifiedAt)}`}
                                  </div>
                                </div>
                                <PaymentBadge status={p?.status ?? "unpaid"} />
                                <div className="flex flex-wrap gap-2">
                                  {p?.proofDataUrl && (
                                    <Button size="sm" variant="outline"
                                      onClick={() => setPreviewPayment(p)}
                                      data-testid={`button-view-proof-${p.id}`}>
                                      <FileImage className="h-3 w-3 mr-1" />Bukti
                                    </Button>
                                  )}
                                  {p?.status === "pending" && (
                                    <>
                                      <Button size="sm" onClick={() => verify(p)} data-testid={`button-verify-${p.id}`}>
                                        <CheckCircle2 className="h-3 w-3 mr-1" />Verifikasi
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => reject(p)}>
                                        <XCircle className="h-3 w-3 mr-1" />Tolak
                                      </Button>
                                    </>
                                  )}
                                  {(!p || p.status === "unpaid") && (
                                    <>
                                      <Button size="sm" variant="outline"
                                        onClick={() => sendReminder(student.id)}
                                        data-testid={`button-remind-${student.id}`}>
                                        <Bell className="h-3 w-3 mr-1" />Ingatkan
                                      </Button>
                                      {wa ? (
                                        <Button size="sm" variant="outline" asChild
                                          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800">
                                          <a href={wa} target="_blank" rel="noopener noreferrer"
                                            data-testid={`button-wa-${student.id}`}>
                                            <MessageCircle className="h-3 w-3 mr-1" />WA
                                          </a>
                                        </Button>
                                      ) : (
                                        <Button size="sm" variant="outline" disabled title="Siswa belum mengisi nomor HP">
                                          <MessageCircle className="h-3 w-3 mr-1" />WA
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>

          <Dialog open={!!previewPayment} onOpenChange={(o) => !o && setPreviewPayment(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Bukti Pembayaran
                  {previewPayment?.paymentMethod === "stor_koordinator" && " — Stor Koordinator"}
                  {previewPayment?.paymentMethod === "transfer" && " — Transfer Bank"}
                </DialogTitle>
              </DialogHeader>
              {previewPayment?.proofDataUrl && (
                <div>
                  {previewPayment.proofDataUrl.startsWith("data:image") ? (
                    <img src={previewPayment.proofDataUrl} alt="bukti" className="max-w-full rounded-md" />
                  ) : (
                    <a href={previewPayment.proofDataUrl} download={previewPayment.proofFileName} className="text-primary underline">
                      Download {previewPayment.proofFileName}
                    </a>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function PaymentBadge({ status }: { status: Payment["status"] }) {
  if (status === "paid")
    return (
      <Badge className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Lunas
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Belum bayar
    </Badge>
  );
}
