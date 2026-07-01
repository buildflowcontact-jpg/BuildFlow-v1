import { useState } from 'react';
import { Plus, ClipboardCheck, Pencil, Trash2, FileDown, FileSignature } from 'lucide-react';
import { usePunchList } from '@/hooks/usePunchList';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
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
};

const emptyForm: PunchListFormState = {
  title: '',
  description: '',
  location: '',
  status: 'open',
  assigned_to: '',
  due_date: '',
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
              // Chargé à la demande : jsPDF/jspdf-autotable ne sont utiles qu'à
              // l'export, inutile de les inclure dans le bundle initial.
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

      {items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune réserve" description="Consignez les réserves relevées lors des réceptions." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const assignee = members.find((m) => m.profile?.id === item.assigned_to);
            const late = isOverdue(item.due_date) && item.status !== 'resolved' && item.status !== 'verified';
            return (
              <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    {item.location ? `${item.location} · ` : ''}
                    {assignee ? `Assigné à ${assignee.profile?.full_name ?? assignee.invited_email}` : 'Non assigné'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
