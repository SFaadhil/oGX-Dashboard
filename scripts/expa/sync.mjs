// Sync engine: window maths and the Supabase write path.
// Kept separate from the CLI so both can be tested without network access.

import { createExpaClient, INDIA_MC_ID, PROGRAMMES } from './client.mjs';
import { mapApplication } from './map.mjs';

export const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/** Resolve the created_at window the run should cover. */
export function resolveWindow(args = {}, now = new Date()) {
  if (args.full) return { from: null, to: null, label: 'all time' };

  const to = args.until ? new Date(args.until) : new Date(now);

  if (args.since) {
    const rel = /^(\d+)([hd])$/.exec(String(args.since));
    if (rel) {
      const ms = Number(rel[1]) * (rel[2] === 'h' ? 3600e3 : 86400e3);
      return { from: new Date(to.getTime() - ms), to, label: `last ${rel[1]}${rel[2]}` };
    }
    const from = new Date(args.since);
    if (Number.isNaN(from.getTime())) throw new Error(`--since is not a date or duration: ${args.since}`);
    return { from, to, label: `${args.since} -> ${to.toISOString().slice(0, 10)}` };
  }

  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  return { from, to, label: 'today' };
}

/** Resolve background names to ids, creating any that are new. */
export async function ensureBackgrounds(supabase, names) {
  const byLower = new Map();
  if (!names.length) return byLower;

  const { data: existing, error } = await supabase
    .from('backgrounds')
    .select('id, name')
    .in('name', names);
  if (error) throw new Error(`backgrounds lookup failed: ${error.message}`);
  (existing || []).forEach((b) => byLower.set(b.name.toLowerCase(), b.id));

  const missing = names.filter((n) => !byLower.has(n.toLowerCase()));
  if (!missing.length) return byLower;

  const { error: insErr } = await supabase
    .from('backgrounds')
    .upsert(missing.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
  if (insErr) throw new Error(`background insert failed: ${insErr.message}`);

  // ignoreDuplicates returns no rows, so read the ids back.
  const { data: refetched, error: reErr } = await supabase
    .from('backgrounds')
    .select('id, name')
    .in('name', missing);
  if (reErr) throw new Error(`background re-read failed: ${reErr.message}`);
  (refetched || []).forEach((b) => byLower.set(b.name.toLowerCase(), b.id));

  return byLower;
}

export async function mirrorCv(supabase, bucket, token, cvUrl, applicationId, fetchImpl = fetch) {
  const url = cvUrl.includes('access_token')
    ? cvUrl
    : `${cvUrl}${cvUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;

  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`CV download failed (HTTP ${res.status})`);

  const contentType = res.headers.get('content-type') || 'application/pdf';
  const ext = contentType.includes('pdf') ? 'pdf'
    : /word|officedocument/.test(contentType) ? 'docx'
      : 'bin';
  const body = Buffer.from(await res.arrayBuffer());
  const key = `expa/${applicationId}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, body, { contentType, upsert: true, cacheControl: '3600' });
  if (error) throw new Error(`CV upload failed: ${error.message}`);

  return key;
}

/**
 * Write one page of mapped applications.
 *
 * Rows that already exist get only their EXPA-owned columns refreshed, so
 * manager assignment, pipeline status and CV-pool visibility survive re-syncs.
 */
