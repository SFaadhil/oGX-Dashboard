# AIESEC in India - oGX Talent Hub

A recreation of the OGT Bardo talent hub (`ogtbardo.vercel.app`) for AIESEC in India:
same information architecture, same page-by-page UX, rebuilt on Vite + React 18 +
React Router 6 + Supabase, with GTa / GTe product stickers and the
`#520305` / `#fceb04` brand palette.

## Quick start

```bash
npm install
```

Copy the env template and fill in the AIESEC in India Supabase project:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_SUPABASE_BUCKET=lead_documents
```

Then run:

```bash
npm run dev
```

Every page degrades to an explicit "Supabase is not configured" state until those
two values are real, so the app never white-screens while you are setting it up.

The anon key is safe in the browser here: RLS grants it `SELECT` only, and
write privileges are revoked from the `anon` role. Never put the service-role
key in a `VITE_` variable - it bypasses RLS.

## Database

Paste **`supabase/setup.sql`** into the Supabase SQL editor and run it. That one
file is schema + EXPA sync additions + your first admin account, in that order.
It is idempotent, so re-running it is safe.

Edit **Part 3 at the bottom of the file** before running - that block is the
first account you sign in with.

> The Supabase SQL editor runs the whole buffer as a single transaction. If any
> statement errors, *nothing* is applied - fix the error and run the file again.

Run `supabase/verify.sql` afterwards to confirm what landed: it reports table
count, the EXPA columns, the unique keys, the storage bucket and the seed rows.

`setup.sql` is repair-capable as well as idempotent: it re-runs cleanly on an
empty database, a fully built one, or one left half-finished by a failed run
(it re-adds any missing columns rather than assuming `create table` did the
job).

The individual migrations are kept separately too: `schema.sql` (base),
`002_expa_sync.sql` (sync additions), `003_first_admin.sql` (login account),
`verify.sql` (health check) and `reset.sql` (**destructive** - drops every
table; only for a clean slate before real data exists).

Tables: `managers`, `leads`, `backgrounds`, `lead_backgrounds`,
`lead_documents`, `app_settings`, `sync_runs`.

If the AIESEC in India project already has these tables, skip the schema and just
make sure the column names match `supabase/schema.sql`.

## Routes

Every route is public. There is no login, and nothing in the browser writes to
the database.

| Path | What it is |
| --- | --- |
| `/cv-pool` | Talent pool: stats, charts, filters, CV cards |
| `/dashboard` | Pipeline overview: totals, product split, destinations |
| `/dashboard/leads` | Every application, with filters, column picker and CSV export |
| `/dashboard/team` | Team contact cards |
| `/dashboard/team-leads/:memberId` | One EP manager's leads |
| `/dashboard/team-performance` | Per-manager leaderboard |
| `/dashboard/sync` | EXPA sync health and run history |
| `/lead/:id` | Full application record |

Older paths (`/leads`, `/login`, `/admin`, ...) redirect into `/dashboard/...`.

## Read-only by design

The dashboard is open to everyone, so it is read-only end to end:

- No login, no session, no roles.
- `src/lib/leadsApi.js` contains no `insert` / `update` / `delete`. The only
  Supabase call outside `select` is `getPublicUrl`, which builds a URL string.
- RLS is on for every table with a `SELECT`-only policy, and `INSERT`,
  `UPDATE`, `DELETE` are revoked from the `anon` role outright.
- The single writer is `scripts/sync-expa.mjs`, which runs server-side with the
  service-role key.

`supabase/verify.sql` checks all of this and prints any table where the anon
role still holds a write grant.

## Products

`GTa` and `GTe` are the only two products, mapped from EXPA programme ids 8 and
9. They drive the card sticker, the donut chart and every product filter. GTa
renders in brand maroon, GTe in brand yellow - see `PRODUCT_COLORS` in
`src/constants/index.js`.

## What appears on the public CV pool

`/cv-pool` shows only leads with `show_in_cvpool = true`. Newly synced
applicants are `false` unless the sync runs with `--publish` or
`EXPA_PUBLISH_TO_POOL=true`.

To publish everything already in the database:

```sql
update public.leads set show_in_cvpool = true where product in ('GTa', 'GTe');
```

To take the whole pool offline without touching the data, flip the setting the
page checks on load:

```sql
update public.app_settings set value = 'false' where key = 'cv_pool_open';
```

Bear in mind the rest of the dashboard is public too, so `show_in_cvpool`
controls presentation, not access. Anything in `leads` is readable by anyone
with the URL.

## Theme

Design tokens live in `src/styles/variables.css`. Dark mode swaps the token
block under `body.dark-mode` and the preference is stored in `localStorage`.

## Build

```bash
npm run build
```

Output lands in `dist/`. Deploy anywhere that serves a SPA fallback to
`index.html` (Vercel, Netlify, Cloudflare Pages).

## Live EXPA sync

An hourly job pulls AIESEC in India GTa/GTe applications straight out of EXPA
and into Supabase, so the dashboard and the CV pool reflect what EXPA shows.

### What was verified against EXPA

| Thing | Value |
| --- | --- |
| GraphQL endpoint | `https://gis-api.aiesec.org/graphql?access_token=...` |
| AIESEC in India MC office id | **1585** (`1518` is AIESEC in Maribor, a closed Slovenian LC) |
| Programme ids | `7` = GV, **`8` = GTa**, **`9` = GTe** |
| Applications root | `allOpportunityApplication(page, per_page, filters)` |
| EP-side entity filter | `ApplicationFilter.person_home_mc: Int[]` |
| Product filter | `ApplicationFilter.programmes: Int[]` |
| Incremental window | `ApplicationFilter.created_at: { from, to }` |
| CV link | `OpportunityApplication.cv.url`, falling back to `Person.cv_url` |

