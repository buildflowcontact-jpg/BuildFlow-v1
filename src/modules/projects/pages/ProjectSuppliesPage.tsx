import { useParams } from 'react-router-dom';
import { SuppliesTab } from '@/modules/supplies/SuppliesTab';

export default function ProjectSuppliesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <SuppliesTab projectId={projectId} />;
}
