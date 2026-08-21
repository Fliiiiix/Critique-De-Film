// --- Recherche TMDB (affiche, résumé, année) ---
// Docs : https://developer.themoviedb.org/reference/search-movie
// Le champ "Titre du film" fait office de recherche : on interroge TMDB en
// direct pendant la frappe (debounce), pas besoin d'un champ ni d'un bouton
// séparés. Choisir un résultat renseigne aussi le titre. Résultat choisi
// stocké dans tmdbSelected, lu par handleSave() (js/app.js) à l'enregistrement.

let tmdbSelected = null; // { tmdb_id, poster_url, overview, release_year, title }
let tmdbSearchTimer = null;

async function searchTmdb(query){
  const url = `https://api.themoviedb.org/3/search/movie?language=fr-FR&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TMDB_API_KEY}`,
      'Accept': 'application/json'
    }
  });
  if(!res.ok){
    throw new Error(res.status === 401 ? 'Clé TMDB invalide ou non configurée (voir js/tmdbConfig.js)' : `Erreur TMDB (${res.status})`);
  }
  const data = await res.json();
  return (data.results || []).slice(0, 6);
}

function renderTmdbResults(results){
  const wrap = document.getElementById('tmdbResults');
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
    // mousedown (pas click) : se déclenche avant le blur du champ titre,
    // qui sinon referme les résultats avant que le clic soit pris en compte.
    item.addEventListener('mousedown', (e) => { e.preventDefault(); selectTmdbResult(r); });
    wrap.appendChild(item);
  });
}

function selectTmdbResult(r){
  tmdbSelected = {
    tmdb_id: r.id,
    poster_url: r.poster_path ? TMDB_IMG_BASE + r.poster_path : null,
    overview: r.overview || null,
    release_year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null,
    title: r.title
  };
  document.getElementById('titleInput').value = r.title;
  document.getElementById('tmdbResults').innerHTML = '';
  updateTmdbSelectedUI();
}

function clearTmdbSelection(){
  tmdbSelected = null;
  updateTmdbSelectedUI();
}

function updateTmdbSelectedUI(){
  const box = document.getElementById('tmdbSelected');
  const img = document.getElementById('tmdbSelectedPoster');
  if(!tmdbSelected){
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  img.src = tmdbSelected.poster_url || '';
  img.style.display = tmdbSelected.poster_url ? '' : 'none';
  document.getElementById('tmdbSelectedTitle').textContent =
    tmdbSelected.title + (tmdbSelected.release_year ? ` (${tmdbSelected.release_year})` : '');
}

async function handleTmdbSearch(query){
  const wrap = document.getElementById('tmdbResults');
  wrap.innerHTML = `<div class="tmdb-empty">Recherche…</div>`;
  try{
    const results = await searchTmdb(query);
    renderTmdbResults(results);
  }catch(e){
    wrap.innerHTML = `<div class="tmdb-empty">${escapeHtml(e.message)}</div>`;
    console.error(e);
  }
}

document.getElementById('titleInput').addEventListener('input', () => {
  clearTimeout(tmdbSearchTimer);
  const query = document.getElementById('titleInput').value.trim();
  if(query.length < 2){
    document.getElementById('tmdbResults').innerHTML = '';
    return;
  }
  tmdbSearchTimer = setTimeout(() => handleTmdbSearch(query), 350);
});
document.getElementById('titleInput').addEventListener('blur', () => {
  // Léger délai pour laisser le mousedown sur un résultat s'exécuter avant
  // que la liste ne disparaisse.
  setTimeout(() => { document.getElementById('tmdbResults').innerHTML = ''; }, 150);
});
document.getElementById('tmdbClearBtn').addEventListener('click', clearTmdbSelection);
