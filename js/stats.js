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
// opts.clickable (v2.2, retour utilisateur : voir la liste des films
// derrière une barre, ex. "notés 4") — seules les barres non vides le
// deviennent, cliquer une barre vide n'aurait rien à montrer.
function renderBarChart(items, opts = {}){
  const max = Math.max(1, ...items.map(i => i.count));
  const clickable = !!opts.clickable;
  return `
    <div class="bar-chart">
      ${items.map((i, idx) => {
        const active = clickable && i.count > 0;
        return `
        <div class="bar-col${active ? ' bar-col-clickable' : ''}" data-index="${idx}" title="${escapeHtml(i.label)} : ${i.count}"${active ? ' role="button" tabindex="0"' : ''}>
          <div class="bar-track">
            <div class="bar-fill" style="height:${(i.count / max * 100).toFixed(1)}%">${i.count > 0 && i.count === max ? `<span class="bar-value">${i.count}</span>` : ''}</div>
          </div>
          <div class="bar-label">${escapeHtml(i.label)}</div>
        </div>
      `;
      }).join('')}
    </div>
  `;
}

// Ligne d'un film dans le détail derrière une barre — même gabarit que la
// liste du profil d'ami (openFriendProfile(), js/friends.js), dupliqué ici
// plutôt que factorisé : les deux endroits divergent légèrement (celui-ci
// n'a jamais de sous-titre année manquant à gérer différemment) et ce n'est
// que quelques lignes, cohérent avec la duplication déjà assumée ailleurs
// dans ce fichier (recherche TMDB, voir js/tmdb.js).
function statsFilmRowHtml(f){
  const note = getDisplayNote(f);
  return `
    <div class="film-row friend-film-row"${f.tmdbId ? ` data-tmdb-id="${f.tmdbId}"` : ''}>
      ${f.posterUrl
        ? `<img class="film-poster" src="${f.posterUrl}" alt="" loading="lazy">`
        : `<div class="film-poster film-poster-placeholder">${FILM_PLACEHOLDER_SVG}</div>`}
      <div class="film-main">
        <div class="film-title">${escapeHtml(f.title)}</div>
        <div class="film-sub">${f.releaseYear || ''}</div>
      </div>
      <div class="counter ${noteColorClass(note)}">${note !== null ? note.toFixed(1) : '—'}</div>
    </div>
  `;
}

// closeOverlayId : quelle modale refermer avant d'ouvrir la fiche film (la
// page fiche film se rend derrière une modale encore ouverte, invisible tant
// qu'on ne l'a pas fermée à la main sinon) — "statsOverlay" pour ses propres
// stats, "friendProfileOverlay" quand ces stats sont imbriquées dans le
// profil d'un ami (voir openFriendProfile()).
function wireStatsDistribution(content, list, distribution, closeOverlayId){
  const section = content.querySelector('.stats-section-dist');
  if(!section) return;
  const drilldown = section.querySelector('.stats-drilldown');
  let openValue = null;

  section.querySelectorAll('.bar-col-clickable').forEach(col => {
    const activate = () => {
      const value = distribution[parseInt(col.dataset.index, 10)].value;
      section.querySelectorAll('.bar-col').forEach(c => c.classList.remove('bar-col-active'));
      if(openValue === value){
        openValue = null;
        drilldown.hidden = true;
        drilldown.innerHTML = '';
        return;
      }
      openValue = value;
      col.classList.add('bar-col-active');
      const matches = list.filter(f => getDisplayNote(f) === value);
      drilldown.innerHTML = `
        <div class="stats-drilldown-title">Notés ${value.toFixed(1)} (${matches.length})</div>
        ${matches.map(statsFilmRowHtml).join('')}
      `;
      drilldown.hidden = false;
      drilldown.querySelectorAll('.friend-film-row[data-tmdb-id]').forEach(row => {
        row.addEventListener('click', () => {
          if(closeOverlayId) closeOverlay(closeOverlayId);
          goToFilmDetail(parseInt(row.dataset.tmdbId, 10));
        });
      });
    };
    col.addEventListener('click', activate);
    col.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activate(); }
    });
  });
}

