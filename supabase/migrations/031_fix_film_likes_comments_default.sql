-- Corrige un oubli de la migration 030 : contrairement à toutes les autres
-- tables du projet (films, watchlist, tv_shows...), film_likes/
-- film_comments n'avaient pas `default auth.uid()` sur user_id — un
-- insert sans le préciser explicitement échouait avec "new row violates
-- row-level security policy" (auth.uid() = NULL n'est jamais vrai),
-- constaté en test réel. js/filmDetail.js passe désormais user_id
-- explicitement de toute façon, ceci est une correction de cohérence en
-- plus (au cas où un insert futur oublierait de le faire).
alter table public.film_likes alter column user_id set default auth.uid();
alter table public.film_comments alter column user_id set default auth.uid();
