import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ClipboardList,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileEdit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import type { Exam, ExamSubmission } from "@/lib/types";
import { formatDate } from "@/lib/format";

type Tab = "ujian" | "tugas";

export default function StudentExams() {
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);
  const [tab, setTab] = useState<Tab>("ujian");

  const { ujianData, tugasData } = useMemo(() => {
    const mine = exams.filter((e) => e.assignedTo.includes(user!.id));
    const ujianList = mine.filter((e) => !e.type || e.type === "exam");
    const tugasList = mine.filter((e) => e.type === "tugas");

    function split(list: Exam[]) {
      const upcoming: Exam[] = [];
      const completed: { exam: Exam; sub: ExamSubmission }[] = [];
      const expired: Exam[] = [];
      for (const e of list) {
        const sub = submissions.find((s) => s.examId === e.id && s.userId === user!.id);
        if (sub) completed.push({ exam: e, sub });
        else if (e.deadline < Date.now()) expired.push(e);
        else upcoming.push(e);
      }
      upcoming.sort((a, b) => a.deadline - b.deadline);
      completed.sort((a, b) => b.sub.submittedAt - a.sub.submittedAt);
      return { upcoming, completed, expired };
    }

    return { ujianData: split(ujianList), tugasData: split(tugasList) };
  }, [exams, submissions, user]);

  const totalAll =
    ujianData.upcoming.length + ujianData.completed.length + ujianData.expired.length +
    tugasData.upcoming.length + tugasData.completed.length + tugasData.expired.length;

  if (totalAll === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Belum ada ujian atau tugas</EmptyTitle>
          <EmptyDescription>Ujian dan tugas dari guru akan tampil di sini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const data = tab === "ujian" ? ujianData : tugasData;
  const isUjian = tab === "ujian";

  const ujianPending = ujianData.upcoming.length;
  const tugasPending = tugasData.upcoming.length;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <TabButton
          active={tab === "ujian"}
          onClick={() => setTab("ujian")}
          label="Ujian"
          count={ujianPending}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <TabButton
          active={tab === "tugas"}
          onClick={() => setTab("tugas")}
          label="Tugas"
          count={tugasPending}
          icon={<FileEdit className="h-4 w-4" />}
        />
      </div>

      {data.upcoming.length === 0 && data.completed.length === 0 && data.expired.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Belum ada {isUjian ? "ujian" : "tugas"}.
        </div>
      ) : (
        <>
          {data.upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                {isUjian ? "Belum Dikerjakan" : "Deadline Mendatang"} ({data.upcoming.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {data.upcoming.map((e) => {
                  const daysLeft = Math.ceil((e.deadline - Date.now()) / 86400000);
                  return (
                    <Card key={e.id} data-testid={`upcoming-exam-${e.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug">{e.title}</CardTitle>
                          {daysLeft <= 3 && (
                            <Badge variant="destructive" className="shrink-0 text-xs">
                              {daysLeft <= 0 ? "Hari ini!" : `${daysLeft}h lagi`}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {isUjian && (
                            <>
                              <Badge variant="outline" className="gap-1">
                                <ClipboardList className="h-3 w-3" />
                                {e.questions.length} soal
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {e.durationMinutes} mnt
                              </Badge>
                            </>
                          )}
                          <Badge variant="outline" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            Deadline {formatDate(e.deadline)}
                          </Badge>
                        </div>
                        <Button asChild className="w-full" data-testid={`button-start-${e.id}`}>
                          <Link href={`/student/exams/${e.id}`}>
                            {isUjian ? "Mulai Ujian" : "Kerjakan Tugas"}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {data.completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Sudah Dikumpulkan ({data.completed.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {data.completed.map(({ exam, sub }) => {
                  const pct = sub.fullyGraded
                    ? Math.round((sub.totalScore / sub.maxScore) * 100)
                    : null;
                  return (
                    <Card key={exam.id} data-testid={`completed-exam-${exam.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug">{exam.title}</CardTitle>
                          {sub.fullyGraded ? (
                            <Badge
                              variant={pct! >= 70 ? "default" : "secondary"}
                              className="shrink-0"
                            >
                              {pct}/100
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              Menunggu nilai
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          Dikumpulkan {formatDate(sub.submittedAt)}
                        </div>
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href={`/student/exams/${exam.id}/result`}>Lihat detail</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {data.expired.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Terlewat ({data.expired.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {data.expired.map((e) => (
                  <Card key={e.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{e.title}</CardTitle>
                        <Badge variant="secondary" className="shrink-0">
                          Terlewat
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Deadline: {formatDate(e.deadline)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
            active ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
