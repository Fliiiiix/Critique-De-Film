-- Table des films notés, un jeu de données par utilisateur (RLS).
-- À exécuter dans Supabase → SQL Editor.

create table public.films (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  crit jsonb not null,
  fav boolean not null default false,
  added bigint not null,
  created_at timestamptz not null default now()
);

alter table public.films enable row level security;

-- Chacun ne voit / modifie que ses propres films.
create policy "Users can view own films"
  on public.films for select
  using (auth.uid() = user_id);

create policy "Users can insert own films"
  on public.films for insert
  with check (auth.uid() = user_id);

create policy "Users can update own films"
  on public.films for update
  using (auth.uid() = user_id);

create policy "Users can delete own films"
  on public.films for delete
  using (auth.uid() = user_id);
