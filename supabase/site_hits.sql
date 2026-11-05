-- MapsyQuest anonymous visit counter (src/lib/siteHits.ts, read by the Telegram bot's /visits
-- command). Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to re-run.
--
-- Consent-free by design: one row per day holding nothing but a number. No IP, user agent,
-- user id or anything else about the visitor is stored, and the browser stores nothing either.
-- Each page load adds one, so a refresh or a repeat visit counts again: these are hits, not people.
--
-- Days are Europe/Madrid calendar dates, matching REPORT_TIMEZONE in api/_lib/analytics.ts.

create table if not exists public.mapsyquest_daily_hits (
  day  date primary key,
  hits bigint not null default 0
);

alter table public.mapsyquest_daily_hits enable row level security;

-- No direct table access through the API at all: the browser can only call the increment
-- function below, and only the server (service role) can read the totals.
revoke all on public.mapsyquest_daily_hits from anon, authenticated;

create or replace function public.mapsyquest_record_hit()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.mapsyquest_daily_hits (day, hits)
  values ((now() at time zone 'Europe/Madrid')::date, 1)
  on conflict (day) do update set hits = mapsyquest_daily_hits.hits + 1;
$$;

revoke all on function public.mapsyquest_record_hit() from public;
grant execute on function public.mapsyquest_record_hit() to anon, authenticated;

create or replace function public.mapsyquest_hit_summary()
returns table (today bigint, yesterday bigint, last_7_days bigint, all_time bigint)
language sql
stable
security definer
set search_path = public
as $$
  with d as (select (now() at time zone 'Europe/Madrid')::date as today)
  select
    coalesce(sum(hits) filter (where day = d.today), 0)::bigint,
    coalesce(sum(hits) filter (where day = d.today - 1), 0)::bigint,
    coalesce(sum(hits) filter (where day > d.today - 7), 0)::bigint,
    coalesce(sum(hits), 0)::bigint
  from public.mapsyquest_daily_hits, d;
$$;

revoke all on function public.mapsyquest_hit_summary() from public, anon, authenticated;
grant execute on function public.mapsyquest_hit_summary() to service_role;
