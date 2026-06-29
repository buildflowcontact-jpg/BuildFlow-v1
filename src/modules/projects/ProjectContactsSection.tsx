import { useState, type FormEvent } from 'react';
import { Star, Pencil, Trash2, Plus, Phone, Mail } from 'lucide-react';
import { useProjectContacts } from '@/hooks/useProjectContacts';
import { useClients } from '@/hooks/useClients';
import { useCompanies } from '@/hooks/useCompanies';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { ProjectContact } from '@/types/domain';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  company_name: '',
  email: '',
  phone: '',
  job_title: '',
};

export function ProjectContactsSection({ projectId }: { projectId: string }) {
  const { contacts, isLoading, create, update, remove, setPrimary } = useProjectContacts(projectId);
  const { clients } = useClients();
  const { companies } = useCompanies();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importSource, setImportSource] = useState('');

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImportSource('');
    setModalOpen(true);
  }

  function openEdit(contact: ProjectContact) {
    setEditingId(contact.id);
    setForm({
      first_name: contact.first_name ?? '',
      last_name: contact.last_name ?? '',
      company_name: contact.company_name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      job_title: contact.job_title ?? '',
    });
    setImportSource('');
    setModalOpen(true);
  }

  function handleImportChange(value: string) {
    setImportSource(value);
    if (!value) return;
    const [kind, id] = value.split(':');
    if (kind === 'client') {
      const client = clients.find((c) => c.id === id);
      if (client) {
        const [first, ...rest] = client.name.split(' ');
        setForm({
          first_name: first ?? client.name,
          last_name: rest.join(' '),
          company_name: client.company_name ?? '',
          email: client.email ?? '',
          phone: client.phone ?? '',
          job_title: '',
        });
      }
    } else if (kind === 'company') {
      const company = companies.find((c) => c.id === id);
      if (company) {
        const [first, ...rest] = (company.contact_name ?? '').split(' ');
        setForm({
          first_name: first ?? '',
          last_name: rest.join(' '),
          company_name: company.name,
          email: company.email ?? '',
          phone: company.phone ?? '',
          job_title: '',
        });
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      company_name: form.company_name || null,
      email: form.email || null,
      phone: form.phone || null,
      job_title: form.job_title || null,
    };
    if (editingId) {
      update.mutate({ id: editingId, payload }, { onSuccess: () => setModalOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardHeader className="!mb-0">
          <CardTitle>Contacts du projet</CardTitle>
        </CardHeader>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {!isLoading && contacts.length === 0 && (
        <p className="py-4 text-sm text-slate-400">Aucun contact renseigné pour ce projet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {contacts.map((contact) => {
          const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Sans nom';
          return (
            <li
              key={contact.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{fullName}</span>
                  {contact.is_primary && <Badge tone="blue">Principal</Badge>}
                </div>
                <span className="text-xs text-slate-500">
                  {[contact.job_title, contact.company_name].filter(Boolean).join(' · ') || '—'}
                </span>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {contact.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!contact.is_primary && (
                  <button
                    title="Définir comme contact principal"
                    aria-label="Définir comme contact principal"
                    onClick={() => setPrimary.mutate(contact.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-amber-500"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  title="Modifier"
                  aria-label="Modifier"
                  onClick={() => openEdit(contact)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  title="Supprimer"
                  aria-label="Supprimer"
                  onClick={() => remove.mutate(contact.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Modifier le contact' : 'Ajouter un contact'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!editingId && (clients.length > 0 || companies.length > 0) && (
            <Select id="importsource"
              label="Importer depuis un client/entreprise existant (optionnel)"
              value={importSource}
              onChange={(e) => handleImportChange(e.target.value)}
            >
              <option value="">— Saisir manuellement —</option>
              {clients.length > 0 && (
                <optgroup label="Clients">
                  {clients.map((c) => (
                    <option key={`client:${c.id}`} value={`client:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {companies.length > 0 && (
                <optgroup label="Entreprises">
                  {companies.map((c) => (
                    <option key={`company:${c.id}`} value={`company:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input id="form-first-name"
              label="Prénom"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
            <Input id="form-last-name"
              label="Nom"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <Input id="form-company-name"
            label="Entreprise"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
          <Input id="form-job-title"
            label="Intitulé de poste"
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input id="form-email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input id="form-phone"
              label="Téléphone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editingId ? 'Enregistrer' : 'Ajouter le contact'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
