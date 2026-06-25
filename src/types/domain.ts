import type { Tables } from './database.types';
import type {
  ProjectStatus,
  PhaseType,
  PhaseStatus,
  TaskStatus,
  TaskPriority,
  SupplyStatus,
  IncidentSeverity,
  IncidentStatus,
  PunchListStatus,
  PermissionLevel,
  ResourceType,
} from './database.types';

export type Profile = Tables<'profiles'>;
export type Organization = Tables<'organizations'>;
export type OrganizationMember = Tables<'organization_members'>;
export type Client = Tables<'clients'>;
export type Company = Tables<'companies'>;
export type Project = Tables<'projects'>;
export type ProjectMember = Tables<'project_members'>;
export type ProjectContact = Tables<'project_contacts'>;
export type ProjectCompany = Tables<'project_companies'>;
export type Phase = Tables<'phases'>;
export type Task = Tables<'tasks'>;
export type TaskDependency = Tables<'task_dependencies'>;
export type Comment = Tables<'comments'>;
export type Document = Tables<'documents'>;
export type Plan = Tables<'plans'>;
export type PlanVersion = Tables<'plan_versions'>;
export type PlanAnnotation = Tables<'plan_annotations'>;
export type Model3D = Tables<'models3d'>;
export type Supply = Tables<'supplies'>;
export type Incident = Tables<'incidents'>;
export type PunchListItem = Tables<'punch_list_items'>;
export type Notification = Tables<'notifications'>;
export type ActivityLog = Tables<'activity_logs'>;
export type ResourcePermission = Tables<'resource_permissions'>;
export type PlanningSnapshot = Tables<'planning_snapshots'>;
export type DailyLog = Tables<'daily_logs'>;
export type BudgetCategory = Tables<'budget_categories'>;
export type Expense = Tables<'expenses'>;
export type Rfi = Tables<'rfis'>;
export type ChangeOrder = Tables<'change_orders'>;
export type TimeEntry = Tables<'time_entries'>;
export type ResourceSignature = Tables<'signatures'>;
export type ResourceAttachment = Tables<'resource_attachments'>;
export type DailyReport = Tables<'daily_reports'>;

export interface DailyReportTimeEntry {
  user_id: string;
  full_name: string;
  hours: number;
}

export interface DailyReportWeatherDay {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
}

export interface BudgetCategoryWithChildren extends BudgetCategory {
  children: BudgetCategoryWithChildren[];
}

export interface TaskWithChildren extends Task {
  children: TaskWithChildren[];
}

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: Profile | null;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  prospection: 'Prospection',
  devis: 'Devis',
  etude: 'Étude',
  preparation: 'Préparation',
  approvisionnement: 'Approvisionnement',
  chantier: 'Chantier',
  reception: 'Réception',
  livre: 'Livré',
  annule: 'Annulé',
};

export const PHASE_TYPE_LABELS: Record<PhaseType, string> = {
  commercial: 'Commercial',
  etudes: 'Études',
  preparation: 'Préparation',
  approvisionnement: 'Approvisionnement',
  chantier: 'Chantier',
  reception: 'Réception',
  custom: 'Personnalisée',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  blocked: 'Bloquée',
  done: 'Terminée',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, string> = {
  pending: 'En attente',
  ordered: 'Commandé',
  shipped: 'Expédié',
  delivered: 'Livré',
  delayed: 'En retard',
  cancelled: 'Annulé',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

export const PUNCH_LIST_STATUS_LABELS: Record<PunchListStatus, string> = {
  open: 'Ouverte',
  in_progress: 'En cours',
  resolved: 'Résolue',
  verified: 'Vérifiée',
};

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  termine: 'Terminée',
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  view: 'Lecture',
  edit: 'Modification',
  manage: 'Gestion complète',
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  document: 'Document',
  plan: 'Plan',
  task: 'Tâche',
  project: 'Projet',
};

export const DOCUMENT_TYPE_LABELS: Record<Document['type'], string> = {
  pdf: 'PDF',
  plan: 'Plan',
  photo: 'Photo',
  doe: 'DOE',
  compte_rendu: 'Compte-rendu',
  autre: 'Autre',
};

export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMember['role'], string> = {
  owner: 'Propriétaire',
  collaborator: 'Collaborateur',
  client: 'Client',
};

// Professions disponibles pour le profil utilisateur — alignées sur les rôles
// projet métier afin d'éviter toute saisie libre erronée.
export const JOB_TITLE_OPTIONS = [
  'Chef de projet',
  "Bureau d'études",
  'Commercial',
  'Chef de chantier',
  'Technicien',
  'Sous-traitant',
] as const;

export const EXPENSE_KIND_LABELS: Record<Expense['kind'], string> = {
  committed: 'Engagé',
  actual: 'Réel',
};

export const RFI_STATUS_LABELS: Record<Rfi['status'], string> = {
  open: 'Ouverte',
  answered: 'Répondue',
  closed: 'Fermée',
};

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrder['status'], string> = {
  draft: 'Brouillon',
  pending_approval: 'En attente d’approbation',
  approved: 'Approuvé',
  rejected: 'Refusé',
};
