import { useParams } from 'react-router-dom';
import { DailyLogsTab } from '@/modules/dailylogs/DailyLogsTab';

export default function ProjectDailyLogsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <DailyLogsTab projectId={projectId} />;
}
