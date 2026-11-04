import { CandidateProfile, CandidateStage, PersonRef, Ref, STAGE_LABELS } from '../../../core/models';
import { formatInrCompact } from '../../../shared/pipes/salary-range.pipe';

/** Id of a reference that may be populated or a bare id. */
export function refId(ref: string | { id?: string } | null | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : (ref.id ?? '');
}

/** Display name of a person reference (populated or not). */
export function refName(ref: Ref<PersonRef> | null | undefined, fallback = '—'): string {
  if (!ref || typeof ref === 'string') return fallback;
  return ref.name || fallback;
}

export function candidateUser(c: Pick<CandidateProfile, 'user'> | null | undefined): PersonRef | null {
  const u = c?.user;
  return u && typeof u !== 'string' ? u : null;
}

export function candidateName(c: Pick<CandidateProfile, 'user'> | null | undefined): string {
  return candidateUser(c)?.name ?? 'Candidate';
}

export function stageLabel(stage: string | null | undefined): string {
  return stage ? (STAGE_LABELS[stage as CandidateStage] ?? stage) : '';
}

export function locationText(loc: CandidateProfile['location'] | null | undefined): string {
  if (!loc) return '—';
  return [loc.city, loc.state].filter(Boolean).join(', ') || loc.country || '—';
}

export function inr(value: number | null | undefined, period?: string): string {
  if (value === null || value === undefined) return '—';
  return `₹${formatInrCompact(value)}${period === 'monthly' ? ' / mo' : ' / yr'}`;
}

export function expectedSalaryText(c: Pick<CandidateProfile, 'expectedSalary'>): string {
  const s = c.expectedSalary;
  if (!s || (s.min == null && s.max == null)) return '—';
  const p = s.period === 'monthly' ? ' / mo' : ' / yr';
  if (s.min != null && s.max != null && s.max !== s.min) return `₹${formatInrCompact(s.min)} – ${formatInrCompact(s.max)}${p}`;
  return `₹${formatInrCompact((s.min ?? s.max) as number)}${p}`;
}

export function noticeText(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  return days === 0 ? 'Immediate' : `${days} days`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** Splits a comma separated query param into trimmed values. */
export function csv(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function numParam(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
