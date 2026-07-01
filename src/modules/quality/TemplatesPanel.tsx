import { useEffect, useState } from 'react';
import { Plus, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { useQualityTemplates, useQualityTemplate } from '@/hooks/useQualityTemplates';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import type { QualityTemplate } from '@/types/domain';
import { ChecklistItemsEditor } from './ChecklistItemsEditor';
import { checklistRowsToItems, emptyChecklistRow, type ChecklistItemRow } from './checklistForm';

interface TemplateFormState {
  name: string;
  description: string;
}

function emptyForm(): TemplateFormState {
  return { name: '', description: '' };
}

interface TemplatesPanelProps {
  projectId: string;
}

export function TemplatesPanel({ projectId }: TemplatesPanelProps) {
  const { templates, isLoading, create, remove } = useQualityTemplates(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(emptyForm());
  const [rows, setRows] = useState<ChecklistItemRow[]>([emptyChecklistRow()]);
  const [editId, setEditId] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm());
    setRows([emptyChecklistRow()]);
    setCreateOpen(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        payload: { name: form.name, description: form.description || null },
        items: checklistRowsToItems(rows),
      },
      { onSuccess: () => setCreateOpen(false) }
    );
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Modèles de checklist</h3>
          <p className="text-sm text-slate-500">{templates.length} modèle(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau modèle
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun modèle"
          description="Créez un modèle réutilisable (ex. réception gros œuvre, avant peinture)."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {templates.map((template: QualityTemplate) => (
            <li key={template.id} className="flex items-center justify-between py-3 text-sm">
              <button onClick={() => setEditId(template.id)} className="flex-1 text-left">
                <p className="font-medium text-slate-800">{template.name}</p>
                {template.description && <p className="text-xs text-slate-400">{template.description}</p>}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditId(template.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    confirmStore.getState().show({ message: 'Supprimer ce modèle ?' }).then((ok) => { if (ok) remove.mutate(template.id); });
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau modèle de checklist" size="lg">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <Input id="form-name" label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <ChecklistItemsEditor rows={rows} onChange={setRows} />
          <ErrorMessage error={create.error} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer le modèle
            </Button>
          </div>
        </form>
      </Modal>

      {editId && <TemplateEditModal templateId={editId} onClose={() => setEditId(null)} />}
    </Card>
  );
}

interface TemplateEditModalProps {
  templateId: string;
  onClose: () => void;
}

function TemplateEditModal({ templateId, onClose }: TemplateEditModalProps) {
  const { data: template, isLoading } = useQualityTemplate(templateId);
  const { update } = useQualityTemplates(template?.project_id);
  const [form, setForm] = useState<TemplateFormState | null>(null);
  const [rows, setRows] = useState<ChecklistItemRow[]>([]);

  useEffect(() => {
    if (!template) return;
    setForm({ name: template.name, description: template.description ?? '' });
    setRows(template.items.length > 0 ? template.items.map((item) => ({ label: item.label })) : [emptyChecklistRow()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    update.mutate(
      {
        id: templateId,
        payload: { name: form.name, description: form.description || null },
        items: checklistRowsToItems(rows),
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Modal open onClose={onClose} title="Modifier le modèle" size="lg">
      {isLoading || !form ? (
        <Spinner />
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input id="form-name-2" label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <ChecklistItemsEditor rows={rows} onChange={setRows} />
          <ErrorMessage error={update.error} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={update.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
