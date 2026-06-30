import { useState } from 'react';
import { Plus, Users, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import type { Client } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';

type ClientFormState = {
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  first_name: '',
  last_name: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

// La table clients ne stocke qu'un seul champ "name" : on combine
// prénom + nom à l'enregistrement, et on les sépare au mieux à l'édition.
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first_name: parts[0] ?? '', last_name: '' };
  return { first_name: parts[0]!, last_name: parts.slice(1).join(' ') };
}

export function ClientsPage() {
  const { clients, isLoading, create, update, remove } = useClients();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      ...splitName(client.name),
      company_name: client.company_name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'clients'>, 'organization_id'> = {
      name: [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' '),
      company_name: form.company_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setModalOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{clients.length} client(s)</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client pour démarrer un projet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{client.name}</p>
                  {client.company_name && <p className="text-sm text-slate-500">{client.company_name}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(client)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Supprimer ce client ?')) remove.mutate(client.id);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-sm text-slate-500">
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {client.phone}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le client' : 'Nouveau client'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="form-first-name"
              label="Prénom"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
            <Input
              id="form-last-name"
              label="Nom"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <Input id="form-company-name" label="Entreprise" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <div className="grid grid-cols-2 ga