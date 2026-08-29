-- ============================================================================
-- AIESEC in India - oGX Talent Hub
-- Run this in the Supabase SQL editor of the AIESEC in India project.
-- Safe to re-run: every statement is IF NOT EXISTS / ON CONFLICT guarded.
-- ============================================================================

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
