import { useCallback, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isWeekend, isWithinInterval, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Flag, FileDown, LocateFixed } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { usePhases } from '@/hooks/usePhases';
import { useProject } from '@/hooks/useProject';
import { useUiStore, type GanttZoom } from '@/stores/uiStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { TaskFormModal } from '@/modules/tasks/TaskFormModal';
import { PHASE_TYPE_LABELS } from '@/types/domain';
import type { Task, TaskWithChildren, Phase } from '@/types/domain';
import type { TablesInsert, TablesUpdate, TaskStatus, PhaseType } from '@/types/database.types';
import { cn } from '@/utils/cn';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 44;
const SECTION_HEIGHT = 30;
const LABEL_WIDTH = 280;
const VIEWPORT_MAX_HEIGHT = 640;

const PX_PER_DAY: Record<GanttZoom, number> = { day: 36, week: 14, month: 5 };

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#94a3b8',
  in_progress: '#2563eb',
  blocked: '#ef4444',
  done: '#16a34a',
};

type LayoutItem =
  | { kind: 'section'; key: string; label: string; y: number; height: number }
  | { kind: 'task'; key: string; task: TaskWithChildren; depth: number; y: number; height: number };

function taskDate(task: Task): { start: Date | null; end: Date | null } {
  const start = task.start_date ? new Date(task.start_date) : task.end_date ? new Date(task.end_date) : null;
  const end = task.end_date ? new Date(task.end_date) : task.start_date ? new Date(task.start_date) : null;
  return { start, end };
}

function buildLayout(phases: Phase[], tree: TaskWithChildren[]): { items: LayoutItem[]; totalHeight: number } {
  const byPhase = new Map<string | null, TaskWithChildren[]>();
  for (const root of tree) {
    const key = root.phase_id;
    const list = byPhase.get(key) ?? [];
    list.push(root);
    byPhase.set(key, list);
  }

  const items: LayoutItem[] = [];
  let y = 0;

  function pushNode(node: TaskWithChildren, depth: number) {
    items.push({ kind: 'task', key: node.id, task: node, depth, y, height: ROW_HEIGHT });
    y += ROW_HEIGHT;
    for (const child of node.children) pushNode(child, depth + 1);
  }

  const orderedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);
  for (const phase of orderedPhases) {
    const roots = byPhase.get(phase.id) ?? [];
    if (roots.length === 0) continue;
    items.push({ kind: 'section', key: `phase-${phase.id}`, label: `${phase.name} (${PHASE_TYPE_LABELS[phase.type as PhaseType]})`, y, height: SECTION_HEIGHT });
    y += SECTION_HEIGHT;
    for (const root of roots) pushNode(root, 0);
  }

  const orphanRoots = byPhase.get(null) ?? [];
  if (orphanRoots.length > 0) {
    items.push({ kind: 'section', key: 'phase-none', label: 'Sans phase', y, height: SECTION_HEIGHT });
    y += SECTION_HEIGHT;
    for (const root of orphanRoots) pushNode(root, 0);
  }

  return { items, totalHeight: y };
}

interface GanttChartProps {
  projectId: string;
}

