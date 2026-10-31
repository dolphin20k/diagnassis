-- DIAGNASSIS core schema (v1)
-- Tables, constraints, indexes and integrity triggers. RLS policies live in
-- 20261031000002_rls_policies.sql; RPC functions in 20261031000003_functions.sql.

-- ---------------------------------------------------------------- enums
create type public.app_role           as enum ('student', 'admin');
create type public.skill_priority     as enum ('high', 'medium', 'low');
create type public.skill_trend        as enum ('rising', 'stable', 'declining');
create type public.attempt_status     as enum ('in_progress', 'submitted');
create type public.deletion_status    as enum ('pending', 'approved', 'denied', 'cancelled');
create type public.policy_type        as enum ('terms', 'privacy');
create type public.suggestion_kind    as enum ('add_skill', 'remove_skill', 'raise_weight', 'lower_weight');
create type public.suggestion_status  as enum ('suggested', 'approved', 'rejected');
create type public.notification_type  as enum ('results', 'report', 'platform', 'policy', 'deletion', 'roles', 'trends', 'rating');

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- catalogue
create table public.roles (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 2 and 80),
  is_active        boolean not null default true,
  declining_skills text[] not null default '{}' check (cardinality(declining_skills) <= 20),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index roles_name_key on public.roles (lower(btrim(name)));
create trigger roles_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

create table public.skills (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  why        text check (why is null or char_length(why) <= 400),
  created_at timestamptz not null default now()
);
create unique index skills_name_key on public.skills (lower(btrim(name)));

create table public.role_skills (
  role_id      uuid not null references public.roles(id) on delete cascade,
  skill_id     uuid not null references public.skills(id) on delete restrict,
  weight       numeric(5,2) not null check (weight > 0 and weight <= 100),
  priority     public.skill_priority not null default 'medium',
  trend        public.skill_trend not null default 'stable',
  trend_change text check (trend_change is null or char_length(trend_change) <= 20),
  updated_at   timestamptz not null default now(),
  primary key (role_id, skill_id)
);
create index role_skills_skill_idx on public.role_skills (skill_id);
create trigger role_skills_updated_at before update on public.role_skills
  for each row execute function public.set_updated_at();

-- A role's weights must total exactly 100 whenever it has any skills.
-- Deferred so multi-row edits inside one transaction are allowed.
create or replace function public.check_role_weights()
returns trigger language plpgsql set search_path = '' as $$
declare
  rid uuid := coalesce(new.role_id, old.role_id);
  total numeric;
  n int;
begin
  select coalesce(sum(weight), 0), count(*) into total, n
  from public.role_skills where role_id = rid;
  if n > 0 and abs(total - 100) > 0.01 then
    raise exception 'Role weights must total 100%% (got %)', total
      using errcode = '23514', constraint = 'role_skills_weights_total_100';
  end if;
  return null;
end $$;
create constraint trigger role_skills_weights_total
  after insert or update or delete on public.role_skills
  deferrable initially deferred
  for each row execute function public.check_role_weights();

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  full_name            text not null default '' check (char_length(full_name) <= 120),
  role                 public.app_role not null default 'student',
  college              text check (college is null or char_length(college) <= 160),
  branch               text check (branch is null or char_length(branch) <= 120),
  year_of_study        text check (year_of_study in ('3rd', '4th')),
  skills               text[] not null default '{}' check (cardinality(skills) <= 60),
  target_role_id       uuid references public.roles(id) on delete set null,
  target_role_other    text check (target_role_other is null or char_length(btrim(target_role_other)) between 2 and 80),
  details_completed    boolean not null default false,
  details_skipped      boolean not null default false,
  notification_prefs   jsonb not null default '{"results":true,"report":true,"platform":true,"policy":true}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint profiles_target_role_exclusive check (target_role_id is null or target_role_other is null)
);
create index profiles_role_idx on public.profiles (role);
create index profiles_created_idx on public.profiles (created_at desc);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Users may never change their own role, id or email through the API.
-- auth.uid() is null for migrations, the SQL editor and service-role calls.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and (
       new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.email is distinct from old.email
    or new.created_at is distinct from old.created_at) then
    raise exception 'Protected profile columns cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------- question bank
create table public.questions (
  id         uuid primary key default gen_random_uuid(),
  skill_id   uuid not null references public.skills(id) on delete cascade,
  prompt     text not null check (char_length(prompt) between 10 and 600),
  options    jsonb not null check (
               jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  source     text not null check (source in ('seed', 'ai', 'admin')),
  model      text,
  status     text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);
create unique index questions_skill_prompt_key on public.questions (skill_id, md5(lower(btrim(prompt))));
create index questions_skill_status_idx on public.questions (skill_id, status);

-- Answer keys live apart from questions and are never exposed through the API.
create table public.question_keys (
  question_id   uuid primary key references public.questions(id) on delete cascade,
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation   text check (explanation is null or char_length(explanation) <= 600)
);

-- ---------------------------------------------------------------- custom role estimates (AI)
create table public.custom_role_estimates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 2 and 80),
  name_key         text not null unique,
  requirements     jsonb not null,
  request_count    int not null default 1 check (request_count >= 1),
  model            text,
  promoted_role_id uuid references public.roles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger custom_role_estimates_updated_at before update on public.custom_role_estimates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- attempts
