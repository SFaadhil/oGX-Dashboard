-- ============================================================================
-- AIESEC in India - oGX Talent Hub
-- Migration 002: columns and tables the hourly EXPA sync needs.
-- Run after supabase/schema.sql. Safe to re-run.
-- ============================================================================

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

-- One row per EXPA application. This MUST be a real constraint, not a partial
-- unique index: Postgres will not accept a partial index as an ON CONFLICT
-- target unless the statement repeats its WHERE clause, which PostgREST cannot
-- express. A plain UNIQUE already allows many NULLs, so manually created leads
-- (which have no EXPA id) are unaffected either way.
drop index if exists public.leads_expa_application_key;
alter table public.leads
  drop constraint if exists leads_expa_application_id_key;
alter table public.leads
  add constraint leads_expa_application_id_key unique (expa_application_id);

create index if not exists leads_expa_person_idx on public.leads (expa_person_id);
create index if not exists leads_applied_at_idx  on public.leads (applied_at desc);
create index if not exists leads_synced_at_idx   on public.leads (synced_at desc);

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

-- ------------------------------------------------------------- EP managers --
-- The sync upserts each applicant's EP manager straight from EXPA, keyed on
-- their EXPA person id. Email is not always present on those records, so it
-- cannot stay NOT NULL.
alter table public.managers alter column email drop not null;

-- Both of these are ON CONFLICT targets (expa_id) or may become one, so they
-- are real constraints rather than partial indexes. UNIQUE permits multiple
-- NULLs, which is what lets managers exist without an email or an EXPA id.
drop index if exists public.managers_email_key;
drop index if exists public.managers_expa_id_key;
alter table public.managers drop constraint if exists managers_email_key;
alter table public.managers add constraint managers_email_key unique (email);
alter table public.managers drop constraint if exists managers_expa_id_key;
alter table public.managers add constraint managers_expa_id_key unique (expa_id);

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

