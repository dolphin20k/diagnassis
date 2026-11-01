# ARCHITECTURE

```
Browser ──► Next.js (Netlify) ──► Supabase (Auth, Postgres+RLS, RPC)
              │   server-only:        ▲
              ├── NVIDIA API ─────────┤ service role (AI bank, research, logs)
              ├── Cloudflare R2 (private PDF reports, presigned GET)
              └── Netlify scheduled fn ─► background fn ─► /api/cron/market-research
```

## Layout
`src/app/(public)` landing/auth/policies · `src/app/(student)` student app · `src/app/admin` admin console · `src/app/api/*` AI, diagnostics, reports, cron, admin routes · `src/lib/{ai,server,supabase,scoring,r2,report}` · `src/components/{ui,layout,auth,student,admin}` · `supabase/{migrations,tests}` · `netlify/functions` · `e2e/`.

## Principles
- **Supabase-first**: browser/server clients act as the user; **RLS + SECURITY DEFINER RPCs** enforce authorization. No custom backend.
- **Server-side grading**: answer keys are in `question_keys` (no grants, no policies); students call `submit_attempt`. The result is a snapshot, so later role edits never rewrite history.
- **Service role** (server-only) is used only where students must not write: AI question bank, custom-role estimates, research pipeline, report metadata, AI request log. Every such route authenticates the user first.
- **AI (NVIDIA)**: one OpenAI-compatible client (`lib/ai/nvidia.ts`): timeout, one retry on 429/5xx, JSON extraction, zod validation, one self-repair retry, call logging, hourly per-user budgets. Prompts treat user text as data (sanitised and JSON-encoded). On failure features degrade explicitly (template guidance labelled "not AI-written"); nothing is faked.
- **Reports**: PDF rendered with `@react-pdf/renderer`; if R2 configured it is stored privately and the user is redirected to a 5-minute presigned URL, otherwise streamed on demand.
- **Research cadence**: Netlify scheduled function (every 2 days) → background function → one request per role (`start` / `role` / `finish`), so each step fits serverless limits. Admins can run the same loop from the UI.
- **UI**: design tokens in `globals.css` (`@layer base` + Tailwind theme), Manrope + Source Sans 3, Lucide icons, accessible dialogs/tabs/forms, mobile tab bar (<760px) and admin drawer (<900px).

## Environment strategy
`.env.example` documents every variable (browser-safe vs server-only, required vs optional). `NEXT_PUBLIC_*` are build-time constants.
