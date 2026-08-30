// --- Persistance ---
// Les films sont stockés dans Supabase (table `films`, voir supabase/schema.sql),
// scopés par utilisateur via RLS. Chaque film noté du site correspond à une ligne ;
// id/added/created_at sont attribués côté serveur. Le catalogue d'origine (Excel,
// js/data.js SEED) n'est plus auto-chargé ici — voir README pour la migration
// via Importer (JSON) une fois connecté.

let films = [];
let editingId = null;

// Pagination du catalogue — évite le scroll infini au-delà de quelques
// centaines de films. Remise à 1 à chaque changement de recherche/tri
// (voir les listeners en bas de fichier), sinon conservée entre les render()
// (ex. après avoir coché un favori) pour ne pas perdre sa place.
const FILMS_PER_PAGE = 50;
let currentPage = 1;

function computeNote(critObj){
  const vals = CRITERIA.map(c => critObj[c.key]).filter(v => typeof v === 'number');
  if(vals.length === 0) return null;
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  return Math.round(avg*10) / 2;
}

function rowToFilm(row){
  return {
    id: row.id,
    title: row.title,
    crit: row.crit,
    fav: row.fav,
    added: row.added,
    manualNote: row.manual_note != null ? parseFloat(row.manual_note) : null,
    review: row.review || null,
    tmdbId: row.tmdb_id || null,
    posterUrl: row.poster_url || null,
    overview: row.overview || null,
    releaseYear: row.release_year || null,
    originalTitle: row.original_title || null
  };
}

// Normalise pour une comparaison insensible aux accents/casse — "amelie"
// doit matcher "Amélie" et "féroces" doit matcher "feroces".
// Plage Unicode des diacritiques combinants (U+0300-U+036F), construite via
// String.fromCharCode plutôt qu'un échappement \uXXXX en dur dans le regex.
const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
function normalizeSearch(str){
  return str.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

// Titre FR + titre VO (si connu et différent) : sert de base à la recherche,
// pour retrouver un film aussi bien par son titre français que son titre
// original ("créatures féroces" ↔ "fierce creatures"), sans traduction —
// juste les deux titres que TMDB associe déjà au même film.
function getSearchTerms(film){
  const terms = [normalizeSearch(film.title)];
  if(film.originalTitle) terms.push(normalizeSearch(film.originalTitle));
  return terms;
}

// Note affichée : la note manuelle prime sur la note calculée depuis la grille,
// pour les films exceptionnellement notés avec un référentiel différent.
function getDisplayNote(film){
  return film.manualNote != null ? film.manualNote : computeNote(film.crit);
}

async function loadFilms(){
  // Filtre explicite sur user_id : depuis la policy RLS "Friends can view
  // shared films" (migrations/009), un select non filtré remonterait aussi
  // le catalogue des amis acceptés. Cette liste est LE catalogue perso
  // (modifiable) — la vue en lecture seule d'un ami passe par sa propre
  // requête filtrée, voir openFriendProfile() dans js/friends.js.
  const { data, error } = await supabaseClient
    .from('films')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('added', { ascending: false });
  if(error){
    // Repli hors ligne (js/offline.js) : dernier catalogue chargé avec
    // succès plutôt qu'un catalogue vide qui donnerait l'impression que
    // tout a disparu. Ce chemin fait aussi office de "source de vérité"
    // pour isOfflineMode — voir le listener 'online' dans offline.js, qui
    // retente cette même fonction pour en sortir.
    const cached = loadOfflineCache('films');
    if(cached){
      films = cached.data;
      enterOfflineMode(cached.savedAt);
      return;
    }
    showToast('Erreur de chargement — réessaie');
    console.error(error);
    films = [];
    return;
  }
  films = data.map(rowToFilm);
  saveOfflineCache('films', films);
  exitOfflineMode();
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), 2200);
}

// Options de #sortCriterion, générées depuis CRITERIA (js/data.js) plutôt
// que dupliquées à la main dans index.html — évite le décalage si un
// critère est renommé/ajouté un jour.
function buildSortOptions(){
  document.getElementById('sortCriterion').innerHTML = CRITERIA
    .map(c => `<option value="${c.key}">${escapeHtml(c.label)}</option>`)
    .join('');
}

