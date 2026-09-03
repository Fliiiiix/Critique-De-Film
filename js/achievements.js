// --- Succès ---
// Tout calculé côté client à partir de `films` déjà chargé, exactement comme
// js/stats.js : pas de table dédiée, pas de migration nécessaire. Un succès
// est une fonction pure de l'état actuel du catalogue — se débloque et se
// "reverrouille" tout seul si les données changent (suppression d'un film,
// import qui remplace le catalogue, etc.), pas d'historique à maintenir.

// Paliers cumulatifs : toujours visibles, avec une progression vers le
// palier suivant.
const CUMULATIVE_GROUPS = [
  {
    key: 'cinephile', icon: '🎬', label: 'Cinéphile', unit: 'films notés',
    metric: s => s.total,
    tiers: [{ name: 'Bronze', threshold: 10 }, { name: 'Argent', threshold: 50 }, { name: 'Or', threshold: 150 }]
  },
  {
    key: 'favori', icon: '⭐', label: 'Grand favori', unit: 'favoris',
    metric: s => s.favCount,
    tiers: [{ name: 'Bronze', threshold: 5 }, { name: 'Argent', threshold: 15 }, { name: 'Or', threshold: 30 }]
  },
  {
    key: 'critique', icon: '💬', label: 'Critique en chef', unit: 'commentaires',
    metric: s => s.reviewCount,
    tiers: [{ name: 'Bronze', threshold: 5 }, { name: 'Argent', threshold: 20 }, { name: 'Or', threshold: 50 }]
  },
  {
    key: 'archiviste', icon: '🖼️', label: 'Archiviste', unit: 'fiches TMDB liées',
    metric: s => s.tmdbCount,
    tiers: [{ name: 'Bronze', threshold: 10 }, { name: 'Argent', threshold: 30 }, { name: 'Or', threshold: 75 }]
  }
];

