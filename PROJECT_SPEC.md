# PROJECT_SPEC

## 1. Overview
DIAGNASSIS (MVP v1, founders Pavani & Tanusree, last updated 29-09-2026) compares a student's skills with current job-market requirements to identify skill gaps and provide personalised, actionable career insights. Sources: MVP PDF + design handoff (`CLAUDE_CODE_HANDOFF.md`, `.dc.html` screens). Where they differ the handoff wins (it is the later, final design): the admin "Market Trends / Question Review / Learning Resources" tabs are **out of scope**; AI generates questions and resources automatically.

## 2. Roles
| Role | Who | Can |
|---|---|---|
| Guest | Unauthenticated | View landing, Terms, Privacy, sign up / log in |
| Student (User) | 3rd/4th-year student | Take diagnostics, see results/history/reports, manage profile, notifications, settings, feedback |
| Super Admin | Platform owner (`profiles.role='admin'`) | View students, analytics, curate roles/skills, feedback, policies, deletion requests, settings |

## 3. Requirements (priority: M = mandatory, I = important)
| ID | Requirement | Pri |
|---|---|---|
| REQ-001 | Public website: landing, how it works, benefits, login/sign-up entry points | M |
| REQ-002 | Sign up, login, logout, password recovery, email validation, role-based redirect | M |
| REQ-003 | Terms & Privacy: view, accept at onboarding, latest version shown, admin edits/publishes, forced re-acceptance | M |
| REQ-004 | Basic details pop-up after first login (name, college, branch, year, skills, target role), Save / Skip, edit later in My Profile | M |
| REQ-005 | Diagnostic: choose role (curated or "Others"), confirm skills, MCQ test (5 q/skill, ≤8 skills, no timer), autosave/resume, review, submit | M |
| REQ-006 | Job-market requirements engine: automatic research every 2 days, weights/trends, AI review & auto-approval, role matching, AI estimate for "Others" | M |
| REQ-007 | Skill-gap visualizer: matched / weak / missing, priority, visual | M |
| REQ-008 | Readiness score with breakdown, strong/weak areas, interpretation (bands Ready ≥80, Competitive ≥60, Developing ≥40, Early stage) | M |
| REQ-009 | Personalised action items (top 3), role-specific next steps, learning resources | M |
| REQ-010 | Market trend insights connected to the student's role | M |
| REQ-011 | History: attempts, scores, skill gaps, actions, trends, reports | M |
| REQ-012 | Admin dashboard: all students, search, student detail incl. diagnostics | M |
| REQ-013 | Analytics: registrations, completions, usage, common gaps, platform & feedback metrics | M |
| REQ-014 | My Profile view/edit | M |
| REQ-015 | Notifications (results ready, report ready, platform/policy updates), mark read | M |
| REQ-016 | Downloadable PDF report (score, gaps, trends, actions); stored privately in R2 | M |
| REQ-017 | Settings: account, notification prefs, privacy, password, logout, delete-account request | M |
| REQ-018 | Feedback: rate usefulness/result, comments; admin views feedback + metrics | M |
| REQ-019 | Diagnostic attempt limit (default 5, admin-configurable) | I |
| REQ-020 | Admin deletion-request workflow (approve → permanent deletion) | I |
| REQ-021 | **All AI features use NVIDIA API keys** (question generation, resources, research, role estimation, personalised insights) | M (user instruction) |

## 4. Non-functional
Responsive (site/student breakpoint 760px, admin 900px), WCAG 2.1 AA basics, strict TypeScript, RLS on every table, no secrets in client code, Netlify-deployable.

## 5. Business rules
Score = Σ(weight × tested proficiency); skills not claimed/tested score 0; matched ≥ 70%; role weights total exactly 100; one in-progress attempt per student; attempt limit enforced server-side; policy update forces re-acceptance; deletion requires admin approval.

## 6. Assumptions (see DECISIONS.md)
- "Privacy preferences" = view accepted policy versions + data-deletion request (no further semantic defined in the MVP).
- Market research uses the NVIDIA model's general knowledge; **no live job-listing data source exists**, so trends/evidence are labelled AI-assisted estimates and no statistics are fabricated.
- Learning resources are AI-suggested search queries (YouTube/web), never invented URLs.
- Google sign-in is offered alongside email/password (Supabase provider must be enabled).

## 7. Non-goals
Admin Market-Trends/Question-Review/Learning-Resource pages, job listings, courses, placement, email marketing.

## 8. Unresolved questions
Branding of the `From` email for Supabase Auth (default Supabase SMTP is rate-limited); production domain; admin account email(s).
