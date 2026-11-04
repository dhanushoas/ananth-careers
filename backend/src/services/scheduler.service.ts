import { env } from '../config/env';
import { LIMITS } from '../common/constants';
import { logger } from '../common/logger';
import { Candidate, Employer, Interview, Job, User, getSettings } from '../models';
import { notify } from './activity.service';
import { queueEmail } from './email/email.service';

/**
 * Sends interview reminders a configurable number of hours before each interview.
 * Idempotent: `reminderSentAt` is claimed atomically so multiple instances never double-send.
 */
export async function sendInterviewReminders(now = new Date()) {
  const settings = await getSettings();
  if (!settings.reminders.interview) return 0;
  const horizon = new Date(now.getTime() + settings.reminders.interviewHoursBefore * 3600_000);
  let sent = 0;
  for (;;) {
    const iv = await Interview.findOneAndUpdate(
      { status: { $in: ['scheduled', 'rescheduled'] }, scheduledAt: { $gt: now, $lte: horizon }, reminderSentAt: null },
      { reminderSentAt: now },
      { new: true },
    );
    if (!iv) break;
    const [user, job, employer] = await Promise.all([User.findById(iv.candidate).select('name email'), Job.findById(iv.job).select('title'), Employer.findById(iv.employer).select('companyName')]);
    if (user && job && employer) {
      await queueEmail(user.email, 'interviewReminder', {
        name: user.name,
        jobTitle: job.title,
        companyName: employer.companyName,
        scheduledAt: iv.scheduledAt,
        mode: iv.mode,
        where: iv.mode === 'video' ? iv.meetingLink : iv.location,
      });
      await notify(user._id, { type: 'interview.reminder', title: 'Interview reminder', message: `${employer.companyName} – ${job.title}`, link: '/candidate/interviews' });
      sent++;
    }
  }
  return sent;
}

/** Nudges candidates with incomplete profiles, at most once per configured interval. */
export async function sendProfileReminders(now = new Date()) {
  const settings = await getSettings();
  if (!settings.reminders.profileCompletion) return 0;
  const intervalMs = settings.reminders.profileReminderDays * 86400_000;
  const due = await Candidate.find({
    stage: { $in: ['registered', 'profile_incomplete'] },
    profileCompletion: { $lt: LIMITS.profileCompleteThreshold },
    createdAt: { $lte: new Date(now.getTime() - 2 * 86400_000) },
    $or: [{ profileReminderSentAt: null }, { profileReminderSentAt: { $lte: new Date(now.getTime() - intervalMs) } }],
  })
    .limit(200)
    .select('user profileCompletion');
  let sent = 0;
  for (const c of due) {
    const claimed = await Candidate.updateOne({ _id: c._id, $or: [{ profileReminderSentAt: null }, { profileReminderSentAt: { $lte: new Date(now.getTime() - intervalMs) } }] }, { profileReminderSentAt: now });
    if (!claimed.modifiedCount) continue;
    const user = await User.findOne({ _id: c.user, status: 'active', deletedAt: null, emailVerified: true }).select('name email');
    if (!user) continue;
    await queueEmail(user.email, 'profileReminder', { name: user.name, completion: c.profileCompletion });
    sent++;
  }
  return sent;
}

let timer: NodeJS.Timeout | undefined;
let running = false;
export function startScheduler(intervalMs = 15 * 60_000) {
  if (timer || env.isTest) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const [iv, pr] = [await sendInterviewReminders(), await sendProfileReminders()];
      if (iv || pr) logger.info({ interviewReminders: iv, profileReminders: pr }, 'Scheduled reminders queued');
    } catch (err) {
      logger.error({ err }, 'Scheduler iteration failed');
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, intervalMs);
  timer.unref();
  setTimeout(tick, 30_000).unref();
}
export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
