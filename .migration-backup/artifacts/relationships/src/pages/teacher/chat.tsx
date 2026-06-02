import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  Loader2,
  Megaphone,
  Users,
  Wifi,
  WifiOff,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth, useStore } from "@/lib/auth";
import { uid } from "@/lib/storage";
import { mcApi } from "@/lib/api-client";
import type { User, ClassMessage } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 5000;
const BROADCAST_VALUE = "__broadcast__";

export default function TeacherChat() {
  const { user } = useAuth();
  const users = useStore<User[]>("users", []);
  const classes = useStore<string[]>("classes", []);

  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(true);
  // broadcast mode: selected set of kelas
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTargets, setBroadcastTargets] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBroadcast = selectedKelas === BROADCAST_VALUE;

  const fetchMessages = useCallback(async () => {
    if (!selectedKelas || isBroadcast) return;
    try {
      const data = await mcApi.getMessages(selectedKelas);
      setOnline(true);
      setMessages(data);
    } catch {
      setOnline(false);
    }
  }, [selectedKelas, isBroadcast]);

  useEffect(() => {
    setMessages([]);
    lastCountRef.current = 0;
    if (!selectedKelas || isBroadcast) return;
    fetchMessages();
    const id = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [selectedKelas, isBroadcast, fetchMessages]);

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages.length]);

  async function send() {
    const t = text.trim();
    if (!t || !user || sending) return;

    setSending(true);
    setText("");

    if (isBroadcast) {
      const targets = broadcastTargets.size > 0 ? Array.from(broadcastTargets) : classes;
      try {
        await Promise.all(
          targets.map((kelas) =>
            mcApi.postMessage({ id: uid("cm_"), kelas, userId: user.id, text: t }),
          ),
        );
        setOnline(true);
      } catch {
        setOnline(false);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
      return;
    }

    const newMsg: ClassMessage = {
      id: uid("cm_"),
      kelas: selectedKelas,
      userId: user.id,
      text: t,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, newMsg]);
    try {
      await mcApi.postMessage({ id: newMsg.id, kelas: selectedKelas, userId: user.id, text: t });
      await fetchMessages();
    } catch {
      setOnline(false);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function toggleBroadcastTarget(kelas: string) {
    setBroadcastTargets((prev) => {
      const next = new Set(prev);
      if (next.has(kelas)) next.delete(kelas);
      else next.add(kelas);
      return next;
    });
  }

  const studentCountInKelas = (kelas: string) =>
    users.filter((u) => u.role === "student" && u.kelas === kelas).length;

  if (!user) return null;

  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Chat Kelas</h1>
          <p className="text-sm text-muted-foreground">
            Kirim pesan ke satu kelas atau broadcast ke semua kelas.
          </p>
        </div>
        <div className={cn("flex items-center gap-1.5 text-xs", online ? "text-emerald-600" : "text-muted-foreground")}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Terhubung" : "Offline"}
        </div>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-4 items-start">
        {/* Sidebar: class picker */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Pilih Kelas</p>

          {/* Broadcast option */}
          <button
            onClick={() => setSelectedKelas(BROADCAST_VALUE)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
              selectedKelas === BROADCAST_VALUE
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 hover:bg-accent",
            )}
          >
            <Megaphone className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div>Broadcast Semua Kelas</div>
              <div className={cn("text-[11px]", selectedKelas === BROADCAST_VALUE ? "text-primary-foreground/70" : "text-muted-foreground")}>
                Kirim ke beberapa kelas sekaligus
              </div>
            </div>
          </button>

          <div className="border-t pt-2 mt-1">
            <ScrollArea className="h-[calc(100vh-340px)] min-h-[200px]">
              <div className="space-y-1 pr-2">
                {classes.map((kelas) => {
                  const count = studentCountInKelas(kelas);
                  return (
                    <button
                      key={kelas}
                      onClick={() => setSelectedKelas(kelas)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                        selectedKelas === kelas
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="flex-1 truncate">{kelas}</span>
                      {count > 0 && (
                        <Badge
                          variant={selectedKelas === kelas ? "secondary" : "outline"}
                          className="text-[10px] h-4 px-1"
                        >
                          {count}
                        </Badge>
                      )}
                    </button>
                  );
                })}
                {classes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada kelas.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Chat panel */}
        {!selectedKelas ? (
          <Card className="flex items-center justify-center h-[60vh] min-h-[400px] text-center">
            <div className="space-y-2 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto opacity-20" />
              <p className="text-sm font-medium">Pilih kelas untuk mulai chat</p>
              <p className="text-xs">Atau pilih Broadcast untuk kirim ke semua kelas sekaligus.</p>
            </div>
          </Card>
        ) : isBroadcast ? (
          /* Broadcast panel */
          <Card className="flex flex-col">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Broadcast ke Semua Kelas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-200">
                Pesan broadcast akan dikirim ke <strong>semua kelas</strong> (atau kelas yang dipilih di bawah) dan muncul di grup chat masing-masing kelas.
              </div>

              {/* Target selector */}
              <div>
                <Label className="text-sm mb-2 block">Target kelas (opsional — kosong = semua kelas)</Label>
                <Popover open={broadcastOpen} onOpenChange={setBroadcastOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {broadcastTargets.size === 0
                        ? `Semua kelas (${classes.length})`
                        : `${broadcastTargets.size} kelas dipilih`}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold text-muted-foreground">Pilih kelas target</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setBroadcastTargets(new Set())}
                      >
                        Reset
                      </Button>
                    </div>
                    <ScrollArea className="h-48">
                      <div className="space-y-1">
                        {classes.map((kelas) => (
                          <label
                            key={kelas}
                            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={broadcastTargets.has(kelas)}
                              onCheckedChange={() => toggleBroadcastTarget(kelas)}
                            />
                            <span className="text-sm flex-1">{kelas}</span>
                            <span className="text-xs text-muted-foreground">
                              {studentCountInKelas(kelas)} siswa
                            </span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Message input */}
              <div className="space-y-2">
                <Label className="text-sm">Pesan broadcast</Label>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Ketik pesan yang akan dikirim ke semua kelas..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    disabled={sending}
                  />
                  <Button
                    onClick={() => void send()}
                    disabled={!text.trim() || sending}
                    className="shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Megaphone className="h-4 w-4 mr-2" />
                        Kirim
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Akan dikirim ke{" "}
                  <strong>
                    {broadcastTargets.size === 0 ? `semua ${classes.length} kelas` : `${broadcastTargets.size} kelas terpilih`}
                  </strong>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Single class chat */
          <Card className="flex flex-col h-[calc(100vh-240px)] min-h-[460px]">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Chat Kelas {selectedKelas}
                <Badge variant="secondary" className="ml-1">
                  {studentCountInKelas(selectedKelas)} siswa
                </Badge>
                <Badge variant="outline" className="ml-auto">
                  {messages.length} pesan
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0">
              <div
                ref={scrollRef}
                className="h-full overflow-y-auto p-4 space-y-3"
              >
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                    <p>Belum ada pesan di kelas ini.</p>
                    <p className="text-xs mt-1">Mulai percakapan dengan siswa!</p>
                  </div>
                )}
                {messages.map((m) => {
                  const sender = users.find((u) => u.id === m.userId);
                  const isMe = m.userId === user.id;
                  const isTeacher = sender?.role === "teacher";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                        style={{ background: sender?.avatarColor ?? "#6366f1" }}
                        title={sender?.name}
                      >
                        {sender?.name.charAt(0) ?? "?"}
                      </div>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted rounded-tl-sm",
                        )}
                      >
                        {!isMe && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold mb-0.5 opacity-80">
                            {sender?.name ?? "Pengguna"}
                            {isTeacher && (
                              <Badge variant="default" className="h-4 px-1 text-[9px]">
                                Guru
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        <div
                          className={cn(
                            "text-[10px] mt-0.5",
                            isMe ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}
                        >
                          {formatRelative(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>

            <div className="border-t p-3 flex gap-2">
              <Input
                ref={inputRef}
                placeholder={`Tulis pesan untuk kelas ${selectedKelas}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                disabled={sending}
              />
              <Button
                onClick={() => void send()}
                disabled={!text.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
