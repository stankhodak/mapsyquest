-- MapsyQuest saved account stats (the popup on the nickname badge). Run in the Supabase
-- dashboard: SQL Editor -> New query -> paste -> Run. Safe to re-run: every statement is
-- idempotent, so it also repairs a table that was created by hand without its policies.
--
-- One row per player, keyed by user_id (the client upserts on it). Written from the browser
-- by src/lib/playerStats.ts after every finished game, so the policies below let a player
-- read and write only their own row. If the popup shows "Couldn't load your stats", or games
-- never add up, a missing policy here is the first thing to check.

create table if not exists public.mapsyquest_player_stats (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  games_played   integer not null default 0 check (games_played >= 0),
  total_stars    integer not null default 0 check (total_stars >= 0),
  total_points   integer not null default 0 check (total_points >= 0),
  -- Highest stars/points in a single game, not lifetime totals.
  best_stars     integer not null default 0 check (best_stars >= 0),
  best_points    integer not null default 0 check (best_points >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  max_streak     integer not null default 0 check (max_streak >= 0),
  updated_at     timestamptz not null default now()
);

alter table public.mapsyquest_player_stats enable row level security;

drop policy if exists "players read their own stats" on public.mapsyquest_player_stats;
create policy "players read their own stats"
  on public.mapsyquest_player_stats for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "players add their own stats" on public.mapsyquest_player_stats;
create policy "players add their own stats"
  on public.mapsyquest_player_stats for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "players update their own stats" on public.mapsyquest_player_stats;
create policy "players update their own stats"
  on public.mapsyquest_player_stats for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
