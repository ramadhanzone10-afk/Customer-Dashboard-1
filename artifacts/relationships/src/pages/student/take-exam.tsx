import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Clock, AlertTriangle, ArrowLeft, ArrowRight, Send, ShieldAlert, Lock,
  Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
  mc: "Pilihan Ganda", "mc-complex": "PG Kompleks", tf: "Benar/Salah", fill: "Isian Singkat", essay: "Essay",
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

// Render question text — supports plain text and HTML (rich text from teacher)
function QuestionText({ html }: { html: string }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (isHtml) {
    return (
      <div
        className="text-base leading-relaxed prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <p className="text-base leading-relaxed whitespace-pre-wrap">{html}</p>;
}

export default function StudentTakeExam() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const exam = exams.find((e) => e.id === id);
  const existing = submissions.find((s) => s.examId === id && s.userId === user!.id);

  const displayQuestions = useMemo(() => {
    if (!exam) return [];
    const seed = Array.from(`${user!.id}-${exam.id}`).reduce((a, c) => a + c.charCodeAt(0), 0);
    const qs = exam.shuffleQuestions ? shuffleArray([...exam.questions], seed) : [...exam.questions];
    if (exam.shuffleOptions) {
      return qs.map((q) => {
        if ((q.type !== "mc" && q.type !== "mc-complex") || !q.options) return q;
        const optSeed = seed + Array.from(q.id).reduce((a, c) => a + c.charCodeAt(0), 0);
        const indexed = q.options.map((o, i) => ({ o, i }));
        const shuffled = shuffleArray(indexed, optSeed);
        const newOptions = shuffled.map((x) => x.o);
        const newCorrect = shuffled.findIndex((x) => x.i === (q.correctAnswer ?? 0));
        const newCorrectMulti = (q.correctAnswers ?? []).map((ci) => shuffled.findIndex((x) => x.i === ci));
        return { ...q, options: newOptions, correctAnswer: newCorrect, correctAnswers: newCorrectMulti };
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

  // CBT lockdown state
  const [violations, setViolations] = useState(0);
  const [violationMsg, setViolationMsg] = useState("");
  const [showViolation, setShowViolation] = useState(false);
  const violationRef = useRef(0);
  const MAX_VIOLATIONS = 5;

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

  // ── CBT Lockdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started) return;

    function recordViolation(reason: string) {
      if (submittedRef.current) return;
      violationRef.current += 1;
      setViolations(violationRef.current);
      setViolationMsg(reason);
      setShowViolation(true);
      if (violationRef.current >= MAX_VIOLATIONS) {
        setTimeout(() => submit(true), 1500);
      }
    }

    // Block keyboard shortcuts that could open new tabs/windows
    function onKeyDown(e: KeyboardEvent) {
      const blocked = [
        e.ctrlKey && ["t", "n", "w", "r", "u", "j", "p"].includes(e.key.toLowerCase()),
        e.metaKey && ["t", "n", "w", "r"].includes(e.key.toLowerCase()),
        e.key === "F5",
        e.key === "F12",
        e.altKey && e.key === "F4",
        e.altKey && e.key === "Tab",
        e.key === "F11",
      ];
      if (blocked.some(Boolean)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    // Detect tab/window switch
    function onVisibilityChange() {
      if (document.hidden && !submittedRef.current) {
        recordViolation("Terdeteksi berpindah tab atau aplikasi lain!");
      }
    }

    // Detect window blur (clicking outside browser or alt-tab)
    function onWindowBlur() {
      if (!submittedRef.current) {
        recordViolation("Terdeteksi berpindah ke jendela lain!");
      }
    }

    // Detect fullscreen exit
    function onFullscreenChange() {
      if (!document.fullscreenElement && !submittedRef.current) {
        recordViolation("Kamu keluar dari mode fullscreen! Kembali ke layar penuh.");
        // Try to re-enter fullscreen
        setTimeout(() => {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }, 500);
      }
    }

    // Disable right click
    function onContextMenu(e: MouseEvent) { e.preventDefault(); }

    // Disable text selection copy via keyboard
    function onCopy(e: ClipboardEvent) { e.preventDefault(); }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      // Exit fullscreen when done
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!exam) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Ujian tidak ditemukan.</p>
      <Button asChild className="mt-4" variant="outline"><Link href="/student/exams">Kembali</Link></Button>
    </div>
  );

  // Check if exam is available yet
  const now = Date.now();
  if (exam.startDateTime && exam.startDateTime > now) {
    const opensAt = new Date(exam.startDateTime).toLocaleString("id-ID");
    return (
      <div className="max-w-2xl mx-auto text-center py-12 space-y-4">
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mx-auto">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold">Ujian Belum Dibuka</h2>
        <p className="text-muted-foreground">Ujian ini akan dibuka pada <strong>{opensAt}</strong></p>
        <Button asChild variant="outline"><Link href="/student/exams"><ArrowLeft className="h-4 w-4 mr-2" />Kembali</Link></Button>
      </div>
    );
  }

  if (existing) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-muted-foreground">Kamu sudah mengerjakan ujian ini.</p>
      <Button asChild><Link href={`/student/exams/${exam.id}/result`}>Lihat hasil</Link></Button>
    </div>
  );

  // ── Exam Intro Screen ──────────────────────────────────────────────────────
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
            {exam.questions.filter((q) => q.type === "mc").length > 0 && <Stat label="Pilihan Ganda" value={exam.questions.filter((q) => q.type === "mc").length.toString()} />}
            {exam.questions.filter((q) => q.type === "mc-complex").length > 0 && <Stat label="PG Kompleks" value={exam.questions.filter((q) => q.type === "mc-complex").length.toString()} />}
            {exam.questions.filter((q) => q.type === "tf").length > 0 && <Stat label="Benar/Salah" value={exam.questions.filter((q) => q.type === "tf").length.toString()} />}
            {exam.questions.filter((q) => q.type === "fill").length > 0 && <Stat label="Isian Singkat" value={exam.questions.filter((q) => q.type === "fill").length.toString()} />}
            {exam.questions.filter((q) => q.type === "essay").length > 0 && <Stat label="Essay" value={exam.questions.filter((q) => q.type === "essay").length.toString()} />}
          </div>
          {exam.passingScore && (
            <div className="text-sm text-muted-foreground">KKM: <span className="font-semibold">{exam.passingScore}%</span></div>
          )}

          {/* CBT warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
              <Lock className="h-4 w-4" />
              Mode CBT (Computer Based Test)
            </div>
            <ul className="text-xs text-amber-700/80 dark:text-amber-400/80 space-y-1 list-disc pl-4">
              <li>Ujian akan berjalan dalam mode <strong>layar penuh</strong></li>
              <li>Dilarang berpindah tab, jendela, atau aplikasi lain</li>
              <li>Dilarang membuka aplikasi lain saat ujian berlangsung</li>
              <li>Setiap pelanggaran akan tercatat — {MAX_VIOLATIONS} pelanggaran = otomatis submit</li>
              <li>Timer berjalan terus hingga waktu habis</li>
            </ul>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Setelah memulai, timer berjalan. Ujian otomatis ter-submit jika waktu habis atau terlalu banyak pelanggaran.
            </AlertDescription>
          </Alert>

          <Button
            size="lg"
            className="w-full"
            data-testid="button-start-exam"
            onClick={() => {
              // Request fullscreen as part of user gesture
              document.documentElement.requestFullscreen?.().catch(() => {});
              setStartTime(Date.now());
              setStarted(true);
            }}
          >
            <Lock className="h-4 w-4 mr-2" />
            Mulai Ujian (Mode CBT)
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // ── Exam In Progress ────────────────────────────────────────────────────────
  const q = displayQuestions[currentIdx];
  const answer = answers[q.id];
  const answered = displayQuestions.filter((qq) => {
    const a = answers[qq.id];
    if (!a) return false;
    if (qq.type === "mc" || qq.type === "tf") return a.mcAnswer !== undefined;
    if (qq.type === "mc-complex") return (a.complexAnswers?.length ?? 0) > 0;
    if (qq.type === "fill") return Boolean(a.fillAnswer?.trim());
    return Boolean(a.essayAnswer?.trim());
  }).length;

  function setMc(qid: string, val: number) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], questionId: qid, mcAnswer: val } }));
  }
  function setComplex(qid: string, oi: number, checked: boolean) {
    setAnswers((a) => {
      const prev = a[qid]?.complexAnswers ?? [];
      const next = checked ? [...prev, oi] : prev.filter((x) => x !== oi);
      return { ...a, [qid]: { ...a[qid], questionId: qid, complexAnswers: next } };
    });
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
    const finalAnswers: ExamAnswer[] = exam!.questions.map((orig) => {
      const displayQ = displayQuestions.find((dq) => dq.id === orig.id);
      const a = answers[orig.id] ?? { questionId: orig.id };
      max += orig.points;

      if (orig.type === "mc") {
        if (a.mcAnswer === displayQ?.correctAnswer) autoScore += orig.points;
      } else if (orig.type === "mc-complex") {
        // Full credit only if all correct answers selected and no wrong ones
        const selected = new Set(a.complexAnswers ?? []);
        const correct = new Set(displayQ?.correctAnswers ?? []);
        const isMatch = selected.size === correct.size && [...selected].every((x) => correct.has(x));
        if (isMatch) autoScore += orig.points;
      } else if (orig.type === "tf") {
        if (a.mcAnswer === orig.correctAnswer) autoScore += orig.points;
      } else if (orig.type === "fill") {
        const sa = (a.fillAnswer ?? "").trim().toLowerCase();
        const ca = (orig.fillAnswer ?? "").trim().toLowerCase();
        if (sa && ca && sa === ca) autoScore += orig.points;
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
      cbtViolations: violationRef.current,
    };
    const all = read("examSubmissions", []);
    write("examSubmissions", [...all, sub]);
    void mcApi.submitExam(sub).catch(() => {});

    // Exit fullscreen
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setLocation(`/student/exams/${exam!.id}/result`);
  }

  const violationPct = (violations / MAX_VIOLATIONS) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* CBT Status Banner */}
      <div className={cn(
        "rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium",
        violations === 0 ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
          : violations < 3 ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400"
          : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400"
      )}>
        {violations === 0 ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
        <span>Mode CBT Aktif</span>
        {violations > 0 && (
          <span className="ml-auto font-semibold">Pelanggaran: {violations}/{MAX_VIOLATIONS}</span>
        )}
        {violations === 0 && <span className="ml-auto text-muted-foreground">Jangan berpindah tab atau aplikasi</span>}
      </div>

      {/* Timer & Progress */}
      <div className="sticky top-0 -mx-4 md:mx-0 md:rounded-lg bg-background/95 backdrop-blur z-20 border-b md:border md:shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className={cn("h-4 w-4", remaining < 60000 && "text-destructive")} />
            <span className={cn("font-mono font-bold tabular-nums", remaining < 60000 && "text-destructive")} data-testid="text-timer">
              {formatDuration(remaining)}
            </span>
            {violations > 0 && (
              <Badge variant={violations >= 3 ? "destructive" : "secondary"} className="text-xs">
                ⚠ {violations}/{MAX_VIOLATIONS}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Dijawab: {answered}/{displayQuestions.length}</div>
          <Button size="sm" onClick={() => setConfirmOpen(true)} data-testid="button-submit-exam">
            <Send className="h-3 w-3 mr-1" />Submit
          </Button>
        </div>
        <Progress value={(answered / displayQuestions.length) * 100} className="h-1.5" />
      </div>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>Soal {currentIdx + 1}</Badge>
            <Badge variant="outline">{QTYPE_LABELS[q.type] ?? q.type}</Badge>
            <Badge variant="secondary">{q.points} poin</Badge>
            {q.type === "mc-complex" && (
              <Badge variant="outline" className="text-xs">Pilih semua jawaban yang benar</Badge>
            )}
          </div>
          <div className="mt-3">
            <QuestionText html={q.question} />
          </div>
          {/* Question image */}
          {q.imageDataUrl && (
            <div className="mt-3">
              <img src={q.imageDataUrl} alt="soal" className="max-h-64 rounded-lg border object-contain" />
            </div>
          )}
          {/* Question PDF */}
          {q.pdfDataUrl && q.pdfFileName && (
            <div className="mt-2">
              <a href={q.pdfDataUrl} download={q.pdfFileName} className="inline-flex items-center gap-1 text-xs text-primary underline">
                📄 {q.pdfFileName}
              </a>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Multiple Choice */}
          {q.type === "mc" && (
            <RadioGroup
              value={answer?.mcAnswer !== undefined ? String(answer.mcAnswer) : ""}
              onValueChange={(v) => setMc(q.id, parseInt(v))}
              className="space-y-2"
            >
              {q.options!.map((opt, oi) => (
                <label
                  key={oi}
                  className={cn(
                    "flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent transition-colors",
                    answer?.mcAnswer === oi && "border-primary bg-primary/5",
                  )}
                  data-testid={`option-${currentIdx}-${oi}`}
                >
                  <RadioGroupItem value={String(oi)} id={`o-${q.id}-${oi}`} className="mt-0.5 shrink-0" />
                  <span className="font-semibold mr-1 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                  <div className="flex-1 text-sm">
                    <QuestionText html={opt} />
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Complex Multiple Choice */}
          {q.type === "mc-complex" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Pilih <strong>semua</strong> jawaban yang benar:</p>
              {q.options!.map((opt, oi) => {
                const isSelected = (answer?.complexAnswers ?? []).includes(oi);
                return (
                  <label
                    key={oi}
                    className={cn(
                      "flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent transition-colors",
                      isSelected && "border-primary bg-primary/5",
                    )}
                    data-testid={`complex-option-${currentIdx}-${oi}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(c) => setComplex(q.id, oi, !!c)}
                      className="mt-0.5 shrink-0"
                    />
                    <span className="font-semibold mr-1 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                    <div className="flex-1 text-sm">
                      <QuestionText html={opt} />
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* True / False */}
          {q.type === "tf" && (
            <RadioGroup
              value={answer?.mcAnswer !== undefined ? String(answer.mcAnswer) : ""}
              onValueChange={(v) => setMc(q.id, parseInt(v))}
              className="flex gap-4"
            >
              {[{ val: 0, label: "✅ Benar" }, { val: 1, label: "❌ Salah" }].map(({ val, label }) => (
                <label
                  key={val}
                  className={cn(
                    "flex items-center gap-3 border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors flex-1 justify-center",
                    answer?.mcAnswer === val && "border-primary bg-primary/5",
                  )}
                  data-testid={`tf-${val}`}
                >
                  <RadioGroupItem value={String(val)} id={`tf-${q.id}-${val}`} />
                  <span className="font-semibold text-sm">{label}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Fill in the blank */}
          {q.type === "fill" && (
            <div>
              <Input
                value={answer?.fillAnswer ?? ""}
                onChange={(e) => setFill(q.id, e.target.value)}
                placeholder="Tulis jawabanmu di sini..."
                className="text-sm"
                data-testid={`input-fill-${currentIdx}`}
              />
              <p className="text-xs text-muted-foreground mt-2">Jawaban tidak case-sensitive.</p>
            </div>
          )}

          {/* Essay */}
          {q.type === "essay" && (
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

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          data-testid="button-prev"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />Sebelumnya
        </Button>
        <div className="flex gap-1 max-w-[40%] overflow-x-auto">
          {displayQuestions.map((qq, i) => {
            const a = answers[qq.id];
            const isAnswered =
              qq.type === "mc" || qq.type === "tf" ? a?.mcAnswer !== undefined
              : qq.type === "mc-complex" ? (a?.complexAnswers?.length ?? 0) > 0
              : qq.type === "fill" ? Boolean(a?.fillAnswer?.trim())
              : Boolean(a?.essayAnswer?.trim());
            return (
              <button
                key={qq.id}
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "h-8 w-8 rounded-md text-xs font-semibold flex items-center justify-center shrink-0",
                  i === currentIdx ? "bg-primary text-primary-foreground"
                  : isAnswered ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-muted",
                )}
                data-testid={`nav-q-${i}`}
              >{i + 1}</button>
            );
          })}
        </div>
        <Button
          disabled={currentIdx === displayQuestions.length - 1}
          onClick={() => setCurrentIdx((i) => Math.min(displayQuestions.length - 1, i + 1))}
          data-testid="button-next"
        >
          Berikutnya<ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Submit Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit ujian?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kamu sudah menjawab {answered} dari {displayQuestions.length} soal. Setelah submit, jawaban tidak bisa diubah.
          </p>
          {violations > 0 && (
            <p className="text-xs text-amber-600">Catatan: {violations} pelanggaran CBT tercatat.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Lanjut mengerjakan</Button>
            <Button onClick={() => submit(false)} data-testid="button-confirm-submit">Ya, submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Violation Warning Dialog */}
      <Dialog open={showViolation} onOpenChange={setShowViolation}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Pelanggaran CBT Terdeteksi!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{violationMsg}</p>
            <div className="bg-destructive/10 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold">Pelanggaran: {violations}/{MAX_VIOLATIONS}</span>
                {violations >= MAX_VIOLATIONS && (
                  <Badge variant="destructive">Auto Submit!</Badge>
                )}
              </div>
              <Progress value={violationPct} className="h-2 [&>div]:bg-destructive" />
            </div>
            {violations < MAX_VIOLATIONS ? (
              <p className="text-sm text-muted-foreground">
                ⚠️ Tetap di halaman ujian ini. {MAX_VIOLATIONS - violations} pelanggaran lagi = ujian otomatis dikumpulkan.
              </p>
            ) : (
              <p className="text-sm text-destructive font-semibold">
                Batas pelanggaran tercapai. Ujian sedang dikumpulkan otomatis...
              </p>
            )}
          </div>
          {violations < MAX_VIOLATIONS && (
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowViolation(false);
                // Re-request fullscreen
                document.documentElement.requestFullscreen?.().catch(() => {});
              }}>
                Lanjutkan Ujian
              </Button>
            </DialogFooter>
          )}
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
