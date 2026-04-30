import { useMemo } from "react";
import { Link } from "wouter";
import {
  Users,
  BookOpen,
  ClipboardList,
  Wallet,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/auth";
import type { User, Material, Exam, ExamSubmission, Payment } from "@/lib/types";
import { formatCurrency, formatMonth, formatRelative } from "@/lib/format";

export default function TeacherDashboard() {
  const users = useStore<User[]>("users", []);
  const materials = useStore<Material[]>("materials", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const payments = useStore<Payment[]>("payments", []);

  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const stats = useMemo(() => {
    const totalGraded = submissions.filter((s) => s.fullyGraded);
    const avgScore =
      totalGraded.length === 0
        ? 0
        : Math.round(
            totalGraded.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
              totalGraded.length,
          );
    const pendingGrading = submissions.filter((s) => !s.fullyGraded).length;

    const now = Date.now();
    const recentMonths = [-2, -1, 0].map((offset) => {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const monthPayments = payments.filter((p) => recentMonths.includes(p.month));
    const collected = monthPayments
      .filter((p) => p.status === "paid")
      .reduce((acc, p) => acc + p.amount, 0);
    const pendingPayments = payments.filter((p) => p.status === "pending").length;
    const unpaidThisMonth = payments.filter(
      (p) => p.month === currentMonth && p.status === "unpaid",
    );

    return {
      avgScore,
      pendingGrading,
      collected,
      pendingPayments,
      unpaidThisMonth,
      now,
    };
  }, [submissions, payments, currentMonth]);

  const recentSubmissions = useMemo(
    () => [...submissions].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5),
    [submissions],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Selamat datang kembali!</h1>
        <p className="text-muted-foreground text-sm">
          Ringkasan aktivitas kelas Anda hari ini.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Siswa Aktif"
          value={students.length.toString()}
          accent="from-indigo-500 to-purple-500"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Materi"
          value={materials.length.toString()}
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Ujian Aktif"
          value={exams.filter((e) => e.deadline > Date.now()).length.toString()}
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Tertagih"
          value={formatCurrency(stats.collected)}
          accent="from-pink-500 to-rose-500"
          small
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ujian Terbaru</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/teacher/exams">Lihat semua</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Belum ada submission ujian.
              </div>
            )}
            {recentSubmissions.map((sub) => {
              const exam = exams.find((e) => e.id === sub.examId);
              const student = users.find((u) => u.id === sub.userId);
              const pct = Math.round((sub.totalScore / sub.maxScore) * 100);
              return (
                <Link
                  key={sub.id}
                  href={exam ? `/teacher/exams/${exam.id}/results` : "#"}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                  data-testid={`recent-submission-${sub.id}`}
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ background: student?.avatarColor ?? "#6366f1" }}
                  >
                    {student?.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{student?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {exam?.title} · {formatRelative(sub.submittedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    {sub.fullyGraded ? (
                      <Badge variant={pct >= 70 ? "default" : "secondary"}>{pct}</Badge>
                    ) : (
                      <Badge variant="outline">Perlu koreksi</Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performa Kelas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Stat label="Rata-rata nilai" value={`${stats.avgScore}/100`} />
                <Stat label="Perlu dikoreksi" value={stats.pendingGrading.toString()} />
                <Stat label="Pembayaran pending" value={stats.pendingPayments.toString()} />
              </div>
            </CardContent>
          </Card>

          {stats.unpaidThisMonth.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Belum Bayar {formatMonth(currentMonth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.unpaidThisMonth.map((p) => {
                    const u = users.find((us) => us.id === p.userId);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{u?.name}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full mt-3">
                  <Link href="/teacher/payments">Kelola pembayaran</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  small?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white mb-3`}
        >
          {icon}
        </div>
        <div className={small ? "text-xl font-bold" : "text-3xl font-bold"}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
