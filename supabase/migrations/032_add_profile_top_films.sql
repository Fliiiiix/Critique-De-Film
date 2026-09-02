-- Top films perso (v2.3, retour utilisateur : "un top films comme
-- Letterboxd, mis en avant par choix pas par note") — tmdb_id choisis à la
-- main, dans l'ordre voulu, au plus 4 ; résolu par get_public_profile() plus
-- bas en rejoignant le catalogue déjà noté du propriétaire (jamais
-- interrogé seul, pas la granularité qui justifierait une table à part —
-- même raisonnement que films.genre_ids, migrations/029).
alter table public.profiles add column if not exists top_films integer[] not null default '{}';
alter table public.profiles add constraint profiles_top_films_max4
  check (array_length(top_films, 1) is null or array_length(top_films, 1) <= 4);

-- get_public_profile() (migrations/016) étendue : tmdb_id ajouté à `films`
-- (rien de sensible — un id TMDB public — permet de rendre les lignes
-- cliquables vers leur fiche, js/filmDetail.js) + nouveau champ `top_films`,
-- résolu dans l'ordre choisi par l'utilisateur (unnest ... with ordinality)
-- plutôt que par note. Chaque colonne est sa propre sous-requête corrélée
-- plutôt qu'un group by commun : `films` (tri par note) et `top_films`
-- (tri par position choisie) n'ont pas le même tri, les mélanger dans un
-- seul jsonb_agg groupé aurait été plus verbeux que deux sous-requêtes
-- indépendantes.
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
