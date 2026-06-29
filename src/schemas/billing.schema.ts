import { z } from 'zod';

/**
 * Schémas Zod partagés entre la validation des formulaires (devis, factures,
 * paiements) et les appels services correspondants — cf. audit du
 * 26/06/2026, section 9 ("Recommandation concrète : introduire Zod sur les
 * payloads des formulaires les plus sensibles"). Un seul schéma par concept
 * évite la duplication de règles entre UI et service.
 */

/** Ligne de devis/facture après conversion des champs texte en nombres (cf. `lineRowsToItems`). */
export const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'La description de la ligne est requise'),
  quantity: z.number().positive('La quantité doit être supérieure à zéro'),
  unit: z.string().trim().min(1, "L'unité est requise"),
  unit_price: z.number().min(0, 'Le prix unitaire ne peut pas être négatif'),
  vat_rate: z.number().min(0, 'Le taux de TVA doit être entre 0 et 100').max(100, 'Le taux de TVA doit être entre 0 et 100'),
  position: z.number().optional(),
  lot: z.string().nullable().optional(),
});

export const lineItemsSchema = z.array(lineItemSchema).min(1, 'Ajoutez au moins une ligne avec une description');

export const quoteFormSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis'),
  client_id: z.string().nullable().optional(),
  issue_date: z.string().trim().min(1, "La date d'émission est requise"),
  validity_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const invoiceFormSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis'),
  client_id: z.string().nullable().optional(),
  issue_date: z.string().trim().min(1, "La date d'émission est requise"),
  due_date: z.string().nullable().optional(),
  operation_category: z.string().trim().min(1, "La catégorie d'opération est requise"),
  notes: z.string().nullable().optional(),
});

export const paymentFormSchema = z.object({
  amount: z.number().positive('Le montant doit être supérieur à zéro'),
  paid_at: z.string().trim().min(1, 'La date de paiement est requise'),
  method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Valide `data` avec `schema` et retourne soit la donnée parsée, soit un
 * message d'erreur français exploitable directement par `<ErrorMessage />`
 * (premier problème rencontré, plus lisible qu'un dump de `ZodError`).
 */
export function validateOrError<T>(schema: z.ZodType<T>, data: unknown): { data: T; error: null } | { data: null; error: Error } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data, error: null };
  }
  const firstIssue = result.error.issues[0];
  return { data: null, error: new Error(firstIssue?.message ?? 'Données invalides.') };
}
