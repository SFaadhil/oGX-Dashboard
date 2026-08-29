// Exercises the window maths, the EXPA paging loop and the Supabase write path
// against stubs. No network, no real applicant data.
// Run: node scripts/expa/sync.test.mjs
import assert from 'node:assert/strict';
import { resolveWindow, writePage, ensureBackgrounds, ensureManagers, chunk } from './sync.mjs';
import { createExpaClient } from './client.mjs';
import { mapApplication } from './map.mjs';

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`); process.exitCode = 1; }
};

/* ------------------------------------------------------------ fixtures --- */

const app = (id, over = {}) => ({
  id,
  status: 'open',
  current_status: 'open',
  created_at: '2026-08-28T06:00:00.000Z',
  experience_start_date: '2026-10-01T00:00:00.000Z',
  experience_end_date: '2027-02-01T00:00:00.000Z',
  cv: null,
  person: {
    id: `p${id}`,
    full_name: `Person ${id}`,
    first_name: 'Person',
    last_name: String(id),
    email: `p${id}@example.com`,
    cv_url: `https://gis-api.aiesec.org/cv/${id}.pdf`,
    contact_detail: { phone: '9800000000' },
    home_lc: { id: '2340', name: 'India National Office' },
    home_mc: { id: '1585', name: 'India' },
    latest_academic: { organisation_name: 'Test University', start_date: '2024-08-01', end_date: '2028-06-01' },
    academic_experiences: [],
    latest_academic_experience_backgrounds: [],
    managers: [{ id: '5001', full_name: 'Rohan Iyer', email: 'rohan@aiesec.in' }],
    person_profile: { backgrounds: [{ id: '11', name: 'Computer sciences' }], selected_programmes: [8] }
  },
  opportunity: {
    id: '4400',
    title: 'Role',
    programme: { id: '8', short_name_display: 'GTa' },
    sub_product: { id: '3', name: 'Information Technology' },
    opportunity_duration_type: { duration_type: 'long_term' },
    home_lc: { id: '900', name: 'Host LC' },
    home_mc: { id: '1600', name: 'Poland', country_code: 'PL' }
  },
  ...over
});

/** Minimal Supabase stub that records every call. */
function stubSupabase({ existingLeads = [], existingBackgrounds = [], existingManagers = [] } = {}) {
  const calls = { updates: [], upserts: [], inserts: [], storage: [] };
  let leadSeq = 1000;

  const table = (name) => {
    const state = { name, filters: {} };
    const api = {
      select(cols) { state.select = cols; return api; },
      in(col, vals) { state.filters[col] = vals; return api; },
      eq(col, val) { state.filters[col] = val; return api; },
      single() { return api.then ? api : Promise.resolve({ data: null, error: null }); },
      update(values) {
        state.op = 'update'; state.values = values;
        return {
          eq(col, val) {
            calls.updates.push({ table: name, values, [col]: val });
            return Promise.resolve({ data: null, error: null });
          }
        };
      },
      upsert(rows, options) {
        state.op = 'upsert';
        calls.upserts.push({ table: name, rows, options });
        const made = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
          ...r,
          id: r.id || `${name === 'backgrounds' ? 'bg' : name === 'managers' ? 'mgr' : 'lead'}-${leadSeq++}`
        }));
        // Persist so a later read sees the row, the way Postgres would.
        if (name === 'backgrounds') existingBackgrounds.push(...made);
        if (name === 'leads') existingLeads.push(...made);
        if (name === 'managers') existingManagers.push(...made);
        const res = { data: options?.ignoreDuplicates ? null : made, error: null };
        return { select: () => Promise.resolve(res), then: (fn) => Promise.resolve(res).then(fn) };
      },
      then(resolve) {
        // Terminal read.
        if (name === 'leads') {
          const wanted = state.filters.expa_application_id || [];
          return Promise.resolve({
            data: existingLeads.filter((l) => wanted.includes(l.expa_application_id)),
            error: null
          }).then(resolve);
        }
        if (name === 'backgrounds') {
          const wanted = state.filters.name || [];
          return Promise.resolve({
            data: existingBackgrounds.filter((b) => wanted.includes(b.name)),
            error: null
          }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }
    };
    return api;
  };

  return {
    calls,
    from: table,
    storage: {
      from: (bucket) => ({
        upload: (key, body, opts) => {
          calls.storage.push({ bucket, key, size: body.length, opts });
          return Promise.resolve({ data: { path: key }, error: null });
        }
      })
    }
  };
}

