import type { Quote } from '@/types/domain';

export const STATUS_TONE: Record<Quote['status'], 'slate' | 'blue' | 'green' | 'red' | 'yellow'> = {
  draft: 'slate',
  sent: 'blue',
  accepted: 'green',
  declined: 'red',
  expired: 'yellow',
};

export interface QuoteFormState {
  title: string;
  client_id: string;
  issue_date: string;
  validity_until: string;
  notes: string;
}