export async function writePage(supabase, mapped, opts = {}) {
  const { bucket = 'lead_documents', token, mirrorCvs = false, fetchImpl = fetch } = opts;
  const stats = opts.stats || { inserted: 0, updated: 0, cvsLinked: 0, cvsMirrored: 0, errors: [] };
  if (!mapped.length) return stats;

  const ids = mapped.map((m) => m.expaFields.expa_application_id);

  const { data: existing, error: exErr } = await supabase
    .from('leads')
    .select('id, expa_application_id')
    .in('expa_application_id', ids);
  if (exErr) throw new Error(`existing-lead lookup failed: ${exErr.message}`);

  const leadIdByExpa = new Map((existing || []).map((r) => [r.expa_application_id, r.id]));
  const isNew = (m) => !leadIdByExpa.has(m.expaFields.expa_application_id);

  // --- inserts -------------------------------------------------------------
  const newOnes = mapped.filter(isNew);
  for (const batch of chunk(newOnes, 200)) {
    const payload = batch.map((m) => ({ ...m.defaults, ...m.expaFields }));
    const { data, error } = await supabase
      .from('leads')
      .upsert(payload, { onConflict: 'expa_application_id' })
      .select('id, expa_application_id');
    if (error) throw new Error(`lead insert failed: ${error.message}`);
    (data || []).forEach((r) => leadIdByExpa.set(r.expa_application_id, r.id));
    stats.inserted += data?.length || 0;
  }

  // --- updates: EXPA-owned columns only ------------------------------------
  for (const m of mapped) {
    if (newOnes.includes(m)) continue;
    const leadId = leadIdByExpa.get(m.expaFields.expa_application_id);
    if (!leadId) continue;
    const { error } = await supabase.from('leads').update(m.expaFields).eq('id', leadId);
    if (error) { stats.errors.push(`update ${m.expaFields.expa_application_id}: ${error.message}`); continue; }
    stats.updated += 1;
  }

  // --- backgrounds ---------------------------------------------------------
  const allNames = [...new Set(mapped.flatMap((m) => m.backgroundNames))];
  const bgByName = await ensureBackgrounds(supabase, allNames);

  const links = [];
  mapped.forEach((m) => {
    const leadId = leadIdByExpa.get(m.expaFields.expa_application_id);
    if (!leadId) return;
    m.backgroundNames.forEach((name) => {
      const bgId = bgByName.get(name.toLowerCase());
      if (bgId) links.push({ lead_id: leadId, background_id: bgId });
    });
  });
  for (const batch of chunk(links, 400)) {
    const { error } = await supabase
      .from('lead_backgrounds')
      .upsert(batch, { onConflict: 'lead_id,background_id', ignoreDuplicates: true });
    if (error) stats.errors.push(`background link failed: ${error.message}`);
  }

  // --- CVs -----------------------------------------------------------------
  const docs = [];
  for (const m of mapped) {
    if (!m.cvUrl) continue;
    const leadId = leadIdByExpa.get(m.expaFields.expa_application_id);
    if (!leadId) continue;

    let fileUrl = m.cvUrl;
    if (mirrorCvs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        fileUrl = await mirrorCv(supabase, bucket, token, m.cvUrl, m.expaFields.expa_application_id, fetchImpl);
        stats.cvsMirrored += 1;
      } catch (err) {
        stats.errors.push(`cv mirror ${m.expaFields.expa_application_id}: ${err.message}`);
      }
    }

    docs.push({
      lead_id: leadId,
      file_url: fileUrl,
      source_url: m.cvUrl,
      doc_type: 'cv',
      source: 'expa',
      uploaded_at: new Date().toISOString()
    });
  }

  for (const batch of chunk(docs, 200)) {
    const { error } = await supabase
      .from('lead_documents')
      .upsert(batch, { onConflict: 'lead_id,doc_type,source' });
    if (error) stats.errors.push(`cv link failed: ${error.message}`);
    else stats.cvsLinked += batch.length;
  }

  return stats;
}

/** Full run: fetch every page in the window and write it. */
export async function runSync({
  token,
  supabase,
  window: win,
  homeMc = INDIA_MC_ID,
  programmes = [PROGRAMMES.GTa, PROGRAMMES.GTe],
  perPage = 100,
  dryRun = false,
  mirrorCvs = false,
  publishToPool = false,
  bucket = 'lead_documents',
  onProgress = () => {}
}) {
  const expa = createExpaClient({ token });
  const stats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, cvsLinked: 0, cvsMirrored: 0, errors: [] };

  await expa.fetchApplications({
    homeMc,
    programmes,
    from: win.from,
    to: win.to,
    perPage,
    onPage: async (rows, meta) => {
      stats.fetched += rows.length;
      onProgress({ ...meta, fetched: stats.fetched });

      const mapped = rows.map((r) => mapApplication(r, { publishToPool })).filter((m) => {
        if (!m.expaFields.product) { stats.skipped += 1; return false; }
        return true;
      });
      if (!mapped.length || dryRun) return;

      await writePage(supabase, mapped, { bucket, token, mirrorCvs, stats });
    }
  });

  return stats;
}
