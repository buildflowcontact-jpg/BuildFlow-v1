import { useParams } from 'react-router-dom';
import { GanttChart } from '@/modules/gantt/GanttChart';

export default function ProjectGanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <GanttChart projectId={projectId} />;
}