// Factorisée pour être réutilisée par le profil (lecture seule) d'un ami —
// voir openFriendProfile() dans js/friends.js — avec un autre conteneur et
// la liste de films de cet ami plutôt que la sienne.
function renderStatsInto(content, list = films, closeOverlayId = null){
  const s = computeStats(list);

  if(s.total === 0){
    content.innerHTML = `<div class="empty-state">Aucun film noté pour l'instant.</div>`;
    return;
  }

  const distItems = s.distribution.map(d => ({ label: d.value.toFixed(1), count: d.count }));
  const activityItems = s.activity.map(a => ({ label: monthLabel(a.month), count: a.count }));

  content.innerHTML = `
    <div class="stat-tiles">
      <div class="stat-tile accent-violet"><div class="stat-value">${s.total}</div><div class="stat-label">Films notés</div></div>
      <div class="stat-tile accent-gradient"><div class="stat-value">${s.avg !== null ? s.avg.toFixed(2) : '—'}</div><div class="stat-label">Note moyenne</div></div>
      <div class="stat-tile accent-bronze"><div class="stat-value">${s.favCount}</div><div class="stat-label">Favoris</div></div>
      <div class="stat-tile accent-violet"><div class="stat-value">${s.gridCount}</div><div class="stat-label">Grille 7 critères</div></div>
      <div class="stat-tile accent-gold"><div class="stat-value">${s.manualCount}</div><div class="stat-label">Note manuelle</div></div>
    </div>

    <div class="stats-section stats-section-dist">
      <div class="stats-section-title">Distribution des notes</div>
      ${renderBarChart(distItems, { clickable: true })}
      <div class="stats-drilldown" hidden></div>
    </div>

    ${activityItems.length > 1 ? `
    <div class="stats-section">
      <div class="stats-section-title">Films ajoutés par mois</div>
      ${renderBarChart(activityItems)}
    </div>` : ''}

    <div class="stats-section stats-extremes">
      ${s.best ? `
      <div class="stats-extreme">
        ${s.best.posterUrl
          ? `<img class="stats-extreme-poster" src="${s.best.posterUrl}" alt="" loading="lazy">`
          : `<div class="stats-extreme-poster stats-extreme-poster-placeholder">${FILM_PLACEHOLDER_SVG}</div>`}
        <div class="stats-extreme-info">
          <div class="stats-extreme-label">Mieux noté</div>
          <div class="stats-extreme-title">${escapeHtml(s.best.title)}</div>
          <div class="stats-extreme-note">${getDisplayNote(s.best).toFixed(1)} / 5</div>
        </div>
      </div>` : ''}
      ${s.worst && s.worst !== s.best ? `
      <div class="stats-extreme">
        ${s.worst.posterUrl
          ? `<img class="stats-extreme-poster" src="${s.worst.posterUrl}" alt="" loading="lazy">`
          : `<div class="stats-extreme-poster stats-extreme-poster-placeholder">${FILM_PLACEHOLDER_SVG}</div>`}
        <div class="stats-extreme-info">
          <div class="stats-extreme-label">Moins bien noté</div>
          <div class="stats-extreme-title">${escapeHtml(s.worst.title)}</div>
          <div class="stats-extreme-note">${getDisplayNote(s.worst).toFixed(1)} / 5</div>
        </div>
      </div>` : ''}
    </div>
  `;

  wireStatsDistribution(content, list, s.distribution, closeOverlayId);
}

function renderStats(){
  renderStatsInto(document.getElementById('statsContent'), films, 'statsOverlay');
}

function openStats(){
  // Accessible depuis la modale profil ("Mon activité") — la refermer
  // d'abord évite deux modales de tailles différentes superposées.
  closeProfileModal();
  renderStats();
  openOverlay('statsOverlay');
}

// Rouvre la modale profil (pas juste closeOverlay simple) : Statistiques
// n'est accessible QUE depuis "Mon activité" dans le profil (voir
// #statsBtn, index.html) — en ressortir doit ramener là où on était, pas
// sortir entièrement du profil comme si on abandonnait toute la modale.
function closeStats(){
  closeOverlay('statsOverlay', () => openProfileModal());
}

document.getElementById('statsBtn').addEventListener('click', openStats);
document.getElementById('closeStats').addEventListener('click', closeStats);
document.getElementById('statsOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'statsOverlay') closeStats();
});