/* --------------------------------------------------------------- tests --- */

const NOW = new Date('2026-08-28T14:30:00.000Z');

console.log('window');
await t('default is midnight today -> now', () => {
  const w = resolveWindow({}, NOW);
  assert.equal(w.label, 'today');
  assert.equal(w.to.toISOString(), NOW.toISOString());
  assert.equal(w.from.getHours(), 0);
  assert.equal(w.from.getMinutes(), 0);
  assert.ok(w.from < w.to);
});
await t('--since 6h is a rolling window', () => {
  const w = resolveWindow({ since: '6h' }, NOW);
  assert.equal(w.label, 'last 6h');
  assert.equal(w.to.getTime() - w.from.getTime(), 6 * 3600e3);
});
await t('--since 3d', () => {
  const w = resolveWindow({ since: '3d' }, NOW);
  assert.equal(w.to.getTime() - w.from.getTime(), 3 * 86400e3);
});
await t('--since <date> --until <date>', () => {
  const w = resolveWindow({ since: '2026-08-01', until: '2026-08-15' }, NOW);
  assert.equal(w.from.toISOString().slice(0, 10), '2026-08-01');
  assert.equal(w.to.toISOString().slice(0, 10), '2026-08-15');
});
await t('--full has no bounds', () => {
  const w = resolveWindow({ full: true }, NOW);
  assert.equal(w.from, null);
  assert.equal(w.to, null);
});
await t('a nonsense --since is rejected', () => {
  assert.throws(() => resolveWindow({ since: 'yesterdayish' }, NOW), /not a date or duration/);
});

console.log('\nEXPA paging');
await t('sends the right filters and follows total_pages', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push(body.variables);
    const page = body.variables.page;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          allOpportunityApplication: {
            data: page <= 3 ? [app(`${page}01`), app(`${page}02`)] : [],
            paging: { total_pages: 3, current_page: page, total_items: 6 }
          }
        }
      })
    };
  };

  const client = createExpaClient({ token: 'test-token', fetchImpl });
  const res = await client.fetchApplications({
    from: new Date('2026-08-28T00:00:00Z'),
    to: new Date('2026-08-28T14:00:00Z'),
    perPage: 2
  });

  assert.equal(res.rows.length, 6);
  assert.equal(res.totalItems, 6);
  assert.deepEqual(seen[0].filters.person_home_mc, [1585]);
  assert.deepEqual(seen[0].filters.programmes, [8, 9]);
  assert.equal(seen[0].filters.created_at.from, '2026-08-28T00:00:00.000Z');
  assert.equal(seen[0].filters.created_at.to, '2026-08-28T14:00:00.000Z');
  assert.equal(seen.length, 3);
});

await t('an expired token fails loudly instead of retrying', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const client = createExpaClient({ token: 'stale', fetchImpl });
  await assert.rejects(() => client.whoAmI(), /expired|rejected the access token/i);
});

await t('GraphQL errors surface', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ errors: [{ message: "Field 'nope' doesn't exist" }] })
  });
  const client = createExpaClient({ token: 't', fetchImpl });
  await assert.rejects(() => client.whoAmI(), /doesn't exist/);
});

