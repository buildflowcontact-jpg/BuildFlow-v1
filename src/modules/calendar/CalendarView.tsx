import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { usePunchList } from '@/hooks/usePunchList';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

type EventType = 'task' | 'daily-log' | 'punchlist';

interface CalendarEvent {
  id: string;
  label: string;
  type: EventType;
}

const EVENT_COLOR: Record<EventType, string> = {
  task: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  'daily-log': 'bg-green-100 text-green-700 hover:bg-green-200',
  punchlist: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
};

const EVENT_ROUTE: Record<EventType, string> = {
  task: 'tasks',
  'daily-log': 'daily-logs',
  punchlist: 'punchlist',
};

interface CalendarViewProps {
  projectId: string;
}

export function CalendarView({ projectId }: CalendarViewProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const { tasks, isLoading: tasksLoading } = useTasks(projectId);
  const { dailyLogs, isLoading: logsLoading } = useDailyLogs(projectId);
  const { items: punchItems, isLoading: punchLoading } = usePunchList(projectId);

  const isLoading = tasksLoading || logsLoading || punchLoading;

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    function addEvent(dateStr: string, event: CalendarEvent) {
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(event);
    }

    for (const task of tasks) {
      const dateStr = task.end_date ?? task.start_date;
      if (dateStr) {
        addEvent(dateStr, { id: task.id, label: task.title, type: 'task' });
      }
    }

    for (const log of dailyLogs) {
      addEvent(log.log_date, {
        id: log.id,
        label: log.progress_summary || 'Journal de chantier',
        type: 'daily-log',
      });
    }

    for (const item of punchItems) {
      if (item.due_date) {
        addEvent(item.due_date, { id: item.id, label: item.title, type: 'punchlist' });
      }
    }

    return map;
  }, [tasks, dailyLogs, punchItems]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold capitalize text-slate-900">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h3>
          <p className="text-sm text-slate-500">Calendrier chantier</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCurrentMonth(new Date())}>
            Aujourd'hui
          </Button>
          <button
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-blue-200" />
          Tâches
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-green-200" />
          Journaux de chantier
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-orange-200" />
          Réserves
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const events = eventsByDay.get(key) ?? [];
          const visible = events.slice(0, 3);
          const overflow = events.length - visible.length;
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={key}
              className={cn('min-h-[100px] p-1.5', !inMonth && 'bg-slate-50/60')}
            >
              <div className="mb-1 flex justify-center">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    today
                      ? 'bg-blue-600 text-white'
                      : inMonth
                        ? 'text-slate-700'
                        : 'text-slate-300',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {visible.map((event) => (
                  <button
                    key={`${event.type}-${event.id}`}
                    onClick={() => navigate(`/projects/${projectId}/${EVENT_ROUTE[event.type]}`)}
                    className={cn(
                      'w-full truncate rounded px-1 py-0.5 text-left text-xs font-medium transition-colors',
                      EVENT_COLOR[event.type],
                    )}
                    title={event.label}
                  >
                    {event.label}
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-xs text-slate-400">+{overflow} autre(s)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
