import { useRef, useState, useMemo } from 'react';
import { Plus, Trash2, Upload, Download, CheckCircle, XCircle, RotateCcw, Send, GitBranch } from 'lucide-react';
import { usePlanRevisions } from '@/hooks/usePlanRevisions';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import {
  PLAN_REVISION_STATUS_LABELS,
  PLAN_DISCIPLINE_LABELS,
} from '@/types/domain';
import type { PlanRevision } from '@/types/domain';
import type { PlanRevisionStatus, PlanDiscipline, TablesInsert } from '@/types/database.types';
import { formatDate } from '@/utils/date';

// ── Badges ────────────────────────────────────────────────────────────────────
const STATUS_TONE: Record<PlanRevisionStatus, 'blue' | 'yellow' | 'green' | 'red' | 'purple'> = {
  en_attente: 'purple',
  soumis: 'blue',
  en_revision: 'yellow',
  approuve: 'green',
  refuse: 'red',
};

// ── Suggestion d'indice suivant ───────────────────────────────────────────────
function nextRevisionIndex(existing: string[]): string {
  if (existing.length === 0) return 'A';
  const letters = existing.filter((i) => /^[A-Z]$/.test(i)).sort();
  if (letters.length > 0) {
    const last = letters[letters.length - 1] ?? 'A';
    const next = String.fromCharCode(last.charCodeAt(0) + 1);
    return next <= 'Z' ? next : `${existing.length + 1}`;
  }
  const nums = existing.filter((i) => /^\d+$/.test(i)).map(Number).sort((a, b) => a - b);
  if (nums.length > 0) return String((nums[nums.length - 1] ?? 0) + 1).padStart(2, '0');
  return 'B';
}

// ── Types formulaires ─────────────────────────────────────────────────────────
type CreateForm = {
  title: string;
  discipline: PlanDiscipline;
  lot: string;
  revision_index: string;
};

type ReviewForm = {
  action: 'approuve' | 'refuse' | 'en_revision';
  comment: string;
};

const EMPTY_CREATE: CreateForm = {
  title: '',
  discipline: 'architecture',
  lot: '',
  revision_index: 'A',
};

