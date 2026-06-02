import { useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { BookOpen, ClipboardList, FileEdit, TrendingUp, ArrowRight } from "lucide-react";
import { useAuth, useStore } from "@/lib/auth";
import type { Material, MaterialProgress, Exam, ExamSubmission } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function StudentProgress() {
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);

  const myMats = useMemo(
    () => materials.filter((m) => m.assignedTo.includes(user!.id)),
    [materials, user],
  );
  const myProgress = useMemo(
    () => progress.filter((p) => p.userId === user!.id),
    [progress, user],
  );

  const { ujianSubs, tugasSubs } = useMemo(() => {
    const allSubs = submissions
      .filter((s) => s.userId === user!.id)
      .sort((a, b) => a.submittedAt - b.submittedAt);

    const ujianSubs = allSubs.filter((s) => {
      const exam = exams.find((e) => e.id === s.examId);
      return !exam?.type || exam.type === "exam";
    });
    const tugasSubs = allSubs.filter((s) => {
      const exam = exams.find((e) => e.id === s.examId);
      return exam?.type === "tugas";
    });
    return { ujianSubs, tugasSubs };
  }, [submissions, exams, user]);

  const matPct = myMats.length === 0 ? 0 : Math.round((myProgress.length / myMats.length) * 100);

  const avgUjian =
    ujianSubs.filter((s) => s.fullyGraded).length === 0
      ? null
      : Math.round(
          ujianSubs
            .filter((s) => s.fullyGraded)
            .reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
            ujianSubs.filter((s) => s.fullyGraded).length,
        );

  const avgTugas =
    tugasSubs.filter((s) => s.fullyGraded).length === 0
      ? null
      : Math.round(
          tugasSubs
            .filter((s) => s.fullyGraded)
            .reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
            tugasSubs.filter((s) => s.fullyGraded).length,
        );

  const chartData = useMemo(() => {
    const allGraded = [...ujianSubs, ...tugasSubs]
      .filter((s) => s.fullyGraded)
      .sort((a, b) => a.submittedAt - b.submittedAt);

    return allGraded.map((s) => {
      const exam = exams.find((e) => e.id === s.examId);
      const pct = Math.round((s.totalScore / s.maxScore) * 100);
      const isUjian = !exam?.type || exam.type === "exam";
      return {
        name: formatDate(s.submittedAt, { month: "short", day: "numeric" }),
        ujian: isUjian ? pct : undefined,
        tugas: !isUjian ? pct : undefined,
        label: exam?.title?.slice(0, 15) ?? "",
      };
    });
  }, [ujianSubs, tugasSubs, exams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Riwayat Belajar</h1>
        <p className="text-sm text-muted-foreground">Pantau perkembangan belajarmu di sini.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<BookOpen className="h-5 w-5" />}
          color="indigo"
          label="Materi Selesai"
          value={`${myProgress.length}/${myMats.length}`}
          sub={`${matPct}%`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          color="emerald"
          label="Rata-rata Ujian"
          value={avgUjian !== null ? `${avgUjian}` : "-"}
          sub={avgUjian !== null ? (avgUjian >= 70 ? "Bagus" : "Tingkatkan") : "Belum ada"}
        />
        <SummaryCard
          icon={<FileEdit className="h-5 w-5" />}
          color="amber"
          label="Rata-rata Tugas"
          value={avgTugas !== null ? `${avgTugas}` : "-"}
          sub={avgTugas !== null ? (avgTugas >= 70 ? "Bagus" : "Tingkatkan") : "Belum ada"}
        />
        <SummaryCard
          icon={<ClipboardList className="h-5 w-5" />}
          color="purple"
          label="Total Dikerjakan"
          value={`${ujianSubs.length + tugasSubs.length}`}
          sub={`${ujianSubs.length} ujian · ${tugasSubs.length} tugas`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grafik Perkembangan Nilai</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Belum ada nilai. Selesaikan ujian atau tugas untuk melihat grafik.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(val: number, name: string) => [
                    `${val}/100`,
                    name === "ujian" ? "Ujian" : "Tugas",
                  ]}
                />
                <Legend
                  formatter={(val) => (val === "ujian" ? "Ujian" : "Tugas")}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="ujian"
                  stroke="hsl(239 84% 67%)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls={false}
                  name="ujian"
                />
                <Line
                  type="monotone"
                  dataKey="tugas"
                  stroke="hsl(38 92% 50%)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls={false}
                  name="tugas"
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Materi yang Dipelajari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{matPct}%</span>
              </div>
              <Progress value={matPct} className="h-2" />
            </div>
            <div className="divide-y max-h-60 overflow-y-auto">
              {myMats.map((m) => {
                const done = myProgress.find((p) => p.materialId === m.id);
                return (
                  <Link key={m.id} href={`/student/materials/${m.id}`}>
                    <div className="py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 rounded px-1 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{m.title}</div>
                        {done && (
                          <div className="text-xs text-muted-foreground">
                            Selesai {formatDate(done.completedAt)}
                          </div>
                        )}
                      </div>
                      {done ? (
                        <Badge className="ml-2 shrink-0">Selesai</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-2 shrink-0">
                          Belum
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
              {myMats.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Belum ada materi.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-indigo-500" />
                Riwayat Ujian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y max-h-48 overflow-y-auto">
                {ujianSubs.length === 0 && (
                  <div className="text-sm text-muted-foreground py-3 text-center">
                    Belum ada ujian selesai.
                  </div>
                )}
                {[...ujianSubs].reverse().map((s) => {
                  const exam = exams.find((e) => e.id === s.examId);
                  const pct = s.fullyGraded
                    ? Math.round((s.totalScore / s.maxScore) * 100)
                    : null;
                  return (
                    <Link key={s.id} href={`/student/exams/${exam?.id}/result`}>
                      <div className="py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 rounded px-1 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{exam?.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(s.submittedAt)}
                          </div>
                        </div>
                        {pct !== null ? (
                          <Badge
                            variant={pct >= 70 ? "default" : "secondary"}
                            className="ml-2 shrink-0"
                          >
                            {pct}/100
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                            Menunggu
                          </Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
              {ujianSubs.length > 0 && (
                <Button asChild variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Link href="/student/exams">
                    Lihat semua <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-amber-500" />
                Riwayat Tugas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y max-h-48 overflow-y-auto">
                {tugasSubs.length === 0 && (
                  <div className="text-sm text-muted-foreground py-3 text-center">
                    Belum ada tugas dikumpulkan.
                  </div>
                )}
                {[...tugasSubs].reverse().map((s) => {
                  const exam = exams.find((e) => e.id === s.examId);
                  const pct = s.fullyGraded
                    ? Math.round((s.totalScore / s.maxScore) * 100)
                    : null;
                  return (
                    <Link key={s.id} href={`/student/exams/${exam?.id}/result`}>
                      <div className="py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 rounded px-1 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{exam?.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(s.submittedAt)}
                          </div>
                        </div>
                        {pct !== null ? (
                          <Badge
                            variant={pct >= 70 ? "default" : "secondary"}
                            className="ml-2 shrink-0"
                          >
                            {pct}/100
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                            Menunggu
                          </Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
              {tugasSubs.length > 0 && (
                <Button asChild variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  <Link href="/student/exams">
                    Lihat semua <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "amber" | "purple";
  label: string;
  value: string;
  sub: string;
}) {
  const colors = {
    indigo: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600",
    emerald: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600",
    amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-600",
    purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]} mb-3`}>
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        <div className="text-xs text-muted-foreground mt-1 font-medium">{sub}</div>
      </CardContent>
    </Card>
  );
}
