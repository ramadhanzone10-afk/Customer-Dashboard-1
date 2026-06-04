---
name: Vercel Deploy Config
description: vercel.json setup, required env vars, and build command for MathClub LMS
---

## Build command (vercel.json)
`pnpm install --frozen-lockfile=false && pnpm --filter @workspace/api-server run build && cd artifacts/relationships && BASE_PATH=/ node_modules/.bin/vite build --config vite.config.ts`

## outputDirectory
`artifacts/relationships/dist/public`

## Serverless function
`api/index.js` exports the Express app from `artifacts/api-server/dist/handler.mjs` (2MB bundle — within Vercel limits)

## Required Vercel env vars
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret for JWT signing (dev fallback: "mc-dev-only-secret-not-for-production")

## Rewrites
- `/api/(.*)` → `/api/index` (serverless handler)
- `/((?!api/).*)` → `/index.html` (SPA fallback)

**Why:** Both frontend and API builds must pass before deploying. The `.migration-backup/*` workflows always fail — ignore them.
