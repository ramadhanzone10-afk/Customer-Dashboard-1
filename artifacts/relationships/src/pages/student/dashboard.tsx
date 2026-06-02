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
  FileEdit,
  CheckCircle2,
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

  const upcomingUjian = myExams
    .filter(
      (e) =>
        (!e.type || e.type === "exam") &&
        !mySubs.some((s) => s.examId === e.id) &&
        e.deadline > Date.now(),
    )
    .sort((a, b) => a.deadline - b.deadline);

  const upcomingTugas = myExams
    .filter(
      (e) =>
        e.type === "tugas" &&
        !mySubs.some((s) => s.examId === e.id) &&
        e.deadline > Date.now(),
    )
    .sort((a, b) => a.deadline - b.deadline);

  const recentGradedSubs = mySubs
    .filter((s) => s.fullyGraded)
    .sort((a, b) => (b.gradedAt ?? 0) - (a.gradedAt ?? 0));

  const avgGrade =
    recentGradedSubs.length === 0
      ? null
      : Math.round(
          recentGradedSubs.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
            recentGradedSubs.length,
        );

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const dueThisMonth = myPayments.find(
    (p) => p.month === currentMonth && p.status !== "paid",
  );

  const recentMaterials = myMaterials
    .filter((m) => myProgress.some((p) => p.materialId === m.id && p.userId === user!.id))
    .sort((a, b) => {
      const pa = myProgress.find((p) => p.materialId === a.id && p.userId === user!.id);
      const pb = myProgress.find((p) => p.materialId === b.id && p.userId === user!.id);
      return (pb?.completedAt ?? 0) - (pa?.completedAt ?? 0);
    })
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Halo, {user?.name.split(" ")[0]}! 👋</h1>
        <p className="text-sm text-muted-foreground">
          Berikut ringkasan belajar kamu hari ini.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          accent="from-indigo-500 to-purple-500"
          label="Materi selesai"
          value={`${myProgress.length}/${myMaterials.length}`}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          accent="from-amber-500 to-orange-500"
          label="Ujian belum dikerjakan"
          value={upcomingUjian.length.toString()}
        />
        <StatCard
          icon={<FileEdit className="h-5 w-5" />}
          accent="from-sky-500 to-blue-500"
          label="Tugas belum dikumpulkan"
          value={upcomingTugas.length.toString()}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          accent="from-emerald-500 to-teal-500"
          label="Rata-rata nilai"
          value={avgGrade !== null ? `${avgGrade}/100` : "-"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                Ujian Mendatang
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/student/exams">
                  Lihat semua <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingUjian.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Tidak ada ujian aktif saat ini.
                </div>
              ) : (
                upcomingUjian.slice(0, 3).map((e) => (
                  <ExamRow key={e.id} exam={e} testId={`upcoming-exam-${e.id}`} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-sky-500" />
                Tugas Mendatang
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/student/exams">
                  Lihat semua <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingTugas.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Tidak ada tugas dengan deadline mendatang.
                </div>
              ) : (
                upcomingTugas.slice(0, 3).map((e) => (
                  <ExamRow key={e.id} exam={e} isTugas testId={`upcoming-tugas-${e.id}`} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

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
              {recentMaterials.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <div className="text-xs text-muted-foreground mb-2">Terakhir dipelajari:</div>
                  {recentMaterials.map((m) => (
                    <Link key={m.id} href={`/student/materials/${m.id}`}>
                      <div className="flex items-center gap-2 text-sm hover:bg-accent/50 rounded px-2 py-1 transition-colors cursor-pointer">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="truncate flex-1">{m.title}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Button asChild variant="outline" size="sm" className="w-full mt-4">
                <Link href="/student/progress">
                  Lihat riwayat belajar <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {dueThisMonth ? (
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
          ) : (
            <Card className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                    SPP {formatMonth(currentMonth)} Lunas
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Terima kasih sudah membayar tepat waktu!
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamRow({
  exam,
  isTugas,
  testId,
}: {
  exam: Exam;
  isTugas?: boolean;
  testId?: string;
}) {
  const daysLeft = Math.ceil((exam.deadline - Date.now()) / 86400000);
  return (
    <Link href={`/student/exams/${exam.id}`}>
      <div
        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
        data-testid={testId}
      >
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
            isTugas
              ? "bg-sky-100 dark:bg-sky-900/40 text-sky-600"
              : "bg-amber-100 dark:bg-amber-900/40 text-amber-600"
          }`}
        >
          {isTugas ? <FileEdit className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{exam.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Deadline {formatDate(exam.deadline)}
          </div>
        </div>
        {daysLeft <= 3 ? (
          <Badge variant="destructive" className="text-xs shrink-0">
            {daysLeft <= 0 ? "Hari ini!" : `${daysLeft}h`}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs shrink-0">
            {isTugas ? "Tugas" : `${exam.questions.length} soal`}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white mb-3`}
        >
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
