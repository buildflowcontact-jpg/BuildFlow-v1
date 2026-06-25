import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Clock, TrendingUp, FolderKanban, Truck } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDate, formatRelative, isOverdue } from '@/utils/date';
import { PROJECT_STATUS_LABELS } from '@/types/domain';
import type { ProjectStatus } from '@/types/database.types';

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

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) return <FullPageSpinner />;

  const { projects, overdueTasks, openIncidentsCount, lateSuppliesCount, recentActivity, progressByProject, overallProgress } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Progression moyenne" value={`${overallProgress}%`} tone="bg-brand-50 text-brand-600" />
        <KpiCard icon={Clock} label="Tâches en retard" value={overdueTasks.length} tone="bg-amber-50 text-amber-600" />
        <KpiCard icon={AlertTriangle} label="Incidents ouverts" value={openIncidentsCount} tone="bg-red-50 text-red-600" />
        <KpiCard icon={Truck} label="Commandes en retard" value={lateSuppliesCount} tone="bg-violet-50 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
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
        </div>

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
                    <span className="font-medium">{log.user?.full_name ?? 'Quelqu’un'}</span>{' '}
                    <span className="text-slate-500">{describeAction(log.action)}</span>
                  </p>
                  <p className="text-xs text-slate-400">{formatRelative(log.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
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
