import { useMemo, useState } from "react";
import {
  Plus, BookOpen, Clock, Users as UsersIcon, FileText, Trash2, Pencil,
  Video, Link as LinkIcon, Image as ImageIcon, Search, Filter, GraduationCap,
  BookMarked, CalendarCheck, Send, PenLine,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Material, User, AppNotification } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";

export default function TeacherMaterials() {
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const users = useStore<User[]>("users", []);

  const myStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.teacherId === user?.id && u.status === "active"),
    [users, user],
  );
  const myMaterials = useMemo(
    () => materials.filter((m) => m.createdBy === user?.id),
    [materials, user],
  );
  const materiList = useMemo(() => myMaterials.filter((m) => (m.materialType ?? "materi") === "materi"), [myMaterials]);
  const soalList = useMemo(() => myMaterials.filter((m) => m.materialType === "soal"), [myMaterials]);

  const [open, setOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newMaterialType, setNewMaterialType] = useState<"materi" | "soal">("materi");
  const [scheduleTarget, setScheduleTarget] = useState<Material | null>(null);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterBab, setFilterBab] = useState("all");

  function startCreate(type: "materi" | "soal") { setEditingMaterial(null); setNewMaterialType(type); setOpen(true); }
  function startEdit(m: Material) { setEditingMaterial(m); setNewMaterialType(m.materialType ?? "materi"); setOpen(true); }
  function openSchedule(m: Material) { setScheduleTarget(m); }

  function deleteMaterial(id: string) {
    if (!confirm("Hapus ini?")) return;
    write("materials", materials.filter((m) => m.id !== id));
    void mcApi.deleteMaterial(id).catch(() => {});
  }

  function onScheduled(materialId: string, studentIds: string[]) {
    const all = read("materials", []);
    const target = all.find((m) => m.id === materialId);
    if (!target) return;
    const prevIds = target.assignedTo ?? [];
    const newlyAdded = studentIds.filter((id) => !prevIds.includes(id));
    const updated: Material = { ...target, assignedTo: studentIds, status: "published" };
    write("materials", all.map((m) => m.id === materialId ? updated : m));

    if (newlyAdded.length) {
      const notifs = read("notifications", []);
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({
        id: uid("n_"), userId: sid, type: "new_material",
        title: "Materi baru", message: `"${target.title}" telah dijadwalkan untuk Anda.`,
        link: "/student/materials", createdAt: Date.now(), read: false,
      }));
      write("notifications", [...notifs, ...newNotifs]);
      void mcApi.updateMaterial(materialId, { ...updated, notifications: newNotifs } as Material & { notifications?: AppNotification[] }).catch(() => {});
    } else {
      void mcApi.updateMaterial(materialId, updated).catch(() => {});
    }
    setScheduleTarget(null);
  }

  const subjects = useMemo(() => [...new Set(myMaterials.map((m) => m.subject).filter(Boolean) as string[])].sort(), [myMaterials]);
  const babs = useMemo(() => {
    const relevant = filterSubject === "all" ? myMaterials : myMaterials.filter((m) => m.subject === filterSubject);
    return [...new Set(relevant.map((m) => m.bab).filter(Boolean) as string[])].sort();
  }, [myMaterials, filterSubject]);

  const isDraft = (m: Material) => !m.assignedTo?.length || m.status === "draft";

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
      const sub = m.subject || "(Tanpa Mata Pelajaran)";
      const bab = m.bab || "(Tanpa Bab)";
      if (!subjectMap.has(sub)) subjectMap.set(sub, new Map());
      const babMap = subjectMap.get(sub)!;
      if (!babMap.has(bab)) babMap.set(bab, []);
      babMap.get(bab)!.push(m);
    }
    return Array.from(subjectMap.entries()).map(([subject, babMap]) => ({
      subject,
      babs: Array.from(babMap.entries()).map(([bab, items]) => ({ bab, items })),
    }));
  }

  function MaterialCard({ m }: { m: Material }) {
    const draft = isDraft(m);
    return (
      <Card className={draft ? "border-dashed" : ""}>
        {m.imageDataUrl && (
          <div className="h-32 overflow-hidden rounded-t-lg">
            <img src={m.imageDataUrl} alt={m.title} className="w-full h-full object-cover" />
          </div>
        )}
        <CardHeader className={m.imageDataUrl ? "pt-3" : ""}>
          <CardTitle className="text-base flex items-start justify-between gap-2">
            <span className="line-clamp-2">{m.title}</span>
            {draft ? (
              <Badge variant="secondary" className="shrink-0 text-xs">Draft</Badge>
            ) : (
              <Badge variant="default" className="shrink-0 text-xs bg-green-600">Aktif</Badge>
            )}
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
          <div className="flex flex-wrap gap-2 pt-1">
            {draft ? (
              <Button size="sm" onClick={() => openSchedule(m)} className="gap-1">
                <Send className="h-3.5 w-3.5" />Jadwalkan
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openSchedule(m)} className="gap-1">
                <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => startEdit(m)}>
              <Pencil className="h-3 w-3 mr-1" />Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => deleteMaterial(m.id)}>
              <Trash2 className="h-3 w-3 mr-1 text-destructive" />Hapus
            </Button>
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
            <EmptyDescription>Buat {emptyType} terlebih dahulu, lalu jadwalkan ke siswa.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onCreateClick}><Plus className="h-4 w-4 mr-2" />Buat {emptyType === "materi" ? "Materi" : "Soal"}</Button>
          </EmptyContent>
        </Empty>
      );
    }
    if (filtered.length === 0) {
      return <div className="text-center py-12 text-sm text-muted-foreground">Tidak ada yang cocok dengan filter.</div>;
    }
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
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((m) => <MaterialCard key={m.id} m={m} />)}
                  </div>
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
      {/* Filters */}
      {myMaterials.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterSubject} onValueChange={(v) => { setFilterSubject(v); setFilterBab("all"); }}>
            <SelectTrigger className="w-44">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Mapel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Mapel</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {babs.length > 0 && (
            <Select value={filterBab} onValueChange={setFilterBab}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Bab" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bab</SelectItem>
                {babs.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Tabs: Materi | Soal */}
      <Tabs defaultValue="materi">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <TabsList>
            <TabsTrigger value="materi" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />Materi ({materiList.length})
            </TabsTrigger>
            <TabsTrigger value="soal" className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" />Soal ({soalList.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button onClick={() => startCreate("materi")} size="sm" data-testid="button-new-material">
              <Plus className="h-4 w-4 mr-1" />Materi Baru
            </Button>
            <Button onClick={() => startCreate("soal")} size="sm" variant="outline" data-testid="button-new-soal">
              <Plus className="h-4 w-4 mr-1" />Soal Baru
            </Button>
          </div>
        </div>

        <TabsContent value="materi">
          <GroupedList
            list={materiList}
            emptyType="materi"
            onCreateClick={() => startCreate("materi")}
          />
        </TabsContent>

        <TabsContent value="soal">
          <GroupedList
            list={soalList}
            emptyType="soal/latihan"
            onCreateClick={() => startCreate("soal")}
          />
        </TabsContent>
      </Tabs>

      <MaterialDialog
        open={open}
        onOpenChange={setOpen}
        editing={editingMaterial}
        materialType={newMaterialType}
        teacherId={user!.id}
        onCreated={(m) => setScheduleTarget(m)}
      />

      {scheduleTarget && (
        <ScheduleDialog
          open={!!scheduleTarget}
          onOpenChange={(o) => { if (!o) setScheduleTarget(null); }}
          itemTitle={scheduleTarget.title}
          itemId={scheduleTarget.id}
          currentAssigned={scheduleTarget.assignedTo}
          students={myStudents}
          onConfirm={(ids) => onScheduled(scheduleTarget.id, ids)}
        />
      )}
    </div>
  );
}

