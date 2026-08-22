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
  },
  {
    tmdbId: 1368337, // The Odyssey (2026)
    trigger: 'click',
    icon: '🪓',
    run: runOdysseyHappening
  },
  {
    tmdbId: 598, // La Cité de Dieu / City of God (2002)
    trigger: 'click',
    icon: '🔫',
    run: runCityOfGodHappening
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

// --- The Odyssey : l'épreuve de l'arc ---
// Douze anneaux de hache, un seul arc à bander — cliquer/taper très
// vite et sans s'arrêter (la tension retombe si on relâche le rythme,
// comme un arc qu'on ne tire pas d'un coup sec). Pas d'état d'échec :
// on peut réessayer autant qu'on veut, l'effort suffit à faire le jeu.
function runOdysseyHappening(){
  const overlay = document.createElement('div');
  overlay.className = 'overlay open';
  overlay.innerHTML = `
    <div class="modal happening-modal">
      <div class="modal-head">
        <h2>L'épreuve de l'arc</h2>
        <button class="close-x" data-close>✕</button>
      </div>
      <p class="happening-caption" id="odysseyCaption">Douze anneaux de hache, un seul arc. Tire vite — et sans t'arrêter.</p>
      <div class="odyssey-track"><div class="odyssey-fill" id="odysseyFill"></div></div>
      <button class="btn odyssey-pull-btn" id="odysseyPullBtn" type="button">TIRE !</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let tension = 0;
  let won = false;
  const fill = document.getElementById('odysseyFill');
  const caption = document.getElementById('odysseyCaption');
  const pullBtn = document.getElementById('odysseyPullBtn');

  // La tension retombe toute seule — sans clics assez rapprochés et
  // nombreux, impossible d'atteindre 100 (voir le réglage des deux
  // constantes ci-dessous : il faut environ 3 clics/s en continu).
  const decay = setInterval(() => {
    if(won) return;
    tension = Math.max(0, tension - 2.5);
    fill.style.width = tension + '%';
  }, 150);

  function stopWatching(){
    clearInterval(decay);
    overlay.remove();
  }
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay || e.target.closest('[data-close]')) stopWatching();
  });

  pullBtn.addEventListener('click', () => {
    if(won) return;
    tension = Math.min(100, tension + 6);
    fill.style.width = tension + '%';
    if(tension >= 100){
      won = true;
      clearInterval(decay);
      caption.textContent = '« Aucun de vous n\'était digne de bander cet arc. » Toi, si.';
      pullBtn.disabled = true;
      pullBtn.textContent = 'ÉPREUVE RÉUSSIE';
      showToast('Tu es digne d\'Ithaque 🏹');
    }
  });
}

// --- La Cité de Dieu : ta fiche, façon Cidade de Deus ---
// Une carte à l'écran (affiche réelle du film en fond) qu'on peut
// screenshotter directement — "prendre en photo" au sens propre. Le
// bouton Télécharger génère en plus un vrai fichier, mais SANS l'affiche
// réelle en fond : l'API image de TMDB ne renvoie pas d'en-tête CORS
// permissif, donc un <canvas> qui la dessine devient "tainted" et
// toBlob()/toDataURL() refusent de l'exporter (testé en conditions
// réelles contre la prod — erreur "Tainted canvases may not be
// exported"). Contournable uniquement avec un proxy serveur (Edge
// Function Supabase) — hors scope pour un easter egg.
function runCityOfGodHappening(film){
  const note = getDisplayNote(film);
  const noteText = note !== null ? note.toFixed(1) : '—';
  const overlay = document.createElement('div');
  overlay.className = 'overlay open';
  overlay.innerHTML = `
    <div class="modal happening-modal cog-modal">
      <div class="modal-head">
        <h2>Ta fiche, façon Cidade de Deus</h2>
        <button class="close-x" data-close>✕</button>
      </div>
      <p class="happening-caption">Capture d'écran directe pour garder l'affiche réelle en fond — le bouton Télécharger génère un fichier, mais sans elle (contrainte technique de l'image TMDB, voir js/happenings.js).</p>
      <div class="cog-card">
        ${film.posterUrl ? `<img class="cog-card-bg" src="${film.posterUrl}" alt="">` : ''}
        <div class="cog-card-overlay">
          <div class="cog-card-title">${escapeHtml(film.title)}</div>
          <div class="cog-card-note">${noteText} <span>/ 5</span></div>
          ${film.review ? `<div class="cog-card-review">« ${escapeHtml(film.review)} »</div>` : ''}
          <div class="cog-card-brand">Critique de films</div>
        </div>
      </div>
      <div class="modal-footer">
        <div></div>
        <div class="right"><button class="btn" id="cogDownloadBtn" type="button">Télécharger</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay || e.target.closest('[data-close]')) overlay.remove();
  });
  document.getElementById('cogDownloadBtn').addEventListener('click', () => downloadCityOfGodCard(film, noteText));
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
  const words = text.split(' ');
  let line = '';
  let curY = y;
  let lines = 0;
  for(let i = 0; i < words.length; i++){
    const testLine = line + words[i] + ' ';
    if(ctx.measureText(testLine).width > maxWidth && line){
      ctx.fillText(line, x, curY);
      line = words[i] + ' ';
      curY += lineHeight;
      lines++;
      if(maxLines && lines >= maxLines - 1){
        // Dernière ligne autorisée : le reste, tronqué avec "…" si besoin.
        const rest = words.slice(i).join(' ');
        let truncated = rest;
        while(ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 1){
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated.length < rest.length ? truncated + '…' : truncated, x, curY);
        return;
      }
    }else{
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}

// Fond stylisé (dégradé + grain léger) plutôt que l'affiche réelle — voir
// le commentaire au-dessus de runCityOfGodHappening() pour la raison.
function downloadCityOfGodCard(film, noteText){
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#211c16');
  grad.addColorStop(1, '#0f0d09');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grain léger, façon pellicule — quelques centaines de points semi-
  // transparents plutôt qu'un vrai bruit par pixel (beaucoup plus rapide).
  ctx.fillStyle = 'rgba(237,228,211,0.05)';
  for(let i = 0; i < 900; i++){
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.5, 1.5);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8a713a';
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.fillText('CRITIQUE DE FILMS', 60, 90);

  ctx.fillStyle = '#d1a13f';
  ctx.font = 'italic 600 52px Georgia, serif';
  wrapCanvasText(ctx, film.title, 60, 220, canvas.width - 120, 58, 3);

  ctx.fillStyle = '#ede4d3';
  ctx.font = '700 90px Georgia, serif';
  ctx.fillText(noteText, 60, 440);
  const noteWidth = ctx.measureText(noteText).width;
  ctx.font = '600 32px Georgia, serif';
  ctx.fillStyle = '#948c78';
  ctx.fillText('/ 5', 60 + noteWidth + 16, 440);

  if(film.review){
    ctx.fillStyle = '#c9bfa8';
    ctx.font = 'italic 30px Georgia, serif';
    wrapCanvasText(ctx, '« ' + film.review + ' »', 60, 560, canvas.width - 120, 42, 8);
  }

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critique-films-${film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
