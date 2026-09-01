// --- Installation en app (PWA, v2.0.7, v2.0.8, entête v2.1) ---
// Kinet est installable comme une vraie application — téléphone (Android/
// iOS) et PC (Chrome/Edge) — sans passer par un store, en s'appuyant sur
// le manifest (manifest.json) et le service worker déjà enregistré pour le
// mode hors ligne (sw.js, voir js/offline.js). Trois surfaces pilotées
// d'ici : #installSection (modale profil, référence permanente une fois
// qu'on sait où la trouver), #installBanner (v2.0.8, bandeau pleine
// largeur hors des conteneurs auth/app — visible immédiatement, y compris
// sur l'écran de connexion avant tout compte) et #installHeaderBtn (v2.1,
// icône d'entête — accès direct sans ouvrir le profil, demande explicite).

let deferredInstallPrompt = null;

function isStandaloneDisplay(){
  // navigator.standalone : propriété historique Safari iOS, jamais
  // standardisée mais toujours le seul moyen fiable d'y détecter le mode
  // installé — matchMedia('display-mode: standalone') n'y fonctionne pas.
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOSDevice(){
  // iPadOS 13+ se présente en desktop (Macintosh) mais avec un écran
  // tactile — MSStream exclu (IE11 sur Windows Phone partageait autrefois
  // ce user-agent iPhone-like, précaution qui ne coûte rien).
  const isIOSUA = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return (isIOSUA || isIPadOS13Plus) && !window.MSStream;
}

// Chrome/Edge annoncent l'installabilité via cet évènement plutôt qu'un
// bouton toujours affiché — preventDefault() + stockage pour le déclencher
// nous-mêmes depuis #installSection, quand l'utilisateur le décide,
// plutôt que la mini-barre d'adresse automatique du navigateur.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallUI();
  updateInstallBanner();
  updateInstallHeaderBtn();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUI();
  updateInstallBanner();
  updateInstallHeaderBtn();
  showToast('Kinet installé 🎉');
  logEvent('pwa_install'); // voir js/logging.js, section "Croissance" de l'onglet admin
});

async function handleInstallClick(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice; // { outcome: 'accepted' | 'dismissed' }
  // Un choix (accepté ou refusé) consomme l'évènement : Chrome n'en
  // redonne pas un identique tant que rien n'a changé côté app/navigateur.
  deferredInstallPrompt = null;
  updateInstallUI();
  updateInstallBanner();
  updateInstallHeaderBtn();
}

// Appelée à l'ouverture de la modale profil (js/profile.js) et par les
// deux évènements ci-dessus — reconstruit #installSectionContent selon
// l'état courant plutôt que de le supposer figé depuis le chargement de
// la page (le prompt natif peut apparaître après coup).
function updateInstallUI(){
  const el = document.getElementById('installSectionContent');
  if(!el) return;

  if(isStandaloneDisplay()){
    el.innerHTML = `<div class="wl-note">✓ Déjà installée sur cet appareil.</div>`;
    return;
  }

  if(deferredInstallPrompt){
    el.innerHTML = `
      <div class="wl-note">Ajoute Kinet à ton écran d'accueil ou ton bureau. Ça s'ouvre comme une vraie app, plein écran, sans passer par le navigateur.</div>
      <button class="btn secondary" id="installNowBtn" type="button">📲 Installer l'app</button>
    `;
    document.getElementById('installNowBtn').addEventListener('click', handleInstallClick);
    return;
  }

  if(isIOSDevice()){
    el.innerHTML = `<div class="wl-note">Sur iPhone/iPad : bouton <b>Partager</b> de Safari (le carré avec la flèche vers le haut), puis <b>Sur l'écran d'accueil</b>.</div>`;
    return;
  }

  // Ni prompt natif ni iOS : soit un navigateur sans support (Firefox
  // desktop, par ex.), soit un Chrome/Edge qui n'a pas encore jugé le site
  // "installable" (le prompt met parfois quelques instants/visites à
  // apparaître) — un message générique plutôt qu'un bouton mort.
  el.innerHTML = `<div class="wl-note">Ton navigateur ne propose pas encore l'installation ici. Essaie avec Chrome ou Edge (téléphone ou PC), ou reviens dans quelques instants.</div>`;
}

