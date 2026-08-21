-- Mode maintenance : une ligne unique, lisible par tout le monde (même
-- déconnecté — la page de login elle-même doit pouvoir être bloquée), mais
-- modifiable seulement depuis le dashboard Supabase (aucune policy insert/
-- update n'est ouverte côté client). Voir js/auth.js.
create table public.site_status (
  id integer primary key default 1,
  maintenance boolean not null default false,
  message text,
  updated_at timestamptz not null default now(),
  constraint site_status_single_row check (id = 1)
);

alter table public.site_status enable row level security;

create policy "Anyone can read site status"
  on public.site_status for select
  using (true);

insert into public.site_status (id, maintenance) values (1, false);
