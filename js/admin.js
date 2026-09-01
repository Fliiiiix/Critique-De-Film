// --- Interface admin : "voir tout, gérer tout" pour les succès, les
// happenings et les retours utilisateur. Réservée au compte propriétaire
// (ADMIN_EMAIL) — pas de vrai rôle admin en base pour les 2 premiers
// onglets (Succès/Happenings), un email en dur côté client suffit pour un
// usage perso, même logique que site_status géré à la main dans le Table
// Editor Supabase. L'onglet Avis (feedback.resolved en dessous) fait
// exception : LUI a une vraie policy RLS derrière (voir
// supabase/migrations/026), pas juste ce garde-fou d'affichage — un
// retour peut contenir une remarque personnelle qu'un autre compte ne
// doit jamais pouvoir lire.
//
// Les définitions Succès/Happenings restent dans le code
// (js/achievements.js, js/happenings.js) : cette interface ne stocke que
// des ÉCARTS par rapport à elles (seuil modifié, activé/désactivé) + les
// happenings "génériques" (message simple) créés sans coder — un seul
// blob JSON par admin (table admin_config, voir supabase/migrations/018)
// plutôt qu'une table par réglage.

const ADMIN_EMAIL = 'sab.fxs@gmail.com';

let adminConfig = null;
let adminConfigLoaded = false;

function isAdmin(){
  return !!(currentUser && currentUser.email === ADMIN_EMAIL);
}

function defaultAdminConfig(){
  return { achievements: { cumulative: {}, hidden: {} }, happenings: { overrides: {}, custom: [] } };
}

async function loadAdminConfig(){
  if(adminConfigLoaded) return;
  const def = defaultAdminConfig();
  const { data, error } = await supabaseClient
    .from('admin_config')
    .select('data')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if(error){
    console.error(error);
    adminConfig = def;
  }else if(data && data.data){
    adminConfig = {
      achievements: { cumulative: {}, hidden: {}, ...data.data.achievements },
      happenings: { overrides: {}, custom: [], ...data.data.happenings }
    };
  }else{
    adminConfig = def;
  }
  adminConfigLoaded = true;
}

async function persistAdminConfig(){
  const { error } = await supabaseClient
    .from('admin_config')
    .upsert({ user_id: currentUser.id, data: adminConfig, updated_at: new Date().toISOString() });
  if(error){
    console.error(error);
    showToast('Erreur de sauvegarde admin');
  }
}

function getAdminAchievementOverrides(){
  return (adminConfig && adminConfig.achievements) || { cumulative: {}, hidden: {} };
}
function getAdminHappeningOverrides(){
  return (adminConfig && adminConfig.happenings && adminConfig.happenings.overrides) || {};
}
function getAdminCustomHappenings(){
  return (adminConfig && adminConfig.happenings && adminConfig.happenings.custom) || [];
}

