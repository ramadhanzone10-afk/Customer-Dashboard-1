import { useMemo } from "react";
import { Link } from "wouter";
import { BookOpen, Clock, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import type { Material, MaterialProgress } from "@/lib/types";

export default function StudentMaterials() {
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);

  const myMaterials = useMemo(
    () =>
      materials
        .filter((m) => m.assignedTo.includes(user!.id))
        .sort((a, b) => b.createdAt - a.createdAt),
    [materials, user],
  );

  function isDone(id: string) {
    return progress.some((p) => p.userId === user!.id && p.materialId === id);
  }

  if (myMaterials.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Belum ada materi</EmptyTitle>
          <EmptyDescription>
            Materi dari guru akan muncul di sini ketika tersedia.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {myMaterials.map((m) => {
        const done = isDone(m.id);
        return (
          <Link key={m.id} href={`/student/materials/${m.id}`}>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow h-full"
              data-testid={`material-${m.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  {done && (
                    <Badge className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Selesai
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-3">{m.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {m.description}
                </p>
                <div className="flex flex-wrap gap-2">
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
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
