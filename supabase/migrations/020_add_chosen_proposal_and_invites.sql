-- v1.6, phase 2 : "séance élue" (le créateur du groupe marque une
-- proposition comme le prochain film à voir, avec une date optionnelle) +
-- lien d'invitation de groupe. Voir js/proposals.js, js/groups.js,
-- js/invites.js.
--
-- Décisions confirmées avec l'utilisateur : le lien d'invitation ne fait
-- QUE rejoindre le groupe (jamais l'amitié automatiquement — devenir ami
-- ouvre l'accès en lecture à tout le catalogue, trop pour un simple clic
-- sur un lien) ; seul le créateur du groupe peut générer un lien.

-- --- Séance élue ---
alter table public.group_proposals
  add column chosen boolean not null default false,
  add column chosen_at timestamptz,
  add column watch_date date;

-- Un seul film "élu" à la fois par groupe (index partiel plutôt qu'une
-- colonne à part sur `groups`, qui obligerait une transaction séparée pour
-- rester cohérente avec cette table).
create unique index group_proposals_one_chosen on public.group_proposals(group_id) where chosen;

-- SECURITY DEFINER : owner-only vérifié en dur dans la fonction (pas une
-- policy UPDATE dédiée, pour garder l'unset-puis-set atomique dans la même
-- transaction et éviter une course contre l'index partiel unique
-- ci-dessus). Log aussi l'événement dans activity_events (migrations/019).
create or replace function public.set_chosen_proposal(p_group_id bigint, p_proposal_id bigint, p_watch_date date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'not group owner';
  end if;

  update public.group_proposals set chosen = false, chosen_at = null, watch_date = null
    where group_id = p_group_id and chosen = true;
  update public.group_proposals set chosen = true, chosen_at = now(), watch_date = p_watch_date
    where id = p_proposal_id and group_id = p_group_id;

  insert into public.activity_events (scope, actor_id, group_id, event_type, target_label, target_poster_url, created_at)
  select 'group', auth.uid(), group_id, 'proposal_chosen', title, poster_url, now()
  from public.group_proposals where id = p_proposal_id and group_id = p_group_id;
end;
$$;

revoke all on function public.set_chosen_proposal(bigint, bigint, date) from public;
grant execute on function public.set_chosen_proposal(bigint, bigint, date) to authenticated;

create or replace function public.unset_chosen_proposal(p_group_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'not group owner';
  end if;

  update public.group_proposals set chosen = false, chosen_at = null, watch_date = null
    where group_id = p_group_id and chosen = true;
end;
$$;

revoke all on function public.unset_chosen_proposal(bigint) from public;
grant execute on function public.unset_chosen_proposal(bigint) to authenticated;

-- --- Lien d'invitation de groupe ---
-- pgcrypto pour gen_random_uuid() — quasi toujours déjà actif sur un projet
-- Supabase (auth.users en dépend), "if not exists" par prudence uniquement.
create extension if not exists pgcrypto;

create table public.group_invites (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0
);

alter table public.group_invites enable row level security;

-- Owner seul, en lecture comme en écriture (créer/lister/révoquer) — même
-- gabarit que "Owner can add members" (migrations/011).
create policy "Owner can manage invites"
  on public.group_invites for all
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

-- Aperçu avant connexion : doit marcher sans session, comme
-- get_public_profile (migrations/016) — ne renvoie que de quoi afficher
-- "tu es invité·e à rejoindre X", jamais les colonnes internes de l'invite.
create or replace function public.get_group_invite_preview(p_token uuid)
returns table(group_id bigint, group_name text, valid boolean)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.name,
    (gi.expires_at is null or gi.expires_at > now())
      and (gi.max_uses is null or gi.use_count < gi.max_uses) as valid
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.token = p_token;
$$;

revoke all on function public.get_group_invite_preview(uuid) from public;
grant execute on function public.get_group_invite_preview(uuid) to anon, authenticated;

-- Rejoindre : connecté uniquement. N'ajoute QUE group_members (jamais
-- friendships, décision confirmée) — l'insertion déclenche déjà
-- trg_log_group_joined (migrations/019), pas besoin de logger l'activité
-- ici en plus. "on conflict do nothing" : rouvrir son propre lien une fois
-- déjà membre ne doit pas planter ni créer de doublon.
create or replace function public.accept_group_invite(p_token uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id bigint;
  v_ok boolean;
begin
  select gi.group_id,
    (gi.expires_at is null or gi.expires_at > now()) and (gi.max_uses is null or gi.use_count < gi.max_uses)
  into v_group_id, v_ok
  from public.group_invites gi where gi.token = p_token;

  if v_group_id is null or not v_ok then
    return null;
  end if;

  insert into public.group_members (group_id, user_id) values (v_group_id, auth.uid())
    on conflict (group_id, user_id) do nothing;
  update public.group_invites set use_count = use_count + 1 where token = p_token;

  return v_group_id;
end;
$$;

revoke all on function public.accept_group_invite(uuid) from public;
grant execute on function public.accept_group_invite(uuid) to authenticated;
