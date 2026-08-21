-- Propositions de films au sein d'un groupe : un membre propose un film
-- (recherche TMDB, comme le formulaire principal), les autres votent et
-- commentent — le "Reddit de films" au sein d'un groupe fermé. Voir
-- js/proposals.js et les tables groups/group_members (migrations/011).

create table public.group_proposals (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_title text,
  tmdb_id integer,
  poster_url text,
  overview text,
  release_year integer,
  created_at timestamptz not null default now()
);

alter table public.group_proposals enable row level security;

create table public.group_proposal_votes (
  id bigint generated always as identity primary key,
  proposal_id bigint not null references public.group_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  constraint group_proposal_votes_unique unique (proposal_id, user_id)
);

alter table public.group_proposal_votes enable row level security;

create table public.group_proposal_comments (
  id bigint generated always as identity primary key,
  proposal_id bigint not null references public.group_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.group_proposal_comments enable row level security;

-- group_proposals : visible/insérable par les membres du groupe uniquement.
create policy "Members can view group proposals"
  on public.group_proposals for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_proposals.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can propose films"
  on public.group_proposals for insert
  with check (
    proposed_by = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Proposer or group owner can delete a proposal"
  on public.group_proposals for delete
  using (
    proposed_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- group_proposal_votes : un vote par membre et par proposition (upsert côté
-- client), scope vérifié en repassant par le groupe de la proposition.
create policy "Members can view proposal votes"
  on public.group_proposal_votes for select
  using (
    exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can vote"
  on public.group_proposal_votes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can change their own vote"
  on public.group_proposal_votes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can remove their own vote"
  on public.group_proposal_votes for delete
  using (user_id = auth.uid());

-- group_proposal_comments : discussion libre, scope groupe, modération par
-- le créateur du groupe en plus de l'auteur du commentaire.
create policy "Members can view proposal comments"
  on public.group_proposal_comments for select
  using (
    exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can comment"
  on public.group_proposal_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_proposals gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = proposal_id and gm.user_id = auth.uid()
    )
  );

create policy "Author or group owner can delete a comment"
  on public.group_proposal_comments for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_proposals gp
      join public.groups g on g.id = gp.group_id
      where gp.id = proposal_id and g.owner_id = auth.uid()
    )
  );
