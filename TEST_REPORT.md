# TEST_REPORT

## Environment
Linux sandbox, Node 22, local PostgreSQL 16 (disposable cluster, emulated Supabase `auth` schema), Chromium via Playwright 1.63. **Egress to `*.supabase.co` and `integrate.api.nvidia.com` is blocked in the sandbox**; Supabase was reachable only through the MCP connector.

## Results (final run)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint .` | PASS (0 problems) |
| `npx vitest run` | **79/79** passed — 10 files: scoring, weights, sanitising, safe-redirect, validation, NVIDIA client (retry, timeout, no key leakage), AI features, research rules, R2 keys/presign/validation, TestRunner (autosave, offline queue, retry, submit, failure), RoleEditor (100% rule), SkillPicker |
| `npm run test:db` | **28/28** passed (RLS, tenant isolation, role-escalation, key secrecy, grading, delta, limits, custom role, policy versioning, admin RPC denial, weight trigger, deletion cascade/denial, feedback, notification prefs) |
| `npx playwright test` (production build, desktop 1280 + mobile 390) | **60/60** passed (30 × 2): landing, validation copy, strength meter, visibility toggle, network-failure handling, guards for 8 private routes, API 401s, cron 403, signout 405, no open redirect, security headers, 404, WCAG2 A/AA axe scans (landing, signup), no horizontal scroll, screenshots |
| Real Supabase project (MCP SQL, rolled back) | 16 behavioural checks + 5 deletion checks passed |
| Supabase advisors | 0 errors; 21 WARN (intended RPCs), 1 INFO (`question_keys`) |
| `npm audit --omit=dev` | 3 findings (zod, postcss×2) — documented in SECURITY.md |

## Defects found and fixed during testing
Unlayered base CSS overrode Tailwind text colours (real a11y/contrast bug); lucide icons rendered filled (`fill={undefined}`); auth forms hung on thrown network errors; autosave effect re-subscribed on router identity change; landing/reset pages needed `force-dynamic` for env-less builds; `@supabase/ssr` 0.6 incompatible with supabase-js 2.118 types (upgraded 0.12.7); AI insights budget check still called the model (now skipped).

## NOT run / not verifiable here
- Any flow through the running app against live Supabase (login, onboarding, diagnostic, results, admin pages) — only pieces (DB/RPC, components with mocks, public e2e) were verified.
- Live NVIDIA calls (generation, estimation, insights, research); only mocked-HTTP tests.
- PDF rendering (`@react-pdf/renderer`) and R2 put/get — code present, build passes, not executed.
- Google OAuth, email delivery, Netlify scheduled/background functions.
- Visual comparison: landing/auth screens compared by eye with the design (close match); student/admin screens not screenshot-compared (need a live session).
- Authenticated Playwright journeys (need a reachable backend).
