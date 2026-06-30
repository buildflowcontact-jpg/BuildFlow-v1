import { useParams } from 'react-router-dom';
import { DoeTab } from '@/modules/doe/DoeTab';

export default function ProjectDoePage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <DoeTab projectId={projectId} />;
}
