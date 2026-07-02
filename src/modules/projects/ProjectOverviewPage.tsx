import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileDown, FileText, TrendingUp, Wallet, ClipboardCheck, CalendarClock } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useTasks } from '@/hooks/useTasks';
import { usePhases } from '@/hooks/usePhases';
import { usePunchList } from '@/hooks/usePunchList';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useRfis } from '@/hooks/useRfis';
import { useChangeOrders } from '@/hooks/useChangeOrders';
import { useBudgetCategories, useExpenses } from '@/hooks/useBudget';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import { ProjectContactsSection } from './ProjectContactsSection';
import { cn } from '@/utils/cn';
import type { ProjectOutletContext } from './ProjectLayout';

// ── Helpers ------------------------------------------------------------------

function diffDays(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

// ── Sous-composants ----------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'green' | 'amber' | 'red';
  children?: React.ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-brand-600 bg-brand-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      {children}
    </Card>
  );
}

// ── Page principale ----------------------------------------------------------

export function ProjectOverviewPage() {
  const { project, projectId, phases: layoutPhases, members } = useOutletContext<ProjectOutletContext>();
  const { clients } = useClients();
  const { tasks } = useTasks(projectId);
  const { phases } = usePhases(projectId);
  const { items: punchItems } = usePunchList(projectId);
  const { dailyLogs } = useDailyLogs(projectId);
  const { rfis } = useRfis(projectId);
  const { changeOrders } = useChangeOrders(projectId);
  const { categories } = useBudgetCategories(projectId);
  const { expenses } = useExpenses(projectId);
  const client = clients.find((c) => c.id === project.client_id);

  // ── KPI : avancement tâches -----------------------------------------------
  const taskKpi = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [tasks]);

  // ── KPI : budget ----------------------------------------------------------
  const budgetKpi = useMemo(() => {
    const planned = categories
      .filter((c) => !c.parent_category_id)
      .reduce((s, c) => s + Number(c.planned_amount), 0);
    const committed = expenses.filter((e) => e.kind === 'committed').reduce((s, e) => s + Number(e.amount), 0);
    const actual = expenses.filter((e) => e.kind === 'actual').reduce((s, e) => s + Number(e.amount), 0);
    const hasData = categories.length > 0 || expenses.length > 0;
    const pct = planned > 0 ? Math.round((committed / planned) * 100) : 0;
    const over = planned > 0 && committed > planned;
    return { planned, committed, actual, hasData, pct, over };
  }, [categories, expenses]);

  // ── KPI : réserves --------------------------------------------------------
  const punchKpi = useMemo(() => {
    const open = punchItems.filter((i) => i.status !== 'resolved' && i.status !== 'verified').length;
    const resolved = punchItems.filter((i) => i.status === 'resolved' || i.status === 'verified').length;
    return { open, resolved, total: punchItems.length };
  }, [punchItems]);

  // ── KPI : planning --------------------------------------------------------
  const planningKpi = useMemo(() => {
    if (!project.end_date_planned) return { label: 'Date non fixée', days: null, late: false };
    const today = new Date().toISOString().slice(0, 10);
    const days = diffDays(project.end_date_planned, today);
    if (days < 0) return { label: `En retard de ${Math.abs(days)} j`, days, late: true };
    if (days === 0) return { label: "Échéance aujourd'hui", days: 0, late: false };
    return { label: `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`, days, late: false };
  }, [project.end_date_planned]);

  // -- Tâches par phase ------------------------------------------------------
  const tasksByPhase = useMemo(() => {
    const noPhase = tasks.filter((t) => !t.phase_id);
    const result = phases.map((ph) => {
      const phaseTasks = tasks.filter((t) => t.phase_id === ph.id);
      const done = phaseTasks.filter((t) => t.status === 'done').length;
      return { id: ph.id, name: ph.name, total: phaseTasks.length, done };
    });
    if (noPhase.length > 0) {
      result.push({ id: '__none__', name: 'Sans phase', total: noPhase.length, done: noPhase.filter((t) => t.status === 'done').length });
    }
    return result.filter((p) => p.total > 0);
  }, [phases, tasks]);

  function handleExportPdf() {
    void import('@/services/pdfExport.service').then((m) =>
      m.exportProjectSummaryPdf(project, layoutPhases, tasks, members)
    );
  }

  function handleExportWeekly() {
    void import('@/services/pdfExport.service').then((m) =>
      m.exportWeeklyReportPdf(project, tasks, dailyLogs, punchItems, rfis, changeOrders, {
        planned: budgetKpi.planned,
        committed: budgetKpi.committed,
        actual: budgetKpi.actual,
        hasData: budgetKpi.hasData,
      })
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Vue d'ensemble</h2>
        <Button variant="outline" size="sm" onClick={handleExportWeekly}>
          <FileText className="h-4 w-4" />
          Rapport hebdo
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <FileDown className="h-4 w-4" />
          Exporter PDF
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* Avancement */}
        <KpiCard
          icon={TrendingUp}
          label="Avancement"
          value={`${taskKpi.pct} %`}
          sub={`${taskKpi.done} / ${taskKpi.total} tâches terminées`}
          tone={taskKpi.pct === 100 ? 'green' : 'default'}
        >
          <ProgressBar value={taskKpi.pct} />
        </KpiCard>

        {/* Budget */}
        <KpiCard
          icon={Wallet}
          label="Budget"
          value={budgetKpi.hasData ? formatCurrency(budgetKpi.committed) : (project.budget != null ? `${project.budget.toLocaleString('fr-FR')} €` : '--')}
          sub={budgetKpi.hasData ? `sur ${formatCurrency(budgetKpi.planned)} prévu (${budgetKpi.pct} %)` : 'Budget global'}
          tone={budgetKpi.over ? 'red' : budgetKpi.pct > 80 ? 'amber' : 'default'}
        >
          {budgetKpi.hasData && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-1.5 rounded-full transition-all duration-500', budgetKpi.over ? 'bg-red-500' : budgetKpi.pct > 80 ? 'bg-amber-400' : 'bg-brand-500')}
                style={{ width: `${Math.min(budgetKpi.pct, 100)}%` }}
              />
            </div>
          )}
        </KpiCard>

        {/* Reserves */}
        <KpiCard
          icon={ClipboardCheck}
          label="Reserves"
          value={String(punchKpi.open)}
          sub={punchKpi.total > 0 ? `${punchKpi.resolved} levée(s) sur ${punchKpi.total}` : 'Aucune réserve'}
          tone={punchKpi.open === 0 ? 'green' : punchKpi.open > 5 ? 'red' : 'amber'}
        />

        {/* Planning */}
        <KpiCard
          icon={CalendarClock}
          label="Planning"
          value={planningKpi.days !== null ? (planningKpi.late ? `-${Math.abs(planningKpi.days)} j` : `+${planningKpi.days} j`) : '--'}
          sub={planningKpi.label}
          tone={planningKpi.late ? 'red' : (planningKpi.days !== null && planningKpi.days < 14) ? 'amber' : 'green'}
        />
      </div>

      {/* Corps */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-600">{project.description || 'Aucune description.'}</p>
          </Card>

          <ProjectContactsSection projectId={projectId} />

          {/* Avancement par phase */}
          {tasksByPhase.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tâches par phase</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-3">
                {tasksByPhase.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{p.name}</span>
                        <span className="text-slate-400">{p.done}/{p.total} · {pct} %</span>
                      </div>
                      <ProgressBar value={pct} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        {/* Colonne droite : infos */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Client</dt>
              <dd className="font-medium text-slate-800">{client?.name ?? '--'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-slate-500">Adresse</dt>
              <dd className="text-right font-medium text-slate-800">{project.address ?? '--'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Début</dt>
              <dd className="font-medium text-slate-800">
                {project.start_date ? formatDate(project.start_date) : '--'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Fin prévue</dt>
              <dd className="font-medium text-slate-800">
                {project.end_date_planned ? formatDate(project.end_date_planned) : '--'}
              </dd>
            </div>
            {budgetKpi.hasData ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Budget prévu</dt>
                  <dd className="font-medium text-slate-800">{formatCurrency(budgetKpi.planned)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Engagé</dt>
                  <dd className="font-medium text-slate-800">{formatCurrency(budgetKpi.committed)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Dépensé</dt>
                  <dd className="font-medium text-slate-800">{formatCurrency(budgetKpi.actual)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-slate-500">Budget</dt>
                <dd className="font-medium text-slate-800">
                  {project.budget != null ? `${project.budget.toLocaleString('fr-FR')} €` : '--'}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
