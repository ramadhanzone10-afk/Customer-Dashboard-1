import type { User, Material, MaterialProgress, Exam, ExamSubmission, Payment, AppNotification } from "./types";

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
  // ── Auth & Users ──────────────────────────────────────────────────────
  getUsers: () => req<ApiUser[]>("/mc/users"),
  login: (email: string, password: string) =>
    req<ApiUser>("/mc/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  createUser: (user: Omit<User, "createdAt"> & { password: string }) =>
    req<ApiUser>("/mc/users", { method: "POST", body: JSON.stringify(user) }),
  updateUser: (id: string, data: Partial<Pick<User, "name" | "avatarColor" | "password">> & { kelas?: string | null; phone?: string | null; teacherId?: string | null; paymentMethod?: string }) =>
    req<ApiUser>(`/mc/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  registerUser: (user: { id: string; email: string; password: string; name: string; avatarColor?: string; kelas?: string; phone?: string; teacherId?: string }) =>
    req<ApiUser>("/mc/auth/register", { method: "POST", body: JSON.stringify(user) }),
  registerTeacher: (data: { id: string; email: string; password: string; name: string; avatarColor?: string; phone?: string; code: string }) =>
    req<ApiUser>("/mc/auth/register-teacher", { method: "POST", body: JSON.stringify(data) }),
  getTeachers: () => req<ApiUser[]>("/mc/teachers"),
  approveUser: (id: string) =>
    req<ApiUser>(`/mc/users/${id}/approve`, { method: "PUT" }),
  deleteUser: (id: string) => req<{ ok: boolean }>(`/mc/users/${id}`, { method: "DELETE" }),

  // ── Classes ───────────────────────────────────────────────────────────
  getClasses: () => req<string[]>("/mc/classes"),
  updateClasses: (classes: string[]) =>
    req<string[]>("/mc/classes", { method: "PUT", body: JSON.stringify(classes) }),

  // ── Materials ─────────────────────────────────────────────────────────
  getMaterials: () => req<Material[]>("/mc/materials"),
  createMaterial: (m: Material & { notifications?: AppNotification[] }) =>
    req<Material>("/mc/materials", { method: "POST", body: JSON.stringify(m) }),
  updateMaterial: (id: string, m: Partial<Material>) =>
    req<Material>(`/mc/materials/${id}`, { method: "PUT", body: JSON.stringify(m) }),
  deleteMaterial: (id: string) => req<{ ok: boolean }>(`/mc/materials/${id}`, { method: "DELETE" }),

  // ── Material Progress ─────────────────────────────────────────────────
  getMaterialProgress: () => req<MaterialProgress[]>("/mc/material-progress"),
  addMaterialProgress: (userId: string, materialId: string, completedAt: number) =>
    req<MaterialProgress>("/mc/material-progress", { method: "POST", body: JSON.stringify({ userId, materialId, completedAt }) }),

  // ── Exams ─────────────────────────────────────────────────────────────
  getExams: () => req<Exam[]>("/mc/exams"),
  createExam: (exam: Exam & { notifications?: AppNotification[] }) =>
    req<Exam>("/mc/exams", { method: "POST", body: JSON.stringify(exam) }),
  deleteExam: (id: string) => req<{ ok: boolean }>(`/mc/exams/${id}`, { method: "DELETE" }),

  // ── Exam Submissions ──────────────────────────────────────────────────
  getExamSubmissions: () => req<ExamSubmission[]>("/mc/exam-submissions"),
  submitExam: (sub: ExamSubmission) =>
    req<ExamSubmission>("/mc/exam-submissions", { method: "POST", body: JSON.stringify(sub) }),
  gradeExam: (id: string, updates: Partial<ExamSubmission> & { notification?: AppNotification }) =>
    req<ExamSubmission>(`/mc/exam-submissions/${id}`, { method: "PUT", body: JSON.stringify(updates) }),

  // ── Payments ──────────────────────────────────────────────────────────
  getPayments: () => req<Payment[]>("/mc/payments"),
  createPayment: (p: Payment) =>
    req<Payment>("/mc/payments", { method: "POST", body: JSON.stringify(p) }),
  createPaymentsBatch: (ps: Payment[]) =>
    req<Payment[]>("/mc/payments/batch", { method: "POST", body: JSON.stringify(ps) }),
  updatePayment: (id: string, updates: Partial<Payment> & { notification?: AppNotification; notifications?: AppNotification[] }) =>
    req<Payment>(`/mc/payments/${id}`, { method: "PUT", body: JSON.stringify(updates) }),

  // ── Notifications ─────────────────────────────────────────────────────
  getNotifications: (userId: string) => req<AppNotification[]>(`/mc/notifications/${userId}`),
  createNotification: (n: AppNotification) =>
    req<AppNotification>("/mc/notifications", { method: "POST", body: JSON.stringify(n) }),
  createNotificationsBatch: (ns: AppNotification[]) =>
    req<AppNotification[]>("/mc/notifications/batch", { method: "POST", body: JSON.stringify(ns) }),
  markNotificationRead: (id: string) => req<{ ok: boolean }>(`/mc/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: (userId: string) =>
    req<{ ok: boolean }>(`/mc/notifications/read-all/${userId}`, { method: "PUT" }),

  // ── Class Messages ────────────────────────────────────────────────────
  getMessages: (kelas: string) =>
    req<{ id: string; kelas: string; userId: string; text: string; createdAt: number }[]>(`/mc/messages/${encodeURIComponent(kelas)}`),
  postMessage: (msg: { id: string; kelas: string; userId: string; text: string }) =>
    req<{ id: string; kelas: string; userId: string; text: string; createdAt: number }>("/mc/messages", { method: "POST", body: JSON.stringify(msg) }),
  deleteMessage: (id: string) => req<{ ok: boolean }>(`/mc/messages/${id}`, { method: "DELETE" }),
};
