import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AVAILABILITY, CANDIDATE_STAGES, CAREER_LEVELS, EMPLOYMENT_TYPES, INTERVIEW_MODES, INTERVIEW_STATUSES, JOB_STATUSES, SHORTLIST_STATUSES, SUBMISSION_STATUSES, WORK_MODES } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { boolQuery, csvEnum, idParam, objectId, pagination, requiredText, text } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import { assertStaff } from '../../services/company.service';
import * as cand from './recruitment.candidates.service';
import * as pipe from './recruitment.pipeline.service';

const S = ['recruiter', 'admin'] as ('recruiter' | 'admin')[];
const staffOnly = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await assertStaff(req.auth!);
    next();
  } catch (err) {
    next(err);
  }
};
const csv = z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)).pipe(z.array(z.string().max(60)).max(20));
const num = z.coerce.number().min(0);

const candidateSearch = pagination.extend({
  q: text(100).optional(),
  role: text(80).optional(),
  skills: csv.optional(),
  technicalSkills: csv.optional(),
  softSkills: csv.optional(),
  qualification: text(80).optional(),
  specialization: text(80).optional(),
  careerLevel: z.enum(CAREER_LEVELS).optional(),
  expMin: num.max(60).optional(),
  expMax: num.max(60).optional(),
  currentSalaryMax: num.optional(),
  expectedSalaryMax: num.optional(),
  location: text(80).optional(),
  workMode: z.enum(WORK_MODES).optional(),
  noticeMax: num.max(365).optional(),
  availability: csvEnum(AVAILABILITY).optional(),
  industry: objectId.optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  completionMin: num.max(100).optional(),
  hasResume: boolQuery.optional(),
  consent: boolQuery.optional(),
  stage: csvEnum(CANDIDATE_STAGES).optional(),
  assigned: z.union([z.enum(['me', 'unassigned']), objectId]).optional(),
  sort: z.enum(['recent', 'experience', 'completion', 'relevance']).default('recent'),
});

const interviewInput = z.object({
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(480),
  mode: z.enum(INTERVIEW_MODES),
  location: text(300).optional(),
  meetingLink: z.url({ protocol: /^https$/, error: 'Enter a valid https:// meeting link' }).max(500).optional(),
  notes: text(2000).optional(),
});

