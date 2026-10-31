-- DIAGNASSIS server-side operations. Every function is SECURITY DEFINER with an
-- empty search_path and checks auth.uid() / is_admin() itself.
-- Errors are raised as short machine codes (message) so the app can map them.

-- ================================================================ internal helpers (not API-callable)
create or replace function public.band_for(p_score int)
returns text language sql immutable set search_path = '' as $$
  select case when p_score >= 80 then 'Ready'
              when p_score >= 60 then 'Competitive'
              when p_score >= 40 then 'Developing'
              else 'Early stage' end;
$$;

create or replace function public.create_notification(
  p_user uuid, p_type public.notification_type, p_title text, p_body text default '',
  p_attempt uuid default null, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare prefs jsonb;
begin
  select notification_prefs into prefs from public.profiles where id = p_user;
  if not found then return; end if;
  -- Every notification type can be switched off per user; a missing key means "on".
  if coalesce((prefs ->> p_type::text)::boolean, true) = false then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, attempt_id, link)
  values (p_user, p_type, left(p_title, 160), left(coalesce(p_body, ''), 500), p_attempt, p_link);
end $$;

create or replace function public.notify_admins(
  p_type public.notification_type, p_title text, p_body text default '', p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, left(p_title, 160), left(coalesce(p_body, ''), 500), p_link
  from public.profiles
  where role = 'admin' and coalesce((notification_prefs ->> p_type::text)::boolean, true);
$$;

create or replace function public.clean_skill_list(p_skills text[])
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(s order by o), '{}')
  from (
    select distinct on (lower(s)) s, o
    from (
      select btrim(x) as s, o
      from unnest(coalesce(p_skills, '{}')) with ordinality as t(x, o)
    ) a
    where char_length(s) between 1 and 60
    order by lower(s), o
  ) b
  where o <= 200;
$$;