// Sens du tri par critère (#sortAdvancedRow) — bouton-bascule plutôt qu'un
// 2e select, voir setSortDir() plus bas.
let sortDir = 'desc';

function render(){
  const list = document.getElementById('filmList');
  const countLine = document.getElementById('countLine');
  const search = normalizeSearch(document.getElementById('search').value.trim());
  const sortBy = document.getElementById('sortBy').value;
  const isAdvanced = sortBy === 'advanced';
  const critKey = isAdvanced ? document.getElementById('sortCriterion').value : null;
  const critFilterMin = isAdvanced ? parseFloat(document.getElementById('critFilterMin').value) : 0;

  // Matche le titre FR ou le titre VO (ex. "créatures féroces" trouve aussi
  // "Fierce Creatures"), accents/casse ignorés — voir getSearchTerms().
  let filtered = films.filter(f => !search || getSearchTerms(f).some(t => t.includes(search)));

  // Seuil sur le critère en cours de tri (voir #sortAdvancedRow) — un film
  // noté en note manuelle n'a pas cette valeur (crit vide) et sort donc du
  // lot dès que le seuil dépasse 0, pas juste mal classé.
  if(isAdvanced && critFilterMin > 0){
    filtered = filtered.filter(f => typeof f.crit[critKey] === 'number' && f.crit[critKey] >= critFilterMin);
  }

  filtered.sort((a,b) => {
    if(isAdvanced){
      const av = typeof a.crit[critKey] === 'number' ? a.crit[critKey] : -1;
      const bv = typeof b.crit[critKey] === 'number' ? b.crit[critKey] : -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    }
    if(sortBy === 'note-desc') return (getDisplayNote(b)||0) - (getDisplayNote(a)||0);
    if(sortBy === 'note-asc') return (getDisplayNote(a)||0) - (getDisplayNote(b)||0);
    if(sortBy === 'title-asc') return a.title.localeCompare(b.title, 'fr');
    if(sortBy === 'fav-first') return (b.fav - a.fav) || ((getDisplayNote(b)||0) - (getDisplayNote(a)||0));
    if(sortBy === 'recent') return b.added - a.added;
    return 0;
  });

  const isFiltered = !!search || (isAdvanced && critFilterMin > 0);
  countLine.textContent = `${filtered.length} film${filtered.length>1?'s':''} ${isFiltered ? '(filtré)' : 'au catalogue'}`;

  if(filtered.length === 0){
    list.innerHTML = `<div class="empty-state">Aucun film. Clique sur « + Ajouter un film » pour commencer ton catalogue.</div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILMS_PER_PAGE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pageItems = filtered.slice((currentPage - 1) * FILMS_PER_PAGE, currentPage * FILMS_PER_PAGE);

  list.innerHTML = '';
  pageItems.forEach(f => {
    const note = getDisplayNote(f);
    const isManual = f.manualNote != null;
    const rewatches = typeof rewatchCount === 'function' ? rewatchCount(f.id) : 0;
    const happening = getClickHappeningForFilm(f);
    const row = document.createElement('div');
    row.className = 'film-row';
    row.dataset.id = f.id; // cible du pulse de sauvegarde (voir handleSave()) et du pulse favori ci-dessous
    const sub = (isManual ? 'Note manuelle · ancien référentiel' : '7 critères notés') + (f.releaseYear ? ` · ${f.releaseYear}` : '');
    row.innerHTML = `
      <div class="holes"><span></span><span></span><span></span></div>
      ${f.posterUrl
        ? `<img class="film-poster" src="${f.posterUrl}" alt="" loading="lazy">`
        : `<div class="film-poster film-poster-placeholder">🎬</div>`}
      <div class="film-main">
        <div class="film-title">${escapeHtml(f.title)}${isManual ? '<span class="manual-badge" title="Note manuelle — référentiel différent">manuel</span>' : ''}${f.review ? '<span class="review-badge" title="Commentaire enregistré">💬</span>' : ''}${rewatches > 1 ? `<span class="rewatch-badge" title="Revu ${rewatches} fois">↻ ×${rewatches}</span>` : ''}${happening ? `<button class="happening-badge" type="button" title="Un petit quelque chose à découvrir..." aria-label="Un petit quelque chose à découvrir...">${happening.icon}</button>` : ''}</div>
        <div class="film-sub">${sub}</div>
      </div>
      <button class="star-btn ${f.fav ? 'active' : ''}" data-id="${f.id}" type="button" title="Favori" aria-label="${f.fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${f.fav}">${f.fav ? '★' : '☆'}</button>
      <div class="counter ${noteColorClass(note)}">${note !== null ? note.toFixed(1) : '—'}</div>
    `;
    row.addEventListener('click', (e) => {
      if(e.target.classList.contains('star-btn')) return;
      openModal(f.id);
    });
    if(happening){
      row.querySelector('.happening-badge').addEventListener('click', (e) => {
        e.stopPropagation();
        happening.run(f);
      });
    }
    row.querySelector('.star-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if(blockIfOffline()) return; // js/offline.js — lecture seule hors ligne
      const newFav = !f.fav;
      const { error } = await supabaseClient.from('films').update({ fav: newFav }).eq('id', f.id).eq('user_id', currentUser.id);
      if(error){
        showToast('Erreur de sauvegarde — réessaie');
        console.error(error);
        return;
      }
      f.fav = newFav;
      render();
      // render() reconstruit tout le DOM de la liste (voir plus haut) — le
      // bouton cliqué n'existe déjà plus, on pulse celui qui vient d'être
      // recréé pour le même film plutôt que l'ancienne référence.
      pulseElement(document.querySelector(`.star-btn[data-id="${f.id}"]`));
    });
    list.appendChild(row);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const el = document.getElementById('pagination');
  if(totalPages <= 1){
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <button class="btn secondary" id="pagePrev" ${currentPage === 1 ? 'disabled' : ''}>← Précédent</button>
    <span class="pagination-label">Page ${currentPage} / ${totalPages}</span>
    <button class="btn secondary" id="pageNext" ${currentPage === totalPages ? 'disabled' : ''}>Suivant →</button>
  `;
  document.getElementById('pagePrev').addEventListener('click', () => {
    currentPage--;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('pageNext').addEventListener('click', () => {
    currentPage++;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function buildCriteriaInputs(critObj){
  const wrap = document.getElementById('criteriaWrap');
  wrap.innerHTML = '';
  CRITERIA.forEach((c, idx) => {
    const val = (critObj && typeof critObj[c.key] === 'number') ? critObj[c.key] : 0.5;
    const block = document.createElement('div');
    block.className = 'criterion';
    block.innerHTML = `
      <div class="crit-head">
        <div class="crit-label"><span class="num">0${idx+1}</span>${c.label}</div>
        <div class="crit-val" id="val-${c.key}">${val.toFixed(2)}</div>
      </div>
      <div class="crit-def">${escapeHtml(c.def)}</div>
      <div class="crit-slider-row">
        <input type="range" min="0" max="1" step="0.05" value="${val}" id="slider-${c.key}" data-key="${c.key}">
      </div>
      <button class="crit-help-toggle" data-key="${c.key}">Repères de notation & questions</button>
      <div class="crit-help" id="help-${c.key}"><div class="crit-anchors">${escapeHtml(c.anchors)}</div><div class="crit-questions">${escapeHtml(c.help)}</div></div>
    `;
    wrap.appendChild(block);
  });

  wrap.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', () => {
      document.getElementById('val-' + input.dataset.key).textContent = parseFloat(input.value).toFixed(2);
      updateLiveScore();
    });
  });
  wrap.querySelectorAll('.crit-help-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('help-' + btn.dataset.key).classList.toggle('open');
    });
  });
  updateLiveScore();
}

