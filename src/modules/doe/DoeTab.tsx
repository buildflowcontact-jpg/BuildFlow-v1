import { useMemo, useRef, useState } from 'react';
import { Plus, FolderArchive, Upload, Download, Trash2, FileDown } from 'lucide-react';
import { useDoe } from '@/hooks/useDoe';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useProjectCompanies } from '@/hooks/useCompanies';
import { useAuth } from '@/hooks/useAuth';
import { documentsService } from '@/services/documents.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { DOE_ITEM_STATUS_LABELS, DOE_ITEM_CATEGORY_LABELS } from '@/types/domain';
import type { DoeItem } from '@/types/domain';
import type { DoeItemStatus, DoeItemCategory, TablesInsert } from '@/types/database.types';
import { formatDate } from '@/utils/date';
import { confirmStore } from '@/components/ui/ConfirmModal';

const DOE_STATUS_TONE: Record<DoeItemStatus, 'red' | 'blue' | 'green' | 'purple'> = {
  manquant: 'red',
  recu: 'blue',
  valide: 'green',
};

type DoeFormState = {
  lot: string;
  company_id: string;
  category: DoeItemCategory;
  label: string;
};

function emptyDoeForm(): DoeFormState {
  return { lot: '', company_id: '', category: 'autre', label: '' };
}

interface DoeTabProps {
  projectId: string;
}

export function DoeTab({ projectId }: DoeTabProps) {
  const { items, isLoading, create, update, remove } = useDoe(projectId);
  const { project } = useProject(projectId);
  const { upload } = useDocuments(projectId);
  const { projectCompanies } = useProjectCompanies(projectId);
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DoeFormState>(emptyDoeForm());
  const [exporting, setExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<DoeItem | null>(null);

  const byLot = useMemo(() => {
    const map = new Map<string, DoeItem[]>();
    for (const item of items) {
      const list = map.get(item.lot) ?? [];
      list.push(item);
      map.set(item.lot, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const total = items.length;
  const validated = items.filter((i) => i.status === 'valide').length;
  const received = items.filter((i) => i.status === 'recu').length;

  function openCreate() {
    setForm(emptyDoeForm());
    setModalOpen(true);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lot.trim() || !form.label.trim()) return;
    create.mutate({
      lot: form.lot.trim(),
      company_id: form.company_id || null,
      category: form.category,
      label: form.label.trim(),
    } as Omit<TablesInsert<'doe_items'>, 'project_id'>);
    setModalOpen(false);
  }

  function handleStatusChange(item: DoeItem, status: DoeItemStatus) {
    update.mutate({
      id: item.id,
      payload: {
        status,
        received_date: status === 'manquant' ? null : item.received_date ?? new Date().toISOString().slice(0, 10),
      },
    });
  }

  function triggerUpload(item: DoeItem) {
    uploadTargetRef.current = item;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const item = uploadTargetRef.current;
    e.target.value = '';
    if (!file || !item || !profile) return;
    const doc = await upload.mutateAsync({
      file,
      type: 'doe',
      uploadedBy: profile.id,
      folder: 'DOE',
      companyId: item.company_id,
    });
    update.mutate({
      id: item.id,
      payload: {
        document_id: doc.id,
        status: 'recu',
        received_date: item.received_date ?? new Date().toISOString().slice(0, 10),
      },
    });
  }

  async function handleDownload(item: DoeItem) {
    if (!item.document_id) return;
    setDownloadingId(item.id);
    try {
      const docs = await documentsService.list(projectId);
      const doc = docs.find((d) => d.id === item.document_id);
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
      const { exportDoeSummaryPdf } = await import('@/services/pdfExport.service');
      exportDoeSummaryPdf(
        project,
        items,
        projectCompanies.map((pc) => pc.company!).filter(Boolean)
      );
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">DOE — Dossier des Ouvrages Exécutés</h3>
            <p className="text-sm text-slate-500">
              {total} pièce(s) · {validated} validée(s) · {received} reçue(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} loading={exporting} disabled={items.length === 0}>
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouvelle pièce
            </Button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {items.length === 0 ? (
          <EmptyState
            icon={FolderArchive}
            title="Aucune pièce DOE"
            description="Ajoutez les pièces attendues (plans, notices, PV de réception, garanties...) par lot et par entreprise."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {byLot.map(([lot, lotItems]) => (
              <div key={lot}>
                <p className="mb-2 text-sm font-semibold text-slate-700">{lot}</p>
                <ul className="divide-y divide-slate-100 rounded-xl bg-slate-50 px-3">
                  {lotItems.map((item) => {
                    const company = projectCompanies.find((pc) => pc.company_id === item.company_id)?.company;
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{item.label}</p>
                          <p className="text-xs text-slate-400">
                            {DOE_ITEM_CATEGORY_LABELS[item.category as DoeItemCategory]}
                            {company ? ` · ${company.name}` : ''}
                            {item.received_date ? ` · Reçu le ${formatDate(item.received_date)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            id={`doe-status-${item.id}`}
                            value={item.status}
                            onChange={(e) => handleStatusChange(item, e.target.value as DoeItemStatus)}
                            className="h-9 text-xs"
                          >
                            {Object.entries(DOE_ITEM_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                          <Badge tone={DOE_STATUS_TONE[item.status as DoeItemStatus]}>
                            {DOE_ITEM_STATUS_LABELS[item.status as DoeItemStatus]}
                          </Badge>
                          {item.document_id ? (
                            <button
                              onClick={() => handleDownload(item)}
                              disabled={downloadingId === item.id}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-600"
                              aria-label="Télécharger le document"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => triggerUpload(item)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-600"
                              aria-label="Déposer le document"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              confirmStore.getState().show({ message: 'Supprimer cette pièce du DOE ?' }).then((ok) => { if (ok) remove.mutate(item.id); });
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                            aria-label="Supprimer la pièce"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle pièce DOE">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            id="doe-lot"
            label="Lot / corps d'état"
            required
            value={form.lot}
            onChange={(e) => setForm({ ...form, lot: e.target.value })}
          />
          <Input
            id="doe-label"
            label="Libellé de la pièce"
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="doe-category"
              label="Catégorie"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as DoeItemCategory })}
            >
              {Object.entries(DOE_ITEM_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              id="doe-company"
              label="Entreprise"
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            >
              <option value="">—</option>
              {projectCompanies.map((pc) => (
                <option key={pc.company_id} value={pc.company_id}>
                  {pc.company?.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Ajouter
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
