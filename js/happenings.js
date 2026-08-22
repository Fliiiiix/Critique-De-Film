// --- Happenings : easter eggs par film, façon Letterboxd ---
// (ex. la page Tenet qui se lit à l'envers une fois arrivé en bas). Un
// badge thématique apparaît à côté du titre d'un film qui en a un, dans le
// catalogue — cliquer dessus déclenche l'expérience, même emplacement que
// les badges manuel/💬/↻ déjà là (voir render() dans js/app.js). Certains se
// déclenchent plutôt en restant longtemps sur la fiche du film (le
// formulaire d'édition, seule "page" par film qu'a l'app) sans badge —
// l'effet de surprise fait partie du jeu, voir startDwellWatch() plus bas.
//
// Purement client, aucune table dédiée — même philosophie que Succès
// (js/achievements.js) : rien à débloquer/suivre en base, juste du code qui
// réagit au tmdb_id du film ouvert. Identifié par tmdb_id (pas le titre) :
// fiable même si le titre est retapé différemment.

const HAPPENINGS = [
  {
    tmdbId: 550, // Fight Club (1999)
    trigger: 'click',
    icon: '🥊',
    run: runFightClubHappening
  },
  {
    tmdbId: 670, // Old Boy (2003)
    trigger: 'click',
    icon: '🔨',
    run: runOldBoyHappening
  },
  {
    tmdbId: 785084, // The Whale (2022)
    trigger: 'dwell',
    dwellMs: 20000, // rester 20s sur la fiche du film pour le déclencher
    run: runWhaleHappening
  }
];

function getHappeningForFilm(film){
  return (film && film.tmdbId) ? (HAPPENINGS.find(h => h.tmdbId === film.tmdbId) || null) : null;
}

function getClickHappeningForFilm(film){
  const h = getHappeningForFilm(film);
  return (h && h.trigger === 'click') ? h : null;
}

function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// --- Fight Club : un flash qu'on n'est pas censé voir ---
// Même procédé que le film (des photogrammes de Tyler Durden insérés avant
// sa "révélation") plutôt qu'une simple référence visuelle : un seul flash
// bref, pas de répétition ni de clignotement rythmé (voir la note sur
// l'épilepsie photosensible ci-dessous).
function runFightClubHappening(){
  if(prefersReducedMotion()){
    showToast('« La première règle du Fight Club... »');
    return;
  }
  const el = document.createElement('div');
  el.className = 'happening-flash';
  el.innerHTML = `<span>TU NE DEVRAIS PAS ÊTRE LÀ</span>`;
  document.body.appendChild(el);
  // Un seul flash, jamais répété — un vrai clignotement (plusieurs flashs
  // par seconde) est un déclencheur classique de crise chez les personnes
  // photosensibles, à éviter absolument même pour un easter egg.
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.remove(), 260);
}

// --- Old Boy : le couloir, en un seul plan ---
function runOldBoyHappening(){
  const overlay = document.createElement('div');
  overlay.className = 'overlay open';
  overlay.innerHTML = `
    <div class="modal happening-modal">
      <div class="modal-head">
        <h2>Un seul plan.</h2>
        <button class="close-x" data-close>✕</button>
      </div>
      <div class="oldboy-corridor">
        <div class="oldboy-corridor-track${prefersReducedMotion() ? ' static' : ''}">
          <span>🚪</span><span>🔨</span><span>🚪</span><span>🔨</span><span>🚪</span><span>🔨</span><span>🚪</span>
        </div>
      </div>
      <p class="happening-caption">Un couloir. Un marteau. Une seule prise, du début à la fin.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay || e.target.closest('[data-close]')) overlay.remove();
  });
}

// --- The Whale : reste un peu trop longtemps... ---
let whaleDwellTimer = null;

// Appelé par openModal() (js/app.js) à chaque ouverture d'un film — ne fait
// quelque chose que si ce film a un happening "dwell".
function startDwellWatch(film){
  clearDwellWatch();
  const h = getHappeningForFilm(film);
  if(!h || h.trigger !== 'dwell') return;
  whaleDwellTimer = setTimeout(h.run, h.dwellMs);
}

// Appelé par closeModal() — sinon un happening "dwell" pourrait se
// déclencher après coup, sur un tout autre film ou écran.
function clearDwellWatch(){
  if(whaleDwellTimer){
    clearTimeout(whaleDwellTimer);
    whaleDwellTimer = null;
  }
}

function runWhaleHappening(){
  // Fermé entre-temps (ou le minuteur d'un autre film) : rien à faire.
  if(!document.getElementById('overlay').classList.contains('open')) return;
  showToast('« NON ! Pas l\'ordinateur ! »');
  if(prefersReducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'happening-fly';
  el.textContent = '💻';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('fly'));
  setTimeout(() => el.remove(), 1300);
}
