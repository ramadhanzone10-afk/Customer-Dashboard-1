import { write } from "./storage";
import { mcApi } from "./api-client";

const CLASSES_VERSION_KEY = "mathclub:v1:classes_version";
const CLASSES_VERSION = "v3";

const DEFAULT_CLASSES: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `X-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `XI-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `XII-${i + 1}`),
];

export function ensureSeed() {
  if (typeof window === "undefined") return;
  const classesVersion = window.localStorage.getItem(CLASSES_VERSION_KEY);
  if (classesVersion !== CLASSES_VERSION) {
    write("classes", DEFAULT_CLASSES);
    window.localStorage.setItem(CLASSES_VERSION_KEY, CLASSES_VERSION);
  }
}

const OLD_SEED_IDS = ["u_teacher", "u_andi", "u_siti", "u_rudi"];

export async function ensureDefaultUsers() {
  try {
    const existing = await mcApi.getUsers();
    for (const id of OLD_SEED_IDS) {
      if (existing.some((u) => u.id === id)) {
        await mcApi.deleteUser(id).catch(() => {});
      }
    }
    const classes = await mcApi.getClasses();
    if (classes.length === 0) {
      await mcApi.updateClasses(DEFAULT_CLASSES).catch(() => {});
    }
  } catch {
    // API not available, skip
  }
}

export async function ensureBackendContent() {
  // No default content to seed — data is created by teachers/students
}
