-- Fix : "infinite recursion detected in policy for relation group_members"
-- (42P17). La policy SELECT de group_members (migrations/011) interroge
-- group_members depuis sa propre USING clause pour vérifier "est-ce que je
-- suis membre de ce groupe ?" — Postgres réévalue alors la même policy pour
-- chaque ligne scannée par la sous-requête, qui la réévalue à son tour :
-- boucle infinie. Idem pour "groups" qui interroge group_members. Jamais
-- déclenché avant (aucune création de groupe testée par un utilisateur réel
-- avant ce bug), voir js/groups.js.
--
-- Correctif : une fonction SECURITY DEFINER (même pattern que
-- find_user_by_email, migrations/009) qui vérifie l'appartenance en
-- contournant RLS pour sa propre requête interne — plus de récursion.

create or replace function public.is_group_member(p_group_id bigint, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_group_member(bigint, uuid) from public;
grant execute on function public.is_group_member(bigint, uuid) to authenticated;

drop policy "Members can view fellow group members" on public.group_members;
create policy "Members can view fellow group members"
  on public.group_members for select
  using (public.is_group_member(group_id));

drop policy "Members can view their groups" on public.groups;
create policy "Members can view their groups"
  on public.groups for select
  using (public.is_group_member(id));