// Succès secrets : invisibles (silhouette "???") tant qu'ils ne sont pas
// débloqués, pour garder la surprise.
const HIDDEN_ACHIEVEMENTS = [
  {
    key: 'premier-pas', icon: '🌱', title: 'Premier pas',
    desc: 'Noter ton tout premier film.',
    check: films => films.length >= 1
  },
  {
    key: 'sans-pitie', icon: '🖤', title: 'Sans pitié',
    desc: 'Avoir donné 0.5/5 ou moins à un film.',
    check: films => films.some(f => { const n = getDisplayNote(f); return n !== null && n <= 0.5; })
  },
  {
    key: 'coup-de-foudre', icon: '💘', title: 'Coup de foudre',
    desc: 'Avoir donné la note parfaite, 5/5, à un film.',
    check: films => films.some(f => getDisplayNote(f) === 5)
  },
  {
    key: 'grand-ecart', icon: '🎭', title: 'Grand écart',
    desc: 'Avoir à la fois un coup de cœur (5/5) et un four total (0.5 ou moins) au catalogue.',
    check: films => films.some(f => getDisplayNote(f) === 5)
      && films.some(f => { const n = getDisplayNote(f); return n !== null && n <= 0.5; })
  },
  {
    key: 'le-jure', icon: '⚖️', title: 'Le juré',
    desc: 'Avoir noté au moins un film dans chacune des 5 tranches de note (0–1, 1–2, 2–3, 3–4, 4–5).',
    check: films => {
      const ranges = [0, 0, 0, 0, 0];
      films.forEach(f => {
        const n = getDisplayNote(f);
        if (n === null) return;
        ranges[Math.min(4, Math.floor(n))]++;
      });
      return ranges.every(c => c > 0);
    }
  },
  {
    key: 'oiseau-de-nuit', icon: '🦉', title: 'Oiseau de nuit',
    desc: 'Avoir ajouté un film entre minuit et 5h du matin.',
    check: films => films.some(f => { const h = new Date(f.added).getHours(); return h >= 0 && h < 5; })
  },
  {
    key: 'marathon', icon: '🏃', title: 'Marathon',
    desc: 'Avoir noté 5 films ou plus le même jour.',
    check: films => {
      const counts = {};
      films.forEach(f => {
        const key = new Date(f.added).toDateString();
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.values(counts).some(c => c >= 5);
    }
  },
  {
    key: 'le-rebelle', icon: '🃏', title: 'Le rebelle',
    desc: 'Avoir noté 5 films ou plus en note manuelle, sans passer par la grille.',
    check: films => films.filter(f => f.manualNote != null).length >= 5
  },
  {
    key: 'roman-fleuve', icon: '📝', title: 'Roman-fleuve',
    desc: 'Avoir écrit un commentaire de plus de 500 caractères sur un film.',
    check: films => films.some(f => f.review && f.review.length > 500)
  },
  {
    key: 'sans-affiche', icon: '🎞️', title: 'Sans affiche',
    desc: "Avoir 10 films ou plus sans fiche TMDB liée (l'ancien monde, avant les affiches).",
    check: films => films.filter(f => !f.tmdbId).length >= 10
  },
  {
    key: 'revisionnage', icon: '🔁', title: 'Ça méritait un revisionnage',
    desc: 'Avoir revu un même film au moins 3 fois (voir le Journal).',
    check: () => {
      if(typeof viewings === 'undefined') return false;
      const counts = {};
      viewings.forEach(v => { counts[v.filmId] = (counts[v.filmId] || 0) + 1; });
      return Object.values(counts).some(c => c >= 3);
    }
  }
];

// --- Écarts admin (js/admin.js) : seuils modifiés / succès désactivés ---
// Les définitions restent ici (CUMULATIVE_GROUPS / HIDDEN_ACHIEVEMENTS) —
// l'admin ne stocke que la différence par rapport à elles, voir
// supabase/migrations/018. `typeof` en garde : achievements.js est chargé
// avant admin.js et doit continuer à fonctionner seul (pour un compte non
// admin, qui n'a jamais de config chargée).
function getEffectiveCumulativeGroups(){
  const overrides = (typeof getAdminAchievementOverrides === 'function') ? getAdminAchievementOverrides().cumulative : {};
  return CUMULATIVE_GROUPS
    .filter(g => !(overrides[g.key] && overrides[g.key].enabled === false))
    .map(g => {
      const o = overrides[g.key];
      const tiers = (o && Array.isArray(o.tiers) && o.tiers.length === g.tiers.length) ? o.tiers : g.tiers;
      return { ...g, tiers };
    });
}

function getEffectiveHiddenAchievements(){
  const overrides = (typeof getAdminAchievementOverrides === 'function') ? getAdminAchievementOverrides().hidden : {};
  return HIDDEN_ACHIEVEMENTS.filter(h => !(overrides[h.key] && overrides[h.key].enabled === false));
}

function computeAchievements(){
  const s = {
    total: films.length,
    favCount: films.filter(f => f.fav).length,
    reviewCount: films.filter(f => f.review && f.review.trim()).length,
    tmdbCount: films.filter(f => f.tmdbId).length
  };

  const cumulative = getEffectiveCumulativeGroups().map(g => {
    const value = g.metric(s);
    let tierIndex = -1;
    g.tiers.forEach((t, i) => { if (value >= t.threshold) tierIndex = i; });
    return { ...g, value, tierIndex, next: g.tiers[tierIndex + 1] || null };
  });

  const hidden = getEffectiveHiddenAchievements().map(h => ({ ...h, unlocked: h.check(films) }));

  const tiersUnlocked = cumulative.reduce((sum, g) => sum + (g.tierIndex + 1), 0);
  const tiersTotal = cumulative.reduce((sum, g) => sum + g.tiers.length, 0);
  const hiddenUnlocked = hidden.filter(h => h.unlocked).length;

  return { cumulative, hidden, tiersUnlocked, tiersTotal, hiddenUnlocked, hiddenTotal: hidden.length };
}

const TIER_MEDALS = ['🥉', '🥈', '🥇'];

function renderTierCard(g){
  const prevThreshold = g.tierIndex >= 0 ? g.tiers[g.tierIndex].threshold : 0;
  const progressText = g.next
    ? `${g.value} / ${g.next.threshold} ${g.unit} (encore ${g.next.threshold - g.value} avant ${g.next.name})`
    : `Palier maximum atteint (${g.value} ${g.unit})`;
  const span = g.next ? g.next.threshold - prevThreshold : 1;
  const progressPct = g.next ? Math.min(100, Math.max(0, ((g.value - prevThreshold) / span) * 100)) : 100;

  // "maxed" (v2.1.x) : palier or déjà atteint — voir le traitement bordure
  // en dégradé + halo réservé à cet état dans css/style.css.
  const maxed = g.tierIndex === g.tiers.length - 1;
  return `
    <div class="ach-tier-card${maxed ? ' maxed' : ''}">
      <div class="ach-tier-head">
        <span class="ach-tier-icon">${g.icon}</span>
        <span class="ach-tier-label">${escapeHtml(g.label)}</span>
      </div>
      <div class="ach-tier-medals">
        ${g.tiers.map((t, i) => `<span class="ach-medal ${i <= g.tierIndex ? 'earned' : ''}" title="${escapeHtml(t.name)} : ${t.threshold} ${escapeHtml(g.unit)}">${TIER_MEDALS[i]}</span>`).join('')}
      </div>
      <div class="ach-tier-bar"><div class="ach-tier-fill" style="width:${progressPct.toFixed(1)}%"></div></div>
      <div class="ach-tier-progress">${escapeHtml(progressText)}</div>
    </div>
  `;
}

function renderHiddenCard(h){
  if (!h.unlocked){
    return `
      <div class="ach-hidden-card locked" title="Succès secret, pas encore débloqué">
        <span class="ach-hidden-icon">❔</span>
        <span class="ach-hidden-title">???</span>
      </div>
    `;
  }
  return `
    <div class="ach-hidden-card unlocked">
      <span class="ach-hidden-icon">${h.icon}</span>
      <span class="ach-hidden-title">${escapeHtml(h.title)}</span>
      <span class="ach-hidden-desc">${escapeHtml(h.desc)}</span>
    </div>
  `;
}

function renderAchievements(){
  const content = document.getElementById('achievementsContent');
  const a = computeAchievements();
  const totalUnlocked = a.tiersUnlocked + a.hiddenUnlocked;
  const totalPossible = a.tiersTotal + a.hiddenTotal;

  content.innerHTML = `
    <div class="ach-summary">
      <div class="ach-summary-count">${totalUnlocked} / ${totalPossible}</div>
      <div class="ach-summary-label">succès débloqués</div>
      <div class="ach-summary-bar"><div class="ach-summary-fill" style="width:${(totalUnlocked / totalPossible * 100).toFixed(1)}%"></div></div>
    </div>

    <div class="stats-section">
      <div class="stats-section-title">Paliers</div>
      <div class="ach-tier-grid">${a.cumulative.map(renderTierCard).join('')}</div>
    </div>

    <div class="stats-section">
      <div class="stats-section-title">Secrets (${a.hiddenUnlocked} / ${a.hiddenTotal} trouvés)</div>
      <div class="ach-hidden-grid">${a.hidden.map(renderHiddenCard).join('')}</div>
    </div>
  `;
}

function openAchievements(){
  // Accessible depuis la modale profil ("Mon activité") — la refermer
  // d'abord évite deux modales de tailles différentes superposées.
  closeProfileModal();
  renderAchievements();
  openOverlay('achievementsOverlay');
}

// Rouvre la modale profil (pas juste closeOverlay simple) : Succès n'est
// accessible QUE depuis "Mon activité" dans le profil (voir
// #achievementsBtn, index.html) — en ressortir doit ramener là où on
// était, pas sortir entièrement du profil.
function closeAchievements(){
  closeOverlay('achievementsOverlay', () => openProfileModal());
}

document.getElementById('achievementsBtn').addEventListener('click', openAchievements);
document.getElementById('closeAchievements').addEventListener('click', closeAchievements);
document.getElementById('achievementsOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'achievementsOverlay') closeAchievements();
});
