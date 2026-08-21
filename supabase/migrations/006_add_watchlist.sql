-- Watchlist : liste "à voir" séparée du catalogue noté (table `films`).
-- Ajout rapide (titre + fiche TMDB optionnelle + note libre), sans passer
-- par la grille de critères. Un item se transforme en film noté (et
-- disparaît de la watchlist) via "Noter" dans l'app — voir js/watchlist.js.
create table public.watchlist (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  -- Pourquoi je veux le voir / qui me l'a conseillé, etc.
  note text,
  tmdb_id integer,
  poster_url text,
  overview text,
  release_year integer,
  added bigint not null,
  created_at timestamptz not null default now()
);

alter table public.watchlist enable row level security;

create policy "Users can view own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can update own watchlist"
  on public.watchlist for update
  using (auth.uid() = user_id);

create policy "Users can delete own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);
