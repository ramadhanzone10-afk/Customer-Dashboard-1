import { useMemo } from "react";
import { Link } from "wouter";
import { ClipboardList, Clock, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import type { Exam, ExamSubmission } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function StudentExams() {
  const { user } = useAuth();
  const exams = useStore<Exam[]>("exams", []);
  const submissions = useStore<ExamSubmission[]>("examSubmissions", []);

  const data = useMemo(() => {
    const mine = exams.filter((e) => e.assignedTo.includes(user!.id));
    const upcoming: Exam[] = [];
    const completed: { exam: Exam; sub: ExamSubmission }[] = [];
    const expired: Exam[] = [];
    for (const e of mine) {
      const sub = submissions.find((s) => s.examId === e.id && s.userId === user!.id);
      if (sub) completed.push({ exam: e, sub });
      else if (e.deadline < Date.now()) expired.push(e);
      else upcoming.push(e);
    }
    upcoming.sort((a, b) => a.deadline - b.deadline);
    completed.sort((a, b) => b.sub.submittedAt - a.sub.submittedAt);
    return { upcoming, completed, expired };
  }, [exams, submissions, user]);

  const empty = data.upcoming.length === 0 && data.completed.length === 0 && data.expired.length === 0;

  if (empty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Belum ada ujian</EmptyTitle>
          <EmptyDescription>
            Ujian dari guru akan tampil di sini saat tersedia.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      {data.upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            Belum Dikerjakan ({data.upcoming.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.upcoming.map((e) => (
              <Card key={e.id} data-testid={`upcoming-exam-${e.id}`}>
                <CardHeader>
                  <CardTitle className="text-base">{e.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
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
                      <Calendar className="h-3 w-3" />
                      {formatDate(e.deadline)}
                    </Badge>
                  </div>
                  <Button asChild className="w-full" data-testid={`button-start-${e.id}`}>
                    <Link href={`/student/exams/${e.id}`}>Mulai Ujian</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {data.completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            Sudah Dikerjakan ({data.completed.length})
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
                      <CardTitle className="text-base">{exam.title}</CardTitle>
                      {sub.fullyGraded ? (
                        <Badge variant={pct! >= 70 ? "default" : "secondary"}>{pct}/100</Badge>
                      ) : (
                        <Badge variant="outline">Menunggu nilai</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/student/exams/${exam.id}/result`}>Lihat hasil</Link>
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
              <Card key={e.id} className="opacity-70">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                    <Badge variant="secondary">Terlewat</Badge>
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
    </div>
  );
}
