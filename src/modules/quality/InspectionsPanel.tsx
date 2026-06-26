import { useState } from 'react';
import { Plus, ClipboardCheck, CheckCircle2, XCircle, MinusCircle, Lock } from 'lucide-react';
import { useQualityInspections, useQualityInspection } from '@/hooks/useQualityInspections';
import { useQualityTemplates } from '@/hooks/useQualityTemplates';
import { useProject } from '@/hooks/useProject';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { QUALITY_INSPECTION_STATUS_LABELS } from '@/types/domain';
import type { QualityInspection } from '@/types/domain';
import type { QualityInspectionResult, QualityInspectionStatus } from '@/types/database.types';
import { formatDateTime } from '@/utils/date';
import { ChecklistItemsEditor, checklistRowsToItems, emptyChecklistRow, type ChecklistItemRow } from './ChecklistItemsEditor';

const STATUS_TONE: Record<QualityInspectionStatus, 'blue' | 'green'> = {
  in_progress: 'blue',
  completed: 'green',
};

const RESULT_OPTIONS: { value: QualityInspectionResult; label: string; icon: typeof CheckCircle2; tone: string }[] = [
  { value: 'conforme', label: 'Conforme', icon: CheckCircle2, tone: 'text-green-600' },
  { value: 'non_conforme', label: 'Non conforme', icon: XCircle, tone: 'text-red-600' },
  { value: 'non_applicable', label: 'N/A', icon: MinusCircle, tone: 'text-slate-400' },
];

interface InspectionFormState {
  title: string;
  location: string;
  templateId: string;
}

function emptyForm(): InspectionFormState {
  return { title: '', location: '', templateId: '' };
}

interface InspectionsPanelProps {
  projectId: string;
}

export function InspectionsPanel({ projectId }: InspectionsPanelProps) {
  const { inspections, isLoading, create, remove } = useQualityInspections(projectId);
  const { templates } = useQualityTemplates(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<InspectionFormState>(emptyForm());
  const [rows, setRows] = useState<ChecklistItemRow[]>([emptyChecklistRow()]);
  const [detailId, setDetailId] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm());
    setRows([emptyChecklistRow()]);
    setCreateOpen(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        payload: {
          title: form.title,
          location: form.location || null,
          template_id: form.templateId || null,
        },
        adHocItems: form.templateId ? [] : checklistRowsToItems(rows),
      },
      { onSuccess: (created) => {
        setCreateOpen(false);
        setDetailId(created.id);
      } }
    );
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Inspections qualité</h3>
          <p className="text-sm text-slate-500">{inspections.length} inspection(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle inspection
        </Button>
      </div>

      {inspections.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aucune inspection"
          description="Lancez une inspection à partir d'un modèle ou d'une checklist libre."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {inspections.map((inspection: QualityInspection) => (
            <li key={inspection.id} className="flex items-center justify-between py-3 text-sm">
              <button onClick={() => setDetailId(inspection.id)} className="flex-1 text-left">
                <p className="font-medium text-slate-800">{inspection.title}</p>
                <p className="text-xs text-slate-400">
                  {inspection.location ? `${inspection.location} · ` : ''}
                  {formatDateTime(inspection.created_at)}
                </p>
              </button>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[inspection.status as QualityInspectionStatus]}>
                  {QUALITY_INSPECTION_STATUS_LABELS[inspection.status as QualityInspectionStatus]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle inspection" size="lg">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Localisation" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <Select
            label="Modèle de checklist"
            value={form.templateId}
            onChange={(e) => setForm({ ...form, templateId: e.target.value })}
          >
            <option value="">Checklist libre</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {!form.templateId && <ChecklistItemsEditor rows={rows} onChange={setRows} />}
          <ErrorMessage error={create.error} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Démarrer l'inspection
            </Button>
          </div>
        </form>
      </Modal>

      {detailId && (
        <InspectionDetailModal
          inspectionId={detailId}
          projectId={projectId}
          onClose={() => setDetailId(null)}
          onDelete={(id) => remove.mutate(id, { onSuccess: () => setDetailId(null) })}
        />
      )}
    </Card>
  );
}

interface InspectionDetailModalProps {
  inspectionId: string;
  projectId: string;
  onClose: () => void;
  onDelete: (id: string) => void;
}

function InspectionDetailModal({ inspectionId, projectId, onClose }: InspectionDetailModalProps) {
  const { data: inspection, isLoading, setResult, complete } = useQualityInspection(inspectionId, projectId);
  const { members } = useProject(projectId);
  const userId = useAuthStore((s) => s.session?.user.id);
  const [comments, setComments] = useState<Record<string, string>>({});

  if (isLoading || !inspection) {
    return (
      <Modal open onClose={onClose} title="Inspection">
        <Spinner />
      </Modal>
    );
  }

  const isCompleted = inspection.status === 'completed';
  const inspectedByName = members.find((m) => m.profile?.id === inspection.inspected_by)?.profile?.full_name;

  return (
    <Modal open onClose={onClose} title={inspection.title} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {inspection.location ? `${inspection.location} · ` : ''}
            {formatDateTime(inspection.created_at)}
            {isCompleted && inspectedByName ? ` · Inspecté par ${inspectedByName}` : ''}
          </div>
          <Badge tone={STATUS_TONE[inspection.status as QualityInspectionStatus]}>
            {QUALITY_INSPECTION_STATUS_LABELS[inspection.status as QualityInspectionStatus]}
          </Badge>
        </div>

        <ul className="flex flex-col gap-3">
          {inspection.results.map((result) => (
            <li key={result.id} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-800">{result.label}</p>
              <div className="flex items-center gap-2">
                {RESULT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = result.result === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isCompleted}
                      onClick={() => setResult.mutate({ resultId: result.id, result: opt.value, comment: result.comment })}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                        active ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Icon className={`h-4 w-4 ${active ? opt.tone : 'text-slate-300'}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {!isCompleted ? (
                <Textarea
                  className="mt-2"
                  placeholder="Commentaire (optionnel)"
                  value={comments[result.id] ?? result.comment ?? ''}
                  onChange={(e) => setComments({ ...comments, [result.id]: e.target.value })}
                  onBlur={(e) => {
                    if (e.target.value !== (result.comment ?? '')) {
                      setResult.mutate({ resultId: result.id, result: result.result as QualityInspectionResult, comment: e.target.value });
                    }
                  }}
                />
              ) : (
                result.comment && <p className="mt-2 text-xs text-slate-500">{result.comment}</p>
              )}
              {result.result === 'non_conforme' && (
                <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  Non-conformité créée automatiquement
                </p>
              )}
            </li>
          ))}
        </ul>

        <ErrorMessage error={setResult.error ?? complete.error} />

        {!isCompleted && (
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button loading={complete.isPending} onClick={() => complete.mutate(userId ?? null)}>
              <Lock className="h-4 w-4" />
              Clôturer l'inspection
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
