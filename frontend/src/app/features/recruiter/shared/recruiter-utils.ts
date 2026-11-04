import { Ref } from '../../../core/models';

/** Name of a populated ref, or a fallback when the API returned only an id. */
export function refName(ref: Ref<{ name?: string; companyName?: string }> | null | undefined, fallback = '—'): string {
  if (!ref || typeof ref === 'string') {
    return fallback;
  }
  return ref.name ?? ref.companyName ?? fallback;
}

/** Id of a populated or bare ref. */
export function refId(ref: Ref<{ id: string }> | null | undefined): string | null {
  if (!ref) {
    return null;
  }
  return typeof ref === 'string' ? ref : ref.id;
}

/** Narrow a ref to its populated object (or null). */
export function refObj<T extends object>(ref: Ref<T> | null | undefined): T | null {
  return ref && typeof ref === 'object' ? ref : null;
}

/** Colour band for a 0–100 match score. */
export function scoreTone(score: number): 'high' | 'mid' | 'low' {
  return score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
}

export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (value >= 1_00_000) {
    const l = value / 1_00_000;
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)} L`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
}