create table public.attempts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  role_id              uuid references public.roles(id) on delete set null,
  role_name            text not null,
  is_custom_role       boolean not null default false,
  status               public.attempt_status not null default 'in_progress',
  claimed_skills       text[] not null default '{}',
  requirements         jsonb not null,
  declining_skills     text[] not null default '{}',
  trends_updated_at    timestamptz,
  current_position     smallint not null default 0 check (current_position >= 0),
  started_at           timestamptz not null default now(),
  submitted_at         timestamptz,
  score                smallint check (score between 0 and 100),
  band                 text check (band in ('Ready', 'Competitive', 'Developing', 'Early stage')),
  result               jsonb,
  insights             jsonb,
  insights_generated_at timestamptz,
  constraint attempts_submitted_has_score check (
    (status = 'submitted' and score is not null and submitted_at is not null and result is not null)
    or status = 'in_progress')
);
create index attempts_user_started_idx on public.attempts (user_id, started_at desc);
create index attempts_status_idx on public.attempts (status, submitted_at desc);
create unique index attempts_one_in_progress on public.attempts (user_id) where status = 'in_progress';

create table public.attempt_questions (
  attempt_id     uuid not null references public.attempts(id) on delete cascade,
  position       smallint not null check (position >= 0),
  question_id    uuid not null references public.questions(id) on delete restrict,
  skill_name     text not null,
  selected_index smallint check (selected_index between 0 and 3),
  flagged        boolean not null default false,
  answered_at    timestamptz,
  primary key (attempt_id, position),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------- notifications & feedback
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null,
  title      text not null check (char_length(title) between 1 and 160),
  body       text not null default '' check (char_length(body) <= 500),
  attempt_id uuid references public.attempts(id) on delete cascade,
  link       text check (link is null or link ~ '^/[A-Za-z0-9/_\-?=&.]*$'),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid references public.attempts(id) on delete set null,
  kind       text not null check (kind in ('result', 'general')),
  rating     smallint not null check (rating between 1 and 5),
  topic      text check (topic in ('Test questions', 'Results and scoring', 'Learning resources', 'Something else')),
  message    text not null default '' check (char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  constraint feedback_general_needs_message check (kind <> 'general' or char_length(btrim(message)) >= 10),
  constraint feedback_result_needs_attempt check (kind <> 'result' or attempt_id is not null)
);
create index feedback_created_idx on public.feedback (created_at desc);
create unique index feedback_one_result_rating on public.feedback (attempt_id) where kind = 'result';

-- ---------------------------------------------------------------- policies
create table public.policies (
  id           uuid primary key default gen_random_uuid(),
  type         public.policy_type not null,
  version      text not null check (version ~ '^[0-9]+(\.[0-9]+){1,2}$'),
  body         text not null check (char_length(body) between 20 and 40000),
  change_note  text check (change_note is null or char_length(change_note) <= 400),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null,
  unique (type, version)
);
create index policies_type_published_idx on public.policies (type, published_at desc);

create table public.policy_acceptances (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  policy_id   uuid not null references public.policies(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_id)
);

-- ---------------------------------------------------------------- account deletion
create table public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  student_name  text not null,
  student_email text not null,
  college       text,
  attempt_count int not null default 0,
  reason        text not null default '' check (char_length(reason) <= 500),
  status        public.deletion_status not null default 'pending',
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null
);
create unique index deletion_one_pending on public.deletion_requests (user_id) where status = 'pending';
create index deletion_status_idx on public.deletion_requests (status, requested_at desc);

-- ---------------------------------------------------------------- reports (R2 metadata)
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null unique references public.attempts(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  storage_key  text not null unique check (storage_key ~ '^reports/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  content_type text not null default 'application/pdf' check (content_type = 'application/pdf'),
  size_bytes   int not null check (size_bytes between 1 and 10485760),
  created_at   timestamptz not null default now()
);
create index reports_user_idx on public.reports (user_id);

-- ---------------------------------------------------------------- market research
create table public.market_research_runs (
  id                   uuid primary key default gen_random_uuid(),
  trigger_source       text not null check (trigger_source in ('cron', 'manual')),
  status               text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  model                text,
  roles_total          int not null default 0,
  roles_ok             int not null default 0,
  suggestions_created  int not null default 0,
  suggestions_applied  int not null default 0,
  error                text check (error is null or char_length(error) <= 1000),
  started_at           timestamptz not null default now(),
  finished_at          timestamptz
);

create table public.skill_suggestions (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references public.market_research_runs(id) on delete set null,
  role_id       uuid not null references public.roles(id) on delete cascade,
  kind          public.suggestion_kind not null,
  skill_name    text not null check (char_length(btrim(skill_name)) between 1 and 60),
  from_weight   numeric(5,2),
  to_weight     numeric(5,2) check (to_weight is null or (to_weight > 0 and to_weight <= 100)),
  from_priority public.skill_priority,
  to_priority   public.skill_priority,
  rationale     text not null check (char_length(rationale) <= 600),
  status        public.suggestion_status not null default 'suggested',
  suggested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 600),
  applied       boolean not null default false
);
create index skill_suggestions_status_idx on public.skill_suggestions (status, suggested_at desc);
create index skill_suggestions_role_idx on public.skill_suggestions (role_id);

-- ---------------------------------------------------------------- operations
create table public.activity_log (
  id         bigint generated always as identity primary key,
  kind       text not null,
  summary    text not null check (char_length(summary) <= 300),
  detail     text check (detail is null or char_length(detail) <= 300),
  actor_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

create table public.app_settings (
  key        text primary key check (key ~ '^[a-z_]+$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create table public.ai_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  kind        text not null,
  model       text,
  ok          boolean not null,
  latency_ms  int,
  error       text check (error is null or char_length(error) <= 300),
  created_at  timestamptz not null default now()
);
create index ai_requests_user_kind_idx on public.ai_requests (user_id, kind, created_at desc);

-- ---------------------------------------------------------------- new-user hook
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), ''), 120)
  );
  insert into public.activity_log (kind, summary, actor_id)
  values ('registration', coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, 'A student') || ' registered', new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
