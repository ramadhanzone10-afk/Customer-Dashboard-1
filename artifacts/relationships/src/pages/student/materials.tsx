import { useMemo, useState } from "react";
import { Link } from "wouter";
import { BookOpen, Clock, FileText, CheckCircle2, Search, Filter, CalendarClock, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useAuth, useStore } from "@/lib/auth";
import type { Material, MaterialProgress } from "@/lib/types";

export default function StudentMaterials() {
  const { user } = useAuth();
  const materials = useStore<Material[]>("materials", []);
  const progress = useStore<MaterialProgress[]>("materialProgress", []);
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState<string>("Semua");
  const [activeBab, setActiveBab] = useState<string>("Semua");

  const now = Date.now();

  const myMaterials = useMemo(
    () =>
      materials
        .filter((m) => m.assignedTo.includes(user!.id))
        .filter((m) => !m.availableUntil || m.availableUntil > now)
        .sort((a, b) => {
          // upcoming (not yet open) go after available ones
          const aOpen = !m_availableFrom(a, now);
          const bOpen = !m_availableFrom(b, now);
          if (aOpen !== bOpen) return aOpen ? -1 : 1;
          return b.createdAt - a.createdAt;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materials, user],
  );

  function m_availableFrom(m: { availableFrom?: number }, ts: number) {
    return m.availableFrom && m.availableFrom > ts;
  }

  const subjects = useMemo(() => {
    const s = new Set(myMaterials.map((m) => m.subject).filter(Boolean) as string[]);
    return ["Semua", ...Array.from(s).sort()];
  }, [myMaterials]);

  const babs = useMemo(() => {
    const base = activeSubject === "Semua"
      ? myMaterials
      : myMaterials.filter((m) => m.subject === activeSubject);
    const b = new Set(base.map((m) => m.bab).filter(Boolean) as string[]);
    return ["Semua", ...Array.from(b).sort()];
  }, [myMaterials, activeSubject]);

  const filtered = useMemo(() => {
    let list = myMaterials;
    if (activeSubject !== "Semua") list = list.filter((m) => m.subject === activeSubject);
    if (activeBab !== "Semua") list = list.filter((m) => m.bab === activeBab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.subject?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [myMaterials, activeSubject, activeBab, search]);

  function isDone(id: string) {
    return progress.some((p) => p.userId === user!.id && p.materialId === id);
  }

  const doneCount = myMaterials.filter((m) => isDone(m.id)).length;

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Materi Belajar</h1>
          <p className="text-sm text-muted-foreground">
            {doneCount}/{myMaterials.length} materi selesai
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari materi..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {subjects.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            Mata Pelajaran
          </div>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setActiveSubject(s);
                  setActiveBab("Semua");
                }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                  activeSubject === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {babs.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {babs.map((b) => (
            <button
              key={b}
              onClick={() => setActiveBab(b)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                activeBab === b
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-background hover:bg-accent border-border text-muted-foreground"
              }`}
            >
              {b === "Semua" ? "Semua Bab" : `Bab ${b}`}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Tidak ada materi yang cocok dengan filter.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const done = isDone(m.id);
            const isLocked = !!(m.availableFrom && m.availableFrom > now);
            const deadlineStr = m.availableUntil
              ? new Date(m.availableUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : null;
            const openStr = m.availableFrom
              ? new Date(m.availableFrom).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : null;

            const cardEl = (
              <Card
                className={`h-full transition-shadow ${isLocked ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:shadow-md"}`}
                data-testid={`material-${m.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isLocked ? "bg-muted text-muted-foreground" : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600"}`}>
                      {isLocked ? <Lock className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {isLocked && (
                        <Badge variant="secondary" className="gap-1 text-xs shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <CalendarClock className="h-3 w-3" />
                          Belum Tersedia
                        </Badge>
                      )}
                      {done && !isLocked && (
                        <Badge className="gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                          Selesai
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base mt-3 leading-snug">{m.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {m.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {m.subject && (
                      <Badge variant="outline" className="text-xs">
                        {m.subject}
                      </Badge>
                    )}
                    {m.bab && (
                      <Badge variant="outline" className="text-xs">
                        Bab {m.bab}
                      </Badge>
                    )}
                    {m.timerMinutes && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {m.timerMinutes} mnt
                      </Badge>
                    )}
                    {m.fileName && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <FileText className="h-3 w-3" />
                        File
                      </Badge>
                    )}
                    {m.videoUrl && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        ▶ Video
                      </Badge>
                    )}
                  </div>
                  {isLocked && openStr && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      Tersedia mulai {openStr}
                    </p>
                  )}
                  {!isLocked && deadlineStr && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      Deadline: {deadlineStr}
                    </p>
                  )}
                </CardContent>
              </Card>
            );

            return isLocked ? (
              <div key={m.id}>{cardEl}</div>
            ) : (
              <Link key={m.id} href={`/student/materials/${m.id}`}>{cardEl}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
