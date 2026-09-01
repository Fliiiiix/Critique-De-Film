// --- Journal d'événements + erreurs (v2.1) ---
// Table d'ajout seul `app_events` (supabase/migrations/027) — capture les
// erreurs JS non interceptées qui arrivent vraiment aux visiteurs
// (jusqu'ici invisibles pour l'admin : elles ne partaient que dans LEUR
// console), plus quelques jalons de croissance (inscription, installation
// PWA). Lu uniquement par l'admin, nouvel onglet de la modale admin (voir
// js/admin.js) — même RLS "vraie règle, pas un simple choix d'affichage"
// que le feedback (migrations/026), à une différence près : l'INSERT est
// ouvert même sans session (une erreur peut survenir sur l'écran de
// connexion, avant tout compte).
//
// Chargé tôt (juste après supabaseConfig.js, voir index.html) pour capter
// les erreurs de chargement des scripts suivants — pas seulement celles
// qui arrivent une fois l'app pleinement démarrée.

async function logEvent(eventType, detail){
  try{
    // typeof (pas une référence directe) : ce fichier charge avant
    // auth.js, `currentUser` peut donc être en zone morte temporelle
    // (TDZ) si une erreur survient très tôt — une référence directe
    // lèverait alors sa propre ReferenceError au lieu de juste logger
    // silencieusement rien. Un raté de log ne doit jamais devenir une
    // erreur visible à son tour.
    const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    await supabaseClient.from('app_events').insert({
      user_id: uid,
      event_type: eventType,
      detail: detail ? String(detail).slice(0, 500) : null
    });
  }catch(e){
    // Silencieux, volontairement — voir le commentaire au-dessus.
  }
}

// window.onerror plutôt que try/catch dispersés partout : capte tout ce
// qui remonte jusqu'en haut sans avoir été intercepté ailleurs dans le
// code, sans devoir instrumenter chaque fonction une par une.
window.addEventListener('error', (e) => {
  logEvent('error', `${e.message} — ${e.filename}:${e.lineno}`);
});
// Rejets de Promise jamais rattrapés (ex. un .then() sans .catch() sur un
// appel Supabase) : window 'error' seul ne les voit pas, évènement à part.
window.addEventListener('unhandledrejection', (e) => {
  logEvent('error', `Promesse rejetée : ${String(e.reason).slice(0, 300)}`);
});
