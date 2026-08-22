-- Top films : deux classements agrégés (voir js/top.js), accessibles via
-- l'entête (icône 🏅). Le principe est le même que pour Amis (page à part
-- entière) : deux fonctions SECURITY DEFINER qui lisent `films` de TOUT LE
-- MONDE (contournement de RLS assumé et volontaire) mais ne renvoient QUE
-- des agrégats — jamais user_id, review, ni aucune ligne individuelle. Donc
-- pas de fuite de "qui a mis quelle note", même sur un film noté par une
-- seule personne : le principe est le même que pour is_group_member
-- (migrations/013), la fonction lit large en interne mais expose peu.
--
-- Un même film est identifié par son tmdb_id (les films sans fiche TMDB —
-- ajout manuel sans recherche — ne peuvent pas être recoupés entre
-- utilisateurs, donc exclus des deux tops). La note affichée de chaque
-- utilisateur pour un film est recalculée en SQL avec la même formule que
-- computeNote() côté client (js/app.js) : moyenne des 7 critères (0..1),
-- arrondie au demi-point sur 5 — ou manual_note directement si renseignée.

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
-- pas les amis de mes amis). Personnel à chaque appelant (auth.uid()), donc
-- deux personnes n'obtiennent pas le même classement : si j'ai 4 amis, mon
-- top porte sur nous 5 ; si l'un d'eux a 7 amis, le sien porte sur eux 8.
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
