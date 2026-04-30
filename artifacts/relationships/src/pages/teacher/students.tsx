import { useMemo, useState } from "react";
import { Search, UserPlus, Phone, GraduationCap, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type {
  User,
  Material,
  MaterialProgress,
  Exam,
  ExamSubmission,
  Payment,
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

export default function TeacherStudents() {
  const users = useStore<User[]>("users", []);
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const students = useMemo(
    () =>
      users
        .filter((u) => u.role === "student")
        .filter((u) =>
          search
            ? u.name.toLowerCase().includes(search.toLowerCase()) ||
              (u.kelas ?? "").toLowerCase().includes(search.toLowerCase())
            : true,
        ),
    [users, search],
  );

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

  function deleteStudent(s: User) {
    if (
      !confirm(
        `Hapus siswa "${s.name}"? Semua data terkait (materi, ujian, pembayaran) juga akan dihapus.`,
      )
    )
      return;
    const allUsers = read("users", []);
    write("users", allUsers.filter((u) => u.id !== s.id));

    const allMats = read("materials", []);
    write(
      "materials",
      allMats.map((m) => ({ ...m, assignedTo: m.assignedTo.filter((id) => id !== s.id) })),
    );
    const allExams = read("exams", []);
    write(
      "exams",
      allExams.map((e) => ({ ...e, assignedTo: e.assignedTo.filter((id) => id !== s.id) })),
    );
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
            placeholder="Cari siswa atau kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-students"
          />
        </div>
        <Badge variant="secondary">{students.length} siswa</Badge>
        <div className="flex-1" />
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-student">
          <UserPlus className="h-4 w-4 mr-2" />
          Tambah Siswa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {students.map((s) => {
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
                    <div className="text-xs text-muted-foreground truncate">{s.email}</div>
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
                    <span className="text-xs text-muted-foreground">Rata-rata nilai</span>
                    <Badge variant={st.avg && st.avg >= 70 ? "default" : "secondary"}>
                      {st.avg !== null ? `${st.avg}/100` : "-"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {students.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-12">
            Belum ada siswa. Klik "Tambah Siswa" untuk menambahkan.
          </div>
        )}
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
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => deleteStudent(selected)}
                    data-testid={`button-delete-student-${selected.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    Hapus Siswa
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AddStudentDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddStudentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
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
    };
    write("users", [...allUsers, newStudent]);

    if (enrollAll) {
      const mats: Material[] = read("materials", []);
      write(
        "materials",
        mats.map((m) => ({ ...m, assignedTo: [...m.assignedTo, newStudent.id] })),
      );
      const exs: Exam[] = read("exams", []);
      write(
        "exams",
        exs.map((e) =>
          e.deadline > Date.now()
            ? { ...e, assignedTo: [...e.assignedTo, newStudent.id] }
            : e,
        ),
      );
    }

    // Auto-create payment for current month
    const d = new Date();
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const payments: Payment[] = read("payments", []);
    write("payments", [
      ...payments,
      {
        id: uid("p_"),
        userId: newStudent.id,
        month,
        amount: 350000,
        status: "unpaid",
      },
    ]);

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
                placeholder="siswa@mathclub.id"
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
              <Input
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                placeholder="contoh: 10 IPA 1"
                data-testid="input-new-student-kelas"
              />
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
