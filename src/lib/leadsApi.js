import { supabase, isSupabaseConfigured, publicFileUrl } from './supabaseClient';

export const LEAD_COLUMNS = `
  id, lead_id, first_name, last_name, full_name, email, phone_number, university,
  product, year_of_studies, linkedin_url, desired_regions, desired_countries,
  duration, start_date, status, gender, date_of_birth, home_lc, is_aiesecer,
  show_in_cvpool, assigned_on_expa, expa_id, manager_id, feedback_status,
  manager_feedback, created_at, updated_at,
  expa_application_id, expa_person_id, expa_status, sub_product,
  opportunity_id, opportunity_title, host_lc, host_mc, host_mc_country,
  experience_end_date, applied_at, synced_at, source
`;

const MANAGER_JOIN = 'manager:manager_id (id, first_name, last_name, email, phone_number, key_area, ogt, expa_id)';

/**
 * Fetch leads with the manager join plus the background / document side tables.
 * `filter` receives the query builder so callers can scope by manager, status, etc.
 */
export async function fetchLeads({ filter, withBackgrounds = true, withDocuments = true } = {}) {
  if (!isSupabaseConfigured) return { rows: [], error: 'Supabase is not configured.' };

  let query = supabase
    .from('leads')
    .select(`${LEAD_COLUMNS}, ${MANAGER_JOIN}`)
    .order('created_at', { ascending: false });
  if (filter) query = filter(query);

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };

  const rows = data || [];
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { rows, error: null };

  const [bgRes, docRes] = await Promise.all([
    withBackgrounds
      ? supabase.from('lead_backgrounds').select('lead_id, backgrounds(id, name)').in('lead_id', ids)
      : Promise.resolve({ data: [] }),
    withDocuments
      ? supabase
          .from('lead_documents')
          .select('id, lead_id, file_url, doc_type, uploaded_at')
          .in('lead_id', ids)
          .order('uploaded_at', { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  const bgMap = {};
  (bgRes.data || []).forEach((row) => {
    if (!row.backgrounds) return;
    (bgMap[row.lead_id] = bgMap[row.lead_id] || []).push(row.backgrounds);
  });

  const cvMap = {};
  (docRes.data || []).forEach((row) => {
    const isCV = !row.doc_type || String(row.doc_type).toLowerCase().includes('cv');
    if (isCV && !cvMap[row.lead_id]) cvMap[row.lead_id] = publicFileUrl(row.file_url);
  });

  return {
    rows: rows.map((r) => ({ ...r, backgrounds: bgMap[r.id] || [], cv_url: cvMap[r.id] || null })),
    error: null
  };
}

export async function fetchManagers(select = 'id, first_name, last_name, email, phone_number, key_area, ogt, expa_id, reports_to, profile_picture, last_login') {
  if (!isSupabaseConfigured) return { rows: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.from('managers').select(select).order('first_name');
  return { rows: data || [], error: error?.message || null };
}

export async function fetchBackgrounds() {
  if (!isSupabaseConfigured) return { rows: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.from('backgrounds').select('id, name').order('name');
  return { rows: data || [], error: error?.message || null };
}

export async function setLeadBackgrounds(leadId, backgroundIds) {
  await supabase.from('lead_backgrounds').delete().eq('lead_id', leadId);
  if (!backgroundIds.length) return;
  await supabase
    .from('lead_backgrounds')
    .insert(backgroundIds.map((background_id) => ({ lead_id: leadId, background_id })));
}

export async function logAction(managerId, action, details) {
  if (!isSupabaseConfigured || !managerId) return;
  await supabase.from('action_logs').insert({
    manager_id: managerId,
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details || {})
  });
}
