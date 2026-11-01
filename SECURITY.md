# SECURITY

## Authentication
Supabase Auth (email+password, Google). Server code validates the JWT with `auth.getUser()` (never trusts cookies/`getSession`). Middleware redirects guests; API routes return 401. Role comes **only** from `profiles.role`; sign-up metadata is ignored (tested). Open redirects blocked (`safeNext`). Sign-out is POST-only. Forgot-password gives an identical response whether or not the account exists.

## Authorization & RLS
Every table has RLS; no policy = deny. Students cannot write most tables directly; changes go through RPCs that check `auth.uid()`. Profile columns `role/email/id/created_at` are immutable for users (column grants + trigger). Admin RPCs check `is_admin()`. Answer keys have no grants. RPC execute is revoked from `PUBLIC`/`anon`.

## Secrets
`SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `R2_*`, `CRON_SECRET` are server-only (`server-only` imports). No secret appears in `.env.example`, logs or client bundles. Real env files are git-ignored.

## AI safety
User-controlled strings (skill/role names) are sanitised to a conservative charset and passed only inside JSON `input`; system prompts instruct models to treat them as data. All model output is zod-validated; invalid output never reaches storage. Per-user hourly budgets limit cost abuse. Errors from the NVIDIA API never echo response bodies.

## Storage (R2)
Private bucket; keys built only from server-verified UUIDs and validated by regex (also a DB check); content must start with `%PDF-` and ≤ 10 MB; downloads only via 5-minute presigned URLs issued after an ownership check (RLS); account deletion removes the user's R2 objects first and aborts if cleanup fails.

## Web hardening
Headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed. Cron endpoint uses constant-time bearer comparison.

## Checks performed
DB tests (28) incl. escalation, key secrecy, tenant isolation, admin-RPC denial, deletion cascade; the same behaviours re-run on the real Supabase Postgres 17 (16 + 5 checks, rolled back); Supabase advisors; Playwright guards/headers/a11y; `npm audit`.

## Known risks / TODO
- `npm audit --omit=dev`: **zod 3.x** (DoS on oversized constrained collections; fixed in zod ≥ 4.6.6 — a breaking upgrade not applied; all arrays are length-bounded and bodies small) and **postcss** nested in Next (build-time CSS only; fixed with a Next upgrade). Plan: upgrade zod 4 and Next after regression testing.
- No CAPTCHA/rate-limit on sign-up beyond Supabase's built-in limits; add Cloudflare Turnstile if abused.
- Admin accounts are created by SQL promotion; use a strong, MFA-protected Supabase account for that user.
- No Content-Security-Policy yet (Next inline scripts need nonce setup).
- Not independently pen-tested; "no obvious issues" ≠ "secure".
