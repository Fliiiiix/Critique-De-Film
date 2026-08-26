// Service worker minimal : met en cache au fil de l'eau ce qui a été
// chargé avec succès (stratégie "réseau, puis repli sur le cache"), pour
// que l'app s'ouvre encore sans réseau après une 1re visite en ligne. Pas
// de liste de fichiers à pré-charger ni à maintenir à la main : chaque
// ?v=N (voir index.html) est une URL différente, donc se met en cache
// tout seul dès la 1re visite après un déploiement — rien à synchroniser
// ici quand ?v=N est bumpé ailleurs. Voir js/offline.js pour
// l'enregistrement et le cache des DONNÉES (films/watchlist/viewings) ;
// ce fichier ne s'occupe que de l'app shell (HTML/CSS/JS).

const CACHE_NAME = 'critique-films-shell-v1';

self.addEventListener('activate', (event) => {
  // Nettoie les caches d'une version antérieure de CE service worker (pas
  // liée au ?v=N de l'app — seulement si sw.js lui-même change de logique
  // un jour et qu'on bump CACHE_NAME ci-dessus).
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return; // jamais les écritures (Supabase POST/PATCH/DELETE...)
  const url = new URL(event.request.url);
  // Seulement l'app elle-même (même origine) : jamais Supabase/TMDB
  // (données vivantes, aucun sens à les servir depuis un cache statique —
  // c'est le rôle du cache localStorage de js/offline.js) ni le CDN
  // supabase-js (déjà mis en cache HTTP par le navigateur comme n'importe
  // quelle ressource externe).
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
