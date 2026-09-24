-- MapsyQuest feedback form (src/lib/feedback.ts). Run in the Supabase dashboard: SQL Editor ->
-- New query -> paste -> Run. Safe to re-run: every statement is idempotent, so it also repairs
-- a table that was created by hand without its policies or limits.
--
-- A private inbox, not a message board: the app can only INSERT. There is deliberately no
-- select/update/delete policy, so nobody can list or change submissions through the API - read
-- them in the dashboard's Table Editor. Logged-out visitors can submit too (anon), but a row
-- can only carry a user_id that belongs to the person sending it.
--
-- The length limits mirror the form (500-character message); the client's own checks can be
-- skipped by calling the API directly, so these are what actually holds.

create table if not exists public.mapsyquest_feedback (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  message       text not null,
  contact_email text,
  user_id       uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.mapsyquest_feedback add column if not exists created_at timestamptz not null default now();

alter table public.mapsyquest_feedback drop constraint if exists mapsyquest_feedback_category_check;
alter table public.mapsyquest_feedback add constraint mapsyquest_feedback_category_check
  check (category in ('thanks', 'bug', 'other'));

alter table public.mapsyquest_feedback drop constraint if exists mapsyquest_feedback_message_check;
alter table public.mapsyquest_feedback add constraint mapsyquest_feedback_message_check
  check (char_length(btrim(message)) between 5 and 500);

alter table public.mapsyquest_feedback drop constraint if exists mapsyquest_feedback_contact_email_check;
alter table public.mapsyquest_feedback add constraint mapsyquest_feedback_contact_email_check
  check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+$'));

alter table public.mapsyquest_feedback enable row level security;

-- Belt and braces on top of RLS: the API roles can only ever insert.
revoke all on public.mapsyquest_feedback from anon, authenticated;
grant insert on public.mapsyquest_feedback to anon, authenticated;

drop policy if exists "anyone can send feedback" on public.mapsyquest_feedback;
create policy "anyone can send feedback"
  on public.mapsyquest_feedback for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
