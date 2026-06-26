import { useParams } from 'react-router-dom';
import { TimeEntriesTab } from '@/modules/timeentries/TimeEntriesTab';

export default function ProjectTimeEntriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <TimeEntriesTab projectId={projectId} />;
}
