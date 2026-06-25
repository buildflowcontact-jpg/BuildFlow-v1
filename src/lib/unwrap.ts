import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js';

export class SupabaseQueryError extends Error {
  cause?: PostgrestError;
  constructor(message: string, cause?: PostgrestError) {
    super(message);
    this.name = 'SupabaseQueryError';
    this.cause = cause;
  }
}

/**
 * Unwrap a Supabase response of shape { data, error }, throwing a typed
 * error when the query failed. Keeps services free of repetitive checks.
 *
 * The parameter is typed using Supabase's own `PostgrestSingleResponse<T>`
 * union (rather than a hand-rolled equivalent) because TypeScript's generic
 * inference over a union argument only narrows `T` correctly when the
 * parameter type is the exact aliased union Supabase exports. A structurally
 * equivalent inline union causes `T` to widen to `T | null`, defeating the
 * null-check below.
 */
export function unwrap<T>(result: PostgrestSingleResponse<T>): T {
  if (result.error) {
    throw new SupabaseQueryError(result.error.message, result.error);
  }
  if (result.data === null) {
    throw new SupabaseQueryError('Aucune donnée retournée par Supabase');
  }
  return result.data;
}

export function unwrapMaybe<T>(result: PostgrestSingleResponse<T | null>): T | null {
  if (result.error) {
    throw new SupabaseQueryError(result.error.message, result.error);
  }
  return result.data;
}
