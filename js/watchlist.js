// --- Watchlist ("à voir") ---
// Liste séparée du catalogue noté (table `watchlist`, voir
// supabase/migrations/006). Ajout rapide : titre + fiche TMDB optionnelle +
// note libre, sans passer par la grille de critères. "Noter" transforme un
// item en film noté (ouvre le formulaire principal prérempli) et le retire
// de la watchlist une fois le film enregistré — voir handleSave() dans
// js/app.js, qui référence convertingFromWatchlistId.

let watchlist = [];
let wlTmdbSelected = null; // { tmdb_id, poster_url, overview, release_year, title }
let convertingFromWatchlistId = null;

async function loadWatchlist(){
  const { data, error } = await supabaseClient
    .from('watchlist')
    .select('*')
    .order('added', { ascending: false });
  if(error){
    showToast('Erreur de chargement de la watchlist');
    console.error(error);
    watchlist = [];
    return;
  }
  watchlist = data.map(row => ({
    id: row.id,
    title: row.title,
    note: row.note || null,
    tmdbId: row.tmdb_id || null,
    posterUrl: row.poster_url || null,
    overview: row.overview || null,
    releaseYear: row.release_year || null,
    originalTitle: row.original_title || null,
    added: row.added
  }));
}

function renderWatchlist(){
  const list = document.getElementById('wlList');
  if(watchlist.length === 0){
    list.innerHTML = `<div class="empty-state">Rien pour l'instant — ajoute un film ci-dessus.</div>`;
    return;
  }
  list.innerHTML = '';
  watchlist.forEach(item => {
    const row = document.createElement('div');
    row.className = 'wl-row';
    row.innerHTML = `
      ${item.posterUrl
        ? `<img class="film-poster" src="${item.posterUrl}" alt="" loading="lazy">`
        : `<div class="film-poster film-poster-placeholder">🎬</div>`}
      <div class="wl-main">
        <div class="wl-title">${escapeHtml(item.title)}${item.releaseYear ? ` <span class="wl-year">(${item.releaseYear})</span>` : ''}</div>
        ${item.note ? `<div class="wl-note">${escapeHtml(item.note)}</div>` : ''}
      </div>
      <div class="wl-actions">
        <button class="btn secondary" data-action="rate" data-id="${item.id}">✔ Noter</button>
        <button class="btn danger" data-action="remove" data-id="${item.id}">Retirer</button>
      </div>
    `;
    row.querySelector('[data-action="rate"]').addEventListener('click', () => startRatingFromWatchlist(item));
    row.querySelector('[data-action="remove"]').addEventListener('click', () => handleRemoveFromWatchlist(item.id));
    list.appendChild(row);
  });
}

async function openWatchlist(){
  document.getElementById('watchlistOverlay').classList.add('open');
  document.getElementById('wlList').innerHTML = `<div class="empty-state">Chargement…</div>`;
  await loadWatchlist();
  renderWatchlist();
}

function closeWatchlist(){
  document.getElementById('watchlistOverlay').classList.remove('open');
}

async function handleAddToWatchlist(){
  const title = document.getElementById('wlTitleInput').value.trim();
  if(!title){
    showToast('Ajoute un titre avant d\'enregistrer');
    return;
  }
  const note = document.getElementById('wlNoteInput').value.trim() || null;
  const tmdbFields = wlTmdbSelected
    ? { tmdb_id: wlTmdbSelected.tmdb_id, poster_url: wlTmdbSelected.poster_url, overview: wlTmdbSelected.overview, release_year: wlTmdbSelected.release_year, original_title: wlTmdbSelected.original_title }
    : { tmdb_id: null, poster_url: null, overview: null, release_year: null, original_title: null };

  const { data, error } = await supabaseClient
    .from('watchlist')
    .insert({ title, note, added: Date.now(), ...tmdbFields })
    .select()
    .single();
  if(error){
    showToast('Erreur de sauvegarde — réessaie');
    console.error(error);
    return;
  }

  watchlist.unshift({
    id: data.id, title, note,
    tmdbId: tmdbFields.tmdb_id, posterUrl: tmdbFields.poster_url,
    overview: tmdbFields.overview, releaseYear: tmdbFields.release_year,
    originalTitle: tmdbFields.original_title,
    added: data.added
  });
  renderWatchlist();

  document.getElementById('wlTitleInput').value = '';
  document.getElementById('wlNoteInput').value = '';
  clearWlTmdbSelection();
  showToast('Ajouté à la watchlist');
}

async function handleRemoveFromWatchlist(id){
  const { error } = await supabaseClient.from('watchlist').delete().eq('id', id);
  if(error){
    showToast('Erreur de suppression — réessaie');
    console.error(error);
    return;
  }
  watchlist = watchlist.filter(w => w.id !== id);
  renderWatchlist();
}

