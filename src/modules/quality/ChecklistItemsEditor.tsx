import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { emptyChecklistRow, type ChecklistItemRow } from './checklistForm';

interface ChecklistItemsEditorProps {
  rows: ChecklistItemRow[];
  onChange: (rows: ChecklistItemRow[]) => void;
}

export function ChecklistItemsEditor({ rows, onChange }: ChecklistItemsEditorProps) {
  function updateRow(index: number, label: string) {
    onChange(rows.map((row, i) => (i === index ? { label } : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, emptyChecklistRow()]);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">Points de contrôle</p>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 text-xs text-slate-400">{index + 1}.</span>
            <Input
              value={row.label}
              onChange={(e) => updateRow(index, e.target.value)}
              placeholder="Ex. Étanchéité des fenêtres"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label="Supprimer le point de contrôle"
              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Ajouter un point de contrôle
      </Button>
    </div>
  );
}
