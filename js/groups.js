// --- Groupes (famille/amis) ---
// Le créateur devient automatiquement membre (trigger DB, voir
// supabase/migrations/011). Ajouter un membre se fait uniquement parmi ses
// propres amis acceptés (js/friends.js) — pas de flux invitation séparé pour
// ce premier jet, la relation d'amitié fait déjà office de consentement.
// Réutilise les briques d'affichage de js/friends.js (cacheProfile,
// friendRowHtml, otherUserId...) plutôt que de les dupliquer.

let groups = [];
let groupMembersCache = {}; // groupId -> [{ userId, joinedAt }]
let currentGroupId = null; // groupe actuellement ouvert dans groupDetailOverlay, lu par js/proposals.js

function rowToGroup(row){
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    ownerId: row.owner_id,
    createdAt: row.created_at
  };
}

async function loadGroups(){
  const { data, error } = await supabaseClient
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });
  if(error){
    showToast('Erreur de chargement des groupes');
    console.error(error);
    groups = [];
    return;
  }
  groups = data.map(rowToGroup);
}

function renderGroupsModal(){
  const list = document.getElementById('groupsList');
  if(groups.length === 0){
    list.innerHTML = `<div class="tmdb-empty">Pas encore de groupe — crée le premier ci-dessus.</div>`;
    return;
  }
  list.innerHTML = groups.map(g => `
    <div class="wl-row">
      <div class="friend-avatar friend-avatar-placeholder">🎭</div>
      <div class="wl-main">
        <div class="wl-title">${escapeHtml(g.name)}</div>
        ${g.description ? `<div class="wl-note">${escapeHtml(g.description)}</div>` : ''}
      </div>
      <div class="wl-actions">
        <button class="btn secondary" data-id="${g.id}" type="button">Ouvrir</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => openGroupDetail(parseInt(btn.dataset.id, 10)));
  });
}

async function handleCreateGroup(){
  const name = document.getElementById('groupNameInput').value.trim();
  if(!name){
    showToast('Ajoute un nom avant de créer le groupe');
    return;
  }
  const description = document.getElementById('groupDescInput').value.trim() || null;
  const { data, error } = await supabaseClient
    .from('groups')
    .insert({ name, description, owner_id: currentUser.id })
    .select()
    .single();
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  groups.unshift(rowToGroup(data));
  document.getElementById('groupNameInput').value = '';
  document.getElementById('groupDescInput').value = '';
  renderGroupsModal();
  showToast('Groupe créé');
}

async function openGroups(){
  document.getElementById('groupsOverlay').classList.add('open');
  document.getElementById('groupsList').innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
  document.getElementById('groupNameInput').value = '';
  document.getElementById('groupDescInput').value = '';
  await loadGroups();
  renderGroupsModal();
}

function closeGroups(){
  document.getElementById('groupsOverlay').classList.remove('open');
}

document.getElementById('groupsBtn').addEventListener('click', openGroups);
document.getElementById('closeGroups').addEventListener('click', closeGroups);
document.getElementById('groupsOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'groupsOverlay') closeGroups();
});
document.getElementById('createGroupBtn').addEventListener('click', handleCreateGroup);

// --- Détail d'un groupe : membres + ajout d'amis + quitter/supprimer ---

async function loadGroupMembers(groupId){
  const { data, error } = await supabaseClient
    .from('group_members')
    .select('user_id, joined_at')
    .eq('group_id', groupId);
  if(error){
    showToast('Erreur de chargement des membres');
    console.error(error);
    return [];
  }
  const ids = data.map(r => r.user_id);
  if(ids.length > 0){
    const { data: profs, error: profErr } = await supabaseClient
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', ids);
    if(profErr) console.error(profErr);
    else profs.forEach(p => cacheProfile(p.user_id, p.display_name, p.avatar_url));
  }
  return data.map(r => ({ userId: r.user_id, joinedAt: r.joined_at }));
}

function renderGroupDetail(group, members){
  const isOwner = group.ownerId === currentUser.id;
  document.getElementById('groupDetailTitle').textContent = group.name;
  const descEl = document.getElementById('groupDetailDesc');
  descEl.textContent = group.description || '';
  descEl.style.display = group.description ? '' : 'none';

  const memberIds = members.map(m => m.userId);

  const membersEl = document.getElementById('groupMembersList');
  membersEl.innerHTML = members.map(m => {
    const isSelf = m.userId === currentUser.id;
    const isMemberOwner = m.userId === group.ownerId;
    let actions = '';
    if(isMemberOwner) actions = `<span class="wl-note">Créateur</span>`;
    else if(isOwner) actions = `<button class="btn danger" data-user="${m.userId}" type="button">Retirer</button>`;
    else if(isSelf) actions = `<button class="btn secondary" data-leave type="button">Quitter</button>`;
    return friendRowHtml(m.userId, actions);
  }).join('');
  membersEl.querySelectorAll('button[data-user]').forEach(btn => {
    btn.addEventListener('click', () => removeMemberFromGroup(group.id, btn.dataset.user));
  });
  membersEl.querySelectorAll('button[data-leave]').forEach(btn => {
    btn.addEventListener('click', () => leaveGroup(group.id));
  });

  // Ajouter un ami au groupe : réservé au créateur, parmi ses amis acceptés
  // qui n'en font pas déjà partie.
  const addSection = document.getElementById('groupAddFriendSection');
  const addList = document.getElementById('groupAddFriendList');
  if(isOwner){
    addSection.style.display = '';
    const candidates = friendships
      .filter(f => f.status === 'accepted')
      .map(otherUserId)
      .filter(uid => !memberIds.includes(uid));
    addList.innerHTML = candidates.length === 0
      ? `<div class="tmdb-empty">Tous tes amis sont déjà dans ce groupe (ou tu n'as pas encore d'ami — voir 👥 Amis).</div>`
      : candidates.map(uid => friendRowHtml(uid, `<button class="btn" data-add="${uid}" type="button">Ajouter</button>`)).join('');
    addList.querySelectorAll('button[data-add]').forEach(btn => {
      btn.addEventListener('click', () => addMemberToGroup(group.id, btn.dataset.add));
    });
  }else{
    addSection.style.display = 'none';
  }

  const footer = document.getElementById('groupDetailFooter');
  footer.innerHTML = isOwner
    ? `<button class="btn danger" id="deleteGroupBtn" type="button">Supprimer le groupe</button>`
    : `<button class="btn danger" id="leaveGroupBtn" type="button">Quitter le groupe</button>`;
  if(isOwner) document.getElementById('deleteGroupBtn').addEventListener('click', () => deleteGroup(group.id));
  else document.getElementById('leaveGroupBtn').addEventListener('click', () => leaveGroup(group.id));
}

async function openGroupDetail(groupId){
  const group = groups.find(g => g.id === groupId);
  if(!group) return;
  currentGroupId = groupId;
  document.getElementById('groupDetailTitle').textContent = group.name;
  document.getElementById('groupMembersList').innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
  document.getElementById('groupAddFriendSection').style.display = 'none';
  document.getElementById('groupDetailFooter').innerHTML = '';
  document.getElementById('groupProposalsList').innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
  document.getElementById('proposalTitleInput').value = '';
  clearProposalTmdbSelection();
  document.getElementById('groupDetailOverlay').classList.add('open');

  const members = await loadGroupMembers(groupId);
  groupMembersCache[groupId] = members;
  renderGroupDetail(group, members);

  await loadProposals(groupId);
  renderGroupProposals();
}

function closeGroupDetailOnly(){
  document.getElementById('groupDetailOverlay').classList.remove('open');
  currentGroupId = null;
}

// Fermeture explicite (✕/clic dehors) : referme aussi la liste "Groupes" en
// dessous et le détail d'une proposition s'il est ouvert par-dessus, même
// logique que pour le profil d'un ami (js/friends.js) — sinon on reste
// coincé entre modals. Les actions internes (quitter/supprimer) utilisent
// closeGroupDetailOnly() à la place, pour rester sur la liste mise à jour
// plutôt que d'être renvoyé jusqu'à l'app.
function closeGroupDetail(){
  closeProposalDetail();
  closeGroupDetailOnly();
  closeGroups();
}

document.getElementById('closeGroupDetail').addEventListener('click', closeGroupDetail);
document.getElementById('groupDetailOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'groupDetailOverlay') closeGroupDetail();
});

async function addMemberToGroup(groupId, userId){
  const { error } = await supabaseClient.from('group_members').insert({ group_id: groupId, user_id: userId });
  if(error){
    showToast(error.code === '23505' ? 'Déjà membre' : 'Erreur — réessaie');
    console.error(error);
    return;
  }
  const members = await loadGroupMembers(groupId);
  groupMembersCache[groupId] = members;
  renderGroupDetail(groups.find(g => g.id === groupId), members);
  showToast('Ajouté au groupe');
}

async function removeMemberFromGroup(groupId, userId){
  if(!confirm('Retirer cette personne du groupe ?')) return;
  const { error } = await supabaseClient.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  const members = (groupMembersCache[groupId] || []).filter(m => m.userId !== userId);
  groupMembersCache[groupId] = members;
  renderGroupDetail(groups.find(g => g.id === groupId), members);
  showToast('Retiré du groupe');
}

async function leaveGroup(groupId){
  const { error } = await supabaseClient.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  groups = groups.filter(g => g.id !== groupId);
  closeGroupDetailOnly();
  renderGroupsModal();
  showToast('Tu as quitté le groupe');
}

async function deleteGroup(groupId){
  if(!confirm('Supprimer définitivement ce groupe ? Tous les membres seront retirés.')) return;
  const { error } = await supabaseClient.from('groups').delete().eq('id', groupId);
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  groups = groups.filter(g => g.id !== groupId);
  closeGroupDetailOnly();
  renderGroupsModal();
  showToast('Groupe supprimé');
}
