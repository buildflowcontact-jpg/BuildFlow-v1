import { useState } from 'react';
import { Plus, ClipboardList, Pencil, Trash2, Cloud, Users as UsersIcon, Camera } from 'lucide-react';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { PhotoUploadField } from '@/components/ui/PhotoUploadField';
import { formatDate } from '@/utils/date';
import type { DailyLog } from '@/types/domain';
import { confirmStore } from '@/components/ui/ConfirmModal';

type DailyLogFormState = {
  log_date: string;
  weather: string;
  temperature_c: string;
  workers_count: string;
  manpower_notes: string;
  progress_summary: string;
  photo_document_id: string | null;
};

function emptyForm(): DailyLogFormState {
  return {
    log_date: new Date().toISOString().slice(0, 10),
    weather: '',
    temperature_c: '',
    workers_count: '',
    manpower_notes: '',
    progress_summary: '',
    photo_document_id: null,
  };
}

interface DailyLogsTabProps {
  projectId: string;
}

export function DailyLogsTab({ projectId }: DailyLogsTabProps) {
  const { dailyLogs, isLoading, create, update, remove } = useDailyLogs(projectId);
  const userId = useAuthStore((s) => s.profile?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);
  const [form, setForm] = useState<DailyLogFormState>(emptyForm());

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(log: DailyLog) {
    setEditing(log);
    setForm({
      log_date: log.log_date,
      weather: log.weather ?? '',
      temperature_c: log.temperature_c?.toString() ?? '',
      workers_count: log.workers_count?.toString() ?? '',
      manpower_notes: log.manpower_notes ?? '',
      progress_summary: log.progress_summary,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      photo_document_id: (log as any).photo_document_id ?? null,
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      log_date: form.log_date,
      weather: form.weather || null,
      temperature_c: form.temperature_c ? Number(form.temperature_c) : null,
      workers_count: form.workers_count ? Number(form.workers_count) : null,
      manpower_notes: form.manpower_notes || null,
      progress_summary: form.progress_summary,
      photo_document_id: form.photo_document_id ?? null,
    };
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setModalOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Journal de chantier</h3>
          <p className="text-sm text-slate-500">{dailyLogs.length} rapport(s) journalier(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau rapport
        </Button>
      </div>

      {dailyLogs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun rapport journalier"
          description="Consignez l'avancement, la météo et les effectifs au quotidien."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {dailyLogs.map((log) => (
            <li key={log.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{formatDate(log.log_date)}</p>
                <p className="mt-0.5 text-slate-600">{log.progress_summary}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  {log.weather && (
                    <span className="flex items-center gap-1">
                      <Cloud className="h-3.5 w-3.5" />
                      {log.weather}
                      {log.temperature_c !== null ? ` · ${log.temperature_c}°C` : ''}
                    </span>
                  )}
                  {log.workers_count !== null && (
                    <span className="flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5" />
                      {log.workers_count} ouvrier(s)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(log as any).photo_document_id && (
                  <span title="Photo attachée"><Camera className="h-4 w-4 shrink-0 text-slate-400" /></span>
                )}
                <button onClick={() => openEdit(log)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    confirmStore.getState().show({ message: 'Supprimer ce rapport ?' }).then((ok) => { if (ok) remove.mutate(log.id); });
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le rapport' : 'Nouveau rapport journalier'} size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <Input id="form-log-date" type="date" label="Date" required value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
            <Input id="form-weather" label="Météo" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="Ensoleillé" />
            <Input id="form-temperature-c"
              type="number"
              step="0.1"
              label="Température (°C)"
              value={form.temperature_c}
              onChange={(e) => setForm({ ...form, temperature_c: e.target.value })}
            />
          </div>
          <Input id="form-workers-count"
            type="number"
            label="Effectif sur site"
            value={form.workers_count}
            onChange={(e) => setForm({ ...form, workers_count: e.target.value })}
          />
          <Textarea
            label="Notes de main-d'œuvre"
            value={form.manpower_notes}
            onChange={(e) => setForm({ ...form, manpower_notes: e.target.value })}
          />
          <Textarea
            label="Avancement du jour"
            required
            value={form.progress_summary}
            onChange={(e) => setForm({ ...form, progress_summary: e.target.value })}
          />
          {userId && (
            <PhotoUploadField
              projectId={projectId}
              uploadedBy={userId}
              existingDocumentId={form.photo_document_id}
              onChange={(docId) => setForm((f) => ({ ...f, photo_document_id: docId }))}
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
