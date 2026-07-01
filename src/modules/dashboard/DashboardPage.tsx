import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  FolderKanban,
  Truck,
  Shield,
  ShieldAlert,
  FileCheck,
  Users,
  GitBranch,
} from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDate, formatRelative, isOverdue } from '@/utils/date';
import { PROJECT_STATUS_LABELS, WARRANTY_STATUS_LABELS, WARRANTY_PRIORITY_LABELS, PLAN_DISCIPLINE_LABELS } from '@/types/domain';
import type { ProjectStatus, WarrantyPriority, WarrantyStatus, PlanDiscipline } from '@/types/database.types';

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

const WARRANTY_PRIORITY_TONE = {
  basse: 'slate',
  normale: 'blue',
  haute: 'yellow',
  urgente: 'red',
} as const satisfies Record<WarrantyPriority, 'slate' | 'blue' | 'yellow' | 'red'>;

const WARRANTY_STATUS_TONE = {
  ouvert: 'red',
  en_cours: 'yellow',
  resolu: 'green',
  clos: 'slate',
} as const satisfies Record<WarrantyStatus, 'red' | 'yellow' | 'green' | 'slate'>;

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) return <FullPageSpinner />;

  const {
    projects,
    overdueTasks,
    openIncidentsCount,
    lateSuppliesCount,
    recentActivity,
    progressByProject,
    overallProgress,
    openWarrantyClaimsCount,
    urgentWarrantyClaimsCount,
    plansPendingReviewCount,
    activeProspectsCount,
    urgentWarrantyClaims,
    plansPendingReview,
  } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Progression moyenne" value={`${overallProgress}%`} tone="bg-brand-50 text-brand-600" />
        <KpiCard icon={Clock} label="Tâches en retard" value={overdueTasks.length} tone="bg-amber-50 text-amber-600" />
        <KpiCard icon={AlertTriangle} label="Incidents ouverts" value={openIncidentsCount} tone="bg-red-50 text-red-600" />
        <KpiCard icon={Truck} label="Commandes en retard" value={lateSuppliesCount} tone="bg-violet-50 text-violet-600" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Shield} label="Garanties ouvertes" value={openWarrantyClaimsCount} tone="bg-orange-50 text-orange-600" />
        <KpiCard icon={ShieldAlert} label="Garanties urgentes" value={urgentWarrantyClaimsCount} tone="bg-rose-50 text-rose-600" />
        <KpiCard icon={FileCheck} label="Plans à réviser" value={plansPendingReviewCount} tone="bg-sky-50 text-sky-600" />
        <KpiCard icon={Users} label="Prospects actifs" value={activeProspectsCount} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Progression projets */}
          <Card>
            <CardHeader>
              <CardTitle>Progression des projets</CardTitle>
              <FolderKanban className="h-4 w-4 text-slate-400" />
            </CardHeader>
            {projects.length === 0 ? (
              <EmptyState icon={FolderKanban} title="Aucun projet" description="Créez votre premier projet pour démarrer." />
            ) : (
              <div className="flex flex-col gap-4">
                {projects.slice(0, 6).map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{project.name}</span>
                      <Badge tone="blue">{PROJECT_STATUS_LABELS[project.status as ProjectStatus]}</Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <ProgressBar value={progressByProject[project.id] ?? 0} className="flex-1" />
                      <span className="w-10 text-right text-xs text-slate-500">
                        {progressByProject[project.id] ?? 0}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Tâches en retard */}
          <Card>
            <CardHeader>
              <CardTitle>Tâches en retard</CardTitle>
              <Clock className="h-4 w-4 text-slate-400" />
            </CardHeader>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune tâche en retard. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overdueTasks.slice(0, 8).map((task) => (
                  <li key={task.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-slate-800">{task.title}</span>
                    <span className={isOverdue(task.end_date) ? 'text-red-500' : 'text-slate-400'}>
                      Échéance : {formatDate(task.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Garanties urgentes */}
          <Card>
            <CardHeader>
              <CardTitle>Garanties / SAV urgents</CardTitle>
              <ShieldAlert className="h-4 w-4 text-slate-400" />
            </CardHeader>
            {urgentWarrantyClaims.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune garantie ouverte.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {urgentWarrantyClaims.map((claim) => (
                  <li key={claim.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{claim.title}</p>
                      <p className="text-xs text-slate-400">
                        {claim.project?.name ?? '—'} · Signalé le {formatDate(claim.reported_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Badge tone={WARRANTY_PRIORITY_TONE[claim.priority as WarrantyPriority]}>
                        {WARRANTY_PRIORITY_LABELS[claim.priority as WarrantyPriority]}
                      </Badge>
                      <Badge tone={WARRANTY_STATUS_TONE[claim.status as WarrantyStatus]}>
                        {WARRANTY_STATUS_LABELS[claim.status as WarrantyStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* Activité récente */}
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <Activity className="h-4 w-4 text-slate-400" />
            </CardHeader>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400">Pas encore d'activité.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recentActivity.map((log) => (
                  <li key={log.id} className="text-sm">
                    <p className="text-slate-700">
                      <span className="font-medium">{log.user?.full_name ?? "Quelqu'un"}</span>{' '}
                      <span className="text-slate-500">{describeAction(log.action)}</span>
                    </p>
                    <p className="text-xs text-slate-400">{formatRelative(log.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Plans en attente de révision */}
          <Card>
            <CardHeader>
              <CardTitle>Plans à réviser</CardTitle>
              <GitBranch className="h-4 w-4 text-slate-400" />
            </CardHeader>
            {plansPendingReview.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun plan en attente.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {plansPendingReview.map((revision) => (
                  <li key={revision.id} className="text-sm">
                    <Link
                      to={`/projects/${revision.project_id}/plan-validations`}
                      className="block rounded-md hover:bg-slate-50 -mx-2 px-2 py-1.5 transition-colors"
                    >
                      <p className="truncate font-medium text-slate-800">{revision.title}</p>
                      <p className="text-xs text-slate-400">
                        {revision.project?.name ?? '—'} ·{' '}
                        {PLAN_DISCIPLINE_LABELS[revision.discipline as PlanDiscipline]} · Rev.{' '}
                        {revision.revision_index}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function describeAction(action: string): string {
  const map: Record<string, string> = {
    'project.created': 'a créé le projet',
    'project.updated': 'a mis à jour le projet',
    'task.created': 'a créé une tâche',
    'task.updated': 'a mis à jour une tâche',
    'document.uploaded': 'a déposé un document',
    'document.deleted': 'a supprimé un document',
    'plan.created': 'a ajouté un plan',
    'plan.new_version': "a déposé une nouvelle version d'un plan",
    'model3d.uploaded': 'a ajouté une maquette 3D',
    'supply.created': 'a créé un approvisionnement',
    'incident.created': 'a signalé un incident',
    'punch_list.created': 'a ajouté une réserve',
  };
  return map[action] ?? action;
}
