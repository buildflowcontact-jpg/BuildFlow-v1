import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/utils/currency';

export interface LineItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate: string;
  /** Libellé du lot (regroupement DPGF), optionnel — non affiché si aucune ligne n'en a. */
  lot?: string;
}

export function emptyLineItemRow(): LineItemRow {
  return { description: '', quantity: '1', unit: 'u', unit_price: '0', vat_rate: '20', lot: '' };
}

/** Convertit les lignes du formulaire (texte) en payload numérique pour les services. */
export function lineRowsToItems<T extends { description: string; quantity: number; unit: string; unit_price: number; vat_rate: number; position?: number; lot?: string | null }>(
  rows: LineItemRow[]
): T[] {
  return rows
    .filter((row) => row.description.trim().length > 0)
    .map(
      (row, index) =>
        ({
          description: row.description,
          quantity: Number(row.quantity) || 0,
          unit: row.unit || 'u',
          unit_price: Number(row.unit_price) || 0,
          vat_rate: Number(row.vat_rate) || 0,
          position: index,
          lot: row.lot?.trim() || null,
        }) as T
    );
}

function rowTotals(rows: LineItemRow[]): { subtotal: number; vatAmount: number; total: number } {
  let subtotal = 0;
  let vatAmount = 0;
  for (const row of rows) {
    const lineHt = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
    subtotal += lineHt;
    vatAmount += lineHt * ((Number(row.vat_rate) || 0) / 100);
  }
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

interface LineItemsEditorProps {
  rows: LineItemRow[];
  onChange: (rows: LineItemRow[]) => void;
}

/** Éditeur de lignes (devis/facture) avec calcul des totaux en direct. */
export function LineItemsEditor({ rows, onChange }: LineItemsEditorProps) {
  const totals = rowTotals(rows);

  function updateRow(index: number, patch: Partial<LineItemRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, emptyLineItemRow()]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-24 px-2 py-2 text-left">Lot</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="w-20 px-2 py-2 text-left">Qté</th>
              <th className="w-20 px-2 py-2 text-left">Unité</th>
              <th className="w-28 px-2 py-2 text-left">Prix unit. HT</th>
              <th className="w-20 px-2 py-2 text-left">TVA %</th>
              <th className="w-28 px-2 py-2 text-right">Total HT</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const lineTotal = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
              return (
                <tr key={index}>
                  <td className="px-1 py-1.5">
                    <Input
                      value={row.lot ?? ''}
                      placeholder="Lot"
                      onChange={(e) => updateRow(index, { lot: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={row.description}
                      placeholder="Désignation"
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, { quantity: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input value={row.unit} onChange={(e) => updateRow(index, { unit: e.target.value })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.unit_price}
                      onChange={(e) => updateRow(index, { unit_price: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.vat_rate}
                      onChange={(e) => updateRow(index, { vat_rate: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-slate-700">{formatCurrency(lineTotal)}</td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
        <Plus className="h-4 w-4" />
        Ajouter une ligne
      </Button>

      <div className="flex justify-end">
        <div className="w-64 rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-slate-500">Total HT</span>
            <span className="font-medium text-slate-800">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-slate-500">TVA</span>
            <span className="font-medium text-slate-800">{formatCurrency(totals.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 py-1 pt-1.5">
            <span className="font-medium text-slate-700">Total TTC</span>
            <span className="font-semibold text-slate-900">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
