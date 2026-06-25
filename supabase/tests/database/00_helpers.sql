-- =========================================================================
-- BuildFlow — Fonctions utilitaires pour les tests pgTAP.
--
-- Ces fonctions ne sont créées que dans la base de test locale (jamais
-- migrées en production) : elles permettent de créer des utilisateurs de
-- test complets (auth.users + profil + organisation auto-créée par le
-- trigger existant) et de simuler une session authentifiée pour exercer
-- les policies RLS comme le ferait un vrai client Supabase.
-- =========================================================================

create schema if not exists tests;

-- Crée un utilisateur de test (déclenche les triggers existants :
-- handle_new_user -> profil, handle_new_profile_organization -> organisation
-- personnelle + organization_members en 'owner'). Retourne l'id créé.
create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt('test-password', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('full_name', p_email),
    'authenticated',
    'authenticated'
  );
  return v_id;
end;
$$;

-- Simule une session authentifiée pour l'utilisateur donné : auth.uid()
-- (basé sur request.jwt.claims->>'sub') renverra son id pour le reste de
-- la transaction/session de test.
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;
