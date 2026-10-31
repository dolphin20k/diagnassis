-- DIAGNASSIS authorization: helper functions, RLS policies, table grants.
-- Fail-closed: every table has RLS enabled; no policy means no access.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------- enable RLS everywhere
alter table public.roles                  enable row level security;
alter table public.skills                 enable row level security;
alter table public.role_skills            enable row level security;
alter table public.profiles               enable row level security;
alter table public.questions              enable row level security;
alter table public.question_keys          enable row level security;
alter table public.custom_role_estimates  enable row level security;
alter table public.attempts               enable row level security;
alter table public.attempt_questions      enable row level security;
alter table public.notifications          enable row level security;
alter table public.feedback               enable row level security;
alter table public.policies               enable row level security;
alter table public.policy_acceptances     enable row level security;
alter table public.deletion_requests      enable row level security;
alter table public.reports                enable row level security;
alter table public.market_research_runs   enable row level security;
alter table public.skill_suggestions      enable row level security;
alter table public.activity_log           enable row level security;
alter table public.app_settings           enable row level security;
alter table public.ai_requests            enable row level security;

-- ---------------------------------------------------------------- reset default grants
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------- catalogue (read: signed-in; write: admin)
grant select on public.roles, public.skills, public.role_skills to authenticated;
grant insert, update, delete on public.roles, public.skills, public.role_skills to authenticated;

create policy roles_read   on public.roles for select to authenticated using (is_active or public.is_admin());
create policy roles_admin_insert on public.roles for insert to authenticated with check (public.is_admin());
create policy roles_admin_update on public.roles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy roles_admin_delete on public.roles for delete to authenticated using (public.is_admin());

create policy skills_read  on public.skills for select to authenticated using (true);
create policy skills_admin_insert on public.skills for insert to authenticated with check (public.is_admin());
create policy skills_admin_update on public.skills for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy skills_admin_delete on public.skills for delete to authenticated using (public.is_admin());

create policy role_skills_read on public.role_skills for select to authenticated
  using (public.is_admin() or exists (select 1 from public.roles r where r.id = role_id and r.is_active));
create policy role_skills_admin_insert on public.role_skills for insert to authenticated with check (public.is_admin());
create policy role_skills_admin_update on public.role_skills for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy role_skills_admin_delete on public.role_skills for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- profiles
grant select, update on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Column-level fence: only these columns are updatable by API users.
revoke update on public.profiles from authenticated;
grant update (full_name, college, branch, year_of_study, skills, target_role_id,
              target_role_other, details_completed, details_skipped, notification_prefs)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------- question bank (keys never exposed)
grant select on public.questions to authenticated;
create policy questions_read on public.questions for select to authenticated
  using (status = 'active' or public.is_admin());
-- question_keys: RLS on, no policy, no grant -> unreadable via the API.

-- ---------------------------------------------------------------- custom role estimates (admin read only)
grant select on public.custom_role_estimates to authenticated;
create policy custom_role_estimates_admin_read on public.custom_role_estimates for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------- attempts
grant select on public.attempts, public.attempt_questions to authenticated;
create policy attempts_select on public.attempts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy attempt_questions_select on public.attempt_questions for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- ---------------------------------------------------------------- notifications
grant select on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- feedback
grant select, insert on public.feedback to authenticated;
create policy feedback_select on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check (
    user_id = auth.uid()
    and (attempt_id is null or exists (
      select 1 from public.attempts a
      where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'submitted')));

-- ---------------------------------------------------------------- policies (public documents)
grant select on public.policies to anon, authenticated;
create policy policies_public_read on public.policies for select to anon, authenticated using (true);

grant select on public.policy_acceptances to authenticated;
create policy policy_acceptances_select on public.policy_acceptances for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- deletion requests
grant select on public.deletion_requests to authenticated;
create policy deletion_requests_select on public.deletion_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- reports
grant select on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- admin-only read
grant select on public.market_research_runs, public.skill_suggestions, public.activity_log, public.ai_requests to authenticated;
create policy research_runs_admin_read on public.market_research_runs for select to authenticated using (public.is_admin());
create policy skill_suggestions_admin_read on public.skill_suggestions for select to authenticated using (public.is_admin());
create policy activity_log_admin_read on public.activity_log for select to authenticated using (public.is_admin());
create policy ai_requests_admin_read on public.ai_requests for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- settings
grant select, update on public.app_settings to authenticated;
create policy app_settings_read on public.app_settings for select to authenticated using (true);
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
