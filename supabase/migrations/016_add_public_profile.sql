-- Profil partageable : une page publique en lecture seule (#/u/:userId,
-- voir js/publicProfile.js), accessible SANS connexion — nouvelle limite
-- vis-à-vis de tout ce qui a été fait jusqu'ici (Amis, Groupes, Top films)
-- qui exigeaient tous une session. Opt-in par utilisateur, colonne
-- `public_profile` (false par défaut) — la policy "Users can update own
-- profile" existante (schema.sql) couvre déjà sa modification, pas besoin
-- d'une nouvelle policy pour l'écriture.
alter table public.profiles add column if not exists public_profile boolean not null default false;

-- Lue par n'importe qui (anon compris — c'est le but), mais renvoie
-- uniquement pseudo/avatar + un résumé du catalogue (titre/affiche/année/
-- note/favori), jamais l'email ni le commentaire libre (review), et rien
-- du tout si public_profile est resté à false : la CTE `prof` est vide dans
-- ce cas, donc `scored` (via son `exists (select 1 from prof)`) et le
-- résultat final le sont aussi. Pas de distinction "profil inexistant" vs
-- "profil privé" dans la réponse (les deux renvoient 0 ligne) — ne pas
-- laisser deviner qui a un compte.
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
-- anon ET authenticated : un visiteur sans compte doit pouvoir la lire.
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
