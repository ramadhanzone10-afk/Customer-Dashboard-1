import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Upload, CheckCircle2, Clock, XCircle, FileImage,
  AlertTriangle, Building2, CreditCard, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Payment, AppNotification } from "@/lib/types";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

const SPP_AMOUNT = 60000;
const PAYMENT_METHODS = [
  {
    value: "stor_koordinator",
    label: "Stor ke Koordinator Kelas",
    icon: Building2,
    desc: "Bayar langsung ke koordinator kelas Anda, lalu upload bukti tanda terima.",
  },
  {
    value: "transfer",
    label: "Transfer Bank",
    icon: CreditCard,
    desc: "Transfer ke rekening BCA 1234-5678-90 a.n. Math Core Indonesia.",
  },
];

function getYearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`,
  );
}

export default function StudentPayments() {
  const { user } = useAuth();
  const payments = useStore<Payment[]>("payments", []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const allMonths = getYearMonths(currentYear);

  const myPayments = useMemo(
    () => payments.filter((p) => p.userId === user!.id),
    [payments, user],
  );

  // Auto-generate missing payment records for past + current months
  useEffect(() => {
    if (!user) return;
    const existing = (read("payments", []) as Payment[]).filter((p: Payment) => p.userId === user.id);
    const existingMonths = new Set(existing.map((p) => p.month));
    const missing = allMonths
      .filter((m) => m <= currentMonth && !existingMonths.has(m));
    if (missing.length === 0) return;
    const newPayments: Payment[] = missing.map((m) => ({
      id: uid("p_"),
      userId: user.id,
      month: m,
      amount: SPP_AMOUNT,
      status: "unpaid" as const,
    }));
    write("payments", [...(read("payments", []) as Payment[]), ...newPayments]);
    void Promise.all(newPayments.map((p) => mcApi.createPayment(p).catch(() => {})));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [paying, setPaying] = useState<Payment | null>(null);

  const monthMap = useMemo(() => {
    const m = new Map<string, Payment>();
    for (const p of myPayments) m.set(p.month, p);
    return m;
  }, [myPayments]);

  const unpaidList = useMemo(
    () => myPayments.filter((p) => p.status === "unpaid"),
    [myPayments],
  );
  const totalDueAmount = unpaidList.reduce((acc, p) => acc + p.amount, 0);
  const paidCount = myPayments.filter((p) => p.status === "paid").length;

  return (
    <div className="space-y-6">
      {/* Unpaid banner */}
      {unpaidList.length > 0 && (
        <Alert variant="destructive" data-testid="alert-unpaid">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {unpaidList.length} tagihan belum dibayar
                </div>
                <div className="text-xs mt-0.5 opacity-90">
                  Total tertunggak: {formatCurrency(totalDueAmount)}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPaying(unpaidList[unpaidList.length - 1])}
                data-testid="button-pay-now-banner"
              >
                <Wallet className="h-3 w-3 mr-1" />
                Bayar Sekarang
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Total Tagihan</div>
            <div className="text-2xl font-bold mt-1">{myPayments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Sudah Lunas</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Belum Bayar</div>
            <div className="text-2xl font-bold mt-1 text-destructive">{unpaidList.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly grid Jan-Dec */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SPP {currentYear} — Semua Bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {allMonths.map((month) => {
              const p = monthMap.get(month);
              const isFuture = month > currentMonth;
              return (
                <div
                  key={month}
                  className={`py-3 flex items-center gap-3 flex-wrap ${isFuture ? "opacity-40" : ""}`}
                  data-testid={`month-row-${month}`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isFuture ? "bg-muted" :
                    p?.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                    p?.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">SPP {formatMonth(month)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(SPP_AMOUNT)}
                      {p?.verifiedAt && ` · Lunas ${formatDate(p.verifiedAt)}`}
                      {p?.uploadedAt && !p.verifiedAt && ` · Upload ${formatDate(p.uploadedAt)}`}
                      {p?.paymentMethod === "stor_koordinator" && " · Stor koordinator"}
                      {p?.paymentMethod === "transfer" && " · Transfer bank"}
                    </div>
                  </div>

                  {isFuture ? (
                    <Badge variant="outline" className="text-muted-foreground">Belum jatuh tempo</Badge>
                  ) : !p ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />Belum bayar
                    </Badge>
                  ) : (
                    <PayStatus status={p.status} />
                  )}

                  {!isFuture && p && p.status === "unpaid" && (
                    <Button size="sm" onClick={() => setPaying(p)} data-testid={`button-pay-${month}`}>
                      <ChevronRight className="h-3.5 w-3.5 mr-1" />
                      Bayar
                    </Button>
                  )}
                  {!isFuture && p && p.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => setPaying(p)}>
                      <FileImage className="h-3.5 w-3.5 mr-1" />
                      Lihat Bukti
                    </Button>
                  )}
                  {!isFuture && p && p.status === "paid" && (
                    <Button size="sm" variant="ghost" onClick={() => setPaying(p)}>
                      <FileImage className="h-3.5 w-3.5 mr-1" />
                      Bukti
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {paying && (
        <PayDialog
          payment={paying}
          onClose={() => setPaying(null)}
          userId={user!.id}
          userName={user!.name}
          teacherId={user!.teacherId}
        />
      )}
    </div>
  );
}

function PayStatus({ status }: { status: Payment["status"] }) {
  if (status === "paid")
    return <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Lunas</Badge>;
  if (status === "pending")
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Menunggu verifikasi</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Belum bayar</Badge>;
}

function PayDialog({
  payment,
  onClose,
  userId,
  userName,
  teacherId,
}: {
  payment: Payment;
  onClose: () => void;
  userId: string;
  userName: string;
  teacherId?: string;
}) {
  const [step, setStep] = useState<"method" | "upload">(
    payment.status === "pending" || payment.status === "paid" ? "upload" : "method",
  );
  const [method, setMethod] = useState<string>(payment.paymentMethod ?? "");
  const [fileName, setFileName] = useState<string>("");
  const [fileDataUrl, setFileDataUrl] = useState<string>("");

  const isReadonly = payment.status === "pending" || payment.status === "paid";

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      alert("Ukuran file maksimal 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(f.name);
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(f);
  }

  function submit() {
    if (!fileDataUrl) {
      alert("Mohon unggah bukti pembayaran terlebih dahulu.");
      return;
    }
    const all = read("payments", []) as Payment[];
    write("payments", all.map((p: Payment) =>
      p.id === payment.id
        ? { ...p, status: "pending" as const, paymentMethod: method, proofFileName: fileName, proofDataUrl: fileDataUrl, uploadedAt: Date.now() }
        : p,
    ));

    // Notify the connected teacher only
    type MinUser = { id: string; role: string; teacherId?: string };
    const users = read("users", []) as MinUser[];
    const notifyIds: string[] = teacherId
      ? [teacherId]
      : users.filter((u: MinUser) => u.role === "teacher").map((u: MinUser) => u.id);

    const notifs = read("notifications", []);
    const newNotifs: AppNotification[] = notifyIds.map((tid) => ({
      id: uid("n_"),
      userId: tid,
      type: "payment_uploaded" as const,
      title: "Bukti pembayaran masuk",
      message: `${userName} mengunggah bukti pembayaran ${formatMonth(payment.month)} (${method === "stor_koordinator" ? "Stor koordinator" : "Transfer bank"}).`,
      link: "/teacher/payments",
      createdAt: Date.now(),
      read: false,
    }));
    write("notifications", [...notifs, ...newNotifs]);

    void mcApi.updatePayment(payment.id, {
      status: "pending" as const,
      paymentMethod: method,
      proofFileName: fileName,
      proofDataUrl: fileDataUrl,
      uploadedAt: Date.now(),
      notifications: newNotifs,
    }).catch(() => {});
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            SPP {formatMonth(payment.month)}
            {isReadonly ? ` — ${payment.status === "paid" ? "Lunas" : "Menunggu Verifikasi"}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Periode</span>
              <span className="font-semibold">{formatMonth(payment.month)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jumlah</span>
              <span className="text-lg font-bold">{formatCurrency(payment.amount)}</span>
            </div>
            {payment.paymentMethod && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Metode</span>
                <span className="font-medium">
                  {payment.paymentMethod === "stor_koordinator" ? "Stor Koordinator" : "Transfer Bank"}
                </span>
              </div>
            )}
          </div>

          {/* Step 1: choose method */}
          {!isReadonly && step === "method" && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Pilih Metode Pembayaran</Label>
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`w-full text-left border rounded-lg p-3 flex items-start gap-3 transition-colors ${
                      method === m.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                      method === m.value ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{m.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                    </div>
                    {method === m.value && (
                      <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: upload proof */}
          {!isReadonly && step === "upload" && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Metode: <span className="text-foreground font-semibold">
                  {method === "stor_koordinator" ? "Stor Koordinator Kelas" : "Transfer Bank"}
                </span>
                <button onClick={() => setStep("method")} className="ml-2 text-xs text-primary underline">
                  Ganti
                </button>
              </div>
              {method === "transfer" && (
                <div className="border rounded-lg p-3 bg-muted/50 text-sm">
                  <div className="font-semibold">BCA — 1234 5678 90</div>
                  <div className="text-xs text-muted-foreground">a.n. Math Core Indonesia</div>
                </div>
              )}
              {method === "stor_koordinator" && (
                <div className="border rounded-lg p-3 bg-muted/50 text-sm">
                  <div className="font-semibold">Stor ke Koordinator Kelas</div>
                  <div className="text-xs text-muted-foreground">
                    Bayar ke koordinator, minta tanda terima, lalu upload fotonya.
                  </div>
                </div>
              )}
              <div>
                <Label>Upload Bukti Pembayaran <span className="text-destructive">*</span></Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={onFile}
                  className="mt-1"
                  data-testid="input-payment-proof"
                />
                {fileName && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileImage className="h-3 w-3" />{fileName}
                  </div>
                )}
                {fileDataUrl?.startsWith("data:image") && (
                  <img src={fileDataUrl} alt="preview" className="mt-2 rounded-md border max-h-40 object-contain" />
                )}
                <p className="text-xs text-muted-foreground mt-1">Maks. 3MB. Format: JPG, PNG, PDF.</p>
              </div>
            </div>
          )}

          {/* Readonly: show proof */}
          {isReadonly && payment.proofDataUrl && (
            <div className="space-y-2">
              {payment.status === "pending" && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>Bukti pembayaran sedang diverifikasi guru.</AlertDescription>
                </Alert>
              )}
              {payment.status === "paid" && (
                <Alert className="border-emerald-300 bg-emerald-50/50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-700">
                    Pembayaran telah diverifikasi{payment.verifiedAt ? ` pada ${formatDate(payment.verifiedAt)}` : ""}.
                  </AlertDescription>
                </Alert>
              )}
              {payment.proofDataUrl.startsWith("data:image") ? (
                <img src={payment.proofDataUrl} alt="bukti" className="rounded-md border w-full" />
              ) : (
                <a href={payment.proofDataUrl} download={payment.proofFileName} className="text-primary underline text-sm">
                  Download {payment.proofFileName}
                </a>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isReadonly ? "Tutup" : "Batal"}
          </Button>
          {!isReadonly && step === "method" && (
            <Button disabled={!method} onClick={() => setStep("upload")}>
              Lanjut
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {!isReadonly && step === "upload" && (
            <Button onClick={submit} disabled={!fileDataUrl} data-testid="button-submit-payment">
              <Upload className="h-4 w-4 mr-2" />
              Kirim Bukti
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
