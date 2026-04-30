import { useMemo, useState } from "react";
import { Wallet, Upload, CheckCircle2, Clock, XCircle, FileImage, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Payment, AppNotification } from "@/lib/types";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";

export default function StudentPayments() {
  const { user } = useAuth();
  const payments = useStore<Payment[]>("payments", []);
  const myPayments = useMemo(
    () =>
      payments
        .filter((p) => p.userId === user!.id)
        .sort((a, b) => b.month.localeCompare(a.month)),
    [payments, user],
  );

  const [paying, setPaying] = useState<Payment | null>(null);

  const totalPaid = myPayments.filter((p) => p.status === "paid").length;
  const totalDue = myPayments.filter((p) => p.status === "unpaid").length;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Total Tagihan</div>
            <div className="text-2xl font-bold mt-1">{myPayments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Sudah Lunas</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{totalPaid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Belum Bayar</div>
            <div className="text-2xl font-bold mt-1 text-destructive">{totalDue}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {myPayments.map((p) => (
              <div
                key={p.id}
                className="py-3 flex items-center gap-3 flex-wrap"
                data-testid={`my-payment-${p.id}`}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">SPP {formatMonth(p.month)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(p.amount)}
                    {p.verifiedAt && ` · diverifikasi ${formatDate(p.verifiedAt)}`}
                    {p.uploadedAt && !p.verifiedAt && ` · diunggah ${formatDate(p.uploadedAt)}`}
                  </div>
                </div>
                <PayStatus status={p.status} />
                {p.status === "unpaid" && (
                  <Button
                    size="sm"
                    onClick={() => setPaying(p)}
                    data-testid={`button-pay-${p.id}`}
                  >
                    Bayar Sekarang
                  </Button>
                )}
                {p.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => setPaying(p)}>
                    Lihat
                  </Button>
                )}
              </div>
            ))}
            {myPayments.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Belum ada tagihan.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {paying && (
        <PayDialog
          payment={paying}
          onClose={() => setPaying(null)}
          userId={user!.id}
          userName={user!.name}
        />
      )}
    </div>
  );
}

function PayStatus({ status }: { status: Payment["status"] }) {
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
        Menunggu verifikasi
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Belum bayar
    </Badge>
  );
}

function PayDialog({
  payment,
  onClose,
  userId,
  userName,
}: {
  payment: Payment;
  onClose: () => void;
  userId: string;
  userName: string;
}) {
  const [fileName, setFileName] = useState<string>("");
  const [fileDataUrl, setFileDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
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
    const all = read("payments", []);
    write(
      "payments",
      all.map((p) =>
        p.id === payment.id
          ? {
              ...p,
              status: "pending",
              proofFileName: fileName,
              proofDataUrl: fileDataUrl,
              uploadedAt: Date.now(),
            }
          : p,
      ),
    );
    // Notify all teachers
    const users = read("users", []);
    const teachers = users.filter((u) => u.role === "teacher");
    const notifs = read("notifications", []);
    const newNotifs: AppNotification[] = teachers.map((t) => ({
      id: uid("n_"),
      userId: t.id,
      type: "payment_uploaded",
      title: "Bukti pembayaran masuk",
      message: `${userName} mengunggah bukti pembayaran ${formatMonth(payment.month)}.`,
      link: "/teacher/payments",
      createdAt: Date.now(),
      read: false,
    }));
    write("notifications", [...notifs, ...newNotifs]);
    onClose();
  }

  const isPending = payment.status === "pending";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isPending ? "Status Pembayaran" : "Bayar SPP"} {formatMonth(payment.month)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Periode</span>
              <span className="text-sm font-semibold">{formatMonth(payment.month)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Jumlah</span>
              <span className="text-lg font-bold">{formatCurrency(payment.amount)}</span>
            </div>
          </div>

          {!isPending && (
            <>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Transfer ke Rekening
                </Label>
                <div className="border rounded-lg p-3 mt-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">BCA - 1234 5678 90</div>
                      <div className="text-xs text-muted-foreground">a.n. MathClub Indonesia</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText("1234567890");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copied ? "Tersalin" : "Salin"}
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <Label>Bukti Pembayaran (gambar atau file)</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={onFile}
                  data-testid="input-payment-proof"
                />
                {fileName && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileImage className="h-3 w-3" />
                    {fileName}
                  </div>
                )}
              </div>
            </>
          )}

          {isPending && payment.proofDataUrl && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Bukti pembayaranmu sedang diverifikasi guru.
              </AlertDescription>
            </Alert>
          )}
          {isPending && payment.proofDataUrl?.startsWith("data:image") && (
            <img src={payment.proofDataUrl} alt="bukti" className="rounded-md border w-full" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isPending ? "Tutup" : "Batal"}
          </Button>
          {!isPending && (
            <Button onClick={submit} data-testid="button-submit-payment">
              <Upload className="h-4 w-4 mr-2" />
              Kirim Bukti
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
