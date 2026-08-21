// Clé API TMDB (v3 auth) — themoviedb.org (compte gratuit) → menu profil →
// Paramètres → API → Créer une clé.
//
// Comme la clé anon Supabase, celle-ci est faite pour tourner côté client
// (recherche en lecture seule) — ce n'est pas un secret serveur. Reste
// soumise aux limites de débit du compte gratuit TMDB, largement
// suffisantes pour un usage personnel.
//
// Placeholder volontairement inoffensif : sans clé valide, la recherche
// TMDB échoue proprement (message d'erreur affiché) sans casser le reste
// de l'app.
const TMDB_API_KEY = 'REMPLACE_MOI';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w342';
