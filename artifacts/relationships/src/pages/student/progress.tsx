import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useAuth, useStore } from "@/lib/auth";
import type {
  Material,
  MaterialProgress,
  Exam,
  ExamSubmission,
} from "@/lib/types";
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
  const mySubs = useMemo(
    () =>
      submissions
        .filter((s) => s.userId === user!.id && s.fullyGraded)
        .sort((a, b) => a.submittedAt - b.submittedAt),
    [submissions, user],
  );

  const matPct = myMats.length === 0 ? 0 : Math.round((myProgress.length / myMats.length) * 100);
  const avg =
    mySubs.length === 0
      ? 0
      : Math.round(
          mySubs.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
            mySubs.length,
        );

  const chartData = mySubs.map((s) => {
    const exam = exams.find((e) => e.id === s.examId);
    return {
      name: exam?.title.slice(0, 12) ?? "",
      value: Math.round((s.totalScore / s.maxScore) * 100),
      date: formatDate(s.submittedAt, { month: "short", day: "numeric" }),
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Materi Selesai</div>
            <div className="text-3xl font-bold mt-1">
              {myProgress.length}/{myMats.length}
            </div>
            <Progress value={matPct} className="h-2 mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Ujian Selesai</div>
            <div className="text-3xl font-bold mt-1">{mySubs.length}</div>
            <div className="text-xs text-muted-foreground mt-3">
              dari {exams.filter((e) => e.assignedTo.includes(user!.id)).length} ujian aktif
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Rata-rata Nilai</div>
            <div className="text-3xl font-bold mt-1">{avg}/100</div>
            <Badge variant={avg >= 70 ? "default" : "secondary"} className="mt-3">
              {avg >= 80 ? "Excellent" : avg >= 70 ? "Bagus" : "Tingkatkan"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grafik Perkembangan Nilai</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Belum ada nilai ujian. Selesaikan ujian untuk melihat grafik.
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
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {myMats.map((m) => {
                const done = myProgress.find((p) => p.materialId === m.id);
                return (
                  <div key={m.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{m.title}</span>
                    {done ? (
                      <Badge>Selesai</Badge>
                    ) : (
                      <Badge variant="outline">Belum</Badge>
                    )}
                  </div>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Ujian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {mySubs.map((s) => {
                const exam = exams.find((e) => e.id === s.examId);
                const pct = Math.round((s.totalScore / s.maxScore) * 100);
                return (
                  <div key={s.id} className="py-2 flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{exam?.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(s.submittedAt)}
                      </div>
                    </div>
                    <Badge variant={pct >= 70 ? "default" : "secondary"}>{pct}/100</Badge>
                  </div>
                );
              })}
              {mySubs.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Belum ada nilai ujian.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
