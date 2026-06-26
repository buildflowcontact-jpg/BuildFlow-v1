import { useParams } from 'react-router-dom';
import { ChangeOrdersTab } from '@/modules/changeorders/ChangeOrdersTab';

export default function ProjectChangeOrdersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <ChangeOrdersTab projectId={projectId} />;
}
