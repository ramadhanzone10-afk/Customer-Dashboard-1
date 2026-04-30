import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { read, write, subscribe } from "./storage";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const session = read("session", null);
    if (!session) return null;
    const users = read("users", []);
    return users.find((u) => u.id === session.userId) ?? null;
  });

  useEffect(() => {
    const handler = () => {
      const session = read("session", null);
      if (!session) {
        setUser(null);
        return;
      }
      const users = read("users", []);
      setUser(users.find((u) => u.id === session.userId) ?? null);
    };
    const off1 = subscribe("session", handler);
    const off2 = subscribe("users", handler);
    return () => {
      off1();
      off2();
    };
  }, []);

  const login = useCallback((email: string, password: string) => {
    const users = read("users", []);
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!found) return { ok: false, error: "Email atau password salah." };
    write("session", { userId: found.id });
    setUser(found);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    write("session", null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
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
