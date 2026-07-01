import { useRef, useState, useMemo } from 'react';
import { Plus, Trash2, Upload, Download, ShieldCheck, AlertTriangle, FileDown } from 'lucide-react';
import { exportWarrantyClaimsPdf } from '@/utils/pdfExport';
import { useWarranty } from '@/hooks/useWarranty';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useProjectCompanies } from '@/hooks/useCompanies';
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
  WARRANTY_TYPE_LABELS,
  WARRANTY_PRIORITY_LABELS,
  WARRANTY_STATUS_LABELS,
} from '@/types/domain';
import type { WarrantyClaim, Company } from '@/types/domain';
import type { WarrantyType, WarrantyPriority, WarrantyStatus, TablesInsert } from '@/types/database.types';
import { formatDate } from '@/utils/date';

// ── Couleurs des badges ───────────────────────────────────────────────────────
const PRIORITY_TONE: Record<WarrantyPriority, 'blue' | 'yellow' | 'red' | 'purple'> = {
  basse: 'blue',
  normale: 'yellow',
  haute: 'red',
  urgente: 'purple',
};

const STATUS_TONE: Record<WarrantyStatus, 'yellow' | 'blue' | 'green' | 'purple'> = {
  ouvert: 'yellow',
  en_cours: 'blue',
  resolu: 'green',
  clos: 'purple',
};

const TYPE_TONE: Record<WarrantyType, 'blue' | 'yellow' | 'red' | 'purple'> = {
  parfait_achevement: 'blue',
  biennale: 'yellow',
  decennale: 'red',
  hors_garantie: 'purple',
};

// ── Formulaire vide ───────────────────────────────────────────────────────────
type FormState = {
  title: string;
  description: string;
  company_id: string;
  warranty_type: WarrantyType;
  priority: WarrantyPriority;
  status: WarrantyStatus;
  reported_date: string;
  due_date: string;
  lot: string;
  location: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  company_id: '',
  warranty_type: 'parfait_achevement',
  priority: 'normale',
  status: 'ouvert',
  reported_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  lot: '',
  location: '',
  notes: '',
};

