// --- Prochainement (#/prochainement) ---
// Agrège ce que l'utilisateur suit déjà — pas une découverte de
// nouveautés non ajoutées : (a) les films de la watchlist (js/watchlist.js)
// ayant une date de sortie future connue (migrations/025), et (b) pour
// chaque série suivie (js/series.js) encore susceptible de sortir un
// épisode, son prochain épisode à venir (TMDB `next_episode_to_air`).
// Les séries dont le statut est "Ended"/"Cancelled" (ne produiront plus
// jamais de saison) sont affichées à part, avec un badge clair, plutôt que
// simplement omises — demande explicite de l'utilisateur.
//
// Dépend de watchlist.js ET series.js (chargés avant, voir index.html) :
// réutilise leurs tableaux déjà chargés plutôt que de dupliquer le
// chargement, et les recharge si vides (accès direct par URL, comme
// openGroupDetail() dans js/groups.js).

let upcomingSoon = [];       // [{ type, key, title, posterUrl, date, dateObj, sub }]
let upcomingEndedShows = []; // séries "Ended"/"Cancelled" suivies

async function loadUpcoming(){
  if(watchlist.length === 0) await loadWatchlist();
  if(trackedShows.length === 0) await loadTrackedShows();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const soonItems = [];

  watchlist.forEach(item => {
    if(!item.releaseDate) return; // pas de fiche TMDB, ou ajouté avant migrations/025
    const d = new Date(item.releaseDate + 'T00:00:00');
    if(d < today) return; // déjà sorti : plus "à venir"
    soonItems.push({
      type: 'movie',
      key: `movie-${item.id}`,
      title: item.title,
      posterUrl: item.posterUrl,
      date: item.releaseDate,
      dateObj: d,
      sub: 'Film'
    });
  });

  const endedShows = [];
  // Un appel TMDB par série encore en vie (pas "Ended"/"Cancelled") — évité
  // pour celles déjà connues comme terminées, ni utile ni souhaité.
  await Promise.all(trackedShows.map(async show => {
    if(isShowEnded(show.status)){
      endedShows.push(show);
      return;
    }
    let details;
    try{
      details = await fetchTvDetails(show.tmdbId);
    }catch(e){
      console.error(e);
      return;
    }
    const next = details.next_episode_to_air;
    if(!next || !next.air_date) return;
    const d = new Date(next.air_date + 'T00:00:00');
    if(d < today) return;
    soonItems.push({
      type: 'episode',
      key: `show-${show.id}`,
      showId: show.id,
      title: show.title,
      posterUrl: show.posterUrl,
      date: next.air_date,
      dateObj: d,
      sub: `S${String(next.season_number).padStart(2, '0')}E${String(next.episode_number).padStart(2, '0')}${next.name ? ' · ' + next.name : ''}`
    });
  }));

  soonItems.sort((a, b) => a.dateObj - b.dateObj);
  upcomingSoon = soonItems;
  upcomingEndedShows = endedShows;
}

// formatDateFr() : voir js/series.js (chargé avant, même style d'entête
// que renderChosenBanner() dans js/groups.js).
function upcomingRowHtml(item){
  const dateLabel = formatDateFr(item.date);
  return `
    <div class="wl-row">
      ${item.posterUrl
        ? `<img class="film-poster" src="${item.posterUrl}" alt="" loading="lazy">`
        : `<div class="film-poster film-poster-placeholder">${item.type === 'episode' ? '📺' : '🎬'}</div>`}
      <div class="wl-main">
        <div class="wl-title">${escapeHtml(item.title)}</div>
        <div class="wl-note">${escapeHtml(item.sub)}${dateLabel ? ` · ${dateLabel}` : ''}</div>
      </div>
    </div>
  `;
}

function upcomingEndedRowHtml(show){
  return `
    <div class="wl-row">
      ${show.posterUrl
        ? `<img class="film-poster" src="${show.posterUrl}" alt="" loading="lazy">`
        : `<div class="film-poster film-poster-placeholder">📺</div>`}
      <div class="wl-main">
        <div class="wl-title">${escapeHtml(show.title)}</div>
        <div class="wl-note"><span class="status-badge ended">${escapeHtml(showStatusLabel(show.status))}</span> — plus aucune nouvelle saison prévue</div>
      </div>
      <div class="wl-actions">
        <button class="btn secondary" data-id="${show.id}" type="button">Ouvrir</button>
      </div>
    </div>
  `;
}

function renderUpcoming(){
  const soonEl = document.getElementById('upcomingSoonList');
  soonEl.innerHTML = upcomingSoon.length === 0
    ? `<div class="empty-state">Rien de prévu pour l'instant — ajoute des films à ta watchlist ou suis des séries encore en diffusion.</div>`
    : upcomingSoon.map(upcomingRowHtml).join('');

  const endedEl = document.getElementById('upcomingEndedList');
  endedEl.innerHTML = upcomingEndedShows.length === 0
    ? `<div class="empty-state">Aucune série terminée parmi celles que tu suis.</div>`
    : upcomingEndedShows.map(upcomingEndedRowHtml).join('');
  endedEl.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => goToSeriesDetail(parseInt(btn.dataset.id, 10)));
  });
}

// Page Prochainement — appelée par le routeur (#/prochainement).
async function openUpcoming(){
  document.getElementById('upcomingSoonList').innerHTML = `<div class="empty-state">Chargement…</div>`;
  document.getElementById('upcomingEndedList').innerHTML = `<div class="empty-state">Chargement…</div>`;
  await loadUpcoming();
  renderUpcoming();
}

document.getElementById('upcomingBtn').addEventListener('click', goToUpcoming);
document.getElementById('upcomingPageBack').addEventListener('click', goHome);
