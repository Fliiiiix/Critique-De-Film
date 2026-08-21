-- Amis : demande / acceptation, et visibilité croisée du catalogue noté
-- (lecture seule) une fois amis. Voir js/friends.js.

-- Élargit la lecture de `profiles` à tout utilisateur connecté — nécessaire
-- pour chercher un ami par pseudo et afficher pseudo/avatar dans les listes
-- de demandes/amis. Ne concerne que display_name/avatar_url : la table ne
-- contient pas l'email, qui reste protégé (voir find_user_by_email ci-dessous).
create policy "Authenticated users can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create table public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id),
  -- N'empêche qu'un doublon dans le même sens ; deux demandes croisées
  -- (A→B et B→A) sont résolues côté app en acceptation automatique,
  -- voir sendFriendRequest() dans js/friends.js.
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Users can view their friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- Seul le destinataire peut faire passer une demande de pending à
-- accepted/declined (le demandeur ne peut pas s'auto-accepter).
create policy "Addressee can respond to a request"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Les deux côtés peuvent supprimer la ligne : annuler une demande envoyée,
-- refuser en la retirant plutôt qu'en la marquant declined, ou se désamis.
create policy "Either side can remove a friendship"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Une fois amis (accepted), on peut voir le catalogue noté de l'autre —
-- lecture seule : aucune policy insert/update/delete n'est ouverte ici,
-- celles de la migration initiale restent strictement scopées à user_id.
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

-- Recherche d'un ami par email exact sans exposer auth.users côté client :
-- SECURITY DEFINER, ne renvoie que user_id/pseudo/avatar sur correspondance
-- EXACTE (pas de LIKE, pas d'énumération en masse possible).
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
