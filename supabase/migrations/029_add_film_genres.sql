-- Genres (v2.1, retour utilisateur : filtre par genre) — voir js/data.js
-- (GENRE_MAP, id TMDB -> libellé FR) et js/tmdb.js (genre_ids déjà renvoyé
-- tel quel par /search/movie, aucun appel supplémentaire nécessaire à
-- l'ajout d'un nouveau film). integer[] plutôt qu'une table de jointure :
-- un film a peu de genres (2-3 en moyenne), jamais interrogé autrement que
-- "en contient-il un tel" côté client (js/app.js, render()) — pas besoin
-- d'un vrai modèle relationnel pour ça.
alter table public.films add column genre_ids integer[];

-- Backfill des films déjà en base (ajoutés avant cette colonne, ou sans
-- fiche TMDB) : voir supabase/scripts/backfill-genres.js, même gabarit que
-- backfill-original-title.js (migrations/008) — un appel TMDB par film,
-- à lancer depuis la console du navigateur une fois connecté.
