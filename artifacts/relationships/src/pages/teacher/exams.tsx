import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Clock, Users as UsersIcon, CalendarCheck, BookOpen, ClipboardList,
  BarChart3, Shuffle, AlertCircle, CheckCircle2, XCircle, ChevronDown,
  ChevronUp, TrendingUp, Award, BookMarked, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, Material, User, AppNotification, ExamSubmission, MaterialProgress } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";
import { ScheduleDialog } from "./materials";

// ── Main Tugas Page ───────────────────────────────────────────────────────────
export default function TeacherTugas() {
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const materials = useStore<Material[]>("materials", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const matProgress = useStore<MaterialProgress[]>("materialProgress", []);
  const users = useStore<User[]>("users", []);

  const myStudents = useMemo(
    () => users.filter((u) => u.role === "student" && u.teacherId === user?.id && u.status === "active"),
    [users, user],
  );

  const myExams = useMemo(
    () => exams.filter((e) => e.createdBy === user?.id && (e.type ?? "exam") === "exam"),
    [exams, user],
  );
  const scheduledExams = useMemo(() => myExams.filter((e) => e.assignedTo.length > 0), [myExams]);
  const scheduledMaterials = useMemo(
    () => materials.filter((m) => m.createdBy === user?.id && m.assignedTo.length > 0),
    [materials, user],
  );

  const [examScheduleTarget, setExamScheduleTarget] = useState<Exam | null>(null);
  const [matScheduleTarget, setMatScheduleTarget] = useState<Material | null>(null);

  const classOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of myStudents) if (s.kelas) m.set(s.id, s.kelas);
    return m;
  }, [myStudents]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of myStudents) m.set(s.id, s.name);
    return m;
  }, [myStudents]);

  function classesFor(ids: string[]) {
    const klasses = new Set(ids.map((id) => classOf.get(id)).filter(Boolean) as string[]);
    return klasses.size ? [...klasses].sort().join(", ") : `${ids.length} siswa`;
  }

  function onExamScheduled(examId: string, studentIds: string[]) {
    const all = read("exams", []);
    const target = all.find((e: Exam) => e.id === examId); if (!target) return;
    const newlyAdded = studentIds.filter((id) => !(target.assignedTo ?? []).includes(id));
    const updated: Exam = { ...target, assignedTo: studentIds, status: studentIds.length ? "published" : "draft" };
    write("exams", all.map((e: Exam) => e.id === examId ? updated : e));
    if (newlyAdded.length) {
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({ id: uid("n_"), userId: sid, type: "new_exam", title: "Ujian baru tersedia", message: `"${target.title}" dijadwalkan untuk Anda.`, link: "/student/exams", createdAt: Date.now(), read: false }));
      write("notifications", [...read("notifications", []), ...newNotifs]);
      void mcApi.updateExam(examId, { ...updated, notifications: newNotifs } as Exam & { notifications?: AppNotification[] }).catch(() => {});
    } else {
      void mcApi.updateExam(examId, updated).catch(() => {});
    }
    setExamScheduleTarget(null);
  }

  function onMatScheduled(matId: string, studentIds: string[]) {
    const all = read("materials", []);
    const target = all.find((m: Material) => m.id === matId); if (!target) return;
    const newlyAdded = studentIds.filter((id) => !(target.assignedTo ?? []).includes(id));
    const updated: Material = { ...target, assignedTo: studentIds, status: studentIds.length ? "published" : "draft" };
    write("materials", all.map((m: Material) => m.id === matId ? updated : m));
    if (newlyAdded.length) {
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({ id: uid("n_"), userId: sid, type: "new_material", title: "Materi baru", message: `"${target.title}" dijadwalkan untuk Anda.`, link: "/student/materials", createdAt: Date.now(), read: false }));
      write("notifications", [...read("notifications", []), ...newNotifs]);
      void mcApi.updateMaterial(matId, { ...updated, notifications: newNotifs } as Material & { notifications?: AppNotification[] }).catch(() => {});
    } else {
      void mcApi.updateMaterial(matId, updated).catch(() => {});
    }
    setMatScheduleTarget(null);
  }

  const now = Date.now();
  const activeExams = useMemo(() => scheduledExams.filter((e) => e.deadline >= now || (e.startDateTime && e.startDateTime > now)).sort((a, b) => a.deadline - b.deadline), [scheduledExams]);
  const doneExams = useMemo(() => scheduledExams.filter((e) => e.deadline < now && !(e.startDateTime && e.startDateTime > now)).sort((a, b) => b.deadline - a.deadline), [scheduledExams]);

  const activeMats = useMemo(() => scheduledMaterials.sort((a, b) => b.createdAt - a.createdAt), [scheduledMaterials]);

  // ── Exam Card with full student progress ────────────────────────────────
  function ExamCard({ e }: { e: Exam }) {
    const [expanded, setExpanded] = useState(false);
    const subs = submissions.filter((s) => s.examId === e.id);
    const isExpired = e.deadline < now;
    const notStarted = e.startDateTime && e.startDateTime > now;
    const needsGrading = subs.filter((s) => !s.fullyGraded).length;
    const kelas = classesFor(e.assignedTo);
    const passing = e.passingScore ?? 70;

    const submittedIds = new Set(subs.map((s) => s.userId));
    const notSubmitted = e.assignedTo.filter((id) => !submittedIds.has(id));
    const gradedSubs = subs.filter((s) => s.fullyGraded && s.maxScore > 0);

    const stats = useMemo(() => {
      if (gradedSubs.length === 0) return null;
      const pcts = gradedSubs.map((s) => Math.round((s.totalScore / s.maxScore) * 100));
      return {
        avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
        max: Math.max(...pcts),
        min: Math.min(...pcts),
        passCount: pcts.filter((p) => p >= passing).length,
      };
    }, [gradedSubs, passing]);

    const submitPct = e.assignedTo.length > 0 ? Math.round((subs.length / e.assignedTo.length) * 100) : 0;

    return (
      <Card className={isExpired && !notStarted ? "border-muted" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{e.title}</CardTitle>
            {notStarted ? (
              <Badge variant="outline" className="shrink-0 text-xs">Terjadwal</Badge>
            ) : isExpired ? (
              <Badge variant="secondary" className="shrink-0 text-xs flex items-center gap-1"><History className="h-3 w-3" />Selesai</Badge>
            ) : (
              <Badge className="shrink-0 bg-green-600 text-xs">Aktif</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Meta */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">{kelas}</span>
              <span>({e.assignedTo.length} siswa)</span>
            </div>
            {e.startDateTime && (
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Mulai: <span className="font-medium text-foreground">{formatDate(e.startDateTime)}</span></span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Deadline: <span className="font-medium text-foreground">{formatDate(e.deadline)}</span></span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline" className="gap-1"><ClipboardList className="h-3 w-3" />{e.questions.length} soal</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{e.durationMinutes} mnt</Badge>
            {e.shuffleQuestions && <Badge variant="outline" className="gap-1"><Shuffle className="h-3 w-3" />Acak</Badge>}
            {needsGrading > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{needsGrading} perlu koreksi</Badge>}
          </div>

          {/* Progress bar pengumpulan */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pengumpulan</span>
              <span className="font-semibold">{subs.length}<span className="text-muted-foreground font-normal">/{e.assignedTo.length} kumpul</span></span>
            </div>
            <Progress value={submitPct} className="h-2" />
          </div>

          {/* Score stats (if any graded) */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xs text-muted-foreground">Rata-rata</p>
                <p className="font-bold text-sm">{stats.avg}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xs text-muted-foreground">Tertinggi</p>
                <p className="font-bold text-sm text-emerald-600">{stats.max}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2 text-center">
                <p className="text-xs text-muted-foreground">Terendah</p>
                <p className="font-bold text-sm text-amber-500">{stats.min}</p>
              </div>
            </div>
          )}
          {stats && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ketuntasan (KKM {passing})</span>
              <span>
                <span className="text-emerald-600 font-semibold">{stats.passCount} tuntas</span>
                <span className="text-muted-foreground"> / {gradedSubs.length} dinilai</span>
              </span>
            </div>
          )}

          {/* Expandable student list */}
          <button
            className="w-full flex items-center justify-between text-xs text-primary hover:underline py-0.5"
            onClick={() => setExpanded((v) => !v)}
          >
            <span>{expanded ? "Sembunyikan" : "Lihat"} status per siswa</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="border rounded-md overflow-hidden text-xs">
              {/* Submitted */}
              {subs.map((s) => {
                const name = nameOf.get(s.userId) ?? s.userId;
                const pct = s.fullyGraded && s.maxScore > 0 ? Math.round((s.totalScore / s.maxScore) * 100) : null;
                return (
                  <div key={s.userId} className="flex items-center justify-between px-3 py-2 border-b last:border-0 bg-emerald-50/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{formatDate(s.submittedAt)}</span>
                    </div>
                    <div>
                      {pct !== null ? (
                        <Badge variant={pct >= passing ? "default" : "secondary"} className={`text-xs ${pct >= passing ? "bg-emerald-600" : ""}`}>
                          {pct}/100
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Menunggu koreksi</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Not submitted */}
              {notSubmitted.map((id) => {
                const name = nameOf.get(id) ?? id;
                return (
                  <div key={id} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{name}</span>
                    </div>
                    <span className="text-muted-foreground italic">{isExpired ? "Tidak kumpul" : "Belum kumpul"}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/exams/${e.id}/results`}><BarChart3 className="h-3 w-3 mr-1" />Hasil Lengkap</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExamScheduleTarget(e)} className="gap-1">
              <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Material Card with read progress ─────────────────────────────────────
  function MatCard({ m }: { m: Material }) {
    const [expanded, setExpanded] = useState(false);
    const kelas = classesFor(m.assignedTo);
    const readIds = new Set(matProgress.filter((p) => p.materialId === m.id).map((p) => p.userId));
    const notRead = m.assignedTo.filter((id) => !readIds.has(id));
    const readPct = m.assignedTo.length > 0 ? Math.round((readIds.size / m.assignedTo.length) * 100) : 0;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">{m.title}</CardTitle>
            <Badge className="shrink-0 text-xs bg-blue-600">Materi</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">{kelas}</span>
              <span>({m.assignedTo.length} siswa)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Dikirim: <span className="font-medium text-foreground">{formatDate(m.createdAt)}</span></span>
            </div>
          </div>
          {m.subject && (
            <Badge variant="outline" className="text-xs">{m.subject}{m.bab ? ` – ${m.bab}` : ""}</Badge>
          )}

          {/* Progress baca */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Sudah dibaca</span>
              <span className="font-semibold">{readIds.size}<span className="text-muted-foreground font-normal">/{m.assignedTo.length} siswa</span></span>
            </div>
            <Progress value={readPct} className="h-2" />
          </div>

          <button
            className="w-full flex items-center justify-between text-xs text-primary hover:underline py-0.5"
            onClick={() => setExpanded((v) => !v)}
          >
            <span>{expanded ? "Sembunyikan" : "Lihat"} status per siswa</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="border rounded-md overflow-hidden text-xs">
              {m.assignedTo.map((id) => {
                const name = nameOf.get(id) ?? id;
                const done = readIds.has(id);
                const prog = matProgress.find((p) => p.materialId === m.id && p.userId === id);
                return (
                  <div key={id} className={`flex items-center justify-between px-3 py-2 border-b last:border-0 ${done ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}>
                    <div className="flex items-center gap-2">
                      {done
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={done ? "font-medium" : "text-muted-foreground"}>{name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {done && prog ? formatDate(prog.completedAt) : done ? "Sudah baca" : "Belum dibaca"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setMatScheduleTarget(m)}>
            <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalTugas = scheduledExams.length + scheduledMaterials.length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Pantau semua ujian &amp; materi yang sudah dikirim ke siswa. Nilai dan aktivitas siswa tersimpan secara permanen.
        </p>
      </div>

      {totalTugas === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList className="h-6 w-6" /></EmptyMedia>
            <EmptyTitle>Belum ada tugas terjadwal</EmptyTitle>
            <EmptyDescription>
              Buat ujian atau materi dari menu <span className="font-medium">Materi</span>, lalu klik "Jadwalkan" untuk mengirimkan ke siswa.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Tabs defaultValue="ujian-aktif">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="ujian-aktif" className="gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />Ujian Aktif
              {activeExams.length > 0 && <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full">{activeExams.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="ujian-selesai" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" />Riwayat Ujian
              {doneExams.length > 0 && <span className="bg-muted text-muted-foreground text-xs px-1.5 rounded-full">{doneExams.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="materi" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />Materi
              {activeMats.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full">{activeMats.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* Ujian Aktif */}
          <TabsContent value="ujian-aktif" className="mt-4">
            {activeExams.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Tidak ada ujian aktif saat ini. Buka tab "Riwayat Ujian" untuk melihat ujian yang sudah selesai.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {activeExams.map((e) => <ExamCard key={e.id} e={e} />)}
              </div>
            )}
          </TabsContent>

          {/* Riwayat Ujian (Selesai) */}
          <TabsContent value="ujian-selesai" className="mt-4">
            {doneExams.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Belum ada ujian yang sudah berakhir.
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  {doneExams.length} ujian tersimpan — nilai &amp; aktivitas siswa tetap tersedia.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {doneExams.map((e) => <ExamCard key={e.id} e={e} />)}
                </div>
              </>
            )}
          </TabsContent>

          {/* Materi */}
          <TabsContent value="materi" className="mt-4">
            {activeMats.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><BookOpen className="h-6 w-6" /></EmptyMedia>
                  <EmptyTitle>Belum ada materi terjadwal</EmptyTitle>
                  <EmptyDescription>
                    Buat materi dari menu <span className="font-medium">Materi</span>, lalu klik "Jadwalkan".
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeMats.map((m) => <MatCard key={m.id} m={m} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Schedule dialogs */}
      {examScheduleTarget && (
        <ScheduleDialog
          open={!!examScheduleTarget}
          onOpenChange={(o) => { if (!o) setExamScheduleTarget(null); }}
          itemTitle={examScheduleTarget.title}
          itemId={examScheduleTarget.id}
          currentAssigned={examScheduleTarget.assignedTo}
          students={myStudents}
          onConfirm={(ids) => onExamScheduled(examScheduleTarget.id, ids)}
        />
      )}
      {matScheduleTarget && (
        <ScheduleDialog
          open={!!matScheduleTarget}
          onOpenChange={(o) => { if (!o) setMatScheduleTarget(null); }}
          itemTitle={matScheduleTarget.title}
          itemId={matScheduleTarget.id}
          currentAssigned={matScheduleTarget.assignedTo}
          students={myStudents}
          onConfirm={(ids) => onMatScheduled(matScheduleTarget.id, ids)}
        />
      )}
    </div>
  );
}