// ── Composant principal ───────────────────────────────────────────────────────
export function WarrantyTab({ projectId }: { projectId: string }) {
  const { claims, isLoading, create, update, remove } = useWarranty(projectId);
  const { project } = useProject(projectId);
  const { upload } = useDocuments(projectId);
  const { projectCompanies } = useProjectCompanies(projectId);
  const profile = useAuthStore((s) => s.profile);

  // Filtres
  const [filterStatus, setFilterStatus] = useState<WarrantyStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<WarrantyType | 'all'>('all');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<WarrantyClaim | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<WarrantyClaim | null>(null);

  // Liste des entreprises du projet
  const companies = useMemo(
    () => projectCompanies.map((pc) => pc.company!).filter(Boolean) as Company[],
    [projectCompanies]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    open: claims.filter((c) => c.status === 'ouvert').length,
    inProgress: claims.filter((c) => c.status === 'en_cours').length,
    resolved: claims.filter((c) => c.status === 'resolu').length,
    urgent: claims.filter((c) => c.priority === 'urgente' && c.status !== 'clos').length,
  }), [claims]);

  // ── Liste filtrée ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => claims.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterType !== 'all' && c.warranty_type !== filterType) return false;
    return true;
  }), [claims, filterStatus, filterType]);

  // ── Helpers formulaire ────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(claim: WarrantyClaim) {
    setForm({
      title: claim.title,
      description: claim.description ?? '',
      company_id: claim.company_id ?? '',
      warranty_type: claim.warranty_type as WarrantyType,
      priority: claim.priority as WarrantyPriority,
      status: claim.status as WarrantyStatus,
      reported_date: claim.reported_date,
      due_date: claim.due_date ?? '',
      lot: claim.lot ?? '',
      location: claim.location ?? '',
      notes: claim.notes ?? '',
    });
    setEditing(claim);
    setEditOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      company_id: form.company_id || null,
      warranty_type: form.warranty_type,
      priority: form.priority,
      status: form.status,
      reported_date: form.reported_date,
      due_date: form.due_date || null,
      lot: form.lot.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      created_by: profile?.id ?? null,
    };

    if (editing) {
      update.mutate({ id: editing.id, payload });
      setEditOpen(false);
      setEditing(null);
    } else {
      create.mutate(payload as Omit<TablesInsert<'warranty_claims'>, 'project_id'>);
      setCreateOpen(false);
    }
    setForm(EMPTY_FORM);
  }

  // ── Upload document ───────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const claim = uploadTargetRef.current;
    e.target.value = '';
    if (!file || !claim || !profile) return;

    const doc = await upload.mutateAsync({
      file,
      type: 'doe',
      uploadedBy: profile.id,
      folder: 'Garantie',
      companyId: claim.company_id,
    });
    update.mutate({ id: claim.id, payload: { document_id: doc.id } });
    uploadTargetRef.current = null;
  }

  async function handleDownload(claim: WarrantyClaim) {
    if (!claim.document_id || !project) return;
    const { documentsService } = await import('@/services/documents.service');
    const docs = await documentsService.list(projectId);
    const doc = docs.find((d) => d.id === claim.document_id);
    if (!doc) return;
    const url = await documentsService.getDownloadUrl(doc);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function triggerUpload(claim: WarrantyClaim) {
    uploadTargetRef.current = claim;
    fileInputRef.current?.click();
  }

  if (isLoading) return <FullPageSpinner />;

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Garanties &amp; SAV</h2>
        </div>
        <div className="flex items-center gap-2">
          {claims.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportWarrantyClaimsPdf(
                  claims,
                  project?.name ?? 'Projet',
                  (id) => companies.find((c) => c.id === id)?.name ?? '—'
                )
              }
            >
              <FileDown className="w-4 h-4" />
              Exporter PDF
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle réclamation
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ouvertes', value: kpis.open, color: 'text-yellow-600' },
          { label: 'En cours', value: kpis.inProgress, color: 'text-blue-600' },
          { label: 'Résolues', value: kpis.resolved, color: 'text-green-600' },
          { label: 'Urgentes', value: kpis.urgent, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as WarrantyStatus | 'all')}
          className="w-44"
        >
          <option value="all">Tous les statuts</option>
          {(Object.keys(WARRANTY_STATUS_LABELS) as WarrantyStatus[]).map((s) => (
            <option key={s} value={s}>{WARRANTY_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as WarrantyType | 'all')}
          className="w-52"
        >
          <option value="all">Tous les types</option>
          {(Object.keys(WARRANTY_TYPE_LABELS) as WarrantyType[]).map((t) => (
            <option key={t} value={t}>{WARRANTY_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        {(filterStatus !== 'all' || filterType !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterType('all'); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Aucune réclamation"
          description="Créez une première réclamation de garantie ou SAV."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => {
            const company = projectCompanies.find((pc) => pc.company_id === claim.company_id)?.company;
            const isOverdue =
              claim.due_date &&
              claim.status !== 'resolu' &&
              claim.status !== 'clos' &&
              new Date(claim.due_date) < new Date();

            return (
              <div
                key={claim.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {isOverdue && (
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span
                        className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 truncate"
                        onClick={() => openEdit(claim)}
                      >
                        {claim.title}
                      </span>
                      <Badge tone={STATUS_TONE[claim.status as WarrantyStatus]}>
                        {WARRANTY_STATUS_LABELS[claim.status as WarrantyStatus]}
                      </Badge>
                      <Badge tone={PRIORITY_TONE[claim.priority as WarrantyPriority]}>
                        {WARRANTY_PRIORITY_LABELS[claim.priority as WarrantyPriority]}
                      </Badge>
                      <Badge tone={TYPE_TONE[claim.warranty_type as WarrantyType]}>
                        {WARRANTY_TYPE_LABELS[claim.warranty_type as WarrantyType]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      {claim.lot && <span>Lot : {claim.lot}</span>}
                      {claim.location && <span>Localisation : {claim.location}</span>}
                      {company && <span>Entreprise : {company.name}</span>}
                      <span>Signalé le {formatDate(claim.reported_date)}</span>
                      {claim.due_date && (
                        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                          Échéance : {formatDate(claim.due_date)}
                        </span>
                      )}
                      {claim.resolved_date && (
                        <span>Résolu le {formatDate(claim.resolved_date)}</span>
                      )}
                    </div>
                    {claim.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{claim.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={claim.status}
                      onChange={(e) =>
                        update.mutate({
                          id: claim.id,
                          payload: {
                            status: e.target.value as WarrantyStatus,
                            ...(e.target.value === 'resolu' && !claim.resolved_date
                              ? { resolved_date: new Date().toISOString().slice(0, 10) }
                              : {}),
                          },
                        })
                      }
                      className="text-xs w-32"
                      aria-label="Changer le statut"
                    >
                      {(Object.keys(WARRANTY_STATUS_LABELS) as WarrantyStatus[]).map((s) => (
                        <option key={s} value={s}>{WARRANTY_STATUS_LABELS[s]}</option>
                      ))}
                    </Select>

                    <button
                      onClick={() => triggerUpload(claim)}
                      title="Joindre un document"
                      aria-label="Joindre un document"
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                    >
                      <Upload className="w-4 h-4" />
                    </button>

                    {claim.document_id && (
                      <button
                        onClick={() => handleDownload(claim)}
                        title="Télécharger le document"
                        aria-label="Télécharger le document"
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm('Supprimer cette réclamation ?')) remove.mutate(claim.id);
                      }}
                      title="Supprimer"
                      aria-label="Supprimer la réclamation"
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload caché */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modal création */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle réclamation">
        <ClaimForm
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancel={() => setCreateOpen(false)}
          companies={companies}
          submitLabel="Créer"
          loading={create.isPending}
        />
      </Modal>

      {/* Modal édition */}
      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditing(null); }} title="Modifier la réclamation">
        <ClaimForm
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancel={() => { setEditOpen(false); setEditing(null); }}
          companies={companies}
          submitLabel="Enregistrer"
          loading={update.isPending}
        />
      </Modal>
    </div>
  );
}

// ── Formulaire partagé ────────────────────────────────────────────────────────
function ClaimForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  companies,
  submitLabel,
  loading,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  companies: Company[];
  submitLabel: string;
  loading: boolean;
}) {
  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => onChange({ ...form, [field]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-title">
          Titre <span className="text-red-500">*</span>
        </label>
        <Input
          id="wc-title"
          name="wc-title"
          value={form.title}
          onChange={set('title')}
          placeholder="Ex : Fissure façade nord"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-type">
            Type de garantie
          </label>
          <Select id="wc-type" name="wc-type" value={form.warranty_type} onChange={set('warranty_type')}>
            {(Object.keys(WARRANTY_TYPE_LABELS) as WarrantyType[]).map((t) => (
              <option key={t} value={t}>{WARRANTY_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-priority">
            Priorité
          </label>
          <Select id="wc-priority" name="wc-priority" value={form.priority} onChange={set('priority')}>
            {(Object.keys(WARRANTY_PRIORITY_LABELS) as WarrantyPriority[]).map((p) => (
              <option key={p} value={p}>{WARRANTY_PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-status">
            Statut
          </label>
          <Select id="wc-status" name="wc-status" value={form.status} onChange={set('status')}>
            {(Object.keys(WARRANTY_STATUS_LABELS) as WarrantyStatus[]).map((s) => (
              <option key={s} value={s}>{WARRANTY_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-company">
            Entreprise responsable
          </label>
          <Select id="wc-company" name="wc-company" value={form.company_id} onChange={set('company_id')}>
            <option value="">— Aucune —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-reported">
            Date de signalement
          </label>
          <Input id="wc-reported" name="wc-reported" type="date" value={form.reported_date} onChange={set('reported_date')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-due">
            Date d'échéance
          </label>
          <Input id="wc-due" name="wc-due" type="date" value={form.due_date} onChange={set('due_date')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-lot">
            Lot
          </label>
          <Input id="wc-lot" name="wc-lot" value={form.lot} onChange={set('lot')} placeholder="Ex : Gros œuvre" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-location">
            Localisation
          </label>
          <Input id="wc-location" name="wc-location" value={form.location} onChange={set('location')} placeholder="Ex : Façade nord, RDC" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-description">
          Description
        </label>
        <Textarea
          id="wc-description"
          name="wc-description"
          value={form.description}
          onChange={set('description')}
          rows={3}
          placeholder="Description du désordre constaté..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wc-notes">
          Notes
        </label>
        <Textarea
          id="wc-notes"
          name="wc-notes"
          value={form.notes}
          onChange={set('notes')}
          rows={2}
          placeholder="Notes internes, suivi..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading || !form.title.trim()}>
          {loading ? 'Enregistrement…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
