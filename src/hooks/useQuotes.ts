import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quotesService, type QuoteItemInput } from '@/services/quotes.service';
import type { TablesInsert } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useQuotes(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['quotes', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => quotesService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('quotes', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: ({
      payload,
      items,
    }: {
      payload: Omit<
        TablesInsert<'quotes'>,
        'project_id' | 'organization_id' | 'subtotal' | 'vat_amount' | 'total' | 'number'
      >;
      items: QuoteItemInput[];
    }) => quotesService.create({ ...payload, project_id: projectId! }, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const send = useMutation({
    mutationFn: (quoteId: string) => quotesService.send(quoteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const decide = useMutation({
    mutationFn: ({
      quoteId,
      accept,
      signature,
    }: {
      quoteId: string;
      accept: boolean;
      signature?: { data: string; signerName: string };
    }) => quotesService.decide(quoteId, accept, signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['signatures', projectId] });
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: (quoteId: string) => quotesService.convertToInvoice(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['invoices', projectId] });
    },
  });

  const remove = useMutation({
    mutationFn: (quoteId: string) => quotesService.remove(quoteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, quotes: query.data ?? [], create, send, decide, convertToInvoice, remove };
}

export function useQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => quotesService.getWithItems(quoteId!),
    enabled: Boolean(quoteId),
  });
}

export function useUpdateQuote(quoteId: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      items,
    }: {
      payload: Parameters<typeof quotesService.update>[1];
      items: QuoteItemInput[];
    }) => quotesService.update(quoteId!, payload, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', projectId] });
    },
  });
}
