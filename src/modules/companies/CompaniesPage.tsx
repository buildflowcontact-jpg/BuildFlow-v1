import { useState } from 'react';
import { Plus, Building2, Mail, Phone, Trash2 } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
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
  name: string;
  type: CompanyType;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
};

const emptyForm: CompanyFormState = { name: '', type: 'sous_traitant', contact_name: '', email: '', phone: '', address: '' };

export function CompaniesPage() {
  const { companies, isLoading, create, remove } = useCompanies();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CompanyFormState>(emptyForm);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'companies'>, 'organization_id'> = {
      name: form.name,
      type: form.type,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
    };
    create.mutate(payload, {
      onSuccess: () => {
        setModalOpen(false);
        setForm(emptyForm);
      },
    });
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{companies.length} entreprise(s)</p>
        <Button onClick={() => setModalOpen(true)}>
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
                <button
                  onClick={() => {
                    if (confirm('Supprimer cette entreprise ?')) remove.mutate(company.id);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle entreprise">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CompanyType })}>
            {Object.entries(COMPANY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input label="Contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
