import { z } from 'zod';
import { FEEDBACK_RECOMMENDATIONS, SUBMISSION_STATUSES } from '../../common/constants';
import { ApiRouter } from '../../common/route';
import { boolQuery, idParam, objectId, pagination, requiredText, text } from '../../common/validation';
import { actorFrom } from '../../services/activity.service';
import * as svc from './employer-portal.service';

const E = ['employer'] as 'employer'[];

export const employerPortalRouter = new ApiRouter('Employer portal', '/employer')
  .route({ method: 'get', path: '/dashboard', summary: 'Company recruitment dashboard', auth: E, handler: ({ auth }) => svc.dashboard(auth) })
  .route({
    method: 'get',
    path: '/submissions',
    summary: 'Candidates Veejee Services has submitted to my company',
    auth: E,
    query: pagination.extend({ jobId: objectId.optional(), status: z.enum(SUBMISSION_STATUSES).optional(), history: boolQuery.optional() }),
    handler: ({ auth, query }) => svc.listSubmissions(auth, query),
  })
  .route({ method: 'get', path: '/submissions/:id', summary: 'Submitted candidate details', auth: E, params: idParam, handler: ({ auth, params }) => svc.getSubmission(auth, params.id) })
  .route({
    method: 'post',
    path: '/submissions/:id/decision',
    summary: 'Accept, reject or hold a submitted candidate',
    auth: E,
    params: idParam,
    body: z.object({ decision: z.enum(['reviewing', 'accept', 'reject', 'on_hold']), note: text(2000).optional() }),
    message: 'Decision recorded – Veejee Services has been notified',
    handler: ({ auth, params, body, req }) => svc.decide(auth, params.id, body.decision, body.note, actorFrom(req)),
  })
  .route({
    method: 'post',
    path: '/submissions/:id/interview-request',
    summary: 'Ask Veejee Services to arrange an interview',
    auth: E,
    params: idParam,
    body: z.object({ note: text(1000).optional(), preferredSlots: z.array(requiredText(100)).max(5).optional() }),
    message: 'Interview requested – Veejee Services will coordinate the schedule',
    handler: ({ auth, params, body, req }) => svc.requestInterview(auth, params.id, body, actorFrom(req)),
  })
  .route({
    method: 'get',
    path: '/interviews',
    summary: 'Interviews for my company',
    auth: E,
    query: z.object({ upcoming: boolQuery.optional() }),
    handler: ({ auth, query }) => svc.listInterviews(auth, Boolean(query.upcoming)),
  })
  .route({
    method: 'post',
    path: '/interviews/:id/feedback',
    summary: 'Submit interview feedback',
    auth: E,
    params: idParam,
    body: z.object({ rating: z.number().int().min(1).max(5), feedback: requiredText(5000, 5), recommendation: z.enum(FEEDBACK_RECOMMENDATIONS) }),
    status: 201,
    message: 'Feedback submitted',
    handler: ({ auth, params, body, req }) => svc.giveFeedback(auth, params.id, body, actorFrom(req)),
  });
