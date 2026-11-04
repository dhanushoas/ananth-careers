# Veejee Services – API Contract (v2, consultancy model)

Base URL `/api/v1` (dev: Angular proxies `/api` → `http://localhost:4000`). Live docs: `GET /api/docs` (Swagger, generated from code – authoritative for every field).

## Business model

Veejee Services is a **recruitment intermediary**. Candidates register with Veejee Services, recruiters screen and shortlist them, and **only consented, shortlisted profiles are submitted to companies**. Companies post *requirements* and work only with submitted candidates; Veejee Services coordinates interviews through to placement.

## Conventions (unchanged from v1)
- Success `{ success, message, data, timestamp }`; error `{ success:false, message, errorCode, details[], timestamp }`.
- Paginated data `{ items, page, limit, total, totalPages }`; query `page`, `limit` (≤100).
- Every document has `id` (no `_id`). Dates ISO strings.
- Auth: `POST /auth/login` → `{ accessToken, expiresIn, user }` + httpOnly refresh cookie; `POST /auth/refresh` with `withCredentials` and header `X-Requested-With: XMLHttpRequest`. Access token in memory only.
- Notable error codes: `VALIDATION_ERROR, INVALID_CREDENTIALS, UNAUTHENTICATED, TOKEN_EXPIRED, FORBIDDEN, EMAIL_NOT_VERIFIED, ACCOUNT_BLOCKED, ACCOUNT_LOCKED, NOT_FOUND, DUPLICATE_RESOURCE, CONFLICT, INVALID_STATE, ALREADY_APPLIED, ALREADY_SHORTLISTED, ALREADY_SUBMITTED, CONSENT_REQUIRED, CONTACT_CONSENT_REQUIRED, COMPANY_NOT_VERIFIED, IN_USE, LIMIT_REACHED, UNSUPPORTED_FILE_TYPE, PAYLOAD_TOO_LARGE, RATE_LIMITED`.

## Roles
| role | who | portal route (SPA) |
|---|---|---|
| `candidate` | job seeker | `/candidate` |
| `employer` | company account | `/employer` |
| `recruiter` | **Veejee Services staff** recruiter (created by admin, accepts invite) | `/recruiter` |
| `admin` | management; `permissions[]`: `*` or `users:manage, employers:verify, recruiters:manage, jobs:moderate, recruitment:manage, shortlists:approve, candidates:assign, resumes:manage, taxonomy:manage, content:manage, enquiries:manage, emails:manage, settings:manage, reports:view, audit:view, admins:manage` | `/admin` (+ `/recruiter` if `*` or `recruitment:manage`) |

## Enumerations
- `careerLevel`: `fresher | experienced`
- `availability`: `immediate | within_15_days | within_30_days | within_60_days | more_than_60_days | not_looking`
- **Candidate stage (15)**: `registered, profile_incomplete, profile_completed, under_review, screening, shortlisted, submitted, company_reviewing, interview_requested, interview_scheduled, interview_completed, selected, rejected, on_hold, placed`. Labels: Registered · Profile incomplete · Profile completed · Under Veejee Services review · Screening in progress · Shortlisted by Veejee Services · Submitted to company · Company reviewing · Interview requested · Interview scheduled · Interview completed · Selected · Not selected · On hold · Successfully placed.
- Application (candidate → Veejee Services): `applied, under_review, shortlisted, not_shortlisted, withdrawn`
- Shortlist: `pending_approval, approved, rejected, removed, submitted`
- Submission (to company): `submitted, company_reviewing, interview_requested, interview_scheduled, interview_completed, selected, rejected, on_hold, placed, withdrawn`
- Job/requirement status: `draft, pending_approval, published, rejected, closed`; `employmentType`: `full_time, part_time, contract, internship, temporary, freelance`; `workMode`: `onsite, remote, hybrid`
- Interview `mode`: `in_person, video, phone`; status `scheduled, rescheduled, completed, cancelled`; candidateResponse `pending, accepted, declined`
- Feedback recommendation: `select, reject, next_round, on_hold`

