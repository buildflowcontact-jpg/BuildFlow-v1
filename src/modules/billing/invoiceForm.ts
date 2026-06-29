import type { Invoice } from '@/types/domain';

export const STATUS_TONE: Record<Invoice['status'], 'slate' | 'blue' | 'green' | 'red' | 'yellow' | 'purple'> = {
  draft: 'slate',
  sent: 'blue',
  partially_paid: 'purple',
  paid: 'green',
  overdue: 'red',
  cancelled: 'slate',
};

export interface InvoiceFormState {
  title: string;
  client_id: string;
  issue_date: string;
  due_date: string;
  operation_category: Invoice['operation_category'];
  notes: string;
}
