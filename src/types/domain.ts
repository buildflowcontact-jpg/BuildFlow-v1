import type { Tables } from './database.types';
import type {
  ProjectStatus,
  PhaseType,
  PhaseStatus,
  TaskStatus,
  TaskPriority,
  SupplyStatus,
  SupplyCategory,
  IncidentSeverity,
  IncidentStatus,
  PunchListStatus,
  PermissionLevel,
  ResourceType,
  QualityInspectionStatus,
  QualityInspectionResult,
  NonConformitySeverity,
  NonConformityStatus,
  MeetingActionItemStatus,
  FirePermitStatus,
  PpspsStatus,
  DoeItemCategory,
  DoeItemStatus,
  WasteCategory,
  WasteTrackingStatus,
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
export type AnnotatedCapture = Tables<'annotated_captures'>;
export type CaptureReport = Tables<'capture_reports'>;
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
export type Quote = Tables<'quotes'>;
export type QuoteItem = Tables<'quote_items'>;
export type Invoice = Tables<'invoices'>;
export type InvoiceItem = Tables<'invoice_items'>;
export type InvoicePayment = Tables<'invoice_payments'>;
export type QualityTemplate = Tables<'quality_templates'>;
export type QualityTemplateItem = Tables<'quality_template_items'>;
export type QualityInspection = Tables<'quality_inspections'>;
export type QualityInspectionResultRow = Tables<'quality_inspection_results'>;
export type NonConformity = Tables<'non_conformities'>;
export type Conversation = Tables<'conversations'>;
export type ConversationParticipant = Tables<'conversation_participants'>;
export type Message = Tables<'messages'>;
export type MeetingReport = Tables<'meeting_reports'>;
export type MeetingActionItem = Tables<'meeting_action_items'>;
export type FirePermit = Tables<'fire_permits'>;
export type PpspsRecord = Tables<'ppsps_records'>;
export type DoeItem = Tables<'doe_items'>;
export type WasteTracking = Tables<'waste_trackings'>;

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

/**
 * Forme d'une annotation libre sur une capture d'écran (plan 2D ou maquette
 * 3D) : trait de dessin libre, bloc de texte positionné, ou pin avec
 * commentaire. Stocké tel quel dans la colonne jsonb `annotated_captures.annotations`.
 */
export type CaptureAnnotationShape =
  | { type: 'stroke'; points: { x: number; y: number }[]; color: string; width: number }
  | { type: 'text'; x: number; y: number; text: string; color: string }
  | { type: 'pin'; x: number; y: number; comment: string; color: string };

export type CaptureSourceType = 'plan' | 'model3d';
export type CaptureStatus = 'draft' | 'sent';

/** Participant d'un compte-rendu de réunion : membre interne (avec id) ou contact externe en saisie libre. */
export interface MeetingAttendee {
  name: string;
  role?: string;
  member_id?: string | null;
}

export interface MeetingReportWithItems extends MeetingReport {
  actionItems: MeetingActionItem[];
}

/** Élément de checklist d'un permis de feu (mesure de prévention cochée ou non). */
export interface PrecautionItem {
  label: string;
  checked: boolean;
}

export const DEFAULT_FIRE_PERMIT_PRECAUTIONS: PrecautionItem[] = [
  { label: 'Zone dégagée de matières combustibles sur un rayon de 10 m', checked: false },
  { label: 'Extincteur(s) approprié(s) à proximité immédiate', checked: false },
  { label: 'Protection des éléments combustibles non déplaçables', checked: false },
  { label: "Vérification de l'absence d'atmosphère explosive", checked: false },
  { label: 'Surveillance continue pendant les travaux', checked: false },
  { label: "Surveillance après l'arrêt des travaux (minimum 60 minutes)", checked: false },
  { label: "Moyens de communication d'urgence disponibles", checked: false },
];

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

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  materiau: 'Matériau',
  equipement: 'Équipement',
  location: 'Location',
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

export const MEETING_ACTION_ITEM_STATUS_LABELS: Record<MeetingActionItemStatus, string> = {
  open: 'À faire',
  done: 'Fait',
};

export const FIRE_PERMIT_STATUS_LABELS: Record<FirePermitStatus, string> = {
  draft: 'Brouillon',
  issued: 'Émis',
  closed: 'Clôturé',
};

export const PPSPS_STATUS_LABELS: Record<PpspsStatus, string> = {
  en_attente: 'En attente',
  recu: 'Reçu',
  valide: 'Validé',
};

export const DOE_ITEM_STATUS_LABELS: Record<DoeItemStatus, string> = {
  manquant: 'Manquant',
  recu: 'Reçu',
  valide: 'Validé',
};

export const DOE_ITEM_CATEGORY_LABELS: Record<DoeItemCategory, string> = {
  plan: "Plan d'exécution / DOE",
  notice_technique: 'Notice technique',
  pv_reception: 'PV de réception',
  garantie: 'Garantie / certificat',
  dossier_entretien: "Dossier d'entretien",
  autre: 'Autre',
};

export const WASTE_CATEGORY_LABELS: Record<WasteCategory, string> = {
  dangereux: 'Déchets dangereux (DIS)',
  non_dangereux: 'Déchets non dangereux (DIB)',
  inerte: 'Déchets inertes (gravats)',
};

export const WASTE_TRACKING_STATUS_LABELS: Record<WasteTrackingStatus, string> = {
  en_attente: 'En attente',
  enleve: 'Enlevé',
  traite: 'Traité',
};

export const QUALITY_INSPECTION_STATUS_LABELS: Record<QualityInspectionStatus, string> = {
  in_progress: 'En cours',
  completed: 'Terminée',
};

export const QUALITY_INSPECTION_RESULT_LABELS: Record<QualityInspectionResult, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  non_applicable: 'Non applicable',
};

