import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft, CheckCircle2, XCircle, FileText, Save, TrendingUp,
  Award, AlertTriangle, Users as UsersIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, ExamSubmission, User, ExamAnswer, AppNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

const PASSING_COLOR = "#10b981";
const FAIL_COLOR = "#f59e0b";

export default function TeacherExamResults() {
  const { id } = useParams();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const users = useStore<User[]>("users", []);
  const exam = exams.find((e) => e.id === id);
  const [grading, setGrading] = useState<ExamSubmission | null>(null);

  const examSubs = useMemo(
    () => submissions.filter((s) => s.examId === id),
    [submissions, id],
  );

  if (!exam) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ujian tidak ditemukan.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/teacher/exams">Kembali</Link>
        </Button>
      </div>
    );
  }

  const passing = exam.passingScore ?? 70;

  const stats = useMemo(() => {
    const graded = examSubs.filter((s) => s.fullyGraded && s.maxScore > 0);
    if (graded.length === 0) return { avg: 0, max: 0, min: 0, graded: 0, passCount: 0 };
    const pcts = graded.map((s) => Math.round((s.totalScore / s.maxScore) * 100));
    const passCount = pcts.filter((p) => p >= passing).length;
    return {
      avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
      max: Math.max(...pcts),
      min: Math.min(...pcts),
      graded: graded.length,
      passCount,
    };
  }, [examSubs, passing]);

  // Score distribution for bar chart
  const chartData = useMemo(() => {
    const bins = [
      { range: "0–19", min: 0, max: 20, count: 0 },
      { range: "20–39", min: 20, max: 40, count: 0 },
      { range: "40–59", min: 40, max: 60, count: 0 },
      { range: "60–79", min: 60, max: 80, count: 0 },
      { range: "80–100", min: 80, max: 101, count: 0 },
    ];
    for (const s of examSubs.filter((s) => s.fullyGraded && s.maxScore > 0)) {
      const pct = Math.round((s.totalScore / s.maxScore) * 100);
      for (const bin of bins) {
        if (pct >= bin.min && pct < bin.max) { bin.count++; break; }
      }
    }
    return bins;
  }, [examSubs]);

  const kettPct = stats.graded > 0 ? Math.round((stats.passCount / stats.graded) * 100) : 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/teacher/exams"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
      </Button>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          {exam.type === "tugas" && <Badge variant="secondary">Tugas</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{exam.description}</p>
        <div className="text-xs text-muted-foreground mt-1">
          KKM: {passing}% · {exam.questions.length} soal · {exam.durationMinutes} menit
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Submission" value={examSubs.length.toString()} icon={<UsersIcon className="h-4 w-4 text-primary" />} />
        <StatBox label="Rata-rata" value={stats.graded > 0 ? `${stats.avg}/100` : "–"} icon={<TrendingUp className="h-4 w-4 text-blue-500" />} />
        <StatBox label="Nilai Tertinggi" value={stats.graded > 0 ? `${stats.max}/100` : "–"} icon={<Award className="h-4 w-4 text-amber-500" />} />
        <StatBox label="Nilai Terendah" value={stats.graded > 0 ? `${stats.min}/100` : "–"} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
      </div>

      {/* Ketuntasan */}
      {stats.graded > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold text-sm">Persentase Ketuntasan</div>
                <div className="text-xs text-muted-foreground">
                  {stats.passCount} dari {stats.graded} siswa mencapai KKM {passing}%
                </div>
              </div>
              <div className={`text-2xl font-bold ${kettPct >= 75 ? "text-emerald-600" : kettPct >= 50 ? "text-amber-500" : "text-destructive"}`}>
                {kettPct}%
              </div>
            </div>
            <Progress value={kettPct} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> {stats.passCount} tuntas
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <XCircle className="h-3 w-3" /> {stats.graded - stats.passCount} belum tuntas
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Chart */}
      {examSubs.filter((s) => s.fullyGraded).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Nilai</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, "Siswa"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", color: "hsl(var(--card-foreground))", fontSize: "12px" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.min >= passing ? PASSING_COLOR : FAIL_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />Di atas KKM</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />Di bawah KKM</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Submission</CardTitle>
        </CardHeader>
        <CardContent>
          {examSubs.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Belum ada siswa yang submit.
            </div>
          )}
          <div className="divide-y">
            {examSubs
              .slice()
              .sort((a, b) => {
                if (a.fullyGraded && b.fullyGraded) {
                  return (b.totalScore / b.maxScore) - (a.totalScore / a.maxScore);
                }
                return a.fullyGraded ? 1 : -1;
              })
              .map((sub) => {
                const student = users.find((u) => u.id === sub.userId);
                const pct = sub.maxScore > 0 ? Math.round((sub.totalScore / sub.maxScore) * 100) : 0;
                const passed = pct >= passing;
                return (
                  <div key={sub.id} className="py-3 flex items-center gap-3" data-testid={`submission-${sub.id}`}>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                      style={{ background: student?.avatarColor ?? "#6366f1" }}>
                      {student?.name.charAt(0) ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{student?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Submit {formatDateTime(sub.submittedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      {sub.fullyGraded ? (
                        <div className="flex items-center gap-2">
                          <Badge variant={passed ? "default" : "secondary"}
                            className={passed ? "bg-emerald-600" : ""}>
                            {sub.totalScore}/{sub.maxScore} ({pct}%)
                          </Badge>
                          {passed
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : <XCircle className="h-4 w-4 text-amber-500" />
                          }
                        </div>
                      ) : (
                        <Badge variant="outline">Perlu koreksi</Badge>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setGrading(sub)}
                      data-testid={`button-grade-${sub.id}`}>
                      {sub.fullyGraded ? "Lihat" : "Koreksi"}
                    </Button>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {grading && (
        <GradingDialog
          submission={grading}
          exam={exam}
          student={users.find((u) => u.id === grading.userId)}
          onClose={() => setGrading(null)}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function GradingDialog({
  submission, exam, student, onClose,
}: {
  submission: ExamSubmission;
  exam: Exam;
  student?: User;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<ExamAnswer[]>(submission.answers);

  function setEssayScore(qid: string, val: string) {
    const q = exam.questions.find((qq) => qq.id === qid);
    const max = q?.points ?? 0;
    const num = val === "" ? undefined : Math.min(max, Math.max(0, parseInt(val) || 0));
    setAnswers((a) => a.map((x) => (x.questionId === qid ? { ...x, essayScore: num } : x)));
  }
  function setEssayFeedback(qid: string, val: string) {
    setAnswers((a) => a.map((x) => (x.questionId === qid ? { ...x, essayFeedback: val } : x)));
  }

  function save() {
    let auto = 0; let manual = 0; let max = 0; let allGraded = true;
    for (const q of exam.questions) {
      max += q.points;
      const a = answers.find((aa) => aa.questionId === q.id);
      if (q.type === "mc") {
        if (a?.mcAnswer === q.correctAnswer) auto += q.points;
      } else if (q.type === "tf") {
        if (a?.mcAnswer === q.correctAnswer) auto += q.points;
      } else if (q.type === "fill") {
        const sa = (a?.fillAnswer ?? "").trim().toLowerCase();
        const ca = (q.fillAnswer ?? "").trim().toLowerCase();
        if (sa && ca && sa === ca) auto += q.points;
      } else {
        if (a?.essayScore === undefined) allGraded = false;
        else manual += a.essayScore;
      }
    }
    const updated: ExamSubmission = {
      ...submission, answers, autoScore: auto, manualScore: manual,
      totalScore: auto + manual, maxScore: max, fullyGraded: allGraded,
      gradedAt: allGraded ? Date.now() : undefined,
    };
    const all = read("examSubmissions", []);
    write("examSubmissions", all.map((s) => (s.id === submission.id ? updated : s)));
    if (allGraded) {
      const notifs = read("notifications", []);
      const n: AppNotification = {
        id: uid("n_"), userId: submission.userId, type: "exam_graded",
        title: "Ujian sudah dinilai",
        message: `${exam.title}: ${updated.totalScore}/${updated.maxScore}`,
        link: `/student/exams/${exam.id}/result`, createdAt: Date.now(), read: false,
      };
      write("notifications", [...notifs, n]);
      void mcApi.gradeExam(submission.id, { ...updated, notification: n }).catch(() => {});
    } else {
      void mcApi.gradeExam(submission.id, updated).catch(() => {});
    }
    onClose();
  }

  const passing = exam.passingScore ?? 70;
  const total = answers.reduce((sum, a) => {
    const q = exam.questions.find((qq) => qq.id === a.questionId);
    if (!q) return sum;
    if (q.type === "mc" && a.mcAnswer === q.correctAnswer) return sum + q.points;
    if (q.type === "tf" && a.mcAnswer === q.correctAnswer) return sum + q.points;
    if (q.type === "fill") {
      const sa = (a.fillAnswer ?? "").trim().toLowerCase();
      const ca = (q.fillAnswer ?? "").trim().toLowerCase();
      if (sa && ca && sa === ca) return sum + q.points;
    }
    if (q.type === "essay" && a.essayScore !== undefined) return sum + a.essayScore;
    return sum;
  }, 0);
  const maxScore = exam.questions.reduce((s, q) => s + q.points, 0);
  const pct = maxScore > 0 ? Math.round((total / maxScore) * 100) : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Koreksi: {student?.name}
            <Badge variant={pct >= passing ? "default" : "secondary"} className={pct >= passing ? "bg-emerald-600" : ""}>
              {total}/{maxScore} ({pct}%)
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {exam.questions.map((q, idx) => {
            const a = answers.find((aa) => aa.questionId === q.id);
            const isAutoCorrect = (q.type === "mc" || q.type === "tf") && a?.mcAnswer === q.correctAnswer;
            const isFillCorrect = q.type === "fill" &&
              (a?.fillAnswer ?? "").trim().toLowerCase() === (q.fillAnswer ?? "").trim().toLowerCase() &&
              (a?.fillAnswer ?? "").trim() !== "";
            return (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge>{idx + 1}</Badge>
                      <Badge variant="outline">
                        {q.type === "mc" ? "Pilihan Ganda" : q.type === "tf" ? "Benar/Salah" : q.type === "fill" ? "Isian Singkat" : "Essay"}
                      </Badge>
                      <Badge variant="secondary">{q.points} pts</Badge>
                    </div>
                    {(q.type === "mc" || q.type === "tf" || q.type === "fill") && (
                      isAutoCorrect || isFillCorrect
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <div className="text-sm font-medium">{q.question}</div>

                  {/* MC display */}
                  {q.type === "mc" && (
                    <div className="space-y-1">
                      {q.options!.map((opt, oi) => (
                        <div key={oi} className={`text-sm px-3 py-2 rounded ${
                          oi === q.correctAnswer ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : oi === a?.mcAnswer ? "bg-destructive/10 text-destructive"
                          : "bg-muted"
                        }`}>
                          <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                          {oi === q.correctAnswer && " ✓"}
                          {oi === a?.mcAnswer && oi !== q.correctAnswer && " (jawaban siswa)"}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TF display */}
                  {q.type === "tf" && (
                    <div className="space-y-1">
                      {[{ val: 0, label: "Benar" }, { val: 1, label: "Salah" }].map(({ val, label }) => (
                        <div key={val} className={`text-sm px-3 py-2 rounded ${
                          val === q.correctAnswer ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : val === a?.mcAnswer ? "bg-destructive/10 text-destructive"
                          : "bg-muted"
                        }`}>
                          {label}
                          {val === q.correctAnswer && " ✓"}
                          {val === a?.mcAnswer && val !== q.correctAnswer && " (jawaban siswa)"}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fill display */}
                  {q.type === "fill" && (
                    <div className="space-y-2">
                      <div className="text-sm bg-muted p-3 rounded-md">
                        <span className="text-xs text-muted-foreground block mb-1">Jawaban siswa:</span>
                        {a?.fillAnswer || <span className="text-muted-foreground italic">Tidak dijawab</span>}
                      </div>
                      <div className="text-sm bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md text-emerald-700 dark:text-emerald-300">
                        <span className="text-xs block mb-1">Kunci jawaban:</span>
                        {q.fillAnswer}
                      </div>
                    </div>
                  )}

                  {/* Essay grading */}
                  {q.type === "essay" && (
                    <>
                      <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {a?.essayAnswer || <span className="text-muted-foreground italic">Tidak dijawab</span>}
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nilai (0–{q.points})</Label>
                          <Input type="number" min="0" max={q.points}
                            value={a?.essayScore ?? ""}
                            onChange={(e) => setEssayScore(q.id, e.target.value)}
                            data-testid={`input-essay-score-${idx}`} />
                        </div>
                        <div>
                          <Label className="text-xs">Feedback (opsional)</Label>
                          <Textarea value={a?.essayFeedback ?? ""} onChange={(e) => setEssayFeedback(q.id, e.target.value)} rows={2} />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} data-testid="button-save-grading">
            <Save className="h-4 w-4 mr-2" />Simpan Penilaian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