// --- Onglets Succès / Happenings / Avis / Stats ---
function setAdminTab(tab){
  document.querySelectorAll('#adminTabs .avatar-source-tab').forEach(btn => {
    const active = btn.dataset.adminTab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if(tab === 'achievements') renderAdminAchievementsTab();
  else if(tab === 'happenings') renderAdminHappeningsTab();
  else if(tab === 'feedback') renderAdminFeedbackTab();
  else renderAdminStatsTab();
}

// --- Onglet Succès ---
function renderAdminAchievementsTab(){
  const wrap = document.getElementById('adminContent');
  const overrides = getAdminAchievementOverrides();
  const a = computeAchievements(); // valeurs déjà "effectives" (avec écarts admin appliqués)

  const cumulativeRows = CUMULATIVE_GROUPS.map(g => {
    const o = overrides.cumulative[g.key] || {};
    const enabled = o.enabled !== false;
    const isOverridden = Array.isArray(o.tiers) && o.tiers.length === g.tiers.length;
    const tiers = isOverridden ? o.tiers : g.tiers;
    const current = a.cumulative.find(x => x.key === g.key);
    return `
      <div class="wl-row admin-row${enabled ? '' : ' admin-row-disabled'}">
        <div class="wl-main">
          <div class="wl-title">${g.icon} ${escapeHtml(g.label)}${current ? ` <span class="wl-year">(${current.value} ${escapeHtml(g.unit)} actuellement)</span>` : ''}</div>
          <div class="wl-note">Seuils (${escapeHtml(g.unit)}) : ${tiers.map((t, i) => `<input type="number" min="1" class="admin-tier-input" data-group="${g.key}" data-tier="${i}" value="${t.threshold}" title="${escapeHtml(t.name)}">`).join(' · ')}</div>
        </div>
        <div class="wl-actions">
          <label class="manual-toggle-label"><input type="checkbox" class="admin-ach-enabled" data-group="${g.key}" ${enabled ? 'checked' : ''}><span>Activé</span></label>
          ${isOverridden ? `<button class="btn secondary admin-reset-tiers" data-group="${g.key}" type="button" title="Revenir aux seuils par défaut">↺</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const hiddenRows = HIDDEN_ACHIEVEMENTS.map(h => {
    const o = overrides.hidden[h.key] || {};
    const enabled = o.enabled !== false;
    const unlocked = h.check(films);
    return `
      <div class="wl-row admin-row${enabled ? '' : ' admin-row-disabled'}">
        <div class="wl-main">
          <div class="wl-title">${h.icon} ${escapeHtml(h.title)}${unlocked ? ' <span class="review-badge" title="Débloqué">✓ débloqué</span>' : ''}</div>
          <div class="wl-note">${escapeHtml(h.desc)}</div>
        </div>
        <div class="wl-actions">
          <label class="manual-toggle-label"><input type="checkbox" class="admin-hidden-enabled" data-key="${h.key}" ${enabled ? 'checked' : ''}><span>Activé</span></label>
        </div>
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="stats-section">
      <div class="stats-section-title">Paliers cumulatifs (${a.tiersUnlocked} / ${a.tiersTotal} débloqués)</div>
      ${cumulativeRows}
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Secrets (${a.hiddenUnlocked} / ${a.hiddenTotal} trouvés, vue admin, sans le "???")</div>
      ${hiddenRows}
    </div>
  `;

  wrap.querySelectorAll('.admin-tier-input').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const key = e.target.dataset.group;
      const tierIdx = Number(e.target.dataset.tier);
      const value = Math.max(1, Math.round(Number(e.target.value) || 1));
      const group = CUMULATIVE_GROUPS.find(g => g.key === key);
      const current = overrides.cumulative[key];
      const baseTiers = (current && Array.isArray(current.tiers) && current.tiers.length === group.tiers.length)
        ? current.tiers
        : group.tiers;
      const tiers = baseTiers.map(t => ({ ...t }));
      tiers[tierIdx] = { ...tiers[tierIdx], threshold: value };
      adminConfig.achievements.cumulative[key] = { ...current, tiers };
      await persistAdminConfig();
      renderAdminAchievementsTab();
    });
  });

  wrap.querySelectorAll('.admin-reset-tiers').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const key = e.currentTarget.dataset.group;
      const current = adminConfig.achievements.cumulative[key];
      if(current) delete current.tiers;
      await persistAdminConfig();
      renderAdminAchievementsTab();
    });
  });

  wrap.querySelectorAll('.admin-ach-enabled').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const key = e.target.dataset.group;
      adminConfig.achievements.cumulative[key] = { ...(adminConfig.achievements.cumulative[key]), enabled: e.target.checked };
      await persistAdminConfig();
      renderAdminAchievementsTab();
    });
  });

  wrap.querySelectorAll('.admin-hidden-enabled').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const key = e.target.dataset.key;
      adminConfig.achievements.hidden[key] = { ...(adminConfig.achievements.hidden[key]), enabled: e.target.checked };
      await persistAdminConfig();
      renderAdminAchievementsTab();
    });
  });
}

