-- Titre original (langue d'origine, renvoyé par TMDB à côté du titre FR)
-- récupéré à l'ajout d'un film, en plus du titre FR déjà stocké dans `title`.
-- Permet à la recherche de matcher aussi bien "créatures féroces" que
-- "fierce creatures" sans traduction automatique — voir js/app.js.
alter table public.films add column original_title text;
alter table public.watchlist add column original_title text;
