#!/usr/bin/env node
/**
 * Pull AIESEC in India oGT applications from EXPA into Supabase.
 * See README.md ("Live EXPA sync") for setup.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createExpaClient, INDIA_MC_ID, PROGRAMMES } from './expa/client.mjs';
import { resolveWindow, runSync } from './expa/sync.mjs';

const USAGE = `
Usage: node scripts/sync-expa.mjs [options]

  --since <5h|3d|YYYY-MM-DD>  start of the window (default: midnight today)
  --until <YYYY-MM-DD>        end of the window (default: now)
  --full                      every application, all time (slow)
  --dry-run                   fetch and map, write nothing
  --mirror-cvs                copy each CV into Supabase Storage
  --per-page <n>              EXPA page size (default 100)
  --help                      show this

Environment:
  EXPA_ACCESS_TOKEN           required
  SUPABASE_URL                required unless --dry-run
  SUPABASE_SERVICE_ROLE_KEY   required unless --dry-run
  EXPA_HOME_MC                default 1585 (AIESEC in India)
  EXPA_PROGRAMMES             default 8,9  (GTa, GTe)
  SUPABASE_BUCKET             default lead_documents
`;

function parseArgs(argv) {
  const args = { dryRun: false, full: false, mirrorCvs: false, perPage: 100 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--full') args.full = true;
    else if (a === '--mirror-cvs') args.mirrorCvs = true;
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--until') args.until = argv[++i];
    else if (a === '--per-page') args.perPage = Number(argv[++i]) || 100;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const log = (...a) => console.log(`[expa-sync] ${a.join(' ')}`);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }

  const token = process.env.EXPA_ACCESS_TOKEN;
  if (!token) {
    console.error('EXPA_ACCESS_TOKEN is not set.');
    process.exit(1);
  }

  const homeMc = Number(process.env.EXPA_HOME_MC || INDIA_MC_ID);
  const programmes = (process.env.EXPA_PROGRAMMES || `${PROGRAMMES.GTa},${PROGRAMMES.GTe}`)
    .split(',').map((s) => Number(s.trim())).filter(Boolean);
  const bucket = process.env.SUPABASE_BUCKET || 'lead_documents';

  const who = await createExpaClient({ token }).whoAmI();
  log(`authenticated as ${who.full_name} (${who.email})`);

  const win = resolveWindow(args);
  log(`window: ${win.label}${win.from ? ` (${win.from.toISOString()} -> ${win.to.toISOString()})` : ''}`);
  log(`filters: home MC ${homeMc}, programmes [${programmes.join(', ')}]`);

  let supabase = null;
  let runId = null;

  if (!args.dryRun) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --dry-run).');
      process.exit(1);
    }
    supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: run, error } = await supabase
      .from('sync_runs')
      .insert({
        source: 'expa',
        window_from: win.from?.toISOString() || null,
        window_to: win.to?.toISOString() || null,
        status: 'running'
      })
      .select('id')
      .single();
    if (error) log(`warning: could not open a sync_runs row (${error.message})`);
    runId = run?.id || null;
  }

  const finish = async (stats, status, error) => {
    if (!supabase || !runId) return;
    await supabase.from('sync_runs').update({
      fetched: stats.fetched,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      cvs_linked: stats.cvsLinked,
      status,
      error: error ? String(error).slice(0, 2000) : null,
      finished_at: new Date().toISOString()
    }).eq('id', runId);
  };

  let stats;
  try {
    stats = await runSync({
      token,
      supabase,
      window: win,
      homeMc,
      programmes,
      perPage: args.perPage,
      dryRun: args.dryRun,
      mirrorCvs: args.mirrorCvs,
      bucket,
      onProgress: (p) => log(`page ${p.page}/${p.totalPages} - ${p.fetched}/${p.totalItems} fetched`)
    });
  } catch (err) {
    await finish(
      { fetched: 0, inserted: 0, updated: 0, skipped: 0, cvsLinked: 0 },
      'failed',
      err.message
    );
    console.error(`[expa-sync] FAILED: ${err.message}`);
    process.exit(1);
  }

  await finish(stats, 'success');

  log('---');
  log(`fetched ${stats.fetched} | inserted ${stats.inserted} | updated ${stats.updated} | skipped ${stats.skipped}`);
  log(`CVs linked ${stats.cvsLinked}${args.mirrorCvs ? ` (mirrored ${stats.cvsMirrored})` : ''}`);
  if (stats.errors.length) {
    log(`${stats.errors.length} row error(s); first: ${stats.errors[0]}`);
  }
  if (args.dryRun) log('dry run - nothing was written');
}

main().catch((err) => {
  console.error(`[expa-sync] FAILED: ${err.message}`);
  process.exit(1);
});
