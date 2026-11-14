-- Beginner diagnostics, varied questions, and IST-based analytics days.
-- Apply with the other migrations (Supabase SQL editor / `supabase db push`). Safe to run once.

-- 1. start_attempt gains p_beginner (default false) so students who know none of a role's skills can still get a result.
--    The old 3-argument version is dropped so PostgREST never sees two candidates.
drop function if exists public.start_attempt(uuid, text, text[]);

create function public.start_attempt(p_role_id uuid, p_custom_role text, p_skills text[], p_beginner boolean default false)
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

  -- Beginner path ("I don't know any of these skills"): a valid diagnostic with nothing claimed and nothing to test.
  -- The caller submits it straight away, which scores every skill as missing and yields a beginner roadmap.
  claimed := case when coalesce(p_beginner, false) then '{}'::text[] else public.clean_skill_list(p_skills) end;
  if cardinality(claimed) = 0 and not coalesce(p_beginner, false) then raise exception 'skills_required'; end if;

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
      -- Questions this student has not seen in an earlier attempt come first, then random, so retakes differ.
      order by exists (select 1 from public.attempt_questions seen
                       join public.attempts sa on sa.id = seen.attempt_id
                       where sa.user_id = uid and seen.question_id = qu.id),
               random()
      limit 5
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

  if tested = 0 and not coalesce(p_beginner, false) then raise exception 'no_testable_skills'; end if;
  return aid;
end $$;

revoke all on function public.start_attempt(uuid, text, text[], boolean) from public, anon;
grant execute on function public.start_attempt(uuid, text, text[], boolean) to authenticated;

-- 2. Analytics: bucket registrations / completed diagnostics by Indian calendar day.
create or replace function public.admin_analytics(p_days int default 90)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d int := least(365, greatest(7, coalesce(p_days, 90))); since timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Days are Indian dates (the app's display zone), so a completion at 1 am IST is not filed under the previous UTC day.
  since := (date_trunc('day', now() at time zone 'Asia/Kolkata') - make_interval(days => d - 1)) at time zone 'Asia/Kolkata';
  return jsonb_build_object(
    'days', d,
    'registered_total', (select count(*) from public.profiles where role = 'student'),
    'registered_in_range', (select count(*) from public.profiles where role = 'student' and created_at >= since),
    'started_in_range', (select count(*) from public.attempts where started_at >= since),
    'completed_in_range', (select count(*) from public.attempts where status = 'submitted' and submitted_at >= since),
    'completed_total', (select count(*) from public.attempts where status = 'submitted'),
    'avg_score', (select round(avg(score), 1) from public.attempts where status = 'submitted' and submitted_at >= since),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.day at time zone 'Asia/Kolkata', 'YYYY-MM-DD'),
                'registrations', (select count(*) from public.profiles p where p.role = 'student' and p.created_at >= g.day and p.created_at < g.day + interval '1 day'),
                'diagnostics', (select count(*) from public.attempts a where a.status = 'submitted' and a.submitted_at >= g.day and a.submitted_at < g.day + interval '1 day'))
                order by g.day), '[]'::jsonb)
              from generate_series(since, date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata', interval '1 day') as g(day)),
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
