-- Probe inventory for calc-and-report-beta. Additive, append-only shared records.
-- Existing calibration/feeder tables and their policies are unchanged.
begin;
create table public.probe_events (
  id uuid primary key default gen_random_uuid(),
  pool_key text not null,
  property text not null,
  pool_id text not null,
  pool_name text not null check (char_length(pool_name) between 1 and 120),
  probe_type text not null check (probe_type in ('ph','orp','fc')),
  action text not null default 'inventory' check (action in ('inventory','replacement')),
  date_code text check (date_code is null or char_length(date_code) between 1 and 12),
  manufactured_month date,
  installed_on date,
  observed_on date not null,
  technician text not null check (char_length(btrim(technician)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  device_id uuid,
  logged_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'field' check (source in ('baseline','field')),
  source_ref text unique,
  constraint probe_pool_identity check (
    pool_key = property || '|' || pool_id and pool_key in (
    'Aquatica|501',
    'Aquatica|502',
    'Aquatica|503',
    'Aquatica|504',
    'Aquatica|505',
    'Aquatica|506',
    'Aquatica|507',
    'Aquatica|508',
    'Aquatica|509',
    'Aquatica|510',
    'Aquatica|511',
    'Aquatica|512',
    'Aquatica|513',
    'Aquatica|520',
    'Aquatica|530',
    'Aquatica|540',
    'Aquatica|550',
    'SeaWorld|Infinity Falls 1',
    'SeaWorld|Infinity Falls 2',
    'SeaWorld|Kraken',
    'SeaWorld|Manta Pond',
    'SeaWorld|Main Gate',
    'SeaWorld|Journey to Atlantis',
    'SeaWorld|Sesame',
    'SeaWorld|Pearl',
    'Discovery Cove|Tropical River/Resort Pool',
    'Discovery Cove|Freshwater Oasis'
  )),
  constraint probe_dates_valid check (
    observed_on between date '2000-01-01' and date '2199-12-31'
    and (installed_on is null or (installed_on between date '2000-01-01' and observed_on))
    and (manufactured_month is null or (
      manufactured_month between date '2000-01-01' and observed_on
      and extract(day from manufactured_month) = 1
      and manufactured_month >= date_trunc('month',observed_on::timestamp)::date - interval '10 years'
    ))
  ),
  constraint probe_type_dates check (
    (probe_type = 'fc' and installed_on is not null and manufactured_month is null and date_code is null)
    or (probe_type in ('ph','orp') and installed_on is null and (
      manufactured_month is null or case when date_code ~ '^[A-L][0-9]$' then
        extract(month from manufactured_month) = ascii(substr(date_code,1,1)) - 64
        and mod(extract(year from manufactured_month)::integer,10) = substr(date_code,2,1)::integer
        else false end
    ))
  ),
  constraint probe_source_ref check (
    (source = 'field' and source_ref is null and device_id is not null)
    or (source = 'baseline' and source_ref is not null)
  )
);
comment on table public.probe_events is 'Shared operational probe history. Same no-login team access as the current field PWA; clients can read and append validated field records, never overwrite or delete history.';
comment on column public.probe_events.manufactured_month is 'Resolved at entry. First day represents a manufacture month, not an exact day; never re-infer the decade later.';
comment on column public.probe_events.installed_on is 'CP-1 installation/replacement day. This is time in service, not manufacturing age.';
create index probe_events_pool_history_idx on public.probe_events (pool_key, probe_type, observed_on desc, logged_at desc);
create index probe_events_sync_idx on public.probe_events (recorded_at, id);
alter table public.probe_events enable row level security;
revoke all on table public.probe_events from anon, authenticated;
grant select, insert on table public.probe_events to anon, authenticated;
create policy "shared probe inventory readable" on public.probe_events for select to anon, authenticated using (true);
create policy "validated field probe events appendable" on public.probe_events for insert to anon, authenticated with check (
  source = 'field' and source_ref is null and device_id is not null
  and observed_on <= (now() at time zone 'America/New_York')::date
  and logged_at >= timestamptz '2000-01-01 00:00:00+00'
  and logged_at <= now() + interval '5 minutes'
);
-- User-supplied image inventory; generated primary keys remain server-owned.
insert into public.probe_events
  (pool_key,property,pool_id,pool_name,probe_type,date_code,manufactured_month,observed_on,technician,notes,logged_at,source,source_ref)
values
  ('Aquatica|501', 'Aquatica', '501', 'Cutback Cove', 'ph', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:501:ph'),
  ('Aquatica|501', 'Aquatica', '501', 'Cutback Cove', 'orp', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:501:orp'),
  ('Aquatica|502', 'Aquatica', '502', 'Big Surf Shores', 'ph', 'D8', '2018-04-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:502:ph'),
  ('Aquatica|502', 'Aquatica', '502', 'Big Surf Shores', 'orp', 'F8', '2018-06-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:502:orp'),
  ('Aquatica|503', 'Aquatica', '503', 'Omaka Rocka', 'ph', 'A5', '2025-01-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:503:ph'),
  ('Aquatica|503', 'Aquatica', '503', 'Omaka Rocka', 'orp', 'E8', '2018-05-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:503:orp'),
  ('Aquatica|504', 'Aquatica', '504', 'Katas Kookaburra', 'ph', 'J2', '2022-10-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:504:ph'),
  ('Aquatica|504', 'Aquatica', '504', 'Katas Kookaburra', 'orp', 'I2', '2022-09-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:504:orp'),
  ('Aquatica|505', 'Aquatica', '505', 'Roa''s Rapids', 'ph', 'H7', '2017-08-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:505:ph'),
  ('Aquatica|505', 'Aquatica', '505', 'Roa''s Rapids', 'orp', 'E1', '2021-05-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:505:orp'),
  ('Aquatica|506', 'Aquatica', '506', 'Whanau Way', 'ph', 'PV', null, '2026-10-12', 'Supplied inventory', 'Code needs physical verification.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:506:ph'),
  ('Aquatica|506', 'Aquatica', '506', 'Whanau Way', 'orp', 'F8', '2018-06-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:506:orp'),
  ('Aquatica|507', 'Aquatica', '507', 'Walkabout Waters', 'ph', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:507:ph'),
  ('Aquatica|507', 'Aquatica', '507', 'Walkabout Waters', 'orp', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:507:orp'),
  ('Aquatica|508', 'Aquatica', '508', 'Ray Rush/Whahalla Wave', 'ph', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:508:ph'),
  ('Aquatica|508', 'Aquatica', '508', 'Ray Rush/Whahalla Wave', 'orp', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:508:orp'),
  ('Aquatica|509', 'Aquatica', '509', 'Loggerhead/Tassie', 'ph', 'PX', null, '2026-10-12', 'Supplied inventory', 'Code needs physical verification.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:509:ph'),
  ('Aquatica|509', 'Aquatica', '509', 'Loggerhead/Tassie', 'orp', 'F8', '2018-06-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:509:orp'),
  ('Aquatica|510', 'Aquatica', '510', 'Dolphin Plunge', 'ph', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:510:ph'),
  ('Aquatica|510', 'Aquatica', '510', 'Dolphin Plunge', 'orp', 'F8', '2018-06-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:510:orp'),
  ('Aquatica|512', 'Aquatica', '512', '512', 'ph', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:512:ph'),
  ('Aquatica|512', 'Aquatica', '512', '512', 'orp', 'F2', '2022-06-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:512:orp'),
  ('Aquatica|513', 'Aquatica', '513', '513', 'ph', 'G8', '2018-07-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:513:ph'),
  ('Aquatica|513', 'Aquatica', '513', '513', 'orp', 'E8', '2018-05-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:513:orp'),
  ('Aquatica|520', 'Aquatica', '520', 'Ihu Breakaway Falls', 'ph', 'A3', '2023-01-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:520:ph'),
  ('Aquatica|520', 'Aquatica', '520', 'Ihu Breakaway Falls', 'orp', 'L7', '2017-12-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:520:orp'),
  ('Aquatica|530', 'Aquatica', '530', 'Taumata Racer', 'ph', 'H3', '2023-08-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:530:ph'),
  ('Aquatica|530', 'Aquatica', '530', 'Taumata Racer', 'orp', 'F8', '2018-06-01', '2026-10-12', 'Supplied inventory', 'Imported from supplied probe inventory photo.', '2026-10-12T12:00:00Z', 'baseline', 'IMG_7339:2026-10-12:530:orp')
on conflict (source_ref) do nothing;
commit;
