import { useParams } from 'react-router-dom';
import { SecurityTab } from '@/modules/security/SecurityTab';

export default function ProjectSecurityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <SecurityTab projectId={projectId} />;
}
