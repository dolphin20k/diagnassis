# DEPLOYMENT (preparation only — nothing has been deployed)

## Provisioned resources
- Supabase project `drghfaovsfanymmhximd` (eu-north-1, Postgres 17): schema, RLS, RPCs and seed applied and verified.
- Cloudflare R2 bucket `diagnassis-reports` (private, default jurisdiction). **Still needed from you:** an R2 API token.

## 1. Environment variables (Netlify → Site settings → Environment)
See `.env.example` for purpose / scope of each. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `NVIDIA_API_KEY` (secret), `CRON_SECRET` (secret, `openssl rand -hex 32`). R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=diagnassis-reports`. Optional: `NVIDIA_MODEL`, `NVIDIA_BASE_URL`, `NVIDIA_TIMEOUT_MS`, `R2_ENDPOINT`. `NEXT_PUBLIC_*` are baked in at build time — redeploy after changing them.
Supabase URL and publishable key: Project Settings → API (URL `https://drghfaovsfanymmhximd.supabase.co`).

## 2. Create the R2 API token
Cloudflare Dashboard → R2 → **Manage R2 API Tokens** → Create token → *Object Read & Write*, scoped to bucket `diagnassis-reports`. Copy Access Key ID + Secret (shown once) and your Account ID. Keep the bucket **private** (do not enable public access / r2.dev). No CORS is needed (downloads are server-issued redirects).

## 3. Supabase Auth configuration
- Authentication → URL Configuration: Site URL = your Netlify URL; add Redirect URLs `https://<site>/auth/callback` (and `http://localhost:3000/auth/callback`).
- Providers: enable **Google** (Google Cloud OAuth client; authorised redirect `https://drghfaovsfanymmhximd.supabase.co/auth/v1/callback`).
- Email: keep "Confirm email" on; configure custom SMTP for production volume (default SMTP is heavily rate-limited).
- Password policy: minimum 8 chars (the app enforces 8+, upper, digit, symbol).

## 4. Admin bootstrap
The admin signs up like a student, then run once in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'admin@your-domain.example';
```
(the API cannot do this; `auth.uid()` is null in the SQL editor so the protection trigger allows it).

## 5. Database migrations
`supabase link --project-ref drghfaovsfanymmhximd` then `supabase db push` for *new* environments. This project already has the schema (applied via the MCP connector in parts: core_schema, rls_policies, functions_a/b1/c, seed, function_admin_resolve_deletion — equivalent content to the four files in `supabase/migrations`). **Do not push the repo files onto this project again**; for it, add new incremental migrations only. Never run the local test bootstrap (`supabase/tests/bootstrap-local.sql`) against a real project.

## 6. Netlify
`netlify.toml` configures `@netlify/plugin-nextjs`, Node 22, and scheduled/background functions in `netlify/functions` (scheduled function runs every 2 days at 01:00 UTC and triggers the background function, which drives `/api/cron/market-research` role by role with `CRON_SECRET`). Scheduled functions only run on the published production deploy. Set `maxDuration`-compatible plan limits: AI routes can take 10–60 s (question generation on first use of a skill) — confirm your Netlify plan's function timeout (default 10 s may be too short; request 26 s+ or move to a plan that allows it).

## 7. Pre-deployment checklist
- [ ] Env vars set; `NEXT_PUBLIC_SITE_URL` correct
- [ ] Auth URLs + Google provider configured; SMTP configured
- [ ] Admin promoted; log in and open /admin → Settings → *Integrations* shows NVIDIA/service role/R2/cron as OK
- [ ] Take one full diagnostic end to end; download the PDF (confirm an object appears in R2)
- [ ] Run "Run market research now" once
- [ ] Rotate any key that was ever pasted into chat
- [ ] Review SECURITY.md known risks (zod/postcss audit, CSP)

## Rollback
Netlify: re-publish the previous deploy. Database: migrations are additive; to undo a data/schema change write a reverse migration (take a Supabase backup first). R2 objects are only reports and can be regenerated from stored results.
