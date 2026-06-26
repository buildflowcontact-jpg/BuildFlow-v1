import { useParams } from 'react-router-dom';
import { IncidentsTab } from '@/modules/incidents/IncidentsTab';

export default function ProjectIncidentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <IncidentsTab projectId={projectId} />;
}
