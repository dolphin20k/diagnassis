# DATABASE

Migrations (`supabase/migrations`, apply in order): `…01_core_schema`, `…02_rls_policies`, `…03_functions`, `…04_seed`. (On the remote project they were applied in equivalent split parts — see DEPLOYMENT.)

## Tables (20, all RLS-enabled)
profiles · roles · skills · role_skills (weights total 100, deferred constraint trigger) · questions · question_keys (no API access) · custom_role_estimates · attempts · attempt_questions · notifications · feedback · policies · policy_acceptances · deletion_requests · reports · market_research_runs · skill_suggestions · activity_log · app_settings · ai_requests.

## Key constraints
Unique one in-progress attempt per user; unique pending deletion per user; one result rating per attempt; general feedback ≥ 10 chars; storage key format `reports/<uuid>/<uuid>.pdf`; year ∈ {3rd,4th}; notification links must be relative paths.

## RPCs (SECURITY DEFINER, `search_path=''`, execute revoked from PUBLIC/anon)
Student: `pending_policies`, `accept_policies`, `start_attempt`, `save_answer`, `submit_attempt`, `save_attempt_insights`, `mark_*_read`, `request/cancel_account_deletion`. Admin (`is_admin()` inside): `admin_dashboard`, `admin_analytics`, `admin_list_students`, `admin_typed_skills`, `admin_publish_policy`, `admin_save_role_skills`, `admin_create_role`, `admin_promote_custom_role`, `admin_set_role_active`, `admin_set_attempt_limit`, `admin_resolve_deletion`. Service-role only: `service_apply_role_update`, `replace_role_skills`, `create_notification`, `notify_admins`.

## Authorization summary
| Table | Student | Admin | Anon |
|---|---|---|---|
| profiles | read/update own (column-level: no role/email/id) | read all | – |
| roles, skills, role_skills | read (active roles) | read/write | – |
| questions | read active (no keys) | read | – |
| attempts, attempt_questions | read own | read all | – |
| notifications | read own | read own | – |
| feedback | insert/read own | read all | – |
| policies | read | read | read |
| deletion_requests, reports, policy_acceptances | read own | read all | – |
| research/suggestions/activity/ai_requests | – | read | – |

## Seed
8 curated roles (weights from the design), 45 skills, 47 starter questions (from the prototype), Terms v2.1, Privacy v1.4, `attempt_limit=5`.

## Status
Applied to Supabase project `drghfaovsfanymmhximd` (Postgres 17). Advisors: no errors; 21 expected WARNs (the authenticated RPC surface, each self-authorising) and 1 INFO (`question_keys` deny-all by design).
