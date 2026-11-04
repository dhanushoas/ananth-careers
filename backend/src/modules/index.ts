import type { ApiRouter } from '../common/route';
import { adminRouter } from './admin/admin.routes';
import { authRouter } from './auth/auth.routes';
import { candidatesRouter } from './candidates/candidates.routes';
import { employerPortalRouter } from './employer-portal/employer-portal.routes';
import { employersRouter } from './employers/employers.routes';
import { jobsRouter } from './jobs/jobs.routes';
import { contactRouter, contentRouter, notificationsRouter, statsRouter, testimonialsRouter } from './public/public.routes';
import { recruitmentRouter } from './recruitment/recruitment.routes';
import { resumesRouter } from './resumes/resumes.routes';
import { categoriesRouter, industriesRouter } from './taxonomy/taxonomy.routes';
import { usersRouter } from './users/users.routes';

export const apiRouters: ApiRouter[] = [
  authRouter,
  usersRouter,
  candidatesRouter,
  resumesRouter,
  industriesRouter,
  categoriesRouter,
  jobsRouter,
  employersRouter,
  employerPortalRouter,
  recruitmentRouter,
  notificationsRouter,
  contactRouter,
  contentRouter,
  testimonialsRouter,
  statsRouter,
  adminRouter,
];
