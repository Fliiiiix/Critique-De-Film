// --- Amis ---
// Demande / acceptation, et profil en lecture seule (catalogue + stats) d'un
// ami une fois la demande acceptée. Table `friendships` (voir
// supabase/migrations/009) : une ligne par relation, statut pending/accepted/
// declined, symétrique (peu importe qui a demandé une fois accepted).
// La visibilité croisée du catalogue (`films`) est gérée entièrement par
// RLS côté base — ce module ne fait que lire/écrire `friendships`+`profiles`.
//
// Écran à part entière (#/amis), pas une modal — voir js/router.js, même
// principe que Groupes/Watchlist. Un groupe se fait avec des amis, donc
// l'accès à Groupes vit en bas de cette page plutôt que d'avoir sa propre
// icône dans l'entête (#amisGroupsLink, tout en bas de ce fichier).

let friendships = [];
let friendProfiles = {}; // user_id -> { displayName, avatarUrl }
let friendSearchTimer = null;
let friendSearchResults = []; // dernier lot de résultats affichés

function rowToFriendship(row){
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at
  };
}

function otherUserId(f){
  return f.requesterId === currentUser.id ? f.addresseeId : f.requesterId;
}

function friendDisplayName(userId){
  return (friendProfiles[userId] && friendProfiles[userId].displayName) || 'Utilisateur';
}

function friendAvatarUrl(userId){
  return friendProfiles[userId] && friendProfiles[userId].avatarUrl;
}

function cacheProfile(userId, displayName, avatarUrl){
  friendProfiles[userId] = { displayName: displayName || null, avatarUrl: avatarUrl || null };
}

async function loadFriendships(){
  const { data, error } = await supabaseClient
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);
  if(error){
    showToast('Erreur de chargement des amis');
    console.error(error);
    friendships = [];
    return;
  }
  friendships = data.map(rowToFriendship);

  const ids = [...new Set(friendships.map(otherUserId))];
  if(ids.length === 0) return;
  const { data: profs, error: profErr } = await supabaseClient
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', ids);
  if(profErr){
    console.error(profErr);
    return;
  }
  profs.forEach(p => cacheProfile(p.user_id, p.display_name, p.avatar_url));
}

// --- Avatar rond avec repli emoji, réutilisé pour requêtes/amis/résultats ---
function friendAvatarHtml(userId, displayName){
  const url = friendAvatarUrl(userId);
  return url
    ? `<img class="friend-avatar" src="${url}" alt="${escapeHtml(displayName)}">`
    : `<div class="friend-avatar friend-avatar-placeholder">👤</div>`;
}

function friendRowHtml(userId, actionsHtml, subLabel){
  const name = friendDisplayName(userId);
  return `
    <div class="wl-row" data-user-id="${userId}">
      ${friendAvatarHtml(userId, name)}
      <div class="wl-main">
        <div class="wl-title">${escapeHtml(name)}</div>
        ${subLabel ? `<div class="wl-note">${subLabel}</div>` : ''}
      </div>
      <div class="wl-actions">${actionsHtml}</div>
    </div>
  `;
}

function renderFriendsPage(){
  const incoming = friendships.filter(f => f.status === 'pending' && f.addresseeId === currentUser.id);
  const outgoing = friendships.filter(f => f.status === 'pending' && f.requesterId === currentUser.id);
  const accepted = friendships.filter(f => f.status === 'accepted');

  const inEl = document.getElementById('friendRequestsIn');
  const outEl = document.getElementById('friendRequestsOut');
  const listEl = document.getElementById('friendsList');

  inEl.innerHTML = incoming.length === 0
    ? `<div class="tmdb-empty">Aucune demande en attente.</div>`
    : incoming.map(f => friendRowHtml(otherUserId(f), `
        <button class="btn" data-action="accept" data-id="${f.id}" type="button">Accepter</button>
        <button class="btn secondary" data-action="decline" data-id="${f.id}" type="button">Refuser</button>
      `)).join('');

  outEl.innerHTML = outgoing.length === 0
    ? `<div class="tmdb-empty">Aucune demande envoyée.</div>`
    : outgoing.map(f => friendRowHtml(otherUserId(f), `
        <button class="btn secondary" data-action="cancel" data-id="${f.id}" type="button">Annuler</button>
      `, 'En attente')).join('');

  listEl.innerHTML = accepted.length === 0
    ? `<div class="tmdb-empty">Pas encore d'amis — cherche un pseudo ou un email ci-dessus.</div>`
    : accepted.map(f => friendRowHtml(otherUserId(f), `
        <button class="btn secondary" data-action="view" data-id="${f.id}" type="button">Voir</button>
        <button class="btn danger" data-action="remove" data-id="${f.id}" type="button">Retirer</button>
      `)).join('');

  [inEl, outEl, listEl].forEach(el => {
    el.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleFriendAction(btn.dataset.action, parseInt(btn.dataset.id, 10)));
    });
  });
}

