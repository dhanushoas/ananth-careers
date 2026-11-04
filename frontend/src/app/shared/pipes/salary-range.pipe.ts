import { Pipe, PipeTransform } from '@angular/core';
import { Salary } from '../../core/models';

/** Compact Indian-style amount: 450000 → "4.5 L", 12000000 → "1.2 Cr", 45000 → "45K". */
export function formatInrCompact(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, ''));
  if (abs >= 1_00_00_000) {
    return `${trim(value / 1_00_00_000)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${trim(value / 1_00_000)} L`;
  }
  if (abs >= 1_000) {
    return `${trim(value / 1_000)}K`;
  }
  return String(value);
}

/**
 * Formats a job salary: "₹4.5 L – 8 L / year", "From ₹30K / month", "Not disclosed".
 */
@Pipe({ name: 'salaryRange' })
export class SalaryRangePipe implements PipeTransform {
  transform(salary: Salary | null | undefined): string {
    if (!salary || !salary.disclosed) {
      return 'Not disclosed';
    }
    const min = typeof salary.min === 'number' && salary.min > 0 ? salary.min : null;
    const max = typeof salary.max === 'number' && salary.max > 0 ? salary.max : null;
    const period = salary.period === 'monthly' ? ' / month' : ' / year';
    if (min !== null && max !== null) {
      return min === max ? `₹${formatInrCompact(min)}${period}` : `₹${formatInrCompact(min)} – ${formatInrCompact(max)}${period}`;
    }
    if (min !== null) {
      return `From ₹${formatInrCompact(min)}${period}`;
    }
    if (max !== null) {
      return `Up to ₹${formatInrCompact(max)}${period}`;
    }
    return 'Not disclosed';
  }
}
