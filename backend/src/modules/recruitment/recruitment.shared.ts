import type { Types } from 'mongoose';
import { SUPER_ADMIN, STAGE_LABEL, type CandidateStage, type SubmissionStatus } from '../../common/constants';
import { Candidate, Employer, Recruiter, Shortlist, Submission, User } from '../../models';
import { setStage } from '../../services/pipeline.service';

/**
 * Staff who should hear about a candidate/requirement: the assigned recruiter if active,
 * otherwise every active recruiter and recruitment admin.
 */
export async function staffRecipients(preferred?: Types.ObjectId | string | null) {
  if (preferred) {
    const r = await Recruiter.findOne({ user: preferred, active: true }).select('user');
    const u = r ? await User.findOne({ _id: r.user, status: 'active', deletedAt: null }).select('name email') : null;
    if (u) return [u];
  }
  const recruiters = await Recruiter.find({ active: true }).select('user');
  return User.find({
    deletedAt: null,
    status: 'active',
    $or: [{ _id: { $in: recruiters.map((r) => r.user) } }, { role: 'admin', permissions: { $in: [SUPER_ADMIN, 'recruitment:manage'] } }],
  })
    .select('name email')
    .limit(50);
}

export async function companyOwner(employerId: Types.ObjectId | string) {
  const e = await Employer.findById(employerId).select('owner companyName');
  if (!e) return null;
  const owner = await User.findOne({ _id: e.owner, status: 'active', deletedAt: null }).select('name email');
  return owner ? { owner, companyName: e.companyName } : null;
}

const RANK: SubmissionStatus[] = ['on_hold', 'submitted', 'company_reviewing', 'interview_requested', 'interview_scheduled', 'interview_completed', 'selected', 'placed'];

/**
 * Derives a candidate's overall pipeline stage from all their shortlists and submissions,
 * so that one company's rejection does not hide progress with another company.
 */
export async function recomputeStage(candidateUserId: Types.ObjectId | string, opts: { by?: string; note?: string; visibleToCandidate?: boolean } = {}) {
  const candidate = await Candidate.findOne({ user: candidateUserId });
  if (!candidate) return;
  const subs = await Submission.find({ candidate: candidateUserId }).select('status');
  let next: CandidateStage | undefined;
  const statuses = subs.map((s) => s.status);
  if (statuses.includes('placed')) next = 'placed';
  else {
    const open = statuses.filter((s) => RANK.includes(s) && s !== 'placed');
    if (open.length) next = RANK[Math.max(...open.map((s) => RANK.indexOf(s)))] as CandidateStage;
    else if (await Shortlist.exists({ candidate: candidateUserId, status: { $in: ['pending_approval', 'approved'] } })) next = 'shortlisted';
    else if (statuses.includes('rejected')) next = 'rejected';
  }
  if (next && next !== candidate.stage) {
    await setStage(candidate, next, { by: opts.by, note: opts.note ?? STAGE_LABEL[next], visibleToCandidate: opts.visibleToCandidate ?? true });
  }
}
