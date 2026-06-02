import { useMemo } from "react";
import { Link } from "wouter";
import {
  Users,
  BookOpen,
  ClipboardList,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore, useAuth } from "@/lib/auth";
import type { User, Material, MaterialProgress, Exam, ExamSubmission, Payment } from "@/lib/types";
import { formatCurrency, formatMonth, formatRelative } from "@/lib/format";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const users = useStore<User[]>("users", []);
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const payments = useStore<Payment[]>("payments", []);

  const myStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.status !== "pending" && u.teacherId === user?.id),
    [users, user],
  );
  const pendingStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.status === "pending" && u.teacherId === user?.id),
    [users, user],
  );
  const myStudentIds = useMemo(() => new Set(myStudents.map((s) => s.id)), [myStudents]);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const stats = useMemo(() => {
    const mySubmissions = submissions.filter((s) => myStudentIds.has(s.userId));
    const totalGraded = mySubmissions.filter((s) => s.fullyGraded);
    const avgScore =
      totalGraded.length === 0
        ? 0
        : Math.round(
            totalGraded.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
              totalGraded.length,
          );
    const pendingGrading = mySubmissions.filter((s) => !s.fullyGraded).length;

    const recentMonths = [-2, -1, 0].map((offset) => {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const myPayments = payments.filter((p) => myStudentIds.has(p.userId));
    const monthPayments = myPayments.filter((p) => recentMonths.includes(p.month));
    const collected = monthPayments
      .filter((p) => p.status === "paid")
      .reduce((acc, p) => acc + p.amount, 0);
    const pendingPayments = myPayments.filter((p) => p.status === "pending").length;
    const unpaidThisMonth = myPayments.filter(
      (p) => p.month === currentMonth && p.status === "unpaid",
    );

    // Material completion: % of (student, material) pairs completed
    const myMaterials = materials.filter((m) =>
      m.assignedTo.some((id) => myStudentIds.has(id)),
    );
    const totalPairs = myMaterials.reduce(
      (acc, m) => acc + m.assignedTo.filter((id) => myStudentIds.has(id)).length,
      0,
    );
    const completedPairs = progress.filter(
      (p) => myStudentIds.has(p.userId) && myMaterials.some((m) => m.id === p.materialId),
    ).length;
    const completionPct = totalPairs === 0 ? 0 : Math.round((completedPairs / totalPairs) * 100);

    return {
      avgScore,
      pendingGrading,
      collected,
      pendingPayments,
      unpaidThisMonth,
      completionPct,
      totalPairs,
    };
  }, [submissions, payments, materials, progress, myStudentIds, currentMonth]);

  const recentSubmissions = useMemo(
    () =>
      [...submissions]
        .filter((s) => myStudentIds.has(s.userId))
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .slice(0, 5),
    [submissions, myStudentIds],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Selamat datang kembali!</h1>
        <p className="text-muted-foreground text-sm">
          Ringkasan aktivitas siswa Anda hari ini.
        </p>
      </div>

      {/* Pending approval alert */}
      {pendingStudents.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {pendingStudents.length} siswa menunggu persetujuan
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {pendingStudents.map((s) => s.name).join(", ")}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
              <Link href="/teacher/students">Approve Sekarang</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Siswa Aktif"
          value={myStudents.length.toString()}
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
          label="Tertagih (3 bln)"
          value={formatCurrency(stats.collected)}
          accent="from-pink-500 to-rose-500"
          small
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ujian Terbaru — Siswa Saya</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/teacher/exams">Lihat semua</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Belum ada submission ujian dari siswa Anda.
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
                Rekap Siswa Saya
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Stat label="Rata-rata nilai ujian" value={`${stats.avgScore}/100`} />
                <Stat label="Perlu dikoreksi" value={stats.pendingGrading.toString()} />
                <Stat label="Pembayaran pending" value={stats.pendingPayments.toString()} />
                <Stat
                  label="Penyelesaian materi"
                  value={stats.totalPairs === 0 ? "—" : `${stats.completionPct}%`}
                  highlight={stats.completionPct >= 70}
                />
              </div>

              {/* Progress bar for material completion */}
              {stats.totalPairs > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Materi selesai
                    </span>
                    <span>{stats.completionPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                      style={{ width: `${stats.completionPct}%` }}
                    />
                  </div>
                </div>
              )}
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}
