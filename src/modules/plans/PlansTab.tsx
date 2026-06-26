import { useRef, useState } from 'react';
import { Map, Upload, Trash2, History, Share2, Lock, Eye } from 'lucide-react';
import { usePlans } from '@/hooks/usePlans';
import { useProject } from '@/hooks/useProject';
import { useMyProjectAccess } from '@/hooks/useMyProjectAccess';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ResourceSharingModal } from '@/components/sharing/ResourceSharingModal';
import { formatDateTime } from '@/utils/date';
import type { Plan } from '@/types/domain';
import { PlanViewer } from './PlanViewer';
import { PlanVersionsList } from './PlanVersionsList';

function isPdfFile(file: File) {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
}

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
    if (!isPdfFile(file)) {
      alert('Seuls les fichiers .pdf sont acceptés pour les plans.');
      return;
    }
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
    if (!isPdfFile(file)) {
      alert('Seuls les fichiers .pdf sont acceptés pour les plans.');
      e.target.value = '';
      return;
    }
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
          <Input label="Fichier (.pdf)" type="file" accept=".pdf,application/pdf" ref={newPlanFileRef} required />
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
        {historyPlan && <PlanVersionsList planId={historyPlan.id} plan={historyPlan} members={members} userId={userId} />}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <input ref={versionFileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleAddVersion} />
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

      <Modal open={Boolean(viewerPlan)} onClose={() => setViewerPlan(null)} title={`Aperçu — ${viewerPlan?.name ?? ''}`} size="xl">
        {viewerPlan && <PlanViewer plan={viewerPlan} members={members} userId={userId} />}
      </Modal>
    </Card>
  );
}
