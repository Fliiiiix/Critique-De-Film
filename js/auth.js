// --- Authentification (lien magique par email, via Supabase Auth) ---
// L'app entière (toolbar + liste de films) est masquée tant qu'aucune
// session n'est active ; loadFilms()/render() ne tournent qu'une fois connecté.

let currentUser = null;

function showMaintenanceScreen(message){
  document.getElementById('authContainer').style.display = 'none';
  showOnlyPage(null); // masque appContainer + les pages Groupes (js/router.js)
  document.getElementById('userBar').style.display = 'none';
  if(message) document.getElementById('maintenanceMessage').textContent = message;
  document.getElementById('maintenanceContainer').style.display = '';
}

// Lit le flag maintenance avant toute chose (voir supabase/migrations/010).
// Lecture publique (RLS "using (true)"), pas besoin d'être connecté.
// Échec de lecture (table absente, réseau...) = on n'affiche rien et l'app
// continue normalement plutôt que de bloquer tout le monde par accident.
async function checkMaintenance(){
  const { data, error } = await supabaseClient
    .from('site_status')
    .select('maintenance, message')
    .eq('id', 1)
    .maybeSingle();
  if(error || !data) return false;
  if(data.maintenance) showMaintenanceScreen(data.message);
  return !!data.maintenance;
}

function showAuthScreen(){
  document.getElementById('authContainer').style.display = '';
  showOnlyPage(null); // masque appContainer + les pages Groupes (js/router.js)
  document.getElementById('userBar').style.display = 'none';
  if(location.hash) location.hash = ''; // pas de page Groupes fantôme à la prochaine connexion
}

async function showApp(){
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('userBar').style.display = '';
  await loadOrCreateProfile();
  await loadFilms();
  await loadViewings();
  render();
  await renderRoute(); // gère un lien direct vers une page Groupes (F5, etc.)
}

function handleSession(session){
  currentUser = session ? session.user : null;
  if(currentUser){
    showApp();
  }else{
    showAuthScreen();
  }
}

async function handleSendMagicLink(){
  const email = document.getElementById('authEmail').value.trim();
  const statusEl = document.getElementById('authStatus');
  if(!email){
    statusEl.textContent = 'Entre un email valide.';
    return;
  }
  statusEl.textContent = 'Envoi en cours…';
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0].split('?')[0] }
  });
  statusEl.textContent = error
    ? `Erreur : ${error.message}`
    : `Lien envoyé à ${email} — vérifie ta boîte mail (et les spams).`;
}

async function handleLogout(){
  await supabaseClient.auth.signOut();
}

document.getElementById('authSendBtn').addEventListener('click', handleSendMagicLink);
document.getElementById('authEmail').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') handleSendMagicLink();
});
document.getElementById('logoutBtn').addEventListener('click', handleLogout);

(async function initAuth(){
  buildSprockets();
  if(await checkMaintenance()) return; // stoppe tout : pas de session, pas de films chargés
  const { data: { session } } = await supabaseClient.auth.getSession();
  handleSession(session);
  supabaseClient.auth.onAuthStateChange((_event, session) => handleSession(session));
})();
