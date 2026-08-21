-- Groupes (famille/amis) : le créateur devient automatiquement membre
-- (trigger), peut ajouter n'importe lequel de ses amis acceptés (voir
-- migrations/009) directement — pas de flux invitation/acceptation séparé
-- pour ce premier jet, la relation d'amitié fait déjà office de consentement.
-- Voir js/groups.js. Sert de base à la prochaine brique (propositions de
-- films, discussion, vote) qui viendra référencer group_members pour la
-- visibilité.

create table public.groups (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create table public.group_members (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint group_members_unique unique (group_id, user_id)
);

alter table public.group_members enable row level security;

-- --- groups ---

create policy "Members can view their groups"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid()
    )
  );

create policy "Users can create groups"
  on public.groups for insert
  with check (owner_id = auth.uid());

create policy "Owner can update group"
  on public.groups for update
  using (owner_id = auth.uid());

create policy "Owner can delete group"
  on public.groups for delete
  using (owner_id = auth.uid());

-- --- group_members ---
-- Un membre voit les autres membres des groupes dont il fait partie
-- (auto-référence classique et sûre : la sous-requête ne porte que sur
-- "suis-je déjà membre de ce group_id", pas de récursion).

create policy "Members can view fellow group members"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Owner can add members"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "Owner or self can remove a member"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- --- Auto-ajout du créateur comme membre ---
-- SECURITY DEFINER pour ne pas dépendre de la policy insert (qui vérifie de
-- toute façon la même condition, mais autant ne pas en dépendre pour un
-- bootstrap qui doit marcher à tous les coups).

create or replace function public.add_group_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

create trigger trg_add_group_owner_as_member
  after insert on public.groups
  for each row execute function public.add_group_owner_as_member();
