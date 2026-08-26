-- v1.6, phase 3 : fil d'activité côté "amis" (notes de films) + suggestions
-- d'amis (amis d'amis) + recommandations croisées (films aimés par mon
-- cercle que je n'ai pas encore notés). Voir js/friends.js.
--
-- Pas de backfill pour 'film_rated' (à la différence de migrations/019) :
-- films.added est une horloge CLIENT, jamais fiable pour ordonner un flux
-- inter-utilisateurs — le fil ne peut commencer qu'à partir d'ici, les notes
-- plus anciennes n'y apparaîtront jamais. Accepté, mentionné à l'utilisateur.

-- --- Élargit le type d'événement pour couvrir une note de film ---
alter table public.activity_events drop constraint if exists activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check
  check (event_type in ('proposal_created', 'proposal_commented', 'proposal_chosen', 'group_joined', 'film_rated'));

-- --- Trigger : un film est noté (nouvelle ligne, pas une modification —
-- une note qui change sur un film déjà noté ne redéclenche rien, pour
-- éviter le bruit d'un ajustement mineur) ---
create or replace function public.log_film_rated()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_note numeric;
begin
  v_note := coalesce(new.manual_note, (
    select round(avg(v.value::numeric) * 10) / 2
    from jsonb_each_text(new.crit) as v
  ));
  insert into public.activity_events (scope, actor_id, group_id, event_type, target_label, target_poster_url, target_note, created_at)
  values ('friend', new.user_id, null, 'film_rated', new.title, new.poster_url, v_note, new.created_at);
  return new;
end;
$func$;

create trigger trg_log_film_rated
  after insert on public.films
  for each row execute function public.log_film_rated();

-- --- Suggestions d'amis : amis de mes amis, pas déjà amis / en attente ---
-- Le cas "profils existants qu'on n'a encore jamais ajoutés" (nouvel
-- utilisateur sans ami commun) ne demande aucune fonction ici : profiles
-- est déjà lisible par tout compte connecté (migrations/009), une requête
-- client simple suffit — voir loadFriendSuggestions() dans js/friends.js.
create or replace function public.get_friend_suggestions(p_limit int default 10)
returns table(user_id uuid, display_name text, avatar_url text, mutual_count integer)
language sql
security definer
set search_path = public
stable
as $func$
  with my_friends as (
    select addressee_id as uid from public.friendships
      where requester_id = auth.uid() and status = 'accepted'
    union
    select requester_id as uid from public.friendships
      where addressee_id = auth.uid() and status = 'accepted'
  ),
  candidates as (
    select f.addressee_id as uid from public.friendships f
      join my_friends mf on mf.uid = f.requester_id
      where f.status = 'accepted'
    union all
    select f.requester_id as uid from public.friendships f
      join my_friends mf on mf.uid = f.addressee_id
      where f.status = 'accepted'
  )
  select c.uid, p.display_name, p.avatar_url, count(*)::integer as mutual_count
  from candidates c
  join public.profiles p on p.user_id = c.uid
  where c.uid <> auth.uid()
    and c.uid not in (select uid from my_friends)
    and not exists (
      select 1 from public.friendships f
      where f.status = 'pending'
        and ((f.requester_id = auth.uid() and f.addressee_id = c.uid)
          or (f.addressee_id = auth.uid() and f.requester_id = c.uid))
    )
  group by c.uid, p.display_name, p.avatar_url
  order by mutual_count desc
  limit p_limit;
$func$;

revoke all on function public.get_friend_suggestions(int) from public;
grant execute on function public.get_friend_suggestions(int) to authenticated;

-- --- Recommandations croisées : films aimés (>=4) par mon cercle, que je
-- n'ai pas encore notés --- même gabarit que get_friends_top_films
-- (migrations/015), mais exclut mon propre catalogue et applique un seuil.
create or replace function public.get_friend_recommendations(p_limit int default 20)
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
  with my_circle as (
    select auth.uid() as uid
    union
    select addressee_id from public.friendships
      where requester_id = auth.uid() and status = 'accepted'
    union
    select requester_id from public.friendships
      where addressee_id = auth.uid() and status = 'accepted'
  ),
  mine as (
    select tmdb_id from public.films where user_id = auth.uid() and tmdb_id is not null
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
  join my_circle mc on mc.uid = f.user_id and mc.uid <> auth.uid()
  where f.tmdb_id is not null
    and f.tmdb_id not in (select tmdb_id from mine)
  group by f.tmdb_id
  having avg(coalesce(f.manual_note, (
      select round(avg(v.value::numeric) * 10) / 2
      from jsonb_each_text(f.crit) as v
    ))) >= 4
  order by avg_note desc, rating_count desc
  limit p_limit;
$func$;

revoke all on function public.get_friend_recommendations(int) from public;
grant execute on function public.get_friend_recommendations(int) to authenticated;
