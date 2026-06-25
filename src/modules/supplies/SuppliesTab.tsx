import { useState } from 'react';
import { Plus, Truck, Pencil, Trash2 } from 'lucide-react';
import { useSupplies } from '@/hooks/useSupplies';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { SUPPLY_STATUS_LABELS } from '@/types/domain';
import { formatDate, isOverdue } from '@/utils/date';
import type { Supply } from '@/types/domain';
import type { SupplyStatus, TablesInsert } from '@/types/database.types';

const STATUS_TONE: Record<SupplyStatus, 'slate' | 'blue' | 'purple' | 'green' | 'red' | 'yellow'> = {
  pending: 'slate',
  ordered: 'blue',
  shipped: 'purple',
  delivered: 'green',
  delayed: 'red',
  cancelled: 'yellow',
};

type SupplyFormState = {
  supplier_name: string;
  order_reference: string;
  item_description: string;
  quantity: number;
  unit: string;
  status: SupplyStatus;
  expected_delivery_date: string;
};

const emptyForm: SupplyFormState = {
  supplier_name: '',
  order_reference: '',
  item_description: '',
  quantity: 1,
  unit: '',
  status: 'pending',
  expected_delivery_date: '',
};

interface SuppliesTabProps {
  projectId: string;
}

export function SuppliesTab({ projectId }: SuppliesTabProps) {
  const { supplies, isLoading, create, update, remove } = useSupplies(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supply | null>(null);
  const [form, setForm] = useState<SupplyFormState>(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(supply: Supply) {
    setEditing(supply);
    setForm({
      supplier_name: supply.supplier_name,
      order_reference: supply.order_reference ?? '',
      item_description: supply.item_description,
      quantity: supply.quantity,
      unit: supply.unit ?? '',
      status: supply.status as SupplyStatus,
      expected_delivery_date: supply.expected_delivery_date ?? '',
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'supplies'>, 'project_id'> = {
      supplier_name: form.supplier_name,
      order_reference: form.order_reference || null,
      item_description: form.item_description,
      quantity: form.quantity,
      unit: form.unit || null,
      status: form.status,
      expected_delivery_date: form.expected_delivery_date || null,
    };
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setModalOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Approvisionnements</h3>
          <p className="text-sm text-slate-500">{supplies.length} commande(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Button>
      </div>

      {supplies.length === 0 ? (
        <EmptyState icon={Truck} title="Aucun approvisionnement" description="Suivez vos commandes de matériaux et équipements." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {supplies.map((supply) => {
            const late = isOverdue(supply.expected_delivery_date) && supply.status !== 'delivered' && supply.status !== 'cancelled';
            return (
              <li key={supply.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{supply.item_description}</p>
                  <p className="text-xs text-slate-400">
                    {supply.supplier_name}
                    {supply.order_reference ? ` · Réf. ${supply.order_reference}` : ''} · {supply.quantity}
                    {supply.unit ? ` ${supply.unit}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={late ? 'text-xs font-medium text-red-500' : 'text-xs text-slate-400'}>
                    {supply.expected_delivery_date ? formatDate(supply.expected_delivery_date) : '—'}
                  </span>
                  <Badge tone={late ? 'red' : STATUS_TONE[supply.status as SupplyStatus]}>
                    {late ? 'En retard' : SUPPLY_STATUS_LABELS[supply.status as SupplyStatus]}
                  </Badge>
                  <button onClick={() => openEdit(supply)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Supprimer cette commande ?')) remove.mutate(supply.id);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la commande' : 'Nouvelle commande'} size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Description du matériel"
            required
            value={form.item_description}
            onChange={(e) => setForm({ ...form, item_description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fournisseur"
              required
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
            />
            <Input
              label="Référence commande"
              value={form.order_reference}
              onChange={(e) => setForm({ ...form, order_reference: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Quantité"
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
            <Input label="Unité" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SupplyStatus })}>
              {Object.entries(SUPPLY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Date de livraison prévue"
            type="date"
            value={form.expected_delivery_date}
            onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
