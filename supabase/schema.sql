-- Table des films notés, un jeu de données par utilisateur (RLS).
-- À exécuter dans Supabase → SQL Editor (nouveau projet). Pour un projet
-- déjà provisionné avec une version antérieure de ce schéma, voir plutôt
-- supabase/migrations/ pour les changements incrémentaux.

create table public.films (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  crit jsonb not null,
  fav boolean not null default false,
  added bigint not null,
  -- Note sur 5 saisie directement, en bypass de la grille de 7 critères —
  -- pour les films notés avec un référentiel différent (voir migrations/002).
  manual_note numeric,
  -- Commentaire libre (voir migrations/003).
  review text,
  -- Métadonnées TMDB, remplies à l'ajout via recherche (voir migrations/004).
  tmdb_id integer,
  poster_url text,
  overview text,
  release_year integer,
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

-- Profil par utilisateur (pseudo + avatar), voir migrations/005.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);
