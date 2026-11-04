import { Pipe, PipeTransform } from '@angular/core';

/** Human labels for API enum values. Unknown values fall back to Title Case. */
export const ENUM_LABELS: Readonly<Record<string, string>> = {
  // employment types
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
  freelance: 'Freelance',
  // work modes
  onsite: 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
  // job status
  draft: 'Draft',
  pending_approval: 'Pending approval',
  published: 'Published',
  rejected: 'Rejected',
  closed: 'Closed',
  // application status
  applied: 'Applied',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview scheduled',
  selected: 'Selected',
  withdrawn: 'Withdrawn',
  // interviews
  in_person: 'In person',
  video: 'Video call',
  phone: 'Phone',
  scheduled: 'Scheduled',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  accepted: 'Accepted',
  declined: 'Declined',
  pending: 'Pending',
  // v2 consultancy model
  candidate: 'Candidate',
  registered: 'Registered',
  profile_incomplete: 'Profile incomplete',
  profile_completed: 'Profile completed',
  screening: 'Screening in progress',
  submitted: 'Submitted to company',
  company_reviewing: 'Company reviewing',
  interview_requested: 'Interview requested',
  interview_completed: 'Interview completed',
  on_hold: 'On hold',
  placed: 'Successfully placed',
  not_shortlisted: 'Not shortlisted',
  removed: 'Removed',
  fresher: 'Fresher',
  experienced: 'Experienced',
  immediate: 'Immediate',
  within_15_days: 'Within 15 days',
  within_30_days: 'Within 30 days',
  within_60_days: 'Within 60 days',
  more_than_60_days: 'More than 60 days',
  not_looking: 'Not looking',
  next_round: 'Next round',
  select: 'Select',
  reject: 'Reject',
  // misc
  verified: 'Verified',
  approved: 'Approved',
  active: 'Active',
  blocked: 'Blocked',
  jobseeker: 'Candidate',
  employer: 'Employer',
  recruiter: 'Recruiter',
  admin: 'Admin',
  technical: 'Technical',
  non_technical: 'Non-technical',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
  yearly: 'Per year',
  monthly: 'Per month',
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
  general: 'General',
  sent: 'Sent',
  failed: 'Failed',
  queued: 'Queued',
  suppressed: 'Not sent – test address',
};

export function enumLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return (
    ENUM_LABELS[value] ??
    value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ')
  );
}

@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return enumLabel(value);
  }
}
