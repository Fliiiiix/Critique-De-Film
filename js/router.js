// --- Routeur minimaliste (hash-based), pour l'instant réservé à Groupes ---
// Groupes contenait membres + ajout d'amis + propositions + votes +
// discussion, empilé sur 3 niveaux de modal (Groupes > détail groupe >
// détail proposition) — trop pour ce format. Ces trois écrans sont donc de
// vraies pages, sélectionnées par l'URL plutôt que par des .overlay
// imbriquées :
//   (pas de hash)                           -> catalogue (#appContainer)
//   #/groupes                               -> liste des groupes
//   #/groupes/:groupId                      -> détail d'un groupe
//   #/groupes/:groupId/propositions/:propId -> détail d'une proposition
// Amis/Watchlist/Stats/Journal restent des modals classiques (2 niveaux
// max, ça reste raisonnable) — voir js/friends.js, js/watchlist.js, etc.
//
// Pas de framework : hashchange + un switch sur les segments suffisent pour
// 4 écrans. Les fonctions de chargement/rendu (loadGroups, openGroupDetail,
// openProposalDetail...) restent dans js/groups.js et js/proposals.js, ce
// fichier ne fait que décider laquelle appeler.

const PAGE_IDS = ['appContainer', 'groupsListPage', 'groupDetailPage', 'proposalDetailPage'];

// null cache tout (utile pour l'écran de connexion / maintenance, qui gère
// sa propre visibilité par ailleurs).
function showOnlyPage(id){
  PAGE_IDS.forEach(pid => {
    document.getElementById(pid).style.display = (pid === id) ? '' : 'none';
  });
}

function goHome(){ location.hash = ''; }
function goToGroups(){ location.hash = '#/groupes'; }
function goToGroup(groupId){ location.hash = `#/groupes/${groupId}`; }
function goToProposal(groupId, proposalId){ location.hash = `#/groupes/${groupId}/propositions/${proposalId}`; }

function parseRoute(){
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if(parts[0] !== 'groupes') return { name: 'home' };
  if(parts.length === 1) return { name: 'groupsList' };
  const groupId = parseInt(parts[1], 10);
  if(!Number.isFinite(groupId)) return { name: 'home' };
  if(parts.length === 2) return { name: 'groupDetail', groupId };
  if(parts.length === 4 && parts[2] === 'propositions'){
    const proposalId = parseInt(parts[3], 10);
    if(Number.isFinite(proposalId)) return { name: 'proposalDetail', groupId, proposalId };
  }
  return { name: 'home' };
}

// Appelé au hashchange et une fois après connexion (pour gérer un lien
// direct vers une page groupe/proposition, y compris après un F5).
async function renderRoute(){
  if(!currentUser) return;
  const route = parseRoute();
  if(route.name === 'home'){
    showOnlyPage('appContainer');
  }else if(route.name === 'groupsList'){
    showOnlyPage('groupsListPage');
    await openGroups();
  }else if(route.name === 'groupDetail'){
    showOnlyPage('groupDetailPage');
    await openGroupDetail(route.groupId);
  }else if(route.name === 'proposalDetail'){
    showOnlyPage('proposalDetailPage');
    await openProposalDetailRoute(route.groupId, route.proposalId);
  }
}

window.addEventListener('hashchange', renderRoute);
