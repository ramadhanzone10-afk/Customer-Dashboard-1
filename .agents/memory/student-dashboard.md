---
name: Student dashboard architecture
description: How student-facing pages are built in MathClub and key patterns for future work
---

## Data layer
All student pages read/write via `useStore<T>(key, default)` (localStorage, reactive) — not direct API calls. The API (`mcApi.*`) is called as a fire-and-forget side-effect to sync the backend.

## Key types
- `Exam.type?: "exam" | "tugas"` — distinguishes Ujian from Tugas. Missing or "exam" = Ujian.
- `ExamSubmission.fullyGraded` — false when essay questions await manual grading.
- `Material.subject` / `Material.bab` — used for filtering in the materials page.

## What was enhanced
- materials.tsx: search + filter by subject (pill tabs) + bab (sub-filter)
- exams.tsx: Ujian / Tugas tabs with pending count badges
- progress.tsx: separate ujian/tugas history, dual-line chart (blue=ujian, amber=tugas), summaries
- dashboard.tsx: separate Ujian and Tugas upcoming cards, recent materials section, SPP success state

**Why:** Exam type field already existed but no UI separated them; subject/bab fields existed on Material but no filter UI existed.
