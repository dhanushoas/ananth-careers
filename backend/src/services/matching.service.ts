import type { ICandidate, IJob, IMatchBreakdown, IPlatformSettings } from '../models';

type Weights = IPlatformSettings['matchingWeights'];
type Factor = IMatchBreakdown['factors'][number];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();
const fmtINR = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} L` : `₹${n.toLocaleString('en-IN')}`);
const yearly = (amount: number | undefined, period: string | undefined) => (amount === undefined ? undefined : period === 'monthly' ? amount * 12 : amount);

function skillsFactor(job: IJob, c: ICandidate): Omit<Factor, 'weight' | 'key' | 'label'> {
  const required = job.skills.map(norm).filter(Boolean);
  if (!required.length) return { score: 1, reason: 'No specific skills required' };
  const have = c.skills.map((s) => norm(s.name));
  const matched = job.skills.filter((r) => have.some((h) => h === norm(r) || h.includes(norm(r)) || norm(r).includes(h)));
  const missing = job.skills.filter((r) => !matched.includes(r));
  const score = matched.length / required.length;
  return {
    score,
    reason: matched.length
      ? `Has ${matched.length} of ${required.length} required skills (${matched.join(', ')})${missing.length ? `; missing ${missing.join(', ')}` : ''}`
      : `None of the required skills listed (${job.skills.join(', ')})`,
  };
}

function experienceFactor(job: IJob, c: ICandidate) {
  const { min, max } = job.experience;
  const yrs = c.totalExperienceYears ?? 0;
  if (yrs >= min && (max === 0 && min === 0 ? yrs <= 1 : yrs <= Math.max(max, min))) return { score: 1, reason: `${yrs} yrs fits the ${min}–${max} yrs range` };
  if (yrs < min) {
    const score = Math.max(0, 1 - (min - yrs) / Math.max(min, 1));
    return { score, reason: `${yrs} yrs is below the ${min} yrs minimum` };
  }
  return { score: 0.75, reason: `${yrs} yrs exceeds the ${max} yrs maximum (may be over-qualified)` };
}

function educationFactor(job: IJob, c: ICandidate) {
  const required = job.qualifications.map(norm).filter(Boolean);
  if (!required.length) return { score: 1, reason: 'No specific qualification required' };
  const have = c.education.flatMap((e) => [norm(e.qualification), norm(e.specialization ?? '')]).filter(Boolean);
  if (!have.length) return { score: 0, reason: 'No education details in profile' };
  const tokens = (s: string) => s.split(' ').filter((t) => t.length > 1);
  const hit = job.qualifications.find((q) => {
    const qt = tokens(norm(q));
    return have.some((h) => h.includes(norm(q)) || norm(q).includes(h) || qt.some((t) => tokens(h).includes(t)));
  });
  return hit
    ? { score: 1, reason: `Qualification matches "${hit}"` }
    : { score: 0.3, reason: `Qualifications (${c.education.map((e) => e.qualification).join(', ')}) differ from required (${job.qualifications.join(', ')})` };
}

function locationFactor(job: IJob, c: ICandidate) {
  if (job.workMode === 'remote') return { score: 1, reason: 'Remote role – location independent' };
  const cities = job.locations.map((l) => norm(l.city));
  const states = job.locations.map((l) => norm(l.state ?? '')).filter(Boolean);
  const prefs = c.preferredLocations.map(norm);
  if (prefs.some((p) => p === 'anywhere' || p === 'any')) return { score: 1, reason: 'Open to any location' };
  const home = norm(c.location?.city ?? '');
  const match = job.locations.find((l) => prefs.includes(norm(l.city)) || home === norm(l.city));
  if (match) return { score: 1, reason: `Prefers or lives in ${match.city}` };
  if (states.length && (states.includes(norm(c.location?.state ?? '')) || prefs.some((p) => states.includes(p))))
    return { score: 0.6, reason: 'Same state as the job location' };
  if (job.workMode === 'hybrid' && c.preferredWorkModes.includes('remote')) return { score: 0.3, reason: 'Prefers remote; role is hybrid' };
  return { score: 0, reason: `Location preference (${c.preferredLocations.join(', ') || c.location?.city || 'not set'}) does not include ${cities.join(', ')}` };
}

function salaryFactor(job: IJob, c: ICandidate) {
  const budget = yearly(job.salary.max ?? job.salary.min, job.salary.period);
  const expected = yearly(c.expectedSalary?.min, c.expectedSalary?.period);
  if (budget === undefined || !job.salary.disclosed) return { score: 0.7, reason: 'Salary budget not disclosed' };
  if (expected === undefined) return { score: 0.7, reason: 'Candidate has not set an expected salary' };
  if (expected <= budget) return { score: 1, reason: `Expects ${fmtINR(expected)}/yr, within budget of ${fmtINR(budget)}` };
  const gap = (expected - budget) / budget;
  return { score: Math.max(0, 1 - gap * 2), reason: `Expects ${fmtINR(expected)}/yr, ${Math.round(gap * 100)}% above budget of ${fmtINR(budget)}` };
}

function noticeFactor(job: IJob, c: ICandidate) {
  const notice = c.availability === 'immediate' ? 0 : c.noticePeriodDays;
  if (job.noticePeriodMaxDays === undefined || job.noticePeriodMaxDays === null) return { score: 1, reason: 'No notice-period limit' };
  if (notice === undefined || notice === null) return { score: 0.7, reason: 'Notice period not provided' };
  if (notice <= job.noticePeriodMaxDays) return { score: 1, reason: `${notice}-day notice fits the ${job.noticePeriodMaxDays}-day limit` };
  return { score: Math.max(0, 1 - (notice - job.noticePeriodMaxDays) / 60), reason: `${notice}-day notice exceeds the ${job.noticePeriodMaxDays}-day limit` };
}

const FACTORS: { key: keyof Weights; label: string; fn: (j: IJob, c: ICandidate) => { score: number; reason: string } }[] = [
  { key: 'skills', label: 'Skills', fn: skillsFactor },
  { key: 'experience', label: 'Experience', fn: experienceFactor },
  { key: 'education', label: 'Education', fn: educationFactor },
  { key: 'location', label: 'Location', fn: locationFactor },
  { key: 'salary', label: 'Salary', fn: salaryFactor },
  { key: 'noticePeriod', label: 'Notice period', fn: noticeFactor },
];

/**
 * Transparent, configurable match score. It only RANKS candidates for recruiter review –
 * it never rejects anyone or makes hiring decisions.
 */
export function scoreCandidate(job: IJob, candidate: ICandidate, weights: Weights): IMatchBreakdown {
  const totalWeight = FACTORS.reduce((a, f) => a + (weights[f.key] ?? 0), 0) || 1;
  const factors = FACTORS.map((f) => {
    const r = f.fn(job, candidate);
    return { key: f.key, label: f.label, weight: weights[f.key] ?? 0, score: Math.round(r.score * 100) / 100, reason: r.reason };
  });
  const score = Math.round((factors.reduce((a, f) => a + f.weight * f.score, 0) / totalWeight) * 100);
  return { score, factors };
}
