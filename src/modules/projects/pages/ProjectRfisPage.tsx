import { useParams } from 'react-router-dom';
import { RfisTab } from '@/modules/rfis/RfisTab';

export default function ProjectRfisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <RfisTab projectId={projectId} />;
}
