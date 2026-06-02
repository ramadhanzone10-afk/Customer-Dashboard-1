import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Plus, Clock, Users as UsersIcon, ClipboardList, Trash2, BarChart3, X,
  Shuffle, CheckSquare, AlignLeft, ToggleLeft, Pencil, Send, CalendarCheck,
  BookOpen, FileText, Image as ImageIcon, Bold, Italic, Underline, List,
  ListOrdered, RemoveFormatting, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, Question, User, AppNotification, ExamSubmission, Material } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";
import { ScheduleDialog } from "./materials";

// ── Rich Text Editor ──────────────────────────────────────────────────────────
function RichTextEditor({ value, onChange, placeholder, minRows = 3 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const skipSync = useRef(false);

  useEffect(() => {
    if (ref.current && !skipSync.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    skipSync.current = false;
  }, [value]);

  function exec(cmd: string, val?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
    if (ref.current) { skipSync.current = true; onChange(ref.current.innerHTML); }
  }

  const btnCls = "h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground";

  return (
    <div className="border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/40 flex-wrap">
        <button type="button" title="Bold" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" title="Italic" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" title="Underline" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}><Underline className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" title="Bullet List" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}><List className="h-3.5 w-3.5" /></button>
        <button type="button" title="Numbered List" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" title="Hapus Format" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}><RemoveFormatting className="h-3.5 w-3.5" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => { if (ref.current) { skipSync.current = true; onChange(ref.current.innerHTML); } }}
        className="px-3 py-2 text-sm focus:outline-none [&[contenteditable]:empty]:before:content-[attr(data-placeholder)] [&[contenteditable]:empty]:before:text-muted-foreground"
        style={{ minHeight: `${minRows * 1.75}rem` }}
      />
    </div>
  );
}

const QTYPE_LABELS: Record<string, string> = {
  mc: "Pilihan Ganda", "mc-complex": "PG Kompleks", tf: "Benar/Salah", fill: "Isian Singkat", essay: "Essay",
};
const QTYPE_ICONS: Record<string, React.ReactNode> = {
  mc: <CheckSquare className="h-3.5 w-3.5" />,
  "mc-complex": <CheckSquare className="h-3.5 w-3.5" />,
  tf: <ToggleLeft className="h-3.5 w-3.5" />,
  fill: <AlignLeft className="h-3.5 w-3.5" />,
  essay: <AlignLeft className="h-3.5 w-3.5" />,
};

function toDatetimeLocal(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(s: string): number {
  return new Date(s).getTime();
}
function defaultDeadline(days = 7) {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 0, 0); return toDatetimeLocal(d.getTime());
}

// ── Exam Dialog ───────────────────────────────────────────────────────────────
function ExamDialog({
  open, onOpenChange, teacherId, students: _students, initialType, editing, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teacherId: string;
  students: User[];
  initialType: "exam" | "tugas";
  editing: Exam | null;
  onCreated?: (e: Exam) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [startDT, setStartDT] = useState("");
  const [shuffleQ, setShuffleQ] = useState(false);
  const [shuffleO, setShuffleO] = useState(false);
  const [passingScore, setPassingScore] = useState("70");
  const [questions, setQuestions] = useState<Question[]>([
    { id: uid("q_"), type: "mc", question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 },
  ]);

  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDescription(editing?.description ?? "");
      setDuration(String(editing?.durationMinutes ?? 60));
      setDeadline(editing ? toDatetimeLocal(editing.deadline) : defaultDeadline());
      setStartDT(editing?.startDateTime ? toDatetimeLocal(editing.startDateTime) : "");
      setShuffleQ(editing?.shuffleQuestions ?? false);
      setShuffleO(editing?.shuffleOptions ?? false);
      setPassingScore(String(editing?.passingScore ?? 70));
      setQuestions(editing?.questions?.length ? editing.questions : [
        { id: uid("q_"), type: "mc", question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function addQuestion(type: Question["type"]) {
    const q: Question = { id: uid("q_"), type, question: "", points: 10 };
    if (type === "mc" || type === "mc-complex") { q.options = ["", "", "", ""]; q.correctAnswer = 0; if (type === "mc-complex") q.correctAnswers = []; }
    if (type === "tf") q.correctAnswer = 0;
    if (type === "fill") q.fillAnswer = "";
    setQuestions((prev) => [...prev, q]);
  }
  function updateQ(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => q.id === id ? { ...q, ...patch } : q));
  }
  function removeQ(id: string) { setQuestions((qs) => qs.filter((q) => q.id !== id)); }
  function moveQ(idx: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const a = [...qs]; const t = idx + dir;
      if (t < 0 || t >= a.length) return qs;
      [a[idx], a[t]] = [a[t], a[idx]]; return a;
    });
  }
  function onQImage(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => updateQ(id, { imageDataUrl: r.result as string }); r.readAsDataURL(f);
  }
  function onQPdf(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => updateQ(id, { pdfDataUrl: r.result as string, pdfFileName: f.name }); r.readAsDataURL(f);
  }

  function save() {
    if (!title.trim()) return alert("Judul wajib diisi.");
    if (!questions.length) return alert("Minimal 1 soal.");
    for (const q of questions) {
      if (!q.question.trim() && !q.question.replace(/<[^>]+>/g, "").trim()) return alert("Semua soal wajib diisi.");
      if ((q.type === "mc" || q.type === "mc-complex") && q.options?.some((o) => !o.trim())) return alert("Semua pilihan jawaban wajib diisi.");
      if (q.type === "fill" && !q.fillAnswer?.trim()) return alert("Jawaban isian singkat wajib diisi.");
    }
    const exam: Exam = {
      id: editing?.id ?? uid("e_"),
      title: title.trim(), description: description.trim(),
      questions,
      durationMinutes: parseInt(duration) || 60,
      deadline: fromDatetimeLocal(deadline),
      startDateTime: startDT ? fromDatetimeLocal(startDT) : undefined,
      assignedTo: editing?.assignedTo ?? [],
      status: editing?.status ?? "draft",
      createdBy: editing?.createdBy ?? teacherId,
      createdAt: editing?.createdAt ?? Date.now(),
      type: initialType,
      shuffleQuestions: shuffleQ,
      shuffleOptions: shuffleO,
      passingScore: parseInt(passingScore) || 70,
    };
    const all = read("exams", []);
    if (editing) {
      write("exams", all.map((e) => e.id === exam.id ? exam : e));
      void mcApi.updateExam(exam.id, exam).catch(() => {});
    } else {
      write("exams", [...all, exam]);
      void mcApi.createExam(exam).catch(() => {});
      onCreated?.(exam);
    }
    onOpenChange(false);
  }

  const typeLabel = initialType === "tugas" ? "Tugas" : "Ujian";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${typeLabel}` : `Buat ${typeLabel} Baru`}</DialogTitle>
          {!editing && <p className="text-sm text-muted-foreground">Buat soal dahulu, lalu jadwalkan ke siswa setelah disimpan.</p>}
        </DialogHeader>
        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Judul <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-exam-title" />
            </div>
            <div className="md:col-span-2">
              <Label>Deskripsi</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Durasi per sesi (menit)</Label>
              <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="input-exam-duration" />
            </div>
            <div>
              <Label>KKM / Nilai Lulus (%)</Label>
              <Input type="number" min="0" max="100" value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
            </div>
            <div>
              <Label>Mulai bisa dikerjakan (opsional)</Label>
              <Input type="datetime-local" value={startDT} onChange={(e) => setStartDT(e.target.value)} />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-exam-deadline" />
            </div>
          </div>

          {/* Shuffle */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <Label className="text-sm font-semibold flex items-center gap-1.5"><Shuffle className="h-4 w-4" />Pengacakan</Label>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-medium">Acak urutan soal</div></div>
              <Switch checked={shuffleQ} onCheckedChange={setShuffleQ} />
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-medium">Acak pilihan jawaban</div></div>
              <Switch checked={shuffleO} onCheckedChange={setShuffleO} />
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <Label className="text-base font-semibold">Soal ({questions.length})</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["mc", "mc-complex", "tf", "fill", "essay"] as const).map((t) => (
                  <Button key={t} size="sm" variant="outline" onClick={() => addQuestion(t)} data-testid={`button-add-${t}`}>
                    {QTYPE_ICONS[t]}
                    <span className="ml-1 text-xs">+ {QTYPE_LABELS[t]}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-3">
                    {/* Question header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge>{idx + 1}</Badge>
                        <Badge variant="outline" className="gap-1">{QTYPE_ICONS[q.type]}{QTYPE_LABELS[q.type]}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQ(idx, -1)} disabled={idx === 0}>↑</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQ(idx, 1)} disabled={idx === questions.length - 1}>↓</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeQ(q.id)} data-testid={`button-remove-q-${idx}`}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {/* Question text - rich text */}
                    <div>
                      <Label className="text-xs mb-1 block">Pertanyaan</Label>
                      <RichTextEditor
                        value={q.question}
                        onChange={(v) => updateQ(q.id, { question: v })}
                        placeholder="Tulis pertanyaan di sini..."
                        minRows={2}
                      />
                    </div>

                    {/* Image for question */}
                    <div className="flex flex-wrap gap-2">
                      <div>
                        <label className="cursor-pointer inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-accent transition-colors">
                          <ImageIcon className="h-3 w-3" />Upload Gambar
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => onQImage(q.id, e)} />
                        </label>
                      </div>
                      <div>
                        <label className="cursor-pointer inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-accent transition-colors">
                          <FileText className="h-3 w-3" />Lampiran PDF
                          <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => onQPdf(q.id, e)} />
                        </label>
                      </div>
                    </div>
                    {q.imageDataUrl && (
                      <div className="relative inline-block">
                        <img src={q.imageDataUrl} alt="soal" className="max-h-40 rounded border" />
                        <button onClick={() => updateQ(q.id, { imageDataUrl: undefined })} className="absolute top-1 right-1 bg-destructive text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">×</button>
                      </div>
                    )}
                    {q.pdfFileName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />{q.pdfFileName}
                        <button onClick={() => updateQ(q.id, { pdfDataUrl: undefined, pdfFileName: undefined })} className="ml-1 text-destructive underline">hapus</button>
                      </div>
                    )}

                    {/* Multiple Choice */}
                    {q.type === "mc" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Pilihan (radio = jawaban benar)</Label>
                        <RadioGroup value={String(q.correctAnswer ?? 0)} onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })}>
                          {q.options!.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <RadioGroupItem value={String(oi)} id={`${q.id}-${oi}`} />
                              <RichTextEditor
                                value={opt}
                                onChange={(v) => { const opts = [...q.options!]; opts[oi] = v; updateQ(q.id, { options: opts }); }}
                                placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`}
                                minRows={1}
                              />
                            </div>
                          ))}
                        </RadioGroup>
                        <Button type="button" size="sm" variant="ghost" onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ""] })}>+ Tambah Pilihan</Button>
                      </div>
                    )}

                    {/* Complex Multiple Choice */}
                    {q.type === "mc-complex" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Pilihan (centang semua yang benar)</Label>
                        <div className="space-y-2">
                          {q.options!.map((opt, oi) => {
                            const isCorrect = (q.correctAnswers ?? []).includes(oi);
                            return (
                              <div key={oi} className="flex items-center gap-2">
                                <Checkbox
                                  checked={isCorrect}
                                  onCheckedChange={(c) => {
                                    const prev = q.correctAnswers ?? [];
                                    const next = c ? [...prev, oi] : prev.filter((x) => x !== oi);
                                    updateQ(q.id, { correctAnswers: next });
                                  }}
                                />
                                <RichTextEditor
                                  value={opt}
                                  onChange={(v) => { const opts = [...q.options!]; opts[oi] = v; updateQ(q.id, { options: opts }); }}
                                  placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`}
                                  minRows={1}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ""] })}>+ Tambah Pilihan</Button>
                      </div>
                    )}

                    {/* True / False */}
                    {q.type === "tf" && (
                      <div>
                        <Label className="text-xs mb-2 block">Jawaban benar</Label>
                        <RadioGroup value={String(q.correctAnswer ?? 0)} onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })} className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="0" id={`tf-b-${q.id}`} />
                            <label htmlFor={`tf-b-${q.id}`} className="text-sm font-medium cursor-pointer">✅ Benar</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="1" id={`tf-s-${q.id}`} />
                            <label htmlFor={`tf-s-${q.id}`} className="text-sm font-medium cursor-pointer">❌ Salah</label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {/* Fill in blank */}
                    {q.type === "fill" && (
                      <div>
                        <Label className="text-xs">Kunci jawaban</Label>
                        <Input value={q.fillAnswer ?? ""} onChange={(e) => updateQ(q.id, { fillAnswer: e.target.value })} placeholder="Jawaban (tidak case-sensitive)..." className="mt-1" />
                      </div>
                    )}

                    {/* Points */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Nilai:</Label>
                      <Select value={String(q.points)} onValueChange={(v) => updateQ(q.id, { points: parseInt(v) })}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} poin</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} data-testid="button-save-exam">{editing ? "Simpan Perubahan" : "Simpan Draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Tugas Page ───────────────────────────────────────────────────────────
export default function TeacherTugas() {
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const materials = useStore<Material[]>("materials", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const users = useStore<User[]>("users", []);

  const myStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.teacherId === user?.id && u.status === "active"),
    [users, user],
  );
  const myExams = useMemo(() => exams.filter((e) => e.createdBy === user?.id), [exams, user]);
  const ujianList = useMemo(() => myExams.filter((e) => (e.type ?? "exam") === "exam"), [myExams]);
  const tugasList = useMemo(() => myExams.filter((e) => e.type === "tugas"), [myExams]);

  const scheduledMaterials = useMemo(
    () => materials.filter((m) => m.createdBy === user?.id && m.assignedTo.length > 0),
    [materials, user],
  );

  const [open, setOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [newType, setNewType] = useState<"exam" | "tugas">("exam");
  const [scheduleTarget, setScheduleTarget] = useState<Exam | null>(null);
  const [schedMatTarget, setSchedMatTarget] = useState<Material | null>(null);

  function openCreate(type: "exam" | "tugas") { setEditingExam(null); setNewType(type); setOpen(true); }
  function openEdit(e: Exam) { setEditingExam(e); setNewType(e.type ?? "exam"); setOpen(true); }

  function deleteExam(id: string) {
    if (!confirm("Hapus ujian ini?")) return;
    write("exams", exams.filter((e) => e.id !== id));
    write("examSubmissions", submissions.filter((s) => s.examId !== id));
    void mcApi.deleteExam(id).catch(() => {});
  }

  function onExamScheduled(examId: string, studentIds: string[]) {
    const all = read("exams", []);
    const target = all.find((e) => e.id === examId);
    if (!target) return;
    const prevIds = target.assignedTo ?? [];
    const newlyAdded = studentIds.filter((id) => !prevIds.includes(id));
    const updated: Exam = { ...target, assignedTo: studentIds, status: "published" };
    write("exams", all.map((e) => e.id === examId ? updated : e));
    const typeLabel = target.type === "tugas" ? "Tugas" : "Ujian";
    if (newlyAdded.length) {
      const notifs = read("notifications", []);
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({
        id: uid("n_"), userId: sid, type: "new_exam",
        title: `${typeLabel} baru tersedia`, message: `"${target.title}" dijadwalkan untuk Anda.`,
        link: "/student/exams", createdAt: Date.now(), read: false,
      }));
      write("notifications", [...notifs, ...newNotifs]);
      void mcApi.updateExam(examId, { ...updated, notifications: newNotifs } as Exam & { notifications?: AppNotification[] }).catch(() => {});
    } else {
      void mcApi.updateExam(examId, updated).catch(() => {});
    }
    setScheduleTarget(null);
  }

  function onMatScheduled(matId: string, studentIds: string[]) {
    const all = read("materials", []);
    const target = all.find((m) => m.id === matId);
    if (!target) return;
    const prevIds = target.assignedTo ?? [];
    const newlyAdded = studentIds.filter((id) => !prevIds.includes(id));
    const updated: Material = { ...target, assignedTo: studentIds, status: "published" };
    write("materials", all.map((m) => m.id === matId ? updated : m));
    if (newlyAdded.length) {
      const notifs = read("notifications", []);
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({
        id: uid("n_"), userId: sid, type: "new_material",
        title: "Materi baru", message: `"${target.title}" dijadwalkan untuk Anda.`,
        link: "/student/materials", createdAt: Date.now(), read: false,
      }));
      write("notifications", [...notifs, ...newNotifs]);
      void mcApi.updateMaterial(matId, { ...updated, notifications: newNotifs } as Material & { notifications?: AppNotification[] }).catch(() => {});
    } else {
      void mcApi.updateMaterial(matId, updated).catch(() => {});
    }
    setSchedMatTarget(null);
  }

  const isDraft = (e: Exam) => !e.assignedTo?.length || e.status === "draft";

  // Group students by class for display
  const classOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of myStudents) if (s.kelas) m.set(s.id, s.kelas);
    return m;
  }, [myStudents]);

  function classesFor(ids: string[]) {
    const klasses = new Set(ids.map((id) => classOf.get(id)).filter(Boolean) as string[]);
    return klasses.size ? [...klasses].join(", ") : `${ids.length} siswa`;
  }

  function ExamCard({ e }: { e: Exam }) {
    const subs = submissions.filter((s) => s.examId === e.id);
    const needsGrading = subs.filter((s) => !s.fullyGraded).length;
    const isExpired = e.deadline < Date.now();
    const draft = isDraft(e);
    const now = Date.now();
    const notStarted = e.startDateTime && e.startDateTime > now;

    return (
      <Card className={draft ? "border-dashed" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{e.title}</CardTitle>
            {draft ? (
              <Badge variant="secondary" className="shrink-0">Draft</Badge>
            ) : notStarted ? (
              <Badge variant="outline" className="shrink-0 text-xs">Terjadwal</Badge>
            ) : (
              <Badge variant={isExpired ? "secondary" : "default"} className={!isExpired ? "bg-green-600 shrink-0" : "shrink-0"}>
                {isExpired ? "Berakhir" : "Aktif"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><ClipboardList className="h-3 w-3" />{e.questions.length} soal</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{e.durationMinutes} mnt</Badge>
            {!draft && <Badge variant="outline" className="gap-1"><UsersIcon className="h-3 w-3" />{subs.length}/{e.assignedTo.length}</Badge>}
            {e.shuffleQuestions && <Badge variant="outline" className="gap-1"><Shuffle className="h-3 w-3" />Acak</Badge>}
            {needsGrading > 0 && <Badge variant="destructive">{needsGrading} koreksi</Badge>}
          </div>
          {e.startDateTime && (
            <div className="text-xs text-muted-foreground">Mulai: {formatDate(e.startDateTime)}</div>
          )}
          <div className="text-xs text-muted-foreground">Deadline: {formatDate(e.deadline)}</div>
          <div className="flex flex-wrap gap-2 pt-1">
            {draft ? (
              <Button size="sm" onClick={() => setScheduleTarget(e)} className="gap-1" data-testid={`button-schedule-exam-${e.id}`}>
                <Send className="h-3.5 w-3.5" />Jadwalkan
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/exams/${e.id}/results`}><BarChart3 className="h-3 w-3 mr-1" />Hasil</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setScheduleTarget(e)} className="gap-1">
                  <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => openEdit(e)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
            <Button variant="outline" size="sm" onClick={() => deleteExam(e.id)}><Trash2 className="h-3 w-3 mr-1 text-destructive" />Hapus</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="tugas-ujian">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <TabsList>
            <TabsTrigger value="tugas-ujian" className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />Tugas Ujian ({myExams.length})
            </TabsTrigger>
            <TabsTrigger value="tugas-materi" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />Tugas Materi ({scheduledMaterials.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button onClick={() => openCreate("exam")} size="sm" data-testid="button-new-exam">
              <Plus className="h-4 w-4 mr-1" />Ujian Baru
            </Button>
            <Button onClick={() => openCreate("tugas")} size="sm" variant="outline" data-testid="button-new-tugas">
              <Plus className="h-4 w-4 mr-1" />Tugas Baru
            </Button>
          </div>
        </div>

        {/* Tugas Ujian Tab */}
        <TabsContent value="tugas-ujian" className="space-y-4">
          <Tabs defaultValue="ujian">
            <TabsList className="mb-4">
              <TabsTrigger value="ujian">Ujian ({ujianList.length})</TabsTrigger>
              <TabsTrigger value="tugas">Tugas ({tugasList.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="ujian">
              {ujianList.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ClipboardList className="h-6 w-6" /></EmptyMedia>
                    <EmptyTitle>Belum ada ujian</EmptyTitle>
                    <EmptyDescription>Buat soal ujian, lalu jadwalkan ke siswa.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent><Button onClick={() => openCreate("exam")}><Plus className="h-4 w-4 mr-2" />Buat Ujian</Button></EmptyContent>
                </Empty>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {ujianList.map((e) => <ExamCard key={e.id} e={e} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="tugas">
              {tugasList.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ClipboardList className="h-6 w-6" /></EmptyMedia>
                    <EmptyTitle>Belum ada tugas</EmptyTitle>
                    <EmptyDescription>Buat tugas soal, lalu jadwalkan ke siswa.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent><Button onClick={() => openCreate("tugas")} variant="outline"><Plus className="h-4 w-4 mr-2" />Buat Tugas</Button></EmptyContent>
                </Empty>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {tugasList.map((e) => <ExamCard key={e.id} e={e} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tugas Materi Tab */}
        <TabsContent value="tugas-materi">
          {scheduledMaterials.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen className="h-6 w-6" /></EmptyMedia>
                <EmptyTitle>Belum ada tugas materi aktif</EmptyTitle>
                <EmptyDescription>Jadwalkan materi dari menu "Materi &amp; Soal" untuk menampilkannya di sini.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Materi dan soal yang sudah dijadwalkan ke siswa.</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledMaterials.map((m) => (
                  <Card key={m.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-start justify-between gap-2">
                        <span className="line-clamp-2">{m.title}</span>
                        <Badge variant="default" className="shrink-0 text-xs bg-green-600">Aktif</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {m.subject && <Badge variant="outline" className="text-xs">{m.subject}{m.bab ? ` – ${m.bab}` : ""}</Badge>}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <UsersIcon className="h-3 w-3" />
                        {classesFor(m.assignedTo)} ({m.assignedTo.length} siswa)
                      </div>
                      {m.timerMinutes && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{m.timerMinutes} menit
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => setSchedMatTarget(m)}>
                          <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Exam create/edit dialog */}
      <ExamDialog
        open={open}
        onOpenChange={setOpen}
        teacherId={user!.id}
        students={myStudents}
        initialType={newType}
        editing={editingExam}
        onCreated={(e) => setScheduleTarget(e)}
      />

      {/* Exam schedule dialog */}
      {scheduleTarget && (
        <ScheduleDialog
          open={!!scheduleTarget}
          onOpenChange={(o) => { if (!o) setScheduleTarget(null); }}
          itemTitle={scheduleTarget.title}
          itemId={scheduleTarget.id}
          currentAssigned={scheduleTarget.assignedTo}
          students={myStudents}
          onConfirm={(ids) => onExamScheduled(scheduleTarget.id, ids)}
        />
      )}

      {/* Material schedule dialog (from Tugas Materi tab) */}
      {schedMatTarget && (
        <ScheduleDialog
          open={!!schedMatTarget}
          onOpenChange={(o) => { if (!o) setSchedMatTarget(null); }}
          itemTitle={schedMatTarget.title}
          itemId={schedMatTarget.id}
          currentAssigned={schedMatTarget.assignedTo}
          students={myStudents}
          onConfirm={(ids) => onMatScheduled(schedMatTarget.id, ids)}
        />
      )}
    </div>
  );
}
