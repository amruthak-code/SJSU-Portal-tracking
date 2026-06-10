-- ───────────────────────────────────────────────────────────────────────────
-- SJSU Course Seat Tracker — database schema (run in Supabase SQL Editor)
-- Postgres + Row-Level Security. Each user only ever sees their own rows.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) PROFILES ────────────────────────────────────────────────────────────────
-- Mirror of auth.users so the scraper can join a user's email for alerts.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) TRACKED COURSES (per user) ───────────────────────────────────────────────
create table if not exists public.tracked_courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  class_number text not null,
  subject      text,
  label        text,
  term         text not null default 'Fall 2026',
  status       text not null default 'Unknown',  -- latest scraped status
  seats        int,
  checked_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, class_number, term)
);

alter table public.tracked_courses enable row level security;

drop policy if exists "own courses select" on public.tracked_courses;
drop policy if exists "own courses insert" on public.tracked_courses;
drop policy if exists "own courses update" on public.tracked_courses;
drop policy if exists "own courses delete" on public.tracked_courses;

create policy "own courses select" on public.tracked_courses
  for select using (auth.uid() = user_id);
create policy "own courses insert" on public.tracked_courses
  for insert with check (auth.uid() = user_id);
create policy "own courses update" on public.tracked_courses
  for update using (auth.uid() = user_id);
create policy "own courses delete" on public.tracked_courses
  for delete using (auth.uid() = user_id);

create index if not exists idx_tracked_user on public.tracked_courses(user_id);

-- 3) LIVE CATALOG (global, for Smart Search) ──────────────────────────────────
-- Written by the scraper via the service-role key (bypasses RLS); readable by
-- any signed-in user.
create table if not exists public.catalog (
  class_number text primary key,
  code         text,
  title        text,
  section      text,
  days_time    text,
  instructor   text,
  status       text,
  career       text,
  term         text,
  updated_at   timestamptz not null default now()
);

alter table public.catalog enable row level security;

drop policy if exists "catalog read for authenticated" on public.catalog;
create policy "catalog read for authenticated"
  on public.catalog for select
  to authenticated
  using (true);
-- No insert/update/delete policies → only the service role can write.
