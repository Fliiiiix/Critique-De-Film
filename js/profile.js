// --- Profil (pseudo + avatar) ---
// Une ligne par utilisateur dans `profiles` (RLS, voir supabase/migrations/005).
// Appelé depuis js/auth.js → showApp() une fois la session confirmée.

let currentProfile = null;

async function loadOrCreateProfile(){
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
      console.error(insErr);
      currentProfile = { user_id: currentUser.id, display_name: defaultName, avatar_url: null };
    }else{
      currentProfile = created;
    }
  }
  renderUserBar();
}

function renderUserBar(){
  const name = (currentProfile && currentProfile.display_name) || currentUser.email;
  document.getElementById('userDisplayName').textContent = name;

  const avatarEl = document.getElementById('userAvatar');
  const avatarUrl = currentProfile && currentProfile.avatar_url;
  if(avatarUrl){
    avatarEl.src = avatarUrl;
    avatarEl.style.display = '';
  }else{
    avatarEl.style.display = 'none';
  }
}

function openProfileModal(){
  document.getElementById('displayNameInput').value = (currentProfile && currentProfile.display_name) || '';
  document.getElementById('avatarUrlInput').value = (currentProfile && currentProfile.avatar_url) || '';
  document.getElementById('profileOverlay').classList.add('open');
}

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

document.getElementById('editProfileBtn').addEventListener('click', openProfileModal);
document.getElementById('closeProfile').addEventListener('click', closeProfileModal);
document.getElementById('cancelProfileBtn').addEventListener('click', closeProfileModal);
document.getElementById('saveProfileBtn').addEventListener('click', handleSaveProfile);
document.getElementById('profileOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'profileOverlay') closeProfileModal();
});
