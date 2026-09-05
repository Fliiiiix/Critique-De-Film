-- Corrige un bug remonté par l'utilisateur : dans "Top films", un film sans
-- AUCUNE note réelle (ajouté au catalogue mais jamais noté — manual_note
-- null ET crit vide/incomplet, ex. un import Letterboxd sans Rating)
-- apparaissait EN PREMIÈRE position avec "0" affiché, alors que personne ne
-- lui a jamais mis 0.
--
-- Cause : get_global_top_films/get_friends_top_films (migrations/015)
-- calculaient coalesce(manual_note, moyenne des critères) PAR LIGNE, mais
-- ne filtraient jamais les lignes où ce calcul donne null (aucune des deux
-- sources n'est renseignée) avant de les agréger. `avg()` ignore les null
-- individuels, mais si TOUTES les lignes d'un tmdb_id sont null, avg_note
-- du groupe est null — et Postgres trie les null EN PREMIER par défaut sur
-- un "order by ... desc" (traités comme "plus grands que tout"), d'où la
-- première place. Côté client, Number(null) vaut 0 (js/top.js), d'où le
-- "0" affiché — un film "sans note" n'a jamais été noté 0.
--
-- Fix : filtrer les lignes sans note calculable AVANT le group by (CTE
-- `rated`), pas après — un film jamais vraiment noté par personne ne doit
-- simplement pas apparaître dans un classement de notes, et rating_count
-- ne doit compter que de vraies notes.
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
