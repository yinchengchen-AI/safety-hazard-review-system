# Repository Guidelines

Contributor guide for the **Safety Hazard Review System**: Next.js 15 / React 18 / Prisma 6 + PostgreSQL / MinIO / NextAuth v5 (beta) / node-cron / Tailwind + Radix / `@ducanh2912/next-pwa` for offline.

## Project Structure & Module Organization

- `src/app/` — App Router by feature (`admin/`, `cases/`, `me/`, `api/`, `login/`, `stats/`); handlers in co-located `route.ts`.
- `src/components/` — `ui/` primitives + `admin/`, `workbench/`, `case/` folders.
- `src/services/` — business logic (unit-testable core). `src/lib/` — auth, db, storage, validation, logging.
- `src/workers/` — node-cron jobs (`scanDeadlines`, `scanRecycle`).
- `src/pwa/` — client offline layer (IndexedDB, sync worker, manifest).
- `tests/unit/`, `tests/integration/` — Vitest; `tests/e2e/` — Playwright.
- `prisma/` — schema, migrations, `seed.ts`. Alias `@/*` → `src/*`.

## Build, Test, and Development Commands

- `npm run dev` — Next dev on :3000. `npm run build` / `npm start` — production.
- `npm run lint` — ESLint (`next/core-web-vitals` + `next/typescript` + `prettier`).
- `npm test` — Vitest one-shot. `npm run test:watch` for watch; `npm run test:cov` for coverage.
- `npm run test:e2e` — Playwright (needs dev server up + seeded DB).
- `npx prisma migrate dev` / `npx prisma db seed` — schema + 4 demo users (password `password123`).
- `docker compose --profile infra up -d` — Postgres + MinIO for hybrid local dev.

## Coding Style & Naming Conventions

- TypeScript strict, 2-space indent. Prettier: `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`.
- ESLint: unused-vars is a warning; `_`-prefixed args ignored.
- Components: `PascalCase.tsx`. Hooks: `use-thing.ts`. Services: `kebab-case.ts` (pure functions). Handlers: `route.ts`.
- Use the `@/` alias; avoid deep relative paths.

## Testing Guidelines

- Unit/integration: Vitest + jsdom (`tests/setup.ts`). Coverage on `src/services/`, `src/lib/`, `src/workers/` only — API routes and PWA are covered by E2E and manual smoke.
- v8 thresholds: lines 25% / functions 23% / branches 17% / statements 25%.
- E2E in `tests/e2e/`: login, full happy path, reject + resubmit, offline sync.
- Unit file naming: `<service>.test.ts` mirroring `src/services/`. Prefer real Prisma / testcontainers over heavy mocks.

## Commit & Pull Request Guidelines

- Conventional Commits with scope: `feat(api):`, `feat(pwa):`, `feat(ui):`, `fix(types):`, `test(e2e):`, `chore(test):`, `ops:`.
- Subject ≤ ~72 chars, imperative, no trailing period.
- PRs: short what + why, link the issue, list verification (`npm test`, `npm run test:e2e`, UI screenshot if applicable), call out schema or env changes explicitly.

## Security & Configuration Tips

- Never commit `.env`; copy from `.env.example` (`DATABASE_URL`, `MINIO_*`, `AUTH_SECRET`).
- Uploads go through `src/lib/storage.ts` (MinIO signed URLs) — bypass only in tests.
- `src/middleware.ts` enforces auth; matcher excludes `api/auth`, `api/health`, `api/photos`, `_next/*`, and PWA assets — keep in sync when adding public routes.
- Dev PWA is disabled in `next.config.ts` to avoid stale service-worker caches.
