import { useMemo, useState } from "react";
import { Plus, BookOpen, Clock, Users as UsersIcon, FileText, Trash2, Pencil, Video, Link as LinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  function startCreate() {
    setEditing(null);
    setOpen(true);
  }

  function startEdit(m: Material) {
    setEditing(m);
    setOpen(true);
  }

  function deleteMaterial(id: string) {
    if (!confirm("Hapus materi ini?")) return;
    write("materials", materials.filter((m) => m.id !== id));
    void mcApi.deleteMaterial(id).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Buat dan bagikan materi pembelajaran kepada siswa.
        </p>
        <Button onClick={startCreate} data-testid="button-new-material">
          <Plus className="h-4 w-4 mr-2" />
          Materi Baru
        </Button>
      </div>

      {materials.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Belum ada materi</EmptyTitle>
            <EmptyDescription>
              Mulai dengan membuat materi pertama untuk siswa Anda.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Materi
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m) => (
            <Card key={m.id} data-testid={`material-card-${m.id}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-start justify-between gap-2">
                  <span className="line-clamp-2">{m.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {m.description}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {m.timerMinutes && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {m.timerMinutes} mnt
                    </Badge>
                  )}
                  {m.fileName && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      File
                    </Badge>
                  )}
                  {(m.videoUrl || m.videoDataUrl) && (
                    <Badge variant="secondary" className="gap-1">
                      <Video className="h-3 w-3" />
                      Video
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1">
                    <UsersIcon className="h-3 w-3" />
                    {m.assignedTo.length}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Dibuat {formatDate(m.createdAt)}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(m)}
                    data-testid={`button-edit-${m.id}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMaterial(m.id)}
                    data-testid={`button-delete-${m.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1 text-destructive" />
                    Hapus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MaterialDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        teacherId={user!.id}
        students={students}
      />
    </div>
  );
}

function MaterialDialog({
  open,
  onOpenChange,
  editing,
  teacherId,
  students,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Material | null;
  teacherId: string;
  students: User[];
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [timerMinutes, setTimerMinutes] = useState<string>(
    editing?.timerMinutes ? String(editing.timerMinutes) : "",
  );
  const [assigned, setAssigned] = useState<string[]>(
    editing?.assignedTo ?? students.map((s) => s.id),
  );
  const [fileName, setFileName] = useState(editing?.fileName ?? "");
  const [fileDataUrl, setFileDataUrl] = useState(editing?.fileDataUrl ?? "");
  const [videoUrl, setVideoUrl] = useState(editing?.videoUrl ?? "");
  const [videoFileName, setVideoFileName] = useState(editing?.videoFileName ?? "");
  const [videoDataUrl, setVideoDataUrl] = useState(editing?.videoDataUrl ?? "");
  const [videoTab, setVideoTab] = useState<"link" | "upload">(
    editing?.videoDataUrl ? "upload" : "link",
  );

  // Reset state when dialog opens with new editing target
  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDescription(editing?.description ?? "");
      setContent(editing?.content ?? "");
      setTimerMinutes(editing?.timerMinutes ? String(editing.timerMinutes) : "");
      setAssigned(editing?.assignedTo ?? students.map((s) => s.id));
      setFileName(editing?.fileName ?? "");
      setFileDataUrl(editing?.fileDataUrl ?? "");
      setVideoUrl(editing?.videoUrl ?? "");
      setVideoFileName(editing?.videoFileName ?? "");
      setVideoDataUrl(editing?.videoDataUrl ?? "");
      setVideoTab(editing?.videoDataUrl ? "upload" : "link");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(f.name);
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(f);
  }

  function onVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setVideoFileName(f.name);
      setVideoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(f);
  }

  function save() {
    if (!title.trim()) {
      alert("Judul materi wajib diisi.");
      return;
    }
    const all = read("materials", []);
    const existing = all.find((m) => m.id === editing?.id);
    const m: Material = {
      id: existing?.id ?? uid("m_"),
      title: title.trim(),
      description: description.trim(),
      content,
      fileName: fileName || undefined,
      fileDataUrl: fileDataUrl || undefined,
      videoUrl: videoTab === "link" && videoUrl.trim() ? videoUrl.trim() : undefined,
      videoFileName: videoTab === "upload" && videoFileName ? videoFileName : undefined,
      videoDataUrl: videoTab === "upload" && videoDataUrl ? videoDataUrl : undefined,
      timerMinutes: timerMinutes ? parseInt(timerMinutes) : undefined,
      createdBy: existing?.createdBy ?? teacherId,
      assignedTo: assigned,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    const next = existing ? all.map((x) => (x.id === m.id ? m : x)) : [...all, m];
    write("materials", next);

    // Send notifications to newly assigned students
    if (!existing) {
      const notifs = read("notifications", []);
      const newNotifs: AppNotification[] = assigned.map((sid) => ({
        id: uid("n_"),
        userId: sid,
        type: "new_material",
        title: "Materi baru",
        message: `Materi "${m.title}" telah dibagikan.`,
        link: "/student/materials",
        createdAt: Date.now(),
        read: false,
      }));
      write("notifications", [...notifs, ...newNotifs]);
      void mcApi.createMaterial({ ...m, notifications: newNotifs }).catch(() => {});
    } else {
      void mcApi.updateMaterial(m.id, m).catch(() => {});
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Materi" : "Buat Materi Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Judul</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="contoh: Pengenalan Aljabar"
              data-testid="input-material-title"
            />
          </div>
          <div>
            <Label>Deskripsi singkat</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan materi"
              data-testid="input-material-description"
            />
          </div>
          <div>
            <Label>Isi materi (boleh markdown)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Tulis isi materi di sini..."
              data-testid="input-material-content"
            />
          </div>
          <div>
            <Label>Lampiran file (opsional)</Label>
            <Input type="file" onChange={onFile} data-testid="input-material-file" />
            {fileName && (
              <div className="text-xs text-muted-foreground mt-1">
                File terpilih: {fileName}
                {fileDataUrl && (
                  <button
                    onClick={() => { setFileName(""); setFileDataUrl(""); }}
                    className="ml-2 text-destructive underline"
                  >
                    hapus
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Video className="h-4 w-4" />
              Video pembelajaran (opsional)
            </Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                size="sm"
                variant={videoTab === "link" ? "default" : "outline"}
                onClick={() => setVideoTab("link")}
              >
                <LinkIcon className="h-3 w-3 mr-1" />
                Link Video
              </Button>
              <Button
                type="button"
                size="sm"
                variant={videoTab === "upload" ? "default" : "outline"}
                onClick={() => setVideoTab("upload")}
              >
                <Video className="h-3 w-3 mr-1" />
                Upload Video
              </Button>
            </div>
            {videoTab === "link" && (
              <div className="space-y-1">
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... atau link video lainnya"
                  data-testid="input-material-video-url"
                />
                <p className="text-xs text-muted-foreground">
                  Mendukung YouTube, Vimeo, dan link video langsung (.mp4, dll).
                </p>
              </div>
            )}
            {videoTab === "upload" && (
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={onVideoFile}
                  data-testid="input-material-video-file"
                />
                {videoFileName && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    {videoFileName}
                    <button
                      onClick={() => { setVideoFileName(""); setVideoDataUrl(""); }}
                      className="ml-1 text-destructive underline"
                    >
                      hapus
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Format: MP4, WebM, OGG. Ukuran besar mungkin lambat diupload.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label>Timer belajar (menit, opsional)</Label>
            <Input
              type="number"
              min="1"
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(e.target.value)}
              placeholder="contoh: 30"
              data-testid="input-material-timer"
            />
          </div>
          <div>
            <Label>Bagikan ke siswa</Label>
            <div className="space-y-2 mt-2 border rounded-md p-3 max-h-40 overflow-y-auto">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={assigned.includes(s.id)}
                    onCheckedChange={(c) =>
                      setAssigned((prev) =>
                        c ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                    data-testid={`checkbox-assign-${s.id}`}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save} data-testid="button-save-material">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