function readCriteriaFromForm(){
  const obj = {};
  CRITERIA.forEach(c => {
    obj[c.key] = parseFloat(document.getElementById('slider-' + c.key).value);
  });
  return obj;
}

function isManualMode(){
  return document.getElementById('manualToggle').checked;
}

function updateManualVisibility(){
  const manual = isManualMode();
  document.getElementById('criteriaWrap').style.display = manual ? 'none' : '';
  document.getElementById('manualScoreRow').style.display = manual ? '' : 'none';
  updateLiveScore();
}

function updateLiveScore(){
  let note;
  if(isManualMode()){
    note = parseFloat(document.getElementById('manualScoreSlider').value);
  }else{
    note = computeNote(readCriteriaFromForm());
  }
  document.getElementById('liveScoreLabel').textContent = isManualMode() ? 'Note manuelle' : 'Note calculée';
  document.getElementById('liveScore').textContent = (note !== null && !isNaN(note)) ? note.toFixed(1) : '—';
}

function openModal(id){
  if(blockIfOffline()) return; // js/offline.js — lecture seule hors ligne
  editingId = id || null;
  // Repart d'une conversion watchlist propre à chaque ouverture — seule
  // startRatingFromWatchlist() (js/watchlist.js) la positionne ensuite.
  convertingFromWatchlistId = null;
  const film = id ? films.find(f => f.id === id) : null;
  const manualNote = film && film.manualNote != null ? film.manualNote : null;

  document.getElementById('modalTitle').textContent = film ? 'Modifier le film' : 'Nouveau film';
  document.getElementById('titleInput').value = film ? film.title : '';
  document.getElementById('deleteBtn').style.display = film ? 'inline-block' : 'none';

  document.getElementById('manualToggle').checked = manualNote !== null;
  const sliderVal = manualNote !== null ? manualNote : 2.5;
  document.getElementById('manualScoreSlider').value = sliderVal;
  document.getElementById('manualScoreVal').textContent = sliderVal.toFixed(2);

  document.getElementById('reviewInput').value = film && film.review ? film.review : '';

  // Reprend l'affiche/résumé TMDB déjà enregistrés (s'il y en a) comme point de
  // départ — une nouvelle recherche les remplace, "Retirer" les efface.
  tmdbSelected = (film && film.tmdbId) ? {
    tmdb_id: film.tmdbId,
    poster_url: film.posterUrl,
    overview: film.overview,
    release_year: film.releaseYear,
    title: film.title
  } : null;
  document.getElementById('tmdbResults').innerHTML = '';
  updateTmdbSelectedUI();

  buildCriteriaInputs(film ? film.crit : null);
  updateManualVisibility();

  // Visionnages : n'a de sens que pour un film déjà enregistré (le premier
  // visionnage d'un nouveau film est créé automatiquement à la sauvegarde).
  document.getElementById('viewingsSection').style.display = film ? '' : 'none';
  if(film){
    const todayStr = new Date().toISOString().slice(0, 10);
    const viewingDateInput = document.getElementById('viewingDateInput');
    viewingDateInput.value = todayStr;
    viewingDateInput.max = todayStr; // pas de visionnage dans le futur
    document.getElementById('viewingNoteInput').value = '';
    renderViewingsSection(film.id);
  }

  openOverlay('overlay');
  document.getElementById('titleInput').focus();
  // Happenings "dwell" (ex. The Whale) : se déclenchent en restant un
  // moment sur la fiche d'un film précis — voir js/happenings.js.
  startDwellWatch(film);
}

