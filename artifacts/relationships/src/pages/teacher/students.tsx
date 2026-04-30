import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/auth";
import type {
  User,
  Material,
  MaterialProgress,
  Exam,
  ExamSubmission,
} from "@/lib/types";
import { formatRelative } from "@/lib/format";

export default function TeacherStudents() {
  const users = useStore<User[]>("users", []);
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);

  const students = useMemo(
    () =>
      users
        .filter((u) => u.role === "student")
        .filter((u) =>
          search ? u.name.toLowerCase().includes(search.toLowerCase()) : true,
        ),
    [users, search],
  );

  function studentStats(uid: string) {
    const assignedMats = materials.filter((m) => m.assignedTo.includes(uid));
    const completed = progress.filter((p) => p.userId === uid).length;
    const matPct =
      assignedMats.length === 0 ? 0 : Math.round((completed / assignedMats.length) * 100);

    const mySubs = submissions.filter((s) => s.userId === uid && s.fullyGraded);
    const avg =
      mySubs.length === 0
        ? null
        : Math.round(
            mySubs.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
              mySubs.length,
          );

    const assignedExams = exams.filter((e) => e.assignedTo.includes(uid));
    const completedExams = submissions.filter((s) => s.userId === uid).length;
    const examPct =
      assignedExams.length === 0
        ? 0
        : Math.round((completedExams / assignedExams.length) * 100);

    return { matPct, avg, examPct, assignedMats, completed, mySubs, assignedExams };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari siswa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-students"
          />
        </div>
        <Badge variant="secondary">{students.length} siswa</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {students.map((s) => {
          const st = studentStats(s.id);
          return (
            <Card
              key={s.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelected(s)}
              data-testid={`student-card-${s.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ background: s.avatarColor ?? "#6366f1" }}
                  >
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Materi selesai</span>
                      <span className="font-medium">{st.matPct}%</span>
                    </div>
                    <Progress value={st.matPct} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Ujian dikerjakan</span>
                      <span className="font-medium">{st.examPct}%</span>
                    </div>
                    <Progress value={st.examPct} className="h-2" />
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Rata-rata nilai</span>
                    <Badge variant={st.avg && st.avg >= 70 ? "default" : "secondary"}>
                      {st.avg !== null ? `${st.avg}/100` : "-"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (() => {
            const st = studentStats(selected.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ background: selected.avatarColor ?? "#6366f1" }}
                    >
                      {selected.name.charAt(0)}
                    </div>
                    {selected.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Materi ({st.completed}/{st.assignedMats.length})
                    </h4>
                    <div className="space-y-1">
                      {st.assignedMats.map((m) => {
                        const done = progress.find(
                          (p) => p.userId === selected.id && p.materialId === m.id,
                        );
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent"
                          >
                            <span className="truncate">{m.title}</span>
                            {done ? (
                              <Badge variant="default" className="ml-2">
                                Selesai
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="ml-2">
                                Belum
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                      {st.assignedMats.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          Belum ada materi.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Riwayat Ujian ({st.mySubs.length})
                    </h4>
                    <div className="space-y-1">
                      {st.mySubs.map((s) => {
                        const exam = exams.find((e) => e.id === s.examId);
                        const pct = Math.round((s.totalScore / s.maxScore) * 100);
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent"
                          >
                            <div>
                              <div>{exam?.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatRelative(s.submittedAt)}
                              </div>
                            </div>
                            <Badge variant={pct >= 70 ? "default" : "secondary"}>
                              {pct}/100
                            </Badge>
                          </div>
                        );
                      })}
                      {st.mySubs.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          Belum ada ujian dikoreksi.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