async function handleFriendAction(action, friendshipId){
  const f = friendships.find(x => x.id === friendshipId);
  if(!f) return;
  if(action === 'accept') await respondToRequest(friendshipId, true);
  else if(action === 'decline') await respondToRequest(friendshipId, false);
  else if(action === 'cancel' || action === 'remove') await removeFriendship(friendshipId);
  else if(action === 'view') await openFriendProfile(otherUserId(f));
}

async function respondToRequest(id, accept){
  const { error } = await supabaseClient
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', id);
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  if(accept){
    const f = friendships.find(x => x.id === id);
    if(f) f.status = 'accepted';
    renderFriendsPage();
    showToast('Ami ajouté');
  }else{
    // Un refus retire directement la ligne plutôt que de la garder en
    // 'declined' — évite d'encombrer les listes et permet de renvoyer une
    // demande plus tard sans butter sur la contrainte unique.
    await removeFriendship(id, false);
    showToast('Demande refusée');
  }
}

async function removeFriendship(id, notify = true){
  const { error } = await supabaseClient.from('friendships').delete().eq('id', id);
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  friendships = friendships.filter(f => f.id !== id);
  renderFriendsPage();
  if(notify) showToast('Fait');
}

// --- Ajouter un ami (recherche par email exact ou pseudo) ---

function friendshipWith(userId){
  return friendships.find(f => otherUserId(f) === userId);
}

function renderFriendSearchResults(){
  const wrap = document.getElementById('friendSearchResults');
  if(friendSearchResults.length === 0){
    wrap.innerHTML = `<div class="tmdb-empty">Aucun résultat.</div>`;
    return;
  }
  wrap.innerHTML = friendSearchResults.map(p => {
    const existing = friendshipWith(p.user_id);
    let action;
    if(existing && existing.status === 'accepted') action = `<span class="wl-note">Déjà ami</span>`;
    else if(existing && existing.status === 'pending') action = `<span class="wl-note">En attente</span>`;
    else action = `<button class="btn" data-add="${p.user_id}" type="button">Ajouter</button>`;
    return friendRowHtml(p.user_id, action);
  }).join('');
  wrap.querySelectorAll('button[data-add]').forEach(btn => {
    btn.addEventListener('click', () => sendFriendRequest(btn.dataset.add));
  });
}

