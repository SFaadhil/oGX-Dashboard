-- ============================================================================
-- Health check. Run this on its own in the Supabase SQL editor to see exactly
-- what landed. Every "missing" column should read 0 and every "expected"
-- count should match.
-- ============================================================================

select
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in (
         'managers', 'manager_profiles', 'leads', 'backgrounds', 'lead_backgrounds',
         'lead_documents', 'lead_proofs', 'lead_notes', 'followups',
         'approval_requests', 'action_logs', 'app_settings', 'sync_runs'
       )
  )                                                        as tables_present,   -- expect 13

  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'leads'
       and column_name in (
         'expa_application_id', 'expa_person_id', 'expa_status', 'programme_id',
         'sub_product', 'opportunity_id', 'opportunity_title', 'host_lc',
         'host_mc', 'host_mc_country', 'experience_end_date', 'applied_at',
         'synced_at', 'source'
       )
  )                                                        as expa_lead_columns, -- expect 14

  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'lead_documents'
       and column_name in ('source', 'source_url')
  )                                                        as doc_columns,       -- expect 2

  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'leads_expa_application_key'
  )                                                        as expa_unique_index, -- expect 1

  (select count(*) from pg_constraint
     where conname = 'lead_documents_lead_type_source_key'
  )                                                        as doc_unique_key,    -- expect 1

  (select count(*) from storage.buckets where id = 'lead_documents')
                                                           as storage_bucket,    -- expect 1

  (select count(*) from public.backgrounds)                as backgrounds,       -- expect 46
  (select count(*) from public.managers)                   as managers,          -- expect >= 1
  (select count(*) from public.leads)                      as leads,             -- 0 until first sync
  (select count(*) from public.sync_runs)                  as sync_runs,         -- 0 until first sync
  (select value from public.app_settings where key = 'cv_pool_open')
                                                           as cv_pool_open;      -- expect 'true'

-- Who can sign in right now:
select email, first_name, last_name, key_area, ogt, last_login
from public.managers
order by created_at;
