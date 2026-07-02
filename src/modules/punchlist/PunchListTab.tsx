import { useState } from 'react';
import { Plus, ClipboardCheck, Pencil, Trash2, FileDown, FileSignature, Camera, CheckCheck, X } from 'lucide-react';
import { usePunchList } from '@/hooks/usePunchList';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/stores/toastStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { PUNCH_LIST_STATUS_LABELS } from '@/types/domain';
import { formatDate, isOverdue } from '@/utils/date';
import type { PunchListItem } from '@/types/domain';
import type { PunchListStatus, TablesInsert } from '@/types/database.types';
import { confirmStore } from '@/components/ui/ConfirmModal';
import { PhotoUploadField } from '@/components/ui/PhotoUploadField';

const STATUS_TONE: Record<PunchListStatus, 'red' | 'blue' | 'green' | 'purple'> = {
  open: 'red',
  in_progress: 'blue',
  resolved: 'green',
  verified: 'purple',
};

type PunchListFormState = {
  title: string;
  description: string;
  location: string;
  status: PunchListStatus;
  assigned_to: string;
  due_date: string;
  photo_document_id: string | null;
};

const emptyForm: PunchListFormState = {
  title: '',
  description: '',
  location: '',
  status: 'open',
  assigned_to: '',
  due_date: '',
  photo_document_id: null,
};

interface PunchListTabProps {
  projectId: string;
}

