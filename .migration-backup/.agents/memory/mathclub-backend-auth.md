---
name: MathClub backend auth
description: How user accounts and classes are persisted to PostgreSQL via api-server; write-through cache pattern with localStorage.
---

## Architecture

- **API server** (`artifacts/api-server`) handles `/api/mc/...` routes.
- **Tables**: `mc_users` (id, email, password, name, role, avatarColor, kelas, phone, createdAt), `mc_settings` (key, value as JSON) in PostgreSQL via Drizzle.
- **SPA** (`artifacts/relationships`) keeps localStorage as a client-side cache, syncing from the API on mount + every 30s + on window focus.

## Key files

- `lib/db/src/schema/mathclub.ts` — Drizzle schema for `mc_users` and `mc_settings`
- `artifacts/api-server/src/routes/mathclub.ts` — REST endpoints: login, CRUD users, get/update classes
- `artifacts/relationships/src/lib/api-client.ts` — typed fetch wrapper (`mcApi.*`)
- `artifacts/relationships/src/lib/auth.tsx` — AuthProvider syncs from API on mount; login tries API first, falls back to localStorage
- `artifacts/relationships/src/lib/seed.ts` — `ensureDefaultUsers()` seeds demo accounts to DB if teacher not present

## Write-through pattern

All user/class mutations write to localStorage first (instant UI), then fire-and-forget `mcApi.*` call. On next sync the API response reconciles any drift.

**Why:** Gives immediate UI feedback even if API is slow; API is source of truth on page refresh.

## Demo accounts seeded in DB

- `guru@mathclub.id` / `guru123` (teacher, id: u_teacher)
- `andi@mathclub.id` / `siswa123` (student X-1, id: u_andi)
- `siti@mathclub.id` / `siswa123` (student XI-1, id: u_siti)
- `rudi@mathclub.id` / `siswa123` (student XII-1, id: u_rudi)

## API routes

- `POST /api/mc/auth/login` — returns user without password; 401 on mismatch
- `GET /api/mc/users` — all users without passwords
- `POST /api/mc/users` — create; 409 if email exists
- `PUT /api/mc/users/:id` — partial update (name, kelas, phone, avatarColor, password)
- `DELETE /api/mc/users/:id`
- `GET /api/mc/classes` — returns string[] from mc_settings; defaults to 36-class list if not set
- `PUT /api/mc/classes` — upserts to mc_settings

## Vercel note

For Vercel deployment, set `VITE_API_URL` to the Replit API server domain (e.g. `https://xxx.replit.dev`). Default is empty string (relative URL works on Replit's shared proxy).