// ── Composant principal ───────────────────────────────────────────────────────
export function PlanValidationTab({ projectId }: { projectId: string }) {
  const { revisions, isLoading, create, update, remove } = usePlanRevisions(projectId);
  const { upload } = useDocuments(projectId);
  const profile = useAuthStore((s) => s.profile);

  // Filtres
  const [filterStatus, setFilterStatus] = useState<PlanRevisionStatus | 'all'>('all');
  const [filterDiscipline, setFilterDiscipline] = useState<PlanDiscipline | 'all'>('all');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [reviewTarget, setReviewTarget] = useState<PlanRevision | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewForm>({ action: 'approuve', comment: '' });

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<PlanRevision | null>(null);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total: revisions.length,
    soumis: revisions.filter((r) => r.status === 'soumis').length,
    approuve: revisions.filter((r) => r.status === 'approuve').length,
    refuse: revisions.filter((r) => r.status === 'refuse').length,
    en_revision: revisions.filter((r) => r.status === 'en_revision').length,
  }), [revisions]);

  // ── Revisions filtrées + groupées par discipline ───────────────────────────
  const filtered = useMemo(() => revisions.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterDiscipline !== 'all' && r.discipline !== filterDiscipline) return false;
    return true;
  }), [revisions, filterStatus, filterDiscipline]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlanRevision[]>();
    for (const r of filtered) {
      const key = r.discipline;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [filtered]);

  // ── Création ──────────────────────────────────────────────────────────────
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.title.trim()) return;
    create.mutate({
      title: createForm.title.trim(),
      discipline: createForm.discipline,
      lot: createForm.lot.trim() || null,
      revision_index: createForm.revision_index.trim() || 'A',
      status: 'en_attente',
      created_by: profile?.id ?? null,
    } as Omit<TablesInsert<'plan_revisions'>, 'project_id'>);
    setCreateForm(EMPTY_CREATE);
    setCreateOpen(false);
  }

  // ── Soumettre (en_attente → soumis) ──────────────────────────────────────
  function handleSubmit(rev: PlanRevision) {
    update.mutate({
      id: rev.id,
      payload: {
        status: 'soumis',
        submitted_by: profile?.id ?? null,
        submitted_at: new Date().toISOString(),
      },
    });
  }

  // ── Revue (approuve / refuse / en_revision) ───────────────────────────────
  function openReview(rev: PlanRevision, action: ReviewForm['action']) {
    setReviewTarget(rev);
    setReviewForm({ action, comment: '' });
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewTarget) return;
    update.mutate({
      id: reviewTarget.id,
      payload: {
        status: reviewForm.action,
        reviewed_by: profile?.id ?? null,
        reviewed_at: new Date().toISOString(),
        reviewer_comment: reviewForm.comment.trim() || null,
      },
    });
    setReviewTarget(null);
  }

  // ── Nouvelle révision (copie avec indice incrémenté) ─────────────────────
  function handleNewRevision(rev: PlanRevision) {
    const siblings = revisions.filter((r) => r.title === rev.title && r.discipline === rev.discipline);
    const indices = siblings.map((r) => r.revision_index);
    const nextIndex = nextRevisionIndex(indices);
    create.mutate({
      title: rev.title,
      discipline: rev.discipline,
      lot: rev.lot,
      revision_index: nextIndex,
      status: 'en_attente',
      created_by: profile?.id ?? null,
    } as Omit<TablesInsert<'plan_revisions'>, 'project_id'>);
  }

  // ── Upload document ───────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const rev = uploadTargetRef.current;
    e.target.value = '';
    if (!file || !rev || !profile) return;
    const doc = await upload.mutateAsync({
      file,
      type: 'plan',
      uploadedBy: profile.id,
      folder: `Plans/${rev.discipline}`,
    });
    update.mutate({ id: rev.id, payload: { document_id: doc.id } });
    uploadTargetRef.current = null;
  }

  async function handleDownload(rev: PlanRevision) {
    if (!rev.document_id) return;
    const { documentsService } = await import('@/services/documents.service');
    const docs = await documentsService.list(projectId);
    const doc = docs.find((d) => d.id === rev.document_id);
    if (!doc) return;
    const url = await documentsService.getDownloadUrl(doc);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (isLoading) return <FullPageSpinner />;

  const disciplines = Object.keys(PLAN_DISCIPLINE_LABELS) as PlanDiscipline[];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Validation des plans</h2>
        </div>
        <Button onClick={() => { setCreateForm(EMPTY_CREATE); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          Nouveau plan
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: kpis.total, color: 'text-gray-700' },
          { label: 'Soumis', value: kpis.soumis, color: 'text-blue-600' },
          { label: 'En révision', value: kpis.en_revision, color: 'text-yellow-600' },
          { label: 'Approuvés', value: kpis.approuve, color: 'text-green-600' },
          { label: 'Refusés', value: kpis.refuse, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as PlanRevisionStatus | 'all')}
          className="w-44"
        >
          <option value="all">Tous les statuts</option>
          {(Object.keys(PLAN_REVISION_STATUS_LABELS) as PlanRevisionStatus[]).map((s) => (
            <option key={s} value={s}>{PLAN_REVISION_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={filterDiscipline}
          onChange={(e) => setFilterDiscipline(e.target.value as PlanDiscipline | 'all')}
          className="w-44"
        >
          <option value="all">Toutes disciplines</option>
          {disciplines.map((d) => (
            <option key={d} value={d}>{PLAN_DISCIPLINE_LABELS[d]}</option>
          ))}
        </Select>
        {(filterStatus !== 'all' || filterDiscipline !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterDiscipline('all'); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Contenu */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Aucun plan en cours de validation"
          description="Ajoutez les plans à valider et suivez leur cycle de révision."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([discipline, items]) => (
            <section key={discipline}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {PLAN_DISCIPLINE_LABELS[discipline as PlanDiscipline] ?? discipline}
              </h3>
              <div className="space-y-2">
                {items.map((rev) => (
                  <RevisionRow
                    key={rev.id}
                    rev={rev}
                    onSubmit={() => handleSubmit(rev)}
                    onApprove={() => openReview(rev, 'approuve')}
                    onRefuse={() => openReview(rev, 'refuse')}
                    onRequestRevision={() => openReview(rev, 'en_revision')}
                    onNewRevision={() => handleNewRevision(rev)}
                    onUpload={() => { uploadTargetRef.current = rev; fileInputRef.current?.click(); }}
                    onDownload={() => handleDownload(rev)}
                    onDelete={() => { confirmStore.getState().show({ message: 'Supprimer cette révision ?' }).then((ok) => { if (ok) remove.mutate(rev.id); }); }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Upload caché */}
      <input ref={fileInputRef} type="file" accept=".pdf,.dwg,.dxf,.ifc" className="hidden" onChange={handleFileChange} />

      {/* Modal création */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau plan à valider">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pv-title">
              Nom du plan <span className="text-red-500">*</span>
            </label>
            <Input
              id="pv-title"
              name="pv-title"
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex : Plan de masse, Coupe A-A, Façade sud…"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pv-discipline">
                Discipline
              </label>
              <Select
                id="pv-discipline"
                name="pv-discipline"
                value={createForm.discipline}
                onChange={(e) => setCreateForm((f) => ({ ...f, discipline: e.target.value as PlanDiscipline }))}
              >
                {disciplines.map((d) => (
                  <option key={d} value={d}>{PLAN_DISCIPLINE_LABELS[d]}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pv-index">
                Indice de révision
              </label>
              <Input
                id="pv-index"
                name="pv-index"
                value={createForm.revision_index}
                onChange={(e) => setCreateForm((f) => ({ ...f, revision_index: e.target.value }))}
                placeholder="A, B, 00, 01…"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pv-lot">
              Lot
            </label>
            <Input
              id="pv-lot"
              name="pv-lot"
              value={createForm.lot}
              onChange={(e) => setCreateForm((f) => ({ ...f, lot: e.target.value }))}
              placeholder="Ex : Gros œuvre, Second œuvre…"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={create.isPending || !createForm.title.trim()}>
              {create.isPending ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal revue */}
      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={
          reviewForm.action === 'approuve' ? 'Approuver le plan'
          : reviewForm.action === 'refuse' ? 'Refuser le plan'
          : 'Demander une révision'
        }
      >
        <form onSubmit={handleReview} className="space-y-4">
          {reviewTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              <span className="font-medium">{reviewTarget.title}</span>
              {' — '}Indice <span className="font-medium">{reviewTarget.revision_index}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="rv-comment">
              Commentaire {reviewForm.action !== 'approuve' && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              id="rv-comment"
              name="rv-comment"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
              rows={4}
              placeholder={
                reviewForm.action === 'approuve'
                  ? 'Commentaire optionnel…'
                  : 'Décrivez les modifications demandées…'
              }
              required={reviewForm.action !== 'approuve'}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setReviewTarget(null)}>Annuler</Button>
            <Button
              type="submit"
              disabled={update.isPending || (reviewForm.action !== 'approuve' && !reviewForm.comment.trim())}
              className={
                reviewForm.action === 'approuve' ? 'bg-green-600 hover:bg-green-700'
                : reviewForm.action === 'refuse' ? 'bg-red-600 hover:bg-red-700'
                : ''
              }
            >
              {update.isPending ? 'Enregistrement…'
                : reviewForm.action === 'approuve' ? 'Approuver'
                : reviewForm.action === 'refuse' ? 'Refuser'
                : 'Demander révision'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Ligne de révision ─────────────────────────────────────────────────────────
function RevisionRow({
  rev,
  onSubmit,
  onApprove,
  onRefuse,
  onRequestRevision,
  onNewRevision,
  onUpload,
  onDownload,
  onDelete,
}: {
  rev: PlanRevision;
  onSubmit: () => void;
  onApprove: () => void;
  onRefuse: () => void;
  onRequestRevision: () => void;
  onNewRevision: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const status = rev.status as PlanRevisionStatus;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
      {/* Indice */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
        <span className="text-xs font-bold text-blue-700">{rev.revision_index}</span>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{rev.title}</span>
          <Badge tone={STATUS_TONE[status]}>
            {PLAN_REVISION_STATUS_LABELS[status]}
          </Badge>
          {rev.lot && <span className="text-xs text-gray-500">Lot : {rev.lot}</span>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 mt-1">
          {rev.submitted_at && <span>Soumis le {formatDate(rev.submitted_at)}</span>}
          {rev.reviewed_at && <span>Révisé le {formatDate(rev.reviewed_at)}</span>}
        </div>
        {rev.reviewer_comment && (
          <p className="text-xs text-gray-600 mt-1 italic">"{rev.reviewer_comment}"</p>
        )}
      </div>

      {/* Actions selon statut */}
      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
        {status === 'en_attente' && (
          <button
            onClick={onSubmit}
            title="Soumettre pour validation"
            aria-label="Soumettre pour validation"
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
        {status === 'soumis' && (
          <>
            <button
              onClick={onApprove}
              title="Approuver"
              aria-label="Approuver le plan"
              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={onRequestRevision}
              title="Demander une révision"
              aria-label="Demander une révision"
              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onRefuse}
              title="Refuser"
              aria-label="Refuser le plan"
              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </>
        )}
        {(status === 'approuve' || status === 'refuse' || status === 'en_revision') && (
          <button
            onClick={onNewRevision}
            title="Créer une nouvelle révision"
            aria-label="Créer une nouvelle révision"
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
          >
            <GitBranch className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onUpload}
          title="Joindre le fichier plan"
          aria-label="Joindre le fichier plan"
          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
        >
          <Upload className="w-4 h-4" />
        </button>
        {rev.document_id && (
          <button
            onClick={onDownload}
            title="Télécharger le plan"
            aria-label="Télécharger le plan"
            className="p-1.5 text-gray-400 hover:text-green-600 rounded"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          title="Supprimer"
          aria-label="Supprimer la révision"
          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
