-- Suivi des séries, à l'épisode près — section à part entière du site
-- (#/series), séparée du catalogue films (`films`) comme demandé : une
-- série n'a pas la même forme qu'un film (plusieurs saisons, des épisodes
-- qui arrivent avec le temps), donc pas la même grille de notation ni le
-- même modèle de progression. Voir js/series.js.

-- Une ligne par série suivie par un utilisateur — le pendant de `films`
-- pour les séries, mais bien plus légère : pas de grille à 7 critères
-- (une série s'étale sur des saisons entières, la grille par film ne s'y
-- prête pas), juste une note manuelle optionnelle sur la même échelle
-- 0-5 par demi-point. `status`/`number_of_seasons`/`number_of_episodes`/
-- `in_production` sont un instantané TMDB pris à l'ajout puis rafraîchi à
-- chaque ouverture du détail (js/series.js → refreshShowMeta) — jamais la
-- source de vérité pour "reste-t-il des épisodes non regardés" (ça, c'est
-- toujours recalculé depuis tv_episodes_watched + un appel TMDB direct),
-- seulement de quoi afficher un badge de statut sans réappeler TMDB à
-- chaque rendu de liste.
create table public.tv_shows (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  poster_url text,
  overview text,
  first_air_year integer,
  -- Statut TMDB tel quel : 'Returning Series' | 'Planned' | 'In Production'
  -- | 'Ended' | 'Cancelled' | 'Pilot'. 'Ended'/'Cancelled' = ne produira
  -- plus jamais de nouvelle saison — utilisé tel quel par la section
  -- Prochaines sorties (migrations/025) pour son groupe "Séries terminées".
  status text,
  number_of_seasons integer,
  number_of_episodes integer,
  in_production boolean,
  manual_note numeric,
  review text,
  added bigint not null,
  created_at timestamptz not null default now(),
  -- Une même série ne peut pas être suivie deux fois par le même
  -- utilisateur — la recherche TMDB doit vérifier ça avant insertion
  -- plutôt que de laisser Postgres le découvrir (voir handleAddShow()).
  unique (user_id, tmdb_id)
);

alter table public.tv_shows enable row level security;

create policy "Users can view own tv shows"
  on public.tv_shows for select
  using (auth.uid() = user_id);

create policy "Users can insert own tv shows"
  on public.tv_shows for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tv shows"
  on public.tv_shows for update
  using (auth.uid() = user_id);

create policy "Users can delete own tv shows"
  on public.tv_shows for delete
  using (auth.uid() = user_id);

-- Une ligne par épisode vu — table de jointure plutôt qu'un blob jsonb sur
-- tv_shows (comme `viewings` l'est déjà pour les revisionnages de films) :
-- l'ensemble des épisodes vus grandit épisode par épisode indépendamment,
-- et "marquer la saison entière" devient un simple insert en masse avec
-- on conflict do nothing plutôt que de réécrire un blob complet à chaque
-- coche (risque de concurrence entre deux onglets, entre autres).
create table public.tv_episodes_watched (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tv_show_id bigint not null references public.tv_shows(id) on delete cascade,
  season_number integer not null,
  episode_number integer not null,
  watched_at bigint not null,
  unique (user_id, tv_show_id, season_number, episode_number)
);

alter table public.tv_episodes_watched enable row level security;

create policy "Users can view own watched episodes"
  on public.tv_episodes_watched for select
  using (auth.uid() = user_id);

create policy "Users can insert own watched episodes"
  on public.tv_episodes_watched for insert
  with check (auth.uid() = user_id);

create policy "Users can update own watched episodes"
  on public.tv_episodes_watched for update
  using (auth.uid() = user_id);

create policy "Users can delete own watched episodes"
  on public.tv_episodes_watched for delete
  using (auth.uid() = user_id);
