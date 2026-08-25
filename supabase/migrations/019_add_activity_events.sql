-- Fil d'activité (Amis + Groupes) — v1.6. Voir js/activity.js. Une seule
-- table pour les deux portées (`scope`), plutôt que deux mécanismes séparés :
-- "note de film" (portée amis, ajoutée en migrations/021) n'a aucun
-- horodatage serveur fiable ailleurs (films.added est une horloge CLIENT,
-- falsifiable, jamais à utiliser pour un flux inter-utilisateurs) — il faut
-- de toute façon un event log alimenté par trigger pour ce cas-là. Une fois
-- ce mécanisme en place, y faire aussi transiter les événements de groupe
-- évite d'avoir deux formes de pagination/"non lu" pour la même idée.
--
-- Aucune ligne n'est jamais insérée par le client (pas de policy insert
-- pour `authenticated`) : tout passe par des fonctions trigger SECURITY
-- DEFINER, même gabarit que add_group_owner_as_member (migrations/011).
-- Lignes dénormalisées (titre/affiche copiés à l'écriture) plutôt qu'un FK
-- polymorphe vers films/group_proposals/group_proposal_comments (impossible
-- proprement en SQL) — un événement qui référence une proposition depuis
-- supprimée reste donc visible, accepté vu qu'aucune table de l'app ne fait
-- de suppression douce non plus.
create table public.activity_events (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('friend', 'group')),
  actor_id uuid not null references auth.users(id) on delete cascade,
  group_id bigint references public.groups(id) on delete cascade, -- null si scope='friend'
  event_type text not null check (event_type in (
    'proposal_created', 'proposal_commented', 'proposal_chosen', 'group_joined'
    -- 'film_rated' ajouté par migrations/021 (portée friend)
  )),
  target_label text,
  target_poster_url text,
  target_note numeric,
  created_at timestamptz not null default now()
);

alter table public.activity_events enable row level security;

-- Portée "group" : visible par tout membre du groupe concerné, même gabarit
-- que les autres tables scopées par groupe (is_group_member, migrations/013,
-- contourne RLS en interne — pas de récursion possible ici puisque
-- activity_events ne s'auto-référence jamais).
-- Portée "friend" : visible par l'auteur lui-même, et par ses amis acceptés
-- — même sous-requête que "Friends can view shared films" (migrations/009).
create policy "Visible activity events"
  on public.activity_events for select
  using (
    (scope = 'group' and group_id is not null and public.is_group_member(group_id))
    or (scope = 'friend' and (
      actor_id = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = auth.uid() and f.addressee_id = activity_events.actor_id)
            or (f.addressee_id = auth.uid() and f.requester_id = activity_events.actor_id))
      )
    ))
  );

-- --- Trigger : une proposition est créée ---
create or replace function public.log_proposal_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (scope, actor_id, group_id, event_type, target_label, target_poster_url, created_at)
  values ('group', new.proposed_by, new.group_id, 'proposal_created', new.title, new.poster_url, new.created_at);
  return new;
end;
$$;

create trigger trg_log_proposal_created
  after insert on public.group_proposals
  for each row execute function public.log_proposal_created();

-- --- Trigger : un commentaire est posté sur une proposition ---
-- group_proposal_comments n'a pas de group_id direct : on le retrouve via
-- la proposition (comme le font déjà les policies RLS de cette table).
create or replace function public.log_proposal_commented()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id bigint;
  v_title text;
  v_poster_url text;
begin
  select gp.group_id, gp.title, gp.poster_url into v_group_id, v_title, v_poster_url
  from public.group_proposals gp where gp.id = new.proposal_id;

  insert into public.activity_events (scope, actor_id, group_id, event_type, target_label, target_poster_url, created_at)
  values ('group', new.user_id, v_group_id, 'proposal_commented', v_title, v_poster_url, new.created_at);
  return new;
end;
$$;

create trigger trg_log_proposal_commented
  after insert on public.group_proposal_comments
  for each row execute function public.log_proposal_commented();

-- --- Trigger : un membre rejoint un groupe ---
-- Couvre aussi le créateur (ajouté par add_group_owner_as_member,
-- migrations/011) : c'est un vrai "a rejoint" pour le fil du groupe, sert de
-- tout premier événement visible dans un groupe fraîchement créé.
create or replace function public.log_group_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (scope, actor_id, group_id, event_type, created_at)
  values ('group', new.user_id, new.group_id, 'group_joined', new.joined_at);
  return new;
end;
$$;

create trigger trg_log_group_joined
  after insert on public.group_members
  for each row execute function public.log_group_joined();

-- --- Backfill ponctuel : historique déjà existant ---
-- Pour que les groupes déjà créés n'aient pas l'air morts au déploiement.
-- Utilise les created_at/joined_at déjà serveur des tables sources (jamais
-- films.added, voir plus haut) — exécuté une seule fois, ici, à la création
-- de la table (pas de risque de doublon : les triggers ci-dessus ne
-- couvrent que les INSERT à venir).
insert into public.activity_events (scope, actor_id, group_id, event_type, target_label, target_poster_url, created_at)
select 'group', gp.proposed_by, gp.group_id, 'proposal_created', gp.title, gp.poster_url, gp.created_at
from public.group_proposals gp;

insert into public.activity_events (scope, actor_id, group_id, event_type, target_label, target_poster_url, created_at)
select 'group', c.user_id, gp.group_id, 'proposal_commented', gp.title, gp.poster_url, c.created_at
from public.group_proposal_comments c
join public.group_proposals gp on gp.id = c.proposal_id;

insert into public.activity_events (scope, actor_id, group_id, event_type, created_at)
select 'group', gm.user_id, gm.group_id, 'group_joined', gm.joined_at
from public.group_members gm;
