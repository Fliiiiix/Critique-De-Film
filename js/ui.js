// --- Ouverture/fermeture partagée des modales (.overlay > .modal) ---
// Les 7 fenêtres de l'app (édition de film, profil, stats, succès, admin,
// journal, profil d'ami) suivaient chacune le même schéma sans rien
// partager : classList.add/remove('open'), fermeture instantanée. Ouvrir
// avait déjà une animation (overlayIn/modalIn, voir css/style.css) mais
// fermer non — ce module ajoute une fermeture symétrique (overlayOut/
// modalOut) tout en laissant chaque close*() responsable de ses propres
// à-côtés (ex. closeModal() doit toujours faire editingId = null), via le
// paramètre extraCleanup plutôt que de dupliquer cette logique 7 fois.
//
// Animation de fermeture = autonome une fois lancée par le clic (comme
// l'ouverture, la transition de page, le couloir Old Boy) : elle garde
// donc l'exception prefers-reduced-motion déjà en place pour ces cas-là —
// contrairement au pulse étoile/sauvegarde plus bas, piloté en direct par
// le clic et qui n'a jamais cette exception (même règle que le reste de la
// session).

const OVERLAY_CLOSE_MS = 200; // > durée de overlayOut/modalOut (150ms), filet de sécurité si animationend ne se déclenche pas

// --- Focus clavier (accessibilité) ---
// Aucune des 7 modales ne déplaçait le focus à l'ouverture (sauf
// openModal(), qui pointe explicitement sur #titleInput après avoir
// appelé openOverlay() — cet appel plus spécifique gagne simplement en
// s'exécutant après) ni ne le restaurait à la fermeture : un utilisateur
// au clavier/lecteur d'écran restait "perdu" derrière l'overlay, ou son
// focus atterrissait sur un bouton masqué (display:none) une fois la
// modale refermée. overlayReturnFocus retient, PAR modale, l'élément à
// refocaliser à la fermeture — pas une seule variable partagée, sinon
// closeProfileModal() → openAchievements() (voir js/achievements.js)
// écraserait la cible de la première avant que son délai de fermeture ne
// se déclenche, et volerait le focus à la modale ouverte par-dessus.
const overlayReturnFocus = {};

function openOverlay(id){
  const el = document.getElementById(id);
  overlayReturnFocus[id] = document.activeElement;
  el.classList.remove('closing'); // une fermeture pouvait être en cours
  el.classList.add('open');
  const modal = el.querySelector('.modal');
  const focusable = modal && modal.querySelector(
    'input, textarea, select, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  );
  if(focusable) focusable.focus({ preventScroll: true });
}

function closeOverlay(id, extraCleanup){
  const el = document.getElementById(id);
  if(!el.classList.contains('open')){
    // Déjà fermée (ex. deux gestionnaires de clic sur le même bouton) :
    // extraCleanup tourne quand même, closeModal()-like doit rester
    // idempotent.
    if(extraCleanup) extraCleanup();
    return;
  }
  el.classList.remove('open');
  const restoreFocus = () => {
    const target = overlayReturnFocus[id];
    delete overlayReturnFocus[id];
    // offsetParent === null : élément caché (display:none, une autre
    // modale ouverte par-dessus l'a fermé entre-temps) — rien à faire.
    // document.querySelector('.overlay.open') : une AUTRE modale s'est
    // ouverte pendant que celle-ci se refermait (cf. commentaire plus
    // haut) — ne pas lui voler le focus.
    if(target && document.contains(target) && target.offsetParent !== null && !document.querySelector('.overlay.open')){
      target.focus({ preventScroll: true });
    }
  };
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    restoreFocus();
    if(extraCleanup) extraCleanup();
    return;
  }
  el.classList.add('closing');
  let done = false;
  const finish = () => {
    if(done) return;
    done = true;
    el.removeEventListener('animationend', finish);
    el.classList.remove('closing');
    restoreFocus();
    if(extraCleanup) extraCleanup();
  };
  el.addEventListener('animationend', finish);
  setTimeout(finish, OVERLAY_CLOSE_MS);
}

