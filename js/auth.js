// --- Authentification (lien magique par email, via Supabase Auth) ---
// L'app entière (toolbar + liste de films) est masquée tant qu'aucune
// session n'est active ; loadFilms()/render() ne tournent qu'une fois connecté.

let currentUser = null;

function showAuthScreen(){
  document.getElementById('authContainer').style.display = '';
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('userBar').style.display = 'none';
}

async function showApp(){
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = '';
  document.getElementById('userBar').style.display = '';
  await loadOrCreateProfile();
  await loadFilms();
  await loadViewings();
  render();
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
  const { data: { session } } = await supabaseClient.auth.getSession();
  handleSession(session);
  supabaseClient.auth.onAuthStateChange((_event, session) => handleSession(session));
})();
