-- Upload d'avatar réel (Supabase Storage) plutôt qu'une URL à héberger
-- ailleurs — voir la case "Ou uploader une image" dans js/profile.js.
-- Bucket public en lecture (l'avatar doit s'afficher pour les amis ET sur
-- le profil public #/u/:userId, qui n'exige pas de connexion) mais chacun
-- ne peut écrire que dans son propre dossier (avatars/<user_id>/...).
-- Chemin fixe par utilisateur (pas de nom de fichier aléatoire) : re-uploader
-- remplace l'ancien avatar au lieu d'accumuler des fichiers orphelins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read access on avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- (storage.foldername(name))[1] = premier segment du chemin, ex.
-- "avatars/<user_id>/avatar" -> "<user_id>" (aide standard de Supabase
-- Storage pour scoper par dossier).
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
