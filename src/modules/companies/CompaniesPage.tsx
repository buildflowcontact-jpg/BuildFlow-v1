import { useState } from 'react';
import { Plus, Building2, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import type { Company } from '@/types/domain';
import type { CompanyType, TablesInsert } from '@/types/database.types';

const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  principale: 'Entreprise principale',
  sous_traitant: 'Sous-traitant',
  fournisseur: 'Fournisseur',
  autre: 'Autre',
};

const COMPANY_TYPE_TONE: Record<CompanyType, 'blue' | 'purple' | 'green' | 'slate'> = {
  principale: 'blue',
  sous_traitant: 'purple',
  fournisseur: 'green',
  autre: 'slate',
};

type CompanyFormState = {
  contact_first_name: string;
  contact_last_name: string;
  name: string;
  type: CompanyType;
  email: string;
  phone: string;
  address: string;
};

const emptyForm: CompanyFormState = {
  contact_first_name: '',
  contact_last_name: '',
  name: '',
  type: 'sous_traitant',
  email: '',
  phone: '',
  address: '',
};

// La table companies ne stocke qu'un seul champ "contact_name" : on combine
// prénom + nom à l'enregistrement, et on les sépare au mieux à l'édition.
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first_name: parts[0] ?? '', last_name: '' };
  return { first_name: parts[0]!, last_name: parts.slice(1).join(' ') };
}

export function CompaniesPage() {
  const { companies, isLoading, create, update, remove } = useCompanies();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormState>(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    const { first_name, last_name } = splitName(company.contact_name ?? '');
    setForm({
      contact_first_name: first_name,
      contact_last_name: last_name,
      name: company.name,
      type: company.type as CompanyType,
      email: company.email ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'companies'>, 'organization_id'> = {
      name: form.name,
      type: form.type,
      contact_name: [form.contact_first_name.trim(), form.contact_last_name.trim()].filter(Boolean).join(' ') || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
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
        <p className="text-sm text-slate-500">{companies.length} entreprise(s)</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle entreprise
        </Button>
      </div>

      {companies.length === 0 ? (
        <EmptyState icon={Building2} title="Aucune entreprise" description="Ajoutez vos sous-traitants et fournisseurs." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{company.name}</p>
                  {company.contact_name && <p className="text-sm text-slate-500">{company.contact_name}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(company)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Supprimer cette entreprise ?')) remove.mutate(company.id);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Badge tone={COMPANY_TYPE_TONE[company.type as CompanyType]} className="w-fit">
                {COMPANY_TYPE_LABELS[company.type as CompanyType]}
              </Badge>
              <div className="flex flex-col gap-1.5 text-sm text-slate-500">
                {company.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {company.email}
                  </span>
                )}
                {company.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {company.phone}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'entreprise" : 'Nouvelle entreprise'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="form-contact-first-name"
              label="Prénom du contact"
              value={form.contact_first_name}
              onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })}
            />
            <Input
              id="form-contact-last-name"
              label="Nom du contact"
              value={form.contact_last_name}
              onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })}
            />
          </div>
          <Input id="form-name" label="Nom de l'entreprise" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select id="form-type" label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CompanyType })}>
            {Object.entries(COMPANY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input id="form-email" label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input id="form-phone" label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input id="form-address" label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
    </div>
  );
}
