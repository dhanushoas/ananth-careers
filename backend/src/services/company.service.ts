import type { HydratedDocument } from 'mongoose';
import { SUPER_ADMIN } from '../common/constants';
import { ForbiddenError, NotFoundError } from '../common/errors';
import type { AuthContext } from '../middleware/auth';
import { Employer, Recruiter, type IEmployer } from '../models';

export interface CompanyContext {
  employer: HydratedDocument<IEmployer>;
}

/** Resolves the company of an employer account. */
export async function getCompanyContext(auth: AuthContext): Promise<CompanyContext> {
  if (auth.role !== 'employer') throw new ForbiddenError();
  const employer = await Employer.findOne({ owner: auth.userId, deletedAt: null });
  if (!employer) throw new NotFoundError('Company profile');
  return { employer };
}

export function assertCompanyVerified(ctx: CompanyContext) {
  if (ctx.employer.verificationStatus !== 'verified') {
    throw new ForbiddenError('Your company must be verified by Veejee Services before requirements can be submitted for publishing', 'COMPANY_NOT_VERIFIED');
  }
}

/**
 * Veejee Services staff = active recruiters, or admins with `recruitment:manage`.
 * Only staff can screen, shortlist, submit candidates and coordinate interviews.
 */
export function isStaff(auth: AuthContext | undefined) {
  if (!auth) return false;
  if (auth.role === 'recruiter') return true;
  return auth.role === 'admin' && (auth.permissions.includes(SUPER_ADMIN) || auth.permissions.includes('recruitment:manage'));
}

export async function assertStaff(auth: AuthContext) {
  if (!isStaff(auth)) throw new ForbiddenError('Only the Veejee Services recruitment team can perform this action');
  if (auth.role === 'recruiter') {
    const r = await Recruiter.findOne({ user: auth.userId }).select('active');
    if (!r?.active) throw new ForbiddenError('Your recruiter account is inactive. Contact a Veejee Services administrator.');
  }
}
