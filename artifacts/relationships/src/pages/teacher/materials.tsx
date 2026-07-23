import { useMemo, useRef, useEffect, useState } from "react";
import {
  Plus, BookOpen, Clock, Users as UsersIcon, FileText, Trash2, Pencil,
  Video, Image as ImageIcon, Search, Filter, GraduationCap,
  BookMarked, CalendarCheck, Send, PenLine, ClipboardList,
  Bold, Italic, Underline, List, ListOrdered, RemoveFormatting,
  CheckSquare, ToggleLeft, AlignLeft, Shuffle, X,
  BarChart3, BookmarkPlus, Library,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { RichEditor } from "@/components/rich-editor";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Material, Exam, Question, User, AppNotification, ExamSubmission, QuestionBankItem, MaterialBankItem, ExamBankItem } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

// ── Rich Text Editor ──────────────────────────────────────────────────────────
function RichTextEditor({ value, onChange, placeholder, minRows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const skipSync = useRef(false);
  useEffect(() => {
    if (ref.current && !skipSync.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    skipSync.current = false;
  }, [value]);
  function exec(cmd: string, val?: string) {
    ref.current?.focus(); document.execCommand(cmd, false, val ?? undefined);
    if (ref.current) { skipSync.current = true; onChange(ref.current.innerHTML); }
  }
  const btnCls = "h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground";
  return (
    <div className="border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/40 flex-wrap">
        <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}><Underline className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}><List className="h-3.5 w-3.5" /></button>
        <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}><RemoveFormatting className="h-3.5 w-3.5" /></button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
        onInput={() => { if (ref.current) { skipSync.current = true; onChange(ref.current.innerHTML); } }}
        className="px-3 py-2 text-sm focus:outline-none [&[contenteditable]:empty]:before:content-[attr(data-placeholder)] [&[contenteditable]:empty]:before:text-muted-foreground"
        style={{ minHeight: `${minRows * 1.75}rem` }} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  const d = new Date(ts); const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(s: string): number { return new Date(s).getTime(); }
function defaultDeadline(days = 7) {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 0, 0); return toDatetimeLocal(d.getTime());
}

