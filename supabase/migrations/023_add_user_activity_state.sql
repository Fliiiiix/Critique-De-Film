-- v1.6, phase 5 : digest de retour + badges de notification. Voir
-- js/activityState.js (loadActivityState/markSeen/hasUnread/loadDigest).
--
-- Table dédiée plutôt que réutiliser admin_config (migrations/018) : cette
-- dernière est sémantiquement "réglages admin" même si techniquement
-- écrivable par tout le monde — mélanger les deux rendrait le blob JSON
-- ambigu. Une vraie table (pas localStorage) : l'utilisateur se connecte
-- déjà depuis plusieurs appareils (upload d'avatar, etc.), un badge "vu"
-- doit suivre partout plutôt que rester coincé sur un seul appareil.
create table public.user_activity_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_amis timestamptz,
  last_seen_groupes timestamptz,
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_activity_state enable row level security;

create policy "Users can view own activity state"
  on public.user_activity_state for select
  using (auth.uid() = user_id);

create policy "Users can insert own activity state"
  on public.user_activity_state for insert
  with check (auth.uid() = user_id);

create policy "Users can update own activity state"
  on public.user_activity_state for update
  using (auth.uid() = user_id);
