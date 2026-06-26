import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import { computeLineTotals } from '@/types/domain';
import type { Quote, QuoteItem, QuoteWithItems } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export type QuoteItemInput = Pick<QuoteItem, 'description' | 'quantity' | 'unit' | 'unit_price' | 'vat_rate'> & {
  position?: number;
  lot?: string | null;
};

export const quotesService = {
  async list(projectId: string): Promise<Quote[]> {
    return unwrap(
      await supabase.from('quotes').select('*').eq('project_id', projectId).order('number', { ascending: false })
    );
  },

  async getWithItems(quoteId: string): Promise<QuoteWithItems> {
    const quote = unwrap(await supabase.from('quotes').select('*').eq('id', quoteId).single());
    const items = unwrap(
      await supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('position', { ascending: true })
    );
    return { ...quote, items };
  },

  /**
   * Crée un devis avec ses lignes en une seule opération : les totaux
   * (subtotal/vat_amount/total) sont calculés côté client à partir des
   * lignes (pas de trigger SQL de recalcul) puis écrits sur l'en-tête. Le
   * numéro est assigné par le trigger `assign_quote_number` (jamais fourni
   * par le client).
   */
  async create(
    payload: Omit<TablesInsert<'quotes'>, 'organization_id' | 'subtotal' | 'vat_amount' | 'total' | 'number'>,
    items: QuoteItemInput[]
  ): Promise<QuoteWithItems> {
    const totals = computeLineTotals(items);
    const quote = unwrap(
      await supabase
        .from('quotes')
        .insert({
          ...payload,
          // organization_id est toujours écrasé par le trigger
          // set_quote_organization (dérivé du projet) — valeur ignorée.
          organization_id: '',
          subtotal: totals.subtotal,
          vat_amount: totals.vatAmount,
          total: totals.total,
        })
        .select('*')
        .single()
    );

    let insertedItems: QuoteItem[] = [];
    if (items.length > 0) {
      insertedItems = unwrap(
        await supabase
          .from('quote_items')
          .insert(
            items.map((item, index) => ({
              ...item,
              quote_id: quote.id,
              position: item.position ?? index,
              line_total: item.quantity * item.unit_price,
            }))
          )
          .select('*')
      );
    }

    await activityLogsService.log({
      project_id: quote.project_id,
      action: 'quote.created',
      entity_type: 'quote',
      entity_id: quote.id,
      metadata: { number: quote.number, title: quote.title, total: quote.total },
    });

    return { ...quote, items: insertedItems };
  },

  /**
   * Remplace l'en-tête et les lignes d'un devis brouillon. Les lignes sont
   * supprimées puis réinsérées plutôt que diffées ligne à ligne : plus
   * simple et largement suffisant pour le volume de lignes d'un devis BTP.
   */
  async update(
    quoteId: string,
    payload: Partial<Pick<Quote, 'title' | 'client_id' | 'issue_date' | 'validity_until' | 'notes' | 'currency'>>,
    items: QuoteItemInput[]
  ): Promise<QuoteWithItems> {
    const totals = computeLineTotals(items);
    const quote = unwrap(
      await supabase
        .from('quotes')
        .update({ ...payload, subtotal: totals.subtotal, vat_amount: totals.vatAmount, total: totals.total })
        .eq('id', quoteId)
        .select('*')
        .single()
    );

    await supabase.from('quote_items').delete().eq('quote_id', quoteId);
    let insertedItems: QuoteItem[] = [];
    if (items.length > 0) {
      insertedItems = unwrap(
        await supabase
          .from('quote_items')
          .insert(
            items.map((item, index) => ({
              ...item,
              quote_id: quoteId,
              position: item.position ?? index,
              line_total: item.quantity * item.unit_price,
            }))
          )
          .select('*')
      );
    }

    return { ...quote, items: insertedItems };
  },

  async send(quoteId: string): Promise<Quote> {
    const quote = unwrap(await supabase.from('quotes').update({ status: 'sent' }).eq('id', quoteId).select('*').single());
    await activityLogsService.log({
      project_id: quote.project_id,
      action: 'quote.sent',
      entity_type: 'quote',
      entity_id: quote.id,
      metadata: { number: quote.number },
    });
    return quote;
  },

  /**
   * Acceptation/refus côté client via la fonction RPC SECURITY DEFINER
   * decide_quote (cf. 0023_quotes_invoices.sql) : seule cette fonction peut
   * faire passer le statut à 'accepted'/'declined', les policies RLS
   * classiques ne l'autorisent pas.
   */
  async decide(quoteId: string, accept: boolean, signature?: { data: string; signerName: string }): Promise<void> {
    const { error } = await supabase.rpc('decide_quote', {
      p_quote_id: quoteId,
      p_accept: accept,
      p_signature_data: signature?.data ?? undefined,
      p_signer_name: signature?.signerName ?? undefined,
    });
    if (error) throw error;
  },

  /** Convertit un devis accepté en facture brouillon avec les mêmes lignes. */
  async convertToInvoice(quoteId: string): Promise<{ invoiceId: string }> {
    const quote = await quotesService.getWithItems(quoteId);
    if (quote.status !== 'accepted') {
      throw new Error('Seul un devis accepté peut être converti en facture');
    }

    const invoice = unwrap(
      await supabase
        .from('invoices')
        .insert({
          project_id: quote.project_id,
          // organization_id est toujours écrasé par le trigger
          // set_invoice_defaults (dérivé du projet) — valeur ignorée.
          organization_id: '',
          client_id: quote.client_id,
          quote_id: quote.id,
          title: quote.title,
          notes: quote.notes,
          currency: quote.currency,
          subtotal: quote.subtotal,
          vat_amount: quote.vat_amount,
          total: quote.total,
        })
        .select('*')
        .single()
    );

    if (quote.items.length > 0) {
      await supabase.from('invoice_items').insert(
        quote.items.map((item) => ({
          invoice_id: invoice.id,
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          line_total: item.line_total,
        }))
      );
    }

    await activityLogsService.log({
      project_id: invoice.project_id,
      action: 'invoice.created_from_quote',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: { quote_id: quote.id, number: invoice.number },
    });

    return { invoiceId: invoice.id };
  },

  async remove(quoteId: string): Promise<void> {
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) throw error;
  },
};
