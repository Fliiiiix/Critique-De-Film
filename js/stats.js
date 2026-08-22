// --- Statistiques ---
// Tout calculé côté client à partir de `films` déjà chargé — pas de requête
// dédiée. Un seul hue (amber, celui de l'app) pour les barres : ce sont des
// séries uniques (magnitude), pas des comparaisons catégorielles.

// list : par défaut le catalogue de l'utilisateur connecté, mais peut être
// n'importe quelle liste de films au même format (ex. le catalogue d'un ami
// en lecture seule, voir openFriendProfile() dans js/friends.js).
function computeStats(list = films){
  const rated = list.filter(f => getDisplayNote(f) !== null);
  const notes = rated.map(getDisplayNote);
  const avg = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;
  const favCount = list.filter(f => f.fav).length;
  const manualCount = list.filter(f => f.manualNote != null).length;
  const gridCount = list.length - manualCount;

  const buckets = [];
  for(let v = 0; v <= 5; v += 0.5) buckets.push(Math.round(v * 10) / 10);
  const distribution = buckets.map(b => ({
    value: b,
    count: notes.filter(n => n === b).length
  }));

  const monthMap = {};
  list.forEach(f => {
    const d = new Date(f.added);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = (monthMap[key] || 0) + 1;
  });
  const months = Object.keys(monthMap).sort();
  const activity = months.map(m => ({ month: m, count: monthMap[m] }));

  let best = null, worst = null;
  rated.forEach(f => {
    const n = getDisplayNote(f);
    if(!best || n > getDisplayNote(best)) best = f;
    if(!worst || n < getDisplayNote(worst)) worst = f;
  });

  return { total: list.length, avg, favCount, manualCount, gridCount, distribution, activity, best, worst };
}

function monthLabel(key){
  const [y, m] = key.split('-');
  const noms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${noms[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

// items: [{label, count}] — une seule barre porte sa valeur en direct (le max),
// les autres se lisent au survol (title natif) pour éviter le bruit visuel.
function renderBarChart(items){
  const max = Math.max(1, ...items.map(i => i.count));
  return `
    <div class="bar-chart">
      ${items.map(i => `
        <div class="bar-col" title="${escapeHtml(i.label)} : ${i.count}">
          <div class="bar-track">
            <div class="bar-fill" style="height:${(i.count / max * 100).toFixed(1)}%">${i.count > 0 && i.count === max ? `<span class="bar-value">${i.count}</span>` : ''}</div>
          </div>
          <div class="bar-label">${escapeHtml(i.label)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// Factorisée pour être réutilisée par le profil (lecture seule) d'un ami —
// voir openFriendProfile() dans js/friends.js — avec un autre conteneur et
// la liste de films de cet ami plutôt que la sienne.
function renderStatsInto(content, list = films){
  const s = computeStats(list);

  if(s.total === 0){
    content.innerHTML = `<div class="empty-state">Aucun film noté pour l'instant.</div>`;
    return;
  }

  const distItems = s.distribution.map(d => ({ label: d.value.toFixed(1), count: d.count }));
  const activityItems = s.activity.map(a => ({ label: monthLabel(a.month), count: a.count }));

  content.innerHTML = `
    <div class="stat-tiles">
      <div class="stat-tile"><div class="stat-value">${s.total}</div><div class="stat-label">Films notés</div></div>
      <div class="stat-tile"><div class="stat-value">${s.avg !== null ? s.avg.toFixed(2) : '—'}</div><div class="stat-label">Note moyenne</div></div>
      <div class="stat-tile"><div class="stat-value">${s.favCount}</div><div class="stat-label">Favoris</div></div>
      <div class="stat-tile"><div class="stat-value">${s.gridCount}</div><div class="stat-label">Grille 7 critères</div></div>
      <div class="stat-tile"><div class="stat-value">${s.manualCount}</div><div class="stat-label">Note manuelle</div></div>
    </div>

    <div class="stats-section">
      <div class="stats-section-title">Distribution des notes</div>
      ${renderBarChart(distItems)}
    </div>

    ${activityItems.length > 1 ? `
    <div class="stats-section">
      <div class="stats-section-title">Films ajoutés par mois</div>
      ${renderBarChart(activityItems)}
    </div>` : ''}

    <div class="stats-section stats-extremes">
      ${s.best ? `
      <div class="stats-extreme">
        <div class="stats-extreme-label">Mieux noté</div>
        <div class="stats-extreme-title">${escapeHtml(s.best.title)}</div>
        <div class="stats-extreme-note">${getDisplayNote(s.best).toFixed(1)} / 5</div>
      </div>` : ''}
      ${s.worst && s.worst !== s.best ? `
      <div class="stats-extreme">
        <div class="stats-extreme-label">Moins bien noté</div>
        <div class="stats-extreme-title">${escapeHtml(s.worst.title)}</div>
        <div class="stats-extreme-note">${getDisplayNote(s.worst).toFixed(1)} / 5</div>
      </div>` : ''}
    </div>
  `;
}

function renderStats(){
  renderStatsInto(document.getElementById('statsContent'));
}

function openStats(){
  // Accessible depuis la modale profil ("Mon activité") — la refermer
  // d'abord évite deux modales de tailles différentes superposées.
  closeProfileModal();
  renderStats();
  document.getElementById('statsOverlay').classList.add('open');
}

function closeStats(){
  document.getElementById('statsOverlay').classList.remove('open');
}

document.getElementById('statsBtn').addEventListener('click', openStats);
document.getElementById('closeStats').addEventListener('click', closeStats);
document.getElementById('statsOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'statsOverlay') closeStats();
});
