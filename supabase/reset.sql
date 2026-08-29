-- ============================================================================
-- DESTRUCTIVE. Drops every oGX Talent Hub table and all data in them.
--
-- Only for a clean slate before real data exists. If `leads` has rows you
-- care about, do NOT run this - run setup.sql instead, which repairs in place.
--
-- Check first:
--     select count(*) from public.leads;
--
-- After running this, run setup.sql.
-- ============================================================================

drop table if exists public.lead_backgrounds  cascade;
drop table if exists public.lead_documents    cascade;
drop table if exists public.lead_proofs       cascade;
drop table if exists public.lead_notes        cascade;
drop table if exists public.approval_requests cascade;
drop table if exists public.followups         cascade;
drop table if exists public.action_logs       cascade;
drop table if exists public.sync_runs         cascade;
drop table if exists public.leads             cascade;
drop table if exists public.backgrounds       cascade;
drop table if exists public.manager_profiles  cascade;
drop table if exists public.managers          cascade;
drop table if exists public.app_settings      cascade;

-- The storage bucket and its objects are left alone on purpose; uploaded CVs
-- survive. To clear those too, delete the bucket from Storage in the dashboard.
