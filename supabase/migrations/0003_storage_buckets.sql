-- =========================================================================
-- BuildFlow — 0003_storage_buckets.sql
-- Buckets Supabase Storage + policies.
-- Convention de chemin : "<project_id>/<nom-fichier>" pour documents/plans/models3d
-- et "<user_id>/<nom-fichier>" pour avatars.
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('documents', 'documents', false, 104857600),
  ('plans', 'plans', false, 209715200),
  ('models3d', 'models3d', false, 524288000),
  ('avatars', 'avatars', true, 5242880)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- DOCUMENTS bucket
-- -------------------------------------------------------------------------
create policy "documents_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- -------------------------------------------------------------------------
-- PLANS bucket
-- -------------------------------------------------------------------------
create policy "plans_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'plans'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "plans_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'plans'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "plans_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'plans'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- -------------------------------------------------------------------------
-- MODELS3D bucket
-- -------------------------------------------------------------------------
create policy "models3d_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'models3d'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "models3d_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'models3d'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "models3d_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'models3d'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- -------------------------------------------------------------------------
-- AVATARS bucket (public en lecture, écriture limitée au propriétaire)
-- -------------------------------------------------------------------------
create policy "avatars_bucket_public_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_bucket_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );

create policy "avatars_bucket_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );

create policy "avatars_bucket_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );
