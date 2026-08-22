// --- Routeur minimaliste (hash-based) ---
// Groupes contenait membres + ajout d'amis + propositions + votes +
// discussion, empilé sur 3 niveaux de modal (Groupes > détail groupe >
// détail proposition) — trop pour ce format. Watchlist et Amis ont suivi le
// même traitement (contenu trop riche, ou destination assez fréquente pour
// mériter une URL propre plutôt qu'être noyée dans une popup) :
//   (pas de hash)                           -> catalogue (#appContainer)
//   #/watchlist                             -> liste "à voir"
//   #/amis                                  -> amis (demandes, liste) + accès Groupes
//   #/groupes                               -> liste des groupes
//   #/groupes/:groupId                      -> détail d'un groupe
//   #/groupes/:groupId/propositions/:propId -> détail d'une proposition
// Stats/Succès/Journal (vues sur mon activité passée, pas des actions) et le
// profil (identité + déconnexion) restent des modals classiques, ouvertes
// depuis l'entête ou la page Amis — voir js/profile.js, js/stats.js,
// js/achievements.js, js/journal.js.
//
// Pas de framework : hashchange + un switch sur les segments suffisent pour
// ces écrans. Les fonctions de chargement/rendu (loadGroups, openGroupDetail,
// openProposalDetail, openWatchlist, openFriends...) restent dans
// js/groups.js, js/proposals.js, js/watchlist.js et js/friends.js — ce
// fichier ne fait que décider laquelle appeler.

const PAGE_IDS = ['appContainer', 'groupsListPage', 'groupDetailPage', 'proposalDetailPage', 'watchlistPage', 'amisPage'];

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
function goToWatchlist(){ location.hash = '#/watchlist'; }
function goToAmis(){ location.hash = '#/amis'; }

function parseRoute(){
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if(parts[0] === 'watchlist' && parts.length === 1) return { name: 'watchlist' };
  if(parts[0] === 'amis' && parts.length === 1) return { name: 'amis' };
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
  }else if(route.name === 'watchlist'){
    showOnlyPage('watchlistPage');
    await openWatchlist();
  }else if(route.name === 'amis'){
    showOnlyPage('amisPage');
    await openFriends();
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

// Titre "Critique de films" cliquable = retour à l'accueil en 1 clic depuis
// n'importe quelle page (le header est toujours visible hors modal — voir
// css .overlay qui les recouvre). div+role="link" plutôt que <button> car
// un <h1> n'est pas un contenu autorisé dans <button> (phrasing content).
const homeLinkEl = document.getElementById('homeLink');
homeLinkEl.addEventListener('click', goHome);
homeLinkEl.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); goHome(); }
});
