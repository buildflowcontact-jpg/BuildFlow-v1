import { useRef, useState } from 'react';
import { Plus, Trash2, Upload, Download, FileDown, Recycle } from 'lucide-react';
import { useWasteTrackings } from '@/hooks/useWasteTrackings';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useProjectCompanies } from '@/hooks/useCompanies';
import { useAuth } from '@/hooks/useAuth';
import { documentsService } from '@/services/documents.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { WASTE_CATEGORY_LABELS, WASTE_TRACKING_STATUS_LABELS } from '@/types/domain';
import type { WasteTracking } from '@/types/domain';
import type { WasteCategory, WasteTrackingStatus, TablesInsert } from '@/types/database.types';
import { formatDate } from '@/utils/date';
import { confirmStore } from '@/components/ui/ConfirmModal';

const STATUS_TONE: Record<WasteTrackingStatus, 'red' | 'blue' | 'green' | 'purple'> = {
  en_attente: 'red',
  enleve: 'blue',
  traite: 'green',
};

type WasteFormState = {
  waste_description: string;
  waste_category: WasteCategory;
  bsd_number: string;
  company_id: string;
  disposal_site: string;
  quantity_tons: string;
  removal_date: string;
  notes: string;
};

function emptyForm(): WasteFormState {
  return {
    waste_description: '',
    waste_category: 'non_dangereux',
    bsd_number: '',
    company_id: '',
    disposal_site: '',
    quantity_tons: '',
    removal_date: '',
    notes: '',
  };
}

interface WasteTabProps {
  projectId: string;
}