// --- Bandeau d'installation (#installBanner, v2.0.8) ---
// Pleine largeur, hors des conteneurs auth/app (voir index.html) : rendu
// prioritaire par rapport à #installSection ci-dessus, qu'on ne trouve
// qu'en ouvrant la modale profil — celui-ci se voit tout de suite, y
// compris sur l'écran de connexion avant d'avoir un compte. Ne s'affiche
// QUE quand une installation a effectivement un sens ici (pas déjà
// installée, prompt natif dispo OU iOS avec ses instructions manuelles) —
// jamais de bouton mort. Fermeture mémorisée le temps de la session
// (sessionStorage, pas localStorage) : assez pour ne pas harceler une
// fois fermé, mais réapparaît à la prochaine vraie visite plutôt que de
// disparaître pour de bon sur un clic accidentel — cohérent avec la
// demande explicite d'une installation "très visible".
const INSTALL_BANNER_DISMISS_KEY = 'kinetInstallBannerDismissed';

function updateInstallBanner(){
  const banner = document.getElementById('installBanner');
  if(!banner) return;

  if(isStandaloneDisplay() || sessionStorage.getItem(INSTALL_BANNER_DISMISS_KEY) === '1'){
    banner.style.display = 'none';
    return;
  }

  const subEl = document.getElementById('installBannerSub');
  const btn = document.getElementById('installBannerBtn');

  if(deferredInstallPrompt){
    subEl.textContent = 'Comme une vraie app, en un geste : téléphone ou PC.';
    btn.style.display = '';
    banner.style.display = '';
    return;
  }

  if(isIOSDevice()){
    subEl.textContent = "Bouton Partager de Safari, puis \"Sur l'écran d'accueil\".";
    btn.style.display = 'none';
    banner.style.display = '';
    return;
  }

  // Ni prompt natif ni iOS : rien de concret à proposer ici (voir
  // updateInstallUI() ci-dessus pour le même raisonnement) — le bandeau
  // reste masqué plutôt que d'afficher un message sans action possible,
  // contrairement à #installSection qui elle reste toujours consultable
  // depuis la modale profil.
  banner.style.display = 'none';
}

document.getElementById('installBannerBtn').addEventListener('click', handleInstallClick);
document.getElementById('installBannerDismiss').addEventListener('click', () => {
  sessionStorage.setItem(INSTALL_BANNER_DISMISS_KEY, '1');
  updateInstallBanner();
});

// --- Icône d'entête (#installHeaderBtn, v2.1) ---
// Même logique de visibilité que #installBanner (masquée si déjà
// installée ou si rien de concret à proposer — jamais de bouton mort),
// mais SANS la mémoire de fermeture de session : contrairement au
// bandeau (une relance ponctuelle qu'on peut vouloir ignorer un moment),
// c'est un accès permanent au même titre que Watchlist/Amis/Top juste à
// côté — un utilisateur qui l'a fermé une fois ne doit pas perdre le
// moyen d'installer plus tard.
function updateInstallHeaderBtn(){
  const btn = document.getElementById('installHeaderBtn');
  if(!btn) return;
  btn.style.display = (!isStandaloneDisplay() && (deferredInstallPrompt || isIOSDevice())) ? '' : 'none';
}

// Prompt natif dispo : un seul clic suffit, comme les 2 autres surfaces.
// iOS n'a pas de prompt déclenchable en JS (Safari ne l'expose pas) —
// mêmes instructions manuelles qu'ailleurs, en toast plutôt qu'en modale
// pour un simple rappel qu'on connaît déjà en général la 2e fois.
document.getElementById('installHeaderBtn').addEventListener('click', () => {
  if(deferredInstallPrompt) handleInstallClick();
  else if(isIOSDevice()) showToast("Bouton Partager de Safari, puis \"Sur l'écran d'accueil\"");
});

// Premier calcul au chargement : iOS n'a pas d'évènement à attendre
// (isIOSDevice() est vrai ou faux dès le départ), donc sans cet appel le
// bandeau resterait masqué indéfiniment sur iPhone/iPad tant qu'aucun
// beforeinstallprompt ne se déclenche — ce qui n'arrive jamais là-bas.
updateInstallBanner();
updateInstallHeaderBtn();
