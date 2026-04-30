import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Clock, AlertTriangle, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, ExamAnswer, ExamSubmission } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function StudentTakeExam() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const exam = exams.find((e) => e.id === id);
  const existing = submissions.find((s) => s.examId === id && s.userId === user!.id);

  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submittedRef = useRef(false);

  const totalMs = (exam?.durationMinutes ?? 0) * 60 * 1000;
  const elapsed = startTime ? Date.now() - startTime : 0;
  const [, force] = useState(0);
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  const remaining = Math.max(0, totalMs - elapsed);

  useEffect(() => {
    if (started && remaining === 0 && !submittedRef.current) {
      submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, started]);

  if (!exam) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ujian tidak ditemukan.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/student/exams">Kembali</Link>
        </Button>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Kamu sudah mengerjakan ujian ini.</p>
        <Button asChild>
          <Link href={`/student/exams/${exam.id}/result`}>Lihat hasil</Link>
        </Button>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/student/exams">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Kembali
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{exam.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{exam.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Jumlah soal" value={exam.questions.length.toString()} />
              <Stat label="Durasi" value={`${exam.durationMinutes} menit`} />
              <Stat
                label="Pilihan ganda"
                value={exam.questions.filter((q) => q.type === "mc").length.toString()}
              />
              <Stat
                label="Essay"
                value={exam.questions.filter((q) => q.type === "essay").length.toString()}
              />
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Setelah memulai, timer akan berjalan. Ujian akan otomatis ter-submit jika
                waktu habis.
              </AlertDescription>
            </Alert>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                setStartTime(Date.now());
                setStarted(true);
              }}
              data-testid="button-start-exam"
            >
              Mulai Ujian Sekarang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = exam.questions[currentIdx];
  const answer = answers[q.id];
  const answered = exam.questions.filter((qq) => {
    const a = answers[qq.id];
    if (!a) return false;
    return qq.type === "mc" ? a.mcAnswer !== undefined : Boolean(a.essayAnswer?.trim());
  }).length;

  function setMc(qid: string, val: number) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], questionId: qid, mcAnswer: val } }));
  }
  function setEssay(qid: string, val: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], questionId: qid, essayAnswer: val } }));
  }

  function submit(auto: boolean) {
    if (submittedRef.current) return;
    submittedRef.current = true;

    let autoScore = 0;
    let max = 0;
    const finalAnswers: ExamAnswer[] = exam!.questions.map((qq) => {
      const a = answers[qq.id] ?? { questionId: qq.id };
      max += qq.points;
      if (qq.type === "mc" && a.mcAnswer === qq.correctAnswer) autoScore += qq.points;
      return { ...a, questionId: qq.id };
    });
    const hasEssay = exam!.questions.some((qq) => qq.type === "essay");
    const sub: ExamSubmission = {
      id: uid("s_"),
      examId: exam!.id,
      userId: user!.id,
      answers: finalAnswers,
      autoScore,
      manualScore: 0,
      totalScore: autoScore,
      maxScore: max,
      submittedAt: Date.now(),
      fullyGraded: !hasEssay,
      gradedAt: !hasEssay ? Date.now() : undefined,
    };
    const all = read("examSubmissions", []);
    write("examSubmissions", [...all, sub]);
    setLocation(`/student/exams/${exam!.id}/result`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="sticky top-0 -mx-4 md:mx-0 md:rounded-lg bg-background/95 backdrop-blur z-20 border-b md:border md:shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className={cn("h-4 w-4", remaining < 60000 && "text-destructive")} />
            <span
              className={cn(
                "font-mono font-bold tabular-nums",
                remaining < 60000 && "text-destructive",
              )}
              data-testid="text-timer"
            >
              {formatDuration(remaining)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Dijawab: {answered} / {exam.questions.length}
          </div>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            data-testid="button-submit-exam"
          >
            <Send className="h-3 w-3 mr-1" />
            Submit
          </Button>
        </div>
        <Progress value={(answered / exam.questions.length) * 100} className="h-1.5" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge>Soal {currentIdx + 1}</Badge>
              <Badge variant="outline">
                {q.type === "mc" ? "Pilihan Ganda" : "Essay"}
              </Badge>
              <Badge variant="secondary">{q.points} poin</Badge>
            </div>
          </div>
          <CardTitle className="text-base font-normal mt-3 leading-relaxed">
            {q.question}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q.type === "mc" ? (
            <RadioGroup
              value={answer?.mcAnswer !== undefined ? String(answer.mcAnswer) : ""}
              onValueChange={(v) => setMc(q.id, parseInt(v))}
              className="space-y-2"
            >
              {q.options!.map((opt, oi) => (
                <label
                  key={oi}
                  className={cn(
                    "flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent transition-colors",
                    answer?.mcAnswer === oi && "border-primary bg-primary/5",
                  )}
                  data-testid={`option-${currentIdx}-${oi}`}
                >
                  <RadioGroupItem value={String(oi)} id={`o-${q.id}-${oi}`} />
                  <span className="font-semibold mr-2">
                    {String.fromCharCode(65 + oi)}.
                  </span>
                  <span className="flex-1 text-sm">{opt}</span>
                </label>
              ))}
            </RadioGroup>
          ) : (
            <Textarea
              rows={8}
              value={answer?.essayAnswer ?? ""}
              onChange={(e) => setEssay(q.id, e.target.value)}
              placeholder="Tulis jawabanmu di sini..."
              data-testid={`input-essay-${currentIdx}`}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          data-testid="button-prev"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Sebelumnya
        </Button>
        <div className="flex gap-1 max-w-[40%] overflow-x-auto">
          {exam.questions.map((qq, i) => {
            const a = answers[qq.id];
            const isAnswered =
              qq.type === "mc" ? a?.mcAnswer !== undefined : Boolean(a?.essayAnswer?.trim());
            return (
              <button
                key={qq.id}
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "h-8 w-8 rounded-md text-xs font-semibold flex items-center justify-center shrink-0",
                  i === currentIdx
                    ? "bg-primary text-primary-foreground"
                    : isAnswered
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-muted",
                )}
                data-testid={`nav-q-${i}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <Button
          disabled={currentIdx === exam.questions.length - 1}
          onClick={() => setCurrentIdx((i) => Math.min(exam.questions.length - 1, i + 1))}
          data-testid="button-next"
        >
          Berikutnya
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit ujian?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kamu sudah menjawab {answered} dari {exam.questions.length} soal. Setelah submit,
            jawaban tidak bisa diubah.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Lanjut mengerjakan
            </Button>
            <Button onClick={() => submit(false)} data-testid="button-confirm-submit">
              Ya, submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