console.log('\nwrite path');
await t('new applications are inserted with safe defaults', async () => {
  const supabase = stubSupabase();
  const mapped = [app('7001'), app('7002')].map(mapApplication);
  const stats = await writePage(supabase, mapped, { token: 't' });

  assert.equal(stats.inserted, 2);
  assert.equal(stats.updated, 0);

  const leadUpsert = supabase.calls.upserts.find((c) => c.table === 'leads');
  assert.equal(leadUpsert.options.onConflict, 'expa_application_id');
  assert.equal(leadUpsert.rows[0].show_in_cvpool, false, 'must not auto-publish');
  assert.equal(leadUpsert.rows[0].status, 'Not Contacted');
  assert.equal(leadUpsert.rows[0].source, 'expa');
  assert.equal(leadUpsert.rows[0].product, 'GTa');
});

await t('existing leads keep status and pool visibility, but track EXPA', async () => {
  const supabase = stubSupabase({
    existingLeads: [{ id: 'lead-a', expa_application_id: '7001' }]
  });
  const mapped = [app('7001')].map(mapApplication);
  const stats = await writePage(supabase, mapped, { token: 't' });

  assert.equal(stats.inserted, 0);
  assert.equal(stats.updated, 1);

  const upd = supabase.calls.updates.find((u) => u.table === 'leads');
  assert.equal(upd.id, 'lead-a');

  // `status` and `show_in_cvpool` are decided outside EXPA, so a re-sync must
  // never reset them.
  ['status', 'show_in_cvpool']
    .forEach((k) => assert.ok(!(k in upd.values), `update must not touch ${k}`));

  // `manager_id` IS owned by EXPA: if the EP is reassigned there, follow it.
  assert.ok('manager_id' in upd.values, 'update must refresh manager_id');

  assert.equal(upd.values.expa_status, 'open');
  assert.ok(upd.values.synced_at);
});

await t('a page mixing new and existing leads splits correctly', async () => {
  const supabase = stubSupabase({
    existingLeads: [{ id: 'lead-a', expa_application_id: '7001' }]
  });
  const mapped = [app('7001'), app('7002')].map(mapApplication);
  const stats = await writePage(supabase, mapped, { token: 't' });
  assert.equal(stats.inserted, 1);
  assert.equal(stats.updated, 1);
});

await t('backgrounds are created once and linked', async () => {
  const supabase = stubSupabase({ existingBackgrounds: [] });
  const mapped = [app('7001'), app('7002')].map(mapApplication);
  await writePage(supabase, mapped, { token: 't' });

  const bgUpsert = supabase.calls.upserts.find((c) => c.table === 'backgrounds');
  assert.equal(bgUpsert.options.onConflict, 'name');
  assert.equal(bgUpsert.rows.length, 1, 'the shared background is inserted once');

  const link = supabase.calls.upserts.find((c) => c.table === 'lead_backgrounds');
  assert.equal(link.options.onConflict, 'lead_id,background_id');
});

await t('an already-known background is not re-inserted', async () => {
  const supabase = stubSupabase({ existingBackgrounds: [{ id: 'bg1', name: 'Computer sciences' }] });
  const byName = await ensureBackgrounds(supabase, ['Computer sciences']);
  assert.equal(byName.get('computer sciences'), 'bg1');
  assert.equal(supabase.calls.upserts.filter((c) => c.table === 'backgrounds').length, 0);
});

await t('CV rows use the (lead, doc_type, source) conflict target', async () => {
  const supabase = stubSupabase();
  const mapped = [app('7001')].map(mapApplication);
  const stats = await writePage(supabase, mapped, { token: 't' });

  const doc = supabase.calls.upserts.find((c) => c.table === 'lead_documents');
  assert.equal(doc.options.onConflict, 'lead_id,doc_type,source');
  assert.equal(doc.rows[0].source, 'expa');
  assert.equal(doc.rows[0].file_url, 'https://gis-api.aiesec.org/cv/7001.pdf');
  assert.equal(stats.cvsLinked, 1);
});

await t('an application with no CV produces no document row', async () => {
  const supabase = stubSupabase();
  const noCv = app('7003');
  noCv.person.cv_url = null;
  await writePage(supabase, [mapApplication(noCv)], { token: 't' });
  assert.equal(supabase.calls.upserts.filter((c) => c.table === 'lead_documents').length, 0);
});

