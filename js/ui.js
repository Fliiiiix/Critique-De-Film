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

function openOverlay(id){
  const el = document.getElementById(id);
  el.classList.remove('closing'); // une fermeture pouvait être en cours
  el.classList.add('open');
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
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
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
    if(extraCleanup) extraCleanup();
  };
  el.addEventListener('animationend', finish);
  setTimeout(finish, OVERLAY_CLOSE_MS);
}

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
