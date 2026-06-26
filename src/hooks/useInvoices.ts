import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesService, type InvoiceItemInput } from '@/services/invoices.service';
import type { InvoicePayment } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useInvoices(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['invoices', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => invoicesService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('invoices', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: ({
      payload,
      items,
    }: {
      payload: Omit<
        TablesInsert<'invoices'>,
        'project_id' | 'organization_id' | 'subtotal' | 'vat_amount' | 'total' | 'number' | 'amount_paid'
      >;
      items: InvoiceItemInput[];
    }) => invoicesService.create({ ...payload, project_id: projectId! }, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const send = useMutation({
    mutationFn: (invoiceId: string) => invoicesService.send(invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const cancel = useMutation({
    mutationFn: (invoiceId: string) => invoicesService.cancel(invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (invoiceId: string) => invoicesService.remove(invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, invoices: query.data ?? [], create, send, cancel, remove };
}

export function useInvoice(invoiceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['invoice', invoiceId];

  const query = useQuery({
    queryKey,
    queryFn: () => invoicesService.getWithItems(invoiceId!),
    enabled: Boolean(invoiceId),
  });

  useRealtimeInvalidate(
    'invoice_payments',
    invoiceId ? { column: 'invoice_id', value: invoiceId } : null,
    queryKey
  );

  const addPayment = useMutation({
    mutationFn: (payment: Pick<InvoicePayment, 'amount' | 'paid_at' | 'method' | 'notes'>) =>
      invoicesService.addPayment(invoiceId!, payment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removePayment = useMutation({
    mutationFn: (paymentId: string) => invoicesService.removePayment(paymentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const generateFacturX = useMutation({
    mutationFn: () => invoicesService.generateFacturX(invoiceId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, addPayment, removePayment, generateFacturX };
}

export function useUpdateInvoice(invoiceId: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      items,
    }: {
      payload: Parameters<typeof invoicesService.update>[1];
      items: InvoiceItemInput[];
    }) => invoicesService.update(invoiceId!, payload, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', projectId] });
    },
  });
}
