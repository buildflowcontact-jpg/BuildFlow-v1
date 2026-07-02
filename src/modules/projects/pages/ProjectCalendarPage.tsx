import { useParams } from 'react-router-dom';
import { CalendarView } from '@/modules/calendar/CalendarView';

export default function ProjectCalendarPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <CalendarView projectId={projectId} />;
}