// Échap ferme la modale ouverte, gestionnaire unique plutôt qu'un par
// modale — cohérent avec l'ouverture/fermeture déjà centralisées ici.
// Construit la table à chaque appui plutôt qu'une fois au chargement : les
// close*() référencés ne sont pas encore déclarés quand ce fichier
// s'exécute (il est chargé avant app.js/profile.js/etc., voir index.html)
// — seule leur résolution AU MOMENT du keydown, bien après le chargement
// complet, est sûre.
document.addEventListener('keydown', (e) => {
  if(e.key !== 'Escape') return;
  const closers = {
    overlay: () => closeModal(),
    profileOverlay: () => closeProfileModal(),
    statsOverlay: () => closeStats(),
    achievementsOverlay: () => closeAchievements(),
    adminOverlay: () => closeAdminModal(),
    journalOverlay: () => closeJournal(),
    friendProfileOverlay: () => closeFriendProfile()
  };
  for(const id in closers){
    if(document.getElementById(id).classList.contains('open')){
      closers[id]();
      return; // une seule à la fois : les modales ne s'empilent jamais dans cette app
    }
  }
});

// --- Micro-interactions ponctuelles (étoile favori, sauvegarde) ---
// Pilotées en direct par un clic (pas autonomes/en boucle) : PAS
// d'exception prefers-reduced-motion, voir starPulse/savePulse dans
// css/style.css.
function pulseElement(el){
  if(!el) return;
  el.classList.remove('pulse');
  // Force un reflow pour rejouer l'animation si pulse() est appelé deux
  // fois de suite très vite (ex. double favori/défavori rapide) — sans ça
  // la 2e classList.add('pulse') ne redéclenche rien puisque la classe est
  // déjà présente.
  void el.offsetWidth;
  el.classList.add('pulse');
  el.addEventListener('animationend', () => el.classList.remove('pulse'), { once: true });
}

// --- Bascule grille / liste (catalogue, watchlist, séries, top) ---
// Une seule préférence partagée par toutes les listes à affiches plutôt
// qu'un réglage par page — si quelqu'un préfère scanner en grille ou en
// liste compacte, c'est vrai partout où il y a des affiches, pas juste sur
// le catalogue. Stockée en localStorage (préférence d'affichage pure, pas
// une donnée à synchroniser entre appareils, contrairement à ce que gère
// js/offline.js). Portée par un attribut sur <body> plutôt qu'une classe
// par conteneur de liste : chaque page qui a une liste à affiches (voir
// les sélecteurs body[data-view-mode="list"] #filmList, #wlList, #topList,
// #seriesList dans css/style.css) réagit sans qu'aucune fonction de rendu
// n'ait à connaître ce réglage.
function getViewMode(){
  return localStorage.getItem('kinetViewMode') === 'list' ? 'list' : 'grid';
}

function setViewMode(mode){
  document.body.dataset.viewMode = mode;
  localStorage.setItem('kinetViewMode', mode);
  document.querySelectorAll('[data-view-btn]').forEach(btn => {
    const active = btn.dataset.viewBtn === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// setViewMode() plutôt qu'une simple lecture : synchronise aussi la classe
// is-active/aria-pressed des boutons déjà présents dans le HTML statique de
// chaque page (tous existent dans le DOM dès le chargement, même les pages
// masquées par display:none — voir js/router.js) avec la préférence
// mémorisée, pas seulement l'attribut sur <body>.
setViewMode(getViewMode());

// Délégué au document plutôt qu'un listener par bouton : la bascule
// apparaît sur plusieurs pages (catalogue, watchlist, top, séries), toutes
// avec le même markup `[data-view-btn]="grid|list"` — un seul gestionnaire
// couvre les boutons déjà présents au chargement ET ceux qu'une page ajoute
// plus tard à son propre rythme.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view-btn]');
  if(btn) setViewMode(btn.dataset.viewBtn);
});