export const recruitmentRouter = new ApiRouter('Recruitment (Veejee Services staff)', '/recruitment')
  .route({ method: 'get', path: '/dashboard', summary: 'Recruiter dashboard', auth: S, middleware: [staffOnly], handler: ({ auth }) => pipe.dashboard(auth) })
  .route({ method: 'get', path: '/recruiters', summary: 'Active Veejee Services recruiters (for assignment)', auth: S, middleware: [staffOnly], handler: () => pipe.listRecruiters() })
  // Candidate database
  .route({
    method: 'get',
    path: '/candidates',
    summary: 'Candidate database with advanced filters',
    auth: S,
    middleware: [staffOnly],
    query: candidateSearch,
    handler: ({ auth, query }) => cand.searchCandidates(auth, query),
  })
  .route({
    method: 'get',
    path: '/candidates/compare',
    summary: 'Compare 2–4 candidates side by side',
    auth: S,
    middleware: [staffOnly],
    query: z.object({ ids: z.string().transform((s) => s.split(',')).pipe(z.array(objectId).min(2).max(4)) }),
    handler: ({ query }) => cand.compareCandidates(query.ids),
  })
  .route({ method: 'get', path: '/candidates/:id', summary: 'Full candidate review (incl. internal notes)', auth: S, middleware: [staffOnly], params: idParam, handler: ({ params }) => cand.getCandidate(params.id) })
  .route({
    method: 'patch',
    path: '/candidates/:id/stage',
    summary: 'Set review stage (under review, screening, on hold, rejected)',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ stage: z.enum(CANDIDATE_STAGES), note: text(1000).optional(), visibleToCandidate: z.boolean().optional() }),
    message: 'Candidate stage updated',
    handler: ({ auth, params, body, req }) => cand.changeStage(auth, params.id, body, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/candidates/:id/assign',
    summary: 'Assign candidate to a recruiter (recruiters may claim unassigned candidates)',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ recruiterId: objectId.nullable() }),
    message: 'Assignment updated',
    handler: ({ auth, params, body, req }) => cand.assignCandidate(auth, params.id, body.recruiterId, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/candidates/:id/notes',
    summary: 'Add an internal recruitment note',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ body: requiredText(5000), jobId: objectId.optional() }),
    status: 201,
    message: 'Note added',
    handler: ({ auth, params, body }) => cand.addNote(auth, params.id, body.body, body.jobId),
  })
  .route({
    method: 'delete',
    path: '/notes/:id',
    summary: 'Delete my note',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    message: 'Note deleted',
    handler: async ({ auth, params }) => {
      await cand.deleteNote(auth, params.id);
      return null;
    },
  })
  .route({
    method: 'post',
    path: '/candidates/:id/contact',
    summary: 'Email the candidate on behalf of Veejee Services',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ subject: requiredText(150, 3), message: requiredText(3000, 5) }),
    message: 'Message sent to candidate',
    handler: async ({ auth, params, body, req }) => {
      await cand.contactCandidate(auth, params.id, body, actorFrom(req));
      return null;
    },
  })
  // Applications to Veejee Services
  .route({
    method: 'get',
    path: '/applications',
    summary: 'Candidate applications awaiting screening',
    auth: S,
    middleware: [staffOnly],
    query: pagination.extend({ status: z.enum(['applied', 'under_review', 'shortlisted', 'not_shortlisted', 'withdrawn']).optional(), jobId: objectId.optional() }),
    handler: ({ query }) => cand.listApplications(query),
  })
  .route({
    method: 'patch',
    path: '/applications/:id',
    summary: 'Mark an application under review / not shortlisted',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ status: z.enum(['under_review', 'not_shortlisted']), note: text(1000).optional() }),
    message: 'Application updated',
    handler: ({ auth, params, body, req }) => cand.reviewApplication(auth, params.id, body.status, body.note, actorFrom(req)),
  })
  // Requirements & matching
  .route({
    method: 'get',
    path: '/requirements',
    summary: 'Company recruitment requirements',
    auth: S,
    middleware: [staffOnly],
    query: pagination.extend({ status: z.enum(JOB_STATUSES).optional(), q: text(100).optional(), assigned: z.enum(['me', 'unassigned']).optional(), employer: objectId.optional() }),
    handler: ({ auth, query }) => pipe.listRequirements(auth, query),
  })
  .route({ method: 'get', path: '/requirements/:id', summary: 'Requirement with shortlist, submissions and applications', auth: S, middleware: [staffOnly], params: idParam, handler: ({ params }) => pipe.getRequirement(params.id) })
  .route({
    method: 'patch',
    path: '/requirements/:id/assign',
    summary: 'Assign the requirement to a recruiter',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ recruiterId: objectId.nullable() }),
    message: 'Assignment updated',
    handler: ({ auth, params, body, req }) => pipe.assignRequirement(auth, params.id, body.recruiterId, actorFrom(req)),
  })
  .route({
    method: 'get',
    path: '/requirements/:id/matches',
    summary: 'Ranked candidate matches with transparent score breakdown',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    query: pagination.extend({ minScore: z.coerce.number().min(0).max(100).optional(), consentOnly: boolQuery.optional(), includeShortlisted: boolQuery.optional() }),
    handler: ({ params, query }) => pipe.matchCandidates(params.id, query),
  })
  // Shortlists
  .route({
    method: 'get',
    path: '/shortlists',
    summary: 'Shortlists (filter pending approvals with status=pending_approval)',
    auth: S,
    middleware: [staffOnly],
    query: pagination.extend({ status: z.enum(SHORTLIST_STATUSES).optional(), jobId: objectId.optional(), mine: boolQuery.optional() }),
    handler: ({ auth, query }) => pipe.listShortlists(query, auth),
  })
  .route({
    method: 'post',
    path: '/shortlists',
    summary: 'Shortlist a candidate for a requirement',
    auth: S,
    middleware: [staffOnly],
    body: z.object({ jobId: objectId, candidateId: objectId, applicationId: objectId.optional(), note: text(2000).optional(), source: z.enum(['application', 'search', 'match']).optional() }),
    status: 201,
    message: 'Candidate shortlisted',
    handler: ({ auth, body, req }) => pipe.createShortlist(auth, body, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/shortlists/:id/remove',
    summary: 'Remove a candidate from the shortlist',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ reason: text(1000).optional() }),
    message: 'Removed from shortlist',
    handler: ({ auth, params, body, req }) => pipe.removeShortlist(auth, params.id, body.reason, actorFrom(req)),
  })
  .route({
    method: 'patch',
    path: '/shortlists/:id/approval',
    summary: 'Approve or reject a shortlist (management)',
    auth: ['admin'],
    permission: 'shortlists:approve',
    params: idParam,
    body: z.object({ decision: z.enum(['approve', 'reject']), note: text(1000).optional() }),
    message: 'Shortlist reviewed',
    handler: ({ auth, params, body, req }) => pipe.reviewShortlist(auth, params.id, body.decision, body.note, actorFrom(req)),
  })
  // Submissions
  .route({
    method: 'post',
    path: '/submissions',
    summary: 'Submit an approved, consented candidate to the company',
    auth: S,
    middleware: [staffOnly],
    body: z.object({ shortlistId: objectId, summary: text(3000).optional(), shareContact: z.boolean().optional() }),
    status: 201,
    message: 'Candidate submitted to the company',
    handler: ({ auth, body, req }) => pipe.submitToCompany(auth, body, actorFrom(req)),
  })
  .route({
    method: 'get',
    path: '/submissions',
    summary: 'Company submissions',
    auth: S,
    middleware: [staffOnly],
    query: pagination.extend({ status: z.enum(SUBMISSION_STATUSES).optional(), jobId: objectId.optional(), employer: objectId.optional(), mine: boolQuery.optional() }),
    handler: ({ auth, query }) => pipe.listSubmissions(query, auth),
  })
  .route({ method: 'get', path: '/submissions/:id', summary: 'Submission with interviews and employer feedback', auth: S, middleware: [staffOnly], params: idParam, handler: ({ params }) => pipe.getSubmission(params.id) })
  .route({
    method: 'patch',
    path: '/submissions/:id/status',
    summary: 'Update recruitment progress (on hold, selected, placed, …)',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ status: z.enum(SUBMISSION_STATUSES), note: text(1000).optional(), visibleToCandidate: z.boolean().optional(), joiningDate: z.coerce.date().optional() }),
    message: 'Submission updated',
    handler: ({ auth, params, body, req }) => pipe.updateSubmissionStatus(auth, params.id, body, actorFrom(req)),
  })
  // Interviews
  .route({
    method: 'get',
    path: '/interviews',
    summary: 'Interviews coordinated by Veejee Services',
    auth: S,
    middleware: [staffOnly],
    query: z.object({ upcoming: boolQuery.optional(), status: z.enum(INTERVIEW_STATUSES).optional(), mine: boolQuery.optional() }),
    handler: ({ auth, query }) => pipe.listInterviews(query, auth),
  })
  .route({
    method: 'post',
    path: '/interviews',
    summary: 'Schedule an interview for a submission',
    auth: S,
    middleware: [staffOnly],
    body: interviewInput.extend({ submissionId: objectId }),
    status: 201,
    message: 'Interview scheduled; candidate and company notified',
    handler: ({ auth, body, req }) => {
      const { submissionId, ...rest } = body;
      return pipe.scheduleInterview(auth, submissionId, rest, actorFrom(req));
    },
  })
  .route({
    method: 'patch',
    path: '/interviews/:id',
    summary: 'Reschedule an interview',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: interviewInput,
    message: 'Interview rescheduled',
    handler: ({ params, body, req }) => pipe.rescheduleInterview(params.id, body, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/interviews/:id/cancel',
    summary: 'Cancel an interview',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    body: z.object({ reason: text(500).optional() }),
    message: 'Interview cancelled',
    handler: ({ auth, params, body, req }) => pipe.cancelInterview(auth, params.id, body.reason, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/interviews/:id/complete',
    summary: 'Mark an interview completed',
    auth: S,
    middleware: [staffOnly],
    params: idParam,
    message: 'Interview completed',
    handler: ({ auth, params, req }) => pipe.completeInterview(auth, params.id, actorFrom(req)),
  });
