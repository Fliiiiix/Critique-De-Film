// --- Mode hors ligne (lecture seule) ---
// Repose sur deux mécanismes complémentaires :
// 1. Un service worker (sw.js, enregistré plus bas) qui met en cache l'app
//    shell (HTML/CSS/JS) au fil des visites en ligne, pour que la page
//    elle-même s'ouvre encore sans réseau — sans lui, le cache de données
//    ci-dessous ne servirait à rien puisque le navigateur ne pourrait même
//    pas charger index.html/js/*.js en premier lieu.
// 2. Un cache localStorage des dernières listes chargées avec succès
//    (films/watchlist/viewings), utilisé en repli quand une requête
//    Supabase échoue — voir loadFilms()/loadViewings()/loadWatchlist().
//
// Explicitement lecture seule (décision confirmée) : noter/modifier reste
// bloqué tant que le réseau n'est pas revenu (blockIfOffline(), appelé
// depuis les points d'entrée d'écriture du catalogue/watchlist) — pas de
// file d'attente à synchroniser, pas de gestion de conflits. Les
// fonctionnalités sociales (amis/groupes/propositions...) ne sont PAS
// couvertes : elles supposent du réseau par nature (synchroniser avec
// quelqu'un d'autre), échouent proprement avec le toast d'erreur déjà en
// place si le réseau manque, comme avant cette version.

let isOfflineMode = false;

function offlineCacheKey(name){
  // Une clé par compte : pas de fuite d'un catalogue vers un autre si
  // plusieurs comptes se sont connectés sur le même navigateur.
  return `offlineCache_${name}_${currentUser.id}`;
}

function saveOfflineCache(name, value){
  if(!currentUser) return;
  try{
    localStorage.setItem(offlineCacheKey(name), JSON.stringify({ savedAt: Date.now(), data: value }));
  }catch(e){
    // Quota dépassé ou stockage désactivé (navigation privée...) : le mode
    // hors ligne ne marchera juste pas pour cette liste, pas la peine de
    // bloquer le reste de l'appli pour ça.
    console.error(e);
  }
}

function loadOfflineCache(name){
  if(!currentUser) return null;
  try{
    const raw = localStorage.getItem(offlineCacheKey(name));
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    console.error(e);
    return null;
  }
}

function formatOfflineTimestamp(ms){
  return new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

// savedAt : celui du catalogue (source principale) — passé par loadFilms()
// quand il bascule en repli, seul appelant qui a cette info sous la main.
function enterOfflineMode(savedAt){
  isOfflineMode = true;
  const banner = document.getElementById('offlineBanner');
  banner.textContent = `📴 Hors ligne — dernières données synchronisées le ${formatOfflineTimestamp(savedAt)}. Lecture seule : reconnecte-toi pour noter ou modifier.`;
  banner.style.display = '';
}

function exitOfflineMode(){
  if(!isOfflineMode) return;
  isOfflineMode = false;
  document.getElementById('offlineBanner').style.display = 'none';
  showToast('De retour en ligne');
}

// Garde partagée pour les points d'entrée d'écriture du catalogue/
// watchlist (voir js/app.js, js/watchlist.js) — retourne true (et prévient
// l'utilisateur) si l'action doit être bloquée.
function blockIfOffline(){
  if(!isOfflineMode) return false;
  showToast('Hors ligne — reconnecte-toi pour modifier');
  return true;
}

// Retente un chargement complet quand le navigateur signale un retour de
// connexion — sans ça, l'utilisateur devrait recharger la page à la main
// pour sortir du mode hors ligne même une fois le réseau revenu.
// navigator.onLine n'est qu'un indice (peut rester true sur un réseau
// captif sans vraie sortie internet) : c'est loadFilms() qui tranche pour
// de vrai en retentant une requête réelle.
window.addEventListener('online', () => {
  if(!isOfflineMode || !currentUser) return;
  loadFilms().then(() => { render(); });
  loadViewings();
});

// --- Service worker (app shell) ---
// register() peut échouer silencieusement (navigation privée, navigateur
// sans support...) — dégradation normale, le reste de l'app fonctionne
// pareil, juste sans le filet de secours "page qui s'ouvre sans réseau".
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('Échec de l\'enregistrement du service worker', err));
  });
}
