import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Clock, FileText, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, useStore } from "@/lib/auth";
import { read, write } from "@/lib/storage";
import type { Material, MaterialProgress } from "@/lib/types";
import { formatDuration } from "@/lib/format";

export default function StudentMaterialView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const material = materials.find((m) => m.id === id);
  const done = useMemo(
    () => progress.some((p) => p.userId === user!.id && p.materialId === id),
    [progress, user, id],
  );

  const totalMs = (material?.timerMinutes ?? 0) * 60 * 1000;
  const [remaining, setRemaining] = useState<number>(totalMs);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(totalMs);
    setRunning(false);
  }, [totalMs, id]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1000) {
          clearInterval(t);
          setRunning(false);
          return 0;
        }
        return r - 1000;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  function markDone() {
    const all = read("materialProgress", []);
    if (all.some((p) => p.userId === user!.id && p.materialId === id)) {
      setLocation("/student/materials");
      return;
    }
    write("materialProgress", [
      ...all,
      { userId: user!.id, materialId: id!, completedAt: Date.now() },
    ]);
    setLocation("/student/materials");
  }

  if (!material) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Materi tidak ditemukan.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/student/materials">Kembali</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student/materials">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kembali ke daftar materi
        </Link>
      </Button>

      <div>
        <div className="flex items-center gap-2 mb-2">
          {done && (
            <Badge className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Selesai
            </Badge>
          )}
          {material.timerMinutes && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {material.timerMinutes} menit
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold">{material.title}</h1>
        <p className="text-muted-foreground mt-2">{material.description}</p>
      </div>

      {material.timerMinutes && !done && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <div className="text-3xl font-bold tabular-nums">
                {formatDuration(remaining)}
              </div>
              <div className="text-xs text-muted-foreground">
                {running ? "Sedang berjalan..." : remaining === 0 ? "Waktu habis" : "Timer belajar"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRemaining(totalMs);
                  setRunning(false);
                }}
              >
                Reset
              </Button>
              <Button onClick={() => setRunning((r) => !r)} data-testid="button-toggle-timer">
                {running ? "Pause" : remaining === 0 ? "Mulai ulang" : "Mulai"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {material.fileName && material.fileDataUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Lampiran File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 border rounded-md">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-sm">{material.fileName}</span>
              <Button asChild size="sm" variant="outline">
                <a href={material.fileDataUrl} download={material.fileName}>
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </a>
              </Button>
            </div>
            {material.fileDataUrl.startsWith("data:application/pdf") && (
              <iframe
                src={material.fileDataUrl}
                className="w-full h-96 mt-4 rounded-md border"
                title="PDF Preview"
              />
            )}
            {material.fileDataUrl.startsWith("data:image") && (
              <img
                src={material.fileDataUrl}
                alt={material.fileName}
                className="w-full mt-4 rounded-md border"
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-wrap">
            {material.content}
          </article>
        </CardContent>
      </Card>

      {!done && (
        <div className="flex justify-end">
          <Button onClick={markDone} size="lg" data-testid="button-mark-done">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Tandai selesai dipelajari
          </Button>
        </div>
      )}

      {done && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Kamu sudah menyelesaikan materi ini. Mantap!</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
