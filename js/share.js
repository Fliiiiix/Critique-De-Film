// --- Partage de l'app (v2.1) ---
// QR + lien, accessible discrètement depuis le pied de page (même sans
// connexion — montrer le QR à un proche avant que l'un des deux ait un
// compte a du sens). Utile pour installer Kinet sur un autre appareil
// (le sien ou celui de quelqu'un d'autre) sans faire retaper l'URL à la
// main.
//
// Librairie QR (cdnjs, qrcodejs) chargée seulement au premier clic sur
// "Partager", pas au chargement de la page : la plupart des visites ne
// cliquent jamais dessus, pas la peine d'alourdir tout le monde d'une
// requête réseau en plus pour ça — même raisonnement que le lazy-load
// déjà en place ailleurs dans l'app (offline, TMDB...).

const SHARE_URL = 'https://fliiiiix.github.io/Critique-De-Film/';
let qrLibraryPromise = null;

function loadQrLibrary(){
  if(window.QRCode) return Promise.resolve();
  if(!qrLibraryPromise){
    qrLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return qrLibraryPromise;
}

async function openShareModal(){
  document.getElementById('shareLinkText').textContent = SHARE_URL.replace(/^https?:\/\//, '');
  openOverlay('shareOverlay');
  const qrEl = document.getElementById('shareQrCode');
  if(qrEl.childElementCount) return; // déjà généré une première fois, pas la peine de regénérer à chaque ouverture
  try{
    await loadQrLibrary();
    new QRCode(qrEl, {
      text: SHARE_URL,
      width: 156,
      height: 156,
      colorDark: '#0f0e16',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }catch(e){
    qrEl.innerHTML = `<div class="empty-state">QR indisponible. Le lien reste juste en dessous.</div>`;
    console.error(e);
  }
}

function closeShareModal(){
  closeOverlay('shareOverlay');
}

document.getElementById('shareBtn').addEventListener('click', openShareModal);
document.getElementById('closeShare').addEventListener('click', closeShareModal);
document.getElementById('shareOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'shareOverlay') closeShareModal();
});
document.getElementById('copyShareLink').addEventListener('click', async () => {
  try{
    await navigator.clipboard.writeText(SHARE_URL);
    showToast('Lien copié');
  }catch(e){
    showToast('Impossible de copier, sélectionne le lien à la main');
    console.error(e);
  }
});
