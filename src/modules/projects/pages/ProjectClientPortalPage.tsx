import { useParams } from 'react-router-dom';
import { ClientPortalTab } from '@/modules/portal/ClientPortalTab';

export default function ProjectClientPortalPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <ClientPortalTab projectId={projectId} />;
}
