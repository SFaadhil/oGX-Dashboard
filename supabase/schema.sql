-- ============================================================================
-- AIESEC in India - oGX Talent Hub :: base schema
-- Run this in the Supabase SQL editor of the AIESEC in India project.
--
-- Safe to re-run, and repair-capable: it converges to the right shape from an
-- empty database, a complete one, or one left half-built by a failed run.
--
-- The dashboard has no login. Nothing in the browser writes; the only writer
-- is the hourly EXPA sync, using the service-role key.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- managers --
-- oGX team members. Not login accounts - these exist because a lead points at
-- its EP manager, and EXPA tells us who that is.
create table if not exists public.managers (
  id              uuid primary key default gen_random_uuid(),
  first_name      text,
  last_name       text,
  email           text unique not null,
  phone_number    text,
  key_area        text,
  ogt             text,                       -- 'oGT 1' | 'oGT 2'
  expa_id         text,
  profile_picture text,
  created_at      timestamptz not null default now()
);

-- Repair pass: `create table if not exists` will not add columns to a table
-- that already exists from an earlier run.
alter table public.managers add column if not exists first_name      text;
alter table public.managers add column if not exists last_name       text;
alter table public.managers add column if not exists phone_number    text;
alter table public.managers add column if not exists key_area        text;
alter table public.managers add column if not exists ogt             text;
alter table public.managers add column if not exists expa_id         text;
alter table public.managers add column if not exists profile_picture text;
alter table public.managers add column if not exists created_at      timestamptz not null default now();

-- There is no login, so there is no password to store.
alter table public.managers drop column if exists password;
alter table public.managers drop column if exists last_login;
alter table public.managers drop column if exists reports_to;

create index if not exists managers_expa_idx on public.managers (expa_id);

-- ------------------------------------------------------------- backgrounds --
create table if not exists public.backgrounds (
  id   uuid primary key default gen_random_uuid(),
  name text unique not null
);
create index if not exists backgrounds_name_lower_idx on public.backgrounds (lower(name));

-- ------------------------------------------------------------------- leads --
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  lead_id           text,
  first_name        text,
  last_name         text,
  full_name         text,
  email             text,
  phone_number      text,
  gender            text,
  date_of_birth     date,
  university        text,
  home_lc           text,
  is_aiesecer       boolean default false,
  product           text,                     -- 'GTa' | 'GTe'
  year_of_studies   text,                     -- '1'..'5' | 'Graduate'
  duration          text,                     -- 'Short Term' | 'Mid Term' | 'Long Term'
  linkedin_url      text,
  desired_regions   jsonb default '[]'::jsonb,
  desired_countries jsonb default '[]'::jsonb,
  start_date        date,
  status            text default 'Not Contacted',
  manager_id        uuid references public.managers(id) on delete set null,
  show_in_cvpool    boolean default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.leads add column if not exists lead_id           text;
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
alter table public.leads add column if not exists show_in_cvpool    boolean default false;
alter table public.leads add column if not exists created_at        timestamptz not null default now();
alter table public.leads add column if not exists updated_at        timestamptz not null default now();

create index if not exists leads_manager_idx on public.leads (manager_id);
create index if not exists leads_cvpool_idx  on public.leads (show_in_cvpool);
create index if not exists leads_product_idx on public.leads (product);
create index if not exists leads_status_idx  on public.leads (status);
create index if not exists leads_created_idx on public.leads (created_at desc);

create table if not exists public.lead_backgrounds (
  lead_id       uuid not null references public.leads(id) on delete cascade,
  background_id uuid not null references public.backgrounds(id) on delete cascade,
  primary key (lead_id, background_id)
);

create table if not exists public.lead_documents (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  file_url    text not null,                  -- storage key or absolute URL
  doc_type    text not null default 'cv',
  uploaded_at timestamptz not null default now()
);
create index if not exists lead_documents_lead_idx on public.lead_documents (lead_id);

-- ------------------------------------------------------------- app settings --
create table if not exists public.app_settings (
  key   text primary key,
  value text
);

insert into public.app_settings (key, value)
values ('cv_pool_open', 'true')
on conflict (key) do nothing;

-- ------------------------------------------------- retired login-era tables --
-- These only made sense when people signed in and edited records.
drop table if exists public.manager_profiles  cascade;
drop table if exists public.approval_requests cascade;
drop table if exists public.followups         cascade;
drop table if exists public.action_logs       cascade;
drop table if exists public.lead_notes        cascade;
drop table if exists public.lead_proofs       cascade;

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

-- --------------------------------------------------------------- storage ----
insert into storage.buckets (id, name, public)
values ('lead_documents', 'lead_documents', true)
on conflict (id) do nothing;