## Auth `/auth`
`POST /register/candidate` `{ name, email, mobile, password, acceptTerms:true, acceptPrivacy:true, careerLevel?, shareProfileConsent? }` · `POST /register/employer` `{ name, email, mobile, password, companyName, industryId, website?, registrationNumber?, acceptTerms, acceptPrivacy }` · `POST /verify-email {token}` · `POST /resend-verification {email}` · `POST /login` · `POST /refresh` · `POST /logout` · `POST /logout-all` · `POST /forgot-password {email}` · `POST /reset-password {token,password}` · `POST /accept-invite {token,password}` (new staff recruiters) · `GET /providers` → `{ google: { enabled, clientId } }` · **`POST /google {credential, signup?}`** – Continue with Google: verifies the Google ID token server-side; existing account → `{status:"signed_in", accessToken, expiresIn, user}` (+ refresh cookie; links Google and marks email verified on first use); unknown email without `signup` → `{status:"signup_required", profile{email,name,picture}}`; with `signup` = `{role:"candidate", mobile, acceptTerms, acceptPrivacy, careerLevel?, shareProfileConsent?}` or `{role:"employer", mobile, acceptTerms, acceptPrivacy, companyName, industryId, website?}` → creates the account and signs in. Staff are never created via Google. Google-only accounts have no password: change-password returns 400 (use forgot-password to set one); `DELETE /users/me` takes `{confirm:"DELETE"}` instead of a password · `POST /change-password` · `GET /me` → `{ user, profile }` (candidate → Candidate; employer → company; recruiter → Recruiter).

## Candidate portal `/candidates/me` (role candidate)
| | |
|---|---|
| `GET /candidates/me` · `PUT /candidates/me` | Profile. PUT fields (all optional): `headline, summary, location{city,state,country}, dateOfBirth, gender, careerLevel, skills[{name,type:'technical'|'non_technical',level?}], education[{qualification,specialization?,institution,startYear?,endYear?,grade?}], experience[{title,company,location?,startDate,endDate?,current,description?}], totalExperienceYears, currentSalary, expectedSalary{min?,max?,period}, preferredRoles[], preferredLocations[], preferredWorkModes[], preferredIndustries[ids], employmentTypes[], noticePeriodDays, availability, openToWork`. Response adds `profileCompletion, stage, stageLabel, stageHistory[{stage,label,note,at}] (candidate-visible only), consent{profileSharing,contactSharing,updatedAt}, primaryResume` |
| `GET /candidates/me/dashboard` | `{ stage, stageLabel, profileCompletion, hasResume, consent, applications{total,byStatus}, submissions{total,byStatus}, savedJobs, upcomingInterviews[], recommendedJobs[] }` |
| `GET /candidates/me/consent` · `PUT /candidates/me/consent {profileSharing?, contactSharing?}` | `{ current, version, history[{type,granted,version,createdAt}] }`. Contact sharing requires profile sharing |
| `GET/POST /candidates/me/applications` | Apply through Veejee Services `{ jobId, resumeId?, coverLetter? }` (defaults to primary resume). Confidential jobs show `companyName: "Veejee Services client (confidential)"` |
| `POST /candidates/me/applications/:id/withdraw {reason?}` | only while `applied`/`under_review` |
| `GET /candidates/me/submissions` | Companies the profile was shared with: `[{ id, job, employer, status, contactShared, submittedAt, history[{status,note,at}], interviews[], active }]` |
| `GET /candidates/me/interviews?upcoming=` · `POST /candidates/me/interviews/:id/respond {response:'accepted'|'declined', note?}` | |
| `GET /candidates/me/saved-jobs` · `POST/DELETE /candidates/me/saved-jobs/:jobId` | |

Resumes (candidate): `GET /resumes`, `POST /resumes` (multipart `file`, PDF ≤5 MB), `PATCH /resumes/:id/primary`, `DELETE /resumes/:id`, `GET /resumes/:id/download` (owner, staff, or a company it was submitted to).

## Public website
`GET /jobs` (search: `q, location, industry(id|slug), category, employmentType(csv), workMode(csv), experience, salaryMin, postedWithin, featured, sort=relevance|latest|salary_high`) · `GET /jobs/featured` · `GET /jobs/:idOrSlug` (adds `isSaved`, `hasApplied` for candidates; confidential → `employer:null`) · `GET /industries` · `GET /industries/:slug` · `GET /categories?industry=` · `GET /employers?featured=` · `GET /employers/:slug` · `GET /employers/:id/logo` · `GET /stats/public` → `{jobs, employers, jobSeekers, industries}` · `GET /testimonials` · `POST /contact {name,email,phone?,subject,message,enquiryType:'candidate'|'employer'|'general',consent:true}` · `GET /content/:key` keys: `home, about, services, process, job-seekers, employers, faq, privacy, terms, refund` (shapes: `process` `{title, steps[{icon,title,body}]}`; `job-seekers`/`employers` `{title,intro,benefits[{icon,title,body}],steps[]}`; others as v1).

