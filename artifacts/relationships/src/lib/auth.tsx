import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { read, write, subscribe } from "./storage";
import { mcApi } from "./api-client";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refresh: () => void;
  syncing: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const session = read("session", null);
    if (!session) return null;
    const users = read("users", []);
    return users.find((u) => u.id === session.userId) ?? null;
  });
  const [syncing, setSyncing] = useState(false);

  const syncFromBackend = useCallback(async () => {
    setSyncing(true);
    try {
      const session = read("session", null);
      const userId = session?.userId ?? null;

      const [apiUsers, apiClasses, apiMaterials, apiProgress, apiExams, apiSubmissions, apiPayments] =
        await Promise.all([
          mcApi.getUsers(),
          mcApi.getClasses(),
          mcApi.getMaterials(),
          mcApi.getMaterialProgress(),
          mcApi.getExams(),
          mcApi.getExamSubmissions(),
          mcApi.getPayments(),
        ]);

      // Merge users (preserve local passwords)
      const localUsers = read("users", []);
      const mergedMap = new Map<string, User>();
      localUsers.forEach((u) => mergedMap.set(u.id, u));
      apiUsers.forEach((u) => mergedMap.set(u.id, { ...mergedMap.get(u.id), ...u } as User));
      write("users", Array.from(mergedMap.values()));

      write("classes", apiClasses);

      // Merge API data with local data: API is authoritative for known items,
      // but preserve local-only items (created offline / pending sync) so they aren't lost.
      const localMaterials = read("materials", []);
      const apiMatIds = new Set(apiMaterials.map((m) => m.id));
      const localOnlyMaterials = localMaterials.filter((m) => !apiMatIds.has(m.id));
      write("materials", [...apiMaterials, ...localOnlyMaterials]);

      write("materialProgress", apiProgress);

      const localExams = read("exams", []);
      const apiExamIds = new Set(apiExams.map((e) => e.id));
      const localOnlyExams = localExams.filter((e) => !apiExamIds.has(e.id));
      write("exams", [...apiExams, ...localOnlyExams]);

      write("examSubmissions", apiSubmissions);
      write("payments", apiPayments);

      // Sync current user's notifications
      if (userId) {
        const apiNotifs = await mcApi.getNotifications(userId);
        const allLocal = read("notifications", []);
        const merged = [...allLocal.filter((n) => n.userId !== userId), ...apiNotifs];
        write("notifications", merged);
      }
    } catch {
      // API not available, use local data
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncFromBackend();
    const interval = setInterval(syncFromBackend, 15_000);
    const onFocus = () => void syncFromBackend();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [syncFromBackend]);

  useEffect(() => {
    const handler = () => {
      const session = read("session", null);
      if (!session) { setUser(null); return; }
      const users = read("users", []);
      setUser(users.find((u) => u.id === session.userId) ?? null);
    };
    const off1 = subscribe("session", handler);
    const off2 = subscribe("users", handler);
    return () => { off1(); off2(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const apiUser = await mcApi.login(email, password);
      const allUsers = read("users", []);
      if (!allUsers.find((u) => u.id === apiUser.id)) {
        write("users", [...allUsers, { ...apiUser, password }]);
      } else {
        write("users", allUsers.map((u) => u.id === apiUser.id ? { ...u, ...apiUser, password } : u));
      }
      write("session", { userId: apiUser.id });
      setUser({ ...apiUser, password } as User);
      // Sync user-specific data after login
      void syncFromBackend();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login gagal.";
      // Return API-specific errors (pending, wrong password) immediately
      if (msg.includes("menunggu persetujuan") || msg.includes("password salah") || msg.includes("tidak ditemukan")) {
        return { ok: false, error: msg };
      }
      // API unreachable — fall back to localStorage
      const users = read("users", []);
      const found = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
      );
      if (!found) return { ok: false, error: msg };
      if (found.status === "pending") {
        return { ok: false, error: "Akun Anda sedang menunggu persetujuan guru." };
      }
      write("session", { userId: found.id });
      setUser(found);
      return { ok: true };
    }
  }, [syncFromBackend]);

  const logout = useCallback(() => { write("session", null); setUser(null); mcApi.logout(); }, []);

  const refresh = useCallback(() => {
    const session = read("session", null);
    if (!session) { setUser(null); return; }
    const users = read("users", []);
    setUser(users.find((u) => u.id === session.userId) ?? null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh, syncing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useStore<T>(key: Parameters<typeof read>[0], fallback: T): T {
  const [value, setValue] = useState<T>(() => read(key, fallback as never) as unknown as T);
  useEffect(() => {
    const fn = () => setValue(read(key, fallback as never) as unknown as T);
    fn();
    return subscribe(key, fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}
