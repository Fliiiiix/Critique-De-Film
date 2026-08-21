-- Fix : "new row violates row-level security policy for table groups"
-- (42501) à la création d'un groupe, révélé une fois migrations/013
-- appliquée (qui a corrigé la récursion mais pas ce second bug, masqué par
-- le premier). La policy SELECT de "groups" (is_group_member(id)) dépend de
-- group_members, mais le trigger qui y ajoute le créateur (migrations/011)
-- est un trigger AFTER ROW classique : il s'exécute à la fin de la requête,
-- après que Postgres a déjà évalué la policy SELECT pour la ligne renvoyée
-- par le RETURNING de l'insert (js/groups.js fait .insert().select()). Au
-- moment de ce check, le créateur n'est donc pas encore membre → refus.
--
-- Correctif : le propriétaire voit toujours son propre groupe directement
-- par owner_id, sans dépendre de group_members ni du timing du trigger.

drop policy "Members can view their groups" on public.groups;
create policy "Members can view their groups"
  on public.groups for select
  using (owner_id = auth.uid() or public.is_group_member(id));
