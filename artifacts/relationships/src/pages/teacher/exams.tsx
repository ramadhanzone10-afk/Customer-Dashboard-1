import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Clock, Users as UsersIcon, ClipboardList, Trash2, BarChart3, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, Question, User, AppNotification, ExamSubmission } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

export default function TeacherExams() {
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const users = useStore<User[]>("users", []);
  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);
  const [open, setOpen] = useState(false);

  function deleteExam(id: string) {
    if (!confirm("Hapus ujian ini?")) return;
    write("exams", exams.filter((e) => e.id !== id));
    write("examSubmissions", submissions.filter((s) => s.examId !== id));
    void mcApi.deleteExam(id).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Buat soal ujian, atur waktu pengerjaan, dan kirim ke siswa.
        </p>
        <Button onClick={() => setOpen(true)} data-testid="button-new-exam">
          <Plus className="h-4 w-4 mr-2" />
          Ujian Baru
        </Button>
      </div>

      {exams.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Belum ada ujian</EmptyTitle>
            <EmptyDescription>Buat ujian pertama untuk kelas Anda.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Ujian
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {exams.map((e) => {
            const subs = submissions.filter((s) => s.examId === e.id);
            const completed = subs.length;
            const needsGrading = subs.filter((s) => !s.fullyGraded).length;
            const isExpired = e.deadline < Date.now();
            return (
              <Card key={e.id} data-testid={`exam-card-${e.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                    {isExpired ? (
                      <Badge variant="secondary">Berakhir</Badge>
                    ) : (
                      <Badge variant="default">Aktif</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {e.description}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <ClipboardList className="h-3 w-3" />
                      {e.questions.length} soal
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {e.durationMinutes} mnt
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <UsersIcon className="h-3 w-3" />
                      {completed}/{e.assignedTo.length}
                    </Badge>
                    {needsGrading > 0 && (
                      <Badge variant="destructive">{needsGrading} koreksi</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Deadline: {formatDate(e.deadline)}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/teacher/exams/${e.id}/results`}>
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Hasil
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteExam(e.id)}
                      data-testid={`button-delete-exam-${e.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1 text-destructive" />
                      Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ExamDialog
        open={open}
        onOpenChange={setOpen}
        teacherId={user!.id}
        students={students}
      />
    </div>
  );
}

function ExamDialog({
  open,
  onOpenChange,
  teacherId,
  students,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teacherId: string;
  students: User[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [assigned, setAssigned] = useState<string[]>(students.map((s) => s.id));
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: uid("q_"),
      type: "mc",
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 10,
    },
  ]);

  // Reset state when opened
  useMemo(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDuration("30");
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDeadline(d.toISOString().slice(0, 10));
      setAssigned(students.map((s) => s.id));
      setQuestions([
        {
          id: uid("q_"),
          type: "mc",
          question: "",
          options: ["", "", "", ""],
          correctAnswer: 0,
          points: 10,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addQuestion(type: "mc" | "essay") {
    setQuestions((q) => [
      ...q,
      {
        id: uid("q_"),
        type,
        question: "",
        options: type === "mc" ? ["", "", "", ""] : undefined,
        correctAnswer: type === "mc" ? 0 : undefined,
        points: 10,
      },
    ]);
  }

  function updateQ(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function removeQ(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  function save() {
    if (!title.trim()) return alert("Judul ujian wajib diisi.");
    if (questions.length === 0) return alert("Minimal harus ada 1 soal.");
    for (const q of questions) {
      if (!q.question.trim()) return alert("Semua pertanyaan wajib diisi.");
      if (q.type === "mc" && q.options?.some((o) => !o.trim()))
        return alert("Semua pilihan ganda wajib diisi.");
    }

    const exam: Exam = {
      id: uid("e_"),
      title: title.trim(),
      description: description.trim(),
      questions,
      durationMinutes: parseInt(duration),
      deadline: new Date(deadline).getTime() + 24 * 60 * 60 * 1000 - 1,
      assignedTo: assigned,
      createdBy: teacherId,
      createdAt: Date.now(),
    };

    const all = read("exams", []);
    write("exams", [...all, exam]);

    const notifs = read("notifications", []);
    const newNotifs: AppNotification[] = assigned.map((sid) => ({
      id: uid("n_"),
      userId: sid,
      type: "new_exam",
      title: "Ujian baru tersedia",
      message: `${exam.title} telah dibagikan.`,
      link: "/student/exams",
      createdAt: Date.now(),
      read: false,
    }));
    write("notifications", [...notifs, ...newNotifs]);
    void mcApi.createExam({ ...exam, notifications: newNotifs }).catch(() => {});

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Ujian Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Judul ujian</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-exam-title" />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                data-testid="input-exam-duration"
              />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                data-testid="input-exam-deadline"
              />
            </div>
          </div>

          <div>
            <Label>Bagikan ke siswa</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={assigned.includes(s.id)}
                    onCheckedChange={(c) =>
                      setAssigned((prev) =>
                        c ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base">Soal ({questions.length})</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addQuestion("mc")} data-testid="button-add-mc">
                  + Pilihan Ganda
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion("essay")} data-testid="button-add-essay">
                  + Essay
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge>{idx + 1}</Badge>
                        <Badge variant="outline">
                          {q.type === "mc" ? "Pilihan Ganda" : "Essay"}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeQ(q.id)}
                        data-testid={`button-remove-q-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Tulis pertanyaan..."
                      value={q.question}
                      onChange={(e) => updateQ(q.id, { question: e.target.value })}
                      rows={2}
                      data-testid={`input-question-${idx}`}
                    />
                    {q.type === "mc" && (
                      <div className="space-y-2">
                        <RadioGroup
                          value={String(q.correctAnswer ?? 0)}
                          onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })}
                        >
                          {q.options!.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <RadioGroupItem value={String(oi)} id={`${q.id}-${oi}`} />
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...q.options!];
                                  opts[oi] = e.target.value;
                                  updateQ(q.id, { options: opts });
                                }}
                                placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`}
                                className="flex-1"
                                data-testid={`input-option-${idx}-${oi}`}
                              />
                            </div>
                          ))}
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground">
                          Pilih opsi dengan radio button untuk menandai jawaban benar.
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Nilai:</Label>
                      <Select
                        value={String(q.points)}
                        onValueChange={(v) => updateQ(q.id, { points: parseInt(v) })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} poin
                            </SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save} data-testid="button-save-exam">
            Buat & Bagikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