// ── Schedule Dialog ────────────────────────────────────────────────────────────
export function ScheduleDialog({
  open, onOpenChange, itemTitle, itemId: _itemId, currentAssigned, students, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemTitle: string;
  itemId: string;
  currentAssigned: string[];
  students: User[];
  onConfirm: (studentIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssigned));
  const [mode, setMode] = useState<"kelas" | "siswa">("kelas");

  useMemo(() => {
    if (open) { setSelected(new Set(currentAssigned)); setMode("kelas"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const classGroups = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const s of students) {
      const k = s.kelas ?? "(Tanpa Kelas)";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  function isClassChecked(kelas: string) {
    const ids = classGroups.find(([k]) => k === kelas)?.[1].map((s) => s.id) ?? [];
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }
  function isClassIndeterminate(kelas: string) {
    const ids = classGroups.find(([k]) => k === kelas)?.[1].map((s) => s.id) ?? [];
    return ids.some((id) => selected.has(id)) && !ids.every((id) => selected.has(id));
  }
  function toggleClass(kelas: string, checked: boolean) {
    const ids = classGroups.find(([k]) => k === kelas)?.[1].map((s) => s.id) ?? [];
    setSelected((prev) => { const n = new Set(prev); checked ? ids.forEach((id) => n.add(id)) : ids.forEach((id) => n.delete(id)); return n; });
  }
  function toggleStudent(id: string, checked: boolean) {
    setSelected((prev) => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  }

  function confirm() { onConfirm([...selected]); onOpenChange(false); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />Jadwalkan
          </DialogTitle>
          <p className="text-sm text-muted-foreground line-clamp-1">"{itemTitle}"</p>
        </DialogHeader>
        <div className="space-y-4">
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
          <Button onClick={confirm} className="gap-1"><Send className="h-4 w-4" />Jadwalkan ke {selected.size} Siswa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Material Dialog ────────────────────────────────────────────────────────────
function MaterialDialog({
  open, onOpenChange, editing, materialType, teacherId, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Material | null;
  materialType: "materi" | "soal";
  teacherId: string;
  onCreated?: (m: Material) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [bab, setBab] = useState("");
  const [timerMinutes, setTimerMinutes] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFileName, setVideoFileName] = useState("");
  const [videoDataUrl, setVideoDataUrl] = useState("");
  const [videoTab, setVideoTab] = useState<"link" | "upload">("link");
  const [mediaTab, setMediaTab] = useState<"pdf" | "image" | "video">("pdf");

  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDescription(editing?.description ?? "");
      setContent(editing?.content ?? "");
      setSubject(editing?.subject ?? "");
      setBab(editing?.bab ?? "");
      setTimerMinutes(editing?.timerMinutes ? String(editing.timerMinutes) : "");
      setFileName(editing?.fileName ?? "");
      setFileDataUrl(editing?.fileDataUrl ?? "");
      setImageDataUrl(editing?.imageDataUrl ?? "");
      setVideoUrl(editing?.videoUrl ?? "");
      setVideoFileName(editing?.videoFileName ?? "");
      setVideoDataUrl(editing?.videoDataUrl ?? "");
      setVideoTab(editing?.videoDataUrl ? "upload" : "link");
      setMediaTab("pdf");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { setFileName(f.name); setFileDataUrl(r.result as string); }; r.readAsDataURL(f);
  }
  function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setImageDataUrl(r.result as string); r.readAsDataURL(f);
  }
  function onVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { setVideoFileName(f.name); setVideoDataUrl(r.result as string); }; r.readAsDataURL(f);
  }

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
      createdBy: existing?.createdBy ?? teacherId,
      assignedTo: existing?.assignedTo ?? [],
      status: existing?.status ?? "draft",
      createdAt: existing?.createdAt ?? Date.now(),
      materialType,
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
          {!editing && (
            <p className="text-sm text-muted-foreground">Isi konten, lalu jadwalkan ke siswa setelah disimpan.</p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Judul <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Judul ${typeLabel.toLowerCase()}`} data-testid="input-material-title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Mata Pelajaran</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematika" /></div>
            <div><Label>Bab / Topik</Label><Input value={bab} onChange={(e) => setBab(e.target.value)} placeholder="Bab 1 – Bilangan" /></div>
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ringkasan singkat" />
          </div>
          <div>
            <Label>Konten {materialType === "soal" ? "(soal / pertanyaan, boleh markdown)" : "(materi, boleh markdown)"}</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder={materialType === "soal" ? "Tulis soal-soal latihan di sini...\n\n1. ..." : "Tulis isi materi di sini..."} data-testid="input-material-content" />
          </div>
          {/* Media */}
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
                {fileName && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" />{fileName}
                    <button onClick={() => { setFileName(""); setFileDataUrl(""); }} className="ml-2 text-destructive underline">hapus</button>
                  </div>
                )}
              </div>
            )}
            {mediaTab === "image" && (
              <div>
                <Input type="file" accept="image/*" onChange={onImageFile} />
                {imageDataUrl ? (
                  <div className="mt-2">
                    <img src={imageDataUrl} alt="preview" className="h-32 w-full object-cover rounded-md border" />
                    <button onClick={() => setImageDataUrl("")} className="text-xs text-destructive underline mt-1">hapus</button>
                  </div>
                ) : <p className="text-xs text-muted-foreground mt-1">Format: JPG, PNG, WebP.</p>}
              </div>
            )}
            {mediaTab === "video" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={videoTab === "link" ? "default" : "outline"} onClick={() => setVideoTab("link")}><LinkIcon className="h-3 w-3 mr-1" />Link Video</Button>
                  <Button type="button" size="sm" variant={videoTab === "upload" ? "default" : "outline"} onClick={() => setVideoTab("upload")}><Video className="h-3 w-3 mr-1" />Upload Video</Button>
                </div>
                {videoTab === "link" ? (
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                ) : (
                  <div>
                    <Input type="file" accept="video/*" onChange={onVideoFile} />
                    {videoFileName && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Video className="h-3 w-3" />{videoFileName}<button onClick={() => { setVideoFileName(""); setVideoDataUrl(""); }} className="ml-1 text-destructive underline">hapus</button></div>}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <Label>Timer belajar (menit, opsional)</Label>
            <Input type="number" min="1" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} placeholder="contoh: 30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} data-testid="button-save-material">{editing ? "Simpan Perubahan" : "Simpan Draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
