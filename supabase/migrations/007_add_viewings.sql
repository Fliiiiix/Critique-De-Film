-- Journal des visionnages : chaque ligne = une fois où un film a été vu.
-- `films` reste "la fiche notée" (une par film) ; `viewings` permet les
-- revisionnages (plusieurs dates pour le même film) et alimente le journal
-- chronologique et le compteur "revu Nx" — voir js/journal.js.
create table public.viewings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  film_id bigint not null references public.films(id) on delete cascade,
  watched_at bigint not null,
  -- Note propre à ce visionnage (ex. "revu avec Camille"), distincte du
  -- commentaire général du film (films.review).
  note text,
  created_at timestamptz not null default now()
);

alter table public.viewings enable row level security;

create policy "Users can view own viewings"
  on public.viewings for select
  using (auth.uid() = user_id);

create policy "Users can insert own viewings"
  on public.viewings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own viewings"
  on public.viewings for update
  using (auth.uid() = user_id);

create policy "Users can delete own viewings"
  on public.viewings for delete
  using (auth.uid() = user_id);

-- Rétro-remplissage : chaque film déjà noté obtient un premier visionnage
-- à sa date d'ajout, pour que le journal et les compteurs soient cohérents
-- dès l'exécution de cette migration (pas besoin de tout re-saisir à la main).
insert into public.viewings (user_id, film_id, watched_at)
select user_id, id, added from public.films;
