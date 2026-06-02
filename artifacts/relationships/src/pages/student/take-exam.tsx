import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Clock, AlertTriangle, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, Question, ExamAnswer, ExamSubmission } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { mcApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const QTYPE_LABELS: Record<string, string> = {
  mc: "Pilihan Ganda", tf: "Benar/Salah", fill: "Isian Singkat", essay: "Essay",
};

function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  let s = seed ?? Date.now();
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudentTakeExam() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const exam = exams.find((e) => e.id === id);
  const existing = submissions.find((s) => s.examId === id && s.userId === user!.id);

  // Shuffled question order (deterministic per user+exam)
  const displayQuestions = useMemo(() => {
    if (!exam) return [];
    const seed = Array.from(`${user!.id}-${exam.id}`).reduce((a, c) => a + c.charCodeAt(0), 0);
    const qs = exam.shuffleQuestions ? shuffleArray([...exam.questions], seed) : [...exam.questions];
    if (exam.shuffleOptions) {
      return qs.map((q) => {
        if (q.type !== "mc" || !q.options) return q;
        const optSeed = seed + Array.from(q.id).reduce((a, c) => a + c.charCodeAt(0), 0);
        const indexed = q.options.map((o, i) => ({ o, i }));
        const shuffled = shuffleArray(indexed, optSeed);
        const newOptions = shuffled.map((x) => x.o);
        const newCorrect = shuffled.findIndex((x) => x.i === (q.correctAnswer ?? 0));
        return { ...q, options: newOptions, correctAnswer: newCorrect };
      });
    }
    return qs;
  }, [exam, user]);

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
    if (started && remaining === 0 && !submittedRef.current) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, started]);

  if (!exam) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Ujian tidak ditemukan.</p>
      <Button asChild className="mt-4" variant="outline"><Link href="/student/exams">Kembali</Link></Button>
    </div>
  );

  if (existing) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-muted-foreground">Kamu sudah mengerjakan ujian ini.</p>
      <Button asChild><Link href={`/student/exams/${exam.id}/result`}>Lihat hasil</Link></Button>
    </div>
  );

  if (!started) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student/exams"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
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
            <Stat label="Pilihan Ganda" value={exam.questions.filter((q) => q.type === "mc").length.toString()} />
            <Stat label="Benar/Salah" value={exam.questions.filter((q) => q.type === "tf").length.toString()} />
            <Stat label="Isian Singkat" value={exam.questions.filter((q) => q.type === "fill").length.toString()} />
            <Stat label="Essay" value={exam.questions.filter((q) => q.type === "essay").length.toString()} />
          </div>
          {exam.passingScore && (
            <div className="text-sm text-muted-foreground">KKM: <span className="font-semibold">{exam.passingScore}%</span></div>
          )}
          {(exam.shuffleQuestions || exam.shuffleOptions) && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
              🔀 {[exam.shuffleQuestions && "Urutan soal diacak", exam.shuffleOptions && "Pilihan jawaban diacak"].filter(Boolean).join(" · ")}
            </div>
          )}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Setelah memulai, timer akan berjalan. Ujian akan otomatis ter-submit jika waktu habis.
            </AlertDescription>
          </Alert>
          <Button size="lg" className="w-full" onClick={() => { setStartTime(Date.now()); setStarted(true); }} data-testid="button-start-exam">
            Mulai Ujian Sekarang
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const q = displayQuestions[currentIdx];
  const answer = answers[q.id];
  const answered = displayQuestions.filter((qq) => {
    const a = answers[qq.id];
    if (!a) return false;
    if (qq.type === "mc" || qq.type === "tf") return a.mcAnswer !== undefined;
    if (qq.type === "fill") return Boolean(a.fillAnswer?.trim());
    return Boolean(a.essayAnswer?.trim());
  }).length;

  function setMc(qid: string, val: number) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], questionId: qid, mcAnswer: val } }));
  }
  function setFill(qid: string, val: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], questionId: qid, fillAnswer: val } }));
  }
  function setEssay(qid: string, val: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], questionId: qid, essayAnswer: val } }));
  }

  function submit(auto: boolean) {
    if (submittedRef.current) return;
    submittedRef.current = true;

    let autoScore = 0;
    let max = 0;
    // Map display questions back to original questions for scoring
    const finalAnswers: ExamAnswer[] = exam!.questions.map((orig) => {
      // Find in displayQuestions (which may have shuffled options)
      const displayQ = displayQuestions.find((dq) => dq.id === orig.id);
      const a = answers[orig.id] ?? { questionId: orig.id };
      max += orig.points;

      if (orig.type === "mc") {
        // If options were shuffled, the correctAnswer in displayQ is already adjusted
        if (a.mcAnswer === displayQ?.correctAnswer) autoScore += orig.points;
      } else if (orig.type === "tf") {
        if (a.mcAnswer === orig.correctAnswer) autoScore += orig.points;
      } else if (orig.type === "fill") {
        const studentAns = (a.fillAnswer ?? "").trim().toLowerCase();
        const correct = (orig.fillAnswer ?? "").trim().toLowerCase();
        if (studentAns && correct && studentAns === correct) autoScore += orig.points;
      }
      return { ...a, questionId: orig.id };
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
    void mcApi.submitExam(sub).catch(() => {});
    setLocation(`/student/exams/${exam!.id}/result`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 -mx-4 md:mx-0 md:rounded-lg bg-background/95 backdrop-blur z-20 border-b md:border md:shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className={cn("h-4 w-4", remaining < 60000 && "text-destructive")} />
            <span className={cn("font-mono font-bold tabular-nums", remaining < 60000 && "text-destructive")} data-testid="text-timer">
              {formatDuration(remaining)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Dijawab: {answered} / {displayQuestions.length}</div>
          <Button size="sm" onClick={() => setConfirmOpen(true)} data-testid="button-submit-exam">
            <Send className="h-3 w-3 mr-1" />Submit
          </Button>
        </div>
        <Progress value={(answered / displayQuestions.length) * 100} className="h-1.5" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge>Soal {currentIdx + 1}</Badge>
              <Badge variant="outline">{QTYPE_LABELS[q.type] ?? q.type}</Badge>
              <Badge variant="secondary">{q.points} poin</Badge>
            </div>
          </div>
          <CardTitle className="text-base font-normal mt-3 leading-relaxed">{q.question}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Multiple Choice */}
          {q.type === "mc" && (
            <RadioGroup value={answer?.mcAnswer !== undefined ? String(answer.mcAnswer) : ""} onValueChange={(v) => setMc(q.id, parseInt(v))} className="space-y-2">
              {q.options!.map((opt, oi) => (
                <label key={oi} className={cn("flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent transition-colors", answer?.mcAnswer === oi && "border-primary bg-primary/5")} data-testid={`option-${currentIdx}-${oi}`}>
                  <RadioGroupItem value={String(oi)} id={`o-${q.id}-${oi}`} />
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                  <span className="flex-1 text-sm">{opt}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* True/False */}
          {q.type === "tf" && (
            <RadioGroup value={answer?.mcAnswer !== undefined ? String(answer.mcAnswer) : ""} onValueChange={(v) => setMc(q.id, parseInt(v))} className="flex gap-4">
              {[{ val: 0, label: "✅ Benar" }, { val: 1, label: "❌ Salah" }].map(({ val, label }) => (
                <label key={val} className={cn("flex items-center gap-3 border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors flex-1 justify-center", answer?.mcAnswer === val && "border-primary bg-primary/5")} data-testid={`tf-${val}`}>
                  <RadioGroupItem value={String(val)} id={`tf-${q.id}-${val}`} />
                  <span className="font-semibold text-sm">{label}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Fill in the blank */}
          {q.type === "fill" && (
            <div>
              <Input value={answer?.fillAnswer ?? ""} onChange={(e) => setFill(q.id, e.target.value)}
                placeholder="Tulis jawabanmu di sini..." className="text-sm" data-testid={`input-fill-${currentIdx}`} />
              <p className="text-xs text-muted-foreground mt-2">Jawaban tidak case-sensitive.</p>
            </div>
          )}

          {/* Essay */}
          {q.type === "essay" && (
            <Textarea rows={8} value={answer?.essayAnswer ?? ""} onChange={(e) => setEssay(q.id, e.target.value)}
              placeholder="Tulis jawabanmu di sini..." data-testid={`input-essay-${currentIdx}`} />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} data-testid="button-prev">
          <ArrowLeft className="h-4 w-4 mr-1" />Sebelumnya
        </Button>
        <div className="flex gap-1 max-w-[40%] overflow-x-auto">
          {displayQuestions.map((qq, i) => {
            const a = answers[qq.id];
            const isAnswered = qq.type === "mc" || qq.type === "tf" ? a?.mcAnswer !== undefined
              : qq.type === "fill" ? Boolean(a?.fillAnswer?.trim())
              : Boolean(a?.essayAnswer?.trim());
            return (
              <button key={qq.id} onClick={() => setCurrentIdx(i)}
                className={cn("h-8 w-8 rounded-md text-xs font-semibold flex items-center justify-center shrink-0",
                  i === currentIdx ? "bg-primary text-primary-foreground"
                  : isAnswered ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-muted")}
                data-testid={`nav-q-${i}`}>{i + 1}</button>
            );
          })}
        </div>
        <Button disabled={currentIdx === displayQuestions.length - 1} onClick={() => setCurrentIdx((i) => Math.min(displayQuestions.length - 1, i + 1))} data-testid="button-next">
          Berikutnya<ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit ujian?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kamu sudah menjawab {answered} dari {displayQuestions.length} soal. Setelah submit, jawaban tidak bisa diubah.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Lanjut mengerjakan</Button>
            <Button onClick={() => submit(false)} data-testid="button-confirm-submit">Ya, submit</Button>
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
