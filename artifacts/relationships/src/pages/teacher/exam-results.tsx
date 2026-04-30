import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, FileText, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type {
  Exam,
  ExamSubmission,
  User,
  ExamAnswer,
  AppNotification,
} from "@/lib/types";
import { formatDateTime } from "@/lib/format";

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

  const stats = useMemo(() => {
    if (examSubs.length === 0) return { avg: 0, max: 0, min: 0, graded: 0 };
    const graded = examSubs.filter((s) => s.fullyGraded);
    if (graded.length === 0) return { avg: 0, max: 0, min: 0, graded: 0 };
    const pcts = graded.map((s) => Math.round((s.totalScore / s.maxScore) * 100));
    return {
      avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
      max: Math.max(...pcts),
      min: Math.min(...pcts),
      graded: graded.length,
    };
  }, [examSubs]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/teacher/exams">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kembali
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{exam.title}</h1>
        <p className="text-sm text-muted-foreground">{exam.description}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Submission" value={examSubs.length.toString()} />
        <StatBox label="Sudah dinilai" value={stats.graded.toString()} />
        <StatBox label="Rata-rata" value={`${stats.avg}/100`} />
        <StatBox label="Nilai tertinggi" value={`${stats.max}/100`} />
      </div>

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
            {examSubs.map((sub) => {
              const student = users.find((u) => u.id === sub.userId);
              const pct = Math.round((sub.totalScore / sub.maxScore) * 100);
              return (
                <div
                  key={sub.id}
                  className="py-3 flex items-center gap-3"
                  data-testid={`submission-${sub.id}`}
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ background: student?.avatarColor ?? "#6366f1" }}
                  >
                    {student?.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{student?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Submit {formatDateTime(sub.submittedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    {sub.fullyGraded ? (
                      <Badge variant={pct >= 70 ? "default" : "secondary"}>
                        {sub.totalScore}/{sub.maxScore} ({pct})
                      </Badge>
                    ) : (
                      <Badge variant="outline">Perlu koreksi</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGrading(sub)}
                    data-testid={`button-grade-${sub.id}`}
                  >
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function GradingDialog({
  submission,
  exam,
  student,
  onClose,
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
    setAnswers((a) =>
      a.map((x) => (x.questionId === qid ? { ...x, essayScore: num } : x)),
    );
  }

  function setEssayFeedback(qid: string, val: string) {
    setAnswers((a) =>
      a.map((x) => (x.questionId === qid ? { ...x, essayFeedback: val } : x)),
    );
  }

  function save() {
    let auto = 0;
    let manual = 0;
    let max = 0;
    let allGraded = true;
    for (const q of exam.questions) {
      max += q.points;
      const a = answers.find((aa) => aa.questionId === q.id);
      if (q.type === "mc") {
        if (a?.mcAnswer === q.correctAnswer) auto += q.points;
      } else {
        if (a?.essayScore === undefined) allGraded = false;
        else manual += a.essayScore;
      }
    }
    const updated: ExamSubmission = {
      ...submission,
      answers,
      autoScore: auto,
      manualScore: manual,
      totalScore: auto + manual,
      maxScore: max,
      fullyGraded: allGraded,
      gradedAt: allGraded ? Date.now() : undefined,
    };

    const all = read("examSubmissions", []);
    write("examSubmissions", all.map((s) => (s.id === submission.id ? updated : s)));

    if (allGraded) {
      const notifs = read("notifications", []);
      const n: AppNotification = {
        id: uid("n_"),
        userId: submission.userId,
        type: "exam_graded",
        title: "Ujian sudah dinilai",
        message: `${exam.title}: ${updated.totalScore}/${updated.maxScore}`,
        link: `/student/exams/${exam.id}/result`,
        createdAt: Date.now(),
        read: false,
      };
      write("notifications", [...notifs, n]);
    }

    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Koreksi: {student?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {exam.questions.map((q, idx) => {
            const a = answers.find((aa) => aa.questionId === q.id);
            const isCorrect = q.type === "mc" && a?.mcAnswer === q.correctAnswer;
            return (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge>{idx + 1}</Badge>
                      <Badge variant="outline">
                        {q.type === "mc" ? "Pilihan Ganda" : "Essay"}
                      </Badge>
                      <Badge variant="secondary">{q.points} pts</Badge>
                    </div>
                    {q.type === "mc" &&
                      (isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ))}
                  </div>
                  <div className="text-sm font-medium">{q.question}</div>
                  {q.type === "mc" ? (
                    <div className="space-y-1">
                      {q.options!.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`text-sm px-3 py-2 rounded ${
                            oi === q.correctAnswer
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : oi === a?.mcAnswer
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted"
                          }`}
                        >
                          <span className="font-semibold mr-2">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          {opt}
                          {oi === q.correctAnswer && " ✓"}
                          {oi === a?.mcAnswer && oi !== q.correctAnswer && " (jawaban siswa)"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {a?.essayAnswer || (
                          <span className="text-muted-foreground italic">
                            Tidak dijawab
                          </span>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nilai (0-{q.points})</Label>
                          <Input
                            type="number"
                            min="0"
                            max={q.points}
                            value={a?.essayScore ?? ""}
                            onChange={(e) => setEssayScore(q.id, e.target.value)}
                            data-testid={`input-essay-score-${idx}`}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Feedback (opsional)</Label>
                          <Textarea
                            value={a?.essayFeedback ?? ""}
                            onChange={(e) => setEssayFeedback(q.id, e.target.value)}
                            rows={2}
                          />
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
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} data-testid="button-save-grading">
            <Save className="h-4 w-4 mr-2" />
            Simpan Penilaian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
