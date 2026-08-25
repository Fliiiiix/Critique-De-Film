-- Interface admin (succès + happenings) — voir js/admin.js. Un seul blob
-- JSON par utilisateur plutôt qu'une table par réglage : les succès/
-- happenings restent définis dans le code (js/achievements.js,
-- js/happenings.js), cette table ne stocke que les écarts par rapport à ces
-- valeurs par défaut (seuils modifiés, activé/désactivé, happenings
-- "génériques" créés depuis l'interface) — une nouvelle case à cocher dans
-- l'admin n'exigera donc pas systématiquement une nouvelle migration.
--
-- Accessible à n'importe quel compte côté RLS (chacun ne voit/modifie que sa
-- propre ligne, comme les autres tables) — la restriction à un seul email
-- admin (ADMIN_EMAIL dans js/admin.js) est un choix d'affichage côté client,
-- pas une vraie séparation de rôle en base. Suffisant pour un usage perso :
-- même logique que site_status, géré à la main dans le Table Editor sans
-- notion de rôle non plus.
create table public.admin_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_config enable row level security;

create policy "Users can view own admin config"
  on public.admin_config for select
  using (auth.uid() = user_id);

create policy "Users can insert own admin config"
  on public.admin_config for insert
  with check (auth.uid() = user_id);

create policy "Users can update own admin config"
  on public.admin_config for update
  using (auth.uid() = user_id);