// --- Onglet Happenings ---
function renderAdminHappeningsTab(){
  const wrap = document.getElementById('adminContent');
  const overrides = getAdminHappeningOverrides();
  const custom = getAdminCustomHappenings();

  const builtInRows = HAPPENINGS.map(h => {
    const o = overrides[h.tmdbId] || {};
    const enabled = o.enabled !== false;
    const film = films.find(f => f.tmdbId === h.tmdbId);
    const triggerLabel = h.trigger === 'dwell' ? `Reste ${Math.round(h.dwellMs / 1000)}s sur la fiche` : 'Clic sur le badge';
    return `
      <div class="wl-row admin-row${enabled ? '' : ' admin-row-disabled'}">
        <div class="wl-main">
          <div class="wl-title">${h.icon || '⏱️'} ${film ? escapeHtml(film.title) : `tmdb_id ${h.tmdbId} (hors catalogue)`}</div>
          <div class="wl-note">${triggerLabel} · codé en dur</div>
        </div>
        <div class="wl-actions">
          <label class="manual-toggle-label"><input type="checkbox" class="admin-happening-enabled" data-tmdb="${h.tmdbId}" ${enabled ? 'checked' : ''}><span>Activé</span></label>
          <button class="btn secondary admin-replay-builtin" data-tmdb="${h.tmdbId}" type="button">▶ Revivre</button>
        </div>
      </div>
    `;
  }).join('');

  const customRows = custom.map(c => {
    const film = films.find(f => f.tmdbId === c.tmdbId);
    const enabled = c.enabled !== false;
    const triggerLabel = c.trigger === 'dwell' ? `Reste ${Math.round((c.dwellMs || 15000) / 1000)}s sur la fiche` : 'Clic sur le badge';
    return `
      <div class="wl-row admin-row${enabled ? '' : ' admin-row-disabled'}">
        <div class="wl-main">
          <div class="wl-title">${escapeHtml(c.icon || '✨')} ${escapeHtml(c.title || 'Sans titre')} <span class="wl-year">(${film ? escapeHtml(film.title) : `tmdb_id ${c.tmdbId}`})</span></div>
          <div class="wl-note">${triggerLabel} · créé depuis l'admin : « ${escapeHtml(c.message || '')} »</div>
        </div>
        <div class="wl-actions">
          <label class="manual-toggle-label"><input type="checkbox" class="admin-custom-enabled" data-id="${c.id}" ${enabled ? 'checked' : ''}><span>Activé</span></label>
          <button class="btn secondary admin-replay-custom" data-id="${c.id}" type="button">▶ Revivre</button>
          <button class="btn secondary admin-delete-custom" data-id="${c.id}" type="button" title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }).join('');

  const filmOptions = films
    .filter(f => f.tmdbId)
    .slice()
    .sort((x, y) => x.title.localeCompare(y.title))
    .map(f => `<option value="${f.tmdbId}">${escapeHtml(f.title)}${f.releaseYear ? ` (${f.releaseYear})` : ''}</option>`)
    .join('');

  wrap.innerHTML = `
    <div class="stats-section">
      <div class="stats-section-title">Happenings codés en dur (${HAPPENINGS.length})</div>
      ${builtInRows}
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Happenings créés depuis l'admin (${custom.length})</div>
      ${customRows || '<div class="tmdb-empty">Aucun pour l\'instant.</div>'}
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Nouveau happening (message simple, sans coder)</div>
      <form id="adminNewHappeningForm">
        <div class="field">
          <label>Film</label>
          <select id="adminHapFilm" required>
            <option value="">Choisir un film noté avec fiche TMDB</option>
            ${filmOptions}
          </select>
        </div>
        <div class="field">
          <label>Déclencheur</label>
          <select id="adminHapTrigger">
            <option value="click">Clic sur un badge à côté du titre</option>
            <option value="dwell">Rester un moment sur la fiche</option>
          </select>
        </div>
        <div class="field" id="adminHapDwellField" style="display:none;">
          <label>Délai (secondes)</label>
          <input type="number" id="adminHapDwellSecs" min="3" value="15">
        </div>
        <div class="field">
          <label>Icône (emoji du badge)</label>
          <input type="text" id="adminHapIcon" value="✨" maxlength="4" style="width:80px;">
        </div>
        <div class="field">
          <label>Titre</label>
          <input type="text" id="adminHapTitle" placeholder="Ex. Un dernier mot" required>
        </div>
        <div class="field">
          <label>Message</label>
          <input type="text" id="adminHapMessage" placeholder="Le texte affiché" required>
        </div>
        <button class="btn" type="submit">Créer</button>
      </form>
    </div>
  `;

  wrap.querySelector('#adminHapTrigger').addEventListener('change', (e) => {
    document.getElementById('adminHapDwellField').style.display = e.target.value === 'dwell' ? '' : 'none';
  });

  wrap.querySelectorAll('.admin-happening-enabled').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const tmdbId = Number(e.target.dataset.tmdb);
      adminConfig.happenings.overrides[tmdbId] = { enabled: e.target.checked };
      await persistAdminConfig();
      render(); // rafraîchit les badges du catalogue (js/app.js)
      renderAdminHappeningsTab();
    });
  });

  wrap.querySelectorAll('.admin-custom-enabled').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const entry = custom.find(c => c.id === id);
      if(entry) entry.enabled = e.target.checked;
      await persistAdminConfig();
      render();
      renderAdminHappeningsTab();
    });
  });

  wrap.querySelectorAll('.admin-delete-custom').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      adminConfig.happenings.custom = custom.filter(c => c.id !== id);
      await persistAdminConfig();
      render();
      renderAdminHappeningsTab();
    });
  });

  wrap.querySelectorAll('.admin-replay-builtin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tmdbId = Number(e.currentTarget.dataset.tmdb);
      const h = HAPPENINGS.find(x => x.tmdbId === tmdbId);
      const film = films.find(f => f.tmdbId === tmdbId) || { tmdbId, title: 'Sans titre' };
      if(h) h.run(film);
    });
  });

  wrap.querySelectorAll('.admin-replay-custom').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const entry = custom.find(c => c.id === e.currentTarget.dataset.id);
      if(entry) runCustomHappening(entry);
    });
  });

  wrap.querySelector('#adminNewHappeningForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tmdbId = Number(document.getElementById('adminHapFilm').value);
    if(!tmdbId){ showToast('Choisis un film'); return; }
    const trigger = document.getElementById('adminHapTrigger').value;
    const entry = {
      id: `custom-${Date.now()}`,
      tmdbId,
      trigger,
      dwellMs: trigger === 'dwell' ? Math.max(3, Number(document.getElementById('adminHapDwellSecs').value) || 15) * 1000 : undefined,
      icon: document.getElementById('adminHapIcon').value.trim() || '✨',
      title: document.getElementById('adminHapTitle').value.trim(),
      message: document.getElementById('adminHapMessage').value.trim(),
      enabled: true
    };
    adminConfig.happenings.custom.push(entry);
    await persistAdminConfig();
    render();
    renderAdminHappeningsTab();
    showToast('Happening créé');
  });
}

// --- Onglet Avis ---
let allFeedback = [];
let allFeedbackLoaded = false;

async function loadAllFeedback(){
  // RLS (migrations/026) renvoie déjà tout pour l'admin et rien que ses
  // propres lignes pour les autres — pas de .eq('user_id', ...) ici,
  // contrairement à loadFilms() : ce serait redondant avec la policy, et
  // figerait la requête sur l'admin alors que renderAdminFeedbackTab()
  // n'est de toute façon jamais appelée sans isAdmin() en amont.
  const { data, error } = await supabaseClient
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });
  if(error){
    console.error(error);
    allFeedback = [];
  }else{
    allFeedback = data.map(row => ({
      id: row.id,
      category: row.category,
      message: row.message,
      resolved: row.resolved,
      createdAt: row.created_at
    }));
  }
  // Posé même en cas d'erreur (comme loadSiteStats() plus bas) : sinon
  // renderAdminFeedbackTab() relance loadAllFeedback() à chaque appel
  // (son garde-fou ne teste que allFeedbackLoaded) — un échec réseau, ou
  // simplement la migration 026 pas encore exécutée, partait en boucle de
  // requêtes ratées à chaque re-render plutôt que d'échouer une fois et
  // d'afficher l'état vide. Bug constaté en testant ce scénario précis.
  allFeedbackLoaded = true;
}

// Regroupe par catégorie, categories triées par nombre de retours NON
// traités décroissant — demande explicite ("trier par ordre des choses
// plus récurrentes à la moins") : une catégorie déjà entièrement traitée
// redescend au lieu de rester en tête indéfiniment. Dans chaque groupe,
// les non-traités remontent en premier (plus actionnable), puis les plus
// récents d'abord.
function groupFeedbackByCategory(){
  return FEEDBACK_CATEGORIES
    .map(cat => {
      const items = allFeedback
        .filter(f => f.category === cat.key)
        .slice()
        .sort((a, b) => (a.resolved === b.resolved ? 0 : a.resolved ? 1 : -1) || (b.createdAt > a.createdAt ? 1 : -1));
      const openCount = items.filter(f => !f.resolved).length;
      return { ...cat, items, openCount };
    })
    .filter(g => g.items.length > 0)
    .sort((a, b) => b.openCount - a.openCount || b.items.length - a.items.length);
}

function renderAdminFeedbackTab(){
  const wrap = document.getElementById('adminContent');
  if(!allFeedbackLoaded){
    wrap.innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
    loadAllFeedback().then(renderAdminFeedbackTab);
    return;
  }
  if(!allFeedback.length){
    wrap.innerHTML = `<div class="empty-state">Aucun retour pour l'instant.</div>`;
    return;
  }
  const groups = groupFeedbackByCategory();
  wrap.innerHTML = groups.map(g => `
    <div class="stats-section">
      <div class="stats-section-title">
        ${escapeHtml(g.label)}
        <span class="ach-tier-progress">${g.items.length} retour${g.items.length > 1 ? 's' : ''}${g.openCount ? ` · ${g.openCount} non traité${g.openCount > 1 ? 's' : ''}` : ' · tous traités'}</span>
      </div>
      ${g.items.map(f => `
        <div class="feedback-row${f.resolved ? ' is-resolved' : ''}">
          <div class="feedback-row-main">
            <p class="feedback-message">${escapeHtml(f.message)}</p>
            <div class="feedback-meta">${new Date(f.createdAt).toLocaleDateString('fr-FR')}</div>
          </div>
          <button class="btn secondary" type="button" data-feedback-toggle="${f.id}">${f.resolved ? 'Rouvrir' : 'Marquer traité'}</button>
        </div>
      `).join('')}
    </div>
  `).join('');
  wrap.querySelectorAll('[data-feedback-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleFeedbackResolved(parseInt(btn.dataset.feedbackToggle, 10)));
  });
}

