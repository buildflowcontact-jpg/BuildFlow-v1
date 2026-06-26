import { useParams } from 'react-router-dom';
import { TasksTab } from '@/modules/tasks/TasksTab';

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <TasksTab projectId={projectId} />;
}
