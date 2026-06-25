import { useEffect, useRef, useState } from 'react';
import { Map, Upload, Download, Trash2, History, Share2, Lock, Eye, MessageSquarePlus, X } from 'lucide-react';
import { usePlans, usePlanVersions, usePlanAnnotations } from '@/hooks/usePlans';
import { useProject } from '@/hooks/useProject';
import { useMyProjectAccess } from '@/hooks/useMyProjectAccess';
import { plansService } from '@/services/plans.service';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ResourceSharingModal } from '@/components/sharing/ResourceSharingModal';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/utils/cn';
import type { Plan, PlanVersion, ProjectMemberWithProfile } from '@/types/domain';

interface PlansTabProps {
  projectId: string;
}

export function PlansTab({ projectId }: PlansTabProps) {
  const { plans, isLoading, create, addVersion, remove } = usePlans(projectId);
  const { members } = useProject(projectId);
  const { canManage } = useMyProjectAccess(members);
  const userId = useAuthStore((s) => s.session?.user.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const newPlanFileRef = useRef<HTMLInputElement>(null);

  const [historyPlan, setHistoryPlan] = useState<Plan | null>(null);
  const versionFileRef = useRef<HTMLInputElement>(null);
  const [sharingPlan, setSharingPlan] = useState<Plan | null>(null);
  const [viewerPlan, setViewerPlan] = useState<Plan | null>(null);

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = newPlanFileRef.current?.files?.[0];
    if (!file || !userId || !newPlanName) return;
    create.mutate(
      { name: newPlanName, file, createdBy: userId },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewPlanName('');
        },
      }
    );
  }

  function handleAddVersion(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId || !historyPlan) return;
    addVersion.mutate({ plan: historyPlan, file, uploadedBy: userId });
    e.target.value = '';
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Plans</h3>
          <p className="text-sm text-slate-500">{plans.length} plan(s)</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Upload className="h-4 w-4" />
          Nouveau plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={Map} title="Aucun plan" description="Déposez vos plans pour suivre leurs versions." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {plans.map((plan) => (
            <li key={plan.id} className="flex items-center justify-between py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Map className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{plan.name}</p>
                  <p className="text-xs text-slate-400">Version {plan.current_version} · {formatDateTime(plan.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="purple">v{plan.current_version}</Badge>
                <button
                  onClick={() => setSharingPlan(plan)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                  title="Partager"
                  aria-label="Partager"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewerPlan(plan)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                  title="Aperçu"
                  aria-label="Aperçu"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setHistoryPlan(plan)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                  title="Versions"
                  aria-label="Versions"
                >
                  <History className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (!canManage) return;
                    if (confirm(`Supprimer le plan "${plan.name}" ?`)) remove.mutate(plan);
                  }}
                  disabled={!canManage}
                  title={canManage ? 'Supprimer' : 'Droits insuffisants pour supprimer ce plan'}
                  aria-label={canManage ? 'Supprimer' : 'Droits insuffisants pour supprimer ce plan'}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  {canManage ? <Trash2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau plan">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <Input label="Nom du plan" required value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} />
          <Input label="Fichier" type="file" ref={newPlanFileRef} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(historyPlan)} onClose={() => setHistoryPlan(null)} title={`Versions — ${historyPlan?.name ?? ''}`}>
        {historyPlan && <PlanVersionsList planId={historyPlan.id} />}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <input ref={versionFileRef} type="file" className="hidden" onChange={handleAddVersion} />
          <Button size="sm" variant="outline" onClick={() => versionFileRef.current?.click()} loading={addVersion.isPending}>
            <Upload className="h-4 w-4" />
            Déposer une nouvelle version
          </Button>
        </div>
      </Modal>

      <ResourceSharingModal
        open={Boolean(sharingPlan)}
        onClose={() => setSharingPlan(null)}
        resourceType="plan"
        resourceId={sharingPlan?.id}
        resourceLabel={sharingPlan?.name ?? ''}
        projectId={projectId}
        members={members}
      />

      <Modal open={Boolean(viewerPlan)} onClose={() => setViewerPlan(null)} title={`Aperçu — ${viewerPlan?.name ?? ''}`} size="lg">
        {viewerPlan && <PlanViewer planId={viewerPlan.id} members={members} userId={userId} />}
      </Modal>
    </Card>
  );
}

function PlanViewer({
  planId,
  members,
  userId,
}: {
  planId: string;
  members: ProjectMemberWithProfile[];
  userId: string | undefined;
}) {
  const { data: versions, isLoading: versionsLoading } = usePlanVersions(planId);
  const latestVersion: PlanVersion | undefined = versions?.[0];
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinContent, setPinContent] = useState('');

  const { annotations, addAnnotation } = usePlanAnnotations(latestVersion?.id);

  useEffect(() => {
    setFileUrl(null);
    if (!latestVersion) return;
    let active = true;
    void plansService.getVersionUrl(latestVersion).then((url) => {
      if (active) setFileUrl(url);
    });
    return () => {
      active = false;
    };
  }, [latestVersion]);

  if (versionsLoading) return <FullPageSpinner />;
  if (!latestVersion) return <p className="text-sm text-slate-400">Aucune version disponible.</p>;

  function memberName(uid: string | null) {
    if (!uid) return 'Utilisateur';
    const member = members.find((m) => m.profile?.id === uid);
    return member?.profile?.full_name ?? member?.profile?.email ?? 'Utilisateur';
  }

  function handleSurfaceClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!annotateMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingPin({ x, y });
    setPinContent('');
  }

  function submitPin() {
    if (!pendingPin || !pinContent.trim() || !userId) return;
    addAnnotation.mutate(
      { author_id: userId, x: pendingPin.x, y: pendingPin.y, content: pinContent.trim() },
      { onSuccess: () => setPendingPin(null) }
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Version {latestVersion.version}</p>
        <Button
          size="sm"
          variant={annotateMode ? 'primary' : 'outline'}
          onClick={() => {
            setAnnotateMode((v) => !v);
            setPendingPin(null);
          }}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {annotateMode ? 'Mode annotation activé' : 'Annoter'}
        </Button>
      </div>

      <div
        onClick={handleSurfaceClick}
        className={cn(
          'relative h-[60vh] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50',
          annotateMode && 'cursor-crosshair'
        )}
      >
        {fileUrl ? (
          <iframe src={fileUrl} title="Aperçu du plan" className="h-full w-full border-0" />
        ) : (
          <FullPageSpinner />
        )}

        {annotations.map((a) => (
          <div
            key={a.id}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
              !
            </div>
            <div className="pointer-events-none absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <p className="font-medium text-slate-700">{memberName(a.author_id)}</p>
              <p className="text-slate-500">{a.content}</p>
            </div>
          </div>
        ))}

        {pendingPin && (
          <div
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-brand-300 bg-white p-2 shadow-lg"
            style={{ left: `${pendingPin.x * 100}%`, top: `${pendingPin.y * 100}%` }}
          >
            <div className="flex w-56 flex-col gap-2">
              <Textarea
                autoFocus
                rows={2}
                value={pinContent}
                onChange={(e) => setPinContent(e.target.value)}
                placeholder="Commentaire…"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setPendingPin(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-3.5 w-3.5" />
                </button>
                <Button size="sm" onClick={submitPin} loading={addAnnotation.isPending} disabled={!pinContent.trim()}>
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanVersionsList({ planId }: { planId: string }) {
  const { data: versions, isLoading } = usePlanVersions(planId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
    <ul className="flex flex-col gap-2">
      {versions.map((version) => (
        <li key={version.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-slate-800">Version {version.version}</p>
            <p className="text-xs text-slate-400">{formatDateTime(version.created_at)}</p>
            {version.notes && <p className="text-xs text-slate-500">{version.notes}</p>}
          </div>
          <button
            onClick={() => handleDownload(version)}
            disabled={downloadingId === version.id}
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
