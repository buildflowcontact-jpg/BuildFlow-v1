import { useParams } from 'react-router-dom';
import { QualityTab } from '@/modules/quality/QualityTab';

export default function ProjectQualityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <QualityTab projectId={projectId} />;
}
