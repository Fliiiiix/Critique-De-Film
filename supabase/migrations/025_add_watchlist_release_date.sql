-- Date de sortie complète (pas juste l'année) pour les items de la
-- watchlist ayant une fiche TMDB — nécessaire à la section Prochaines
-- sorties (js/upcoming.js) pour trier "Bientôt" par proximité réelle,
-- pas seulement par année. Additive, nullable, sans backfill : les items
-- déjà en watchlist gardent release_date à null (ils continuent
-- d'afficher juste l'année, comme avant) et sont ignorés par l'agrégation
-- "Bientôt" plutôt que de fausser le tri avec une date absente.
alter table public.watchlist add column release_date date;