async function toggleFeedbackResolved(id){
  const item = allFeedback.find(f => f.id === id);
  if(!item) return;
  const { error } = await supabaseClient.from('feedback').update({ resolved: !item.resolved }).eq('id', id);
  if(error){
    showToast('Erreur, réessaie');
    console.error(error);
    return;
  }
  item.resolved = !item.resolved;
  renderAdminFeedbackTab();
}

// --- Onglet Stats & logs ---
// Table `app_events` + fonction get_admin_site_stats() (voir js/logging.js
// et supabase/migrations/027) : "Croissance" (inscriptions/installations,
// depuis app_events), "Activité globale" (compteurs tous comptes, depuis
// la fonction — jamais de ligne individuelle, juste 4 nombres) et le
// journal brut (les 200 derniers évènements, erreurs comprises).
let allEvents = [];
let siteStats = null;
let siteStatsLoaded = false;

const EVENT_TYPE_LABELS = { signup: 'Inscription', pwa_install: 'Installation', error: 'Erreur' };

async function loadSiteStats(){
  const [statsRes, eventsRes] = await Promise.all([
    supabaseClient.rpc('get_admin_site_stats'),
    supabaseClient.from('app_events').select('*').order('created_at', { ascending: false }).limit(200)
  ]);
  if(statsRes.error){
    console.error(statsRes.error);
    siteStats = null;
  }else{
    siteStats = (statsRes.data && statsRes.data[0]) || null;
  }
  if(eventsRes.error){
    console.error(eventsRes.error);
    allEvents = [];
  }else{
    allEvents = eventsRes.data.map(row => ({
      id: row.id,
      eventType: row.event_type,
      detail: row.detail,
      createdAt: row.created_at
    }));
  }
  siteStatsLoaded = true;
}