// Bascule vers le formulaire principal (grille/note manuelle) prérempli avec
// le titre et la fiche TMDB déjà connus. L'item n'est retiré de la watchlist
// qu'une fois le film effectivement enregistré, voir handleSave() (app.js).
function startRatingFromWatchlist(item){
  closeWatchlist();
  openModal(null);
  document.getElementById('titleInput').value = item.title;
  if(item.tmdbId){
    tmdbSelected = {
      tmdb_id: item.tmdbId, poster_url: item.posterUrl,
      overview: item.overview, release_year: item.releaseYear, title: item.title,
      original_title: item.originalTitle
    };
    updateTmdbSelectedUI();
  }
  convertingFromWatchlistId = item.id;
}

// --- Recherche TMDB pour le formulaire d'ajout rapide ---
// Le champ "Titre du film" fait aussi office de recherche (debounce pendant
// la frappe), comme dans le formulaire principal — voir js/tmdb.js.

let wlTmdbSearchTimer = null;

function renderWlTmdbResults(results){
  const wrap = document.getElementById('wlTmdbResults');
  if(!results.length){
    wrap.innerHTML = `<div class="tmdb-empty">Aucun résultat.</div>`;
    return;
  }
  wrap.innerHTML = '';
  results.forEach(r => {
    const year = r.release_date ? r.release_date.slice(0, 4) : '?';
    const poster = r.poster_path ? TMDB_IMG_BASE + r.poster_path : null;
    const item = document.createElement('div');
    item.className = 'tmdb-result';
    item.innerHTML = `
      ${poster ? `<img src="${poster}" alt="">` : `<div class="tmdb-poster-placeholder">🎬</div>`}
      <div class="tmdb-result-info">
        <div class="tmdb-result-title">${escapeHtml(r.title)}</div>
        <div class="tmdb-result-year">${year}</div>
      </div>
    `;
    item.addEventListener('mousedown', (e) => { e.preventDefault(); selectWlTmdbResult(r); });
    wrap.appendChild(item);
  });
}

function selectWlTmdbResult(r){
  wlTmdbSelected = {
    tmdb_id: r.id,
    poster_url: r.poster_path ? TMDB_IMG_BASE + r.poster_path : null,
    overview: r.overview || null,
    release_year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null,
    title: r.title,
    original_title: r.original_title && r.original_title !== r.title ? r.original_title : null
  };
  document.getElementById('wlTitleInput').value = r.title;
  document.getElementById('wlTmdbResults').innerHTML = '';
  updateWlTmdbSelectedUI();
}

function clearWlTmdbSelection(){
  wlTmdbSelected = null;
  updateWlTmdbSelectedUI();
}

function updateWlTmdbSelectedUI(){
  const box = document.getElementById('wlTmdbSelected');
  const img = document.getElementById('wlTmdbSelectedPoster');
  if(!wlTmdbSelected){
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  img.src = wlTmdbSelected.poster_url || '';
  img.style.display = wlTmdbSelected.poster_url ? '' : 'none';
  document.getElementById('wlTmdbSelectedTitle').textContent =
    wlTmdbSelected.title + (wlTmdbSelected.release_year ? ` (${wlTmdbSelected.release_year})` : '');
}

async function handleWlTmdbSearch(query){
  const wrap = document.getElementById('wlTmdbResults');
  wrap.innerHTML = `<div class="tmdb-empty">Recherche…</div>`;
  try{
    const results = await searchTmdb(query);
    renderWlTmdbResults(results);
  }catch(e){
    wrap.innerHTML = `<div class="tmdb-empty">${escapeHtml(e.message)}</div>`;
    console.error(e);
  }
}

document.getElementById('watchlistBtn').addEventListener('click', openWatchlist);
document.getElementById('closeWatchlist').addEventListener('click', closeWatchlist);
document.getElementById('watchlistOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'watchlistOverlay') closeWatchlist();
});
document.getElementById('wlAddBtn').addEventListener('click', handleAddToWatchlist);
document.getElementById('wlTitleInput').addEventListener('input', () => {
  clearTimeout(wlTmdbSearchTimer);
  const query = document.getElementById('wlTitleInput').value.trim();
  if(query.length < 2){
    document.getElementById('wlTmdbResults').innerHTML = '';
    return;
  }
  wlTmdbSearchTimer = setTimeout(() => handleWlTmdbSearch(query), 350);
});
document.getElementById('wlTitleInput').addEventListener('blur', () => {
  setTimeout(() => { document.getElementById('wlTmdbResults').innerHTML = ''; }, 150);
});
document.getElementById('wlTmdbClearBtn').addEventListener('click', clearWlTmdbSelection);
