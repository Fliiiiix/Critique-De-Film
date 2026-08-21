-- Ajoute la possibilité de noter un film manuellement (note sur 5 directe),
-- en bypassant la grille de 7 critères — pour les films déjà notés avec un
-- référentiel différent qu'on ne veut pas refaire passer dans la nouvelle grille.
-- À exécuter dans Supabase → SQL Editor (projet déjà existant).

alter table public.films add column manual_note numeric;
