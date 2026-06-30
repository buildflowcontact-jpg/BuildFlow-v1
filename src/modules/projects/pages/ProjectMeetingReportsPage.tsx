import { useParams } from 'react-router-dom';
import { MeetingReportsTab } from '@/modules/meetingReports/MeetingReportsTab';

export default function ProjectMeetingReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <MeetingReportsTab projectId={projectId} />;
}