export function GanttChart({ projectId }: GanttChartProps) {
  const { tasks, tree, dependencies, isLoading, create, update } = useTasks(projectId);
  const { phases } = usePhases(projectId);
  const { project, members } = useProject(projectId);
  const zoom = useUiStore((s) => s.ganttZoom);
  const setZoom = useUiStore((s) => s.setGanttZoom);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pxPerDay = PX_PER_DAY[zoom];

  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates: Date[] = [];
    for (const task of tasks) {
      const { start, end } = taskDate(task);
      if (start) dates.push(start);
      if (end) dates.push(end);
    }
    const today = new Date();
    if (dates.length === 0) {
      return { rangeStart: addDays(today, -7), rangeEnd: addDays(today, 30) };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return { rangeStart: addDays(min, -4), rangeEnd: addDays(max, 8) };
  }, [tasks]);

  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const totalWidth = totalDays * pxPerDay;

  const xForDate = useCallback(
    (date: Date): number => differenceInCalendarDays(date, rangeStart) * pxPerDay,
    [rangeStart, pxPerDay]
  );

  const columns = useMemo(() => {
    const cols: { x: number; width: number; label: string }[] = [];
    if (zoom === 'day') {
      let cursor = rangeStart;
      while (cursor <= rangeEnd) {
        cols.push({ x: xForDate(cursor), width: pxPerDay, label: format(cursor, 'dd/MM', { locale: fr }) });
        cursor = addDays(cursor, 1);
      }
    } else if (zoom === 'week') {
      let cursor = startOfWeek(rangeStart, { weekStartsOn: 1 });
      while (cursor <= rangeEnd) {
        const next = addDays(cursor, 7);
        cols.push({ x: xForDate(cursor), width: 7 * pxPerDay, label: `Sem. ${format(cursor, 'dd/MM', { locale: fr })}` });
        cursor = next;
      }
    } else {
      let cursor = startOfMonth(rangeStart);
      while (cursor <= rangeEnd) {
        const next = startOfMonth(addDays(cursor, 32));
        const width = differenceInCalendarDays(next, cursor) * pxPerDay;
        cols.push({ x: xForDate(cursor), width, label: format(cursor, 'MMMM yyyy', { locale: fr }) });
        cursor = next;
      }
    }
    return cols;
  }, [zoom, rangeStart, rangeEnd, pxPerDay, xForDate]);

  const weekendBands = useMemo(() => {
    if (zoom !== 'day') return [];
    const bands: { x: number; width: number }[] = [];
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
      if (isWeekend(cursor)) bands.push({ x: xForDate(cursor), width: pxPerDay });
      cursor = addDays(cursor, 1);
    }
    return bands;
  }, [zoom, rangeStart, rangeEnd, pxPerDay, xForDate]);

  const { items: layout, totalHeight } = useMemo(() => buildLayout(phases, tree), [phases, tree]);

  const taskLayoutById = useMemo(() => {
    const map = new Map<string, LayoutItem & { kind: 'task' }>();
    for (const item of layout) if (item.kind === 'task') map.set(item.task.id, item);
    return map;
  }, [layout]);

  const today = new Date();
  const todayX = isWithinInterval(today, { start: rangeStart, end: rangeEnd }) ? xForDate(today) : null;

  function openEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
  }

  function openCreate() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function handleFormSubmit(payload: Omit<TablesInsert<'tasks'>, 'project_id'> | TablesUpdate<'tasks'>, current: Task | null) {
    if (current) {
      update.mutate({ id: current.id, payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(payload as Omit<TablesInsert<'tasks'>, 'project_id'>, { onSuccess: () => setFormOpen(false) });
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.todo }} /> À faire
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.in_progress }} /> En cours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.blocked }} /> Bloquée
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.done }} /> Terminée
          </span>
          <span className="flex items-center gap-1.5">
            <Flag className="h-3 w-3 text-amber-500" /> Jalon
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {(['day', 'week', 'month'] as GanttZoom[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150',
                  zoom === z ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {z === 'day' ? 'Jour' : z === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={todayX == null}
            onClick={() => {
              const el = scrollRef.current;
              if (el && todayX != null) {
                el.scrollTo({ left: Math.max(0, todayX + LABEL_WIDTH - el.clientWidth / 2), behavior: 'smooth' });
              }
            }}
          >
            <LocateFixed className="h-4 w-4" />
            Aujourd'hui
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!project}
            onClick={() => {
              // Chargé à la demande : jsPDF/jspdf-autotable ne sont utiles qu'à
              // l'export, inutile de les inclure dans le bundle initial.
              if (project) void import('@/services/pdfExport.service').then((m) => m.exportGanttPdf(project, phases, tree));
            }}
          >
            <FileDown className="h-4 w-4" />
            Exporter en PDF
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          Aucune tâche planifiée. Ajoutez des tâches depuis l'onglet « Tâches » pour les visualiser ici.
        </p>
      ) : (
        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: VIEWPORT_MAX_HEIGHT }}>
          <div className="flex" style={{ width: LABEL_WIDTH + totalWidth, minHeight: HEADER_HEIGHT + totalHeight }}>
            <div className="sticky left-0 z-20 shrink-0 border-r border-slate-100 bg-white" style={{ width: LABEL_WIDTH }}>
              <div
                className="sticky top-0 z-10 flex items-center border-b border-slate-100 bg-white px-3 text-xs font-semibold uppercase text-slate-400"
                style={{ height: HEADER_HEIGHT }}
              >
                Tâche
              </div>
              <div style={{ height: totalHeight }} className="relative">
                {layout.map((item) =>
                  item.kind === 'section' ? (
                    <div
                      key={item.key}
                      className="absolute left-0 right-0 flex items-center bg-slate-50 px-3 text-xs font-semibold text-slate-500"
                      style={{ top: item.y, height: item.height }}
                    >
                      {item.label}
                    </div>
                  ) : (
                    <button
                      key={item.key}
                      onClick={() => openEdit(item.task)}
                      onMouseEnter={() => setHoveredKey(item.key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === item.key ? null : k))}
                      className={cn(
                        'absolute left-0 right-0 flex items-center truncate px-3 text-left text-sm text-slate-700 transition-colors duration-100',
                        hoveredKey === item.key ? 'bg-brand-50' : 'hover:bg-slate-50'
                      )}
                      style={{ top: item.y, height: item.height, paddingLeft: 12 + item.depth * 16 }}
                    >
                      {item.task.is_milestone && <Flag className="mr-1.5 h-3 w-3 shrink-0 text-amber-500" />}
                      <span className="truncate">{item.task.title}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="relative" style={{ width: totalWidth }}>
              <div className="sticky top-0 z-10 flex border-b border-slate-100 bg-white" style={{ height: HEADER_HEIGHT }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full items-center border-r border-slate-100 px-2 text-xs font-medium text-slate-500"
                    style={{ left: col.x, width: col.width }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              <div className="relative" style={{ height: totalHeight, width: totalWidth }}>
                {weekendBands.map((band, i) => (
                  <div key={i} className="absolute top-0 bg-slate-50" style={{ left: band.x, width: band.width, height: totalHeight }} />
                ))}

                {columns.map((col, i) => (
                  <div key={i} className="absolute top-0 border-r border-slate-50" style={{ left: col.x, height: totalHeight }} />
                ))}

                {layout.map((item) =>
                  item.kind === 'section' ? (
                    <div key={item.key} className="absolute left-0 right-0 bg-slate-50" style={{ top: item.y, height: item.height }} />
                  ) : (
                    <div
                      key={item.key}
                      onMouseEnter={() => setHoveredKey(item.key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === item.key ? null : k))}
                      className={cn('absolute left-0 right-0 transition-colors duration-100', hoveredKey === item.key && 'bg-brand-50/70')}
                      style={{ top: item.y, height: item.height }}
                    />
                  )
                )}

                {todayX != null && (
                  <div className="absolute top-0 z-10 w-px bg-red-400" style={{ left: todayX, height: totalHeight }}>
                    <span className="absolute -left-6 -top-4 rounded bg-red-500 px-1 text-[10px] font-medium text-white">
                      Aujourd'hui
                    </span>
                  </div>
                )}

                <svg className="pointer-events-none absolute left-0 top-0 z-0" width={totalWidth} height={totalHeight}>
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                    </marker>
                  </defs>
                  {dependencies.map((dep) => {
                    const from = taskLayoutById.get(dep.depends_on_task_id);
                    const to = taskLayoutById.get(dep.task_id);
                    if (!from || !to) return null;
                    const fromDates = taskDate(from.task);
                    const toDates = taskDate(to.task);
                    if (!fromDates.end || !toDates.start) return null;

                    const x1 = xForDate(fromDates.end);
                    const y1 = from.y + from.height / 2;
                    const x2 = xForDate(toDates.start);
                    const y2 = to.y + to.height / 2;
                    const midX = x1 + Math.max(12, (x2 - x1) / 2);

                    const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2 - 6} ${y2}`;
                    return <path key={dep.id} d={path} stroke="#94a3b8" strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />;
                  })}
                </svg>

                {layout.map((item) => {
                  if (item.kind !== 'task') return null;
                  const { start, end } = taskDate(item.task);
                  if (!start || !end) return null;
                  const x = xForDate(start);
                  const width = Math.max(pxPerDay * 0.6, xForDate(addDays(end, 1)) - x);
                  const color = STATUS_COLORS[item.task.status as TaskStatus];

                  if (item.task.is_milestone) {
                    const cx = x;
                    const cy = item.y + item.height / 2;
                    return (
                      <button
                        key={item.key}
                        onClick={() => openEdit(item.task)}
                        className="absolute z-10"
                        style={{ left: cx - 7, top: cy - 7, width: 14, height: 14 }}
                        title={item.task.title}
                        aria-label={item.task.title}
                      >
                        <svg width={14} height={14}>
                          <rect x={2} y={2} width={10} height={10} fill="#f59e0b" transform="rotate(45 7 7)" />
                        </svg>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={item.key}
                      onClick={() => openEdit(item.task)}
                      className="absolute z-10 flex items-center overflow-hidden rounded-md text-left shadow-sm transition-opacity hover:opacity-90"
                      style={{ left: x, top: item.y + 6, width, height: item.height - 12, backgroundColor: `${color}1f`, border: `1px solid ${color}` }}
                      title={`${item.task.title} (${item.task.progress}%)`}
                    >
                      <div className="h-full" style={{ width: `${item.task.progress}%`, backgroundColor: color, opacity: 0.55 }} />
                      <span className="absolute left-2 truncate text-xs font-medium" style={{ color, right: width > 60 ? 36 : 4 }}>
                        {item.task.title}
                      </span>
                      {width > 36 && (
                        <span
                          className="absolute right-1.5 shrink-0 text-[10px] font-semibold"
                          style={{ color }}
                        >
                          {item.task.progress}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingTask={editingTask}
        allTasks={tasks}
        phases={phases}
        members={members}
        saving={create.isPending || update.isPending}
        onSubmit={handleFormSubmit}
      />
    </Card>
  );
}