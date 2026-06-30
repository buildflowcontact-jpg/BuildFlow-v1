import { useParams } from 'react-router-dom';
import { WasteTab } from '@/modules/waste/WasteTab';

export default function ProjectWastePage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <WasteTab projectId={projectId} />;
}
