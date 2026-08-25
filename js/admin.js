// --- Interface admin : "voir tout, gérer tout" pour les succès et les
// happenings. Réservée au compte propriétaire (ADMIN_EMAIL) — pas de vrai
// rôle admin en base, un email en dur suffit pour un usage perso, même
// logique que site_status géré à la main dans le Table Editor Supabase.
//
// Les définitions restent dans le code (js/achievements.js, js/happenings.js) :
// cette interface ne stocke que des ÉCARTS par rapport à elles (seuil
// modifié, activé/désactivé) + les happenings "génériques" (message simple)
// créés sans coder — un seul blob JSON par admin (table admin_config, voir
// supabase/migrations/018) plutôt qu'une table par réglage.

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

// --- Onglets Succès / Happenings ---
function setAdminTab(tab){
  document.querySelectorAll('#adminTabs .avatar-source-tab').forEach(btn => {
    const active = btn.dataset.adminTab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if(tab === 'achievements') renderAdminAchievementsTab();
  else renderAdminHappeningsTab();
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
          <div class="wl-title">${g.icon} ${escapeHtml(g.label)}${current ? ` <span class="wl-year">— ${current.value} ${escapeHtml(g.unit)} actuellement</span>` : ''}</div>
          <div class="wl-note">Seuils (${escapeHtml(g.unit)}) — ${tiers.map((t, i) => `<input type="number" min="1" class="admin-tier-input" data-group="${g.key}" data-tier="${i}" value="${t.threshold}" title="${escapeHtml(t.name)}">`).join(' · ')}</div>
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
      <div class="stats-section-title">Paliers cumulatifs — ${a.tiersUnlocked} / ${a.tiersTotal} débloqués</div>
      ${cumulativeRows}
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Secrets — ${a.hiddenUnlocked} / ${a.hiddenTotal} trouvés (vue admin, sans le "???")</div>
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
          <div class="wl-title">${h.icon || '⏱️'} ${film ? escapeHtml(film.title) : `tmdb_id ${h.tmdbId} — hors catalogue`}</div>
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
          <div class="wl-title">${escapeHtml(c.icon || '✨')} ${escapeHtml(c.title || 'Sans titre')} <span class="wl-year">— ${film ? escapeHtml(film.title) : `tmdb_id ${c.tmdbId}`}</span></div>
          <div class="wl-note">${triggerLabel} · créé depuis l'admin — « ${escapeHtml(c.message || '')} »</div>
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
      <div class="stats-section-title">Nouveau happening — message simple, sans coder</div>
      <form id="adminNewHappeningForm">
        <div class="field">
          <label>Film</label>
          <select id="adminHapFilm" required>
            <option value="">— Choisir un film noté avec fiche TMDB —</option>
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

async function openAdminModal(){
  if(!isAdmin()) return;
  closeProfileModal();
  if(!adminConfigLoaded) await loadAdminConfig();
  setAdminTab('achievements');
  document.getElementById('adminOverlay').classList.add('open');
}

function closeAdminModal(){
  document.getElementById('adminOverlay').classList.remove('open');
}

document.querySelectorAll('#adminTabs .avatar-source-tab').forEach(btn => {
  btn.addEventListener('click', () => setAdminTab(btn.dataset.adminTab));
});
document.getElementById('adminBtn').addEventListener('click', openAdminModal);
document.getElementById('closeAdmin').addEventListener('click', closeAdminModal);
document.getElementById('adminOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'adminOverlay') closeAdminModal();
});