export function PunchListTab({ projectId }: PunchListTabProps) {
  const { items, isLoading, create, update, remove } = usePunchList(projectId);
  const { project, members } = useProject(projectId);
  const { upload } = useDocuments(projectId);
  const { clients } = useClients();
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PunchListItem | null>(null);
  const [form, setForm] = useState<PunchListFormState>(emptyForm);

  const [pvOpen, setPvOpen] = useState(false);
  const [clientSignerName, setClientSignerName] = useState('');
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [chefSignerName, setChefSignerName] = useState('');
  const [chefSignature, setChefSignature] = useState<string | null>(null);
  const [pvGenerating, setPvGenerating] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const allIds = items.map((i) => i.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }

  async function handleBulkResolve() {
    const ids = [...selectedIds];
    setBulkPending(true);
    try {
      await Promise.all(ids.map((id) => update.mutateAsync({ id, payload: { status: 'resolved' } })));
      setSelectedIds(new Set());
      toast.success(`${ids.length} réserve(s) levée(s)`);
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setBulkPending(false);
    }
  }

  const resolvedCount = items.filter((i) => i.status === 'resolved' || i.status === 'verified').length;
  const remainingCount = items.length - resolvedCount;
  const client = clients.find((c) => c.id === project?.client_id);

  function openPv() {
    setClientSignerName(client?.name ?? '');
    setClientSignature(null);
    setChefSignerName(profile?.full_name ?? profile?.email ?? '');
    setChefSignature(null);
    setPvOpen(true);
  }

  async function handleGeneratePv() {
    if (!project || !profile || !clientSignature || !chefSignature) return;
    setPvGenerating(true);
    try {
      const { exportReceptionReportPdf } = await import('@/services/pdfExport.service');
      const file = exportReceptionReportPdf(project, items, members, {
        client: { signerName: clientSignerName, dataUrl: clientSignature },
        chefChantier: { signerName: chefSignerName, dataUrl: chefSignature },
      });
      await upload.mutateAsync({
        file,
        type: 'compte_rendu',
        uploadedBy: profile.id,
        folder: 'Réception',
      });
      setPvOpen(false);
    } finally {
      setPvGenerating(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item: PunchListItem) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? '',
      location: item.location ?? '',
      status: item.status as PunchListStatus,
      assigned_to: item.assigned_to ?? '',
      due_date: item.due_date ?? '',
      photo_document_id: item.photo_document_id ?? null,
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'punch_list_items'>, 'project_id'> = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      status: form.status,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
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
          <h3 className="text-base font-semibold text-slate-900">Réserves de réception</h3>
          <p className="text-sm text-slate-500">{items.length} réserve(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!project || items.length === 0}
            onClick={() => {
              if (project) void import('@/services/pdfExport.service').then((m) => m.exportPunchListPdf(project, items, members));
            }}
          >
            <FileDown className="h-4 w-4" />
            Exporter en PDF
          </Button>
          <Button size="sm" variant="outline" disabled={!project || items.length === 0} onClick={openPv}>
            <FileSignature className="h-4 w-4" />
            Générer le PV
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle réserve
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm">
          <span className="font-medium text-blue-700">{selectedIds.size} sélectionnée(s)</span>
          <Button size="sm" loading={bulkPending} onClick={handleBulkResolve}>
            <CheckCheck className="h-4 w-4" />
            Marquer comme levées
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-blue-500 hover:text-blue-700"
            aria-label="Annuler la sélection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune réserve" description="Consignez les réserves relevées lors des réceptions." />
      ) : (
        <>
          <div className="mb-1 flex items-center gap-2 border-b border-slate-100 px-1 pb-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              aria-label="Tout sélectionner"
            />
            <span className="text-xs text-slate-400">Tout sélectionner</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const assignee = members.find((m) => m.profile?.id === item.assigned_to);
              const late = isOverdue(item.due_date) && item.status !== 'resolved' && item.status !== 'verified';
              const isSelected = selectedIds.has(item.id);
              return (
                <li key={item.id} className={`flex items-center gap-3 py-3 text-sm${isSelected ? ' bg-blue-50/50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-400">
                      {item.location ? `${item.location} · ` : ''}
                      {assignee ? `Assigné à ${assignee.profile?.full_name ?? assignee.invited_email}` : 'Non assigné'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.photo_document_id && (
                      <Camera className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className={late ? 'text-xs font-medium text-red-500' : 'text-xs text-slate-400'}>
                      {item.due_date ? formatDate(item.due_date) : '—'}
                    </span>
                    <Badge tone={STATUS_TONE[item.status as PunchListStatus]}>{PUNCH_LIST_STATUS_LABELS[item.status as PunchListStatus]}</Badge>
                    <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        confirmStore.getState().show({ message: 'Supprimer cette réserve ?' }).then((ok) => { if (ok) remove.mutate(item.id); });
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la réserve' : 'Nouvelle réserve'} size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input id="form-title" label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input id="form-location" label="Localisation" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select id="form-assigned-to"
              label="Assigné à"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">Non assigné</option>
              {members
                .filter((m) => m.profile)
                .map((m) => (
                  <option key={m.profile!.id} value={m.profile!.id}>
                    {m.profile!.full_name ?? m.profile!.email}
                  </option>
                ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select id="form-status" label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PunchListStatus })}>
              {Object.entries(PUNCH_LIST_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input id="form-due-date"
              label="Échéance"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          {profile && (
            <PhotoUploadField
              projectId={projectId}
              uploadedBy={profile.id}
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

      <Modal open={pvOpen} onClose={() => setPvOpen(false)} title="Générer le PV de réception" size="lg">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Synthèse des réserves</p>
            <p>
              {items.length} réserve(s) — {resolvedCount} levée(s), {remainingCount} restante(s).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input id="pv-client-name"
                label="Nom du signataire (client)"
                required
                value={clientSignerName}
                onChange={(e) => setClientSignerName(e.target.value)}
              />
              <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Signature du client</p>
              <SignaturePad onChange={setClientSignature} />
            </div>
            <div>
              <Input id="pv-chef-name"
                label="Nom du signataire (chef de chantier)"
                required
                value={chefSignerName}
                onChange={(e) => setChefSignerName(e.target.value)}
              />
              <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Signature du chef de chantier</p>
              <SignaturePad onChange={setChefSignature} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPvOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              loading={pvGenerating || upload.isPending}
              disabled={!clientSignature || !chefSignature || !clientSignerName.trim() || !chefSignerName.trim()}
              onClick={handleGeneratePv}
            >
              <FileSignature className="h-4 w-4" />
              Générer et archiver
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
