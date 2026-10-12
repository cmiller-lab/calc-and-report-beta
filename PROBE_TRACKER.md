# Probe age tracker · beta v15.12

Open **Probe Ages** from the dashboard, or `probes.html` directly. This addition targets `cmiller-lab/calc-and-report-beta`.

## Field use

1. Select property, body of water, and pH, ORP, or FC · CP-1.
2. Choose **Record / correct current probe** for inventory updates or **Probe replaced** for a replacement.
3. For pH/ORP, select month letter A–L and year digit. Preview the resolved manufacturing month and approximate age. Check the unknown-code option to retain an unreadable/nonstandard code without inventing a date.
4. For CP-1, enter its actual installation/replacement day. Selecting **Probe replaced** fills the record date; change it for an earlier installation. Existing CP-1 ages remain unknown until their date is known.
5. Enter technician and record date, optional notes, and save. Offline saves are reported only after the IndexedDB transaction commits, and remain queued until sync succeeds.

The overview includes 27 bodies of water: the existing 24-pool catalog plus Aquatica 511–513 from the photo. Names for those three were not provided, so their numbers are used. It shows all three probe types, search/property filters, oldest-first sorting, and a shortcut from each probe to the form. History follows the pool selected in the form.

## Date rules

- A = January through L = December. Choose the latest matching month/year that has occurred by the record date, within ten years. A7 recorded in October 2026 means January 2017; L6 means December 2016. Newly manufactured probes are allowed; two years is not a minimum age.
- Retain the resolved date permanently. An existing 2017 A7 record must not become 2027 when its code recurs.
- `YYYY-MM-01` represents a manufacturing month, not an exact manufacturing day. pH/ORP ages use calendar month differences and do not establish installation age.
- CP-1 uses the actual installation/replacement date, with exact day counts in the history export. Older backfilled replacements remain in history without displacing a newer replacement in the overview.
- Current pH/ORP inventory uses latest record date, then entry timestamp. CP-1 uses latest installation date, then entry timestamp. Corrections append an event rather than overwrite history.
- Ages refresh using the Florida operating date (`America/New_York`). The 5- and 8-year pH/ORP markers are planning cues, not manufacturer replacement limits. CP-1 does not use those manufacturing-age thresholds.

## Starting inventory

`IMG_7339.png`, supplied October 12, 2026, provides 28 pH/ORP records: 26 resolved dates and two unknown codes, **506 pH PV** and **509 pH PX**. Blank Aquatica entries, SeaWorld/Discovery Cove dates, and all CP-1 dates remain unrecorded. Bundled photo records appear offline; matching cloud source references replace their placeholders without duplicating history. Clients never upload baseline placeholders.

## Shared storage and offline behavior

The tracker uses the existing `Pool-Calibration-Log` Supabase project, `eseqjmcsdwqyohmoabnq`, its REST API and the public anon key already used in `calibration.html`. The additive `public.probe_events` table is configured; its applied setup is included in `supabase/probe-events.sql` and must not be rerun on this project.

This preserves the PWA's existing no-login shared operational access model. The new table enables RLS and grants only SELECT/INSERT to anon/authenticated. Constraints and the insert policy validate known pools, probe types, date/code consistency, technician, and nonfuture field dates. Clients cannot insert baseline records, UPDATE, or DELETE. This is shared operational data, not a private per-user vault. No service-role key, privileged function, or changes to calibration/feeder tables are introduced.

IndexedDB `seaworld-probes-beta-v1` retains cached shared history and pending saves. Records receive UUIDs before queuing; retries use `ON CONFLICT (id) DO NOTHING`. Pulls preserve pending local records and paginate in 500-row pages. Sync runs on save, reconnect, returning to the app, and every minute while visible. Keep browser data until pending records have synced. Cloud errors are visible, and pending records remain exportable.

The scoped beta service worker precaches every tracker asset and the standalone page. Query variants use their own HTML fallback, including the embedded calibration iframe. Cleanup deletes only beta scope-prefixed caches. The old page-level deletion of all origin caches is removed; unscoped legacy caches are retained because their ownership is unknown. The installed manifest ID is preserved while its startup URL moves to v15.12.

## Spreadsheet exports

**Export pool spreadsheet** downloads one CSV row per displayed pool with codes, resolved dates, date bases, ages, age months, and sync status for pH/ORP, plus the CP-1 installation date/age. **Export probe history** includes all events for the displayed pools, previous replacements, CP-1 day counts, technician, notes, source, and record IDs. Both include the as-of date and pending offline records. Property/search filters apply to both exports.

CSV uses UTF-8 BOM, CRLF rows, escaped quotes/multiline text, and formula-character protection. Open/import it in Excel, Numbers, or Google Sheets. Exports are dated snapshots; download again to refresh ages. There is no automatic write to an external spreadsheet account.

## Verification

Run `node --test tests/probes.test.cjs`. Tests cover all 120 date codes across boundaries, the supplied inventory, retained decades, CP-1 replacement/backfill ordering, invalid dates, CSV protection, offline reload/failed writes, sync failure/retry, second-device retrieval, 1,001-row pagination, offline page variants/cache isolation, and HTML syntax/asset wiring.

Database checks confirmed 28 baseline events, RLS, read/append privileges and denied update/delete. A rolled-back transaction tested a valid CP-1 insert, duplicate retry, mismatched code, missing CP-1 date, future date, and denied overwrite/deletion. No test records were retained.

The database advisor reported pre-existing security-definer execution warnings for `public.rls_auto_enable()` (anon/authenticated); this change does not modify that function. Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Visual browser QA and physical iPhone/iPad review were unavailable. Responsive CSS and 16px form controls are present; appearance and iOS download behavior still need a device check.
