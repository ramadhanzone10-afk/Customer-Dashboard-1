import { useMemo } from "react";
import { Link } from "wouter";
import {
  BookOpen,
  ClipboardList,
  TrendingUp,
  Wallet,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth, useStore } from "@/lib/auth";
import type {
  Material,
  MaterialProgress,
  Exam,
  ExamSubmission,
  Payment,
} from "@/lib/types";
import { formatDate, formatMonth } from "@/lib/format";

export default function StudentDashboard() {
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const payments = useStore<Payment[]>("payments", []);

  const myMaterials = useMemo(
    () => materials.filter((m) => m.assignedTo.includes(user!.id)),
    [materials, user],
  );
  const myProgress = useMemo(
    () => progress.filter((p) => p.userId === user!.id),
    [progress, user],
  );
  const myExams = useMemo(
    () => exams.filter((e) => e.assignedTo.includes(user!.id)),
    [exams, user],
  );
  const mySubs = useMemo(
    () => submissions.filter((s) => s.userId === user!.id),
    [submissions, user],
  );
  const myPayments = useMemo(
    () => payments.filter((p) => p.userId === user!.id),
    [payments, user],
  );

  const matCompletion =
    myMaterials.length === 0 ? 0 : Math.round((myProgress.length / myMaterials.length) * 100);
  const upcomingExams = myExams
    .filter((e) => !mySubs.some((s) => s.examId === e.id) && e.deadline > Date.now())
    .sort((a, b) => a.deadline - b.deadline);
  const recentGrades = mySubs
    .filter((s) => s.fullyGraded)
    .sort((a, b) => (b.gradedAt ?? 0) - (a.gradedAt ?? 0))
    .slice(0, 3);
  const avgGrade =
    recentGrades.length === 0
      ? null
      : Math.round(
          mySubs
            .filter((s) => s.fullyGraded)
            .reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
            mySubs.filter((s) => s.fullyGraded).length,
        );

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const dueThisMonth = myPayments.find(
    (p) => p.month === currentMonth && p.status !== "paid",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Halo, {user?.name.split(" ")[0]}!</h1>
        <p className="text-sm text-muted-foreground">
          Berikut ringkasan belajar kamu hari ini.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          accent="from-indigo-500 to-purple-500"
          label="Materi"
          value={`${myProgress.length}/${myMaterials.length}`}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          accent="from-amber-500 to-orange-500"
          label="Ujian belum dikerjakan"
          value={upcomingExams.length.toString()}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          accent="from-emerald-500 to-teal-500"
          label="Rata-rata nilai"
          value={avgGrade !== null ? `${avgGrade}/100` : "-"}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          accent="from-pink-500 to-rose-500"
          label="Status SPP"
          value={
            !dueThisMonth ? "Lunas" : dueThisMonth.status === "pending" ? "Pending" : "Belum"
          }
          small
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ujian Mendatang</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/student/exams">
                Lihat semua <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingExams.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Tidak ada ujian aktif. Selamat menikmati waktu luang!
              </div>
            )}
            {upcomingExams.slice(0, 4).map((e) => (
              <Link
                key={e.id}
                href={`/student/exams/${e.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                data-testid={`upcoming-exam-${e.id}`}
              >
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Deadline {formatDate(e.deadline)} · {e.durationMinutes} mnt
                  </div>
                </div>
                <Badge>{e.questions.length} soal</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progres Belajar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Materi selesai</span>
                <span className="font-semibold">
                  {myProgress.length} / {myMaterials.length}
                </span>
              </div>
              <Progress value={matCompletion} className="h-3" />
              <Button asChild variant="outline" size="sm" className="w-full mt-4">
                <Link href="/student/progress">
                  Lihat detail progres <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {dueThisMonth && (
            <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  Pembayaran {formatMonth(dueThisMonth.month)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-3">
                  {dueThisMonth.status === "pending"
                    ? "Bukti pembayaran sedang diverifikasi guru."
                    : "Pembayaran SPP belum dilakukan."}
                </p>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/student/payments">
                    {dueThisMonth.status === "pending" ? "Lihat status" : "Bayar sekarang"}
                  </Link>
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
        <div className={small ? "text-lg font-bold" : "text-2xl font-bold"}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
