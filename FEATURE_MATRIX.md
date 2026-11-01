# FEATURE_MATRIX

Status legend — **V**: verified by automated tests in this repo · **I**: implemented, not verifiable in the sandbox (needs live Supabase/NVIDIA/R2) · evidence in [TEST_REPORT.md](TEST_REPORT.md).

| # | Feature (MVP) | Req | UI | DB / RPC | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|
| 1 | Website | 001 | `/`, `/terms`, `/privacy` | `policies` | public read | e2e (render, a11y, responsive) | **V** |
| 2 | Login & signup | 002 | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*` | Supabase Auth, `handle_new_user` | middleware + server guards; role from DB only | e2e validation + guards; DB signup/role tests | validation/guards **V**; live auth **I** |
| 3 | T&C / Privacy | 003 | `/accept-policies`, `/admin/policies` | `policies`, `policy_acceptances`, `pending_policies`, `accept_policies`, `admin_publish_policy` | admin-only publish; stale version rejected | DB tests (re-acceptance, versioning) | DB **V**; UI **I** |
| 4 | Basic student details | 004 | `DetailsGate` dialog, `ProfileForm` | `profiles` (column-level grants) | own row only; role/email immutable | DB (escalation), unit (zod) | DB/validation **V**; UI **I** |
| 5 | Diagnostic assessment | 005, 019 | `/diagnostic`, `/diagnostic/[id]` | `start_attempt`, `save_answer`, `submit_attempt`, `question_keys` | owner-only; keys never exposed | DB (lifecycle, grading, limit, isolation); component (autosave/offline/submit) | DB+component **V**; AI generation **I** |
| 6 | Job-market requirements engine | 006, 021 | `/admin/roles` (+ cron) | `skill_suggestions`, `market_research_runs`, `service_apply_role_update` | service role / admin | unit (rules, AI client mocked) | logic **V**; live AI/cron **I** |
| 7 | Skill-gap visualizer | 007 | `/results/[id]`, dashboard | `attempts.result` | owner | scoring unit tests | **V** (logic) |
| 8 | Readiness score | 008 | results | `submit_attempt`, `band_for` | server-side grading | DB score/band/delta tests | **V** |
| 9 | Actionable items | 009, 021 | results | `attempts.insights`, `save_attempt_insights` | owner | unit (rank, fallback, AI mocked) | logic **V**; live AI **I** |
| 10 | Market trend insights | 010 | results, dashboard | `role_skills.trend` | role-readable | unit | logic **V** |
| 11 | History | 011 | `/history` | `attempts` | owner | — (DB isolation) | **I** |
| 12 | Admin dashboard | 012 | `/admin`, `/admin/students[/id]` | `admin_dashboard`, `admin_list_students` | `is_admin()` | DB + remote RLS run | DB **V**; UI **I** |
| 13 | Analytics | 013 | `/admin/analytics` | `admin_analytics` | `is_admin()` | DB (forbidden for students) | **I** |
| 14 | My profile | 014 | `/profile` | `profiles` | owner | as #4 | **I** |
| 15 | Notifications | 015 | `/notifications`, `/admin/notifications` | `notifications`, `create_notification`, prefs | owner only; no client writes | DB (prefs, read, isolation) | DB **V** |
| 16 | Downloadable reports | 016 | results → `/api/reports/[id]` | `reports`, R2 | owner-only; presigned 5 min | unit (R2 keys/signing/validation) | R2 logic **V**; PDF render + live R2 **I** |
| 17 | Settings | 017, 020 | `/settings`, `/admin/settings` | `request_account_deletion`, `admin_resolve_deletion`, `app_settings` | owner / admin | DB (deletion cascade, denial) incl. remote | DB **V** |
| 18 | Feedback | 018 | `/feedback`, results rating, `/admin/feedback` | `feedback`, trigger | own insert; admin read | DB (constraints, alerts) | DB **V** |
