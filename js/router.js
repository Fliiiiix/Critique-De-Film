// --- Routeur minimaliste (hash-based) ---
// Groupes contenait membres + ajout d'amis + propositions + votes +
// discussion, empilé sur 3 niveaux de modal (Groupes > détail groupe >
// détail proposition) — trop pour ce format. Watchlist et Amis ont suivi le
// même traitement (contenu trop riche, ou destination assez fréquente pour
// mériter une URL propre plutôt qu'être noyée dans une popup) :
//   (pas de hash)                           -> catalogue (#appContainer)
//   #/watchlist                             -> liste "à voir"
//   #/amis                                  -> amis (demandes, liste) + accès Groupes
//   #/top                                   -> top films (tout le monde / mes amis)
//   #/groupes                               -> liste des groupes
//   #/groupes/:groupId                      -> détail d'un groupe
//   #/groupes/:groupId/propositions/:propId -> détail d'une proposition
//   #/invite/:token                         -> invitation à rejoindre un groupe
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
//
// #/u/:userId (js/publicProfile.js) est à part : seule page accessible SANS
// connexion (lien à partager) — voir le if(route.name === 'publicProfile')
// tout en haut de renderRoute(), avant le if(!currentUser) qui bloque tout
// le reste, et js/auth.js → initAuth() qui la laisse passer avant même de
// vérifier la session Supabase.

const PAGE_IDS = ['appContainer', 'groupsListPage', 'groupDetailPage', 'proposalDetailPage', 'watchlistPage', 'amisPage', 'topPage', 'publicProfilePage', 'invitePage'];

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
function goToTop(){ location.hash = '#/top'; }
function goToPublicProfile(userId){ location.hash = `#/u/${userId}`; }

function parseRoute(){
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if(parts[0] === 'watchlist' && parts.length === 1) return { name: 'watchlist' };
  if(parts[0] === 'amis' && parts.length === 1) return { name: 'amis' };
  if(parts[0] === 'top' && parts.length === 1) return { name: 'top' };
  if(parts[0] === 'u' && parts.length === 2) return { name: 'publicProfile', userId: parts[1] };
  if(parts[0] === 'invite' && parts.length === 2) return { name: 'invite', token: parts[1] };
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
  const route = parseRoute();
  // Seule page qui doit marcher sans session (voir le commentaire en haut
  // de ce fichier) — vérifiée avant le if(!currentUser) qui bloque tout le
  // reste, pour rester accessible qu'on soit connecté ou non.
  if(route.name === 'publicProfile'){
    showOnlyPage('publicProfilePage');
    await renderPublicProfilePage(route.userId);
    return;
  }
  // #/invite/:token doit rester affichable qu'on soit connecté ou non
  // (renderInvitePage() gère les deux cas) — mais l'ARRIVÉE sur cette URL
  // sans session (lien ouvert dans un nouvel onglet, F5...) passe par
  // initAuth() (js/auth.js), pas par ici : ce cas ne couvre qu'une
  // navigation vers #/invite/:token depuis une session déjà active.
  if(route.name === 'invite'){
    showOnlyPage('invitePage');
    await renderInvitePage(route.token);
    return;
  }
  if(!currentUser) return;
  if(route.name === 'home'){
    showOnlyPage('appContainer');
  }else if(route.name === 'watchlist'){
    showOnlyPage('watchlistPage');
    await openWatchlist();
  }else if(route.name === 'amis'){
    showOnlyPage('amisPage');
    await openFriends();
  }else if(route.name === 'top'){
    showOnlyPage('topPage');
    await openTop();
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
