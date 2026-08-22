// --- Profil public (#/u/:userId) ---
// Seule page de l'app accessible SANS connexion — un lien à partager, voir
// js/router.js et js/auth.js → initAuth(). Toute la lecture passe par la
// fonction SECURITY DEFINER get_public_profile() (supabase/migrations/016)
// qui ne renvoie que pseudo/avatar + un résumé du catalogue (jamais
// l'email ni le commentaire libre), et rien du tout si le propriétaire n'a
// pas coché "Profil public" dans sa propre modale profil (js/profile.js).

function publicProfileFilmRowHtml(f){
  return `
    <div class="film-row friend-film-row">
      ${f.poster_url
        ? `<img class="film-poster" src="${f.poster_url}" alt="" loading="lazy">`
        : `<div class="film-poster film-poster-placeholder">🎬</div>`}
      <div class="film-main">
        <div class="film-title">${escapeHtml(f.title)}${f.fav ? ' <span title="Favori">★</span>' : ''}</div>
        <div class="film-sub">${f.release_year || ''}</div>
      </div>
      <div class="counter">${f.note !== null && f.note !== undefined ? Number(f.note).toFixed(1) : '—'}</div>
    </div>
  `;
}

async function renderPublicProfilePage(userId){
  const content = document.getElementById('publicProfileContent');
  content.innerHTML = `<div class="tmdb-empty">Chargement…</div>`;

  const { data, error } = await supabaseClient.rpc('get_public_profile', { p_user_id: userId });
  // La fonction renvoie 0 ou 1 ligne (voir migrations/016) — rpc() sur une
  // fonction "table" renvoie un tableau, pas un objet direct.
  const row = Array.isArray(data) ? data[0] : data;
  // 0 ligne = profil inexistant OU resté privé, get_public_profile() ne fait
  // pas la différence — donc pas nous non plus ici.
  if(error || !row){
    content.innerHTML = `<div class="empty-state">Ce profil n'existe pas ou n'est pas public.</div>`;
    if(error) console.error(error);
    return;
  }

  const films = row.films || [];
  const notes = films.map(f => f.note).filter(n => typeof n === 'number');
  const avgNote = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;
  const favCount = films.filter(f => f.fav).length;
  const name = row.display_name || 'Cinéphile';

  const listHtml = films.length === 0
    ? `<div class="empty-state">Aucun film noté pour l'instant.</div>`
    : films.map(publicProfileFilmRowHtml).join('');

  content.innerHTML = `
    <div class="public-profile-header">
      ${row.avatar_url
        ? `<img src="${row.avatar_url}" alt="">`
        : `<div class="avatar-fallback">👤</div>`}
      <h3>${escapeHtml(name)}</h3>
    </div>
    <div class="stat-tiles">
      <div class="stat-tile"><div class="stat-value">${films.length}</div><div class="stat-label">Films notés</div></div>
      <div class="stat-tile"><div class="stat-value">${avgNote !== null ? avgNote.toFixed(2) : '—'}</div><div class="stat-label">Note moyenne</div></div>
      <div class="stat-tile"><div class="stat-value">${favCount}</div><div class="stat-label">Favoris</div></div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Catalogue (${films.length})</div>
      ${listHtml}
    </div>
  `;
}

// Retour : vers l'accueil si connecté, vers l'écran de connexion sinon —
// goHome() seul ne suffirait pas dans ce dernier cas (renderRoute() ignore
// la route "home" tant que currentUser est vide, voir js/router.js).
document.getElementById('publicProfileBack').addEventListener('click', () => {
  if(currentUser) goHome();
  else showAuthScreen();
});
