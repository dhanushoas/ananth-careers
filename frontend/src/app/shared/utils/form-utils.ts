import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { AppError } from '../../core/models';

/** Contract password policy: 8–128 chars, at least one letter and one digit. */
export const passwordPolicyValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string | null;
  if (!value) {
    return null;
  }
  if (value.length < 8 || value.length > 128) {
    return { passwordLength: true };
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return { passwordComplexity: true };
  }
  return null;
};

/** Indian/international mobile: optional +, 10–15 digits, spaces/dashes allowed. */
export const mobileValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value as string | null)?.trim();
  if (!value) {
    return null;
  }
  const digits = value.replace(/[\s-]/g, '');
  return /^\+?\d{10,15}$/.test(digits) ? null : { mobile: true };
};

/** Optional http(s) URL. */
export const urlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value as string | null)?.trim();
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { url: true };
  } catch {
    return { url: true };
  }
};

/** Group-level validator: `field` must equal `matchField`. Error is set on the confirm control. */
export function matchFieldsValidator(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field);
    const b = group.get(confirmField);
    if (!a || !b) {
      return null;
    }
    const mismatch = !!b.value && a.value !== b.value;
    const errors = { ...(b.errors ?? {}) };
    if (mismatch) {
      errors['mismatch'] = true;
    } else {
      delete errors['mismatch'];
    }
    b.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
    return mismatch ? { mismatch: true } : null;
  };
}

/** Group-level validator ensuring numeric `min` <= `max`. */
export function minMaxValidator(minField: string, maxField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const min = group.get(minField)?.value as number | null | undefined;
    const max = group.get(maxField)?.value as number | null | undefined;
    if (min === null || min === undefined || max === null || max === undefined || (min as unknown) === '' || (max as unknown) === '') {
      return null;
    }
    return Number(min) > Number(max) ? { minGreaterThanMax: true } : null;
  };
}

/** Maps server-side `details[]` onto matching form controls as `{ server: message }`. Returns unmatched messages. */
export function applyServerErrors(form: FormGroup, error: AppError): string[] {
  const unmatched: string[] = [];
  for (const detail of error.details) {
    const control = detail.field ? form.get(detail.field) : null;
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: detail.message });
      control.markAsTouched();
    } else {
      unmatched.push(detail.message);
    }
  }
  return unmatched;
}

/** Splits a multi-line textarea into a trimmed list (one item per line). */
export function linesToList(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/** Splits comma-separated text into a trimmed list. */
export function csvToList(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Returns undefined for empty strings so optional fields are omitted from request bodies. */
export function emptyToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Converts an ISO date to the yyyy-MM-dd format used by <input type="date">. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Converts an ISO date to the yyyy-MM-ddTHH:mm format used by <input type="datetime-local">. */
export function toDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${toDateInput(value)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