// ── Save-to-Bank Dialog (for Question Bank) ───────────────────────────────────
function SaveToBankDialog({
  open, onOpenChange, question, examTitle, teacherId,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  question: Question | null; examTitle: string; teacherId: string;
}) {
  const bank = useStore<QuestionBankItem[]>("questionBank", []);
  const [subject, setSubject] = useState("");
  const [bab, setBab] = useState("");

  useMemo(() => { if (open) { setSubject(""); setBab(""); } }, [open]);

  function save() {
    if (!question) return;
    const already = bank.some((b) => b.createdBy === teacherId && b.question.question === question.question && b.question.type === question.type);
    if (already) { alert("Soal ini sudah ada di bank soal."); return; }
    const item: QuestionBankItem = {
      id: uid("bk_"), question, subject: subject.trim() || undefined,
      bab: bab.trim() || undefined, sourceExamTitle: examTitle || undefined,
      createdBy: teacherId, createdAt: Date.now(),
    };
    write("questionBank", [...bank, item]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookmarkPlus className="h-4 w-4 text-primary" />Simpan ke Bank Soal</DialogTitle>
          <p className="text-sm text-muted-foreground">Tambahkan tag agar mudah ditemukan kembali.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-sm">Mata Pelajaran (opsional)</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematika" className="mt-1" /></div>
          <div><Label className="text-sm">Bab / Topik (opsional)</Label><Input value={bab} onChange={(e) => setBab(e.target.value)} placeholder="Bab 3 – Aljabar" className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} className="gap-1"><BookmarkPlus className="h-4 w-4" />Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Material Bank Dialog ───────────────────────────────────────────────────────
function MaterialBankDialog({
  open, onOpenChange, teacherId, onUse, onSchedule,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  teacherId: string; onUse: (item: MaterialBankItem) => void;
  onSchedule?: (item: MaterialBankItem) => void;
}) {
  const bank = useStore<MaterialBankItem[]>("materialBank", []);
  const myBank = useMemo(() => bank.filter((b) => b.createdBy === teacherId).sort((a, b) => b.createdAt - a.createdAt), [bank, teacherId]);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterBab, setFilterBab] = useState("all");
  const [viewMode, setViewMode] = useState<"group" | "list">("group");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBab, setEditBab] = useState("");

  const subjects = useMemo(() => [...new Set(myBank.map((b) => b.subject).filter(Boolean) as string[])].sort(), [myBank]);
  const babs = useMemo(() => {
    const relevant = filterSubject === "all" ? myBank : myBank.filter((b) => b.subject === filterSubject);
    return [...new Set(relevant.map((b) => b.bab).filter(Boolean) as string[])].sort();
  }, [myBank, filterSubject]);

  const filtered = useMemo(() => myBank.filter((b) => {
    if (filterSubject !== "all" && b.subject !== filterSubject) return false;
    if (filterBab !== "all" && b.bab !== filterBab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.title.toLowerCase().includes(q) && !b.subject?.toLowerCase().includes(q) && !b.bab?.toLowerCase().includes(q) && !b.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [myBank, search, filterSubject, filterBab]);

  const grouped = useMemo(() => {
    const subjectMap = new Map<string, Map<string, MaterialBankItem[]>>();
    for (const item of filtered) {
      const sub = item.subject || "(Tanpa Mata Pelajaran)";
      const bab = item.bab || "(Tanpa Bab)";
      if (!subjectMap.has(sub)) subjectMap.set(sub, new Map());
      const babMap = subjectMap.get(sub)!;
      if (!babMap.has(bab)) babMap.set(bab, []);
      babMap.get(bab)!.push(item);
    }
    return Array.from(subjectMap.entries()).map(([subject, babMap]) => ({
      subject,
      babs: Array.from(babMap.entries()).map(([bab, items]) => ({ bab, items })),
    }));
  }, [filtered]);

  function deleteFromBank(id: string) { write("materialBank", bank.filter((b) => b.id !== id)); }
  function startEdit(item: MaterialBankItem) { setEditingId(item.id); setEditSubject(item.subject ?? ""); setEditBab(item.bab ?? ""); }
  function cancelEdit() { setEditingId(null); }
  function saveEdit(id: string) {
    write("materialBank", bank.map((b) => b.id === id ? { ...b, subject: editSubject.trim() || undefined, bab: editBab.trim() || undefined } : b));
    setEditingId(null);
  }

  function MatItem({ item }: { item: MaterialBankItem }) {
    const isEditing = editingId === item.id;
    return (
      <div className={`border rounded-lg p-3.5 bg-card transition-colors ${isEditing ? "border-primary ring-1 ring-primary/20" : "hover:bg-accent/30"}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold leading-snug">{item.title}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
            </div>
            {!isEditing && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {item.subject && <Badge variant="secondary" className="text-xs">{item.subject}{item.bab ? ` – ${item.bab}` : ""}</Badge>}
                  {item.timerMinutes && <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />{item.timerMinutes} mnt</Badge>}
                  {item.fileName && <Badge variant="outline" className="text-xs gap-1"><FileText className="h-3 w-3" />PDF</Badge>}
                  {item.imageDataUrl && <Badge variant="outline" className="text-xs gap-1"><ImageIcon className="h-3 w-3" />Gambar</Badge>}
                  {(item.videoUrl || item.videoDataUrl) && <Badge variant="outline" className="text-xs gap-1"><Video className="h-3 w-3" />Video</Badge>}
                  {item.content && item.content.replace(/<[^>]+>/g, "").trim() && (
                    <Badge variant="outline" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Teks</Badge>
                  )}
                </div>
                {item.content && item.content.replace(/<[^>]+>/g, "").trim() && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 line-clamp-2">
                    {item.content.replace(/<[^>]+>/g, "").trim().slice(0, 120)}{item.content.replace(/<[^>]+>/g, "").trim().length > 120 ? "…" : ""}
                  </p>
                )}
              </>
            )}
            {isEditing && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-primary">Edit tag mapel & bab</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Mata Pelajaran</Label>
                    <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Matematika" className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bab / Topik</Label>
                    <Input value={editBab} onChange={(e) => setEditBab(e.target.value)} placeholder="Bab 1 – Bilangan" className="h-7 text-xs mt-0.5" />
                  </div>
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  <Button size="sm" className="h-6 text-xs px-2.5 gap-1" onClick={() => saveEdit(item.id)}><BookMarked className="h-3 w-3" />Simpan</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2.5" onClick={cancelEdit}>Batal</Button>
                </div>
              </div>
            )}
          </div>
          {!isEditing && (
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { onUse(item); onOpenChange(false); }}>
                <Plus className="h-3.5 w-3.5" />Gunakan
              </Button>
              {onSchedule && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-primary border-primary/40 hover:bg-primary/10" onClick={() => { onSchedule(item); onOpenChange(false); }}>
                  <CalendarCheck className="h-3.5 w-3.5" />Jadwalkan
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Edit tag" onClick={() => startEdit(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFromBank(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" />Bank Materi</DialogTitle>
          <p className="text-sm text-muted-foreground">{myBank.length} materi tersimpan · Klik "Gunakan" untuk membuat salinan baru.</p>
        </DialogHeader>

        <div className="shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari judul, mapel, bab, deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterSubject} onValueChange={(v) => { setFilterSubject(v); setFilterBab("all"); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua Mapel</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {babs.length > 0 && (
              <Select value={filterBab} onValueChange={setFilterBab}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Semua Bab" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Bab</SelectItem>
                  {babs.map((b) => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant={viewMode === "group" ? "default" : "outline"} className="h-8 text-xs px-2.5" onClick={() => setViewMode("group")}><BookMarked className="h-3.5 w-3.5 mr-1" />Per Bab</Button>
              <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} className="h-8 text-xs px-2.5" onClick={() => setViewMode("list")}><Filter className="h-3.5 w-3.5 mr-1" />Daftar</Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {myBank.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Library className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Bank materi kosong</p>
              <p className="text-xs mt-1">Klik "Simpan ke Bank" di dialog edit materi untuk menyimpannya.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Tidak ada materi yang cocok dengan filter.</div>
          ) : viewMode === "list" ? (
            <div className="space-y-2 py-1">
              {filtered.map((item) => <MatItem key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="space-y-5 py-1">
              {grouped.map(({ subject, babs: babGroups }) => (
                <div key={subject}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
                    <BookMarked className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm">{subject}</span>
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-muted-foreground shrink-0">{babGroups.reduce((s, g) => s + g.items.length, 0)} materi</span>
                  </div>
                  <div className="space-y-4 pl-1">
                    {babGroups.map(({ bab, items }) => (
                      <div key={bab}>
                        {bab !== "(Tanpa Bab)" && (
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{bab}</span>
                            <span className="text-xs text-muted-foreground">({items.length})</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {items.map((item) => <MatItem key={item.id} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Save Exam to Bank Dialog ──────────────────────────────────────────────────
function SaveExamToBankDialog({
  open, onOpenChange, exam, teacherId,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  exam: Exam | null; teacherId: string;
}) {
  const bank = useStore<ExamBankItem[]>("examBank", []);
  const [subject, setSubject] = useState("");
  const [bab, setBab] = useState("");
  useMemo(() => { if (open) { setSubject(""); setBab(""); } }, [open]);

  function save() {
    if (!exam) return;
    const already = bank.some((b) => b.createdBy === teacherId && b.title === exam.title);
    if (already) { alert("Ujian dengan judul ini sudah ada di bank ujian."); return; }
    const item: ExamBankItem = {
      id: uid("eb_"), title: exam.title, description: exam.description,
      questions: exam.questions, durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore, shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      subject: subject.trim() || undefined, bab: bab.trim() || undefined,
      createdBy: teacherId, createdAt: Date.now(),
    };
    write("examBank", [...bank, item]);
    onOpenChange(false);
    alert("Ujian berhasil disimpan ke bank ujian!");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookmarkPlus className="h-4 w-4 text-primary" />Simpan ke Bank Ujian</DialogTitle>
          <p className="text-sm text-muted-foreground">Tambahkan tag agar mudah ditemukan kembali.</p>
        </DialogHeader>
        {exam && (
          <div className="bg-muted/40 rounded-md px-3 py-2 text-sm">
            <p className="font-medium truncate">{exam.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{exam.questions.length} soal · {exam.durationMinutes} menit</p>
          </div>
        )}
        <div className="space-y-3">
          <div><Label className="text-sm">Mata Pelajaran <span className="text-muted-foreground font-normal">(opsional)</span></Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematika" className="mt-1" /></div>
          <div><Label className="text-sm">Bab / Topik <span className="text-muted-foreground font-normal">(opsional)</span></Label><Input value={bab} onChange={(e) => setBab(e.target.value)} placeholder="Bab 3 – Aljabar" className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} className="gap-1"><BookmarkPlus className="h-4 w-4" />Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Exam Bank Dialog ──────────────────────────────────────────────────────────
function ExamBankDialog({
  open, onOpenChange, teacherId, onUse,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  teacherId: string; onUse: (item: ExamBankItem) => void;
}) {
  const bank = useStore<ExamBankItem[]>("examBank", []);
  const myBank = useMemo(() => bank.filter((b) => b.createdBy === teacherId).sort((a, b) => b.createdAt - a.createdAt), [bank, teacherId]);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterBab, setFilterBab] = useState("all");
  const [viewMode, setViewMode] = useState<"group" | "list">("group");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBab, setEditBab] = useState("");

  const subjects = useMemo(() => [...new Set(myBank.map((b) => b.subject).filter(Boolean) as string[])].sort(), [myBank]);
  const babs = useMemo(() => {
    const relevant = filterSubject === "all" ? myBank : myBank.filter((b) => b.subject === filterSubject);
    return [...new Set(relevant.map((b) => b.bab).filter(Boolean) as string[])].sort();
  }, [myBank, filterSubject]);

  const filtered = useMemo(() => myBank.filter((b) => {
    if (filterSubject !== "all" && b.subject !== filterSubject) return false;
    if (filterBab !== "all" && b.bab !== filterBab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.title.toLowerCase().includes(q) && !b.subject?.toLowerCase().includes(q) && !b.bab?.toLowerCase().includes(q) && !b.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [myBank, search, filterSubject, filterBab]);

  const grouped = useMemo(() => {
    const subjectMap = new Map<string, Map<string, ExamBankItem[]>>();
    for (const item of filtered) {
      const sub = item.subject || "(Tanpa Mata Pelajaran)";
      const bab = item.bab || "(Tanpa Bab)";
      if (!subjectMap.has(sub)) subjectMap.set(sub, new Map());
      const babMap = subjectMap.get(sub)!;
      if (!babMap.has(bab)) babMap.set(bab, []);
      babMap.get(bab)!.push(item);
    }
    return Array.from(subjectMap.entries()).map(([subject, babMap]) => ({
      subject,
      babs: Array.from(babMap.entries()).map(([bab, items]) => ({ bab, items })),
    }));
  }, [filtered]);

  function deleteFromBank(id: string) { write("examBank", bank.filter((b) => b.id !== id)); }
  function startEdit(item: ExamBankItem) { setEditingId(item.id); setEditSubject(item.subject ?? ""); setEditBab(item.bab ?? ""); }
  function cancelEdit() { setEditingId(null); }
  function saveEdit(id: string) {
    write("examBank", bank.map((b) => b.id === id ? { ...b, subject: editSubject.trim() || undefined, bab: editBab.trim() || undefined } : b));
    setEditingId(null);
  }

  function qtypeSummary(qs: import("@/lib/types").Question[]) {
    const counts: Record<string, number> = {};
    for (const q of qs) counts[q.type] = (counts[q.type] || 0) + 1;
    return Object.entries(counts).map(([t, n]) => `${n} ${QTYPE_LABELS[t] ?? t}`).join(", ");
  }

  function ExamItem({ item }: { item: ExamBankItem }) {
    const totalPoin = item.questions.reduce((s, q) => s + q.points, 0);
    const isEditing = editingId === item.id;
    return (
      <div className={`border rounded-lg p-3.5 bg-card transition-colors ${isEditing ? "border-primary ring-1 ring-primary/20" : "hover:bg-accent/30"}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold leading-snug">{item.title}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
            </div>
            {!isEditing && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {item.subject && <Badge variant="secondary" className="text-xs">{item.subject}{item.bab ? ` – ${item.bab}` : ""}</Badge>}
                  <Badge variant="outline" className="text-xs gap-1"><ClipboardList className="h-3 w-3" />{item.questions.length} soal</Badge>
                  <Badge variant="outline" className="text-xs gap-1"><Clock className="h-3 w-3" />{item.durationMinutes} mnt</Badge>
                  {item.passingScore && <Badge variant="secondary" className="text-xs">KKM {item.passingScore}</Badge>}
                  {item.shuffleQuestions && <Badge variant="outline" className="text-xs gap-1"><Shuffle className="h-3 w-3" />Acak</Badge>}
                </div>
                {item.questions.length > 0 && (
                  <div className="bg-muted/50 rounded px-2 py-1.5 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Tipe soal: <span className="text-foreground">{qtypeSummary(item.questions)}</span></p>
                    <p className="text-xs text-muted-foreground">Total poin: <span className="text-foreground font-medium">{totalPoin}</span></p>
                  </div>
                )}
              </>
            )}
            {isEditing && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-primary">Edit tag mapel & bab</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Mata Pelajaran</Label>
                    <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Matematika" className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bab / Topik</Label>
                    <Input value={editBab} onChange={(e) => setEditBab(e.target.value)} placeholder="Bab 1 – Bilangan" className="h-7 text-xs mt-0.5" />
                  </div>
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  <Button size="sm" className="h-6 text-xs px-2.5 gap-1" onClick={() => saveEdit(item.id)}><BookMarked className="h-3 w-3" />Simpan</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2.5" onClick={cancelEdit}>Batal</Button>
                </div>
              </div>
            )}
          </div>
          {!isEditing && (
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { onUse(item); onOpenChange(false); }}>
                <Plus className="h-3.5 w-3.5" />Gunakan
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Edit tag" onClick={() => startEdit(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFromBank(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" />Bank Ujian</DialogTitle>
          <p className="text-sm text-muted-foreground">{myBank.length} ujian tersimpan · Klik "Gunakan" untuk membuat salinan baru.</p>
        </DialogHeader>

        <div className="shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari judul, mapel, bab, deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterSubject} onValueChange={(v) => { setFilterSubject(v); setFilterBab("all"); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua Mapel</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {babs.length > 0 && (
              <Select value={filterBab} onValueChange={setFilterBab}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Semua Bab" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Bab</SelectItem>
                  {babs.map((b) => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant={viewMode === "group" ? "default" : "outline"} className="h-8 text-xs px-2.5" onClick={() => setViewMode("group")}><BookMarked className="h-3.5 w-3.5 mr-1" />Per Bab</Button>
              <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} className="h-8 text-xs px-2.5" onClick={() => setViewMode("list")}><Filter className="h-3.5 w-3.5 mr-1" />Daftar</Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {myBank.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Library className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Bank ujian kosong</p>
              <p className="text-xs mt-1">Klik "Simpan ke Bank" di kartu ujian untuk menyimpannya.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Tidak ada ujian yang cocok dengan filter.</div>
          ) : viewMode === "list" ? (
            <div className="space-y-2 py-1">
              {filtered.map((item) => <ExamItem key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="space-y-5 py-1">
              {grouped.map(({ subject, babs: babGroups }) => (
                <div key={subject}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
                    <BookMarked className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm">{subject}</span>
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-muted-foreground shrink-0">{babGroups.reduce((s, g) => s + g.items.length, 0)} ujian</span>
                  </div>
                  <div className="space-y-4 pl-1">
                    {babGroups.map(({ bab, items }) => (
                      <div key={bab}>
                        {bab !== "(Tanpa Bab)" && (
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{bab}</span>
                            <span className="text-xs text-muted-foreground">({items.length})</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {items.map((item) => <ExamItem key={item.id} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Question Bank Dialog ──────────────────────────────────────────────────────
function QuestionBankDialog({
  open, onOpenChange, teacherId, onAddQuestions,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  teacherId: string; onAddQuestions: (qs: Question[]) => void;
}) {
  const bank = useStore<QuestionBankItem[]>("questionBank", []);
  const myBank = useMemo(() => bank.filter((b) => b.createdBy === teacherId).sort((a, b) => b.createdAt - a.createdAt), [bank, teacherId]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useMemo(() => { if (open) setSelected(new Set()); }, [open]);

  const filtered = useMemo(() => myBank.filter((b) => {
    if (filterType !== "all" && b.question.type !== filterType) return false;
    if (search) {
      const text = b.question.question.replace(/<[^>]+>/g, "").toLowerCase();
      if (!text.includes(search.toLowerCase()) && !b.subject?.toLowerCase().includes(search.toLowerCase()) && !b.bab?.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  }), [myBank, search, filterType]);

  function toggleItem(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function addSelected() {
    const qs = [...selected].map((id) => {
      const item = myBank.find((b) => b.id === id)!;
      return { ...item.question, id: uid("q_") };
    });
    onAddQuestions(qs); onOpenChange(false);
  }

  function deleteFromBank(id: string) {
    write("questionBank", bank.filter((b) => b.id !== id));
  }

  function previewText(html: string, max = 80) {
    const text = html.replace(/<[^>]+>/g, "").trim();
    return text.length > max ? text.slice(0, max) + "…" : text || "(soal bergambar)";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" />Bank Soal</DialogTitle>
          <p className="text-sm text-muted-foreground">{myBank.length} soal tersimpan · Pilih untuk ditambahkan ke ujian.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari soal, mapel, bab..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua Tipe</SelectItem>
                {(["mc", "mc-complex", "tf", "fill", "essay"] as const).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{QTYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {myBank.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Library className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Belum ada soal di bank. Klik ikon 💾 pada soal di dialog Ujian untuk menyimpannya.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Tidak ada soal yang cocok.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div key={item.id} className={`border rounded-lg p-3 cursor-pointer transition-colors ${selected.has(item.id) ? "border-primary bg-primary/5" : "hover:bg-accent/50"}`} onClick={() => toggleItem(item.id)}>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleItem(item.id)} className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <Badge variant="outline" className="text-xs gap-1 h-5">{QTYPE_ICONS[item.question.type]}{QTYPE_LABELS[item.question.type]}</Badge>
                        <Badge variant="secondary" className="text-xs h-5">{item.question.points} poin</Badge>
                        {item.subject && <Badge variant="outline" className="text-xs h-5">{item.subject}{item.bab ? ` – ${item.bab}` : ""}</Badge>}
                        {item.sourceExamTitle && <span className="text-xs text-muted-foreground">dari: {item.sourceExamTitle}</span>}
                      </div>
                      <p className="text-sm line-clamp-2">{previewText(item.question.question)}</p>
                      {item.question.options && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.question.options.length} pilihan</p>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteFromBank(item.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={addSelected} disabled={selected.size === 0} className="gap-1">
            <Plus className="h-4 w-4" />Tambah {selected.size > 0 ? `${selected.size} ` : ""}Soal ke Ujian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Exam Dialog ───────────────────────────────────────────────────────────────
export function ExamDialog({
  open, onOpenChange, teacherId, editing, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; teacherId: string;
  editing: Exam | null; onCreated?: (e: Exam) => void;
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
  const [bankOpen, setBankOpen] = useState(false);
  const [saveToBankQ, setSaveToBankQ] = useState<Question | null>(null);
  const bank = useStore<QuestionBankItem[]>("questionBank", []);

  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? ""); setDescription(editing?.description ?? "");
      setDuration(String(editing?.durationMinutes ?? 60));
      setDeadline(editing ? toDatetimeLocal(editing.deadline) : defaultDeadline());
      setStartDT(editing?.startDateTime ? toDatetimeLocal(editing.startDateTime) : "");
      setShuffleQ(editing?.shuffleQuestions ?? false); setShuffleO(editing?.shuffleOptions ?? false);
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
  function updateQ(id: string, patch: Partial<Question>) { setQuestions((qs) => qs.map((q) => q.id === id ? { ...q, ...patch } : q)); }
  function removeQ(id: string) { setQuestions((qs) => qs.filter((q) => q.id !== id)); }
  function moveQ(idx: number, dir: -1 | 1) {
    setQuestions((qs) => { const a = [...qs]; const t = idx + dir; if (t < 0 || t >= a.length) return qs; [a[idx], a[t]] = [a[t], a[idx]]; return a; });
  }
  function onQImage(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => updateQ(id, { imageDataUrl: r.result as string }); r.readAsDataURL(f);
  }
  function onQPdf(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => updateQ(id, { pdfDataUrl: r.result as string, pdfFileName: f.name }); r.readAsDataURL(f);
  }

  function addFromBank(qs: Question[]) {
    setQuestions((prev) => [...prev, ...qs]);
  }

  function save() {
    if (!title.trim()) return alert("Judul wajib diisi.");
    if (!questions.length) return alert("Minimal 1 soal.");
    for (const q of questions) {
      if (!q.question.replace(/<[^>]+>/g, "").trim()) return alert("Semua soal wajib diisi.");
      if ((q.type === "mc" || q.type === "mc-complex") && q.options?.some((o) => !o.trim())) return alert("Semua pilihan jawaban wajib diisi.");
      if (q.type === "fill" && !q.fillAnswer?.trim()) return alert("Jawaban isian singkat wajib diisi.");
    }
    const exam: Exam = {
      id: editing?.id ?? uid("e_"),
      title: title.trim(), description: description.trim(), questions,
      durationMinutes: parseInt(duration) || 60,
      deadline: fromDatetimeLocal(deadline),
      startDateTime: startDT ? fromDatetimeLocal(startDT) : undefined,
      assignedTo: editing?.assignedTo ?? [],
      status: editing?.status ?? "draft",
      createdBy: editing?.createdBy ?? teacherId,
      createdAt: editing?.createdAt ?? Date.now(),
      type: "exam",
      shuffleQuestions: shuffleQ, shuffleOptions: shuffleO,
      passingScore: parseInt(passingScore) || 70,
    };
    const all = read("exams", []);
    if (editing) { write("exams", all.map((e) => e.id === exam.id ? exam : e)); void mcApi.updateExam(exam.id, exam).catch(() => {}); }
    else { write("exams", [...all, exam]); void mcApi.createExam(exam).catch(() => {}); onCreated?.(exam); }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Ujian" : "Buat Ujian Baru"}</DialogTitle>
          {!editing && <p className="text-sm text-muted-foreground">Isi soal, atur deadline & waktu mulai, lalu klik "Jadwalkan" di kartu untuk mengirimkan ke siswa.</p>}
        </DialogHeader>
        <div className="space-y-5">
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
              <Label>Waktu Mulai (opsional)</Label>
              <Input type="datetime-local" value={startDT} onChange={(e) => setStartDT(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Jika diisi, siswa melihat hitung mundur sampai waktu ini sebelum ujian dibuka.</p>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-exam-deadline" />
            </div>
          </div>
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <Label className="text-sm font-semibold flex items-center gap-1.5"><Shuffle className="h-4 w-4" />Pengacakan</Label>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Acak urutan soal</div>
              <Switch checked={shuffleQ} onCheckedChange={setShuffleQ} />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Acak pilihan jawaban</div>
              <Switch checked={shuffleO} onCheckedChange={setShuffleO} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Label className="text-base font-semibold">Soal ({questions.length})</Label>
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-0.5 text-sm font-semibold">
                  <span>Total:</span>
                  <span>{questions.reduce((s, q) => s + (q.points ?? 0), 0)} poin</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setBankOpen(true)} className="gap-1">
                  <Library className="h-4 w-4" />Bank Soal
                  {bank.filter((b) => b.createdBy === teacherId).length > 0 && (
                    <Badge variant="secondary" className="h-4 text-xs px-1 ml-0.5">{bank.filter((b) => b.createdBy === teacherId).length}</Badge>
                  )}
                </Button>
                <Button size="sm" onClick={() => addQuestion("mc")} data-testid="button-add-question">
                  <Plus className="h-4 w-4 mr-1" />Tambah Soal
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="shrink-0">No. {idx + 1}</Badge>
                        <Select value={q.type} onValueChange={(v) => {
                          const t = v as Question["type"];
                          const patch: Partial<Question> = { type: t };
                          if (t === "mc" || t === "mc-complex") { patch.options = q.options?.length ? q.options : ["", "", "", ""]; patch.correctAnswer = 0; if (t === "mc-complex") patch.correctAnswers = []; }
                          if (t === "tf") { patch.correctAnswer = 0; }
                          if (t === "fill") { patch.fillAnswer = q.fillAnswer ?? ""; }
                          updateQ(q.id, patch);
                        }}>
                          <SelectTrigger className="h-7 text-xs w-40 gap-1">
                            <span className="flex items-center gap-1">{QTYPE_ICONS[q.type]}<SelectValue /></span>
                          </SelectTrigger>
                          <SelectContent>
                            {(["mc", "mc-complex", "tf", "fill", "essay"] as const).map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">
                                <span className="flex items-center gap-1.5">{QTYPE_ICONS[t]}{QTYPE_LABELS[t]}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground">Poin:</Label>
                          <Select value={String(q.points)} onValueChange={(v) => updateQ(q.id, { points: parseInt(v) })}>
                            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{[5, 10, 15, 20, 25, 30, 40, 50].map((n) => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Simpan ke Bank Soal" onClick={() => setSaveToBankQ(q)}>
                          <BookmarkPlus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQ(idx, -1)} disabled={idx === 0}>↑</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQ(idx, 1)} disabled={idx === questions.length - 1}>↓</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeQ(q.id)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Pertanyaan</Label>
                      <RichTextEditor value={q.question} onChange={(v) => updateQ(q.id, { question: v })} placeholder="Tulis pertanyaan di sini..." minRows={2} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-accent transition-colors">
                        <ImageIcon className="h-3 w-3" />Upload Gambar
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onQImage(q.id, e)} />
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-accent transition-colors">
                        <FileText className="h-3 w-3" />Lampiran PDF
                        <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => onQPdf(q.id, e)} />
                      </label>
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
                    {q.type === "mc" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Pilihan (radio = jawaban benar)</Label>
                        <RadioGroup value={String(q.correctAnswer ?? 0)} onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })}>
                          {q.options!.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <RadioGroupItem value={String(oi)} id={`${q.id}-${oi}`} />
                              <RichTextEditor value={opt} onChange={(v) => { const opts = [...q.options!]; opts[oi] = v; updateQ(q.id, { options: opts }); }} placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} minRows={1} />
                            </div>
                          ))}
                        </RadioGroup>
                        <Button type="button" size="sm" variant="ghost" onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ""] })}>+ Tambah Pilihan</Button>
                      </div>
                    )}
                    {q.type === "mc-complex" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Pilihan (centang semua yang benar)</Label>
                        {q.options!.map((opt, oi) => {
                          const isCorrect = (q.correctAnswers ?? []).includes(oi);
                          return (
                            <div key={oi} className="flex items-center gap-2">
                              <Checkbox checked={isCorrect} onCheckedChange={(c) => { const prev = q.correctAnswers ?? []; updateQ(q.id, { correctAnswers: c ? [...prev, oi] : prev.filter((x) => x !== oi) }); }} />
                              <RichTextEditor value={opt} onChange={(v) => { const opts = [...q.options!]; opts[oi] = v; updateQ(q.id, { options: opts }); }} placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} minRows={1} />
                            </div>
                          );
                        })}
                        <Button type="button" size="sm" variant="ghost" onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ""] })}>+ Tambah Pilihan</Button>
                      </div>
                    )}
                    {q.type === "tf" && (
                      <div>
                        <Label className="text-xs mb-2 block">Jawaban benar</Label>
                        <RadioGroup value={String(q.correctAnswer ?? 0)} onValueChange={(v) => updateQ(q.id, { correctAnswer: parseInt(v) })} className="flex gap-4">
                          <div className="flex items-center gap-2"><RadioGroupItem value="0" id={`tf-b-${q.id}`} /><label htmlFor={`tf-b-${q.id}`} className="text-sm font-medium cursor-pointer">✅ Benar</label></div>
                          <div className="flex items-center gap-2"><RadioGroupItem value="1" id={`tf-s-${q.id}`} /><label htmlFor={`tf-s-${q.id}`} className="text-sm font-medium cursor-pointer">❌ Salah</label></div>
                        </RadioGroup>
                      </div>
                    )}
                    {q.type === "fill" && (
                      <div>
                        <Label className="text-xs">Kunci jawaban</Label>
                        <Input value={q.fillAnswer ?? ""} onChange={(e) => updateQ(q.id, { fillAnswer: e.target.value })} placeholder="Jawaban (tidak case-sensitive)..." className="mt-1" />
                      </div>
                    )}
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
      <QuestionBankDialog open={bankOpen} onOpenChange={setBankOpen} teacherId={teacherId} onAddQuestions={addFromBank} />
      <SaveToBankDialog open={!!saveToBankQ} onOpenChange={(o) => { if (!o) setSaveToBankQ(null); }} question={saveToBankQ} examTitle={title} teacherId={teacherId} />
    </Dialog>
  );
}

// ── Schedule Dialog ────────────────────────────────────────────────────────────
export function ScheduleDialog({
  open, onOpenChange, itemTitle, itemId: _itemId, currentAssigned, students, onConfirm, showDates, datesRequired = true, initialFrom, initialUntil,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; itemTitle: string; itemId: string;
  currentAssigned: string[]; students: User[];
  onConfirm: (studentIds: string[], availableFrom?: number, availableUntil?: number) => void;
  showDates?: boolean; datesRequired?: boolean; initialFrom?: number; initialUntil?: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssigned));
  const [mode, setMode] = useState<"kelas" | "siswa">("kelas");
  const [fromDT, setFromDT] = useState("");
  const [untilDT, setUntilDT] = useState(defaultDeadline());

  useMemo(() => {
    if (open) {
      setSelected(new Set(currentAssigned)); setMode("kelas");
      setFromDT(initialFrom ? toDatetimeLocal(initialFrom) : "");
      setUntilDT(initialUntil ? toDatetimeLocal(initialUntil) : defaultDeadline());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const classGroups = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const s of students) { const k = s.kelas ?? "(Tanpa Kelas)"; if (!map.has(k)) map.set(k, []); map.get(k)!.push(s); }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  function isClassChecked(kelas: string) { const ids = classGroups.find(([k]) => k === kelas)?.[1].map((s) => s.id) ?? []; return ids.length > 0 && ids.every((id) => selected.has(id)); }
  function isClassIndeterminate(kelas: string) { const ids = classGroups.find(([k]) => k === kelas)?.[1].map((s) => s.id) ?? []; return ids.some((id) => selected.has(id)) && !ids.every((id) => selected.has(id)); }
  function toggleClass(kelas: string, checked: boolean) { const ids = classGroups.find(([k]) => k === kelas)?.[1].map((s) => s.id) ?? []; setSelected((prev) => { const n = new Set(prev); checked ? ids.forEach((id) => n.add(id)) : ids.forEach((id) => n.delete(id)); return n; }); }
  function toggleStudent(id: string, checked: boolean) { setSelected((prev) => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; }); }
  function confirm() {
    if (showDates && datesRequired && !untilDT) return alert("Isi tanggal selesai/deadline.");
    if (showDates && fromDT && untilDT && fromDatetimeLocal(fromDT) >= fromDatetimeLocal(untilDT)) return alert("Tanggal mulai harus sebelum deadline.");
    const af = showDates && fromDT ? fromDatetimeLocal(fromDT) : undefined;
    const au = showDates && untilDT ? fromDatetimeLocal(untilDT) : undefined;
    onConfirm([...selected], af, au);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" />Jadwalkan</DialogTitle>
          <p className="text-sm text-muted-foreground line-clamp-1">"{itemTitle}"</p>
        </DialogHeader>
        <div className="space-y-4">
          {showDates && (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rentang Waktu</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mulai dari (opsional)</Label>
                  <Input type="datetime-local" value={fromDT} onChange={(e) => setFromDT(e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Selesai / Deadline <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={untilDT} onChange={(e) => setUntilDT(e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
              </div>
              {fromDT && untilDT && fromDatetimeLocal(fromDT) >= fromDatetimeLocal(untilDT) && (
                <p className="text-xs text-destructive">Tanggal mulai harus sebelum deadline.</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{selected.size} siswa dipilih</span>
            <div className="flex gap-3">
              <button type="button" className="text-xs text-primary underline" onClick={() => setSelected(new Set(students.map((s) => s.id)))}>Semua</button>
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setSelected(new Set())}>Hapus</button>
            </div>
          </div>
          {students.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">Belum ada siswa aktif.</div>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "kelas" | "siswa")}>
              <TabsList className="w-full">
                <TabsTrigger value="kelas" className="flex-1">Per Kelas</TabsTrigger>
                <TabsTrigger value="siswa" className="flex-1">Per Siswa</TabsTrigger>
              </TabsList>
              <TabsContent value="kelas" className="space-y-2 mt-3">
                {classGroups.map(([kelas, siswa]) => (
                  <div key={kelas} className="border rounded-lg p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={isClassChecked(kelas)} data-indeterminate={isClassIndeterminate(kelas) || undefined} onCheckedChange={(c) => toggleClass(kelas, !!c)} />
                      <span className="font-semibold text-sm">{kelas}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{siswa.length} siswa</span>
                    </label>
                    <div className="pl-6 space-y-1">
                      {siswa.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={selected.has(s.id)} onCheckedChange={(c) => toggleStudent(s.id, !!c)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="siswa" className="mt-3">
                <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selected.has(s.id)} onCheckedChange={(c) => toggleStudent(s.id, !!c)} />
                      <span>{s.name}</span>
                      {s.kelas && <span className="text-xs text-muted-foreground">({s.kelas})</span>}
                    </label>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={confirm} disabled={selected.size === 0} className="gap-1"><Send className="h-4 w-4" />Jadwalkan ke {selected.size} Siswa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Material Dialog ────────────────────────────────────────────────────────────
function MaterialDialog({
  open, onOpenChange, editing, materialType, teacherId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Material | null;
  materialType: "materi" | "soal"; teacherId: string; onCreated?: (m: Material) => void;
}) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [content, setContent] = useState(""); const [subject, setSubject] = useState("");
  const [bab, setBab] = useState(""); const [timerMinutes, setTimerMinutes] = useState("");
  const [fileName, setFileName] = useState(""); const [fileDataUrl, setFileDataUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState(""); const [videoUrl, setVideoUrl] = useState("");
  const [videoFileName, setVideoFileName] = useState(""); const [videoDataUrl, setVideoDataUrl] = useState("");
  const [videoTab, setVideoTab] = useState<"link" | "upload">("link");
  const [mediaTab, setMediaTab] = useState<"pdf" | "image" | "video">("pdf");

  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? ""); setDescription(editing?.description ?? ""); setContent(editing?.content ?? "");
      setSubject(editing?.subject ?? ""); setBab(editing?.bab ?? "");
      setTimerMinutes(editing?.timerMinutes ? String(editing.timerMinutes) : "");
      setFileName(editing?.fileName ?? ""); setFileDataUrl(editing?.fileDataUrl ?? "");
      setImageDataUrl(editing?.imageDataUrl ?? ""); setVideoUrl(editing?.videoUrl ?? "");
      setVideoFileName(editing?.videoFileName ?? ""); setVideoDataUrl(editing?.videoDataUrl ?? "");
      setVideoTab(editing?.videoDataUrl ? "upload" : "link"); setMediaTab("pdf");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setFileName(f.name); setFileDataUrl(r.result as string); }; r.readAsDataURL(f); }
  function onImageFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setImageDataUrl(r.result as string); r.readAsDataURL(f); }
  function onVideoFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setVideoFileName(f.name); setVideoDataUrl(r.result as string); }; r.readAsDataURL(f); }

  function save() {
    if (!title.trim()) { alert("Judul wajib diisi."); return; }
    const all = read("materials", []);
    const existing = all.find((m) => m.id === editing?.id);
    const m: Material = {
      id: existing?.id ?? uid("m_"),
      title: title.trim(), description: description.trim(), content,
      subject: subject.trim() || undefined, bab: bab.trim() || undefined,
      fileName: fileName || undefined, fileDataUrl: fileDataUrl || undefined,
      imageDataUrl: imageDataUrl || undefined,
      videoUrl: videoTab === "link" && videoUrl.trim() ? videoUrl.trim() : undefined,
      videoFileName: videoTab === "upload" && videoFileName ? videoFileName : undefined,
      videoDataUrl: videoTab === "upload" && videoDataUrl ? videoDataUrl : undefined,
      timerMinutes: timerMinutes ? parseInt(timerMinutes) : undefined,
      createdBy: existing?.createdBy ?? teacherId, assignedTo: existing?.assignedTo ?? [],
      status: existing?.status ?? "draft", createdAt: existing?.createdAt ?? Date.now(), materialType,
    };
    write("materials", existing ? all.map((x) => x.id === m.id ? m : x) : [...all, m]);
    if (!existing) { void mcApi.createMaterial(m).catch(() => {}); onCreated?.(m); }
    else void mcApi.updateMaterial(m.id, m).catch(() => {});
    onOpenChange(false);
  }

  const typeLabel = materialType === "soal" ? "Soal/Latihan" : "Materi";
  const MEDIA_TABS = [
    { key: "pdf" as const, label: "PDF / File", icon: FileText },
    { key: "image" as const, label: "Gambar", icon: ImageIcon },
    { key: "video" as const, label: "Video", icon: Video },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${typeLabel}` : `Buat ${typeLabel} Baru`}</DialogTitle>
          {!editing && <p className="text-sm text-muted-foreground">Isi konten, lalu jadwalkan ke siswa dari menu Tugas.</p>}
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Judul <span className="text-destructive">*</span></Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Judul ${typeLabel.toLowerCase()}`} data-testid="input-material-title" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Mata Pelajaran</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematika" /></div>
            <div><Label>Bab / Topik</Label><Input value={bab} onChange={(e) => setBab(e.target.value)} placeholder="Bab 1 – Bilangan" /></div>
          </div>
          <div><Label>Deskripsi</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ringkasan singkat" /></div>
          <div>
            <Label className="mb-1.5 block">Konten {materialType === "soal" ? "(soal / pertanyaan)" : "(isi materi)"}</Label>
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder={materialType === "soal" ? "Tulis soal-soal latihan di sini..." : "Tulis isi materi di sini..."}
              minHeight={280}
            />
          </div>
          <div className="space-y-2">
            <Label>Media pendukung (opsional)</Label>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {MEDIA_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setMediaTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 rounded-md transition-colors ${mediaTab === key ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            {mediaTab === "pdf" && (
              <div>
                <Input type="file" accept=".pdf,application/pdf" onChange={onFile} />
                {fileName && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><FileText className="h-3 w-3" />{fileName}<button onClick={() => { setFileName(""); setFileDataUrl(""); }} className="ml-2 text-destructive underline">hapus</button></div>}
              </div>
            )}
            {mediaTab === "image" && (
              <div>
                <Input type="file" accept="image/*" onChange={onImageFile} />
                {imageDataUrl ? (<div className="mt-2"><img src={imageDataUrl} alt="preview" className="h-32 w-full object-cover rounded-md border" /><button onClick={() => setImageDataUrl("")} className="text-xs text-destructive underline mt-1">hapus</button></div>) : null}
              </div>
            )}
            {mediaTab === "video" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setVideoTab("link")} className={`text-xs px-3 py-1.5 rounded border transition-colors ${videoTab === "link" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}>Link YouTube/URL</button>
                  <button type="button" onClick={() => setVideoTab("upload")} className={`text-xs px-3 py-1.5 rounded border transition-colors ${videoTab === "upload" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}>Upload Video</button>
                </div>
                {videoTab === "link" ? (
                  <div><Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." /></div>
                ) : (
                  <div>
                    <Input type="file" accept="video/*" onChange={onVideoFile} />
                    {videoFileName && <div className="text-xs text-muted-foreground mt-1">{videoFileName}<button onClick={() => { setVideoFileName(""); setVideoDataUrl(""); }} className="ml-2 text-destructive underline">hapus</button></div>}
                  </div>
                )}
              </div>
            )}
          </div>
          {materialType === "soal" && (
            <div>
              <Label>Timer (menit, opsional)</Label>
              <Input type="number" min="1" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} placeholder="Contoh: 60" />
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button variant="outline" className="gap-1" onClick={() => {
            if (!title.trim()) { alert("Isi judul terlebih dahulu."); return; }
            const bankAll = read("materialBank", []);
            const already = bankAll.some((b: MaterialBankItem) => b.createdBy === teacherId && b.title === title.trim());
            if (already) { alert("Materi dengan judul ini sudah ada di bank materi."); return; }
            const item: MaterialBankItem = {
              id: uid("mb_"), title: title.trim(), description: description.trim(), content,
              subject: subject.trim() || undefined, bab: bab.trim() || undefined,
              materialType, fileName: fileName || undefined, fileDataUrl: fileDataUrl || undefined,
              imageDataUrl: imageDataUrl || undefined,
              videoUrl: videoTab === "link" && videoUrl.trim() ? videoUrl.trim() : undefined,
              videoFileName: videoTab === "upload" && videoFileName ? videoFileName : undefined,
              videoDataUrl: videoTab === "upload" && videoDataUrl ? videoDataUrl : undefined,
              timerMinutes: timerMinutes ? parseInt(timerMinutes) : undefined,
              createdBy: teacherId, createdAt: Date.now(),
            };
            write("materialBank", [...bankAll, item]);
            alert("Materi berhasil disimpan ke bank materi!");
          }}>
            <BookmarkPlus className="h-4 w-4" />Simpan ke Bank
          </Button>
          <Button onClick={save} data-testid="button-save-material">{editing ? "Simpan Perubahan" : "Simpan Draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherMaterials() {
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const users = useStore<User[]>("users", []);

  const myStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.teacherId === user?.id && u.status === "active"),
    [users, user],
  );
  const myMaterials = useMemo(() => materials.filter((m) => m.createdBy === user?.id), [materials, user]);
  const materiList = useMemo(() => myMaterials.filter((m) => (m.materialType ?? "materi") === "materi"), [myMaterials]);
  const soalList = useMemo(() => myMaterials.filter((m) => m.materialType === "soal"), [myMaterials]);
  const myExams = useMemo(() => exams.filter((e) => e.createdBy === user?.id && (e.type ?? "exam") === "exam"), [exams, user]);

  // Material state
  const [matOpen, setMatOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newMaterialType, setNewMaterialType] = useState<"materi" | "soal">("materi");
  const [matScheduleTarget, setMatScheduleTarget] = useState<Material | null>(null);
  const [matBankOpen, setMatBankOpen] = useState(false);
  const matBank = useStore<MaterialBankItem[]>("materialBank", []);
  const [bankScheduleTarget, setBankScheduleTarget] = useState<MaterialBankItem | null>(null);
  const [examBankOpen, setExamBankOpen] = useState(false);
  const examBank = useStore<ExamBankItem[]>("examBank", []);
  const [saveExamBankTarget, setSaveExamBankTarget] = useState<Exam | null>(null);

  // Exam state
  const [examOpen, setExamOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examScheduleTarget, setExamScheduleTarget] = useState<Exam | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterBab, setFilterBab] = useState("all");

  function startCreate(type: "materi" | "soal") { setEditingMaterial(null); setNewMaterialType(type); setMatOpen(true); }
  function startEdit(m: Material) { setEditingMaterial(m); setNewMaterialType(m.materialType ?? "materi"); setMatOpen(true); }
  function startFromExamBank(item: ExamBankItem) {
    const draft: Exam = {
      id: uid("e_"), title: item.title, description: item.description,
      questions: item.questions.map((q) => ({ ...q, id: uid("q_") })),
      durationMinutes: item.durationMinutes,
      deadline: fromDatetimeLocal(defaultDeadline()),
      assignedTo: [], status: "draft",
      createdBy: user!.id, createdAt: Date.now(),
      type: "exam",
      shuffleQuestions: item.shuffleQuestions,
      shuffleOptions: item.shuffleOptions,
      passingScore: item.passingScore,
    };
    setEditingExam(draft);
    setExamOpen(true);
  }
  function startFromBank(item: MaterialBankItem) {
    const draft: Material = {
      id: uid("m_"), title: item.title, description: item.description ?? "", content: item.content ?? "",
      subject: item.subject, bab: item.bab, materialType: item.materialType ?? "materi",
      fileName: item.fileName, fileDataUrl: item.fileDataUrl,
      imageDataUrl: item.imageDataUrl, videoUrl: item.videoUrl,
      videoFileName: item.videoFileName, videoDataUrl: item.videoDataUrl,
      timerMinutes: item.timerMinutes,
      createdBy: user!.id, assignedTo: [], status: "draft", createdAt: Date.now(),
    };
    setEditingMaterial(draft);
    setNewMaterialType(item.materialType ?? "materi");
    setMatOpen(true);
  }
  function openMatSchedule(m: Material) { setMatScheduleTarget(m); }

  function onBankMatScheduled(studentIds: string[], availableFrom?: number, availableUntil?: number) {
    if (!bankScheduleTarget) return;
    const mat: Material = {
      id: uid("m_"), title: bankScheduleTarget.title, description: bankScheduleTarget.description ?? "",
      content: bankScheduleTarget.content ?? "", subject: bankScheduleTarget.subject, bab: bankScheduleTarget.bab,
      materialType: bankScheduleTarget.materialType ?? "materi",
      fileName: bankScheduleTarget.fileName, fileDataUrl: bankScheduleTarget.fileDataUrl,
      imageDataUrl: bankScheduleTarget.imageDataUrl, videoUrl: bankScheduleTarget.videoUrl,
      videoFileName: bankScheduleTarget.videoFileName, videoDataUrl: bankScheduleTarget.videoDataUrl,
      timerMinutes: bankScheduleTarget.timerMinutes,
      createdBy: user!.id, assignedTo: studentIds, status: "published", createdAt: Date.now(),
      availableFrom, availableUntil,
    };
    write("materials", [...read("materials", []), mat]);
    if (studentIds.length) {
      const notifs: AppNotification[] = studentIds.map((sid) => ({
        id: uid("n_"), userId: sid, type: "new_material", title: "Materi baru",
        message: `"${mat.title}" telah dijadwalkan untuk Anda.`, link: "/student/materials",
        createdAt: Date.now(), read: false,
      }));
      write("notifications", [...read("notifications", []), ...notifs]);
      void mcApi.createMaterial(mat).catch(() => {});
    }
    setBankScheduleTarget(null);
  }

  function deleteMaterial(id: string) {
    if (!confirm("Hapus ini?")) return;
    write("materials", materials.filter((m) => m.id !== id));
    void mcApi.deleteMaterial(id).catch(() => {});
  }
  function deleteExam(id: string) {
    if (!confirm("Hapus ujian ini?")) return;
    write("exams", exams.filter((e) => e.id !== id));
    void mcApi.deleteExam(id).catch(() => {});
  }

  function onMatScheduled(materialId: string, studentIds: string[], availableFrom?: number, availableUntil?: number) {
    const all = read("materials", []);
    const target = all.find((m) => m.id === materialId); if (!target) return;
    const newlyAdded = studentIds.filter((id) => !(target.assignedTo ?? []).includes(id));
    const updated: Material = { ...target, assignedTo: studentIds, status: studentIds.length ? "published" : "draft", availableFrom, availableUntil };
    write("materials", all.map((m) => m.id === materialId ? updated : m));
    if (newlyAdded.length) {
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({ id: uid("n_"), userId: sid, type: "new_material", title: "Materi baru", message: `"${target.title}" telah dijadwalkan untuk Anda.`, link: "/student/materials", createdAt: Date.now(), read: false }));
      write("notifications", [...read("notifications", []), ...newNotifs]);
      void mcApi.updateMaterial(materialId, { ...updated, notifications: newNotifs } as Material & { notifications?: AppNotification[] }).catch(() => {});
    } else { void mcApi.updateMaterial(materialId, updated).catch(() => {}); }
    setMatScheduleTarget(null);
  }

  function onExamScheduled(examId: string, studentIds: string[], startDT?: number, deadlineDT?: number) {
    const all = read("exams", []);
    const target = all.find((e) => e.id === examId); if (!target) return;
    const newlyAdded = studentIds.filter((id) => !(target.assignedTo ?? []).includes(id));
    const updated: Exam = {
      ...target, assignedTo: studentIds, status: studentIds.length ? "published" : "draft",
      startDateTime: startDT ?? target.startDateTime,
      deadline: deadlineDT ?? target.deadline,
    };
    write("exams", all.map((e) => e.id === examId ? updated : e));
    if (newlyAdded.length) {
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({ id: uid("n_"), userId: sid, type: "new_exam", title: "Ujian baru tersedia", message: `"${target.title}" dijadwalkan untuk Anda.`, link: "/student/exams", createdAt: Date.now(), read: false }));
      write("notifications", [...read("notifications", []), ...newNotifs]);
      void mcApi.updateExam(examId, { ...updated, notifications: newNotifs } as Exam & { notifications?: AppNotification[] }).catch(() => {});
    } else { void mcApi.updateExam(examId, updated).catch(() => {}); }
    setExamScheduleTarget(null);
  }

  const subjects = useMemo(() => [...new Set(myMaterials.map((m) => m.subject).filter(Boolean) as string[])].sort(), [myMaterials]);
  const babs = useMemo(() => {
    const relevant = filterSubject === "all" ? myMaterials : myMaterials.filter((m) => m.subject === filterSubject);
    return [...new Set(relevant.map((m) => m.bab).filter(Boolean) as string[])].sort();
  }, [myMaterials, filterSubject]);

  const isDraft = (m: Material) => !m.assignedTo?.length || m.status === "draft";
  const isExamDraft = (e: Exam) => !e.assignedTo?.length || e.status === "draft";

  function filterList(list: Material[]) {
    return list.filter((m) => {
      if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterSubject !== "all" && m.subject !== filterSubject) return false;
      if (filterBab !== "all" && m.bab !== filterBab) return false;
      return true;
    });
  }

  function groupBySubjectBab(list: Material[]) {
    const subjectMap = new Map<string, Map<string, Material[]>>();
    for (const m of list) {
      const sub = m.subject || "(Tanpa Mata Pelajaran)"; const bab = m.bab || "(Tanpa Bab)";
      if (!subjectMap.has(sub)) subjectMap.set(sub, new Map());
      const babMap = subjectMap.get(sub)!;
      if (!babMap.has(bab)) babMap.set(bab, []); babMap.get(bab)!.push(m);
    }
    return Array.from(subjectMap.entries()).map(([subject, babMap]) => ({ subject, babs: Array.from(babMap.entries()).map(([bab, items]) => ({ bab, items })) }));
  }

  // Exam card for the Ujian tab
  function ExamCard({ e }: { e: Exam }) {
    const subs = submissions.filter((s) => s.examId === e.id);
    const needsGrading = subs.filter((s) => !s.fullyGraded).length;
    const isExpired = e.deadline < Date.now();
    const draft = isExamDraft(e);
    const notStarted = e.startDateTime && e.startDateTime > Date.now();
    return (
      <Card className={draft ? "border-dashed" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{e.title}</CardTitle>
            {draft ? <Badge variant="secondary" className="shrink-0">Draft</Badge>
              : notStarted ? <Badge variant="outline" className="shrink-0 text-xs">Terjadwal</Badge>
              : <Badge variant={isExpired ? "secondary" : "default"} className={!isExpired ? "bg-green-600 shrink-0" : "shrink-0"}>{isExpired ? "Berakhir" : "Aktif"}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><ClipboardList className="h-3 w-3" />{e.questions.length} soal</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{e.durationMinutes} mnt</Badge>
            {!draft && <Badge variant="outline" className="gap-1"><UsersIcon className="h-3 w-3" />{subs.length}/{e.assignedTo.length}</Badge>}
            {needsGrading > 0 && <Badge variant="destructive">{needsGrading} koreksi</Badge>}
          </div>
          {e.startDateTime && <div className="text-xs text-muted-foreground">Mulai: {formatDate(e.startDateTime)}</div>}
          <div className="text-xs text-muted-foreground">Deadline: {formatDate(e.deadline)}</div>
          <div className="flex flex-wrap gap-2 pt-1">
            {draft ? (
              <Button size="sm" onClick={() => setExamScheduleTarget(e)} className="gap-1">
                <Send className="h-3.5 w-3.5" />Jadwalkan
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/exams/${e.id}/results`}><BarChart3 className="h-3 w-3 mr-1" />Hasil</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExamScheduleTarget(e)} className="gap-1">
                  <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => { setEditingExam(e); setExamOpen(true); }}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
            <Button variant="outline" size="sm" onClick={() => setSaveExamBankTarget(e)} className="gap-1"><BookmarkPlus className="h-3 w-3" />Simpan ke Bank</Button>
            <Button variant="outline" size="sm" onClick={() => deleteExam(e.id)}><Trash2 className="h-3 w-3 mr-1 text-destructive" />Hapus</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function MaterialCard({ m }: { m: Material }) {
    const draft = isDraft(m);
    return (
      <Card className={draft ? "border-dashed" : ""}>
        {m.imageDataUrl && <div className="h-32 overflow-hidden rounded-t-lg"><img src={m.imageDataUrl} alt={m.title} className="w-full h-full object-cover" /></div>}
        <CardHeader className={m.imageDataUrl ? "pt-3" : ""}>
          <CardTitle className="text-base flex items-start justify-between gap-2">
            <span className="line-clamp-2">{m.title}</span>
            {draft ? <Badge variant="secondary" className="shrink-0 text-xs">Draft</Badge> : <Badge variant="default" className="shrink-0 text-xs bg-green-600">Aktif</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {m.timerMinutes && <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{m.timerMinutes} mnt</Badge>}
            {m.fileName && <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" />PDF</Badge>}
            {m.imageDataUrl && <Badge variant="secondary" className="gap-1"><ImageIcon className="h-3 w-3" />Gambar</Badge>}
            {(m.videoUrl || m.videoDataUrl) && <Badge variant="secondary" className="gap-1"><Video className="h-3 w-3" />Video</Badge>}
            {!draft && <Badge variant="outline" className="gap-1"><UsersIcon className="h-3 w-3" />{m.assignedTo.length} siswa</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">Dibuat {formatDate(m.createdAt)}</div>
          {m.availableFrom && <div className="flex items-center gap-1 text-xs text-primary"><CalendarCheck className="h-3 w-3 shrink-0" />Mulai: {formatDate(m.availableFrom)}</div>}
          {m.availableUntil && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3 shrink-0" />Berakhir: {formatDate(m.availableUntil)}</div>}
          <div className="flex flex-wrap gap-2 pt-1">
            {draft ? <Button size="sm" onClick={() => openMatSchedule(m)} className="gap-1"><Send className="h-3.5 w-3.5" />Jadwalkan</Button>
              : <Button size="sm" variant="outline" onClick={() => openMatSchedule(m)} className="gap-1"><CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal</Button>}
            <Button variant="outline" size="sm" onClick={() => startEdit(m)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
            <Button variant="outline" size="sm" onClick={() => deleteMaterial(m.id)}><Trash2 className="h-3 w-3 mr-1 text-destructive" />Hapus</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function GroupedList({ list, emptyType, onCreateClick }: { list: Material[]; emptyType: string; onCreateClick: () => void }) {
    const filtered = filterList(list);
    const grouped = groupBySubjectBab(filtered);
    if (list.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><BookOpen className="h-6 w-6" /></EmptyMedia>
            <EmptyTitle>Belum ada {emptyType}</EmptyTitle>
            <EmptyDescription>Buat {emptyType} baru, lalu klik "Jadwalkan" di kartu untuk mengirimkan ke siswa.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button onClick={onCreateClick}><Plus className="h-4 w-4 mr-2" />Buat {emptyType === "materi" ? "Materi Baru" : "Soal Baru"}</Button></EmptyContent>
        </Empty>
      );
    }
    if (filtered.length === 0) return <div className="text-center py-12 text-sm text-muted-foreground">Tidak ada yang cocok dengan filter.</div>;
    return (
      <div className="space-y-6">
        {grouped.map(({ subject, babs: babGroups }) => (
          <div key={subject}>
            <div className="flex items-center gap-2 mb-3">
              <BookMarked className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">{subject}</h2>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="space-y-4 pl-2">
              {babGroups.map(({ bab, items }) => (
                <div key={bab}>
                  {bab !== "(Tanpa Bab)" && (
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{bab}</span>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{items.map((m) => <MaterialCard key={m.id} m={m} />)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters (for materi/soal tabs) */}
      {myMaterials.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterSubject} onValueChange={(v) => { setFilterSubject(v); setFilterBab("all"); }}>
            <SelectTrigger className="w-44"><Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" /><SelectValue placeholder="Mapel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Mapel</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {babs.length > 0 && (
            <Select value={filterBab} onValueChange={setFilterBab}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Bab" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua Bab</SelectItem>{babs.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Tabs: Materi | Ujian */}
      <Tabs defaultValue="materi">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <TabsList>
            <TabsTrigger value="materi" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />Materi ({materiList.length})</TabsTrigger>
            <TabsTrigger value="ujian" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Ujian ({myExams.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setMatBankOpen(true)} className="gap-1">
              <Library className="h-4 w-4" />Bank Materi
              {matBank.filter((b) => b.createdBy === user!.id).length > 0 && (
                <Badge variant="secondary" className="h-4 text-xs px-1 ml-0.5">{matBank.filter((b) => b.createdBy === user!.id).length}</Badge>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExamBankOpen(true)} className="gap-1">
              <Library className="h-4 w-4" />Bank Ujian
              {examBank.filter((b) => b.createdBy === user!.id).length > 0 && (
                <Badge variant="secondary" className="h-4 text-xs px-1 ml-0.5">{examBank.filter((b) => b.createdBy === user!.id).length}</Badge>
              )}
            </Button>
            <Button onClick={() => startCreate("materi")} size="sm" data-testid="button-new-material"><Plus className="h-4 w-4 mr-1" />Materi Baru</Button>
            <Button onClick={() => { setEditingExam(null); setExamOpen(true); }} size="sm" variant="outline" data-testid="button-new-exam"><Plus className="h-4 w-4 mr-1" />Ujian Baru</Button>
          </div>
        </div>

        <TabsContent value="materi">
          <GroupedList list={materiList} emptyType="materi" onCreateClick={() => startCreate("materi")} />
        </TabsContent>

        <TabsContent value="ujian">
          {myExams.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ClipboardList className="h-6 w-6" /></EmptyMedia>
                <EmptyTitle>Belum ada ujian</EmptyTitle>
                <EmptyDescription>Buat ujian baru lalu klik "Jadwalkan" untuk mengirimkannya ke siswa.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent><Button onClick={() => { setEditingExam(null); setExamOpen(true); }}><Plus className="h-4 w-4 mr-2" />Buat Ujian</Button></EmptyContent>
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">{myExams.map((e) => <ExamCard key={e.id} e={e} />)}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MaterialDialog open={matOpen} onOpenChange={setMatOpen} editing={editingMaterial} materialType={newMaterialType} teacherId={user!.id} onCreated={(m) => setMatScheduleTarget(m)} />
      <ExamDialog open={examOpen} onOpenChange={setExamOpen} teacherId={user!.id} editing={editingExam} onCreated={(e) => setExamScheduleTarget(e)} />
      <MaterialBankDialog open={matBankOpen} onOpenChange={setMatBankOpen} teacherId={user!.id} onUse={startFromBank} onSchedule={(item) => setBankScheduleTarget(item)} />
      <ExamBankDialog open={examBankOpen} onOpenChange={setExamBankOpen} teacherId={user!.id} onUse={startFromExamBank} />
      <SaveExamToBankDialog open={!!saveExamBankTarget} onOpenChange={(o) => { if (!o) setSaveExamBankTarget(null); }} exam={saveExamBankTarget} teacherId={user!.id} />

      {matScheduleTarget && (
        <ScheduleDialog open={!!matScheduleTarget} onOpenChange={(o) => { if (!o) setMatScheduleTarget(null); }}
          itemTitle={matScheduleTarget.title} itemId={matScheduleTarget.id}
          currentAssigned={matScheduleTarget.assignedTo} students={myStudents}
          showDates datesRequired={false}
          initialFrom={matScheduleTarget.availableFrom}
          initialUntil={matScheduleTarget.availableUntil}
          onConfirm={(ids, af, au) => onMatScheduled(matScheduleTarget.id, ids, af, au)} />
      )}
      {examScheduleTarget && (
        <ScheduleDialog open={!!examScheduleTarget} onOpenChange={(o) => { if (!o) setExamScheduleTarget(null); }}
          itemTitle={examScheduleTarget.title} itemId={examScheduleTarget.id}
          currentAssigned={examScheduleTarget.assignedTo} students={myStudents}
          showDates datesRequired
          initialFrom={examScheduleTarget.startDateTime}
          initialUntil={examScheduleTarget.deadline}
          onConfirm={(ids, sf, dl) => onExamScheduled(examScheduleTarget.id, ids, sf, dl)} />
      )}
      {bankScheduleTarget && (
        <ScheduleDialog open={!!bankScheduleTarget} onOpenChange={(o) => { if (!o) setBankScheduleTarget(null); }}
          itemTitle={bankScheduleTarget.title} itemId={bankScheduleTarget.id}
          currentAssigned={[]} students={myStudents}
          showDates
          onConfirm={onBankMatScheduled} />
      )}
    </div>
  );
}
