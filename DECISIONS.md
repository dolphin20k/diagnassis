# DECISIONS

1. **Next.js 15 / React 19 / Tailwind 4 / TS 5 / ESLint 9 / Vitest 3** — stable generation I could verify; the registry also serves newer majors (Next 16, TS 7…) that were not adopted blindly.
2. **Server-side grading in SQL** — answer keys never leave the DB; results are immutable snapshots of requirements/trends.
3. **Service role only where students must not write** (question bank, estimates, research, report metadata). Unavoidable for AI features; documented and server-only.
4. **AI = NVIDIA OpenAI-compatible API** (`meta/llama-3.3-70b-instruct` default, `NVIDIA_MODEL` overridable). No web access exists, so "market research" is AI-assisted estimation; the UI/PDF label it as such and no statistics are invented (the prototype's "71% of 1,840 listings" evidence strings were *not* reproduced).
5. **Learning resources = AI-suggested search queries** linked to YouTube/web search (the prototype also used YouTube search URLs); no hallucinated URLs/durations/channels.
6. **Research cadence** — Netlify scheduled → background function → per-role requests (serverless time limits). Suggestions are AI-reviewed on the *next* run (matches "approved 2 days after suggested"); every change is bounded (≤ ±8 weight, ≤ 10 new weight, 5–12 skills, ≤ 6 changes/run).
7. **PDF** via `@react-pdf/renderer` (server), stored in R2 when configured, otherwise streamed — a missing R2 never blocks a student.
8. **Custom ("Others") roles**: estimated once, cached, counted, and admins can promote them to curated roles.
9. **Attempt limit counts every attempt** (incl. in-progress); one in-progress at a time.
10. **Applied schema to the empty Supabase project via MCP** (additive, new project). Remote history shows the functions migration split into parts because one oversized call timed out; repo files remain the canonical order.
11. **Local DB tests use an emulated Supabase `auth` schema** (disposable DB only); the remote project re-verified key behaviours with the real `auth` schema.
12. `NEXT_PUBLIC_*` inlined at build ⇒ e2e builds with placeholder env inside Playwright's web server.
13. **Not done**: pgTAP, CSP, MFA enforcement, zod 4 upgrade (see SECURITY.md).
