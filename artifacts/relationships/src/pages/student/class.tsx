import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Users,
  Send,
  Phone,
  Mail,
  MessageCircle,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, useStore } from "@/lib/auth";
import { read, write, uid } from "@/lib/storage";
import type { User, ClassMessage } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function StudentClass() {
  const { user } = useAuth();
  const users = useStore<User[]>("users", []);
  const messages = useStore<ClassMessage[]>("classMessages", []);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const kelas = user?.kelas;

  const classmates = useMemo(
    () =>
      users
        .filter((u) => u.role === "student" && u.kelas === kelas)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users, kelas],
  );

  const myMessages = useMemo(
    () =>
      messages
        .filter((m) => m.kelas === kelas)
        .sort((a, b) => a.createdAt - b.createdAt),
    [messages, kelas],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [myMessages.length]);

  function send() {
    const t = text.trim();
    if (!t || !kelas || !user) return;
    const all = read("classMessages", []);
    const newMsg: ClassMessage = {
      id: uid("cm_"),
      kelas,
      userId: user.id,
      text: t,
      createdAt: Date.now(),
    };
    write("classMessages", [...all, newMsg]);
    setText("");
  }

  if (!user) return null;

  if (!kelas) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kelas Saya</h1>
            <p className="text-sm text-muted-foreground">
              Lihat teman sekelas dan grup chat kelas.
            </p>
          </div>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Kamu belum mengatur kelas. Buka{" "}
            <Link href="/student/profile" className="underline font-medium">
              Edit Profil
            </Link>{" "}
            untuk memilih kelas kamu, lalu kembali ke halaman ini untuk melihat teman
            sekelas.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Kelas {kelas}</h1>
          <p className="text-sm text-muted-foreground">
            {classmates.length} teman sekelas
          </p>
        </div>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat Kelas
          </TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="h-4 w-4 mr-2" />
            Teman Sekelas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <Card className="flex flex-col h-[60vh] min-h-[400px]">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Grup Chat Kelas {kelas}
                <Badge variant="secondary" className="ml-auto">
                  {myMessages.length} pesan
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <div
                ref={scrollRef}
                className="h-full overflow-y-auto p-4 space-y-3"
                data-testid="chat-messages"
              >
                {myMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                    <p>Belum ada pesan di kelas ini.</p>
                    <p className="text-xs mt-1">Sapa teman sekelas kamu!</p>
                  </div>
                )}
                {myMessages.map((m) => {
                  const sender = users.find((u) => u.id === m.userId);
                  const isMe = m.userId === user.id;
                  const isTeacher = sender?.role === "teacher";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex gap-2",
                        isMe ? "flex-row-reverse" : "flex-row",
                      )}
                      data-testid={`message-${m.id}`}
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
                              <Badge
                                variant="default"
                                className="h-4 px-1 text-[9px]"
                              >
                                Guru
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        <div
                          className={cn(
                            "text-[10px] mt-0.5",
                            isMe
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
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
                placeholder="Tulis pesan untuk teman sekelas..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                data-testid="input-message"
              />
              <Button
                onClick={send}
                disabled={!text.trim()}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {classmates.map((c) => {
              const isMe = c.id === user.id;
              return (
                <Card
                  key={c.id}
                  className={cn(isMe && "border-primary border-2")}
                  data-testid={`classmate-${c.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ background: c.avatarColor ?? "#6366f1" }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate flex items-center gap-1.5">
                          {c.name}
                          {isMe && (
                            <Badge variant="outline" className="text-[10px]">
                              Kamu
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Kelas {c.kelas}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <a
                          href={`mailto:${c.email}`}
                          className="truncate hover:text-foreground"
                        >
                          {c.email}
                        </a>
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <a
                            href={`tel:${c.phone}`}
                            className="truncate hover:text-foreground"
                          >
                            {c.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {classmates.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-12 border rounded-lg">
                Belum ada teman sekelas yang terdaftar di kelas {kelas}.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
