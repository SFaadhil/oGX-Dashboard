-- ============================================================================
-- Health check. Run on its own in the Supabase SQL editor after setup.sql.
-- ============================================================================

select
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in (
         'managers', 'leads', 'backgrounds', 'lead_backgrounds',
         'lead_documents', 'app_settings', 'sync_runs'
       )
  )                                                          as tables_present,   -- expect 7

  -- Login-era tables should all be gone.
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in (
         'manager_profiles', 'approval_requests', 'followups',
         'action_logs', 'lead_notes', 'lead_proofs'
       )
  )                                                          as retired_tables,   -- expect 0

  -- There is no login, so no password column should exist.
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'managers' and column_name = 'password'
  )                                                          as password_column,  -- expect 0

  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'leads'
       and column_name in (
         'expa_application_id', 'expa_person_id', 'expa_status', 'programme_id',
         'sub_product', 'opportunity_id', 'opportunity_title', 'host_lc',
         'host_mc', 'host_mc_country', 'experience_end_date', 'applied_at',
         'synced_at', 'source'
       )
  )                                                          as expa_lead_columns, -- expect 14

  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'leads_expa_application_key'
  )                                                          as expa_unique_index, -- expect 1

  (select count(*) from pg_constraint
     where conname = 'lead_documents_lead_type_source_key'
  )                                                          as doc_unique_key,    -- expect 1

  (select count(*) from storage.buckets where id = 'lead_documents')
                                                             as storage_bucket,    -- expect 1

  (select count(*) from public.backgrounds)                  as backgrounds,       -- expect 46
  (select count(*) from public.leads)                        as leads,             -- 0 until first sync
  (select count(*) from public.leads where show_in_cvpool)   as live_in_cv_pool,
  (select count(*) from public.sync_runs)                    as sync_runs;

-- ---------------------------------------------------------------- security --
-- Every table must have RLS on with exactly one SELECT policy and no write
-- policy. `rls_enabled` should be true and `write_policies` 0 on every row.
-- pg_policy.polcmd: 'r' = SELECT, 'a' = INSERT, 'w' = UPDATE, 'd' = DELETE, '*' = ALL
select
  c.relname                                                        as table_name,
  c.relrowsecurity                                                 as rls_enabled,
  count(p.oid) filter (where p.polcmd = 'r')                       as select_policies,
  count(p.oid) filter (where p.polcmd is not null and p.polcmd <> 'r') as write_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'managers', 'leads', 'backgrounds', 'lead_backgrounds',
    'lead_documents', 'app_settings', 'sync_runs'
  )
group by c.relname, c.relrowsecurity
order by c.relname;

-- The anon role must hold SELECT only. Any INSERT/UPDATE/DELETE row here is a
-- problem: the dashboard is public, so those grants would be world-writable.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and privilege_type <> 'SELECT'
order by table_name, privilege_type;
