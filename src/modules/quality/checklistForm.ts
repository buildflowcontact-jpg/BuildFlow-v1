export interface ChecklistItemRow {
  label: string;
}

export function emptyChecklistRow(): ChecklistItemRow {
  return { label: '' };
}

export function checklistRowsToItems(rows: ChecklistItemRow[]): { label: string; position: number }[] {
  return rows
    .filter((row) => row.label.trim().length > 0)
    .map((row, index) => ({ label: row.label.trim(), position: index }));
}
