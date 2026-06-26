-- =========================================================================
-- BuildFlow — 0026_internal_messaging.sql
--
-- Module Messagerie interne (écart identifié face à Vertuoza/Obat/Graneet).
-- Portée :
--   1. Un fil de discussion "groupe" par projet, visible par toute l'équipe
--      (is_project_team_member), créé à la volée (ensure_project_group_conversation).
--   2. Des conversations directes (1-à-1) entre deux membres d'un même
--      projet, créées à la volée (get_or_create_direct_conversation).
--   3. Messages texte simples avec horodatage de dernière modification.
--
-- Choix de conception : pour le fil "groupe", l'appartenance se déduit
-- dynamiquement de project_members (pas de table de participants à
-- synchroniser quand l'équipe change). Pour les conversations "directes",
-- conversation_participants liste les deux membres exacts. Les insertions
-- dans conversation_participants ne passent que par les fonctions
-- security definer ci-dessous (pas de policy d'insertion directe).
-- =========================================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null default 'group' check (type in ('group', 'direct')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

-- Un seul fil "groupe" par projet.
create unique index idx_conversations_one_group_per_project
  on public.conversations(project_id)
  where (type = 'group');

create index idx_conversations_project on public.conversations(project_id, type);

create trigger trg_conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index idx_conversation_participants_user on public.conversation_participants(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index idx_messages_conversation on public.messages(conversation_id, created_at);

-- Met à jour conversations.last_message_at à chaque nouveau message, pour
-- trier les fils par activité récente sans recalcul côté client.
create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at, updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

-- -------------------------------------------------------------------------
-- Visibilité d'une conversation : équipe entière pour un fil "groupe",
-- participants exacts pour un fil "direct".
-- -------------------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (
        (c.type = 'group' and public.is_project_team_member(c.project_id))
        or (c.type = 'direct' and exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = c.id and cp.user_id = auth.uid()
        ))
      )
  );
$$;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_participant" on public.conversations
  for select using (public.is_conversation_participant(id));

create policy "conversations_insert_team" on public.conversations
  for insert with check (
    created_by = auth.uid() and public.is_project_team_member(project_id)
  );

-- Aucune policy d'update/delete : les conversations ne sont ni renommées ni
-- supprimées dans cette première itération.

create policy "conversation_participants_select_own_thread" on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));

create policy "conversation_participants_update_own_read_marker" on public.conversation_participants
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pas de policy d'insertion : la table n'est peuplée que par les fonctions
-- security definer ci-dessous (création de conversation directe).

create policy "messages_select_participant" on public.messages
  for select using (public.is_conversation_participant(conversation_id));

create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
  );

-- =========================================================================
-- ensure_project_group_conversation : récupère (ou crée) le fil "groupe"
-- d'un projet, réservé à l'équipe.
-- =========================================================================
create or replace function public.ensure_project_group_conversation(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_project_team_member(p_project_id) then
    raise exception 'Action non autorisée';
  end if;

  select id into v_id from public.conversations
  where project_id = p_project_id and type = 'group';

  if v_id is null then
    insert into public.conversations (project_id, type, created_by)
    values (p_project_id, 'group', auth.uid())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.ensure_project_group_conversation(uuid) from public;
grant execute on function public.ensure_project_group_conversation(uuid) to authenticated;

-- =========================================================================
-- get_or_create_direct_conversation : récupère (ou crée) le fil "direct"
-- entre l'appelant et un autre membre du même projet.
-- =========================================================================
create or replace function public.get_or_create_direct_conversation(p_project_id uuid, p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_other_user_id = auth.uid() then
    raise exception 'Impossible de créer une conversation avec soi-même';
  end if;

  if not public.is_project_team_member(p_project_id) then
    raise exception 'Action non autorisée';
  end if;

  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_other_user_id and role in ('owner', 'collaborator')
  ) then
    raise exception 'Ce membre ne fait pas partie de l''équipe du projet';
  end if;

  select c.id into v_id
  from public.conversations c
  where c.project_id = p_project_id and c.type = 'direct'
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = auth.uid())
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = p_other_user_id);

  if v_id is null then
    insert into public.conversations (project_id, type, created_by)
    values (p_project_id, 'direct', auth.uid())
    returning id into v_id;

    insert into public.conversation_participants (conversation_id, user_id) values (v_id, auth.uid());
    insert into public.conversation_participants (conversation_id, user_id) values (v_id, p_other_user_id);
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid, uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid, uuid) to authenticated;

-- =========================================================================
-- mark_conversation_read : met à jour le marqueur de lecture de l'appelant
-- pour une conversation (utilisé pour le badge "non lus").
-- =========================================================================
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Action non autorisée';
  end if;

  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
