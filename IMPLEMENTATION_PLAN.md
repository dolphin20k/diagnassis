# IMPLEMENTATION_PLAN

| Task | Reqs | Status |
|---|---|---|
| P0 Inspect inputs, spec, matrix, architecture | all | Done |
| P1.1 Schema, constraints, indexes | 001–021 | Done — applied to local PG16 and remote PG17 |
| P1.2 RLS + grants | all | Done — 28 DB tests + remote checks |
| P1.3 RPCs (lifecycle, admin, deletion, policy) | 002–020 | Done |
| P1.4 NVIDIA client + features (questions, estimate, insights, research, review) | 005,006,009,010,021 | Done — unit-tested with mocked API; live call blocked by sandbox |
| P1.5 R2 module, PDF, report route | 016 | Done — bucket created; live put/get needs API token |
| P1.6 Cron/background functions, admin research UI | 006 | Done — not run live |
| P2 Public site, auth, student app, admin console | 001–020 | Done |
| P3 Integration against live services | all | **Partially blocked** (sandbox cannot reach Supabase API/NVIDIA) |
| P4 Tests, a11y, build, security review | all | Done for what is runnable; see TEST_REPORT.md |
| Docs & handoff | — | Done |