## Employer portal (role employer)
| | |
|---|---|
| `GET /employers/me` · `PUT /employers/me` · `POST /employers/me/logo` | Company profile (`companyName, industry, website, description, size, foundedYear, headquarters, address, registrationNumber, contactPerson, contactEmail, contactPhone`) |
| `GET /jobs/mine` · `POST /jobs` · `PATCH /jobs/:id` · `POST /jobs/:id/submit|close|reopen` · `DELETE /jobs/:id` | **Recruitment requirements**. Body adds `openings` (vacancies), `confidential?`, `noticePeriodMaxDays?`, `qualifications[]`, `skills[]`. `submit:true` sends for Veejee Services approval (company must be verified) |
| `GET /employer/dashboard` | `{ company, requirementsByStatus, submissionsByStatus, totals{submitted,awaitingReview,interviews,hired}, recentSubmissions[], upcomingInterviews[] }` |
| `GET /employer/submissions?jobId&status&history=true` | submitted candidates (paginated) with `candidate{name}`, `candidateProfile{headline,totalExperienceYears,careerLevel,skills,location,noticePeriodDays,expectedSalary}` |
| `GET /employer/submissions/:id` | approved profile view: `candidate{name, email?, mobile?}` (contact only if `contactShared`), `candidateProfile` (no DOB/gender), `resume{id,originalName}`, `recruiterSummary`, `statusHistory[]`, `interviews[]`, `feedback[]`, `interviewRequest`. First view moves `submitted → company_reviewing` |
| `POST /employer/submissions/:id/decision {decision:'reviewing'|'accept'|'reject'|'on_hold', note?}` | accept → `selected` |
| `POST /employer/submissions/:id/interview-request {note?, preferredSlots?[]}` | → `interview_requested`; Veejee Services schedules |
| `GET /employer/interviews?upcoming=` · `POST /employer/interviews/:id/feedback {rating 1-5, feedback, recommendation}` | feedback only after the interview time |

## Recruiter portal `/recruitment` (recruiter, or admin with `*`/`recruitment:manage`)
| | |
|---|---|
| `GET /recruitment/dashboard` | `{ assignedCandidates{total,byStage}, pendingApplications, pendingApprovals, openSubmissions, placementsThisMonth, interviewRequests[], upcomingInterviews[], myRequirements[], recentApplications[] }` |
| `GET /recruitment/recruiters` | `[{id (user id), name, designation}]` for assignment pickers |
| `GET /recruitment/candidates` | **Candidate database**. Filters: `q, role, skills(csv, all must match), technicalSkills(csv), softSkills(csv), qualification, specialization, careerLevel, expMin, expMax, currentSalaryMax, expectedSalaryMax, location, workMode, noticeMax, availability(csv), industry, employmentType, completionMin, hasResume, consent, stage(csv), assigned=me|unassigned|<userId>, sort=recent|experience|completion|relevance`. Items include `user{name,email,mobile}`, `stage, stageLabel, hasResume, consent, assignedRecruiter{name}` |
| `GET /recruitment/candidates/compare?ids=a,b[,c,d]` | side-by-side |
| `GET /recruitment/candidates/:id` | `{ candidate, resumes, applications, shortlists, submissions, interviews, notes (internal), consentHistory }` |
| `PATCH /recruitment/candidates/:id/stage {stage, note?, visibleToCandidate?}` | allowed: `under_review, screening, on_hold, rejected, profile_completed` |
| `PATCH /recruitment/candidates/:id/assign {recruiterId|null}` | recruiters may claim unassigned; reassign needs `candidates:assign` |
| `POST /recruitment/candidates/:id/notes {body, jobId?}` · `DELETE /recruitment/notes/:id` | internal notes (never shown to candidate/company) |
| `POST /recruitment/candidates/:id/contact {subject, message}` | emails candidate, logged |
| `GET /recruitment/applications?status&jobId` · `PATCH /recruitment/applications/:id {status:'under_review'|'not_shortlisted', note?}` | screening queue |
| `GET /recruitment/requirements?status&q&assigned=me|unassigned&employer` | with `counts{shortlisted,submitted,pendingApplications}` |
| `GET /recruitment/requirements/:id` | `{ requirement, shortlists, submissions, applications }` |
| `PATCH /recruitment/requirements/:id/assign {recruiterId|null}` | |
| `GET /recruitment/requirements/:id/matches?minScore&consentOnly&includeShortlisted` | ranked `[{ candidate, match{score, factors[{key,label,weight,score(0-1),reason}]}, shortlistStatus, submissionStatus }]` + `weights`, `poolSize`. **Ranking only – never auto-rejects** |
| `GET /recruitment/shortlists?status&jobId&mine` · `POST /recruitment/shortlists {jobId, candidateId, applicationId?, note?, source?}` · `POST /recruitment/shortlists/:id/remove {reason?}` | new shortlist is `pending_approval` when approval is required (default) unless the actor holds `shortlists:approve` |
| `PATCH /recruitment/shortlists/:id/approval {decision:'approve'|'reject', note?}` | admin with `shortlists:approve` |
| `POST /recruitment/submissions {shortlistId, summary?, shareContact?}` | requires approved shortlist + candidate profile-sharing consent (+ contact consent if `shareContact`) |
| `GET /recruitment/submissions?status&jobId&employer&mine` · `GET /recruitment/submissions/:id` (`{submission, interviews, feedback}`) | |
| `PATCH /recruitment/submissions/:id/status {status, note?, visibleToCandidate?, joiningDate?}` | e.g. `on_hold`, `selected`, `placed` (from selected), `rejected`, `withdrawn` |
| `GET /recruitment/interviews?upcoming&status&mine` · `POST /recruitment/interviews {submissionId, scheduledAt, durationMinutes, mode, location?, meetingLink?, notes?}` · `PATCH /recruitment/interviews/:id` · `POST /recruitment/interviews/:id/cancel {reason?}` · `POST /recruitment/interviews/:id/complete` | video needs https `meetingLink`; in_person needs `location` |

