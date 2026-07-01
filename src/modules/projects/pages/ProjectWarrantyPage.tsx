import { useParams } from 'react-router-dom';
import { WarrantyTab } from '@/modules/warranty/WarrantyTab';

export default function ProjectWarrantyPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <WarrantyTab projectId={projectId} />;
}
