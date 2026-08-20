// --- Persistance ---
// NB : ce projet tourne comme un vrai site (ouvert en fichier local ou hébergé),
// donc on utilise localStorage. Sur claude.ai l'API était window.storage
// (propre au bac à sable des artifacts) — hors de claude.ai on repasse
// sur l'API standard du navigateur.
const STORAGE_KEY = 'critique-films-data';

let films = [];
let editingId = null;
let idCounter = 1;

function computeNote(critObj){
  const vals = CRITERIA.map(c => critObj[c.key]).filter(v => typeof v === 'number');
  if(vals.length === 0) return null;
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  return Math.round(avg*10) / 2;
}

// L'ancien référentiel (Excel) était [impression, scenario, realisation, jeu, image, son, musique].
// On le remappe vers les nouvelles clés les plus proches sur le fond.
const OLD_ORDER_TO_NEW_KEY = ['ressenti', 'scenario', 'mise_en_scene', 'jeu', 'esthetique', 'son', 'musique'];

function seedToFilms(seed){
  return seed.map(s => {
    const critObj = {};
    OLD_ORDER_TO_NEW_KEY.forEach((key,i) => critObj[key] = s.c[i]);
    return {
      id: idCounter++,
      title: s.t.trim(),
      crit: critObj,
      fav: !!s.f,
      added: Date.now() - (seed.length - idCounter) * 1000
    };
  });
}

function loadFilms(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      films = parsed.films || [];
      idCounter = parsed.idCounter || (films.length + 1);
      return;
    }
  }catch(e){
    console.error(e);
  }
  films = seedToFilms(SEED);
  saveFilms();
}

function saveFilms(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ films, idCounter }));
  }catch(e){
    showToast('Erreur de sauvegarde — réessaie');
    console.error(e);
  }
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), 2200);
}

function buildSprockets(){
  const el = document.getElementById('sprocketsTop');
  el.innerHTML = '';
  for(let i=0;i<40;i++){
    const s = document.createElement('span');
    el.appendChild(s);
  }
}

function render(){
  const list = document.getElementById('filmList');
  const countLine = document.getElementById('countLine');
  const search = document.getElementById('search').value.trim().toLowerCase();
  const sortBy = document.getElementById('sortBy').value;

  let filtered = films.filter(f => f.title.toLowerCase().includes(search));

  filtered.sort((a,b) => {
    if(sortBy === 'note-desc') return (computeNote(b.crit)||0) - (computeNote(a.crit)||0);
    if(sortBy === 'note-asc') return (computeNote(a.crit)||0) - (computeNote(b.crit)||0);
    if(sortBy === 'title-asc') return a.title.localeCompare(b.title, 'fr');
    if(sortBy === 'fav-first') return (b.fav - a.fav) || ((computeNote(b.crit)||0) - (computeNote(a.crit)||0));
    if(sortBy === 'recent') return b.added - a.added;
    return 0;
  });

  countLine.textContent = `${filtered.length} film${filtered.length>1?'s':''} ${search ? '(filtré)' : 'au catalogue'}`;

  if(filtered.length === 0){
    list.innerHTML = `<div class="empty-state">Aucun film. Clique sur « + Ajouter un film » pour commencer une nouvelle pellicule.</div>`;
    return;
  }

  list.innerHTML = '';
  filtered.forEach(f => {
    const note = computeNote(f.crit);
    const row = document.createElement('div');
    row.className = 'film-row';
    row.innerHTML = `
      <div class="holes"><span></span><span></span><span></span></div>
      <div class="film-main">
        <div class="film-title">${escapeHtml(f.title)}</div>
        <div class="film-sub">7 critères notés</div>
      </div>
      <button class="star-btn ${f.fav ? 'active' : ''}" data-id="${f.id}" title="Favori">${f.fav ? '★' : '☆'}</button>
      <div class="counter">${note !== null ? note.toFixed(1) : '—'}</div>
    `;
    row.addEventListener('click', (e) => {
      if(e.target.classList.contains('star-btn')) return;
      openModal(f.id);
    });
    row.querySelector('.star-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      f.fav = !f.fav;
      saveFilms();
      render();
    });
    list.appendChild(row);
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

function updateLiveScore(){
  const critObj = readCriteriaFromForm();
  const note = computeNote(critObj);
  document.getElementById('liveScore').textContent = note !== null ? note.toFixed(1) : '—';
}

function openModal(id){
  editingId = id || null;
  const overlay = document.getElementById('overlay');
  const film = id ? films.find(f => f.id === id) : null;

  document.getElementById('modalTitle').textContent = film ? 'Modifier le film' : 'Nouveau film';
  document.getElementById('titleInput').value = film ? film.title : '';
  document.getElementById('deleteBtn').style.display = film ? 'inline-block' : 'none';
  buildCriteriaInputs(film ? film.crit : null);

  overlay.classList.add('open');
  document.getElementById('titleInput').focus();
}

function closeModal(){
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}

function handleSave(){
  const title = document.getElementById('titleInput').value.trim();
  if(!title){
    showToast('Ajoute un titre avant d\'enregistrer');
    return;
  }
  const crit = readCriteriaFromForm();

  if(editingId){
    const film = films.find(f => f.id === editingId);
    film.title = title;
    film.crit = crit;
  }else{
    films.push({ id: idCounter++, title, crit, fav:false, added: Date.now() });
  }
  saveFilms();
  closeModal();
  render();
  showToast('Film enregistré');
}

function handleDelete(){
  if(!editingId) return;
  films = films.filter(f => f.id !== editingId);
  saveFilms();
  closeModal();
  render();
  showToast('Film supprimé');
}

// --- Export / Import JSON ---

function exportFilms(){
  const data = {
    app: 'critique-films',
    version: 1,
    exportedAt: new Date().toISOString(),
    idCounter,
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
  reader.onload = () => {
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

    if(replace) films = [];

    importedFilms.forEach(f => {
      films.push({
        id: idCounter++,
        title: f.title.trim(),
        crit: f.crit,
        fav: !!f.fav,
        added: typeof f.added === 'number' ? f.added : Date.now()
      });
    });

    saveFilms();
    render();
    showToast(replace ? 'Catalogue remplacé' : 'Films ajoutés');
  };
  reader.onerror = () => showToast('Impossible de lire le fichier');
  reader.readAsText(file);
}

document.getElementById('openAddBtn').addEventListener('click', () => openModal(null));
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('deleteBtn').addEventListener('click', handleDelete);
document.getElementById('overlay').addEventListener('click', (e) => {
  if(e.target.id === 'overlay') closeModal();
});
document.getElementById('search').addEventListener('input', render);
document.getElementById('sortBy').addEventListener('change', render);
document.getElementById('exportBtn').addEventListener('click', exportFilms);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) importFilms(file);
  e.target.value = ''; // permet de réimporter le même fichier
});

(function init(){
  buildSprockets();
  loadFilms();
  render();
})();
