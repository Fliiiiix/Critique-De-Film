-- Même bug que migrations/033 (get_global_top_films/get_friends_top_films),
-- trouvé lors d'un audit ciblé sur ce pattern : get_group_top_films
-- (migrations/022, "Goûts du groupe") calcule coalesce(manual_note, moyenne
-- des critères) PAR LIGNE mais filtre seulement `having count(*) >= 2` —
-- count(*) compte TOUTE ligne, notée ou non. Un film ajouté par 2+ membres
-- du groupe mais jamais noté par aucun d'eux (manual_note null ET crit
-- vide/incomplet pour chacun) passe donc le having, avec un avg_note de
-- groupe null — et ressort en tête du classement (Postgres trie les null
-- en premier sur "order by ... desc" par défaut), affiché "0" côté client
-- (Number(null) === 0, voir js/groups.js).
--
-- Fix identique à la migration 033 : filtrer les lignes sans note
-- calculable AVANT le group by (CTE `rated`), et adapter le
-- "having count(*) >= 2" pour qu'il ne compte que les VRAIES notes
-- (plus besoin d'un having séparé sur les valeurs null, elles sont déjà
-- exclues de la CTE).
create or replace function public.get_group_top_films(p_group_id bigint, p_limit int default 20)
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
as $func$
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
    join public.group_members gm on gm.user_id = f.user_id and gm.group_id = p_group_id
    where f.tmdb_id is not null
      and public.is_group_member(p_group_id)
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
  having count(*) >= 2
  order by avg_note desc, rating_count desc
  limit p_limit;
$func$;
