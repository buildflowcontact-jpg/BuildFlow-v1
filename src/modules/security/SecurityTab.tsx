import { useState } from 'react';
import { Plus, Flame, ShieldCheck, FileSignature, Trash2 } from 'lucide-react';
import { useFirePermits } from '@/hooks/useFirePermits';
import { usePpsps } from '@/hooks/usePpsps';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useProjectCompanies } from '@/hooks/useCompanies';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { SignaturePad } from '@/components/ui/SignaturePad';
import {
  FIRE_PERMIT_STATUS_LABELS,
  PPSPS_STATUS_LABELS,
  DEFAULT_FIRE_PERMIT_PRECAUTIONS,
} from '@/types/domain';
import type { PrecautionItem, FirePermit, PpspsRecord } from '@/types/domain';
import type { FirePermitStatus, PpspsStatus, TablesInsert } from '@/types/database.types';
import { formatDate } from '@/utils/date';

const FIRE_PERMIT_TONE: Record<FirePermitStatus, 'red' | 'blue' | 'green' | 'purple'> = {
  draft: 'blue',
  issued: 'green',
  closed: 'purple',
};

const PPSPS_TONE: Record<PpspsStatus, 'red' | 'blue' | 'green' | 'purple'> = {
  en_attente: 'red',
  recu: 'blue',
  valide: 'green',
};

type FirePermitFormState = {
  location: string;
  work_description: string;
  company_id: string;
  executant_name: string;
  work_date: string;
  start_time: string;
  end_time: string;
  fire_watch_minutes: number;
  precautions: PrecautionItem[];
};

function emptyFirePermitForm(): FirePermitFormState {
  return {
    location: '',
    work_description: '',
    company_id: '',
    executant_name: '',
    work_date: new Date().toISOString().slice(0, 10),
    start_time: '',
    end_time: '',
    fire_watch_minutes: 60,
    precautions: DEFAULT_FIRE_PERMIT_PRECAUTIONS.map((p) => ({ ...p })),
  };
}

interface SecurityTabProps {
  projectId: string;
}

