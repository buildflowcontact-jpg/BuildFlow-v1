-- =========================================================================
-- Ajoute des index sur les 25 clés étrangères signalées sans index couvrant
-- par l'advisor unindexed_foreign_keys. Ces colonnes sont utilisées dans des
-- jointures et des policies RLS (ex: lookups par auteur/uploader/owner) ;
-- sans index, ces requêtes dégénèrent en scan complet de table.
-- =========================================================================

create index if not exists idx_activity_logs_user_id on public.activity_logs (user_id);
create index if not exists idx_clients_created_by on public.clients (created_by);
create index if not exists idx_comments_author_id on public.comments (author_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_incidents_assigned_to on public.incidents (assigned_to);
create index if not exists idx_incidents_photo_document_id on public.incidents (photo_document_id);
create index if not exists idx_incidents_reported_by on public.incidents (reported_by);
create index if not exists idx_models3d_uploaded_by on public.models3d (uploaded_by);
create index if not exists idx_organization_members_user_id on public.organization_members (user_id);
create index if not exists idx_organizations_owner_id on public.organizations (owner_id);
create index if not exists idx_plan_annotations_author_id on public.plan_annotations (author_id);
create index if not exists idx_plan_versions_uploaded_by on public.plan_versions (uploaded_by);
create index if not exists idx_planning_snapshots_created_by on public.planning_snapshots (created_by);
create index if not exists idx_plans_created_by on public.plans (created_by);
create index if not exists idx_project_companies_company_id on public.project_companies (company_id);
create index if not exists idx_project_contacts_created_by on public.project_contacts (created_by);
create index if not exists idx_projects_owner_id on public.projects (owner_id);
create index if not exists idx_punch_list_items_assigned_to on public.punch_list_items (assigned_to);
create index if not exists idx_punch_list_items_created_by on public.punch_list_items (created_by);
create index if not exists idx_punch_list_items_photo_document_id on public.punch_list_items (photo_document_id);
create index if not exists idx_resource_permissions_granted_by on public.resource_permissions (granted_by);
create index if not exists idx_resource_permissions_grantee_user_id on public.resource_permissions (grantee_user_id);
create index if not exists idx_resource_permissions_project_id on public.resource_permissions (project_id);
create index if not exists idx_supplies_created_by on public.supplies (created_by);
create index if not exists idx_tasks_created_by on public.tasks (created_by);
