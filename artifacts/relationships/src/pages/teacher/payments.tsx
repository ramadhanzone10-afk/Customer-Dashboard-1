import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, FileImage, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Payment, User, AppNotification } from "@/lib/types";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";

export default function TeacherPayments() {
  const payments = useStore<Payment[]>("payments", []);
  const users = useStore<User[]>("users", []);
  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  const months = useMemo(() => {
    const set = new Set(payments.map((p) => p.month));
    return Array.from(set).sort().reverse();
  }, [payments]);

  const [activeMonth, setActiveMonth] = useState(months[0] ?? "");
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);

  const monthPayments = useMemo(
    () => payments.filter((p) => p.month === activeMonth),
    [payments, activeMonth],
  );

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
  }

  function reject(p: Payment) {
    if (!confirm("Tolak pembayaran ini? Status akan diubah menjadi belum bayar.")) return;
    const all = read("payments", []);
    write(
      "payments",
      all.map((x) =>
        x.id === p.id
          ? { ...x, status: "unpaid", proofDataUrl: undefined, proofFileName: undefined, uploadedAt: undefined }
          : x,
      ),
    );
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
    alert(`Pengingat dikirim ke ${u.name}.`);
  }

  if (months.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">Belum ada data pembayaran.</div>
    );
  }

  const totalCollected = monthPayments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + p.amount, 0);
  const totalExpected = monthPayments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Tertagih bulan ini</div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(totalCollected)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              dari {formatCurrency(totalExpected)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Pending verifikasi</div>
            <div className="text-2xl font-bold mt-1">
              {monthPayments.filter((p) => p.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Belum bayar</div>
            <div className="text-2xl font-bold mt-1">
              {monthPayments.filter((p) => p.status === "unpaid").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeMonth} onValueChange={setActiveMonth}>
        <TabsList className="overflow-x-auto">
          {months.map((m) => (
            <TabsTrigger key={m} value={m} data-testid={`tab-month-${m}`}>
              {formatMonth(m)}
            </TabsTrigger>
          ))}
        </TabsList>
        {months.map((m) => (
          <TabsContent key={m} value={m}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Pembayaran {formatMonth(m)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {monthPayments.map((p) => {
                    const student = users.find((u) => u.id === p.userId);
                    return (
                      <div
                        key={p.id}
                        className="py-3 flex items-center gap-3 flex-wrap"
                        data-testid={`payment-${p.id}`}
                      >
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ background: student?.avatarColor ?? "#6366f1" }}
                        >
                          {student?.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{student?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(p.amount)}
                            {p.uploadedAt && ` · diunggah ${formatDate(p.uploadedAt)}`}
                          </div>
                        </div>
                        <PaymentBadge status={p.status} />
                        <div className="flex gap-2">
                          {p.proofDataUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewPayment(p)}
                              data-testid={`button-view-proof-${p.id}`}
                            >
                              <FileImage className="h-3 w-3 mr-1" />
                              Bukti
                            </Button>
                          )}
                          {p.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => verify(p)}
                                data-testid={`button-verify-${p.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verifikasi
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => reject(p)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Tolak
                              </Button>
                            </>
                          )}
                          {p.status === "unpaid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendReminder(p.userId)}
                              data-testid={`button-remind-${p.id}`}
                            >
                              <Bell className="h-3 w-3 mr-1" />
                              Ingatkan
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!previewPayment} onOpenChange={(o) => !o && setPreviewPayment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          {previewPayment?.proofDataUrl && (
            <div>
              {previewPayment.proofDataUrl.startsWith("data:image") ? (
                <img
                  src={previewPayment.proofDataUrl}
                  alt="bukti"
                  className="max-w-full rounded-md"
                />
              ) : (
                <a
                  href={previewPayment.proofDataUrl}
                  download={previewPayment.proofFileName}
                  className="text-primary underline"
                >
                  Download {previewPayment.proofFileName}
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