-- ================================================================ policies
create or replace function public.pending_policies()
returns table (id uuid, type public.policy_type, version text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.type, p.version
  from (select distinct on (type) * from public.policies order by type, published_at desc, id) p
  where auth.uid() is not null
    and not exists (select 1 from public.policy_acceptances a
                    where a.policy_id = p.id and a.user_id = auth.uid());
$$;

create or replace function public.accept_policies(p_policy_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if coalesce(cardinality(p_policy_ids), 0) = 0 then raise exception 'policy_ids_required'; end if;
  -- Only the latest version of each policy type can be accepted.
  select count(*) into n from (
    select distinct on (type) id from public.policies order by type, published_at desc, id) l
  where l.id = any (p_policy_ids);
  if n <> (select count(distinct x) from unnest(p_policy_ids) x) then
    raise exception 'policy_not_latest';
  end if;
  insert into public.policy_acceptances (user_id, policy_id)
  select uid, x from unnest(p_policy_ids) x
  on conflict do nothing;
end $$;

-- ================================================================ diagnostic lifecycle
create or replace function public.start_attempt(p_role_id uuid, p_custom_role text, p_skills text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  lim int; used int;
  reqs jsonb; declining text[] := '{}'; trends_at timestamptz;
  rname text; custom boolean := false; rid uuid := null;
  claimed text[]; aid uuid; pos int := 0; r record; q record; picked int;
  tested int := 0; custom_key text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into prof from public.profiles where id = uid;
  if not found then raise exception 'profile_missing'; end if;
  if not prof.details_completed then raise exception 'details_required'; end if;
  if exists (select 1 from public.pending_policies()) then raise exception 'policies_not_accepted'; end if;
  if exists (select 1 from public.attempts where user_id = uid and status = 'in_progress') then
    raise exception 'attempt_in_progress';
  end if;

  select coalesce((value #>> '{}')::int, 5) into lim from public.app_settings where key = 'attempt_limit';
  select count(*) into used from public.attempts where user_id = uid;
  if used >= coalesce(lim, 5) then raise exception 'attempt_limit_reached'; end if;

  if p_role_id is not null then
    select name, last_reviewed_at, declining_skills into rname, trends_at, declining
    from public.roles where id = p_role_id and is_active;
    if rname is null then raise exception 'role_not_found'; end if;
    rid := p_role_id;
    select jsonb_agg(jsonb_build_object(
             'skill', s.name, 'weight', rs.weight, 'priority', rs.priority,
             'trend', rs.trend, 'trend_change', rs.trend_change, 'why', s.why)
           order by rs.weight desc, s.name)
      into reqs
    from public.role_skills rs join public.skills s on s.id = rs.skill_id
    where rs.role_id = p_role_id;
    if reqs is null then raise exception 'role_has_no_skills'; end if;
  elsif p_custom_role is not null and char_length(btrim(p_custom_role)) >= 2 then
    custom_key := lower(btrim(regexp_replace(p_custom_role, '\s+', ' ', 'g')));
    select name, requirements into rname, reqs from public.custom_role_estimates where name_key = custom_key;
    if rname is null then raise exception 'custom_role_not_estimated'; end if;
    custom := true;
  else
    raise exception 'role_required';
  end if;

  claimed := public.clean_skill_list(p_skills);
  if cardinality(claimed) = 0 then raise exception 'skills_required'; end if;

  insert into public.attempts (user_id, role_id, role_name, is_custom_role, claimed_skills,
                               requirements, declining_skills, trends_updated_at)
  values (uid, rid, rname, custom, claimed, reqs, declining, trends_at)
  returning id into aid;

  for r in
    select e.value ->> 'skill' as skill
    from jsonb_array_elements(reqs) with ordinality as e(value, ord)
    order by e.ord
  loop
    exit when tested >= 8;
    continue when not exists (select 1 from unnest(claimed) c where lower(c) = lower(r.skill));
    picked := 0;
    for q in
      select qu.id
      from public.questions qu join public.skills s on s.id = qu.skill_id
      where lower(btrim(s.name)) = lower(btrim(r.skill)) and qu.status = 'active'
      order by random() limit 5
    loop
      insert into public.attempt_questions (attempt_id, position, question_id, skill_name)
      values (aid, pos, q.id, r.skill);
      pos := pos + 1; picked := picked + 1;
    end loop;
    if picked < 5 then
      -- not enough questions for a fair test of this skill: drop its partial rows
      delete from public.attempt_questions where attempt_id = aid and skill_name = r.skill;
      pos := pos - picked;
    else
      tested := tested + 1;
    end if;
  end loop;

  if tested = 0 then raise exception 'no_testable_skills'; end if;
  return aid;
end $$;

create or replace function public.save_answer(
  p_attempt uuid, p_position int, p_selected int default null, p_flagged boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_selected is not null and p_selected not between 0 and 3 then raise exception 'invalid_option'; end if;
  perform 1 from public.attempts where id = p_attempt and user_id = uid and status = 'in_progress';
  if not found then raise exception 'attempt_not_found'; end if;
  update public.attempt_questions aq set
    selected_index = coalesce(p_selected, aq.selected_index),
    answered_at    = case when p_selected is not null then now() else aq.answered_at end,
    flagged        = coalesce(p_flagged, aq.flagged)
  where aq.attempt_id = p_attempt and aq.position = p_position;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'question_not_found'; end if;
  update public.attempts set current_position = greatest(p_position, 0) where id = p_attempt;
end $$;

create or replace function public.submit_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a public.attempts%rowtype;
  rows_json jsonb; sc int; bnd text; total_q int; correct_q int; tested_n int;
  prev record; delta int := null; res jsonb; body text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_attempt and user_id = uid for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if a.status = 'submitted' then return a.result; end if;

  with per_skill as (
    select lower(aq.skill_name) as k, count(*) as total,
           count(*) filter (where aq.selected_index = qk.correct_index) as correct
    from public.attempt_questions aq
    join public.question_keys qk on qk.question_id = aq.question_id
    where aq.attempt_id = p_attempt
    group by lower(aq.skill_name)
  ), scored as (
    select e.value as req, e.ord, ps.total, ps.correct,
           (ps.total is not null) as tested,
           case when ps.total is null then 0 else round(ps.correct * 100.0 / ps.total)::int end as prof
    from jsonb_array_elements(a.requirements) with ordinality as e(value, ord)
    left join per_skill ps on ps.k = lower(e.value ->> 'skill')
  )
  select
    jsonb_agg(jsonb_build_object(
      'skill', req ->> 'skill',
      'weight', (req ->> 'weight')::numeric,
      'priority', req ->> 'priority',
      'trend', coalesce(req ->> 'trend', 'stable'),
      'trend_change', req ->> 'trend_change',
      'why', req ->> 'why',
      'tested', tested,
      'proficiency', prof,
      'status', case when not tested then 'missing' when prof >= 70 then 'matched' else 'weak' end,
      'points', round(((req ->> 'weight')::numeric * prof / 100), 1)
    ) order by ord),
    round(sum((req ->> 'weight')::numeric * prof / 100))::int,
    coalesce(sum(total), 0)::int, coalesce(sum(correct), 0)::int,
    count(*) filter (where tested)::int
  into rows_json, sc, total_q, correct_q, tested_n
  from scored;

  sc := least(100, greatest(0, coalesce(sc, 0)));
  bnd := public.band_for(sc);

  select id, score, submitted_at into prev
  from public.attempts
  where user_id = uid and status = 'submitted' and id <> p_attempt
    and lower(role_name) = lower(a.role_name)
  order by submitted_at desc limit 1;
  if found then delta := sc - prev.score; end if;

  res := jsonb_build_object(
    'score', sc, 'band', bnd, 'rows', coalesce(rows_json, '[]'::jsonb),
    'tested_count', tested_n, 'question_count', total_q, 'correct_count', correct_q,
    'delta', delta, 'previous_attempt_id', prev.id, 'previous_date', prev.submitted_at);

  update public.attempts
     set status = 'submitted', submitted_at = now(), score = sc, band = bnd, result = res
   where id = p_attempt;

  body := 'Readiness score ' || sc ||
          case when delta is null then '. This is your first attempt for this role.'
               when delta >= 0 then ', up ' || delta || ' since your last attempt.'
               else ', down ' || abs(delta) || ' since your last attempt.' end;
  perform public.create_notification(uid, 'results',
    'Your ' || a.role_name || ' result is ready', body, p_attempt, '/results/' || p_attempt);
  insert into public.activity_log (kind, summary, detail, actor_id)
  select 'diagnostic_completed', p.full_name || ' completed a ' || a.role_name || ' diagnostic', 'Score ' || sc, uid
  from public.profiles p where p.id = uid;

  return res;
end $$;

create or replace function public.save_attempt_insights(p_attempt uuid, p_insights jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if jsonb_typeof(p_insights) <> 'object' or pg_column_size(p_insights) > 65536 then
    raise exception 'invalid_insights';
  end if;
  update public.attempts set insights = p_insights, insights_generated_at = now()
  where id = p_attempt and user_id = uid and status = 'submitted';
  if not found then raise exception 'attempt_not_found'; end if;
end $$;

-- ================================================================ notifications
create or replace function public.mark_notification_read(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_id and user_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read()
returns int language sql security definer set search_path = '' as $$
  with u as (
    update public.notifications set read_at = now()
    where user_id = auth.uid() and read_at is null returning 1)
  select count(*)::int from u;
$$;

-- ================================================================ account deletion
create or replace function public.request_account_deletion(p_reason text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.profiles%rowtype; rid uuid; n int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'profile_missing'; end if;
  if p.role = 'admin' then raise exception 'admin_cannot_delete'; end if;
  if exists (select 1 from public.deletion_requests where user_id = uid and status = 'pending') then
    raise exception 'deletion_already_pending';
  end if;
  select count(*) into n from public.attempts where user_id = uid;
  insert into public.deletion_requests (user_id, student_name, student_email, college, attempt_count, reason)
  values (uid, p.full_name, p.email, p.college, n, left(coalesce(p_reason, ''), 500))
  returning id into rid;
  perform public.notify_admins('deletion', 'New account deletion request',
    coalesce(nullif(p.full_name, ''), p.email) || ' asked for their account to be deleted.', '/admin/deletions');
  insert into public.activity_log (kind, summary, actor_id)
  values ('deletion_requested', coalesce(nullif(p.full_name, ''), p.email) || ' requested account deletion', uid);
  return rid;
end $$;

create or replace function public.cancel_account_deletion()
returns void language sql security definer set search_path = '' as $$
  update public.deletion_requests set status = 'cancelled', resolved_at = now()
  where user_id = auth.uid() and status = 'pending';
$$;

create or replace function public.admin_resolve_deletion(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.deletion_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.deletion_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if p_approve then
    if r.user_id is not null and r.user_id = auth.uid() then raise exception 'cannot_delete_self'; end if;
    update public.deletion_requests
       set status = 'approved', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
    if r.user_id is not null then
      delete from auth.users where id = r.user_id;  -- cascades to profile, attempts, feedback, ...
    end if;
    insert into public.activity_log (kind, summary, actor_id)
    values ('deletion_approved', 'Deleted the account of ' || coalesce(nullif(r.student_name, ''), r.student_email), auth.uid());
  else
    update public.deletion_requests
       set status = 'denied', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
    if r.user_id is not null then
      perform public.create_notification(r.user_id, 'platform', 'Account deletion request declined',
        'Your account remains active. Contact us through the Feedback page if you have questions.');
    end if;
  end if;
end $$;

-- ================================================================ policy publishing (admin)
create or replace function public.admin_publish_policy(
  p_type public.policy_type, p_version text, p_body text, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare latest text; pid uuid; label text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_version !~ '^[0-9]+(\.[0-9]+){1,2}$' then raise exception 'invalid_version'; end if;
  select version into latest from public.policies where type = p_type order by published_at desc, id limit 1;
  if latest is not null
     and string_to_array(p_version, '.')::int[] <= string_to_array(latest, '.')::int[] then
    raise exception 'version_must_increase';
  end if;
  insert into public.policies (type, version, body, change_note, published_by)
  values (p_type, p_version, p_body, nullif(btrim(p_note), ''), auth.uid())
  returning id into pid;
  label := case p_type when 'terms' then 'Terms & Conditions' else 'Privacy Policy' end;
  insert into public.notifications (user_id, type, title, body, link)
  select id, 'policy', label || ' updated to version ' || p_version,
         coalesce(nullif(btrim(p_note), ''), 'Please review and accept the update to continue.'), '/accept-policies'
  from public.profiles
  where role = 'student' and coalesce((notification_prefs ->> 'policy')::boolean, true);
  insert into public.activity_log (kind, summary, actor_id)
  values ('policy_published', label || ' version ' || p_version || ' published', auth.uid());
  return pid;
end $$;

-- ================================================================ role / skill administration
-- Shared by admin_save_role_skills and the service-role research pipeline.
create or replace function public.replace_role_skills(p_role uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare it jsonb; sid uuid; nm text; total numeric := 0; names text[] := '{}'; w numeric;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid_items';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    nm := btrim(it ->> 'skill');
    w := (it ->> 'weight')::numeric;
    if nm is null or char_length(nm) not between 1 and 60 then raise exception 'invalid_skill_name'; end if;
    if w is null or w <= 0 or w > 100 then raise exception 'invalid_weight'; end if;
    if (it ->> 'priority') not in ('high', 'medium', 'low') then raise exception 'invalid_priority'; end if;
    if lower(nm) = any (select lower(x) from unnest(names) x) then raise exception 'duplicate_skill'; end if;
    names := names || nm;
    total := total + w;
  end loop;
  if abs(total - 100) > 0.01 then raise exception 'weights_must_total_100'; end if;

  -- Defer the totals check so intermediate states inside this function are allowed.
  set constraints public.role_skills_weights_total deferred;

  for it in select * from jsonb_array_elements(p_items) loop
    nm := btrim(it ->> 'skill');
    insert into public.skills (name, why) values (nm, nullif(btrim(it ->> 'why'), ''))
    on conflict (lower(btrim(name))) do update
      set why = coalesce(excluded.why, public.skills.why)
    returning id into sid;
    insert into public.role_skills (role_id, skill_id, weight, priority, trend, trend_change)
    values (p_role, sid, (it ->> 'weight')::numeric, (it ->> 'priority')::public.skill_priority,
            coalesce(nullif(it ->> 'trend', ''), 'stable')::public.skill_trend,
            nullif(it ->> 'trend_change', ''))
    on conflict (role_id, skill_id) do update
      set weight = excluded.weight, priority = excluded.priority,
          trend = case when it ? 'trend' then excluded.trend else public.role_skills.trend end,
          trend_change = case when it ? 'trend' then excluded.trend_change else public.role_skills.trend_change end;
  end loop;

  delete from public.role_skills rs
  where rs.role_id = p_role
    and rs.skill_id not in (select s.id from public.skills s
                            where lower(btrim(s.name)) in (select lower(btrim(i ->> 'skill')) from jsonb_array_elements(p_items) i));
end $$;
-- skills.name unique index is on lower(btrim(name)); ON CONFLICT target must match it.

create or replace function public.admin_save_role_skills(p_role uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.roles where id = p_role;
  if not found then raise exception 'role_not_found'; end if;
  perform public.replace_role_skills(p_role, p_items);
  update public.roles set last_reviewed_at = now() where id = p_role;
  insert into public.activity_log (kind, summary, actor_id)
  select 'role_updated', 'Updated the required skills for ' || name, auth.uid() from public.roles where id = p_role;
end $$;

create or replace function public.admin_create_role(p_name text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.roles (name, last_reviewed_at) values (btrim(p_name), now()) returning id into rid;
  perform public.replace_role_skills(rid, p_items);
  insert into public.activity_log (kind, summary, actor_id) values ('role_created', 'Added the role ' || btrim(p_name), auth.uid());
  return rid;
end $$;

create or replace function public.admin_promote_custom_role(p_estimate uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e public.custom_role_estimates%rowtype; rid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into e from public.custom_role_estimates where id = p_estimate for update;
  if not found then raise exception 'estimate_not_found'; end if;
  if e.promoted_role_id is not null then raise exception 'already_promoted'; end if;
  rid := public.admin_create_role(e.name, e.requirements);
  update public.custom_role_estimates set promoted_role_id = rid where id = p_estimate;
  return rid;
end $$;

create or replace function public.admin_set_role_active(p_role uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.roles set is_active = p_active where id = p_role;
  if not found then raise exception 'role_not_found'; end if;
end $$;

create or replace function public.admin_set_attempt_limit(p_limit int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_limit not between 1 and 50 then raise exception 'invalid_limit'; end if;
  update public.app_settings set value = to_jsonb(p_limit), updated_by = auth.uid() where key = 'attempt_limit';
end $$;

-- ================================================================ research pipeline (service role only)
create or replace function public.service_apply_role_update(
  p_role uuid, p_items jsonb, p_declining text[], p_applied uuid[], p_rejected uuid[], p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_items is not null then perform public.replace_role_skills(p_role, p_items); end if;
  update public.roles
     set last_reviewed_at = now(),
         declining_skills = coalesce(p_declining, declining_skills)
   where id = p_role;
  update public.skill_suggestions set status = 'approved', applied = true, decided_at = now(), decision_note = left(p_note, 600)
   where id = any (coalesce(p_applied, '{}')) and status = 'suggested';
  update public.skill_suggestions set status = 'rejected', applied = false, decided_at = now(), decision_note = left(p_note, 600)
   where id = any (coalesce(p_rejected, '{}')) and status = 'suggested';
end $$;

-- ================================================================ admin reporting
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students_total',      (select count(*) from public.profiles where role = 'student'),
    'students_new_7d',     (select count(*) from public.profiles where role = 'student' and created_at > now() - interval '7 days'),
    'diagnostics_total',   (select count(*) from public.attempts where status = 'submitted'),
    'diagnostics_7d',      (select count(*) from public.attempts where status = 'submitted' and submitted_at > now() - interval '7 days'),
    'avg_score',           (select round(avg(score), 1) from public.attempts where status = 'submitted'),
    'avg_rating',          (select round(avg(rating), 2) from public.feedback),
    'feedback_total',      (select count(*) from public.feedback),
    'pending_deletions',   (select count(*) from public.deletion_requests where status = 'pending'),
    'suggestions_pending', (select count(*) from public.skill_suggestions where status = 'suggested'),
    'typed_roles',         (select count(*) from public.custom_role_estimates where promoted_role_id is null),
    'last_research',       (select to_jsonb(r) from (select id, status, finished_at, started_at, suggestions_created, suggestions_applied
                                                       from public.market_research_runs order by started_at desc limit 1) r),
    'recent_activity',     coalesce((select jsonb_agg(to_jsonb(a)) from (
                              select kind, summary, detail, created_at from public.activity_log
                              order by created_at desc limit 12) a), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_analytics(p_days int default 90)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d int := least(365, greatest(7, coalesce(p_days, 90))); since timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  since := date_trunc('day', now()) - make_interval(days => d - 1);
  return jsonb_build_object(
    'days', d,
    'registered_total', (select count(*) from public.profiles where role = 'student'),
    'registered_in_range', (select count(*) from public.profiles where role = 'student' and created_at >= since),
    'started_in_range', (select count(*) from public.attempts where started_at >= since),
    'completed_in_range', (select count(*) from public.attempts where status = 'submitted' and submitted_at >= since),
    'completed_total', (select count(*) from public.attempts where status = 'submitted'),
    'avg_score', (select round(avg(score), 1) from public.attempts where status = 'submitted' and submitted_at >= since),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.day, 'YYYY-MM-DD'),
                'registrations', (select count(*) from public.profiles p where p.role = 'student' and p.created_at >= g.day and p.created_at < g.day + interval '1 day'),
                'diagnostics', (select count(*) from public.attempts a where a.status = 'submitted' and a.submitted_at >= g.day and a.submitted_at < g.day + interval '1 day'))
                order by g.day), '[]'::jsonb)
              from generate_series(since, date_trunc('day', now()), interval '1 day') as g(day)),
    'by_role', (select coalesce(jsonb_agg(x order by (x ->> 'count')::int desc), '[]'::jsonb) from (
                  select jsonb_build_object('role', role_name, 'count', count(*), 'avg_score', round(avg(score), 1)) as x
                  from public.attempts where status = 'submitted' and submitted_at >= since
                  group by role_name order by count(*) desc limit 12) t),
    'bands', (select coalesce(jsonb_object_agg(band, c), '{}'::jsonb) from (
                select band, count(*) c from public.attempts where status = 'submitted' and submitted_at >= since group by band) t),
    'common_gaps', (select coalesce(jsonb_agg(x order by (x ->> 'total')::int desc), '[]'::jsonb) from (
                select jsonb_build_object('skill', r ->> 'skill',
                         'missing', count(*) filter (where r ->> 'status' = 'missing'),
                         'weak', count(*) filter (where r ->> 'status' = 'weak'),
                         'total', count(*)) as x
                from public.attempts a, jsonb_array_elements(a.result -> 'rows') r
                where a.status = 'submitted' and a.submitted_at >= since and r ->> 'status' <> 'matched'
                group by r ->> 'skill' order by count(*) desc limit 10) t),
    'feedback', jsonb_build_object(
        'count', (select count(*) from public.feedback where created_at >= since),
        'avg', (select round(avg(rating), 2) from public.feedback where created_at >= since),
        'distribution', (select coalesce(jsonb_object_agg(rating::text, c), '{}'::jsonb) from (
                select rating, count(*) c from public.feedback where created_at >= since group by rating) t)),
    'ai', jsonb_build_object(
        'requests', (select count(*) from public.ai_requests where created_at >= since),
        'failures', (select count(*) from public.ai_requests where created_at >= since and not ok))
  );
end $$;

create or replace function public.admin_list_students(
  p_search text default null, p_role text default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, full_name text, email text, college text, year_of_study text,
               role_label text, attempts int, latest_score int, created_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  with base as (
    select p.id, p.full_name, p.email, p.college, p.year_of_study, p.created_at,
           coalesce((select a.role_name from public.attempts a where a.user_id = p.id order by a.started_at desc limit 1),
                    (select r.name from public.roles r where r.id = p.target_role_id),
                    p.target_role_other) as role_label,
           (select count(*)::int from public.attempts a where a.user_id = p.id) as attempts,
           (select a.score::int from public.attempts a where a.user_id = p.id and a.status = 'submitted'
              order by a.submitted_at desc limit 1) as latest_score
    from public.profiles p
    where p.role = 'student'
      and (p_search is null or btrim(p_search) = ''
           or (p.full_name || ' ' || p.email || ' ' || coalesce(p.college, '')) ilike '%' || replace(replace(btrim(p_search), '%', ''), '_', '') || '%')
  ), filtered as (
    select * from base where p_role is null or p_role = '' or lower(role_label) = lower(p_role)
  )
  select f.id, f.full_name, f.email, f.college, f.year_of_study, f.role_label, f.attempts, f.latest_score,
         f.created_at, count(*) over () as total_count
  from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_typed_skills()
returns table (skill text, students bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select min(s) as skill, count(distinct uid) as students
  from (select p.id as uid, btrim(x) as s from public.profiles p, unnest(p.skills) x) t
  where lower(s) not in (select lower(btrim(name)) from public.skills)
  group by lower(s)
  order by count(distinct uid) desc, min(s)
  limit 50;
end $$;

-- ================================================================ feedback activity
create or replace function public.on_feedback_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text; ctx text;
begin
  select coalesce(nullif(full_name, ''), email) into who from public.profiles where id = new.user_id;
  select role_name into ctx from public.attempts where id = new.attempt_id;
  insert into public.activity_log (kind, summary, actor_id)
  values ('feedback', who || ' rated ' || coalesce(ctx || ' result ', 'the platform ') || new.rating || ' star' || case when new.rating = 1 then '' else 's' end, new.user_id);
  if new.rating <= 2 then
    perform public.notify_admins('rating', 'Low rating on ' || case when new.kind = 'result' then 'a result' else 'the platform' end,
      who || ' rated ' || new.rating || ' star' || case when new.rating = 1 then '' else 's' end || '.', '/admin/feedback');
  end if;
  return new;
end $$;
create trigger feedback_created after insert on public.feedback
  for each row execute function public.on_feedback_created();

-- ================================================================ privileges
-- Default: nobody. Then grant only what the app calls.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.pending_policies()        to authenticated;
grant execute on function public.accept_policies(uuid[])   to authenticated;
grant execute on function public.start_attempt(uuid, text, text[]) to authenticated;
grant execute on function public.save_answer(uuid, int, int, boolean) to authenticated;
grant execute on function public.submit_attempt(uuid)      to authenticated;
grant execute on function public.save_attempt_insights(uuid, jsonb) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.is_admin()                to authenticated, service_role;
grant execute on function public.admin_resolve_deletion(uuid, boolean) to authenticated;
grant execute on function public.admin_publish_policy(public.policy_type, text, text, text) to authenticated;
grant execute on function public.admin_save_role_skills(uuid, jsonb) to authenticated;
grant execute on function public.admin_create_role(text, jsonb) to authenticated;
grant execute on function public.admin_promote_custom_role(uuid) to authenticated;
grant execute on function public.admin_set_role_active(uuid, boolean) to authenticated;
grant execute on function public.admin_set_attempt_limit(int) to authenticated;
grant execute on function public.admin_dashboard()          to authenticated;
grant execute on function public.admin_analytics(int)       to authenticated;
grant execute on function public.admin_list_students(text, text, int, int) to authenticated;
grant execute on function public.admin_typed_skills()       to authenticated;
grant execute on function public.service_apply_role_update(uuid, jsonb, text[], uuid[], uuid[], text) to service_role;
grant execute on function public.replace_role_skills(uuid, jsonb) to service_role;
grant execute on function public.create_notification(uuid, public.notification_type, text, text, uuid, text) to service_role;
grant execute on function public.notify_admins(public.notification_type, text, text, text) to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
