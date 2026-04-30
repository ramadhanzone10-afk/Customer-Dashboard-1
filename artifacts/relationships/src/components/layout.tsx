import { ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Wallet,
  TrendingUp,
  LogOut,
  Bell,
  Menu,
  X,
  User as UserIcon,
} from "lucide-react";
import { useAuth, useStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { write, read } from "@/lib/storage";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const teacherNav: NavItem[] = [
  { path: "/teacher", label: "Dashboard", icon: LayoutDashboard },
  { path: "/teacher/students", label: "Siswa", icon: Users },
  { path: "/teacher/materials", label: "Materi", icon: BookOpen },
  { path: "/teacher/exams", label: "Ujian", icon: ClipboardList },
  { path: "/teacher/payments", label: "Pembayaran", icon: Wallet },
];

const studentNav: NavItem[] = [
  { path: "/student", label: "Dashboard", icon: LayoutDashboard },
  { path: "/student/materials", label: "Materi", icon: BookOpen },
  { path: "/student/exams", label: "Ujian", icon: ClipboardList },
  { path: "/student/progress", label: "Progres", icon: TrendingUp },
  { path: "/student/payments", label: "Pembayaran", icon: Wallet },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const notifications = useStore<AppNotification[]>("notifications", []);
  const myNotifs = useMemo(
    () => notifications.filter((n) => n.userId === user?.id).sort((a, b) => b.createdAt - a.createdAt),
    [notifications, user?.id],
  );
  const unread = myNotifs.filter((n) => !n.read).length;

  if (!user) return null;
  const nav = user.role === "teacher" ? teacherNav : studentNav;

  function markAllRead() {
    const all = read("notifications", []);
    write(
      "notifications",
      all.map((n) => (n.userId === user!.id ? { ...n, read: true } : n)),
    );
  }

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => {
        const active =
          item.path === location ||
          (item.path !== `/${user.role}` && location.startsWith(item.path));
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="flex items-center gap-2 px-5 py-5 border-b">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight">MathClub</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {user.role === "teacher" ? "Panel Guru" : "Panel Siswa"}
            </div>
          </div>
        </div>
        <NavLinks />
        <div className="mt-auto p-3 border-t">
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ background: user.avatarColor ?? "#6366f1" }}
            >
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="font-bold">MathClub</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                data-testid="button-close-mobile-nav"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-card sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
                data-testid="button-open-mobile-nav"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-base md:text-lg">
                {nav.find(
                  (n) =>
                    n.path === location ||
                    (n.path !== `/${user.role}` && location.startsWith(n.path)),
                )?.label ?? "MathClub"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu onOpenChange={(o) => o && setTimeout(markAllRead, 1500)}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    data-testid="button-notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
                      >
                        {unread}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="max-h-80">
                    {myNotifs.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Belum ada notifikasi.
                      </div>
                    )}
                    {myNotifs.slice(0, 12).map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "px-3 py-2 border-b last:border-0 text-sm",
                          !n.read && "bg-accent/30",
                        )}
                      >
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatRelative(n.createdAt)}
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ background: user.avatarColor ?? "#6366f1" }}
                    data-testid="button-user-menu"
                  >
                    {user.name.charAt(0)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {user.role === "teacher" ? "Guru" : "Siswa"}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "student" && (
                    <DropdownMenuItem asChild data-testid="menu-profile">
                      <Link href="/student/profile">
                        <UserIcon className="h-4 w-4 mr-2" />
                        Edit Profil
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={logout}
                    data-testid="menu-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
