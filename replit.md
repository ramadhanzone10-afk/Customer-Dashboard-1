# MathClub

Indonesian-language online learning platform (bimbel) for math tutoring.
Two roles: **Guru** (Teacher) and **Siswa** (Student).

## Features

- **Login** with role-based routing (teacher / student)
- **Materi** (Materials): teacher creates content with optional file upload and study timer; students browse, view, mark as complete
- **Ujian** (Exams): teacher builds quizzes with multiple-choice + essay questions, sets duration and deadline; student takes exam with countdown timer that auto-submits when time expires; teacher grades essay answers
- **Pembayaran** (Payments): monthly SPP tracking; student uploads proof of payment, teacher verifies/rejects/sends reminders
- **Progres**: students see materials/exam completion, average grade, line chart of grade history
- **Notifikasi**: in-app notifications for new materials, new exams, payment reminders, graded exams, payment uploads

## Architecture

- Single React + Vite SPA artifact at `artifacts/relationships/` (slug name preserved from previous template; user-facing title is "MathClub")
- All data persists to **localStorage** under the `mathclub:v1:` key prefix — no backend required for MVP
- Custom subscribable store in `src/lib/storage.ts` with React hook `useStore` for live updates across tabs
- `src/lib/seed.ts` populates demo data on first load (1 teacher, 3 students, materials, exams, payments, notifications)
- Routing via wouter; protected routes enforce role
- UI built with shadcn/ui + Tailwind, charts via recharts, icons via lucide-react

## Demo Accounts

- **Teacher**: `guru@mathclub.id` / `guru123` (Pak Budi)
- **Students**: `andi@mathclub.id`, `siti@mathclub.id`, `rudi@mathclub.id` — all password `siswa123`

## Project structure

- `src/App.tsx` — router with role-protected routes
- `src/components/layout.tsx` — sidebar + header + notification dropdown
- `src/lib/{types,storage,auth,seed,format}.ts` — data layer
- `src/pages/login.tsx` — login screen with quick-login demo buttons
- `src/pages/teacher/*` — dashboard, students, materials, exams, exam-results, payments
- `src/pages/student/*` — dashboard, materials, material-view, exams, take-exam, exam-result, progress, payments

## Reset demo data

To reset the localStorage seed, run in browser console:
```js
Object.keys(localStorage).filter(k => k.startsWith('mathclub:')).forEach(k => localStorage.removeItem(k));
location.reload();
```
