import type { LineItemRow } from '@/modules/billing/lineItemsForm';

export interface DpgfImportResult {
  rows: LineItemRow[];
  sheetName: string;
  skippedRowCount: number;
}

const HEADER_SEARCH_DEPTH = 20;

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '')
    .toLowerCase()
    .trim();
}

/** Convertit un nombre au format FR (« 1 234,56 ») ou US en number, ou null si vide/invalide. */
function parseFrenchNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

interface ColumnMap {
  lot: number | null;
  description: number;
  unit: number | null;
  quantity: number;
  unitPrice: number;
}

/**
 * Recherche, parmi les premières lignes d'une feuille, celle qui ressemble à
 * un en-tête de tableau DPGF (Désignation/Libellé, Quantité, Prix unitaire —
 * Lot et Unité étant optionnels). Les libellés sont comparés normalisés
 * (minuscules, sans accents) car les DPGF du marché varient beaucoup.
 */
function matchHeaderRow(rows: unknown[][]): { rowIndex: number; columns: ColumnMap } | null {
  const limit = Math.min(rows.length, HEADER_SEARCH_DEPTH);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    const cells = row.map(normalize);
    const lotIdx = cells.findIndex((c) => c.includes('lot'));
    const descIdx = cells.findIndex(
      (c) => c.includes('designation') || c.includes('description') || c.includes('libelle') || c.includes('poste')
    );
    const unitIdx = cells.findIndex((c) => c.includes('unite') || c === 'u');
    const qtyIdx = cells.findIndex((c) => c.includes('quantite') || c.includes('qte'));
    const priceIdx = cells.findIndex(
      (c) => (c.includes('prix') && (c.includes('unit') || c.includes('pu'))) || c === 'pu'
    );
    if (descIdx !== -1 && qtyIdx !== -1 && priceIdx !== -1) {
      return {
        rowIndex: r,
        columns: {
          lot: lotIdx !== -1 ? lotIdx : null,
          description: descIdx,
          unit: unitIdx !== -1 ? unitIdx : null,
          quantity: qtyIdx,
          unitPrice: priceIdx,
        },
      };
    }
  }
  return null;
}

export const dpgfImportService = {
  /**
   * Parse un fichier DPGF (.xlsx) côté client : détecte automatiquement la
   * ligne d'en-tête (Lot / Désignation / Unité / Quantité / Prix unitaire)
   * sur la première feuille qui en contient une, puis extrait les lignes de
   * postes. Les lignes « titre de lot » (sans quantité ni prix renseignés)
   * ne deviennent pas des postes : elles mettent juste à jour le lot courant,
   * reporté sur les postes suivants — c'est ainsi que les DPGF du BTP
   * structurent généralement un tableau Lot > Poste.
   */
  async parseFile(file: File): Promise<DpgfImportResult> {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const header = matchHeaderRow(grid);
      if (!header) continue;

      const { rowIndex, columns } = header;
      const rows: LineItemRow[] = [];
      let currentLot = '';
      let skippedRowCount = 0;

      for (let r = rowIndex + 1; r < grid.length; r++) {
        const row = grid[r] ?? [];
        const lotCell = columns.lot !== null ? String(row[columns.lot] ?? '').trim() : '';
        const description = String(row[columns.description] ?? '').trim();
        const quantity = parseFrenchNumber(row[columns.quantity]);
        const unitPrice = parseFrenchNumber(row[columns.unitPrice]);

        if (lotCell) currentLot = lotCell;

        if (!description || quantity === null || unitPrice === null) {
          if (description || lotCell) skippedRowCount++;
          continue;
        }

        rows.push({
          description,
          quantity: String(quantity),
          unit: (columns.unit !== null ? String(row[columns.unit] ?? '').trim() : '') || 'u',
          unit_price: String(unitPrice),
          vat_rate: '20',
          lot: currentLot || '',
        });
      }

      if (rows.length > 0) {
        return { rows, sheetName, skippedRowCount };
      }
    }

    throw new Error(
      "Impossible de détecter les colonnes Désignation/Quantité/Prix unitaire dans ce fichier. Vérifiez qu'il s'agit bien d'un DPGF avec des en-têtes de colonnes."
    );
  },
};
