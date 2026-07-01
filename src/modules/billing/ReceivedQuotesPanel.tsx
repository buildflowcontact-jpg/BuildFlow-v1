import { useState } from 'react';
import { Plus, FileText, Download, Trash2 } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useProjectCompanies } from '@/hooks/useCompanies';
import { useAuthStore } from '@/stores/authStore';
import { documentsService } from '@/services/documents.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';

const FOLDER = 'Devis';

type FormState = {
  companyId: string;
  amount: string;
};

function emptyForm(): FormState {
  return { companyId: '', amount: '' };
}

interface ReceivedQuotesPanelProps {
  projectId: string;
}

export function ReceivedQuotesPanel({ projectId }: ReceivedQuotesPanelProps) {
  const { documents, isLoading, upload, remove } = useDocuments(projectId);
  const { projectCompanies } = useProjectCompanies(projectId);
  const profile = useAuthStore((s) => s.profile);

  const receivedQuotes = documents.filter((d) => d.folder === FOLDER);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm());
    setFile(null);
    setError(null);
    setOpen(true);
  }

  function companyName(companyId: string | null) {
    if (!companyId) return '—';
    return projectCompanies.find((pc) => pc.company.id === companyId)?.company.name ?? '—';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Sélectionnez un fichier.');
      return;
    }
    if (!profile?.id) return;
    setError(null);
    upload.mutate(
      {
        file,
        type: 'pdf',
        uploadedBy: profile.id,
        folder: FOLDER,
        companyId: form.companyId || null,
        amount: form.amount ? Number(form.amount) : null,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  async function handleDownload(docId: string) {
    const doc = receivedQuotes.find((d) => d.id === docId);
    if (!doc) return;
    const url = await documentsService.getDownloadUrl(doc);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Devis reçus</h3>
          <p className="text-sm text-slate-500">
            {receivedQuotes.length} devis reçu(s) de fournisseurs ou sous-traitants
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau devis reçu
        </Button>
      </div>

      {receivedQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis reçu"
          description="Déposez les devis reçus de vos fournisseurs ou sous-traitants. Ils seront aussi visibles dans Documents, dossier « Devis »."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {receivedQuotes.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{doc.name}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{companyName(doc.company_id)}</span>
                  <span>Déposé le {formatDate(doc.created_at)}</span>
                </div>
              </div>
              {doc.amount != null && (
                <span className="font-semibold text-slate-800">{formatCurrency(doc.amount)}</span>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(doc.id)}
                  aria-label="Télécharger"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    confirmStore.getState().show({ message: 'Supprimer ce devis reçu ?' }).then((ok) => { if (ok) remove.mutate(doc); });
                  }}
                  aria-label="Supprimer"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau devis reçu">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select id="receivedquoteform-company-id"
            label="Fournisseur / Sous-traitant"
            value={form.companyId}
            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
          >
            <option value="">—</option>
            {projectCompanies.map((pc) => (
              <option key={pc.company.id} value={pc.company.id}>
                {pc.company.name}
              </option>
            ))}
          </Select>
          <div>
            <label htmlFor="receivedquoteform-file" className="mb-1.5 block text-sm font-medium text-slate-700">
              Fichier du devis
            </label>
            <input
              id="receivedquoteform-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
          <Input id="receivedquoteform-amount"
            type="number"
            step="0.01"
            min="0"
            label="Montant (optionnel)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={upload.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
