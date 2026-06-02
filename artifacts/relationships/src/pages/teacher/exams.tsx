import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Clock, Users as UsersIcon, CalendarCheck, BookOpen, ClipboardList,
  BarChart3, Shuffle, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { Exam, Material, User, AppNotification, ExamSubmission } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { mcApi } from "@/lib/api-client";
import { ScheduleDialog } from "./materials";

// ── Main Tugas Page (scheduling only) ────────────────────────────────────────
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

  // All exams (ujian type only) created by this teacher
  const myExams = useMemo(
    () => exams.filter((e) => e.createdBy === user?.id && (e.type ?? "exam") === "exam"),
    [exams, user],
  );
  // Only assigned (scheduled) exams
  const scheduledExams = useMemo(() => myExams.filter((e) => e.assignedTo.length > 0), [myExams]);

  // Assigned materials
  const scheduledMaterials = useMemo(
    () => materials.filter((m) => m.createdBy === user?.id && m.assignedTo.length > 0),
    [materials, user],
  );

  const [examScheduleTarget, setExamScheduleTarget] = useState<Exam | null>(null);
  const [matScheduleTarget, setMatScheduleTarget] = useState<Material | null>(null);

  // Group students by class for display
  const classOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of myStudents) if (s.kelas) m.set(s.id, s.kelas);
    return m;
  }, [myStudents]);

  function classesFor(ids: string[]) {
    const klasses = new Set(ids.map((id) => classOf.get(id)).filter(Boolean) as string[]);
    return klasses.size ? [...klasses].sort().join(", ") : `${ids.length} siswa`;
  }

  function onExamScheduled(examId: string, studentIds: string[]) {
    const all = read("exams", []);
    const target = all.find((e) => e.id === examId); if (!target) return;
    const newlyAdded = studentIds.filter((id) => !(target.assignedTo ?? []).includes(id));
    const updated: Exam = { ...target, assignedTo: studentIds, status: studentIds.length ? "published" : "draft" };
    write("exams", all.map((e) => e.id === examId ? updated : e));
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
    const target = all.find((m) => m.id === matId); if (!target) return;
    const newlyAdded = studentIds.filter((id) => !(target.assignedTo ?? []).includes(id));
    const updated: Material = { ...target, assignedTo: studentIds, status: studentIds.length ? "published" : "draft" };
    write("materials", all.map((m) => m.id === matId ? updated : m));
    if (newlyAdded.length) {
      const newNotifs: AppNotification[] = newlyAdded.map((sid) => ({ id: uid("n_"), userId: sid, type: "new_material", title: "Materi baru", message: `"${target.title}" dijadwalkan untuk Anda.`, link: "/student/materials", createdAt: Date.now(), read: false }));
      write("notifications", [...read("notifications", []), ...newNotifs]);
      void mcApi.updateMaterial(matId, { ...updated, notifications: newNotifs } as Material & { notifications?: AppNotification[] }).catch(() => {});
    } else {
      void mcApi.updateMaterial(matId, updated).catch(() => {});
    }
    setMatScheduleTarget(null);
  }

  // Sort by deadline ascending
  const sortedExams = useMemo(
    () => [...scheduledExams].sort((a, b) => a.deadline - b.deadline),
    [scheduledExams],
  );
  const sortedMaterials = useMemo(
    () => [...scheduledMaterials].sort((a, b) => a.createdAt - b.createdAt),
    [scheduledMaterials],
  );

  function ExamScheduleCard({ e }: { e: Exam }) {
    const subs = submissions.filter((s) => s.examId === e.id);
    const now = Date.now();
    const isExpired = e.deadline < now;
    const notStarted = e.startDateTime && e.startDateTime > now;
    const needsGrading = subs.filter((s) => !s.fullyGraded).length;
    const kelas = classesFor(e.assignedTo);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{e.title}</CardTitle>
            {notStarted ? (
              <Badge variant="outline" className="shrink-0 text-xs">Terjadwal</Badge>
            ) : (
              <Badge variant={isExpired ? "secondary" : "default"} className={!isExpired ? "bg-green-600 shrink-0" : "shrink-0"}>
                {isExpired ? "Berakhir" : "Aktif"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">{kelas}</span>
              <span className="text-xs">({e.assignedTo.length} siswa)</span>
            </div>
            {e.startDateTime && (
              <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-xs">Mulai: <span className="font-medium text-foreground">{formatDate(e.startDateTime)}</span></span>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Deadline: <span className="font-medium text-foreground">{formatDate(e.deadline)}</span></span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><ClipboardList className="h-3 w-3" />{e.questions.length} soal</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{e.durationMinutes} mnt</Badge>
            <Badge variant="outline" className="gap-1"><UsersIcon className="h-3 w-3" />{subs.length}/{e.assignedTo.length} kumpul</Badge>
            {e.shuffleQuestions && <Badge variant="outline" className="gap-1"><Shuffle className="h-3 w-3" />Acak</Badge>}
            {needsGrading > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{needsGrading} perlu koreksi</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/exams/${e.id}/results`}><BarChart3 className="h-3 w-3 mr-1" />Lihat Hasil</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExamScheduleTarget(e)} className="gap-1">
              <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function MatScheduleCard({ m }: { m: Material }) {
    const kelas = classesFor(m.assignedTo);
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">{m.title}</CardTitle>
            <Badge variant="default" className="shrink-0 text-xs bg-green-600">Aktif</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">{kelas}</span>
              <span className="text-xs">({m.assignedTo.length} siswa)</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Diberikan: <span className="font-medium text-foreground">{formatDate(m.createdAt)}</span></span>
            </div>
          </div>
          {m.subject && (
            <Badge variant="outline" className="text-xs">{m.subject}{m.bab ? ` – ${m.bab}` : ""}</Badge>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setMatScheduleTarget(m)}>
              <CalendarCheck className="h-3.5 w-3.5" />Ubah Jadwal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Pantau dan kelola jadwal ujian & materi yang sudah diberikan ke siswa. Untuk membuat konten baru, buka menu <span className="font-medium text-foreground">Materi &amp; Soal</span>.
        </p>
      </div>

      <Tabs defaultValue="jadwal-ujian">
        <TabsList>
          <TabsTrigger value="jadwal-ujian" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />Jadwal Ujian ({scheduledExams.length})
          </TabsTrigger>
          <TabsTrigger value="jadwal-materi" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />Jadwal Materi ({scheduledMaterials.length})
          </TabsTrigger>
        </TabsList>

        {/* Jadwal Ujian */}
        <TabsContent value="jadwal-ujian" className="mt-4">
          {scheduledExams.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ClipboardList className="h-6 w-6" /></EmptyMedia>
                <EmptyTitle>Belum ada ujian terjadwal</EmptyTitle>
                <EmptyDescription>
                  Buat ujian dari menu <span className="font-medium">Materi &amp; Soal → tab Ujian</span>, lalu klik "Jadwalkan" untuk mengirimkan ke siswa.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {sortedExams.map((e) => <ExamScheduleCard key={e.id} e={e} />)}
            </div>
          )}
        </TabsContent>

        {/* Jadwal Materi */}
        <TabsContent value="jadwal-materi" className="mt-4">
          {scheduledMaterials.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen className="h-6 w-6" /></EmptyMedia>
                <EmptyTitle>Belum ada materi terjadwal</EmptyTitle>
                <EmptyDescription>
                  Buat materi dari menu <span className="font-medium">Materi &amp; Soal → tab Materi/Soal</span>, lalu klik "Jadwalkan" untuk mengirimkan ke siswa.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedMaterials.map((m) => <MatScheduleCard key={m.id} m={m} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