For reference, at the time of writing EXPA held ~36.5k GTa and ~5.2k GTe
applications with an India home MC, which is why the job runs on a window
rather than re-reading everything.

### Setup

1. Run `supabase/schema.sql`, then `supabase/002_expa_sync.sql`.
2. Fill the server-side half of `.env` (`EXPA_ACCESS_TOKEN`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`). These must never appear in a `VITE_` variable -
   they would end up in the browser bundle.
3. Dry run first:

```bash
npm run sync:expa:dry
```

4. Then a real run for today:

```bash
npm run sync:expa
```

### Options

```bash
node scripts/sync-expa.mjs --since 6h        # rolling window
node scripts/sync-expa.mjs --since 2026-08-01 --until 2026-08-28
node scripts/sync-expa.mjs --full            # backfill everything (slow)
node scripts/sync-expa.mjs --mirror-cvs      # copy CVs into Supabase Storage
```

### Scheduling

`.github/workflows/expa-sync.yml` runs it at :05 every hour. Add three repo
secrets - `EXPA_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` -
and it starts working. The workflow also has a manual trigger that accepts a
`since` value for backfills.

Any hourly runner works the same way (Vercel Cron, Supabase pg_cron plus an Edge
Function, a cron entry on a VPS): the script only needs Node 22 and those three
environment variables.

### What the sync will and will not touch

Re-running is safe. Rows are keyed on `leads.expa_application_id`, and an
existing lead only gets its **EXPA-owned** columns refreshed. These stay under
your team's control and are never overwritten:

`manager_id`, `status` and `show_in_cvpool`.

**New leads land with `show_in_cvpool = false`** unless you pass `--publish` or
set `EXPA_PUBLISH_TO_POOL=true`. See "What appears on the public CV pool" above
before turning that on: the whole site is public, and at EXPA's volume that is
tens of thousands of applicants' names, emails, phone numbers and CVs.

### CV links

By default `lead_documents.file_url` stores the EXPA CV URL as-is. Those URLs
are served by EXPA and may require an authenticated session, in which case the
public CV pool will not be able to render them. If that turns out to be the
case, run the sync with `--mirror-cvs`: it downloads each CV with the token and
re-uploads it to the public `lead_documents` bucket, storing the object key
instead. The original EXPA URL is kept in `lead_documents.source_url`.

### Monitoring

Every run writes a row to `sync_runs`. Admin Panel -> **EXPA Sync** shows time
since the last success, last-run counts, and the recent run history with any
error text. If "Since last successful sync" goes over 90 minutes it flags as
overdue.

### Token lifetime

EXPA access tokens expire. When one does, the script fails fast with
`EXPA rejected the access token ... It has probably expired.` and the run is
recorded as `failed` in `sync_runs`. Replace the `EXPA_ACCESS_TOKEN` secret to
recover; nothing else needs to change.

### Tests

```bash
npm test
```

Covers the EXPA field mapping (product, duration, year of study, CV fallback,
name splitting) and the sync engine (window maths, paging, the insert/update
split, background de-duplication, CV mirroring). No network and no real
applicant data - everything runs against fixtures and stubs.
