-- =========================================================================
-- BuildFlow — 0009_restrict_avatars_bucket_listing.sql
-- avatars_bucket_public_select autorisait n'importe quel utilisateur
-- authentifié à lister/interroger storage.objects pour TOUT le bucket
-- avatars (énumération des dossiers = des user_id, et des noms de fichiers
-- de tous les comptes). Le bucket est marqué "public"
-- (storage.buckets.public = true) : l'affichage réel des photos via
-- getPublicUrl() ne dépend pas de cette policy RLS (la diffusion publique
-- des fichiers d'un bucket public passe par un chemin HTTP séparé, non
-- soumis à RLS). Le code applicatif n'appelle jamais
-- .storage.from('avatars').list() sur le dossier d'un autre utilisateur —
-- on peut donc restreindre le SELECT à son propre dossier sans rien casser.
-- =========================================================================

drop policy if exists "avatars_bucket_public_select" on storage.objects;

create policy "avatars_bucket_public_select" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );
