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

The individual migrations are also kept separately: `schema.sql` (base),
`002_expa_sync.sql` (sync additions), `003_first_admin.sql` (login account).

Tables: `managers`, `manager_profiles`, `leads`, `backgrounds`,
`lead_backgrounds`, `lead_documents`, `lead_proofs`, `lead_notes`, `followups`,
`approval_requests`, `action_logs`, `app_settings`.

If the AIESEC in India project already has these tables, skip the schema and just
make sure the column names match `supabase/schema.sql`.

## Routes

| Path | What it is | Access |
| --- | --- | --- |
| `/cv-pool` | Public talent pool: stats, charts, filters, CV cards | Anyone |
| `/login` | Sign in against the `managers` table | Anyone |
| `/dashboard` | Pipeline overview | Signed in |
| `/dashboard/leads` | My Leads: filters, column picker, CSV export | Signed in |
| `/dashboard/all-leads` | Every lead in the entity, plus CSV import | LCVP / Admin |
| `/dashboard/followups` | Follow-up queue with priorities | Signed in |
| `/dashboard/lead-assignment` | Bulk assign / auto-distribute leads | LCVP / Admin |
| `/dashboard/all-team-leads` | Leads across the whole team | Team leader+ |
| `/dashboard/team` | Team contact cards | Signed in |
| `/dashboard/team-leads/:memberId` | One member's leads | Signed in |
| `/dashboard/team-performance` | Leaderboard and conversion metrics | Signed in |
| `/dashboard/approvals` | Approval request inbox | Signed in |
| `/dashboard/admin` | Members, backgrounds, CV pool switch, audit log | LCVP / Admin |
| `/dashboard/settings` | Profile, theme, password | Signed in |
| `/lead/:id` | Full lead record: notes, CV, proofs, assignment | Signed in |

The old flat paths (`/leads`, `/team`, `/admin`, ...) redirect to their
`/dashboard/...` equivalents.

## Roles

Access is derived from `managers.key_area` (see `src/constants/index.js`):

- `LCVP oGX` and `Administrator` unlock everything (treated as VP).
- `oGX Team Leader` additionally unlocks team-wide views and approvals.
- Everyone else sees their own leads, follow-ups, team contacts and performance.

`managers.reports_to` decides who receives a member's approval requests.

## Products

`GTa` and `GTe` are the only two products. They drive the card sticker, the donut
chart, and every product filter. GTa renders in brand maroon, GTe in brand
yellow - see `PRODUCT_COLORS` in `src/constants/index.js`.

## Closing the CV pool

Admin Panel -> CV Pool Access flips `app_settings.cv_pool_open`. When it is
`false`, `/cv-pool` shows the "currently closed" notice instead of the grid.

## Theme

Design tokens live in `src/styles/variables.css`. Dark mode swaps the token block
under `html.dark-mode`; the same class is mirrored onto `<body>` for the handful
of `body.dark-mode .x` component rules. The preference is stored in
`localStorage` and, for signed-in users, in `manager_profiles.theme_preference`.

## Build

```bash
npm run build
```

Output lands in `dist/`. Deploy it anywhere that serves a SPA fallback to
`index.html` (Vercel, Netlify, Cloudflare Pages).

## Notes on the login model

Like the reference deployment, sign-in reads a plaintext password column on
`managers` rather than Supabase Auth, and RLS is left off so the anon key can
read and write. That is why the schema keeps RLS disabled. If you want this
hardened, move authentication to Supabase Auth and re-enable RLS with policies
keyed on `auth.uid()`; `src/context/AuthContext.jsx` is the only file that would
need to change.

---

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

`manager_id`, `status`, `show_in_cvpool`, `feedback_status`, `manager_feedback`,
`assigned_on_expa`, and everything in `lead_notes` / `lead_proofs`.

**New leads land with `show_in_cvpool = false`.** Nothing an applicant submits
becomes publicly visible until someone on the team opts that lead in from the
dashboard. Given the volume in EXPA, do not flip this default without deciding
what you are comfortable publishing - the CV pool page is open to anyone with
the link and shows names, emails, phone numbers and CVs.

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
