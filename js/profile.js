// --- Profil (pseudo + avatar) ---
// Une ligne par utilisateur dans `profiles` (RLS, voir supabase/migrations/005).
// Appelé depuis js/auth.js → showApp() une fois la session confirmée.

let currentProfile = null;
let profileLoadPromise = null;

// Supabase peut déclencher plusieurs événements de session en cascade au
// chargement (getSession() + onAuthStateChange), ce qui appelait cette
// fonction deux fois en concurrence et faisait échouer le second insert
// (conflit de clé primaire). On mémorise la promesse en cours pour n'avoir
// qu'un seul aller-retour réseau.
function loadOrCreateProfile(){
  if(!profileLoadPromise){
    profileLoadPromise = fetchOrCreateProfile().finally(() => { profileLoadPromise = null; });
  }
  return profileLoadPromise;
}

async function fetchOrCreateProfile(){
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if(error){
    console.error(error);
    currentProfile = null;
    renderUserBar();
    return;
  }

  if(data){
    currentProfile = data;
  }else{
    // Première connexion pour ce compte : profil par défaut (pseudo = préfixe email).
    const defaultName = currentUser.email.split('@')[0];
    const { data: created, error: insErr } = await supabaseClient
      .from('profiles')
      .insert({ user_id: currentUser.id, display_name: defaultName })
      .select()
      .single();
    if(insErr){
      // Conflit probable (profil déjà créé entre-temps, ex. autre onglet) :
      // on relit plutôt que d'écraser silencieusement.
      const { data: existing } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if(existing){
        currentProfile = existing;
      }else{
        console.error(insErr);
        currentProfile = { user_id: currentUser.id, display_name: defaultName, avatar_url: null };
      }
    }else{
      currentProfile = created;
    }
  }
  renderUserBar();
}

function renderUserBar(){
  const name = (currentProfile && currentProfile.display_name) || currentUser.email;
  document.getElementById('userDisplayName').textContent = name;

  // La photo de profil (agrandie) sert aussi de bouton d'accès au profil,
  // voir #userAvatarBtn plus bas — pas d'avatar renseigné = icône 👤.
  const avatarEl = document.getElementById('userAvatar');
  const fallbackEl = document.getElementById('userAvatarFallback');
  const avatarUrl = currentProfile && currentProfile.avatar_url;
  if(avatarUrl){
    avatarEl.src = avatarUrl;
    avatarEl.style.display = '';
    fallbackEl.style.display = 'none';
  }else{
    avatarEl.style.display = 'none';
    fallbackEl.style.display = '';
  }
}

function openProfileModal(){
  document.getElementById('displayNameInput').value = (currentProfile && currentProfile.display_name) || '';
  document.getElementById('avatarUrlInput').value = (currentProfile && currentProfile.avatar_url) || '';
  document.getElementById('avatarFilmSearch').value = '';
  document.getElementById('avatarFilmResults').innerHTML = '';
  document.getElementById('profileOverlay').classList.add('open');
}

// --- Choisir l'affiche d'un film déjà noté comme avatar ---
// Réutilise les films déjà chargés (js/app.js) et le style .tmdb-result —
// pas d'appel réseau, juste un filtre sur les films qui ont une affiche.

function renderAvatarFilmResults(query){
  const wrap = document.getElementById('avatarFilmResults');
  const q = normalizeSearch(query.trim());
  const candidates = films.filter(f => f.posterUrl && (!q || getSearchTerms(f).some(t => t.includes(q))));

  if(candidates.length === 0){
    wrap.innerHTML = `<div class="tmdb-empty">${q ? 'Aucun film avec affiche ne correspond.' : 'Aucun film avec affiche dans ton catalogue.'}</div>`;
    return;
  }

  wrap.innerHTML = '';
  candidates.slice(0, 20).forEach(f => {
    const item = document.createElement('div');
    item.className = 'tmdb-result';
    item.innerHTML = `
      <img src="${f.posterUrl}" alt="">
      <div class="tmdb-result-info">
        <div class="tmdb-result-title">${escapeHtml(f.title)}</div>
        ${f.releaseYear ? `<div class="tmdb-result-year">${f.releaseYear}</div>` : ''}
      </div>
    `;
    item.addEventListener('click', () => {
      document.getElementById('avatarUrlInput').value = f.posterUrl;
      wrap.innerHTML = '';
      document.getElementById('avatarFilmSearch').value = '';
    });
    wrap.appendChild(item);
  });
}

document.getElementById('avatarFilmSearch').addEventListener('input', (e) => {
  renderAvatarFilmResults(e.target.value);
});

function closeProfileModal(){
  document.getElementById('profileOverlay').classList.remove('open');
}

async function handleSaveProfile(){
  const display_name = document.getElementById('displayNameInput').value.trim() || null;
  const avatar_url = document.getElementById('avatarUrlInput').value.trim() || null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ display_name, avatar_url })
    .eq('user_id', currentUser.id)
    .select()
    .single();

  if(error){
    showToast('Erreur de sauvegarde du profil');
    console.error(error);
    return;
  }
  currentProfile = data;
  renderUserBar();
  closeProfileModal();
  showToast('Profil mis à jour');
}

document.getElementById('userAvatarBtn').addEventListener('click', openProfileModal);
document.getElementById('closeProfile').addEventListener('click', closeProfileModal);
document.getElementById('cancelProfileBtn').addEventListener('click', closeProfileModal);
document.getElementById('saveProfileBtn').addEventListener('click', handleSaveProfile);
document.getElementById('profileOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'profileOverlay') closeProfileModal();
});