function closeModal(){
  closeOverlay('overlay', () => {
    editingId = null;
    convertingFromWatchlistId = null;
    clearDwellWatch();
  });
}

async function handleSave(){
  const title = document.getElementById('titleInput').value.trim();
  if(!title){
    showToast('Ajoute un titre avant d\'enregistrer');
    return;
  }
  const manual = isManualMode();
  // En mode manuel, la grille n'est pas utilisée : crit vide, note = manual_note.
  const crit = manual ? {} : readCriteriaFromForm();
  const manualNote = manual ? parseFloat(document.getElementById('manualScoreSlider').value) : null;
  const review = document.getElementById('reviewInput').value.trim() || null;
  const tmdbFields = tmdbSelected
    ? { tmdb_id: tmdbSelected.tmdb_id, poster_url: tmdbSelected.poster_url, overview: tmdbSelected.overview, release_year: tmdbSelected.release_year, original_title: tmdbSelected.original_title }
    : { tmdb_id: null, poster_url: null, overview: null, release_year: null, original_title: null };

  // Capturé avant closeModal() : son extraCleanup (js/ui.js) remet
  // editingId à null, mais seulement une fois l'animation de fermeture
  // terminée — pas question de dépendre de ce timing ici. Réassigné plus
  // bas côté création (id généré par Supabase, connu qu'après l'insert).
  let pulseId = editingId;

  if(editingId){
    const { error } = await supabaseClient.from('films')
      .update({ title, crit, manual_note: manualNote, review, ...tmdbFields })
      .eq('id', editingId)
      .eq('user_id', currentUser.id);
    if(error){
      showToast('Erreur de sauvegarde — réessaie');
      console.error(error);
      return;
    }
    const film = films.find(f => f.id === editingId);
    film.title = title;
    film.crit = crit;
    film.manualNote = manualNote;
    film.review = review;
    film.tmdbId = tmdbFields.tmdb_id;
    film.posterUrl = tmdbFields.poster_url;
    film.overview = tmdbFields.overview;
    film.releaseYear = tmdbFields.release_year;
    film.originalTitle = tmdbFields.original_title;
  }else{
    const { data, error } = await supabaseClient
      .from('films')
      .insert({ title, crit, fav: false, added: Date.now(), manual_note: manualNote, review, ...tmdbFields })
      .select()
      .single();
    if(error){
      showToast('Erreur de sauvegarde — réessaie');
      console.error(error);
      return;
    }
    films.push(rowToFilm(data));
    pulseId = data.id;

    // Premier visionnage automatique, daté de l'ajout — voir js/journal.js.
    await addViewing(data.id, data.added);

    // Film créé depuis "✔ Noter" dans la watchlist (js/watchlist.js) :
    // on retire l'item d'origine maintenant que le film est bien enregistré.
    // En tâche de fond, sans bloquer la fermeture du formulaire.
    if(convertingFromWatchlistId){
      const wlId = convertingFromWatchlistId;
      supabaseClient.from('watchlist').delete().eq('id', wlId).then(({ error: wlError }) => {
        if(wlError) console.error(wlError);
        else watchlist = watchlist.filter(w => w.id !== wlId);
      });
    }
  }
  closeModal();
  render();
  // Pulse silencieux sur la note qui vient d'être enregistrée, en plus du
  // toast déjà là — peut ne rien trouver (film sur une autre page de la
  // pagination), pulseElement() ignore alors simplement l'appel.
  pulseElement(document.querySelector(`.film-row[data-id="${pulseId}"] .counter`));
  showToast('Film enregistré');
}