function renderAdminStatsTab(){
  const wrap = document.getElementById('adminContent');
  if(!siteStatsLoaded){
    wrap.innerHTML = `<div class="tmdb-empty">Chargement…</div>`;
    loadSiteStats().then(renderAdminStatsTab);
    return;
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const countSince = (type, since) => allEvents.filter(e => e.eventType === type && new Date(e.createdAt) >= since).length;
  const totalSignups = allEvents.filter(e => e.eventType === 'signup').length;
  const weekSignups = countSince('signup', weekAgo);
  const totalInstalls = allEvents.filter(e => e.eventType === 'pwa_install').length;
  const weekInstalls = countSince('pwa_install', weekAgo);
  const weekErrors = countSince('error', weekAgo);

  const stat = (value, label) => `<div class="stat-tile"><div class="stat-value">${value != null ? value : '—'}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;

  wrap.innerHTML = `
    <div class="stats-section">
      <div class="stats-section-title">Croissance</div>
      <div class="stat-tiles">
        ${stat(totalSignups, 'Inscriptions')}
        ${stat(weekSignups, 'Cette semaine')}
        ${stat(totalInstalls, 'Installations')}
        ${stat(weekInstalls, 'Cette semaine')}
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Activité globale (tous comptes)</div>
      <div class="stat-tiles">
        ${stat(siteStats && siteStats.total_users, 'Comptes')}
        ${stat(siteStats && siteStats.total_films, 'Films notés')}
        ${stat(siteStats && siteStats.total_series, 'Séries suivies')}
        ${stat(siteStats && siteStats.total_viewings, 'Visionnages')}
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">
        Journal
        ${weekErrors ? `<span class="ach-tier-progress">${weekErrors} erreur${weekErrors > 1 ? 's' : ''} cette semaine</span>` : ''}
      </div>
      ${allEvents.length ? allEvents.map(e => `
        <div class="event-row">
          <span class="event-type-badge event-type-${escapeHtml(e.eventType)}">${escapeHtml(EVENT_TYPE_LABELS[e.eventType] || e.eventType)}</span>
          <span class="event-detail">${escapeHtml(e.detail || '')}</span>
          <span class="event-date">${new Date(e.createdAt).toLocaleString('fr-FR')}</span>
        </div>
      `).join('') : `<div class="empty-state">Rien pour l'instant.</div>`}
    </div>
  `;
}

async function openAdminModal(){
  if(!isAdmin()) return;
  closeProfileModal();
  if(!adminConfigLoaded) await loadAdminConfig();
  setAdminTab('achievements');
  openOverlay('adminOverlay');
}

// Rouvre la modale profil (pas juste closeOverlay simple) : Admin n'est
// accessible QUE depuis "Mon activité" dans le profil (voir #adminBtn,
// index.html) — en ressortir doit ramener là où on était, pas sortir
// entièrement du profil.
function closeAdminModal(){
  closeOverlay('adminOverlay', () => openProfileModal());
}

document.querySelectorAll('#adminTabs .avatar-source-tab').forEach(btn => {
  btn.addEventListener('click', () => setAdminTab(btn.dataset.adminTab));
});
document.getElementById('adminBtn').addEventListener('click', openAdminModal);
document.getElementById('closeAdmin').addEventListener('click', closeAdminModal);
document.getElementById('adminOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'adminOverlay') closeAdminModal();
});
