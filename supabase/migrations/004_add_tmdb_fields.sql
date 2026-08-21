-- Métadonnées TMDB (affiche, résumé, année) récupérées à l'ajout d'un film.
alter table public.films add column tmdb_id integer;
alter table public.films add column poster_url text;
alter table public.films add column overview text;
alter table public.films add column release_year integer;
