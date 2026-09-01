// --- Feedback utilisateur ---
// Formulaire simple (catégorie + message), accessible depuis la modale
// profil ("Mon activité"), lu uniquement par l'admin dans un nouvel onglet
// "Retours" de la modale admin (voir js/admin.js). Table `feedback`,
// policies RLS voir supabase/migrations/026 — contrairement à
// admin_config, une vraie règle en base restreint la lecture à l'admin,
// pas juste un choix d'affichage côté client.

function populateFeedbackCategorySelect(){
  document.getElementById('feedbackCategory').innerHTML = FEEDBACK_CATEGORIES
    .map(c => `<option value="${c.key}">${escapeHtml(c.label)}</option>`)
    .join('');
}

function openFeedbackModal(){
  // Accessible depuis la modale profil, même schéma que Stats/Succès/
  // Journal (js/stats.js, js/achievements.js, js/journal.js) : la
  // refermer d'abord évite deux modales de tailles différentes superposées.
  closeProfileModal();
  document.getElementById('feedbackMessage').value = '';
  document.getElementById('feedbackCategory').value = FEEDBACK_CATEGORIES[0].key;
  openOverlay('feedbackOverlay');
}

// Rouvre la modale profil (pas juste closeOverlay simple) : ce formulaire
// n'est accessible QUE depuis "Mon activité" dans le profil — en ressortir
// doit ramener là où on était, même raisonnement que closeJournal()/
// closeAdminModal().
function closeFeedbackModal(){
  closeOverlay('feedbackOverlay', () => openProfileModal());
}

async function handleSubmitFeedback(){
  if(blockIfOffline()) return;
  const message = document.getElementById('feedbackMessage').value.trim();
  if(!message){
    showToast("Écris un message avant d'envoyer");
    return;
  }
  const category = document.getElementById('feedbackCategory').value;
  const { error } = await supabaseClient.from('feedback').insert({
    user_id: currentUser.id,
    category,
    message
  });
  if(error){
    showToast('Erreur — réessaie');
    console.error(error);
    return;
  }
  showToast('Merci, ton retour est envoyé !');
  closeFeedbackModal();
}

populateFeedbackCategorySelect();
document.getElementById('feedbackBtn').addEventListener('click', openFeedbackModal);
document.getElementById('closeFeedback').addEventListener('click', closeFeedbackModal);
document.getElementById('feedbackSubmitBtn').addEventListener('click', handleSubmitFeedback);
document.getElementById('feedbackOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'feedbackOverlay') closeFeedbackModal();
});
