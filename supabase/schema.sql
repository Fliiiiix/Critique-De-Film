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
  -- Titre en langue d'origine, à côté du titre FR ci-dessus — pour que la
  -- recherche matche indifféremment "créatures féroces" ou "fierce creatures"
  -- sans traduction automatique (voir migrations/008).
  original_title text,
  -- Genres TMDB (v2.1, migrations/029) — id numérique brut (pas le libellé,
  -- traduit côté client via GENRE_MAP dans js/data.js).
  genre_ids integer[],
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
  -- Opt-in pour la page publique #/u/:userId, voir get_public_profile()
  -- plus bas et migrations/016. false par défaut : personne n'est exposé
  -- sans l'avoir explicitement choisi.
  public_profile boolean not null default false,
  -- Top films perso (v2.3, retour utilisateur : "un top films comme
  -- Letterboxd, mis en avant par choix pas par note") — tmdb_id choisis à la
  -- main, dans l'ordre voulu, au plus 4 ; résolu par get_public_profile()
  -- plus bas en rejoignant le catalogue déjà noté du propriétaire (jamais
  -- interrogé seul, pas la granularité qui justifierait une table à part —
  -- même raisonnement que films.genre_ids, migrations/029).
  top_films integer[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint profiles_top_films_max4
    check (array_length(top_films, 1) is null or array_length(top_films, 1) <= 4)
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Élargie par migrations/009 pour la recherche d'amis par pseudo — ne
-- concerne que display_name/avatar_url, jamais l'email.
create policy "Authenticated users can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Watchlist ("à voir"), séparée du catalogue noté, voir migrations/006.
create table public.watchlist (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  note text,
  tmdb_id integer,
  poster_url text,
  overview text,
  release_year integer,
  original_title text,
  -- Date de sortie complète (pas juste l'année), voir migrations/025 —
  -- utilisée par la section Prochaines sorties (js/upcoming.js).
  release_date date,
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

-- Séries suivies, section à part du catalogue films, voir migrations/024.
create table public.tv_shows (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  poster_url text,
  overview text,
  first_air_year integer,
  status text,
  number_of_seasons integer,
  number_of_episodes integer,
  in_production boolean,
  manual_note numeric,
  review text,
  added bigint not null,
  created_at timestamptz not null default now(),
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

-- Épisodes vus, une ligne par épisode — voir migrations/024.
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

-- Journal des visionnages (revisionnages), voir migrations/007.
create table public.viewings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  film_id bigint not null references public.films(id) on delete cascade,
  watched_at bigint not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.viewings enable row level security;

create policy "Users can view own viewings"
  on public.viewings for select
  using (auth.uid() = user_id);

create policy "Users can insert own viewings"
  on public.viewings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own viewings"
  on public.viewings for update
  using (auth.uid() = user_id);

create policy "Users can delete own viewings"
  on public.viewings for delete
  using (auth.uid() = user_id);

-- Amis : demande / acceptation, et visibilité croisée du catalogue noté
-- (lecture seule) une fois amis, voir migrations/009 et js/friends.js.
create table public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Users can view their friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can respond to a request"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

create policy "Either side can remove a friendship"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Friends can view shared films"
  on public.films for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = films.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = films.user_id))
    )
  );

-- Recherche d'un ami par email exact sans exposer auth.users côté client —
-- voir migrations/009 pour le détail des garanties (pas de LIKE, pas
-- d'énumération en masse).
create or replace function public.find_user_by_email(search_email text)
returns table(user_id uuid, display_name text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_url
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(search_email)
    and u.id <> auth.uid()
  limit 1;
$$;

revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to authenticated;

-- Mode maintenance, voir migrations/010 et js/auth.js. Ligne unique,
-- modifiable seulement depuis le dashboard Supabase (Table Editor).
create table public.site_status (
  id integer primary key default 1,
  maintenance boolean not null default false,
  message text,
  updated_at timestamptz not null default now(),
  constraint site_status_single_row check (id = 1)
);

alter table public.site_status enable row level security;

create policy "Anyone can read site status"
  on public.site_status for select
  using (true);

insert into public.site_status (id, maintenance) values (1, false);

-- Groupes (famille/amis), voir migrations/011 et js/groups.js.
create table public.groups (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create table public.group_members (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint group_members_unique unique (group_id, user_id)
);

alter table public.group_members enable row level security;

-- Vérifie l'appartenance à un groupe en SECURITY DEFINER (même pattern que
-- find_user_by_email plus haut) : une policy sur group_members qui
-- s'auto-interroge dans sa propre USING clause provoque une récursion
-- infinie côté Postgres (42P17) — voir migrations/013 pour l'historique.
create or replace function public.is_group_member(p_group_id bigint, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_group_member(bigint, uuid) from public;
grant execute on function public.is_group_member(bigint, uuid) to authenticated;

-- Le propriétaire voit toujours son propre groupe directement par owner_id,
-- sans dépendre de group_members : le trigger qui l'y ajoute (plus bas)
-- s'exécute après l'évaluation de cette policy pour le RETURNING de
-- l'insert (js/groups.js), donc une dépendance exclusive à
-- is_group_member() échoue à la création — voir migrations/014.
create policy "Members can view their groups"
  on public.groups for select
  using (owner_id = auth.uid() or public.is_group_member(id));

create policy "Users can create groups"
  on public.groups for insert
  with check (owner_id = auth.uid());

create policy "Owner can update group"
  on public.groups for update
  using (owner_id = auth.uid());

create policy "Owner can delete group"
  on public.groups for delete
  using (owner_id = auth.uid());

create policy "Members can view fellow group members"
  on public.group_members for select
  using (public.is_group_member(group_id));

create policy "Owner can add members"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "Owner or self can remove a member"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create or replace function public.add_group_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

create trigger trg_add_group_owner_as_member
  after insert on public.groups
  for each row execute function public.add_group_owner_as_member();

-- Propositions de films au sein d'un groupe : vote + discussion, voir
-- migrations/012 et js/proposals.js.
create table public.group_proposals (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_title text,
  tmdb_id integer,
  poster_url text,
  overview text,
  release_year integer,
  created_at timestamptz not null default now()
);

alter table public.group_proposals enable row level security;

create table public.group_proposal_votes (
  id bigint generated always as identity primary key,
  proposal_id bigint not null references public.group_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  constraint group_proposal_votes_unique unique (proposal_id, user_id)
);

alter table public.group_proposal_votes enable row level security;

create table public.group_proposal_comments (
  id bigint generated always as identity primary key,
  proposal_id bigint not null references public.group_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.group_proposal_comments enable row level security;

create policy "Members can view group proposals"
  on public.group_proposals for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_proposals.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can propose films"
  on public.group_proposals for insert
  with check (
    proposed_by = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Proposer or group owner can delete a proposal"
  on public.group_proposals for delete
  using (
    proposed_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "Members can view proposal votes"
  on public.group_proposal_votes for select
  using (
    exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can vote"
  on public.group_proposal_votes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can change their own vote"
  on public.group_proposal_votes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can remove their own vote"
  on public.group_proposal_votes for delete
  using (user_id = auth.uid());

create policy "Members can view proposal comments"
  on public.group_proposal_comments for select
  using (
    exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can comment"
  on public.group_proposal_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Author or group owner can delete a comment"
  on public.group_proposal_comments for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_proposals gp
      join public.groups g on g.id = gp.group_id
      where gp.id = proposal_id and g.owner_id = auth.uid()
    )
  );

-- Top films : deux classements agrégés (voir js/top.js, migrations/015,
-- corrigé en migrations/033 — voir ce fichier pour le détail du bug).
-- Comme is_group_member plus haut, ces fonctions SECURITY DEFINER lisent
-- `films` de tout le monde en interne (RLS contournée volontairement) mais
-- ne renvoient QUE des agrégats — jamais user_id ni review, donc pas de
-- fuite de "qui a mis quelle note" même sur un film noté par une seule
-- personne. Un film est identifié par son tmdb_id (les ajouts manuels sans
-- fiche TMDB ne peuvent pas être recoupés entre utilisateurs, donc exclus).
-- La note de chaque utilisateur est recalculée avec la même formule que
-- computeNote() côté client (js/app.js) : moyenne des 7 critères (0..1)
-- arrondie au demi-point sur 5, ou manual_note directement si renseignée.
-- Le calcul par ligne (CTE `rated`) est filtré `where note is not null`
-- AVANT le group by : un film jamais noté par personne (manual_note null
-- ET crit vide/incomplet — ex. import Letterboxd sans Rating) n'a pas de
-- note à moyenner, ne doit pas apparaître dans un classement, et ne doit
-- surtout pas se retrouver en tête via le tri par défaut de Postgres (qui
-- place les null en premier sur un "order by ... desc").

create or replace function public.get_global_top_films(p_limit int default 30)
returns table(
  tmdb_id integer,
  title text,
  poster_url text,
  release_year integer,
  avg_note numeric,
  rating_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  with rated as (
    select
      f.tmdb_id,
      f.title,
      f.poster_url,
      f.release_year,
      coalesce(f.manual_note, (
        select round(avg(v.value::numeric) * 10) / 2
        from jsonb_each_text(f.crit) as v
      )) as note
    from public.films f
    where f.tmdb_id is not null
  )
  select
    tmdb_id,
    max(title) as title,
    max(poster_url) as poster_url,
    max(release_year) as release_year,
    round(avg(note), 2) as avg_note,
    count(*)::integer as rating_count
  from rated
  where note is not null
  group by tmdb_id
  order by avg_note desc, rating_count desc
  limit p_limit;
$$;

revoke all on function public.get_global_top_films(int) from public;
grant execute on function public.get_global_top_films(int) to authenticated;

-- Même chose, restreint à "moi + mes amis acceptés" (directs uniquement —
-- pas les amis de mes amis) : personnel à chaque appelant (auth.uid()), si
-- j'ai 4 amis mon top porte sur nous 5, si l'un d'eux a 7 amis le sien
-- porte sur eux 8.
create or replace function public.get_friends_top_films(p_limit int default 30)
returns table(
  tmdb_id integer,
  title text,
  poster_url text,
  release_year integer,
  avg_note numeric,
  rating_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  with my_circle as (
    select auth.uid() as uid
    union
    select addressee_id from public.friendships
      where requester_id = auth.uid() and status = 'accepted'
    union
    select requester_id from public.friendships
      where addressee_id = auth.uid() and status = 'accepted'
  ),
  rated as (
    select
      f.tmdb_id,
      f.title,
      f.poster_url,
      f.release_year,
      coalesce(f.manual_note, (
        select round(avg(v.value::numeric) * 10) / 2
        from jsonb_each_text(f.crit) as v
      )) as note
    from public.films f
    join my_circle mc on mc.uid = f.user_id
    where f.tmdb_id is not null
  )
  select
    tmdb_id,
    max(title) as title,
    max(poster_url) as poster_url,
    max(release_year) as release_year,
    round(avg(note), 2) as avg_note,
    count(*)::integer as rating_count
  from rated
  where note is not null
  group by tmdb_id
  order by avg_note desc, rating_count desc
  limit p_limit;
$$;

revoke all on function public.get_friends_top_films(int) from public;
grant execute on function public.get_friends_top_films(int) to authenticated;

-- Profil partageable : page publique en lecture seule (#/u/:userId, voir
-- js/publicProfile.js, migrations/016), SANS connexion requise — seule
-- fonction de tout ce fichier accordée à `anon`. Lue par n'importe qui,
-- mais renvoie uniquement pseudo/avatar + un résumé du catalogue
-- (tmdb_id/titre/affiche/année/note/favori — tmdb_id ajouté en migrations/
-- 032, rien de sensible, permet de rendre les lignes cliquables vers leur
-- fiche), jamais l'email ni review, et rien du tout si public_profile est
-- resté à false (0 ligne, sans distinguer "profil inexistant" de "profil
-- privé"). Chaque colonne est sa propre sous-requête corrélée plutôt qu'un
-- group by commun (migrations/032) : `films` (tri par note) et `top_films`
-- (tri par l'ordre choisi par l'utilisateur, voir profiles.top_films)
-- n'ont pas le même tri, les mélanger dans un seul jsonb_agg groupé était
-- plus verbeux que deux sous-requêtes indépendantes.
create or replace function public.get_public_profile(p_user_id uuid)
returns table(
  display_name text,
  avatar_url text,
  films jsonb,
  top_films jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.display_name,
    p.avatar_url,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tmdb_id', f.tmdb_id,
        'title', f.title,
        'poster_url', f.poster_url,
        'release_year', f.release_year,
        'note', coalesce(f.manual_note, (
          select round(avg(v.value::numeric) * 10) / 2
          from jsonb_each_text(f.crit) as v
        )),
        'fav', f.fav
      ) order by coalesce(f.manual_note, (
          select round(avg(v.value::numeric) * 10) / 2
          from jsonb_each_text(f.crit) as v
        )) desc nulls last)
      from public.films f
      where f.user_id = p.user_id
    ), '[]'::jsonb) as films,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tmdb_id', f.tmdb_id,
        'title', f.title,
        'poster_url', f.poster_url,
        'release_year', f.release_year
      ) order by ord.pos)
      from unnest(p.top_films) with ordinality as ord(tmdb_id, pos)
      join public.films f on f.tmdb_id = ord.tmdb_id and f.user_id = p.user_id
    ), '[]'::jsonb) as top_films
  from public.profiles p
  where p.user_id = p_user_id and p.public_profile = true;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- Upload d'avatar réel (Supabase Storage), voir migrations/017 et la case
-- "Ou uploader une image" dans js/profile.js. Bucket public en lecture
-- (l'avatar doit s'afficher pour les amis et sur le profil public, qui
-- n'exige pas de connexion) mais chacun ne peut écrire que dans son propre
-- dossier (avatars/<user_id>/...). Chemin fixe par utilisateur : re-uploader
-- remplace l'ancien avatar plutôt que d'accumuler des fichiers orphelins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read access on avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Feedback utilisateur — voir js/feedback.js et migrations/026. Séparation
-- admin en vraie policy RLS ici (pas juste un choix d'affichage côté
-- client comme admin_config) : un retour peut contenir une remarque
-- personnelle, aucun autre compte ne doit pouvoir le lire.
create table public.feedback (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'idee', 'autre')),
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

create policy "Admin can view all feedback"
  on public.feedback for select
  using ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

create policy "Admin can update feedback"
  on public.feedback for update
  using ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

-- Journal d'événements + stats admin — voir js/logging.js et
-- migrations/027. INSERT ouvert même sans session (une erreur peut
-- survenir avant toute connexion) ; LECTURE réservée à l'admin (vraie
-- policy RLS, comme feedback ci-dessus).
create table public.app_events (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.app_events enable row level security;

create policy "Anyone can log an event"
  on public.app_events for insert
  to anon, authenticated
  with check (true);

create policy "Admin can view all events"
  on public.app_events for select
  using ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

-- Compteurs globaux ("Activité globale" de l'onglet admin) — SECURITY
-- DEFINER comme get_global_top_films plus haut : lit films/tv_shows/
-- viewings/auth.users de tout le monde en interne mais ne renvoie que 4
-- nombres, jamais une ligne individuelle.
create or replace function public.get_admin_site_stats()
returns table(
  total_users bigint,
  total_films bigint,
  total_series bigint,
  total_viewings bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from auth.users) as total_users,
    (select count(*) from public.films) as total_films,
    (select count(*) from public.tv_shows) as total_series,
    (select count(*) from public.viewings) as total_viewings;
$$;

revoke all on function public.get_admin_site_stats() from public;
grant execute on function public.get_admin_site_stats() to authenticated;

-- Nouveautés (v2.1+) — voir js/changelog.js, js/admin.js et
-- migrations/028. Vraie policy RLS ici (comme feedback plus haut) : lisible
-- par tout le monde une fois publiée (published = true), brouillon réservé
-- à l'admin le temps de la rédaction. Badge "vu" : colonne
-- last_seen_changelog sur user_activity_state (migrations/023 — cette
-- table n'est pas reprise dans ce fichier consolidé, gap préexistant à
-- corriger un jour ; la colonne ci-dessous suppose la table déjà créée).
create table public.changelog_entries (
  id bigint generated by default as identity primary key,
  version text not null,
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.changelog_entries enable row level security;

create policy "Anyone can view published changelog entries"
  on public.changelog_entries for select
  using (published = true);

create policy "Admin can view all changelog entries"
  on public.changelog_entries for select
  using ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

create policy "Admin can insert changelog entries"
  on public.changelog_entries for insert
  with check ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

create policy "Admin can update changelog entries"
  on public.changelog_entries for update
  using ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

create policy "Admin can delete changelog entries"
  on public.changelog_entries for delete
  using ((auth.jwt() ->> 'email') = 'sab.fxs@gmail.com');

-- Fiche film (v2.1, retour utilisateur) — voir js/filmDetail.js. Cliquer
-- sur un film n'importe où dans l'app (profil d'un ami, Top, groupes...)
-- ouvre désormais une vraie page dédiée : résumé, genre, note moyenne
-- communautaire, + noter/aimer/commenter, plutôt que la seule note posée
-- à côté du titre.
--
-- Un film est identifié par son tmdb_id (comme get_global_top_films,
-- migrations/015) : pas de table "films canoniques" séparée à maintenir,
-- like/commentaire s'accrochent directement à l'id numérique TMDB.

-- --- Like (v2.1) --- Distinct du ★ favori (personnel, jamais vu des
-- autres) : un like ici est un vrai signal social, visible des amis.
create table public.film_likes (
  id bigint generated by default as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

-- --- Commentaire (v2.1) --- Distinct de `films.review` (personnel) : un
-- commentaire ici est public (entre amis), plusieurs personnes peuvent en
-- laisser un sur le même film — même principe que
-- group_proposal_comments (migrations/012), à l'échelle d'un film plutôt
-- que d'une proposition de groupe.
create table public.film_comments (
  id bigint generated by default as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.film_likes enable row level security;
alter table public.film_comments enable row level security;

-- Vérifie l'amitié en contournant RLS pour sa propre requête interne —
-- même pattern que is_group_member (migrations/013), pour éviter toute
-- récursion de policy et pouvoir être appelée directement depuis une
-- USING clause.
create or replace function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_user_a = p_user_b or exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = p_user_a and addressee_id = p_user_b)
        or (requester_id = p_user_b and addressee_id = p_user_a))
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

create policy "Users can view own or friends' likes"
  on public.film_likes for select
  using (public.are_friends(auth.uid(), user_id));

create policy "Users can like as themselves"
  on public.film_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike their own like"
  on public.film_likes for delete
  using (auth.uid() = user_id);

create policy "Users can view own or friends' comments"
  on public.film_comments for select
  using (public.are_friends(auth.uid(), user_id));

create policy "Users can comment as themselves"
  on public.film_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own comment"
  on public.film_comments for delete
  using (auth.uid() = user_id);

-- --- Note moyenne communautaire (v2.1) --- Même formule que
-- get_global_top_films (migrations/015), restreinte à un seul tmdb_id
-- plutôt qu'un classement — n'expose que l'agrégat (moyenne + nombre de
-- votants), jamais une ligne individuelle, même principe que le top.
create or replace function public.get_film_stats(p_tmdb_id integer)
returns table(avg_note numeric, rating_count integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    round(avg(coalesce(f.manual_note, (
      select round(avg(v.value::numeric) * 10) / 2
      from jsonb_each_text(f.crit) as v
    ))), 2) as avg_note,
    count(*)::integer as rating_count
  from public.films f
  where f.tmdb_id = p_tmdb_id;
$$;

revoke all on function public.get_film_stats(integer) from public;
grant execute on function public.get_film_stats(integer) to authenticated;
