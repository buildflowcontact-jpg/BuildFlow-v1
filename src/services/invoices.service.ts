import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import { computeLineTotals } from '@/types/domain';
import type { Invoice, InvoiceItem, InvoicePayment, InvoiceWithItems } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';
import { storageService } from './storage.service';
import { projectsService } from './projects.service';
import { clientsService } from './clients.service';
import { organizationsService } from './organizations.service';

export type InvoiceItemInput = Pick<InvoiceItem, 'description' | 'quantity' | 'unit' | 'unit_price' | 'vat_rate'> & {
  position?: number;
};

export type ListPageOpts = { limit?: number; offset?: number };

export const invoicesService = {
  /** `opts` optionnel et rétrocompatible — voir quotesService.list. */
  async list(projectId: string, opts?: ListPageOpts): Promise<Invoice[]> {
    let query = supabase.from('invoices').select('*').eq('project_id', projectId).order('number', { ascending: false });
    if (opts?.limit !== undefined) {
      const offset = opts.offset ?? 0;
      query = query.range(offset, offset + opts.limit - 1);
    }
    return unwrap(await query);
  },

  async getWithItems(invoiceId: string): Promise<InvoiceWithItems> {
    const invoice = unwrap(await supabase.from('invoices').select('*').eq('id', invoiceId).single());
    const items = unwrap(
      await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('position', { ascending: true })
    );
    const payments = unwrap(
      await supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('paid_at', { ascending: false })
    );
    return { ...invoice, items, payments };
  },

  /**
   * Crée une facture libre (hors conversion de devis) avec ses lignes. Le
   * numéro légal sans trou est assigné par `assign_invoice_number`, les
   * mentions de pénalités/délai de paiement par `set_invoice_defaults`
   * (copiées depuis l'organisation si non fournies) — jamais calculées ici.
   */
  async create(
    payload: Omit<
      TablesInsert<'invoices'>,
      'organization_id' | 'subtotal' | 'vat_amount' | 'total' | 'number' | 'amount_paid'
    >,
    items: InvoiceItemInput[]
  ): Promise<InvoiceWithItems> {
    const totals = computeLineTotals(items);
    const invoice = unwrap(
      await supabase
        .from('invoices')
        .insert({
          ...payload,
          // organization_id est toujours écrasé par le trigger
          // set_invoice_defaults (dérivé du projet) — valeur ignorée.
          organization_id: '',
          subtotal: totals.subtotal,
          vat_amount: totals.vatAmount,
          total: totals.total,
        })
        .select('*')
        .single()
    );

    let insertedItems: InvoiceItem[] = [];
    if (items.length > 0) {
      insertedItems = unwrap(
        await supabase
          .from('invoice_items')
          .insert(
            items.map((item, index) => ({
              ...item,
              invoice_id: invoice.id,
              position: item.position ?? index,
              line_total: item.quantity * item.unit_price,
            }))
          )
          .select('*')
      );
    }

    await activityLogsService.log({
      project_id: invoice.project_id,
      action: 'invoice.created',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: { number: invoice.number, title: invoice.title, total: invoice.total },
    });

    return { ...invoice, items: insertedItems, payments: [] };
  },

  /** Remplace l'en-tête et les lignes d'une facture brouillon. */
  async update(
    invoiceId: string,
    payload: Partial<
      Pick<Invoice, 'title' | 'client_id' | 'issue_date' | 'due_date' | 'operation_category' | 'notes' | 'currency'>
    >,
    items: InvoiceItemInput[]
  ): Promise<InvoiceWithItems> {
    const totals = computeLineTotals(items);
    const invoice = unwrap(
      await supabase
        .from('invoices')
        .update({ ...payload, subtotal: totals.subtotal, vat_amount: totals.vatAmount, total: totals.total })
        .eq('id', invoiceId)
        .select('*')
        .single()
    );

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    let insertedItems: InvoiceItem[] = [];
    if (items.length > 0) {
      insertedItems = unwrap(
        await supabase
          .from('invoice_items')
          .insert(
            items.map((item, index) => ({
              ...item,
              invoice_id: invoiceId,
              position: item.position ?? index,
              line_total: item.quantity * item.unit_price,
            }))
          )
          .select('*')
      );
    }

    const payments = unwrap(await supabase.from('invoice_payments').select('*').eq('invoice_id', invoiceId));
    return { ...invoice, items: insertedItems, payments };
  },

  async send(invoiceId: string): Promise<Invoice> {
    const invoice = unwrap(
      await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId).select('*').single()
    );
    await activityLogsService.log({
      project_id: invoice.project_id,
      action: 'invoice.sent',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: { number: invoice.number },
    });
    return invoice;
  },

  /**
   * Enregistre un paiement. Le trigger `recompute_invoice_payment_status`
   * recalcule ensuite `amount_paid` et le statut (paid/partially_paid/
   * overdue) côté base — ne jamais écrire ces colonnes manuellement.
   */
  async addPayment(
    invoiceId: string,
    payment: Pick<InvoicePayment, 'amount' | 'paid_at' | 'method' | 'notes'>
  ): Promise<InvoicePayment> {
    const inserted = unwrap(
      await supabase
        .from('invoice_payments')
        .insert({ ...payment, invoice_id: invoiceId })
        .select('*')
        .single()
    );
    await activityLogsService.log({
      project_id: (unwrap(await supabase.from('invoices').select('project_id').eq('id', invoiceId).single()))
        .project_id,
      action: 'invoice.payment_recorded',
      entity_type: 'invoice',
      entity_id: invoiceId,
      metadata: { amount: payment.amount },
    });
    return inserted;
  },

  async removePayment(paymentId: string): Promise<void> {
    const { error } = await supabase.from('invoice_payments').delete().eq('id', paymentId);
    if (error) throw error;
  },

  async cancel(invoiceId: string): Promise<Invoice> {
    return unwrap(await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', invoiceId).select('*').single());
  },

  /**
   * Génère le PDF Factur-X (visuel + XML CII embarqué) de la facture, le
   * dépose sur le bucket `invoices` (chemin déterministe
   * `<project_id>/factures/<invoice_id>.pdf`, écrasé à chaque régénération)
   * et met à jour `facturx_storage_path`. Ne transmet rien à une PDP — cf.
   * commentaire de portée dans facturX.service.ts.
   */
  async generateFacturX(invoiceId: string): Promise<{ path: string; signedUrl: string }> {
    const invoice = unwrap(await supabase.from('invoices').select('*').eq('id', invoiceId).single());
    const items = unwrap(
      await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('position', { ascending: true })
    );
    const [project, organization, client] = await Promise.all([
      projectsService.getById(invoice.project_id),
      organizationsService.getById(invoice.organization_id),
      invoice.client_id ? clientsService.getById(invoice.client_id) : Promise.resolve(null),
    ]);

    const { buildFacturXPdf, facturXPdfToFile } = await import('./facturX.service');
    const pdfBytes = await buildFacturXPdf({ invoice, items, organization, client, project });
    const file = facturXPdfToFile(pdfBytes, `facture-${invoice.number ?? invoice.id}.pdf`);

    const path = `${invoice.project_id}/factures/${invoice.id}.pdf`;
    // Une régénération doit remplacer le fichier précédent (chemin déterministe).
    await storageService.remove('invoices', path).catch(() => {});
    await storageService.upload('invoices', path, file);

    await supabase.from('invoices').update({ facturx_storage_path: path }).eq('id', invoiceId);

    await activityLogsService.log({
      project_id: invoice.project_id,
      action: 'invoice.facturx_generated',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: { number: invoice.number },
    });

    const signedUrl = await storageService.getSignedUrl('invoices', path);
    return { path, signedUrl };
  },

  async remove(invoiceId: string): Promise<void> {
    const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
    if (error) throw error;
  },
};
