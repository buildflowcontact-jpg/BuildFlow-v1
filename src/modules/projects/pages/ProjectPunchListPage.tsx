import { useParams } from 'react-router-dom';
import { PunchListTab } from '@/modules/punchlist/PunchListTab';

export default function ProjectPunchListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <PunchListTab projectId={projectId} />;
}
