# DIAGNASSIS — Career Readiness Diagnostic

A platform for 3rd/4th-year engineering students that compares their tested skills with current job-market requirements, shows skill gaps, a readiness score, market trends and a personalised action plan, and produces a downloadable PDF report. Admins curate roles and skills, review feedback, publish policies and handle deletion requests.

**Status: IMPLEMENTED WITH DOCUMENTED LIMITATIONS** — see [HANDOFF.md](HANDOFF.md) and [TEST_REPORT.md](TEST_REPORT.md).

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS, RPC) · NVIDIA API (OpenAI-compatible, all AI features) · Cloudflare R2 (private report storage) · Netlify (hosting + scheduled functions).

## Prerequisites
Node 22 (≥ 20.9), npm, a Supabase project, an NVIDIA API key, optionally Cloudflare R2. For database tests: a local PostgreSQL 15+ superuser connection.

## Setup
```bash
npm install
cp .env.example .env.local   # fill in values; see DEPLOYMENT.md
```
Apply the schema: link the Supabase CLI and run `supabase db push` (files in `supabase/migrations/`). Then follow the **Admin bootstrap** and **Supabase Auth configuration** sections of [DEPLOYMENT.md](DEPLOYMENT.md).

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm test` | Unit + component tests (Vitest) |
| `TEST_DATABASE_URL=postgresql://postgres@localhost:5432/diagnassis_test npm run test:db` | RLS / RPC tests against a **disposable** Postgres (db name must end in `_test`) |
| `npm run test:e2e` | Builds with placeholder env and runs Playwright (public pages, validation, route protection, headers, a11y, desktop + mobile) |

## Documentation
[PROJECT_SPEC](PROJECT_SPEC.md) · [FEATURE_MATRIX](FEATURE_MATRIX.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [SECURITY](SECURITY.md) · [DECISIONS](DECISIONS.md) · [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) · [TEST_REPORT](TEST_REPORT.md) · [DEPLOYMENT](DEPLOYMENT.md) · [HANDOFF](HANDOFF.md) · [PROJECT_STATE](PROJECT_STATE.md)

Design source: the supplied design-system handoff (tokens, fonts, logo, Lucide icons, reference screens). Fonts are OFL-licensed (licences in `src/app/fonts/`).
