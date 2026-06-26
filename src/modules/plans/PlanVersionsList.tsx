import { useState } from 'react';
import { Download, Send } from 'lucide-react';
import { usePlanVersions } from '@/hooks/usePlans';
import { plansService } from '@/services/plans.service';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/date';
import type { Plan, PlanVersion, ProjectMemberWithProfile } from '@/types/domain';
import { SendVersionModal } from './SendVersionModal';

interface PlanVersionsListProps {
  planId: string;
  plan: Plan;
  members: ProjectMemberWithProfile[];
  userId: string | undefined;
}

export function PlanVersionsList({ planId, plan, members, userId }: PlanVersionsListProps) {
  const { data: versions, isLoading } = usePlanVersions(planId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingVersion, setSendingVersion] = useState<PlanVersion | null>(null);

  async function handleDownload(version: NonNullable<typeof versions>[number]) {
    setDownloadingId(version.id);
    try {
      const url = await plansService.getVersionUrl(version);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) return <FullPageSpinner />;
  if (!versions || versions.length === 0) return <p className="text-sm text-slate-400">Aucune version.</p>;

  return (
    <>
      <ul className="flex flex-col gap-2">
        {versions.map((version) => (
          <li key={version.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-slate-800">Version {version.version}</p>
              <p className="text-xs text-slate-400">{formatDateTime(version.created_at)}</p>
              {version.notes && <p className="text-xs text-slate-500">{version.notes}</p>}
              {version.sent_at && <p className="text-xs text-emerald-600">Envoyée le {formatDateTime(version.sent_at)}</p>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSendingVersion(version)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                title="Envoyer"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDownload(version)}
                disabled={downloadingId === version.id}
                className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                title="Télécharger"
                aria-label="Télécharger"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {sendingVersion && (
        <SendVersionModal
          open
          onClose={() => setSendingVersion(null)}
          plan={plan}
          version={sendingVersion}
          members={members}
          userId={userId}
        />
      )}
    </>
  );
}
