# PROJECT_STATE (checkpoint)

Project: DIAGNASSIS (career-readiness diagnostic) | Branch: `claude/sweet-noether-9f0n2m`
Last verified checkpoint: backend schema + DB tests + AI/R2/server libs + unit tests (see below).

## Phase status
- Phase 0 (discovery): inputs inspected (design ZIP handoff, MVP PDF). Docs being written alongside code.
- Phase 1 (backend): migrations 1-4 written; 27 DB tests pass on local Postgres 16. API routes + AI + R2 + research pipeline written.
- Phase 2 (frontend): UI kit + theme done; pages in progress.
- Phase 3/4: not started.

## Verified so far
- `npm run test:db` -> 27/27 pass (local PG16 with Supabase auth stub).
- `npm test` -> 67/67 unit tests pass. `npx tsc --noEmit` clean.

## Known environment blockers
- Sandbox egress blocks *.supabase.co and integrate.api.nvidia.com; R2 not enabled on the Cloudflare account.
- Remote Supabase project `drghfaovsfanymmhximd` (empty) reachable only through MCP; migrations NOT yet applied there.

## Next actions
1. Finish student + admin pages, auth pages, actions.
2. Playwright e2e, lint, build.
3. Apply migrations to remote via MCP, run advisors.
4. Docs: PROJECT_SPEC, FEATURE_MATRIX, ARCHITECTURE, IMPLEMENTATION_PLAN, DECISIONS, DATABASE, SECURITY, TEST_REPORT, DEPLOYMENT, HANDOFF, README.
