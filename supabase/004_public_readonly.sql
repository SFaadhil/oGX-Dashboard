-- ============================================================================
-- AIESEC in India - oGX Talent Hub
-- Migration 004: public read-only access.
--
-- The dashboard has no login. Everyone reads; nobody writes from the browser.
-- Only the hourly EXPA sync writes, and it uses the service-role key, which
-- bypasses RLS entirely - so no write policy is needed anywhere.
--
-- Run this AFTER setup.sql. Safe to re-run.
-- ============================================================================

-- --------------------------------------------------------- drop the login ---
-- Nothing signs in any more. `managers` is kept because leads reference it as
-- the EP manager, but the password column has no reason to exist.
alter table public.managers drop column if exists password;

drop table if exists public.manager_profiles  cascade;
drop table if exists public.approval_requests cascade;
drop table if exists public.followups         cascade;
drop table if exists public.action_logs       cascade;
drop table if exists public.lead_notes        cascade;
drop table if exists public.lead_proofs       cascade;

-- ------------------------------------------------------------------ RLS -----
-- Enable RLS everywhere, then grant SELECT only. With RLS on and no INSERT /
-- UPDATE / DELETE policy, the anon key physically cannot modify these tables.
alter table public.managers        enable row level security;
alter table public.leads           enable row level security;
alter table public.backgrounds     enable row level security;
alter table public.lead_backgrounds enable row level security;
alter table public.lead_documents  enable row level security;
alter table public.app_settings    enable row level security;
alter table public.sync_runs       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'managers', 'leads', 'backgrounds', 'lead_backgrounds',
    'lead_documents', 'app_settings', 'sync_runs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );
  end loop;
end $$;

-- Belt and braces: revoke the write grants from the anon role outright, so
-- even a future policy mistake cannot open up writes.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;

alter default privileges in schema public
  revoke insert, update, delete on tables from anon;
alter default privileges in schema public
  revoke insert, update, delete on tables from authenticated;

-- -------------------------------------------------------------- storage -----
-- CVs stay publicly readable, but the browser may no longer upload into the
-- bucket - only the sync can, via the service-role key.
drop policy if exists "lead_documents anon write" on storage.objects;
drop policy if exists "lead_documents public read" on storage.objects;

create policy "lead_documents public read"
  on storage.objects for select
  using (bucket_id = 'lead_documents');
