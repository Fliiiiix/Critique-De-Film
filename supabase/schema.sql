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
  created_at timestamptz not null default now()
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

-- Top films : deux classements agrégés (voir js/top.js, migrations/015).
-- Comme is_group_member plus haut, ces fonctions SECURITY DEFINER lisent
-- `films` de tout le monde en interne (RLS contournée volontairement) mais
-- ne renvoient QUE des agrégats — jamais user_id ni review, donc pas de
-- fuite de "qui a mis quelle note" même sur un film noté par une seule
-- personne. Un film est identifié par son tmdb_id (les ajouts manuels sans
-- fiche TMDB ne peuvent pas être recoupés entre utilisateurs, donc exclus).
-- La note de chaque utilisateur est recalculée avec la même formule que
-- computeNote() côté client (js/app.js) : moyenne des 7 critères (0..1)
-- arrondie au demi-point sur 5, ou manual_note directement si renseignée.

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
  select
    f.tmdb_id,
    max(f.title) as title,
    max(f.poster_url) as poster_url,
    max(f.release_year) as release_year,
    round(avg(coalesce(f.manual_note, (
      select round(avg(v.value::numeric) * 10) / 2
      from jsonb_each_text(f.crit) as v
    ))), 2) as avg_note,
    count(*)::integer as rating_count
  from public.films f
  where f.tmdb_id is not null
  group by f.tmdb_id
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
  )
  select
    f.tmdb_id,
    max(f.title) as title,
    max(f.poster_url) as poster_url,
    max(f.release_year) as release_year,
    round(avg(coalesce(f.manual_note, (
      select round(avg(v.value::numeric) * 10) / 2
      from jsonb_each_text(f.crit) as v
    ))), 2) as avg_note,
    count(*)::integer as rating_count
  from public.films f
  join my_circle mc on mc.uid = f.user_id
  where f.tmdb_id is not null
  group by f.tmdb_id
  order by avg_note desc, rating_count desc
  limit p_limit;
$$;

revoke all on function public.get_friends_top_films(int) from public;
grant execute on function public.get_friends_top_films(int) to authenticated;

-- Profil partageable : page publique en lecture seule (#/u/:userId, voir
-- js/publicProfile.js, migrations/016), SANS connexion requise — seule
-- fonction de tout ce fichier accordée à `anon`. Lue par n'importe qui,
-- mais renvoie uniquement pseudo/avatar + un résumé du catalogue
-- (titre/affiche/année/note/favori), jamais l'email ni review, et rien du
-- tout si public_profile est resté à false (0 ligne, sans distinguer
-- "profil inexistant" de "profil privé").
create or replace function public.get_public_profile(p_user_id uuid)
returns table(
  display_name text,
  avatar_url text,
  films jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with prof as (
    select display_name, avatar_url
    from public.profiles
    where user_id = p_user_id and public_profile = true
  ),
  scored as (
    select
      f.title, f.poster_url, f.release_year, f.fav,
      coalesce(f.manual_note, (
        select round(avg(v.value::numeric) * 10) / 2
        from jsonb_each_text(f.crit) as v
      )) as note
    from public.films f
    where f.user_id = p_user_id and exists (select 1 from prof)
  )
  select
    prof.display_name,
    prof.avatar_url,
    coalesce(jsonb_agg(jsonb_build_object(
      'title', scored.title,
      'poster_url', scored.poster_url,
      'release_year', scored.release_year,
      'note', scored.note,
      'fav', scored.fav
    ) order by scored.note desc nulls last) filter (where scored.title is not null), '[]'::jsonb) as films
  from prof
  left join scored on true
  group by prof.display_name, prof.avatar_url;
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
