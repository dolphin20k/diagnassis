# HANDOFF

**Overall status: IMPLEMENTED WITH DOCUMENTED LIMITATIONS.**

## What was built
Full product from the MVP + design handoff: public site, auth, policy acceptance, onboarding, diagnostic (role → skills → untimed MCQ with autosave/resume/offline queue → review → server-graded result), readiness score/bands, skill-gap view, AI action plan with learning-resource searches, market trends, history, notifications, profile, settings (password, prefs, deletion request), feedback, PDF report (R2-backed), and an admin console (dashboard, students, analytics, roles & skills with weights/suggestions/typed roles & skills/research runner, feedback, policies with versioning, deletion workflow, notifications, settings/integration health).

## AI (NVIDIA)
Question generation (bank top-up per skill), custom-role requirement estimation, personalised insights, market research + AI review/auto-approval — all via `NVIDIA_API_KEY` server-side (`src/lib/ai`). Honest limits: no live job-listing data; outputs labelled AI-assisted; template fallbacks are labelled.

## Database / backend
Supabase project `drghfaovsfanymmhximd`: schema, RLS, RPCs, seed applied; behaviour verified on the real project (see TEST_REPORT.md, DATABASE.md). R2 bucket `diagnassis-reports` created.

## Quality
typecheck ✔ lint ✔ 79 unit/component ✔ 28 DB ✔ 60 e2e ✔ production build ✔. Design fidelity: landing/auth compared against the design and closely match; other screens follow the specs but were not screenshot-compared.

## Known issues / unverified
1. **Live end-to-end was not possible** (sandbox blocks Supabase API & NVIDIA). Run the checklist in DEPLOYMENT.md §7 first — expect to fix small integration issues.
2. NVIDIA models are tried in order (`NVIDIA_MODEL` first, then built-in defaults) and retired ones (404/410) are skipped automatically.
3. PDF generation and R2 upload unexecuted. 4. Google OAuth & email unverified. 5. Netlify function timeouts may require a higher limit. 6. `npm audit`: zod 3 / postcss advisories (SECURITY.md). 7. No CSP, no CAPTCHA.
8. Hand-written DB types (`src/lib/types/database.ts`) — regenerate with `supabase gen types` once the CLI is available.

## Manual configuration required
R2 API token, Netlify env vars, Supabase Auth URLs/Google/SMTP, admin promotion SQL (DEPLOYMENT.md).

## Run locally
`npm install && cp .env.example .env.local` (fill) `&& npm run dev`.

## Next steps
Complete DEPLOYMENT.md checklist → fix integration findings → add authenticated Playwright journeys against a test project → upgrade zod/Next → add CSP + Turnstile.


## Fixes from local testing (14 Nov 2026)
**Apply `supabase/migrations/20261114000001_beginner_diagnostic_and_variety.sql` to the Supabase project** (beginner diagnostics, unseen-first question selection, IST analytics days). Everything else is code-only.
- Root cause of "could not estimate that role" and every market-research failure: NVIDIA retired `meta/llama-3.3-70b-instruct` (HTTP 410). The AI client now tries `NVIDIA_MODEL`, then built-in live models, skipping retired ones.
- PDF title/details overlap fixed; stored R2 reports are versioned (`REPORT_LAYOUT_VERSION`) so old PDFs regenerate.
- Notification dropdown + profile popover (student and admin), admin Change Password, real YouTube videos with thumbnails, per-attempt question variety (pool of 20 per skill), "I don't know any of these skills" button + beginner roadmap, custom branch, clearer analytics chart.

### AI model outage (16 Nov 2026)
NVIDIA retired llama-3.1-nemotron-70b, mistral-large-2 and mistral-nemo on 15 Nov, and gpt-oss-20b stopped answering, so every AI call timed out.
The client now (1) asks NVIDIA which models the key can use, (2) prefers models measured to answer in about 1 s,
(3) sends `enable_thinking: false` (current models are reasoning models whose thinking used up the answer budget),
(4) races a second model when the first is slow, and (5) unwraps replies the model nested in an extra key.
Verified with real calls: role estimation, market research, suggestion review, question generation and insights all succeed.
