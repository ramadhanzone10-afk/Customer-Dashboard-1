import type {
  User,
  Material,
  MaterialProgress,
  Exam,
  ExamSubmission,
  Payment,
  AppNotification,
  ClassMessage,
  QuestionBankItem,
  MaterialBankItem,
} from "./types";

const PREFIX = "mathclub:v1:";

type StoreMap = {
  users: User[];
  materials: Material[];
  materialProgress: MaterialProgress[];
  exams: Exam[];
  examSubmissions: ExamSubmission[];
  payments: Payment[];
  notifications: AppNotification[];
  session: { userId: string } | null;
  classes: string[];
  classMessages: ClassMessage[];
  questionBank: QuestionBankItem[];
  materialBank: MaterialBankItem[];
};

type Listener = () => void;
const listeners = new Map<keyof StoreMap, Set<Listener>>();

function notify(key: keyof StoreMap) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function read<K extends keyof StoreMap>(key: K, fallback: StoreMap[K]): StoreMap[K] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as StoreMap[K];
  } catch {
    return fallback;
  }
}

export function write<K extends keyof StoreMap>(key: K, value: StoreMap[K]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  notify(key);
  // Notify other tabs
  window.dispatchEvent(new StorageEvent("storage", { key: PREFIX + key }));
}

export function subscribe<K extends keyof StoreMap>(key: K, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);

  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === PREFIX + key) fn();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.get(key)?.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function clearAll() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}
