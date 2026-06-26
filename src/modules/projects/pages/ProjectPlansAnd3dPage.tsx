import { useParams } from 'react-router-dom';
import { PlansAnd3dTab } from '@/modules/plans/PlansAnd3dTab';

export default function ProjectPlansAnd3dPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <PlansAnd3dTab projectId={projectId} />;
}
