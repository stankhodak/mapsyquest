-- MapsyQuest leaderboard. Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.
--
-- One row per player per board per period, holding that player's best score:
--   board   'daily' | 'time' | 'flag' | 'regional-full:<region>' | 'regional-quiz:<region>'
--   period  the date (YYYY-MM-DD) for the daily board, 'all' for every other board
--   score   points (higher is better), or seconds for the 'time' board (lower is better)
--
-- Scores are computed in the browser, so a determined player could post a fake one. The
-- range checks below only stop impossible values (more than a perfect game, negative time).
-- The maxima must match MAX_DAILY_POINTS / MAX_QUIZ_POINTS in src/lib/leaderboard.ts (a test
-- reads this file to make sure they do).

create table if not exists public.mapsyquest_leaderboard (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  nickname     text not null check (char_length(btrim(nickname)) between 1 and 30),
  board        text not null,
  period       text not null default 'all',
  score        numeric(8, 1) not null,
  stars        integer not null default 0 check (stars >= 0),
  achievements text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (user_id, board, period),

  constraint mapsyquest_leaderboard_board_period check (
    (board = 'daily' and period ~ '^\d{4}-\d{2}-\d{2}$')
    or (board <> 'daily' and period = 'all')
  ),

  constraint mapsyquest_leaderboard_score_range check (
    case
      when board = 'time' then score between 10 and 3600
      when board = 'daily' or board ~ '^regional-full:(europe|asia|americas|oceania|islands)$'
        then score between 0 and 8400
      when board = 'flag' or board ~ '^regional-quiz:(europe|asia|americas|oceania|islands)$'
        then score between 0 and 1000
      else false
    end
  )
);

-- Serves the "top N for a board" query.
create index if not exists mapsyquest_leaderboard_board_score
  on public.mapsyquest_leaderboard (board, period, score);

alter table public.mapsyquest_leaderboard enable row level security;

-- Anyone, logged in or not, can read the boards.
drop policy if exists "leaderboard is public to read" on public.mapsyquest_leaderboard;
create policy "leaderboard is public to read"
  on public.mapsyquest_leaderboard for select
  using (true);

-- Players can only write rows that belong to them.
drop policy if exists "players add their own scores" on public.mapsyquest_leaderboard;
create policy "players add their own scores"
  on public.mapsyquest_leaderboard for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "players update their own scores" on public.mapsyquest_leaderboard;
create policy "players update their own scores"
  on public.mapsyquest_leaderboard for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "players delete their own scores" on public.mapsyquest_leaderboard;
create policy "players delete their own scores"
  on public.mapsyquest_leaderboard for delete
  to authenticated
  using (auth.uid() = user_id);
