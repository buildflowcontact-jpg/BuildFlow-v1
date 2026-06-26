import { useParams } from 'react-router-dom';
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
import { ChangeOrdersTab } from '@/modules/changeorders/ChangeOrdersTab';
import { TimeEntriesTab } from '@/modules/timeentries/TimeEntriesTab';
import { ClientPortalTab } from '@/modules/portal/ClientPortalTab';
import { BillingTab } from '@/modules/billing/BillingTab';

export function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <TasksTab projectId={projectId} />;
}

export function ProjectGanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <GanttChart projectId={projectId} />;
}

export function ProjectDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <DocumentsTab projectId={projectId} />;
}

export function ProjectPlansAnd3dPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <PlansAnd3dTab projectId={projectId} />;
}

export function ProjectSuppliesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <SuppliesTab projectId={projectId} />;
}

export function ProjectIncidentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <IncidentsTab projectId={projectId} />;
}

export function ProjectPunchListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <PunchListTab projectId={projectId} />;
}

export function ProjectDailyLogsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <DailyLogsTab projectId={projectId} />;
}

export function ProjectBudgetPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <BudgetTab projectId={projectId} />;
}

export function ProjectRfisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <RfisTab projectId={projectId} />;
}

export function ProjectChangeOrdersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <ChangeOrdersTab projectId={projectId} />;
}

export function ProjectTimeEntriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <TimeEntriesTab projectId={projectId} />;
}

export function ProjectClientPortalPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <ClientPortalTab projectId={projectId} />;
}

export function ProjectBillingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <BillingTab projectId={projectId} />;
}