export function SecurityTab({ projectId }: SecurityTabProps) {
  const { permits, isLoading: permitsLoading, create: createPermit, remove: removePermit } = useFirePermits(projectId);
  const { records, isLoading: recordsLoading, upsert: upsertPpsps } = usePpsps(projectId);
  const { project } = useProject(projectId);
  const { upload } = useDocuments(projectId);
  const { projectCompanies } = useProjectCompanies(projectId);
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FirePermitFormState>(emptyFirePermitForm());
  const [issuerSignerName, setIssuerSignerName] = useState('');
  const [issuerSignature, setIssuerSignature] = useState<string | null>(null);
  const [executantSignerName, setExecutantSignerName] = useState('');
  const [executantSignature, setExecutantSignature] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function openCreate() {
    setForm(emptyFirePermitForm());
    setIssuerSignerName(profile?.full_name ?? profile?.email ?? '');
    setIssuerSignature(null);
    setExecutantSignerName('');
    setExecutantSignature(null);
    setModalOpen(true);
  }

  function togglePrecaution(index: number) {
    setForm((f) => ({
      ...f,
      precautions: f.precautions.map((p, i) => (i === index ? { ...p, checked: !p.checked } : p)),
    }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !profile || !issuerSignature || !executantSignature) return;
    setGenerating(true);
    try {
      const payload: Omit<TablesInsert<'fire_permits'>, 'project_id'> = {
        location: form.location,
        work_description: form.work_description,
        company_id: form.company_id || null,
        executant_name: form.executant_name,
        work_date: form.work_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        fire_watch_minutes: form.fire_watch_minutes,
        precautions: form.precautions as unknown as TablesInsert<'fire_permits'>['precautions'],
        status: 'issued',
        created_by: profile.id,
      };
      const permit = await createPermit.mutateAsync(payload);

      const companyName = projectCompanies.find((pc) => pc.company_id === form.company_id)?.company?.name ?? null;
      const { exportFirePermitPdf } = await import('@/services/pdfExport.service');
      const file = exportFirePermitPdf(project, permit as FirePermit, companyName, {
        issuer: { signerName: issuerSignerName, dataUrl: issuerSignature },
        executant: { signerName: executantSignerName, dataUrl: executantSignature },
      });
      await upload.mutateAsync({ file, type: 'autre', uploadedBy: profile.id, folder: 'Sécurité' });
      setModalOpen(false);
    } finally {
      setGenerating(false);
    }
  }

  function handlePpspsStatusChange(record: PpspsRecord | undefined, companyId: string, status: PpspsStatus) {
    upsertPpsps.mutate({
      id: record?.id,
      company_id: companyId,
      status,
      received_date: status === 'en_attente' ? null : record?.received_date ?? new Date().toISOString().slice(0, 10),
    } as Omit<TablesInsert<'ppsps_records'>, 'project_id'>);
  }

  if (permitsLoading || recordsLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Permis de feu</h3>
            <p className="text-sm text-slate-500">{permits.length} permis émis</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau permis
          </Button>
        </div>

        {permits.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Aucun permis de feu"
            description="Émettez un permis de feu avant toute intervention par point chaud (soudure, découpe...)."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {permits.map((permit) => {
              const companyName = projectCompanies.find((pc) => pc.company_id === permit.company_id)?.company?.name;
              return (
                <li key={permit.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{permit.work_description}</p>
                    <p className="text-xs text-slate-400">
                      {permit.location} · {formatDate(permit.work_date)}
                      {companyName ? ` · ${companyName}` : ''} · {permit.executant_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={FIRE_PERMIT_TONE[permit.status as FirePermitStatus]}>
                      {FIRE_PERMIT_STATUS_LABELS[permit.status as FirePermitStatus]}
                    </Badge>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce permis de feu ?')) removePermit.mutate(permit.id);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                      aria-label="Supprimer le permis"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">Suivi PPSPS par entreprise</h3>
          <p className="text-sm text-slate-500">Plan Particulier de Sécurité et de Protection de la Santé</p>
        </div>

        {projectCompanies.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Aucune entreprise sur ce projet"
            description="Ajoutez des entreprises au projet pour suivre la réception de leur PPSPS."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {projectCompanies.map((pc) => {
              const record = records.find((r) => r.company_id === pc.company_id);
              const status = (record?.status ?? 'en_attente') as PpspsStatus;
              return (
                <li key={pc.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{pc.company?.name}</p>
                    <p className="text-xs text-slate-400">
                      {record?.received_date ? `Reçu le ${formatDate(record.received_date)}` : 'Non reçu'}
                    </p>
                  </div>
                  <Select
                    id={`ppsps-status-${pc.company_id}`}
                    value={status}
                    onChange={(e) => handlePpspsStatusChange(record, pc.company_id, e.target.value as PpspsStatus)}
                  >
                    {Object.entries(PPSPS_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Badge tone={PPSPS_TONE[status]}>{PPSPS_STATUS_LABELS[status]}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau permis de feu" size="lg">
        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="fp-location"
              label="Localisation"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <Input
              id="fp-date"
              label="Date"
              type="date"
              required
              value={form.work_date}
              onChange={(e) => setForm({ ...form, work_date: e.target.value })}
            />
          </div>
          <Textarea
            label="Nature des travaux"
            required
            value={form.work_description}
            onChange={(e) => setForm({ ...form, work_description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="fp-company"
              label="Entreprise exécutante"
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            >
              <option value="">—</option>
              {projectCompanies.map((pc) => (
                <option key={pc.company_id} value={pc.company_id}>
                  {pc.company?.name}
                </option>
              ))}
            </Select>
            <Input
              id="fp-executant"
              label="Nom de l'exécutant"
              required
              value={form.executant_name}
              onChange={(e) => setForm({ ...form, executant_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              id="fp-start"
              label="Début"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
            <Input
              id="fp-end"
              label="Fin"
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
            <Input
              id="fp-watch"
              label="Surveillance après arrêt (min)"
              type="number"
              min={0}
              value={form.fire_watch_minutes}
              onChange={(e) => setForm({ ...form, fire_watch_minutes: Number(e.target.value) })}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Mesures de prévention</p>
            <ul className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
              {form.precautions.map((p, i) => (
                <li key={p.label} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    id={`fp-precaution-${i}`}
                    type="checkbox"
                    checked={p.checked}
                    onChange={() => togglePrecaution(i)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor={`fp-precaution-${i}`}>{p.label}</label>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                id="fp-issuer-name"
                label="Nom du signataire (émetteur)"
                required
                value={issuerSignerName}
                onChange={(e) => setIssuerSignerName(e.target.value)}
              />
              <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Signature de l'émetteur</p>
              <SignaturePad onChange={setIssuerSignature} />
            </div>
            <div>
              <Input
                id="fp-executant-name"
                label="Nom du signataire (exécutant)"
                required
                value={executantSignerName}
                onChange={(e) => setExecutantSignerName(e.target.value)}
              />
              <p className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Signature de l'exécutant</p>
              <SignaturePad onChange={setExecutantSignature} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              loading={generating || createPermit.isPending || upload.isPending}
              disabled={!issuerSignature || !executantSignature || !issuerSignerName.trim() || !executantSignerName.trim()}
            >
              <FileSignature className="h-4 w-4" />
              Émettre et archiver
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