async function handleDelete(){
  if(!editingId) return;
  const { error } = await supabaseClient.from('films').delete().eq('id', editingId).eq('user_id', currentUser.id);
  if(error){
    showToast('Erreur de suppression — réessaie');
    console.error(error);
    return;
  }
  films = films.filter(f => f.id !== editingId);
  viewings = viewings.filter(v => v.filmId !== editingId); // supprimés en cascade côté base
  closeModal();
  render();
  showToast('Film supprimé');
}

// --- Export / Import JSON ---

function exportFilms(){
  const data = {
    app: 'critique-films',
    version: 3,
    exportedAt: new Date().toISOString(),
    films
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `critique-films-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Export téléchargé');
}

function isValidImportedFilm(f){
  return f && typeof f === 'object' && typeof f.title === 'string' && f.title.trim() && typeof f.crit === 'object' && f.crit !== null;
}

function importFilms(file){
  const reader = new FileReader();
  reader.onload = async () => {
    let data;
    try{
      data = JSON.parse(reader.result);
    }catch(e){
      showToast('Fichier JSON invalide');
      return;
    }

    const importedFilms = Array.isArray(data) ? data : data.films;
    if(!Array.isArray(importedFilms) || !importedFilms.every(isValidImportedFilm)){
      showToast('Format inattendu — import annulé');
      return;
    }

    const replace = confirm(
      `${importedFilms.length} film(s) trouvé(s) dans le fichier.\n\n` +
      `OK → remplace le catalogue actuel\n` +
      `Annuler → ajoute ces films aux films existants`
    );

    showToast('Import en cours…');

    if(replace){
      const { error: delError } = await supabaseClient.from('films').delete().eq('user_id', currentUser.id);
      if(delError){
        showToast('Erreur pendant le remplacement — réessaie');
        console.error(delError);
        return;
      }
      films = [];
      viewings = []; // supprimés en cascade côté base avec leurs films (FK on delete cascade)
    }

    const rows = importedFilms.map(f => ({
      title: f.title.trim(),
      crit: f.crit,
      fav: !!f.fav,
      added: typeof f.added === 'number' ? f.added : Date.now(),
      manual_note: typeof f.manualNote === 'number' ? f.manualNote : null,
      review: f.review || null,
      tmdb_id: f.tmdbId || null,
      poster_url: f.posterUrl || null,
      overview: f.overview || null,
      release_year: f.releaseYear || null,
      original_title: f.originalTitle || null
    }));

    const { data: inserted, error: insError } = await supabaseClient.from('films').insert(rows).select();
    if(insError){
      showToast('Erreur pendant l\'import — réessaie');
      console.error(insError);
      return;
    }

    inserted.forEach(row => films.push(rowToFilm(row)));
    // Premier visionnage automatique pour chaque film importé, daté de son "added".
    await Promise.all(inserted.map(row => addViewing(row.id, row.added)));
    render();
    showToast(replace ? 'Catalogue remplacé' : 'Films ajoutés');
  };
  reader.onerror = () => showToast('Impossible de lire le fichier');
  reader.readAsText(file);
}

// --- Export vers Letterboxd (CSV) ---
// Letterboxd n'ouvre pas son API en écriture à un projet perso comme
// celui-ci (accès sur demande à api@letterboxd.com, réservé en pratique à
// des partenaires approuvés) — pas de vraie synchro automatique possible.
// En revanche, leur import CSV est un vrai flux officiel et documenté
// (letterboxd.com/about/importing-data) : ce fichier, une fois généré,
// s'importe à la main sur leur site en ~1 minute. Colonnes retenues,
// celles dont le comportement à l'import est confirmé : Title, Year,
// tmdbID (le même identifiant que celui déjà stocké via la recherche
// TMDB — évite toute ambiguïté de titre), WatchedDate (YYYY-MM-DD),
// Rating (0.5 à 5.0 par pas de 0.5, exactement l'échelle déjà utilisée
// ici), Review. Tags n'est PAS inclus : documenté comme ignoré côté
// import (contrairement à l'export, qui lui l'inclut).
//
// Un film → une seule ligne (pas une par revisionnage) : l'app ne stocke
// qu'une note par film, pas une par visionnage (voir js/journal.js) — Un
// import Letterboxd pourrait donc au mieux copier la même note sur chaque
// entrée de journal, un résultat plus trompeur qu'utile. WatchedDate
// prend la date du visionnage le PLUS RÉCENT (le plus proche de l'avis
// actuel, si le film a été revu) ; à défaut de tout visionnage enregistré
// (import JSON ancien, film ajouté avant le suivi des visionnages), repli
// sur `added`, la date d'ajout au catalogue.
function csvEscape(value){
  const s = String(value ?? '');
  // Toujours entre guillemets : plus simple et plus sûr que de ne les
  // ajouter qu'en présence d'une virgule/d'un guillemet/d'un retour à la
  // ligne — un titre ou un commentaire peut contenir n'importe lequel des
  // trois, doubler les guillemets internes suffit dans tous les cas.
  return `"${s.replace(/"/g, '""')}"`;
}

