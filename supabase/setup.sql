-- ============================================================================
-- AIESEC in India - oGX Talent Hub :: complete Supabase setup
--
-- Paste this whole file into the Supabase SQL editor and press Run.
--
-- Idempotent AND repair-capable: safe to run on an empty database, on a
-- fully built one, or on one left half-finished by a failed earlier run.
--
-- The SQL editor runs the whole buffer as ONE transaction, so if any
-- statement errors, nothing at all is applied. Fix it and run again.
--
-- Part 1 = base schema (tables, columns, indexes, storage bucket, seeds)
-- Part 2 = EXPA sync additions (extra lead columns, sync_runs)
-- Part 3 = your first sign-in account  <-- EDIT THIS, IT IS AT THE BOTTOM
-- ============================================================================

-- ############################ PART 1: BASE SCHEMA ###########################


create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- managers --
create table if not exists public.managers (
  id              uuid primary key default gen_random_uuid(),
  first_name      text,
  last_name       text,
  email           text unique not null,
  password        text not null,
  phone_number    text,
  key_area        text,
  ogt             text,                       -- 'oGT 1' | 'oGT 2'
  expa_id         text,
  reports_to      uuid references public.managers(id) on delete set null,
  profile_picture text,
  last_login      timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.manager_profiles (
  manager_id       uuid primary key references public.managers(id) on delete cascade,
  theme_preference text default 'light',
  updated_at       timestamptz not null default now()
);

-- If `managers` already existed from an earlier partial run, bring it up to
-- spec. `create table if not exists` above will not add missing columns.
alter table public.managers add column if not exists first_name      text;
alter table public.managers add column if not exists last_name       text;
alter table public.managers add column if not exists phone_number    text;
alter table public.managers add column if not exists key_area        text;
alter table public.managers add column if not exists ogt             text;
alter table public.managers add column if not exists expa_id         text;
alter table public.managers add column if not exists reports_to      uuid references public.managers(id) on delete set null;
alter table public.managers add column if not exists profile_picture text;
alter table public.managers add column if not exists last_login      timestamptz;
alter table public.managers add column if not exists created_at      timestamptz not null default now();

-- ------------------------------------------------------------- backgrounds --
create table if not exists public.backgrounds (
  id   uuid primary key default gen_random_uuid(),
  name text unique not null
);

-- ------------------------------------------------------------------- leads --
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  lead_id          text,                      -- EP / application id shown in the UI
  expa_id          text,
  first_name       text,
  last_name        text,
  full_name        text,
  email            text,
  phone_number     text,
  gender           text,
  date_of_birth    date,
  university       text,
  home_lc          text,
  is_aiesecer      boolean default false,
  product          text,                      -- 'GTa' | 'GTe'
  year_of_studies  text,                      -- '1'..'5' | 'Graduate'
  duration         text,                      -- 'Short Term' | 'Mid Term' | 'Long Term'
  linkedin_url     text,
  desired_regions  jsonb default '[]'::jsonb,
  desired_countries jsonb default '[]'::jsonb,
  start_date       date,
  status           text default 'Not Contacted',
  manager_id       uuid references public.managers(id) on delete set null,
  assigned_on_expa boolean default false,
  show_in_cvpool   boolean default false,
  feedback_status  text default 'pending',    -- 'pending' | 'approved' | 'rejected'
  manager_feedback text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Same repair pass for `leads`.
alter table public.leads add column if not exists lead_id           text;
alter table public.leads add column if not exists expa_id           text;
alter table public.leads add column if not exists first_name        text;
alter table public.leads add column if not exists last_name         text;
alter table public.leads add column if not exists full_name         text;
alter table public.leads add column if not exists email             text;
alter table public.leads add column if not exists phone_number      text;
alter table public.leads add column if not exists gender            text;
alter table public.leads add column if not exists date_of_birth     date;
alter table public.leads add column if not exists university        text;
alter table public.leads add column if not exists home_lc           text;
alter table public.leads add column if not exists is_aiesecer       boolean default false;
alter table public.leads add column if not exists product           text;
alter table public.leads add column if not exists year_of_studies   text;
alter table public.leads add column if not exists duration          text;
alter table public.leads add column if not exists linkedin_url      text;
alter table public.leads add column if not exists desired_regions   jsonb default '[]'::jsonb;
alter table public.leads add column if not exists desired_countries jsonb default '[]'::jsonb;
alter table public.leads add column if not exists start_date        date;
alter table public.leads add column if not exists status            text default 'Not Contacted';
alter table public.leads add column if not exists manager_id        uuid references public.managers(id) on delete set null;
alter table public.leads add column if not exists assigned_on_expa  boolean default false;
alter table public.leads add column if not exists show_in_cvpool    boolean default false;
alter table public.leads add column if not exists feedback_status   text default 'pending';
alter table public.leads add column if not exists manager_feedback  text;
alter table public.leads add column if not exists created_at        timestamptz not null default now();
alter table public.leads add column if not exists updated_at        timestamptz not null default now();

create index if not exists leads_manager_idx  on public.leads (manager_id);
create index if not exists leads_cvpool_idx   on public.leads (show_in_cvpool);
create index if not exists leads_product_idx  on public.leads (product);
create index if not exists leads_status_idx   on public.leads (status);
create index if not exists leads_created_idx  on public.leads (created_at desc);

create table if not exists public.lead_backgrounds (
  lead_id       uuid not null references public.leads(id) on delete cascade,
  background_id uuid not null references public.backgrounds(id) on delete cascade,
  primary key (lead_id, background_id)
);

create table if not exists public.lead_documents (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  file_url    text not null,                  -- storage key or absolute URL
  doc_type    text default 'cv',
  uploaded_at timestamptz not null default now()
);
create index if not exists lead_documents_lead_idx on public.lead_documents (lead_id);

create table if not exists public.lead_proofs (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  file_url    text not null,
  description text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  manager_id uuid references public.managers(id) on delete set null,
  note       text not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- workflow ---
create table if not exists public.followups (
  id             uuid primary key default gen_random_uuid(),
  application_id text not null,               -- leads.lead_id, or leads.id as text
  manager_id     uuid references public.managers(id) on delete cascade,
  notes          text,
  priority       text default 'Default',      -- Urgent | High | Medium | Default
  done           boolean default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references public.leads(id) on delete cascade,
  requester_id  uuid references public.managers(id) on delete set null,
  approver_id   uuid references public.managers(id) on delete set null,
  approver_type text default 'team_leader',
  status        text default 'pending',       -- pending | approved | rejected
  lead_data     jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.action_logs (
  id         uuid primary key default gen_random_uuid(),
  manager_id uuid references public.managers(id) on delete set null,
  action     text not null,
  details    text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key   text primary key,
  value text
);

insert into public.app_settings (key, value)
values ('cv_pool_open', 'true')
on conflict (key) do nothing;

-- ------------------------------------------------------------ seed lookups --
insert into public.backgrounds (name) values
  ('Accounting'), ('Agriculture'), ('Architecture'), ('Arts'), ('Bioengineering'),
  ('Business administration'), ('Chemistry'), ('Civil engineering'),
  ('Communication & journalism'), ('Computer engineering'), ('Computer sciences'),
  ('Economics'), ('Education'), ('Electrical engineering'), ('Environmental science'),
  ('Finance'), ('Health sciences'), ('History'), ('Human Resources'),
  ('Industrial Design'), ('International relations'), ('Languages'), ('Law'),
  ('Linguistics'), ('Literature'), ('Marketing'), ('Mathematics'),
  ('Mechanical engineering'), ('Medicine'), ('Nursing'), ('Nutrition'), ('Other'),
  ('Pharmacy'), ('Philosophy'), ('Physics'), ('Political science'), ('Psychology'),
  ('Public relations'), ('Sales'), ('Social work'), ('Sociology'),
  ('Software development and programming'), ('Sports'), ('Statistics'),
  ('Systems and Computing Engineering'), ('Tourism & hospitality')
on conflict (name) do nothing;

-- ------------------------------------------------------------------ access --
-- The app authenticates against the `managers` table with the anon key, so RLS
-- is left permissive here to match the reference deployment. Tighten it if you
-- move the login to Supabase Auth.
alter table public.managers          disable row level security;
alter table public.manager_profiles  disable row level security;
alter table public.leads             disable row level security;
alter table public.backgrounds       disable row level security;
alter table public.lead_backgrounds  disable row level security;
alter table public.lead_documents    disable row level security;
alter table public.lead_proofs       disable row level security;
alter table public.lead_notes        disable row level security;
alter table public.followups         disable row level security;
alter table public.approval_requests disable row level security;
alter table public.action_logs       disable row level security;
alter table public.app_settings      disable row level security;

-- --------------------------------------------------------------- storage ----
-- Public bucket for CVs and proofs. Create it once:
insert into storage.buckets (id, name, public)
values ('lead_documents', 'lead_documents', true)
on conflict (id) do nothing;

drop policy if exists "lead_documents public read" on storage.objects;
create policy "lead_documents public read"
  on storage.objects for select
  using (bucket_id = 'lead_documents');

drop policy if exists "lead_documents anon write" on storage.objects;
create policy "lead_documents anon write"
  on storage.objects for insert
  with check (bucket_id = 'lead_documents');

-- ######################## PART 2: EXPA SYNC ADDITIONS #######################


-- ---------------------------------------------------------- lead additions --
alter table public.leads add column if not exists expa_application_id text;
alter table public.leads add column if not exists expa_person_id      text;
alter table public.leads add column if not exists expa_status         text;
alter table public.leads add column if not exists programme_id        int;
alter table public.leads add column if not exists sub_product         text;
alter table public.leads add column if not exists opportunity_id      text;
alter table public.leads add column if not exists opportunity_title   text;
alter table public.leads add column if not exists host_lc             text;
alter table public.leads add column if not exists host_mc             text;
alter table public.leads add column if not exists host_mc_country     text;
alter table public.leads add column if not exists experience_end_date date;
alter table public.leads add column if not exists applied_at          timestamptz;
alter table public.leads add column if not exists synced_at           timestamptz;
alter table public.leads add column if not exists source              text default 'manual';

-- One row per EXPA application. Partial index so manually created leads
-- (which have no EXPA id) are unaffected.
create unique index if not exists leads_expa_application_key
  on public.leads (expa_application_id)
  where expa_application_id is not null;

create index if not exists leads_expa_person_idx on public.leads (expa_person_id);
create index if not exists leads_applied_at_idx  on public.leads (applied_at desc);
create index if not exists leads_synced_at_idx   on public.leads (synced_at desc);

-- Backgrounds are matched by name. `backgrounds.name` already carries a UNIQUE
-- constraint from schema.sql (that is the ON CONFLICT target the sync uses);
-- this index just makes the case-insensitive lookup cheap.
create index if not exists backgrounds_name_lower_idx on public.backgrounds (lower(name));

-- A lead should not accumulate duplicate CV rows across hourly runs. The
-- constraint is (lead_id, doc_type, source) so a manual upload and the synced
-- EXPA copy can coexist - the newer row is the one the UI shows.
alter table public.lead_documents add column if not exists source_url text;
alter table public.lead_documents add column if not exists source     text not null default 'upload';

-- Collapse any pre-existing duplicates before adding the constraint.
delete from public.lead_documents a
using public.lead_documents b
where a.lead_id = b.lead_id
  and coalesce(a.doc_type, 'cv') = coalesce(b.doc_type, 'cv')
  and a.source = b.source
  and a.uploaded_at < b.uploaded_at;

alter table public.lead_documents
  alter column doc_type set default 'cv';
update public.lead_documents set doc_type = 'cv' where doc_type is null;
alter table public.lead_documents
  alter column doc_type set not null;

alter table public.lead_documents
  drop constraint if exists lead_documents_lead_type_source_key;
alter table public.lead_documents
  add constraint lead_documents_lead_type_source_key unique (lead_id, doc_type, source);

-- ------------------------------------------------------------- sync runs ----
create table if not exists public.sync_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'expa',
  window_from   timestamptz,
  window_to     timestamptz,
  fetched       int default 0,
  inserted      int default 0,
  updated       int default 0,
  skipped       int default 0,
  cvs_linked    int default 0,
  status        text default 'running',   -- running | success | failed
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists sync_runs_started_idx on public.sync_runs (started_at desc);

alter table public.sync_runs disable row level security;

-- The sync writes with the service-role key, which bypasses RLS anyway.

-- ########################## PART 3: FIRST ADMIN #############################


insert into public.managers (first_name, last_name, email, password, key_area, ogt)
values (
  'oGX',                       -- first name
  'Admin',                     -- last name
  'ogx.admin@aiesec.in',       -- email you will sign in with
  'change-me',                 -- password you will sign in with
  'Administrator',             -- keep as 'Administrator' or use 'LCVP oGX'
  'oGT 1'
)
on conflict (email) do update
  set first_name = excluded.first_name,
      last_name  = excluded.last_name,
      password   = excluded.password,
      key_area   = excluded.key_area,
      ogt        = excluded.ogt;
