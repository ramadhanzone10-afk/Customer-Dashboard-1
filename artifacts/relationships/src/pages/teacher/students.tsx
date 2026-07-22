import { useEffect, useMemo, useState } from "react";
import {
  Search,
  UserPlus,
  Phone,
  GraduationCap,
  Trash2,
  Settings,
  Plus,
  X,
  Users,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Clock,
  Megaphone,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, useAuth } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import { mcApi } from "@/lib/api-client";
import type {
  User,
  Material,
  MaterialProgress,
  Exam,
  ExamSubmission,
  Payment,
  AppNotification,
} from "@/lib/types";
import { formatRelative } from "@/lib/format";

const AVATAR_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

const NO_KELAS = "__no_kelas__";

export default function TeacherStudents() {
  const users = useStore<User[]>("users", []);
  const classes = useStore<string[]>("classes", []);
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [classMgrOpen, setClassMgrOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<User | null>(null);
  const [resetPwStudent, setResetPwStudent] = useState<User | null>(null);

  function exportCSV() {
    const headers = ["Nama", "Email", "Kelas", "Status", "No HP"];
    const rows = allStudents.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.email.replace(/"/g, '""')}"`,
      `"${(s.kelas ?? "-").replace(/"/g, '""')}"`,
      s.status === "active" ? "Aktif" : "Tidak Aktif",
      `"${(s.phone ?? "-").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `siswa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.status !== "pending" && u.teacherId === user?.id),
    [users, user],
  );

  const pendingStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.status === "pending" && u.teacherId === user?.id),
    [users, user],
  );

  const filteredStudents = useMemo(
    () =>
      allStudents
        .filter((u) =>
          search
            ? u.name.toLowerCase().includes(search.toLowerCase()) ||
              (u.kelas ?? "").toLowerCase().includes(search.toLowerCase())
            : true,
        )
        .filter((u) =>
          classFilter === "all"
            ? true
            : classFilter === NO_KELAS
              ? !u.kelas
              : u.kelas === classFilter,
        ),
    [allStudents, search, classFilter],
  );

  // Group filtered students by class
  const grouped = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const c of classes) map.set(c, []);
    for (const s of filteredStudents) {
      const k = s.kelas && classes.includes(s.kelas) ? s.kelas : NO_KELAS;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).filter(([, list]) => list.length > 0);
  }, [filteredStudents, classes]);

  function studentStats(uid: string) {
    const assignedMats = materials.filter((m) => m.assignedTo.includes(uid));
    const completed = progress.filter((p) => p.userId === uid).length;
    const matPct =
      assignedMats.length === 0 ? 0 : Math.round((completed / assignedMats.length) * 100);

    const mySubs = submissions.filter((s) => s.userId === uid && s.fullyGraded);
    const avg =
      mySubs.length === 0
        ? null
        : Math.round(
            mySubs.reduce((acc, s) => acc + (s.totalScore / s.maxScore) * 100, 0) /
              mySubs.length,
          );

    const assignedExams = exams.filter((e) => e.assignedTo.includes(uid));
    const completedExams = submissions.filter((s) => s.userId === uid).length;
    const examPct =
      assignedExams.length === 0
        ? 0
        : Math.round((completedExams / assignedExams.length) * 100);

    return { matPct, avg, examPct, assignedMats, completed, mySubs, assignedExams };
  }

  async function approveAllStudents() {
    if (!confirm(`Setujui semua ${pendingStudents.length} siswa sekaligus?`)) return;
    for (const s of pendingStudents) {
      await approveStudent(s);
    }
  }

  async function approveStudent(s: User) {
    // Update status locally
    const allUsers = read("users", []);
    write("users", allUsers.map((u) => u.id === s.id ? { ...u, status: "active" as const } : u));

    // Create payment for current month
    const month = new Date().toISOString().slice(0, 7);
    const newPayment: Payment = { id: uid("p_"), userId: s.id, month, amount: 350000, status: "unpaid" };
    write("payments", [...read("payments", []), newPayment]);

    // Welcome notification
    const notif: AppNotification = {
      id: uid("n_"), userId: s.id, type: "payment_due",
      title: "Akun Disetujui! 🎉",
      message: "Selamat datang di Math Core! Akun Anda telah disetujui oleh guru. Silakan mulai belajar.",
      read: false, createdAt: Date.now(),
    };
    write("notifications", [...read("notifications", []), notif]);

    // Sync to backend
    void mcApi.approveUser(s.id).catch(() => {});
    void mcApi.createPayment(newPayment).catch(() => {});
    void mcApi.createNotification(notif).catch(() => {});
  }

  function rejectStudent(s: User) {
    if (!confirm(`Tolak pendaftaran "${s.name}"?\nAkun akan dihapus permanen.`)) return;
    const allUsers = read("users", []);
    write("users", allUsers.filter((u) => u.id !== s.id));
    void mcApi.deleteUser(s.id).catch(() => {});
  }

  function deleteStudent(s: User) {
    if (
      !confirm(
        `Hapus siswa "${s.name}"? Semua data terkait (materi, ujian, pembayaran) juga akan dihapus.`,
      )
    )
      return;
    const allUsers = read("users", []);
    write("users", allUsers.filter((u) => u.id !== s.id));
    void mcApi.deleteUser(s.id).catch(() => {});

    // Remove student from materials assignedTo and sync to API
    const allMats = read("materials", []);
    const updatedMats = allMats.map((m) => ({ ...m, assignedTo: m.assignedTo.filter((id) => id !== s.id) }));
    write("materials", updatedMats);
    const affectedMats = updatedMats.filter((_, i) => allMats[i].assignedTo.includes(s.id));
    void Promise.all(affectedMats.map((m) => mcApi.updateMaterial(m.id, { assignedTo: m.assignedTo }).catch(() => {}))).catch(() => {});

    // Remove student from exams assignedTo and sync to API
    const allExams = read("exams", []);
    const updatedExams = allExams.map((e) => ({ ...e, assignedTo: e.assignedTo.filter((id) => id !== s.id) }));
    write("exams", updatedExams);
    const affectedExams = updatedExams.filter((_, i) => allExams[i].assignedTo.includes(s.id));
    void Promise.all(affectedExams.map((e) => mcApi.updateExam(e.id, { assignedTo: e.assignedTo }).catch(() => {}))).catch(() => {});

    write(
      "materialProgress",
      read("materialProgress", []).filter((p) => p.userId !== s.id),
    );
    write(
      "examSubmissions",
      read("examSubmissions", []).filter((sub) => sub.userId !== s.id),
    );
    write(
      "payments",
      read("payments", []).filter((p) => p.userId !== s.id),
    );
    write(
      "notifications",
      read("notifications", []).filter((n) => n.userId !== s.id),
    );
    setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-students"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-class-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kelas</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
            <SelectItem value={NO_KELAS}>Tanpa kelas</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filteredStudents.length} siswa</Badge>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={() => setAnnouncementOpen(true)}
          data-testid="button-announcement"
        >
          <Megaphone className="h-4 w-4 mr-2" />
          Pengumuman
        </Button>
        <Button
          variant="outline"
          onClick={() => setClassMgrOpen(true)}
          data-testid="button-manage-classes"
        >
          <Settings className="h-4 w-4 mr-2" />
          Kelola Kelas
        </Button>
        <Button
          variant="outline"
          onClick={exportCSV}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => setImportOpen(true)}
          data-testid="button-import-excel"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Import Excel
        </Button>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-student">
          <UserPlus className="h-4 w-4 mr-2" />
          Tambah Siswa
        </Button>
      </div>

      {/* ── Pending approval section ── */}
      {pendingStudents.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-base font-semibold text-amber-700 dark:text-amber-400">
                  Menunggu Persetujuan
                </h2>
                <Badge className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40">
                  {pendingStudents.length} siswa
                </Badge>
              </div>
              {pendingStudents.length > 1 && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white h-8 shrink-0"
                  onClick={() => void approveAllStudents()}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Setujui Semua
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {pendingStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 bg-white dark:bg-background rounded-lg p-3 border border-amber-100 dark:border-amber-900"
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm"
                    style={{ background: s.avatarColor ?? "#f59e0b" }}
                  >
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                    {(s.kelas || s.phone) && (
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                        {s.kelas && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />{s.kelas}
                          </span>
                        )}
                        {s.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{s.phone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white h-8"
                      onClick={() => void approveStudent(s)}
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1" />
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive border-destructive/30 h-8"
                      onClick={() => rejectStudent(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Tolak
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {grouped.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
          Belum ada siswa yang cocok. Klik "Tambah Siswa" untuk menambahkan.
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([className, list]) => (
          <section key={className}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">
                {className === NO_KELAS ? "Tanpa Kelas" : `Kelas ${className}`}
              </h2>
              <Badge variant="outline">{list.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => {
                const st = studentStats(s.id);
                return (
                  <Card
                    key={s.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelected(s)}
                    data-testid={`student-card-${s.id}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ background: s.avatarColor ?? "#6366f1" }}
                        >
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.email}
                          </div>
                        </div>
                      </div>
                      {(s.kelas || s.phone) && (
                        <div className="flex flex-wrap gap-2 mb-3 text-xs">
                          {s.kelas && (
                            <Badge variant="outline" className="gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {s.kelas}
                            </Badge>
                          )}
                          {s.phone && (
                            <Badge variant="outline" className="gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Materi selesai</span>
                            <span className="font-medium">{st.matPct}%</span>
                          </div>
                          <Progress value={st.matPct} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Ujian dikerjakan</span>
                            <span className="font-medium">{st.examPct}%</span>
                          </div>
                          <Progress value={st.examPct} className="h-2" />
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            Rata-rata nilai
                          </span>
                          <Badge variant={st.avg && st.avg >= 70 ? "default" : "secondary"}>
                            {st.avg !== null ? `${st.avg}/100` : "-"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (() => {
            const st = studentStats(selected.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ background: selected.avatarColor ?? "#6366f1" }}
                    >
                      {selected.name.charAt(0)}
                    </div>
                    {selected.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Email</div>
                      <div className="font-medium truncate">{selected.email}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Kelas</div>
                      <div className="font-medium">{selected.kelas ?? "-"}</div>
                    </div>
                    <div className="border rounded-md p-3 col-span-2">
                      <div className="text-xs text-muted-foreground">Nomor HP</div>
                      <div className="font-medium">{selected.phone ?? "-"}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Materi ({st.completed}/{st.assignedMats.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {st.assignedMats.map((m) => {
                        const done = progress.find(
                          (p) => p.userId === selected.id && p.materialId === m.id,
                        );
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent"
                          >
                            <span className="truncate">{m.title}</span>
                            {done ? (
                              <Badge variant="default" className="ml-2">
                                Selesai
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="ml-2">
                                Belum
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                      {st.assignedMats.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          Belum ada materi.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Riwayat Ujian ({st.mySubs.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {st.mySubs.map((s) => {
                        const exam = exams.find((e) => e.id === s.examId);
                        const pct = Math.round((s.totalScore / s.maxScore) * 100);
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent"
                          >
                            <div>
                              <div>{exam?.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatRelative(s.submittedAt)}
                              </div>
                            </div>
                            <Badge variant={pct >= 70 ? "default" : "secondary"}>
                              {pct}/100
                            </Badge>
                          </div>
                        );
                      })}
                      {st.mySubs.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          Belum ada ujian dikoreksi.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                  <Button
                    variant="outline"
                    onClick={() => deleteStudent(selected)}
                    data-testid={`button-delete-student-${selected.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    Hapus Siswa
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setSelected(null); setResetPwStudent(selected); }}
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Reset Password
                    </Button>
                    <Button
                      onClick={() => { setSelected(null); setEditStudent(selected); }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Data
                    </Button>
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AddStudentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        classes={classes}
        teacherId={user?.id ?? ""}
      />
      <ClassManagerDialog
        open={classMgrOpen}
        onOpenChange={setClassMgrOpen}
        classes={classes}
        students={allStudents}
      />
      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        classes={classes}
        teacherId={user?.id ?? ""}
      />
      <EditStudentDialog
        student={editStudent}
        onClose={() => setEditStudent(null)}
        classes={classes}
      />
      <ResetPasswordDialog
        student={resetPwStudent}
        onClose={() => setResetPwStudent(null)}
      />
      <AnnouncementDialog
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        classes={classes}
        students={allStudents}
      />
    </div>
  );
}

function AddStudentDialog({
  open,
  onOpenChange,
  classes,
  teacherId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classes: string[];
  teacherId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("siswa123");
  const [kelas, setKelas] = useState("");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [enrollAll, setEnrollAll] = useState(true);

  function reset() {
    setName("");
    setEmail("");
    setPassword("siswa123");
    setKelas("");
    setPhone("");
    setColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
    setEnrollAll(true);
  }

  function save() {
    if (!name.trim()) return alert("Nama siswa wajib diisi.");
    if (!email.trim() || !email.includes("@"))
      return alert("Email tidak valid.");
    if (password.length < 6)
      return alert("Password minimal 6 karakter.");

    const allUsers = read("users", []);
    if (allUsers.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return alert("Email sudah terdaftar.");
    }

    const newStudent: User = {
      id: uid("u_"),
      name: name.trim(),
      email: email.trim(),
      password,
      role: "student",
      avatarColor: color,
      kelas: kelas.trim() || undefined,
      phone: phone.trim() || undefined,
      teacherId: teacherId || undefined,
    };
    write("users", [...allUsers, newStudent]);
    void mcApi.createUser(newStudent).catch(() => {});

    if (enrollAll) {
      const mats: Material[] = read("materials", []);
      const updatedMats = mats.map((m) => ({ ...m, assignedTo: [...m.assignedTo, newStudent.id] }));
      write("materials", updatedMats);
      void Promise.all(updatedMats.map((m) => mcApi.updateMaterial(m.id, { assignedTo: m.assignedTo }).catch(() => {}))).catch(() => {});

      const exs: Exam[] = read("exams", []);
      const updatedExs = exs.map((e) =>
        e.deadline > Date.now() ? { ...e, assignedTo: [...e.assignedTo, newStudent.id] } : e,
      );
      write("exams", updatedExs);
      const activeExs = updatedExs.filter((e) => e.deadline > Date.now());
      void Promise.all(activeExs.map((e) => mcApi.updateExam(e.id, { assignedTo: e.assignedTo }).catch(() => {}))).catch(() => {});
    }

    // Auto-create payment for current month
    const d = new Date();
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const newPayment = { id: uid("p_"), userId: newStudent.id, month, amount: 350000, status: "unpaid" as const };
    const payments: Payment[] = read("payments", []);
    write("payments", [...payments, newPayment]);
    void mcApi.createPayment(newPayment).catch(() => {});

    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Siswa Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nama lengkap *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Budi Santoso"
              data-testid="input-new-student-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siswa@mathcore.id"
                data-testid="input-new-student-email"
              />
            </div>
            <div>
              <Label>Password *</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                data-testid="input-new-student-password"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kelas</Label>
              <Select
                value={kelas || "__none__"}
                onValueChange={(v) => setKelas(v === "__none__" ? "" : v)}
              >
                <SelectTrigger data-testid="select-new-student-kelas">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Tanpa kelas —</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nomor HP</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                data-testid="input-new-student-phone"
              />
            </div>
          </div>
          <div>
            <Label>Warna avatar</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={
                    "h-8 w-8 rounded-full border-2 transition-all " +
                    (color === c ? "border-foreground scale-110" : "border-transparent")
                  }
                  style={{ background: c }}
                  data-testid={`color-${c}`}
                  aria-label={`Warna ${c}`}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-2 border-t">
            <input
              type="checkbox"
              checked={enrollAll}
              onChange={(e) => setEnrollAll(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-enroll-all"
            />
            Daftarkan otomatis ke semua materi & ujian aktif
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save} data-testid="button-save-new-student">
            <UserPlus className="h-4 w-4 mr-2" />
            Tambah Siswa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClassManagerDialog({
  open,
  onOpenChange,
  classes,
  students,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classes: string[];
  students: User[];
}) {
  const [newClass, setNewClass] = useState("");

  function addClass() {
    const name = newClass.trim();
    if (!name) return;
    if (classes.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return alert("Kelas dengan nama itu sudah ada.");
    }
    const next = [...classes, name];
    write("classes", next);
    void mcApi.updateClasses(next).catch(() => {});
    setNewClass("");
  }

  function removeClass(name: string) {
    const inUse = students.filter((s) => s.kelas === name).length;
    const msg =
      inUse > 0
        ? `Kelas "${name}" digunakan oleh ${inUse} siswa. Hapus tetap? Siswa akan menjadi tanpa kelas.`
        : `Hapus kelas "${name}"?`;
    if (!confirm(msg)) return;
    const nextClasses = classes.filter((c) => c !== name);
    write("classes", nextClasses);
    void mcApi.updateClasses(nextClasses).catch(() => {});
    if (inUse > 0) {
      const all = read("users", []);
      write(
        "users",
        all.map((u) => (u.kelas === name ? { ...u, kelas: undefined } : u)),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola Daftar Kelas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              placeholder="Nama kelas baru, mis. 10 IPS 1"
              onKeyDown={(e) => e.key === "Enter" && addClass()}
              data-testid="input-new-class"
            />
            <Button onClick={addClass} data-testid="button-add-class">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
            {classes.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Belum ada kelas. Tambahkan satu di atas.
              </div>
            )}
            {classes.map((c) => {
              const count = students.filter((s) => s.kelas === c).length;
              return (
                <div
                  key={c}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{c}</span>
                    <Badge variant="outline" className="ml-1">
                      {count} siswa
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClass(c)}
                    data-testid={`button-remove-class-${c}`}
                    className="h-7 w-7"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStudentDialog({
  student,
  onClose,
  classes,
}: {
  student: User | null;
  onClose: () => void;
  classes: string[];
}) {
  const [name, setName] = useState("");
  const [kelas, setKelas] = useState("");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setKelas(student.kelas ?? "");
      setPhone(student.phone ?? "");
      setColor(student.avatarColor ?? AVATAR_COLORS[0]);
    }
  }, [student]);

  function save() {
    if (!name.trim()) { alert("Nama tidak boleh kosong."); return; }
    const all = read("users", []);
    const updates = { name: name.trim(), kelas: kelas.trim() || null, phone: phone.trim() || null, avatarColor: color };
    write("users", all.map((u) =>
      u.id === student!.id
        ? { ...u, ...updates, kelas: updates.kelas ?? undefined, phone: updates.phone ?? undefined }
        : u,
    ));
    void mcApi.updateUser(student!.id, updates).catch(() => {});
    onClose();
  }

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit Data Siswa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nama lengkap *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="contoh: Budi Santoso" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kelas</Label>
              <Select value={kelas || "__none__"} onValueChange={(v) => setKelas(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Tanpa kelas —</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nomor HP</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={student?.email ?? ""} disabled className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Email tidak dapat diubah.</p>
          </div>
          <div>
            <Label>Warna avatar</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={"h-8 w-8 rounded-full border-2 transition-all " + (color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: c }}
                  aria-label={`Warna ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save}>
            <Pencil className="h-4 w-4 mr-2" />
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  student,
  onClose,
}: {
  student: User | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("siswa123");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (student) { setPassword("siswa123"); setDone(false); }
  }, [student]);

  function save() {
    if (password.length < 6) { alert("Password minimal 6 karakter."); return; }
    const all = read("users", []);
    write("users", all.map((u) =>
      u.id === student!.id ? { ...u, password } : u,
    ));
    void mcApi.updateUser(student!.id, { password }).catch(() => {});
    setDone(true);
  }

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Reset Password Siswa
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <p className="font-semibold">Password berhasil diubah!</p>
            <p className="text-sm text-muted-foreground">
              Password baru untuk <span className="font-medium">{student?.name}</span>:
            </p>
            <code className="block text-base font-mono bg-muted px-3 py-2 rounded text-center">
              {password}
            </code>
            <Button className="mt-2 w-full" onClick={onClose}>Selesai</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Atur password baru untuk <span className="font-semibold text-foreground">{student?.name}</span>.
              </p>
              <div>
                <Label>Password baru</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setPassword("siswa123")}
              >
                Gunakan default (siswa123)
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Batal</Button>
              <Button onClick={save}>
                <KeyRound className="h-4 w-4 mr-2" />
                Reset Password
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ImportRow {
  nama: string;
  kelas: string;
  hp: string;
  email: string;
  status: "ok" | "duplicate" | "no_name";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}

function generateEmail(name: string, existing: string[]): string {
  const base = slugify(name) || "siswa";
  let email = `${base}@mathcore.id`;
  let i = 2;
  while (existing.includes(email)) {
    email = `${base}${i}@mathcore.id`;
    i++;
  }
  return email;
}

function downloadTemplate() {
  const rows = [
    ["NO.", "NAMA LENGKAP", "KELAS", "NO. HP"],
    ["1", "Budi Santoso", "X-1", "081234567890"],
    ["2", "Siti Rahayu", "X-2", "081298765432"],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_siswa.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ImportExcelDialog({
  open,
  onOpenChange,
  classes,
  teacherId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classes: string[];
  teacherId: string;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [done, setDone] = useState(false);
  const [enrollAll, setEnrollAll] = useState(true);

  function reset() {
    setRows([]);
    setDone(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { read: xlsxRead, utils } = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = xlsxRead(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, string>[] = utils.sheet_to_json(ws, {
      defval: "",
      raw: false,
    });

    const existingEmails = read("users", []).map((u) => u.email.toLowerCase());
    const usedInBatch: string[] = [];

    const parsed: ImportRow[] = raw.map((r) => {
      const nama = String(
        r["NAMA LENGKAP"] ?? r["Nama Lengkap"] ?? r["nama lengkap"] ??
        r["NAMA"] ?? r["Nama"] ?? r["nama"] ?? r["name"] ?? "",
      ).trim();
      const kelas = String(
        r["KELAS"] ?? r["Kelas"] ?? r["kelas"] ?? r["class"] ?? "",
      ).trim();
      const hp = String(
        r["NO. HP"] ?? r["No. HP"] ?? r["no. hp"] ?? r["NO HP"] ?? r["No HP"] ??
        r["HP"] ?? r["hp"] ?? r["phone"] ?? r["Phone"] ?? r["nomor hp"] ?? r["Nomor HP"] ?? "",
      ).trim();

      if (!nama) return { nama, kelas, hp, email: "", status: "no_name" as const };

      const email = generateEmail(nama, [...existingEmails, ...usedInBatch]);
      usedInBatch.push(email);
      const isDup = existingEmails.includes(email);
      return { nama, kelas, hp, email, status: isDup ? "duplicate" as const : "ok" as const };
    });

    setRows(parsed);
    e.target.value = "";
  }

  function importAll() {
    const valid = rows.filter((r) => r.status === "ok" && r.nama);
    if (valid.length === 0) { alert("Tidak ada data valid untuk diimpor."); return; }

    const allUsers = read("users", []);
    const month = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const newStudents: User[] = valid.map((r) => ({
      id: uid("u_"),
      name: r.nama,
      email: r.email,
      password: "siswa123",
      role: "student" as const,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      kelas: r.kelas || undefined,
      phone: r.hp || undefined,
      teacherId: teacherId || undefined,
    }));

    write("users", [...allUsers, ...newStudents]);
    void Promise.all(newStudents.map((s) => mcApi.createUser(s).catch(() => {}))).catch(() => {});

    const newPayments = newStudents.map((s) => ({ id: uid("p_"), userId: s.id, month, amount: 350000, status: "unpaid" as const }));
    const payments: Payment[] = read("payments", []);
    write("payments", [...payments, ...newPayments]);
    void mcApi.createPaymentsBatch(newPayments).catch(() => {});

    if (enrollAll) {
      const newIds = newStudents.map((s) => s.id);
      const mats: Material[] = read("materials", []);
      const updatedMats = mats.map((m) => ({ ...m, assignedTo: [...m.assignedTo, ...newIds] }));
      write("materials", updatedMats);
      void Promise.all(updatedMats.map((m) => mcApi.updateMaterial(m.id, { assignedTo: m.assignedTo }).catch(() => {}))).catch(() => {});

      const exs: Exam[] = read("exams", []);
      const updatedExs = exs.map((e) =>
        e.deadline > Date.now() ? { ...e, assignedTo: [...e.assignedTo, ...newIds] } : e,
      );
      write("exams", updatedExs);
      const activeExs = updatedExs.filter((e) => e.deadline > Date.now());
      void Promise.all(activeExs.map((e) => mcApi.updateExam(e.id, { assignedTo: e.assignedTo }).catch(() => {}))).catch(() => {});
    }

    setDone(true);
  }

  const validCount = rows.filter((r) => r.status === "ok").length;
  const skipCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Siswa dari Excel / CSV
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <div className="font-semibold text-lg">
              {validCount} siswa berhasil diimpor!
            </div>
            <div className="text-sm text-muted-foreground">
              Password default semua siswa: <code className="font-mono bg-muted px-1 rounded">siswa123</code>
            </div>
            <Button className="mt-4" onClick={() => { reset(); onOpenChange(false); }}>
              Selesai
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Format file yang dibutuhkan:</p>
              <p className="text-muted-foreground">
                File Excel (.xlsx, .xls) atau CSV dengan kolom:
                <code className="mx-1 bg-background px-1 rounded border">NO.</code>
                <code className="mx-1 bg-background px-1 rounded border">NAMA LENGKAP</code>
                <code className="mx-1 bg-background px-1 rounded border">KELAS</code>
                <code className="mx-1 bg-background px-1 rounded border">NO. HP</code>
              </p>
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-3 w-3 mr-1" />
                Download Template CSV
              </Button>
            </div>

            <div>
              <Label>Pilih file Excel atau CSV</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFile}
                className="mt-1"
                data-testid="input-import-file"
              />
            </div>

            {rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    {validCount} siap diimpor
                  </span>
                  {skipCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {skipCount} dilewati
                    </span>
                  )}
                </div>

                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 font-medium">Nama</th>
                        <th className="text-left p-2 font-medium">Kelas</th>
                        <th className="text-left p-2 font-medium">HP</th>
                        <th className="text-left p-2 font-medium">Email (otomatis)</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((r, i) => (
                        <tr key={i} className={r.status !== "ok" ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                          <td className="p-2">{r.nama || <span className="text-muted-foreground italic">kosong</span>}</td>
                          <td className="p-2 text-muted-foreground">{r.kelas || "-"}</td>
                          <td className="p-2 text-muted-foreground">{r.hp || "-"}</td>
                          <td className="p-2 font-mono text-xs">{r.email || "-"}</td>
                          <td className="p-2">
                            {r.status === "ok" && <Badge className="text-xs">OK</Badge>}
                            {r.status === "duplicate" && <Badge variant="secondary" className="text-xs">Duplikat</Badge>}
                            {r.status === "no_name" && <Badge variant="destructive" className="text-xs">Nama kosong</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={enrollAll}
                    onChange={(e) => setEnrollAll(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Daftarkan ke semua materi & ujian aktif
                </label>
              </div>
            )}
          </div>
        )}

        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Batal
            </Button>
            {rows.length > 0 && validCount > 0 && (
              <Button onClick={importAll} data-testid="button-confirm-import">
                <UserPlus className="h-4 w-4 mr-2" />
                Import {validCount} Siswa
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementDialog({
  open,
  onOpenChange,
  classes,
  students,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classes: string[];
  students: User[];
}) {
  const [targetClass, setTargetClass] = useState("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const recipients = useMemo(() => {
    if (targetClass === "all") return students;
    if (targetClass === "__no_kelas__") return students.filter((s) => !s.kelas);
    return students.filter((s) => s.kelas === targetClass);
  }, [students, targetClass]);

  function reset() {
    setTargetClass("all");
    setTitle("");
    setMessage("");
    setSending(false);
    setSent(false);
  }

  async function handleSend() {
    if (!title.trim() || !message.trim() || recipients.length === 0) return;
    setSending(true);
    const now = Date.now();
    const notifs: AppNotification[] = recipients.map((s) => ({
      id: uid("n_"),
      userId: s.id,
      type: "announcement" as const,
      title: title.trim(),
      message: message.trim(),
      read: false,
      createdAt: now,
    }));

    write("notifications", [...read("notifications", []), ...notifs]);

    try {
      await mcApi.createNotificationsBatch(notifs);
    } catch {
      // fire-and-forget
    }

    setSending(false);
    setSent(true);
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Kirim Pengumuman
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-8 space-y-3">
            <div className="text-5xl">📢</div>
            <div className="font-semibold text-lg">Pengumuman Terkirim!</div>
            <div className="text-sm text-muted-foreground">
              {recipients.length} siswa Anda telah menerima notifikasi.
            </div>
            <Button className="mt-2" onClick={() => { reset(); onOpenChange(false); }}>
              Tutup
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
              <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Pengumuman hanya dikirim ke <strong>{students.length} siswa</strong> yang terhubung dengan Anda. Siswa dari guru lain tidak akan menerima.
              </span>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Belum ada siswa yang terhubung dengan Anda.
              </div>
            ) : (
            <div className="space-y-2">
              <Label>Kirim ke</Label>
              <Select value={targetClass} onValueChange={setTargetClass}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Semua Siswa Saya ({students.length} orang)
                  </SelectItem>
                  {classes.map((c) => {
                    const count = students.filter((s) => s.kelas === c).length;
                    if (count === 0) return null;
                    return (
                      <SelectItem key={c} value={c}>
                        Kelas {c} ({count} orang)
                      </SelectItem>
                    );
                  })}
                  {students.filter((s) => !s.kelas).length > 0 && (
                    <SelectItem value="__no_kelas__">
                      Tanpa Kelas ({students.filter((s) => !s.kelas).length} orang)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {recipients.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Akan dikirim ke{" "}
                    <span className="font-medium text-foreground">{recipients.length} siswa</span>:
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {recipients.slice(0, 20).map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 text-[11px] bg-muted rounded-full px-2 py-0.5"
                      >
                        <span
                          className="h-3 w-3 rounded-full inline-block shrink-0"
                          style={{ background: s.avatarColor ?? "#6366f1" }}
                        />
                        {s.name}
                      </span>
                    ))}
                    {recipients.length > 20 && (
                      <span className="text-[11px] text-muted-foreground px-1">
                        +{recipients.length - 20} lainnya
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ann-title">Judul Pengumuman</Label>
              <Input
                id="ann-title"
                placeholder="Contoh: Ujian Tengah Semester Minggu Depan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-msg">Isi Pengumuman</Label>
              <Textarea
                id="ann-msg"
                placeholder="Tulis isi pengumuman di sini..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/500
              </p>
            </div>
          </div>
        )}

        {!sent && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim() || recipients.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Mengirim..." : `Kirim ke ${recipients.length} Siswa`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
