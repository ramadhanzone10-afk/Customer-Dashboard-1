import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, useStore } from "@/lib/auth";
import type { Exam, ExamSubmission } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export default function StudentExamResult() {
  const { id } = useParams();
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);

  const exam = exams.find((e) => e.id === id);
  const sub = useMemo(
    () => submissions.find((s) => s.examId === id && s.userId === user!.id),
    [submissions, id, user],
  );

  if (!exam || !sub) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Hasil ujian tidak ditemukan.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/student/exams">Kembali</Link>
        </Button>
      </div>
    );
  }

  const pct = sub.fullyGraded ? Math.round((sub.totalScore / sub.maxScore) * 100) : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student/exams">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kembali
        </Link>
      </Button>

      <Card
        className={
          sub.fullyGraded
            ? pct! >= 70
              ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
            : ""
        }
      >
        <CardHeader>
          <CardTitle className="text-xl">{exam.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {sub.fullyGraded ? (
            <div className="flex items-center gap-6">
              <div className="text-6xl font-bold tabular-nums">
                {sub.totalScore}
                <span className="text-2xl text-muted-foreground">/{sub.maxScore}</span>
              </div>
              <div>
                <Badge className="mb-2" variant={pct! >= 70 ? "default" : "secondary"}>
                  {pct! >= 70 ? "Lulus" : "Perlu belajar lagi"}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Submit: {formatDateTime(sub.submittedAt)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="font-semibold">Menunggu koreksi guru</div>
                <div className="text-sm text-muted-foreground">
                  Soal essay sedang diperiksa. Nilai pilihan ganda sementara:{" "}
                  {sub.autoScore}/{sub.maxScore}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Detail Jawaban</h2>
        {exam.questions.map((q, idx) => {
          const a = sub.answers.find((aa) => aa.questionId === q.id);
          const isMc = q.type === "mc";
          const isCorrect = isMc && a?.mcAnswer === q.correctAnswer;
          return (
            <Card key={q.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge>{idx + 1}</Badge>
                    <Badge variant="outline">{isMc ? "Pilihan Ganda" : "Essay"}</Badge>
                    <Badge variant="secondary">{q.points} poin</Badge>
                  </div>
                  {isMc &&
                    (isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ))}
                  {!isMc && a?.essayScore !== undefined && (
                    <Badge>
                      {a.essayScore}/{q.points}
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-medium">{q.question}</div>
                {isMc ? (
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
                        {oi === q.correctAnswer && " ✓ (jawaban benar)"}
                        {oi === a?.mcAnswer && oi !== q.correctAnswer && " (jawabanmu)"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">Jawabanmu:</div>
                    <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {a?.essayAnswer || (
                        <span className="text-muted-foreground italic">Tidak dijawab</span>
                      )}
                    </div>
                    {a?.essayFeedback && (
                      <>
                        <div className="text-xs text-muted-foreground">Feedback guru:</div>
                        <div className="text-sm bg-primary/5 border border-primary/20 p-3 rounded-md">
                          {a.essayFeedback}
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
