import type { User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

export type ApiUser = Omit<User, "password">;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json as T;
}

export const mcApi = {
  getUsers: () => req<ApiUser[]>("/mc/users"),

  login: (email: string, password: string) =>
    req<ApiUser>("/mc/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  createUser: (user: Omit<User, "createdAt"> & { password: string }) =>
    req<ApiUser>("/mc/users", {
      method: "POST",
      body: JSON.stringify(user),
    }),

  updateUser: (
    id: string,
    data: Partial<Pick<User, "name" | "avatarColor" | "password">> & {
      kelas?: string | null; phone?: string | null;
    },
  ) =>
    req<ApiUser>(`/mc/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    req<{ ok: boolean }>(`/mc/users/${id}`, { method: "DELETE" }),

  getClasses: () => req<string[]>("/mc/classes"),

  updateClasses: (classes: string[]) =>
    req<string[]>("/mc/classes", {
      method: "PUT",
      body: JSON.stringify(classes),
    }),
};
