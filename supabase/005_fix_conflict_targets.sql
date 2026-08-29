-- ============================================================================
-- AIESEC in India - oGX Talent Hub
-- Migration 005: make every ON CONFLICT target a real constraint.
--
-- The sync failed with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- Cause: leads.expa_application_id and managers.expa_id were PARTIAL unique
-- indexes (`... where col is not null`). Postgres only accepts a partial index
-- as an ON CONFLICT target if the statement repeats the same WHERE clause, and
-- PostgREST cannot express that. A plain UNIQUE constraint already allows
-- multiple NULLs, so the partial predicate bought nothing.
--
-- Run this on its own, then re-run the workflow. Safe to re-run.
-- ============================================================================

drop index if exists public.leads_expa_application_key;
alter table public.leads
  drop constraint if exists leads_expa_application_id_key;
alter table public.leads
  add constraint leads_expa_application_id_key unique (expa_application_id);

alter table public.managers alter column email drop not null;

drop index if exists public.managers_email_key;
drop index if exists public.managers_expa_id_key;
alter table public.managers drop constraint if exists managers_email_key;
alter table public.managers add constraint managers_email_key unique (email);
alter table public.managers drop constraint if exists managers_expa_id_key;
alter table public.managers add constraint managers_expa_id_key unique (expa_id);

-- Confirm: every row below should read is_real_constraint = true.
select
  c.conname                              as constraint_name,
  t.relname                              as table_name,
  true                                   as is_real_constraint
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and c.contype = 'u'
  and c.conname in (
    'leads_expa_application_id_key',
    'managers_expa_id_key',
    'managers_email_key',
    'lead_documents_lead_type_source_key',
    'backgrounds_name_key'
  )
order by t.relname, c.conname;
