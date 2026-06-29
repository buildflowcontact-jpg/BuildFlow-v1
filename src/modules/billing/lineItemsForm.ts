export interface LineItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate: string;
  lot?: string;
}

export function emptyLineItemRow(): LineItemRow {
  return { description: '', quantity: '1', unit: 'u', unit_price: '0', vat_rate: '20', lot: '' };
}

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
