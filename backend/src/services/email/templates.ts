import { env } from '../../config/env';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Rendered = { subject: string; html: string; text: string };
type Block = { heading: string; paragraphs: string[]; cta?: { label: string; url: string }; details?: [string, string][]; footnote?: string };

function layout(subject: string, b: Block): Rendered {
  const details = b.details?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;background:#F6F8FC;border-radius:8px">${b.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 16px;color:#5B6B82;font-size:13px;width:40%">${esc(k)}</td><td style="padding:10px 16px;color:#0B1F3A;font-size:14px;font-weight:600">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const cta = b.cta
    ? `<p style="margin:28px 0"><a href="${esc(b.cta.url)}" style="background:#F7821B;color:#0B1F3A;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block">${esc(b.cta.label)}</a></p>
       <p style="font-size:12px;color:#5B6B82;word-break:break-all">If the button doesn't work, copy this link into your browser:<br>${esc(b.cta.url)}</p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#EEF1F6;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0B1F3A;padding:24px 32px"><span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:3px">Veejee Services</span><br><span style="color:#F7821B;font-size:12px;letter-spacing:1px">Your Recruitment Partner</span></td></tr>
<tr><td style="padding:32px;color:#1E2B3C;font-size:15px;line-height:1.6">
<h1 style="font-size:20px;color:#0B1F3A;margin:0 0 16px">${esc(b.heading)}</h1>
${b.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('')}
${details}${cta}
${b.footnote ? `<p style="font-size:12px;color:#5B6B82;margin-top:24px">${esc(b.footnote)}</p>` : ''}
</td></tr>
<tr><td style="background:#F6F8FC;padding:20px 32px;font-size:12px;color:#5B6B82">Veejee Services – Your Recruitment Partner · This is an automated message, please do not reply.<br>Manage your email preferences in your account settings.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    b.heading,
    '',
    ...b.paragraphs,
    ...(b.details ?? []).map(([k, v]) => `${k}: ${v}`),
    b.cta ? `\n${b.cta.label}: ${b.cta.url}` : '',
    b.footnote ?? '',
    '\n— Veejee Services – Your Recruitment Partner',
  ].join('\n');
  return { subject, html, text };
}

const link = (p: string) => `${env.FRONTEND_URL}${p}`;
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(d) + ' IST';

export const templates = {
  verifyEmail: (d: { name: string; token: string }) =>
    layout('Verify your Veejee Services account', {
      heading: `Welcome to Veejee Services, ${d.name}!`,
      paragraphs: ['Thank you for registering. Please confirm your email address to activate your account.'],
      cta: { label: 'Verify email address', url: link(`/auth/verify-email?token=${encodeURIComponent(d.token)}`) },
      footnote: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    }),
  registrationConfirmed: (d: { name: string; role: string }) =>
    layout('Your Veejee Services account is active', {
      heading: `You're all set, ${d.name}`,
      paragraphs: [
        'Your email address has been verified and your account is now active.',
        d.role === 'employer'
          ? 'Our team will verify your company details shortly. Once verified, your job postings can be reviewed and published.'
          : 'Complete your profile and upload your resume to start applying for jobs.',
      ],
      cta: { label: 'Sign in to Veejee Services', url: link('/auth/login') },
    }),
  passwordReset: (d: { name: string; token: string }) =>
    layout('Reset your Veejee Services password', {
      heading: 'Password reset request',
      paragraphs: [`Hi ${d.name}, we received a request to reset your password.`],
      cta: { label: 'Reset password', url: link(`/auth/reset-password?token=${encodeURIComponent(d.token)}`) },
      footnote: 'This link expires in 30 minutes. If you did not request this, your account is safe and no action is needed.',
    }),
  passwordChanged: (d: { name: string }) =>
    layout('Your Veejee Services password was changed', {
      heading: 'Password changed',
      paragraphs: [`Hi ${d.name}, your password was changed and all other sessions were signed out.`, 'If this wasn’t you, reset your password immediately and contact support.'],
    }),
  staffInvite: (d: { name: string; token: string; designation?: string }) =>
    layout('Welcome to the Veejee Services recruitment team', {
      heading: `Welcome to Veejee Services, ${d.name}`,
      paragraphs: [`You have been added to the Veejee Services recruitment team${d.designation ? ` as ${d.designation}` : ''}.`, 'Set your password to access the recruiter portal.'],
      cta: { label: 'Set password', url: link(`/auth/accept-invite?token=${encodeURIComponent(d.token)}`) },
      footnote: 'This invitation expires in 7 days.',
    }),
  applicationConfirmation: (d: { name: string; jobTitle: string; companyName: string }) =>
    layout(`Application received: ${d.jobTitle}`, {
      heading: 'Your application has been submitted',
      paragraphs: [`Hi ${d.name}, your application for ${d.jobTitle} has been received by Veejee Services.`, 'Our recruitment team will review your profile against the company requirements. If you are shortlisted, we will contact you before sharing your profile with the company.'],
      cta: { label: 'Track my applications', url: link('/candidate/applications') },
    }),
  newApplication: (d: { name: string; jobTitle: string; companyName: string; candidateName: string; candidateId: string }) =>
    layout(`New application: ${d.jobTitle}`, {
      heading: 'A candidate applied – review required',
      paragraphs: [`Hi ${d.name}, ${d.candidateName} applied for ${d.jobTitle} (${d.companyName}).`, 'Screen the profile and shortlist if suitable.'],
      cta: { label: 'Review candidate', url: link(`/recruiter/candidates/${d.candidateId}`) },
    }),
  applicationStatus: (d: { name: string; jobTitle: string; companyName: string; status: string; note?: string }) =>
    layout(`Application update: ${d.jobTitle}`, {
      heading: 'Your application status has changed',
      paragraphs: [`Hi ${d.name}, there is an update on your application for ${d.jobTitle} at ${d.companyName}.`, ...(d.note ? [d.note] : [])],
      details: [['New status', d.status]],
      cta: { label: 'View application', url: link('/candidate/applications') },
    }),
  interviewInvitation: (d: {
    name: string;
    jobTitle: string;
    companyName: string;
    scheduledAt: Date;
    durationMinutes: number;
    mode: string;
    where?: string;
    rescheduled?: boolean;
  }) =>
    layout(`${d.rescheduled ? 'Interview rescheduled' : 'Interview invitation'}: ${d.jobTitle}`, {
      heading: d.rescheduled ? 'Your interview has been rescheduled' : 'You are invited to an interview',
      paragraphs: [`Hi ${d.name}, ${d.companyName} would like to interview you for ${d.jobTitle}.`],
      details: [
        ['Date & time', fmtDate(d.scheduledAt)],
        ['Duration', `${d.durationMinutes} minutes`],
        ['Mode', d.mode.replace('_', ' ')],
        ...(d.where ? ([['Location / link', d.where]] as [string, string][]) : []),
      ],
      cta: { label: 'Respond to invitation', url: link('/candidate/interviews') },
    }),
  interviewCancelled: (d: { name: string; jobTitle: string; companyName: string; reason?: string }) =>
    layout(`Interview cancelled: ${d.jobTitle}`, {
      heading: 'Your interview has been cancelled',
      paragraphs: [`Hi ${d.name}, ${d.companyName} has cancelled the interview for ${d.jobTitle}.`, ...(d.reason ? [`Reason: ${d.reason}`] : [])],
    }),
  employerVerification: (d: { name: string; companyName: string; approved: boolean; reason?: string }) =>
    layout(`Company verification ${d.approved ? 'approved' : 'update'}: ${d.companyName}`, {
      heading: d.approved ? 'Your company has been verified' : 'Company verification was not approved',
      paragraphs: d.approved
        ? [`Hi ${d.name}, ${d.companyName} is now verified on Veejee Services. You can post jobs for review.`]
        : [`Hi ${d.name}, we could not verify ${d.companyName}.`, ...(d.reason ? [`Reason: ${d.reason}`] : []), 'Update your company profile and contact us for a re-review.'],
      cta: { label: 'Go to dashboard', url: link('/employer') },
    }),
  recruiterApproval: (d: { name: string; companyName: string; approved: boolean; reason?: string }) =>
    layout(`Recruiter access ${d.approved ? 'approved' : 'update'}`, {
      heading: d.approved ? 'Your recruiter access is approved' : 'Recruiter access was not approved',
      paragraphs: d.approved
        ? [`Hi ${d.name}, you can now post jobs and manage applicants for ${d.companyName}.`]
        : [`Hi ${d.name}, your recruiter access for ${d.companyName} was not approved.`, ...(d.reason ? [`Reason: ${d.reason}`] : [])],
      cta: { label: 'Sign in', url: link('/auth/login') },
    }),
  jobModeration: (d: { name: string; jobTitle: string; approved: boolean; reason?: string }) =>
    layout(`Job posting ${d.approved ? 'approved' : 'needs changes'}: ${d.jobTitle}`, {
      heading: d.approved ? 'Your job is live' : 'Your job posting needs changes',
      paragraphs: d.approved
        ? [`Hi ${d.name}, "${d.jobTitle}" has been approved and is now visible to job seekers.`]
        : [`Hi ${d.name}, "${d.jobTitle}" was not approved.`, ...(d.reason ? [`Reason: ${d.reason}`] : []), 'Edit the posting and resubmit it for review.'],
      cta: { label: 'Manage jobs', url: link('/employer/jobs') },
    }),
  newMessage: (d: { name: string; senderName: string; jobTitle: string; url: string }) =>
    layout(`New message about ${d.jobTitle}`, {
      heading: 'You have a new message',
      paragraphs: [`Hi ${d.name}, ${d.senderName} sent you a message about ${d.jobTitle}.`],
      cta: { label: 'Read message', url: link(d.url) },
    }),
  contactConfirmation: (d: { name: string; subject: string }) =>
    layout('We received your enquiry', {
      heading: `Thank you, ${d.name}`,
      paragraphs: ['Our team has received your enquiry and will respond within 1–2 business days.'],
      details: [['Subject', d.subject]],
    }),
  accountDeleted: (d: { name: string }) =>
    layout('Your Veejee Services account has been deleted', {
      heading: 'Account deleted',
      paragraphs: [`Hi ${d.name}, your account and personal data have been deleted as requested. Thank you for using Veejee Services.`],
    }),
  stageUpdate: (d: { name: string; stage: string; note?: string }) =>
    layout(`Recruitment update: ${d.stage}`, {
      heading: 'Your recruitment status has been updated',
      paragraphs: [`Hi ${d.name}, your status with Veejee Services is now:`, ...(d.note ? [d.note] : [])],
      details: [['Status', d.stage]],
      cta: { label: 'View my dashboard', url: link('/candidate') },
    }),
  shortlisted: (d: { name: string; jobTitle: string; companyLabel: string; hasConsent: boolean }) =>
    layout(`You have been shortlisted: ${d.jobTitle}`, {
      heading: 'Good news – Veejee Services has shortlisted you',
      paragraphs: [
        `Hi ${d.name}, our recruitment team has shortlisted your profile for ${d.jobTitle} at ${d.companyLabel}.`,
        d.hasConsent
          ? 'Your profile-sharing consent is active, so we can share your profile with the company.'
          : 'We share profiles with companies only with your consent. Please enable profile sharing in your account settings so we can submit you.',
      ],
      cta: { label: d.hasConsent ? 'View my dashboard' : 'Give consent', url: link(d.hasConsent ? '/candidate' : '/candidate/settings') },
    }),
  profileSubmitted: (d: { name: string; jobTitle: string; companyName: string; contactShared: boolean }) =>
    layout(`Your profile was shared with ${d.companyName}`, {
      heading: 'Your profile has been submitted to the company',
      paragraphs: [
        `Hi ${d.name}, Veejee Services has submitted your profile for ${d.jobTitle} to ${d.companyName}, based on your consent.`,
        d.contactShared ? 'Your contact details were included as you allowed.' : 'Your contact details were not shared – Veejee Services will coordinate all communication.',
      ],
      cta: { label: 'Track progress', url: link('/candidate/applications') },
    }),
  candidateSubmitted: (d: { name: string; jobTitle: string; candidateName: string; submissionId: string }) =>
    layout(`Veejee Services submitted a candidate for ${d.jobTitle}`, {
      heading: 'A screened candidate is ready for your review',
      paragraphs: [`Hi ${d.name}, Veejee Services has screened and submitted ${d.candidateName} for ${d.jobTitle}.`, 'Review the profile and accept, reject or request an interview.'],
      cta: { label: 'Review candidate', url: link(`/employer/candidates/${d.submissionId}`) },
    }),
  interviewRequested: (d: { name: string; companyName: string; candidateName: string; jobTitle: string; note?: string; submissionId: string }) =>
    layout(`Interview requested by ${d.companyName}`, {
      heading: 'A company requested an interview',
      paragraphs: [`Hi ${d.name}, ${d.companyName} wants to interview ${d.candidateName} for ${d.jobTitle}. Please coordinate a schedule.`, ...(d.note ? [`Company note: ${d.note}`] : [])],
      cta: { label: 'Schedule interview', url: link(`/recruiter/submissions/${d.submissionId}`) },
    }),
  interviewReminder: (d: { name: string; jobTitle: string; companyName: string; scheduledAt: Date; mode: string; where?: string }) =>
    layout(`Reminder: interview for ${d.jobTitle}`, {
      heading: 'Your interview is coming up',
      paragraphs: [`Hi ${d.name}, this is a reminder of your interview with ${d.companyName}.`],
      details: [['Date & time', fmtDate(d.scheduledAt)], ['Mode', d.mode.replace('_', ' ')], ...(d.where ? ([['Location / link', d.where]] as [string, string][]) : [])],
      cta: { label: 'View interview', url: link('/candidate/interviews') },
    }),
  interviewResult: (d: { name: string; jobTitle: string; companyName: string; selected: boolean; note?: string }) =>
    layout(`Result: ${d.jobTitle}`, {
      heading: d.selected ? 'Congratulations – you have been selected!' : 'Update on your application',
      paragraphs: d.selected
        ? [`Hi ${d.name}, ${d.companyName} has selected you for ${d.jobTitle}. Veejee Services will contact you about the offer and joining formalities.`]
        : [`Hi ${d.name}, ${d.companyName} has decided not to proceed for ${d.jobTitle}. Veejee Services will keep matching you with other opportunities.`, ...(d.note ? [d.note] : [])],
      cta: { label: 'View dashboard', url: link('/candidate') },
    }),
  placement: (d: { name: string; jobTitle: string; companyName: string; joiningDate?: Date; forEmployer?: boolean; candidateName?: string }) =>
    layout(d.forEmployer ? `Placement confirmed: ${d.candidateName}` : 'You have been successfully placed!', {
      heading: d.forEmployer ? 'Placement confirmed' : 'Congratulations on your new role!',
      paragraphs: d.forEmployer
        ? [`Hi ${d.name}, ${d.candidateName} has been placed for ${d.jobTitle}. Thank you for hiring through Veejee Services.`]
        : [`Hi ${d.name}, you have been successfully placed as ${d.jobTitle} at ${d.companyName}. We wish you every success.`],
      details: d.joiningDate ? [['Joining date', new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(d.joiningDate)]] : undefined,
    }),
  genericMessage: (d: { name: string; subject: string; message: string; senderName: string }) =>
    layout(d.subject, {
      heading: d.subject,
      paragraphs: [`Hi ${d.name},`, ...d.message.split(/\n+/).filter(Boolean), `— ${d.senderName}, Veejee Services recruitment team`],
      cta: { label: 'Open my dashboard', url: link('/candidate') },
    }),
  profileReminder: (d: { name: string; completion: number }) =>
    layout('Complete your Veejee Services profile', {
      heading: 'Your profile is almost ready',
      paragraphs: [`Hi ${d.name}, your profile is ${d.completion}% complete.`, 'Recruiters review complete profiles with a resume first. Add your skills, education, preferences and resume to be considered for more opportunities.'],
      cta: { label: 'Complete my profile', url: link('/candidate/profile') },
    }),
} satisfies Record<string, (d: never) => Rendered>;

export type TemplateName = keyof typeof templates;
export type TemplateData<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];
