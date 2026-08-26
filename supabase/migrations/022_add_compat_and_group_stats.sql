-- v1.6, phase 4 : compatibilité ciné entre deux amis + stats de groupe
-- ("Goûts du groupe"). Voir js/friends.js (openFriendProfile) et
-- js/groups.js (renderGroupDetail).
--
-- Décision confirmée avec l'utilisateur : un film n'apparaît dans les stats
-- de groupe qu'à partir de 2 notes (having count(*) >= 2) — les membres
-- d'un groupe, contrairement aux amis, n'ont normalement aucun accès en
-- lecture au catalogue individuel des autres ; exposer un film noté par une
-- seule personne reviendrait de fait à révéler sa note à tout le groupe.

-- --- Compatibilité ciné : moyenne des écarts de note sur les films notés
-- par les deux (recoupés par tmdb_id, comme les tops/recommandations) ---
-- Vérifie l'amitié acceptée via un CTE qui reste vide si ce n'est pas le
-- cas (même gabarit que get_public_profile, migrations/016) : le WHERE
-- exists(...) qui en dépend élimine alors toutes les lignes AVANT
-- l'agrégation, donc la fonction ne peut jamais exposer de comparaison de
-- notes entre deux comptes qui ne sont pas amis, même si elle lit les deux
-- catalogues en interne (SECURITY DEFINER, contournement RLS assumé).
create or replace function public.get_friend_compatibility(p_friend_id uuid)
returns table(compatibility numeric, common_count integer)
language sql
security definer
set search_path = public
stable
as $func$
  with ok as (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = p_friend_id)
        or (addressee_id = auth.uid() and requester_id = p_friend_id))
  ),
  mine as (
    select tmdb_id, coalesce(manual_note, (
      select round(avg(v.value::numeric) * 10) / 2
      from jsonb_each_text(crit) as v
    )) as note
    from public.films where user_id = auth.uid() and tmdb_id is not null
  ),
  theirs as (
    select tmdb_id, coalesce(manual_note, (
      select round(avg(v.value::numeric) * 10) / 2
      from jsonb_each_text(crit) as v
    )) as note
    from public.films where user_id = p_friend_id and tmdb_id is not null
  )
  select
    round(100 * (1 - avg(abs(m.note - t.note)) / 5), 1) as compatibility,
    count(*)::integer as common_count
  from mine m
  join theirs t on t.tmdb_id = m.tmdb_id
  where exists (select 1 from ok);
$func$;

revoke all on function public.get_friend_compatibility(uuid) from public;
grant execute on function public.get_friend_compatibility(uuid) to authenticated;

-- --- Stats de groupe : films aimés par au moins 2 membres du groupe ---
-- Même garde-fou que get_group_invite_preview côté appartenance : le
-- `and public.is_group_member(p_group_id)` dans le WHERE élimine toutes
-- les lignes si l'appelant n'est pas membre, avant l'agrégation.
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
  join public.group_members gm on gm.user_id = f.user_id and gm.group_id = p_group_id
  where f.tmdb_id is not null
    and public.is_group_member(p_group_id)
  group by f.tmdb_id
  having count(*) >= 2
  order by avg_note desc, rating_count desc
  limit p_limit;
$func$;

revoke all on function public.get_group_top_films(bigint, int) from public;
grant execute on function public.get_group_top_films(bigint, int) to authenticated;
