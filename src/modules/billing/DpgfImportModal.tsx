import { useRef, useState, type FormEvent } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { useQuotes } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { dpgfImportService } from '@/services/dpgfImport.service';
import type { QuoteItemInput } from '@/services/quotes.service';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LineItemsEditor } from './LineItemsEditor';
import { lineRowsToItems, type LineItemRow } from './lineItemsForm';

interface DpgfImportModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onImported: (quoteId: string) => void;
}

/**
 * Assistant d'import DPGF : upload d'un fichier Excel d'appel d'offres,
 * détection automatique des colonnes (Lot/Désignation/Unité/Quantité/Prix
 * unitaire), prévisualisation/édition des lignes extraites puis création
 * d'un devis brouillon en une seule opération.
 */
export function DpgfImportModal({ projectId, open, onClose, onImported }: DpgfImportModalProps) {
  const { create } = useQuotes(projectId);
  const { clients } = useClients();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skippedRowCount, setSkippedRowCount] = useState(0);
  const [rows, setRows] = useState<LineItemRow[] | null>(null);

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');

  function reset() {
    setFileName(null);
    setParsing(false);
    setParseError(null);
    setSkippedRowCount(0);
    setRows(null);
    setTitle('');
    setClientId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelected(file: File) {
    setFileName(file.name);
    setParseError(null);
    setParsing(true);
    try {
      const result = await dpgfImportService.parseFile(file);
      setRows(result.rows);
      setSkippedRowCount(result.skippedRowCount);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (error) {
      setRows(null);
      setParseError(error instanceof Error ? error.message : "Échec de l'analyse du fichier.");
    } finally {
      setParsing(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rows) return;
    const items = lineRowsToItems<QuoteItemInput>(rows);
    create.mutate(
      {
        payload: {
          title: title || 'Devis importé (DPGF)',
          client_id: clientId || null,
          issue_date: new Date().toISOString().slice(0, 10),
          validity_until: null,
          notes: fileName ? `Importé depuis le fichier DPGF « ${fileName} ».` : null,
          currency: 'EUR',
        },
        items,
      },
      {
        onSuccess: (quote) => {
          onImported(quote.id);
          handleClose();
        },
      }
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importer un DPGF" size="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void handleFileSelected(file);
          }}
        >
          <FileSpreadsheet className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600">
            Déposez un fichier Excel (.xlsx) de DPGF, ou{' '}
            <button
              type="button"
              className="font-medium text-brand-600 hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              parcourez vos fichiers
            </button>
            .
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
          {fileName && <p className="text-xs text-slate-400">{fileName}</p>}
        </div>

        {parsing && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
            <Spinner /> Analyse du fichier…
          </div>
        )}

        <ErrorMessage error={parseError} />

        {rows && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input id="title" label="Titre du devis" required value={title} onChange={(e) => setTitle(e.target.value)} />
              <Select id="clientid" label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ?? c.name}
                  </option>
                ))}
              </Select>
            </div>

            <p className="text-sm text-slate-500">
              {rows.length} ligne{rows.length > 1 ? 's' : ''} détectée{rows.length > 1 ? 's' : ''}
              {skippedRowCount > 0 &&
                ` (${skippedRowCount} ligne${skippedRowCount > 1 ? 's' : ''} ignorée${skippedRowCount > 1 ? 's' : ''} — quantité ou prix manquant)`}
              . Vérifiez et ajustez avant de créer le devis.
            </p>

            <LineItemsEditor rows={rows} onChange={setRows} />
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!rows || rows.length === 0 || !title.trim()}>
            <Upload className="h-4 w-4" />
            Créer le devis
          </Button>
        </div>
      </form>
    </Modal>
  );
}