await t('--mirror-cvs uploads to storage and stores the object key', async () => {
  const supabase = stubSupabase();
  const fetchImpl = async (url) => {
    assert.ok(url.includes('access_token='), 'the CV fetch must be authenticated');
    return {
      ok: true, status: 200,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    };
  };
  const stats = await writePage(supabase, [mapApplication(app('7001'))], {
    token: 'tok', mirrorCvs: true, fetchImpl, bucket: 'lead_documents'
  });

  assert.equal(stats.cvsMirrored, 1);
  assert.equal(supabase.calls.storage[0].key, 'expa/7001.pdf');
  const doc = supabase.calls.upserts.find((c) => c.table === 'lead_documents');
  assert.equal(doc.rows[0].file_url, 'expa/7001.pdf');
  assert.equal(doc.rows[0].source_url, 'https://gis-api.aiesec.org/cv/7001.pdf');
});

await t('a failed CV mirror is recorded but does not abort the page', async () => {
  const supabase = stubSupabase();
  const fetchImpl = async () => ({ ok: false, status: 404 });
  const stats = await writePage(supabase, [mapApplication(app('7001'))], {
    token: 'tok', mirrorCvs: true, fetchImpl
  });
  assert.equal(stats.errors.length, 1);
  assert.match(stats.errors[0], /cv mirror 7001/);
  assert.equal(stats.inserted, 1, 'the lead itself still landed');
});

await t('batches are chunked', () => {
  assert.equal(chunk(new Array(450).fill(0), 200).length, 3);
});

console.log('\nEP managers');
await t('EXPA managers are upserted on expa_id and linked to the lead', async () => {
  const supabase = stubSupabase();
  const mapped = [app('7001'), app('7002')].map(mapApplication);
  await writePage(supabase, mapped, { token: 't' });

  const mgr = supabase.calls.upserts.find((c) => c.table === 'managers');
  assert.ok(mgr, 'managers must be upserted');
  assert.equal(mgr.options.onConflict, 'expa_id');
  assert.equal(mgr.rows.length, 1, 'the shared manager is upserted once, not once per lead');
  assert.equal(mgr.rows[0].expa_id, '5001');
  assert.equal(mgr.rows[0].first_name, 'Rohan');
  assert.equal(mgr.rows[0].last_name, 'Iyer');

  const leadUpsert = supabase.calls.upserts.find((c) => c.table === 'leads');
  assert.ok(leadUpsert.rows[0].manager_id, 'the lead must carry a resolved manager_id');
});

await t('an application with no EXPA manager leaves manager_id null', async () => {
  const supabase = stubSupabase();
  const solo = app('7009');
  solo.person.managers = [];
  await writePage(supabase, [mapApplication(solo)], { token: 't' });

  const leadUpsert = supabase.calls.upserts.find((c) => c.table === 'leads');
  assert.equal(leadUpsert.rows[0].manager_id, null);
  assert.ok(!supabase.calls.upserts.find((c) => c.table === 'managers'));
});

await t('a manager upsert failure is recorded without losing the leads', async () => {
  const supabase = stubSupabase();
  const original = supabase.from;
  supabase.from = (name) => {
    if (name !== 'managers') return original(name);
    return {
      upsert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'boom' } }) })
    };
  };

  const stats = await writePage(supabase, [mapApplication(app('7001'))], { token: 't' });
  assert.ok(stats.errors.some((e) => e.includes('manager upsert failed')));
  assert.equal(stats.inserted, 1, 'the lead itself still lands');
});

await t('ensureManagers returns an empty map when nobody is named', async () => {
  const supabase = stubSupabase();
  const map = await ensureManagers(supabase, [{ managers: [] }], { errors: [] });
  assert.equal(map.size, 0);
});

console.log(`\n${passed} test(s) passed`);
