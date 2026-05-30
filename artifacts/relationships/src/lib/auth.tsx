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

  async function syncFromBackend() {
    setSyncing(true);
    try {
      const [apiUsers, apiClasses] = await Promise.all([
        mcApi.getUsers(),
        mcApi.getClasses(),
      ]);
      const localUsers = read("users", []);
      const mergedMap = new Map<string, User>();
      localUsers.forEach((u) => mergedMap.set(u.id, u));
      apiUsers.forEach((u) => mergedMap.set(u.id, { ...mergedMap.get(u.id), ...u } as User));
      write("users", Array.from(mergedMap.values()));
      write("classes", apiClasses);
    } catch {
      // API tidak tersedia, gunakan data lokal
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    syncFromBackend();
    const interval = setInterval(syncFromBackend, 30_000);
    const onFocus = () => syncFromBackend();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login gagal.";
      // Fallback ke localStorage jika API tidak tersedia
      const users = read("users", []);
      const found = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
      );
      if (!found) return { ok: false, error: msg };
      write("session", { userId: found.id });
      setUser(found);
      return { ok: true };
    }
  }, []);

  const logout = useCallback(() => {
    write("session", null);
    setUser(null);
  }, []);

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
