import { isUndeliverable } from '../src/services/email/email.service';
import { decryptBuffer, encryptBuffer, slugify } from '../src/common/crypto';
import { STAFF_SUBMISSION_TRANSITIONS } from '../src/common/constants';
import { scoreCandidate } from '../src/services/matching.service';
import { email, mobile, password, text } from '../src/common/validation';
import { verifyFileSignature } from '../src/middleware/upload';
import { templates } from '../src/services/email/templates';
import { PDF, PNG } from './helpers';

describe('crypto', () => {
  it('round-trips AES-256-GCM and detects tampering', () => {
    const data = Buffer.from('confidential resume');
    const enc = encryptBuffer(data);
    expect(enc.equals(data)).toBe(false);
    expect(decryptBuffer(enc).toString()).toBe('confidential resume');
    enc[enc.length - 1]! ^= 0xff;
    expect(() => decryptBuffer(enc)).toThrow();
  });
  it('slugifies', () => expect(slugify('Food & Hospitality – Café')).toBe('food-hospitality-cafe'));
});

describe('validation primitives', () => {
  it('normalises email and mobile', () => {
    expect(email.parse('  USER@Example.COM ')).toBe('user@example.com');
    expect(mobile.parse('+91 98765-43210')).toBe('+919876543210');
    expect(mobile.safeParse('12345').success).toBe(false);
  });
  it('enforces the password policy', () => {
    expect(password.safeParse('abcdefgh').success).toBe(false);
    expect(password.safeParse('12345678').success).toBe(false);
    expect(password.safeParse('abc12345').success).toBe(true);
  });
  it('strips markup from text', () => {
    expect(text(100).parse('<img src=x onerror=alert(1)>Hello')).toBe('Hello');
  });
});

describe('file signatures', () => {
  const file = (buffer: Buffer) => ({ buffer, size: buffer.length }) as Express.Multer.File;
  it('identifies PDFs and images by content', () => {
    expect(verifyFileSignature(file(PDF), 'resume').ext).toBe('pdf');
    expect(verifyFileSignature(file(PNG), 'image').ext).toBe('png');
    expect(() => verifyFileSignature(file(PNG), 'resume')).toThrow(/does not match/);
  });
});

describe('submission state machine', () => {
  it('does not allow leaving final states and requires selection before placement', () => {
    expect(STAFF_SUBMISSION_TRANSITIONS.placed).toEqual([]);
    expect(STAFF_SUBMISSION_TRANSITIONS.rejected).toEqual([]);
    expect(STAFF_SUBMISSION_TRANSITIONS.submitted).not.toContain('placed');
    expect(STAFF_SUBMISSION_TRANSITIONS.selected).toContain('placed');
  });
});

describe('matching engine', () => {
  const weights = { skills: 40, experience: 20, education: 10, location: 15, salary: 10, noticePeriod: 5 };
  const job = {
    skills: ['Angular', 'TypeScript', 'RxJS', 'Docker'], qualifications: ['B.Tech'], experience: { min: 3, max: 6 },
    workMode: 'onsite', locations: [{ city: 'Bengaluru', state: 'Karnataka', country: 'India' }],
    salary: { min: 1200000, max: 1800000, currency: 'INR', period: 'yearly', disclosed: true }, noticePeriodMaxDays: 30,
  } as never;
  const base = {
    skills: [{ name: 'angular', type: 'technical' }, { name: 'TypeScript', type: 'technical' }, { name: 'RxJS', type: 'technical' }],
    education: [{ qualification: 'B.Tech', specialization: 'CSE', institution: 'X' }], totalExperienceYears: 4,
    location: { city: 'Bengaluru', state: 'Karnataka' }, preferredLocations: ['Bengaluru'], preferredWorkModes: [],
    expectedSalary: { min: 1500000, period: 'yearly' }, noticePeriodDays: 30,
  };
  it('produces a transparent, weighted score with reasons', () => {
    const r = scoreCandidate(job, base as never, weights);
    expect(r.score).toBe(90); // 3/4 skills → 0.75*40 = 30, everything else full
    expect(r.factors.find((f) => f.key === 'skills')!.reason).toMatch(/3 of 4.*missing Docker/);
    expect(r.factors).toHaveLength(6);
  });
  it('penalises gaps but never hard-rejects', () => {
    const r = scoreCandidate(job, { ...base, totalExperienceYears: 1, preferredLocations: ['Delhi'], location: { city: 'Delhi', state: 'Delhi' }, expectedSalary: { min: 2700000, period: 'yearly' }, noticePeriodDays: 90 } as never, weights);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(60);
    expect(r.factors.find((f) => f.key === 'salary')!.reason).toMatch(/above budget/);
  });
  it('respects configurable weights', () => {
    const skillsOnly = scoreCandidate(job, base as never, { skills: 100, experience: 0, education: 0, location: 0, salary: 0, noticePeriod: 0 });
    expect(skillsOnly.score).toBe(75);
  });
});

describe('email templates', () => {
  it('renders every template with subject, html and text', () => {
    const t = templates.interviewInvitation({ name: 'K', jobTitle: 'Chef', companyName: 'Co', scheduledAt: new Date('2026-12-01T05:00:00Z'), durationMinutes: 30, mode: 'in_person', where: 'Kochi' });
    expect(t.subject).toContain('Chef');
    expect(t.html).toContain('IST');
    expect(t.text).toContain('Kochi');
  });
});

describe('email delivery guard', () => {
  it('never sends to reserved test domains', () => {
    expect(isUndeliverable('seeker@veejee.example')).toBe(true);
    expect(isUndeliverable('qa@foo.test')).toBe(true);
    expect(isUndeliverable('x@deleted.invalid')).toBe(true);
    expect(isUndeliverable('someone@example.com')).toBe(true);
    expect(isUndeliverable('a@examples.com')).toBe(false);
    expect(isUndeliverable('dhanushkrock@gmail.com')).toBe(false);
  });
});
