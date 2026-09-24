-- MapsyQuest leaderboard. Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.
--
-- One row per player per board per period, holding that player's best score:
--   board   'daily' | 'time' | 'flag' | 'regional-full:<region>' | 'regional-quiz:<region>'
--   period  the date (YYYY-MM-DD) for the daily board, 'all' for every other board
--   score   points (higher is better), or seconds for the 'time' board (lower is better)
--
-- Scores are computed in the browser, so a determined player could still post a fake one:
-- the game has no server to check answers against. What the database does enforce is
-- everything around the score - the range checks below stop impossible values (more than a
-- perfect game, negative time), and the guard trigger further down stops a player editing
-- the ordering fields (created_at breaks ties), re-pointing a row, or posting to a day that
-- isn't today. The maxima must match MAX_DAILY_POINTS / MAX_QUIZ_POINTS in
-- src/lib/leaderboard.ts (a test reads this file to make sure they do).

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

-- Extra limits, added as separate idempotent statements so re-running also repairs an older table.

-- At most 3 stars a round, 10 rounds in the longest game.
alter table public.mapsyquest_leaderboard drop constraint if exists mapsyquest_leaderboard_stars_range;
alter table public.mapsyquest_leaderboard add constraint mapsyquest_leaderboard_stars_range
  check (stars between 0 and 30);

-- No control characters in a name that is shown to every visitor.
alter table public.mapsyquest_leaderboard drop constraint if exists mapsyquest_leaderboard_nickname_chars;
alter table public.mapsyquest_leaderboard add constraint mapsyquest_leaderboard_nickname_chars
  check (nickname !~ '[[:cntrl:]]');

-- Achievement ids are short kebab-case slugs (see ACHIEVEMENTS in src/lib/achievements.ts);
-- this keeps the array from carrying arbitrary text or growing without bound.
create or replace function public.mapsyquest_valid_achievements(ids text[])
returns boolean
language sql
immutable
as $$
  select coalesce(cardinality(ids), 0) <= 40
    and not exists (select 1 from unnest(ids) as id where id is null or id !~ '^[a-z0-9-]{1,40}$')
$$;

alter table public.mapsyquest_leaderboard drop constraint if exists mapsyquest_leaderboard_achievements_valid;
alter table public.mapsyquest_leaderboard add constraint mapsyquest_leaderboard_achievements_valid
  check (public.mapsyquest_valid_achievements(achievements));

-- Guard trigger. The row-level policies below let a player write their own rows, but they
-- can't say which columns may change - so this does:
--   * created_at is the tie-breaker on the boards (earlier wins), so it is always set by the
--     server and never editable. id, user_id, board and period can't be changed either.
--   * a daily score can only be posted for a day that is (about) today - one day either side
--     covers every timezone - so nobody can pre-fill tomorrow's board or backfill old ones.
--     Renaming (which touches old rows without changing their score) is unaffected.
create or replace function public.mapsyquest_leaderboard_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.board := old.board;
    new.period := old.period;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  if new.board = 'daily'
     and (tg_op = 'INSERT' or new.score is distinct from old.score)
     and (new.period::date < current_date - 1 or new.period::date > current_date + 1) then
    raise exception 'daily scores can only be posted for today' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists mapsyquest_leaderboard_guard on public.mapsyquest_leaderboard;
create trigger mapsyquest_leaderboard_guard
  before insert or update on public.mapsyquest_leaderboard
  for each row execute function public.mapsyquest_leaderboard_guard();

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