function latestWatchedDateFor(filmId, fallbackAddedMs){
  const filmViewings = viewings.filter(v => v.filmId === filmId);
  const ms = filmViewings.length > 0
    ? Math.max(...filmViewings.map(v => v.watchedAt))
    : fallbackAddedMs;
  return new Date(ms).toISOString().slice(0, 10);
}

function exportFilmsToLetterboxd(){
  if(films.length === 0){
    showToast('Aucun film à exporter');
    return;
  }
  const header = ['Title', 'Year', 'tmdbID', 'WatchedDate', 'Rating', 'Review'];
  const rows = films.map(f => [
    f.title,
    f.releaseYear || '',
    f.tmdbId || '',
    latestWatchedDateFor(f.id, f.added),
    getDisplayNote(f) ?? '',
    f.review || ''
  ].map(csvEscape).join(','));
  const csv = [header.join(','), ...rows].join('\r\n');

  // Limite Letterboxd de 1 Mo par fichier (voir leur page d'aide à
  // l'import) — un catalogue perso reste très en dessous en pratique,
  // pas de découpage en plusieurs fichiers nécessaire ici.
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `critique-films-letterboxd-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('CSV téléchargé — à importer sur letterboxd.com/import');
}

document.getElementById('exportLetterboxdBtn').addEventListener('click', exportFilmsToLetterboxd);

document.getElementById('manualToggle').addEventListener('change', updateManualVisibility);
document.getElementById('manualScoreSlider').addEventListener('input', (e) => {
  document.getElementById('manualScoreVal').textContent = parseFloat(e.target.value).toFixed(2);
  updateLiveScore();
});
document.getElementById('openAddBtn').addEventListener('click', () => openModal(null));
document.getElementById('fabAddBtn').addEventListener('click', () => openModal(null));
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('deleteBtn').addEventListener('click', handleDelete);
document.getElementById('overlay').addEventListener('click', (e) => {
  if(e.target.id === 'overlay') closeModal();
});
document.getElementById('search').addEventListener('input', () => { currentPage = 1; render(); });

// Le sélecteur avancé (#sortAdvancedRow : critère, sens, seuil) n'a de sens
// qu'en mode "Par critère…" — masqué et remis à zéro sinon, pour ne pas
// laisser un filtre invisible actif après être revenu à "Note globale".
function updateSortMode(){
  const active = document.getElementById('sortBy').value === 'advanced';
  document.getElementById('sortAdvancedRow').style.display = active ? '' : 'none';
  if(!active){
    sortDir = 'desc';
    document.getElementById('sortDirDesc').classList.add('active');
    document.getElementById('sortDirDesc').setAttribute('aria-pressed', 'true');
    document.getElementById('sortDirAsc').classList.remove('active');
    document.getElementById('sortDirAsc').setAttribute('aria-pressed', 'false');
    document.getElementById('critFilterMin').value = 0;
    document.getElementById('critFilterMinVal').textContent = '0.00';
  }
}
document.getElementById('sortBy').addEventListener('change', () => {
  currentPage = 1;
  updateSortMode();
  render();
});
document.getElementById('sortCriterion').addEventListener('change', () => { currentPage = 1; render(); });
function setSortDir(dir){
  sortDir = dir;
  document.getElementById('sortDirDesc').classList.toggle('active', dir === 'desc');
  document.getElementById('sortDirDesc').setAttribute('aria-pressed', String(dir === 'desc'));
  document.getElementById('sortDirAsc').classList.toggle('active', dir === 'asc');
  document.getElementById('sortDirAsc').setAttribute('aria-pressed', String(dir === 'asc'));
  currentPage = 1;
  render();
}
document.getElementById('sortDirDesc').addEventListener('click', () => setSortDir('desc'));
document.getElementById('sortDirAsc').addEventListener('click', () => setSortDir('asc'));
document.getElementById('critFilterMin').addEventListener('input', (e) => {
  document.getElementById('critFilterMinVal').textContent = parseFloat(e.target.value).toFixed(2);
  currentPage = 1;
  render();
});
document.getElementById('exportBtn').addEventListener('click', exportFilms);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) importFilms(file);
  e.target.value = ''; // permet de réimporter le même fichier
});

// --- Menu "⋯" (Exporter / Importer) ---
function toggleMoreMenu(open){
  const wrap = document.getElementById('moreMenuWrap');
  const btn = document.getElementById('moreMenuBtn');
  const isOpen = open !== undefined ? open : !wrap.classList.contains('open');
  wrap.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', String(isOpen));
}
document.getElementById('moreMenuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMoreMenu();
});
document.getElementById('moreMenu').addEventListener('click', () => toggleMoreMenu(false));
document.addEventListener('click', (e) => {
  if(!document.getElementById('moreMenuWrap').contains(e.target)) toggleMoreMenu(false);
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') toggleMoreMenu(false);
});

// L'initialisation (chargement des films + premier rendu) est déclenchée par
// js/auth.js une fois la session utilisateur confirmée — voir showApp().
