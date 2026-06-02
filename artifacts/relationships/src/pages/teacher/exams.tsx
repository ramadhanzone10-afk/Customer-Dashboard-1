import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Plus, Clock, Users as UsersIcon, ClipboardList, Trash2, BarChart3, X,
  Shuffle, CheckSquare, AlignLeft, ToggleLeft, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import type { Exam, Question, User, AppNotification, ExamSubmission } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mc: "Pilihan Ganda",
  tf: "Benar / Salah",
  fill: "Isian Singkat",
  essay: "Essay",
};
const QUESTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  mc: <CheckSquare className="h-3.5 w-3.5" />,
  tf: <ToggleLeft className="h-3.5 w-3.5" />,
  fill: <AlignLeft className="h-3.5 w-3.5" />,
  essay: <AlignLeft className="h-3.5 w-3.5" />,
};

export default function TeacherExams() {
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const users = useStore<User[]>("users", []);

  const myStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.teacherId === user?.id),
    [users, user],
  );
  const myExams = useMemo(() => exams.filter((e) => e.createdBy === user?.id), [exams, user]);

  const ujianList = useMemo(() => myExams.filter((e) => (e.type ?? "exam") === "exam"), [myExams]);
  const tugasList = useMemo(() => myExams.filter((e) => e.type === "tugas"), [myExams]);

  const [open, setOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [newType, setNewType] = useState<"exam" | "tugas">("exam");

  function openCreate(type: "exam" | "tugas") { setEditingExam(null); setNewType(type); setOpen(true); }
  function openEdit(e: Exam) { setEditingExam(e); setNewType(e.type ?? "exam"); setOpen(true); }

  function deleteExam(id: string) {
    if (!confirm("Hapus ujian ini?")) return;
    write("exams", exams.filter((e) => e.id !== id));
    write("examSubmissions", submissions.filter((s) => s.examId !== id));
    void mcApi.deleteExam(id).catch(() => {});
  }

  function ExamCard({ e }: { e: Exam }) {
    const subs = submissions.filter((s) => s.examId === e.id);
    const needsGrading = subs.filter((s) => !s.fullyGraded).length;
    const isExpired = e.deadline < Date.now();
    return (
      <Card data-testid={`exam-card-${e.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{e.title}</CardTitle>
            <Badge variant={isExpired ? "secondary" : "default"}>{isExpired ? "Berakhir" : "Aktif"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><ClipboardList className="h-3 w-3" />{e.questions.length} soal</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{e.durationMinutes} mnt</Badge>
            <Badge variant="outline" className="gap-1"><UsersIcon className="h-3 w-3" />{subs.length}/{e.assignedTo.length}</Badge>
            {e.shuffleQuestions && <Badge variant="outline" className="gap-1"><Shuffle className="h-3 w-3" />Acak Soal</Badge>}
            {needsGrading > 0 && <Badge variant="destructive">{needsGrading} koreksi</Badge>}
          </div>
          {e.passingScore && (
            <div className="text-xs text-muted-foreground">KKM: {e.passingScore}%</div>
          )}
          <div className="text-xs text-muted-foreground">Deadline: {formatDate(e.deadline)}</div>
          <div className="flex gap-2 pt-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/exams/${e.id}/results`}>
                <BarChart3 className="h-3 w-3 mr-1" />Hasil
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
              <Pencil className="h-3 w-3 mr-1" />Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => deleteExam(e.id)} data-testid={`button-delete-exam-${e.id}`}>
              <Trash2 className="h-3 w-3 mr-1 text-destructive" />Hapus
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function EmptyExam({ type, onCreate }: { type: string; onCreate: () => void }) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ClipboardList className="h-6 w-6" /></EmptyMedia>
          <EmptyTitle>Belum ada {type}</EmptyTitle>
          <EmptyDescription>Buat {type} pertama untuk siswa Anda.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button onClick={onCreate}><Plus className="h-4 w-4 mr-2" />Buat {type === "ujian" ? "Ujian" : "Tugas"}</Button></EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="ujian">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <TabsList>
            <TabsTrigger value="ujian">Ujian ({ujianList.length})</TabsTrigger>
            <TabsTrigger value="tugas">Tugas ({tugasList.length})</TabsTrigger>
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

        <TabsContent value="ujian" className="space-y-4">
          {ujianList.length === 0 ? (
            <EmptyExam type="ujian" onCreate={() => openCreate("exam")} />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {ujianList.map((e) => <ExamCard key={e.id} e={e} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tugas" className="space-y-4">
          {tugasList.length === 0 ? (
            <EmptyExam type="tugas" onCreate={() => openCreate("tugas")} />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {tugasList.map((e) => <ExamCard key={e.id} e={e} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ExamDialog
        open={open}
        onOpenChange={setOpen}
        teacherId={user!.id}
        students={myStudents}
        initialType={newType}
        editing={editingExam}
      />
    </div>
  );
}

function ExamDialog({
  open, onOpenChange, teacherId, students, initialType, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teacherId: string;
  students: User[];
  initialType: "exam" | "tugas";
  editing: Exam | null;
}) {
  const isEditing = !!editing;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [duration, setDuration] = useState(String(editing?.durationMinutes ?? 30));
  const [deadline, setDeadline] = useState(() => {
    if (editing) return new Date(editing.deadline).toISOString().slice(0, 10);
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [assigned, setAssigned] = useState<string[]>(editing?.assignedTo ?? students.map((s) => s.id));
  const [shuffleQ, setShuffleQ] = useState(editing?.shuffleQuestions ?? false);
  const [shuffleO, setShuffleO] = useState(editing?.shuffleOptions ?? false);
  const [passingScore, setPassingScore] = useState(String(editing?.passingScore ?? 70));
  const [questions, setQuestions] = useState<Question[]>(editing?.questions ?? [
    { id: uid("q_"), type: "mc", question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 },
  ]);

  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDescription(editing?.description ?? "");
      setDuration(String(editing?.durationMinutes ?? 30));
      if (editing) {
        setDeadline(new Date(editing.deadline).toISOString().slice(0, 10));
      } else {
        const d = new Date(); d.setDate(d.getDate() + 7);
        setDeadline(d.toISOString().slice(0, 10));
      }
      setAssigned(editing?.assignedTo ?? students.map((s) => s.id));
      setShuffleQ(editing?.shuffleQuestions ?? false);
      setShuffleO(editing?.shuffleOptions ?? false);
      setPassingScore(String(editing?.passingScore ?? 70));
      setQuestions(editing?.questions ?? [
        { id: uid("q_"), type: "mc", question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function addQuestion(type: Question["type"]) {
    const base: Question = { id: uid("q_"), type, question: "", points: 10 };
    if (type === "mc") { base.options = ["", "", "", ""]; base.correctAnswer = 0; }
    if (type === "tf") { base.correctAnswer = 0; }
    if (type === "fill") { base.fillAnswer = ""; }
    setQuestions((q) => [...q, base]);
  }

  function updateQ(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQ(id: string) { setQuestions((qs) => qs.filter((q) => q.id !== id)); }
  function moveQ(idx: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const arr = [...qs];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return qs;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  function save() {
    if (!title.trim()) return alert("Judul wajib diisi.");
    if (questions.length === 0) return alert("Minimal 1 soal.");
    for (const q of questions) {
      if (!q.question.trim()) return alert("Semua pertanyaan wajib diisi.");
      if (q.type === "mc" && q.options?.some((o) => !o.trim())) return alert("Semua pilihan ganda wajib diisi.");
      if (q.type === "fill" && !q.fillAnswer?.trim()) return alert("Jawaban isian singkat wajib diisi.");
    }

    const exam: Exam = {
      id: editing?.id ?? uid("e_"),
      title: title.trim(),
      description: description.trim(),
      questions,
      durationMinutes: parseInt(duration),
      deadline: new Date(deadline).getTime() + 24 * 60 * 60 * 1000 - 1,
      assignedTo: assigned,
      createdBy: editing?.createdBy ?? teacherId,
      createdAt: editing?.createdAt ?? Date.now(),
      type: initialType,
      shuffleQuestions: shuffleQ,
      shuffleOptions: shuffleO,
      passingScore: parseInt(passingScore),
    };

    const all = read("exams", []);
    if (isEditing) {
      write("exams", all.map((e) => (e.id === exam.id ? exam : e)));
      void mcApi.updateExam?.(exam.id, exam).catch(() => {});
    } else {
      write("exams", [...all, exam]);
      const notifs = read("notifications", []);
      const newNotifs: AppNotification[] = assigned.map((sid) => ({
        id: uid("n_"), userId: sid, type: "new_exam",
        title: `${initialType === "tugas" ? "Tugas" : "Ujian"} baru tersedia`,
        message: `${exam.title} telah dibagikan.`,
        link: "/student/exams", createdAt: Date.now(), read: false,
      }));
      write("notifications", [...notifs, ...newNotifs]);
      void mcApi.createExam({ ...exam, notifications: newNotifs }).catch(() => {});
    }
    onOpenChange(false);
  }

  const typeLabel = initialType === "tugas" ? "Tugas" : "Ujian";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${typeLabel}` : `Buat ${typeLabel} Baru`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Judul <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-exam-title" />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Durasi (menit)</Label>
              <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="input-exam-duration" />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-exam-deadline" />
            </div>
            <div>
              <Label>KKM / Nilai Lulus (%)</Label>
              <Input type="number" min="0" max="100" value={passingScore} onChange={(e) => setPassingScore(e.target.value)} placeholder="70" />
            </div>
          </div>

          {/* Shuffle options */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <Label className="text-sm font-semibold flex items-center gap-1.5"><Shuffle className="h-4 w-4" />Opsi Pengacakan</Label>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Acak urutan soal</div>
                <div className="text-xs text-muted-foreground">Soal akan ditampilkan dalam urutan acak</div>
              </div>
              <Switch checked={shuffleQ} onCheckedChange={setShuffleQ} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Acak pilihan jawaban</div>
                <div className="text-xs text-muted-foreground">Pilihan ganda akan diacak urutannya</div>
              </div>
              <Switch checked={shuffleO} onCheckedChange={setShuffleO} />
            </div>
          </div>

          {/* Students */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Bagikan ke siswa</Label>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-primary underline" onClick={() => setAssigned(students.map((s) => s.id))}>Pilih semua</button>
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setAssigned([])}>Hapus semua</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-32 overflow-y-auto">
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-2">Belum ada siswa terhubung.</p>
              ) : students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={assigned.includes(s.id)}
                    onCheckedChange={(c) => setAssigned((p) => c ? [...p, s.id] : p.filter((id) => id !== s.id))} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base">Soal ({questions.length})</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["mc", "tf", "fill", "essay"] as const).map((t) => (
                  <Button key={t} size="sm" variant="outline" onClick={() => addQuestion(t)}
                    data-testid={`button-add-${t}`}>
                    {QUESTION_TYPE_ICONS[t]}
                    <span className="ml-1">+ {QUESTION_TYPE_LABELS[t]}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge>{idx + 1}</Badge>
                        <Badge variant="outline" className="gap-1">{QUESTION_TYPE_ICONS[q.type]}{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => moveQ(idx, -1)} disabled={idx === 0} className="h-7 w-7">↑</Button>
                        <Button size="icon" variant="ghost" onClick={() => moveQ(idx, 1)} disabled={idx === questions.length - 1} className="h-7 w-7">↓</Button>
                        <Button size="icon" variant="ghost" onClick={() => removeQ(q.id)} data-testid={`button-remove-q-${idx}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea placeholder="Tulis pertanyaan..." value={q.question}
                      onChange={(e) => updateQ(q.id, { question: e.target.value })} rows={2}
                      data-testid={`input-question-${idx}`} />

                    {/* MC Options */}
                    {q.type === "mc" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Pilihan (radio = jawaban benar)</Label>
                        <RadioGroup value={String(q.correctAnswer ?? 0)} onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })}>
                          {q.options!.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <RadioGroupItem value={String(oi)} id={`${q.id}-${oi}`} />
                              <Input value={opt} onChange={(e) => {
                                const opts = [...q.options!]; opts[oi] = e.target.value; updateQ(q.id, { options: opts });
                              }} placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} className="flex-1"
                                data-testid={`input-option-${idx}-${oi}`} />
                            </div>
                          ))}
                        </RadioGroup>
                        <Button type="button" size="sm" variant="ghost" onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ""] })}>
                          + Tambah Pilihan
                        </Button>
                      </div>
                    )}

                    {/* TF */}
                    {q.type === "tf" && (
                      <div>
                        <Label className="text-xs mb-2 block">Jawaban benar</Label>
                        <RadioGroup value={String(q.correctAnswer ?? 0)} onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })}
                          className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="0" id={`tf-benar-${q.id}`} />
                            <label htmlFor={`tf-benar-${q.id}`} className="text-sm font-medium cursor-pointer">✅ Benar</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="1" id={`tf-salah-${q.id}`} />
                            <label htmlFor={`tf-salah-${q.id}`} className="text-sm font-medium cursor-pointer">❌ Salah</label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {/* Fill */}
                    {q.type === "fill" && (
                      <div>
                        <Label className="text-xs">Kunci jawaban</Label>
                        <Input value={q.fillAnswer ?? ""} onChange={(e) => updateQ(q.id, { fillAnswer: e.target.value })}
                          placeholder="Tulis kunci jawaban (tidak case-sensitive)..." className="mt-1" />
                        <p className="text-xs text-muted-foreground mt-1">Jawaban siswa akan dicocokkan tanpa memperhatikan huruf besar/kecil.</p>
                      </div>
                    )}

                    {/* Points */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Nilai:</Label>
                      <Select value={String(q.points)} onValueChange={(v) => updateQ(q.id, { points: parseInt(v) })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} poin</SelectItem>
                          ))}
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
          <Button onClick={save} data-testid="button-save-exam">
            {isEditing ? "Simpan Perubahan" : "Buat & Bagikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