export const NON_CONFORMITY_SEVERITY_LABELS: Record<NonConformitySeverity, string> = {
  mineure: 'Mineure',
  majeure: 'Majeure',
  critique: 'Critique',
};

export const NON_CONFORMITY_STATUS_LABELS: Record<NonConformityStatus, string> = {
  ouverte: 'Ouverte',
  en_cours: 'En cours',
  resolue: 'Résolue',
  verifiee: 'Vérifiée',
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

// ---------------------------------------------------------------------------
// Devis & Facturation
// ---------------------------------------------------------------------------

export const QUOTE_STATUS_LABELS: Record<Quote['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  declined: 'Refusé',
  expired: 'Expiré',
};

export const INVOICE_STATUS_LABELS: Record<Invoice['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  partially_paid: 'Partiellement payée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

export const INVOICE_OPERATION_CATEGORY_LABELS: Record<Invoice['operation_category'], string> = {
  biens: 'Biens',
  services: 'Services',
  mixte: 'Mixte',
};

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface QualityTemplateWithItems extends QualityTemplate {
  items: QualityTemplateItem[];
}

export interface QualityInspectionWithResults extends QualityInspection {
  results: QualityInspectionResultRow[];
}

// ---------------------------------------------------------------------------
// Messagerie interne
// ---------------------------------------------------------------------------

export type ConversationType = 'group' | 'direct';

export const CONVERSATION_TYPE_LABELS: Record<ConversationType, string> = {
  group: 'Équipe projet',
  direct: 'Message direct',
};

/** Conversation enrichie pour la liste : libellé affiché, dernier message et compteur de non-lus. */
export interface ConversationWithMeta extends Conversation {
  displayName: string;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

/** Calcule HT, TVA et TTC à partir d'une liste de lignes (devis ou facture). */
export function computeLineTotals<T extends { quantity: number; unit_price: number; vat_rate: number }>(
  items: T[]
): { subtotal: number; vatAmount: number; total: number } {
  let subtotal = 0;
  let vatAmount = 0;
  for (const item of items) {
    const lineHt = item.quantity * item.unit_price;
    subtotal += lineHt;
    vatAmount += lineHt * (item.vat_rate / 100);
  }
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

// ---------------------------------------------------------------------------
// Portail client : widgets configurables (projects.portal_widgets, jsonb)
// ---------------------------------------------------------------------------
export interface PortalWidgetsConfig {
  progress: boolean;
  daily_logs: boolean;
  rfis: boolean;
  change_orders: boolean;
  documents: boolean;
}

export const DEFAULT_PORTAL_WIDGETS: PortalWidgetsConfig = {
  progress: true,
  daily_logs: true,
  rfis: true,
  change_orders: true,
  documents: true,
};

export const PORTAL_WIDGET_LABELS: Record<keyof PortalWidgetsConfig, string> = {
  progress: 'Avancement du projet',
  daily_logs: 'Journal de chantier',
  rfis: 'Demandes d’information (RFI)',
  change_orders: 'Avenants',
  documents: 'Documents récents',
};

/** Fusionne la config stockée (jsonb, potentiellement partielle) avec les valeurs par défaut. */
export function parsePortalWidgets(value: unknown): PortalWidgetsConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PORTAL_WIDGETS };
  const raw = value as Record<string, unknown>;
  const result = { ...DEFAULT_PORTAL_WIDGETS };
  for (const key of Object.keys(DEFAULT_PORTAL_WIDGETS) as (keyof PortalWidgetsConfig)[]) {
    if (typeof raw[key] === 'boolean') result[key] = raw[key] as boolean;
  }
  return result;
}
