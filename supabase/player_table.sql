-- Run this in Supabase SQL Editor.
-- It creates the table used by VITE_SUPABASE_STARTS_TABLE=starts
-- and allows client inserts with your publishable/anon key.


create table if not exists public.starts (
  id bigint generated always as identity primary key,
  student_id text not null,
  first_name text not null,
  last_initial text not null check (char_length(last_initial) = 1),
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);


alter table public.starts enable row level security;

alter table public.starts rename to player;

drop policy if exists "allow_public_insert_starts" on public.player;

create policy "allow_public_insert_player"
on public.player
for insert
to anon, authenticated
with check (true);