export function WasteTab({ projectId }: WasteTabProps) {
  const { trackings, isLoading, create, update, remove } = useWasteTrackings(projectId);
  const { project } = useProject(projectId);
  const { upload } = useDocuments(projectId);
  const { projectCompanies } = useProjectCompanies(projectId);
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<WasteFormState>(emptyForm());
  const [exporting, setExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<WasteTracking | null>(null);

  // Bilan par catégorie
  const bilan = (Object.keys(WASTE_CATEGORY_LABELS) as WasteCategory[]).map((cat) => {
    const items = trackings.filter((t) => t.waste_category === cat);
    const tons = items.reduce((s, t) => s + (t.quantity_tons ?? 0), 0);
    return { cat, count: items.length, tons };
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.waste_description.trim()) return;
    create.mutate({
      waste_description: form.waste_description.trim(),
      waste_category: form.waste_category,
      bsd_number: form.bsd_number.trim() || null,
      company_id: form.company_id || null,
      disposal_site: form.disposal_site.trim() || null,
      quantity_tons: form.quantity_tons ? parseFloat(form.quantity_tons) : null,
      removal_date: form.removal_date || null,
      notes: form.notes.trim() || null,
    } as Omit<TablesInsert<'waste_trackings'>, 'project_id'>);
    setModalOpen(false);
  }

  function handleStatusChange(tracking: WasteTracking, status: WasteTrackingStatus) {
    update.mutate({
      id: tracking.id,
      payload: {
        status,
        removal_date:
          status !== 'en_attente'
            ? tracking.removal_date ?? new Date().toISOString().slice(0, 10)
            : tracking.removal_date,
      },
    });
  }

  function triggerUpload(tracking: WasteTracking) {
    uploadTargetRef.current = tracking;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const tracking = uploadTargetRef.current;
    e.target.value = '';
    if (!file || !tracking || !profile) return;
    const doc = await upload.mutateAsync({
      file,
      type: 'autre',
      uploadedBy: profile.id,
      folder: 'Déchets',
      companyId: tracking.company_id,
    });
    update.mutate({ id: tracking.id, payload: { document_id: doc.id } });
  }

  async function handleDownload(tracking: WasteTracking) {
    if (!tracking.document_id) return;
    setDownloadingId(tracking.id);
    try {
      const docs = await documentsService.list(projectId);
      const doc = docs.find((d) => d.id === tracking.document_id);
      if (!doc) return;
      const url = await documentsService.getDownloadUrl(doc);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExport() {
    if (!project) return;
    setExporting(true);
    try {
      const { exportWasteSummaryPdf } = await import('@/services/pdfExport.service');
      exportWasteSummaryPdf(
        project,
        trackings,
        projectCompanies.map((pc) => pc.company!).filter(Boolean)
      );
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      {/* Bilan synthèse */}
      <div className="grid grid-cols-3 gap-4">
        {bilan.map(({ cat, count, tons }) => (
          <Card key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {WASTE_CATEGORY_LABELS[cat]}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{count}</p>
            <p className="text-sm text-slate-500">{tons > 0 ? `${tons.toFixed(3)} t` : '—'}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Bordereaux de suivi des déchets</h3>
            <p className="text-sm text-slate-500">{trackings.length} bordereau(x)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} loading={exporting} disabled={trackings.length === 0}>
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
            <Button size="sm" onClick={() => { setForm(emptyForm()); setModalOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nouveau bordereau
            </Button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {trackings.length === 0 ? (
          <EmptyState
            icon={Recycle}
            title="Aucun bordereau de suivi"
            description="Enregistrez chaque flux de déchets (BSD) pour assurer la traçabilité réglementaire du chantier."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {trackings.map((t) => {
              const company = projectCompanies.find((pc) => pc.company_id === t.company_id)?.company;
              return (
                <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{t.waste_description}</p>
                    <p className="text-xs text-slate-400">
                      {WASTE_CATEGORY_LABELS[t.waste_category as WasteCategory]}
                      {t.bsd_number ? ` · N° ${t.bsd_number}` : ''}
                      {company ? ` · ${company.name}` : ''}
                      {t.quantity_tons != null ? ` · ${t.quantity_tons} t` : ''}
                      {t.removal_date ? ` · Enlevé le ${formatDate(t.removal_date)}` : ''}
                    </p>
                    {t.disposal_site && (
                      <p className="text-xs text-slate-400">Exutoire : {t.disposal_site}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select
                      id={`waste-status-${t.id}`}
                      value={t.status}
                      onChange={(e) => handleStatusChange(t, e.target.value as WasteTrackingStatus)}
                      className="h-9 text-xs"
                    >
                      {Object.entries(WASTE_TRACKING_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                    <Badge tone={STATUS_TONE[t.status as WasteTrackingStatus]}>
                      {WASTE_TRACKING_STATUS_LABELS[t.status as WasteTrackingStatus]}
                    </Badge>
                    {t.document_id ? (
                      <button
                        onClick={() => handleDownload(t)}
                        disabled={downloadingId === t.id}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-600"
                        aria-label="Télécharger le bordereau"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => triggerUpload(t)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-600"
                        aria-label="Déposer le bordereau scanné"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { confirmStore.getState().show({ message: 'Supprimer ce bordereau ?' }).then((ok) => { if (ok) remove.mutate(t.id); }); }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                      aria-label="Supprimer le bordereau"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau bordereau de suivi des déchets" size="lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Textarea
            label="Description du déchet"
            required
            value={form.waste_description}
            onChange={(e) => setForm({ ...form, waste_description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="waste-category"
              label="Catégorie réglementaire"
              value={form.waste_category}
              onChange={(e) => setForm({ ...form, waste_category: e.target.value as WasteCategory })}
            >
              {Object.entries(WASTE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input
              id="waste-bsd-number"
              label="N° BSD (Trackdéchets)"
              value={form.bsd_number}
              onChange={(e) => setForm({ ...form, bsd_number: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="waste-company"
              label="Transporteur / collecteur"
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            >
              <option value="">—</option>
              {projectCompanies.map((pc) => (
                <option key={pc.company_id} value={pc.company_id}>{pc.company?.name}</option>
              ))}
            </Select>
            <Input
              id="waste-disposal-site"
              label="Exutoire (installation de traitement)"
              value={form.disposal_site}
              onChange={(e) => setForm({ ...form, disposal_site: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="waste-quantity"
              label="Quantité (tonnes)"
              type="number"
              step="0.001"
              min="0"
              value={form.quantity_tons}
              onChange={(e) => setForm({ ...form, quantity_tons: e.target.value })}
            />
            <Input
              id="waste-removal-date"
              label="Date d'enlèvement"
              type="date"
              value={form.removal_date}
              onChange={(e) => setForm({ ...form, removal_date: e.target.value })}
            />
          </div>
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