## Admin `/admin`
`GET /stats` → `{ candidates{total,freshers,experienced,underReview}, companies{total,verified,pending}, requirements{active,pendingApproval}, pipeline{shortlisted,pendingShortlists,submitted,interviewsScheduled,selected,placed,placedThisMonth}, recruiters, blockedUsers, newEnquiries, recentAuditLogs }` ·
Users: `GET /users`, `PATCH /users/:id/status`, `POST /users/admins`, `PATCH /users/:id/permissions` ·
Recruiters: `GET /recruiters?active` (with `assignedCandidates`, `placements`), `POST /recruiters {name,email,mobile,designation?,employeeCode?,specializations?[]}` (sends invite), `PATCH /recruiters/:id {designation?,employeeCode?,specializations?,active?}`, `POST /recruiters/:id/resend-invite` ·
Companies: `GET /employers`, `PATCH /employers/:id/verification {status, reason?}`, `PATCH /employers/:id {featured?, accountManager?}` ·
Requirements: `GET /jobs`, `PATCH /jobs/:id/moderation {action, reason?}`, `PATCH /jobs/:id/featured` ·
Shortlist approvals: `GET /recruitment/shortlists?status=pending_approval` + `PATCH /recruitment/shortlists/:id/approval` ·
`GET/DELETE /resumes`, `GET/PATCH /enquiries`, `GET /emails`, `POST /emails/:id/retry`, `GET/PUT /content/:key`, testimonials CRUD ·
Settings: `GET/PUT /settings` `{ matchingWeights{skills,experience,education,location,salary,noticePeriod}, requireShortlistApproval, reminders{profileCompletion,profileReminderDays,interview,interviewHoursBefore}, notifications{emailCandidatesOnStageChange,emailEmployerOnSubmission} }` (partial updates merge) ·
`GET /reports?from&to` → `{ registrations[], monthly[{month,candidates,submissions,placements}] (12), funnel{applied,shortlisted,submitted,interviewed,selected,placed}, submissionsByStatus[], requirementsByIndustry[], placementsByIndustry[], careerLevels{fresher,experienced}, recruiterPerformance[{recruiterId,name,active,shortlisted,submitted,interviews,placements,conversionRate}] }` · `GET /audit-logs`.

## Notifications `/notifications` (any signed-in user)
`GET /?unread=` · `GET /unread-count` · `PATCH /:id/read` · `PATCH /read-all`. Links point at `/candidate…`, `/employer…`, `/recruiter…`, `/admin…` routes.

## Email links used by the backend (SPA routes must exist)
`/auth/login`, `/auth/verify-email?token=`, `/auth/reset-password?token=`, `/auth/accept-invite?token=`, `/candidate`, `/candidate/profile`, `/candidate/applications`, `/candidate/interviews`, `/candidate/settings`, `/employer`, `/employer/requirements`, `/employer/candidates/:submissionId`, `/recruiter/candidates/:candidateId`, `/recruiter/submissions/:submissionId`, `/recruiter/requirements/:id`, `/admin/shortlists`, `/admin/jobs`, `/admin/enquiries`.

## Demo accounts (dev only, password `Veejee@2026`)
`admin@veejee.example` (super admin) · `recruiter@veejee.example`, `recruiter2@veejee.example` (Veejee Services recruiters) · `employer@veejee.example` (Northwind Technologies) · `seeker@veejee.example` (Kavya Reddy – already submitted to Northwind, `company_reviewing`) + 7 more demo candidates (`*.candidate@veejee.example`).
