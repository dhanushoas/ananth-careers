import type { ClientSession, HydratedDocument, Types } from 'mongoose';
import { LIMITS, PROFILE_STAGES, STAGE_LABEL, type CandidateStage } from '../common/constants';
import { Candidate, User, getSettings, type ICandidate } from '../models';
import { notify } from './activity.service';
import { queueEmail } from './email/email.service';

/**
 * Moves a candidate's overall pipeline stage, recording who/when/why.
 * `note` is shown to the candidate only when `visibleToCandidate` is true – internal notes belong in recruitment_notes.
 */
export async function setStage(
  candidate: HydratedDocument<ICandidate>,
  stage: CandidateStage,
  opts: { by?: string; note?: string; visibleToCandidate?: boolean; notifyCandidate?: boolean; session?: ClientSession } = {},
) {
  if (candidate.stage === stage) return candidate;
  candidate.stage = stage;
  candidate.stageHistory.push({ stage, note: opts.note, visibleToCandidate: opts.visibleToCandidate ?? true, changedBy: opts.by as never, at: new Date() });
  if (stage === 'under_review' || stage === 'screening') candidate.lastReviewedAt = new Date();
  await candidate.save({ session: opts.session });
  if (opts.notifyCandidate !== false && !PROFILE_STAGES.includes(stage)) {
    const user = await User.findById(candidate.user).select('name email');
    if (user) {
      const label = STAGE_LABEL[stage];
      await notify(user._id, { type: 'candidate.stage', title: `Recruitment status: ${label}`, message: opts.visibleToCandidate === false || !opts.note ? `Your recruitment status is now "${label}".` : `${label}: ${opts.note}`, link: '/candidate/applications' });
      const settings = await getSettings();
      if (settings.notifications.emailCandidatesOnStageChange) {
        await queueEmail(user.email, 'stageUpdate', { name: user.name, stage: label, note: opts.visibleToCandidate === false ? undefined : opts.note });
      }
    }
  }
  return candidate;
}

/** Keeps the first three stages in sync with profile completeness (never overrides recruiter-driven stages). */
export async function syncProfileStage(candidate: HydratedDocument<ICandidate>) {
  if (!PROFILE_STAGES.includes(candidate.stage)) return candidate;
  const complete = candidate.profileCompletion >= LIMITS.profileCompleteThreshold && Boolean(candidate.primaryResume);
  const next: CandidateStage = complete ? 'profile_completed' : 'profile_incomplete';
  return setStage(candidate, next, { note: complete ? 'Profile completed – ready for Veejee Services review' : undefined, notifyCandidate: false });
}

export async function candidateByUser(userId: Types.ObjectId | string) {
  return Candidate.findOne({ user: userId });
}

/** Only move forward through the company stages, except for explicit outcomes. */
const ORDER: CandidateStage[] = [
  'registered',
  'profile_incomplete',
  'profile_completed',
  'under_review',
  'screening',
  'shortlisted',
  'submitted',
  'company_reviewing',
  'interview_requested',
  'interview_scheduled',
  'interview_completed',
  'selected',
  'placed',
];
export function isAdvance(from: CandidateStage, to: CandidateStage) {
  if (['rejected', 'on_hold', 'placed', 'selected'].includes(to)) return true;
  const a = ORDER.indexOf(from);
  const b = ORDER.indexOf(to);
  return a === -1 || b > a;
}
