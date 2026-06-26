import type { ComponentType } from 'react';
import {
  FileText,
  Wallet,
  ListTree,
  GanttChartSquare,
  Map,
  Truck,
  ClipboardList,
  HelpCircle,
  Clock,
  LayoutDashboard,
  AlertTriangle,
  ClipboardCheck,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { TasksTab } from '@/modules/tasks/TasksTab';
import { GanttChart } from '@/modules/gantt/GanttChart';
import { DocumentsTab } from '@/modules/documents/DocumentsTab';
import { PlansAnd3dTab } from '@/modules/plans/PlansAnd3dTab';
import { SuppliesTab } from '@/modules/supplies/SuppliesTab';
import { IncidentsTab } from '@/modules/incidents/IncidentsTab';
import { PunchListTab } from '@/modules/punchlist/PunchListTab';
import { DailyLogsTab } from '@/modules/dailylogs/DailyLogsTab';
import { BudgetTab } from '@/modules/budget/BudgetTab';
import { RfisTab } from '@/modules/rfis/RfisTab';
import { TimeEntriesTab } from '@/modules/timeentries/TimeEntriesTab';
import { ClientPortalTab } from '@/modules/portal/ClientPortalTab';
import { BillingTab } from '@/modules/billing/BillingTab';
import { QualityTab } from '@/modules/quality/QualityTab';

export interface ProjectSectionDef {
  /** Doit correspondre au segment de route (ex: 'documents', 'gantt'). */
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  Component: ComponentType<{ projectId: string }>;
}

/**
 * Registre des onglets de projet réutilisables hors du routeur (ex: vue scindée).
 * Seuls les onglets ne dépendant que de `projectId` (pas de useOutletContext)
 * sont listés ici — "Tableau de bord" et "Membres" utilisent le contexte
 * enrichi de ProjectLayout et ne sont donc pas inclus.
 */
export const PROJECT_SECTIONS: ProjectSectionDef[] = [
  { key: 'documents', label: 'Documents', icon: FileText, Component: DocumentsTab },
  { key: 'budget', label: 'Budget', icon: Wallet, Component: BudgetTab },
  { key: 'billing', label: 'Devis & Facturation', icon: Receipt, Component: BillingTab },
  { key: 'tasks', label: 'Tâches', icon: ListTree, Component: TasksTab },
  { key: 'gantt', label: 'Planning', icon: GanttChartSquare, Component: GanttChart },
  { key: 'plans', label: 'Plans et 3D', icon: Map, Component: PlansAnd3dTab },
  { key: 'supplies', label: 'Commandes', icon: Truck, Component: SuppliesTab },
  { key: 'daily-logs', label: 'Journal de chantier', icon: ClipboardList, Component: DailyLogsTab },
  { key: 'rfis', label: 'RFI', icon: HelpCircle, Component: RfisTab },
  { key: 'time-entries', label: 'Pointage horaire', icon: Clock, Component: TimeEntriesTab },
  { key: 'client-portal', label: 'Portail client', icon: LayoutDashboard, Component: ClientPortalTab },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle, Component: IncidentsTab },
  { key: 'punchlist', label: 'Réserves', icon: ClipboardCheck, Component: PunchListTab },
  { key: 'quality', label: 'Qualité', icon: ShieldCheck, Component: QualityTab },
];

export function getProjectSection(key: string): ProjectSectionDef | undefined {
  return PROJECT_SECTIONS.find((s) => s.key === key);
}