async function handleFriendSearch(query){
  const wrap = document.getElementById('friendSearchResults');
  wrap.innerHTML = `<div class="tmdb-empty">Recherche…</div>`;
  try{
    let results;
    if(query.includes('@')){
      const { data, error } = await supabaseClient.rpc('find_user_by_email', { search_email: query });
      if(error) throw error;
      results = data || [];
    }else{
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${query}%`)
        .neq('user_id', currentUser.id)
        .limit(8);
      if(error) throw error;
      results = data || [];
    }
    results.forEach(p => cacheProfile(p.user_id, p.display_name, p.avatar_url));
    friendSearchResults = results;
    renderFriendSearchResults();
  }catch(e){
    wrap.innerHTML = `<div class="tmdb-empty">Erreur de recherche.</div>`;
    console.error(e);
  }
}

async function sendFriendRequest(targetUserId){
  // Demande croisée déjà en attente dans l'autre sens : on accepte
  // directement plutôt que de créer un doublon (bloqué de toute façon par
  // la contrainte unique sur (requester_id, addressee_id)).
  const reverse = friendships.find(f => f.requesterId === targetUserId && f.addresseeId === currentUser.id && f.status === 'pending');
  if(reverse){
    await respondToRequest(reverse.id, true);
    renderFriendSearchResults();
    return;
  }

  const { data, error } = await supabaseClient
    .from('friendships')
    .insert({ requester_id: currentUser.id, addressee_id: targetUserId, status: 'pending' })
    .select()
    .single();
  if(error){
    showToast(error.code === '23505' ? 'Demande déjà envoyée' : 'Erreur — réessaie');
    console.error(error);
    return;
  }
  friendships.push(rowToFriendship(data));
  renderFriendsPage();
  renderFriendSearchResults();
  showToast('Demande envoyée');
}

document.getElementById('friendSearchInput').addEventListener('input', () => {
  clearTimeout(friendSearchTimer);
  const query = document.getElementById('friendSearchInput').value.trim();
  if(query.length < 2){
    friendSearchResults = [];
    document.getElementById('friendSearchResults').innerHTML = '';
    return;
  }
  friendSearchTimer = setTimeout(() => handleFriendSearch(query), 350);
});

// --- Page amis (liste + demandes) — appelée par le routeur (#/amis). ---

async function openFriends(){
  document.getElementById('friendRequestsIn').innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
  document.getElementById('friendRequestsOut').innerHTML = '';
  document.getElementById('friendsList').innerHTML = '';
  document.getElementById('friendSearchInput').value = '';
  document.getElementById('friendSearchResults').innerHTML = '';
  await loadFriendships();
  renderFriendsPage();
}

document.getElementById('friendsBtn').addEventListener('click', goToAmis);
document.getElementById('amisPageBack').addEventListener('click', goHome);
document.getElementById('amisGroupsLink').addEventListener('click', goToGroups);

// --- Profil d'un ami (lecture seule : catalogue + stats) ---
// Les films sont lus directement depuis Supabase (pas depuis `films`, qui
// reste le catalogue de l'utilisateur connecté) — accessible grâce à la
// policy RLS "Friends can view shared films" tant que la relation est
// accepted, voir supabase/migrations/009.

async function openFriendProfile(userId){
  document.getElementById('friendProfileTitle').textContent = friendDisplayName(userId);
  const content = document.getElementById('friendProfileContent');
  content.innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
  document.getElementById('friendProfileOverlay').classList.add('open');

  const { data, error } = await supabaseClient
    .from('films')
    .select('*')
    .eq('user_id', userId)
    .order('added', { ascending: false });
  if(error){
    content.innerHTML = `<div class="empty-state">Impossible de charger ce catalogue.</div>`;
    console.error(error);
    return;
  }

  const friendFilms = data.map(rowToFilm);
  const statsEl = document.createElement('div');
  renderStatsInto(statsEl, friendFilms);

  const listHtml = friendFilms.length === 0
    ? `<div class="empty-state">Aucun film noté pour l'instant.</div>`
    : friendFilms
        .slice()
        .sort((a, b) => (getDisplayNote(b) || 0) - (getDisplayNote(a) || 0))
        .map(f => {
          const note = getDisplayNote(f);
          return `
            <div class="film-row friend-film-row">
              ${f.posterUrl
                ? `<img class="film-poster" src="${f.posterUrl}" alt="" loading="lazy">`
                : `<div class="film-poster film-poster-placeholder">🎬</div>`}
              <div class="film-main">
                <div class="film-title">${escapeHtml(f.title)}</div>
                <div class="film-sub">${f.releaseYear || ''}</div>
              </div>
              <div class="counter ${f.manualNote != null ? 'manual' : ''}">${note !== null ? note.toFixed(1) : '—'}</div>
            </div>
          `;
        }).join('');

  content.innerHTML = '';
  content.appendChild(statsEl);
  const listWrap = document.createElement('div');
  listWrap.className = 'stats-section';
  listWrap.innerHTML = `<div class="stats-section-title">Catalogue (${friendFilms.length})</div>${listHtml}`;
  content.appendChild(listWrap);
}

// Amis est une page (pas une modal, voir plus haut) : la refermer suffit,
// elle revient naturellement sur la page Amis en dessous — plus besoin de
// fermer quoi que ce soit d'autre.
function closeFriendProfile(){
  document.getElementById('friendProfileOverlay').classList.remove('open');
}

document.getElementById('closeFriendProfile').addEventListener('click', closeFriendProfile);
document.getElementById('friendProfileOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'friendProfileOverlay') closeFriendProfile();
});
