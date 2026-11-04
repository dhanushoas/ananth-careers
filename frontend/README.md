# Veejee Services – Frontend

Angular SPA for **Veejee Services – Your Recruitment Partner**, a recruitment intermediary: candidates register with
Veejee Services, our recruiters screen and shortlist them, profiles are shared with client companies **only with the
candidate's consent**, companies post requirements and receive screened candidates, and Veejee Services coordinates
interviews through to placement. Built against `../documentation/API-CONTRACT.md` (v2) and the backend Swagger
(`http://localhost:4000/api/docs`).

| | Version |
|---|---|
| Angular (core/router/forms…) | 22.2.4 |
| Angular CLI / build | 22.2.5 |
| TypeScript | 6.0.3 |
| Bootstrap (SCSS, themed) | 5.3.8 |
| Bootstrap Icons | 1.13.2 |
| Unit tests | Vitest 5.1.0 via `@angular/build:unit-test` (jsdom) |
| E2E | @playwright/test 1.64.1 |
| Node | 24.x |

## Scripts

```bash
npm install
npm start            # ng serve on http://localhost:4200 (proxies /api -> http://localhost:4000)
npm run build        # production build -> dist/frontend/browser
npm test             # unit tests (single run)
npm run e2e:install  # one-time: download Playwright Chromium
npm run e2e          # Playwright specs in e2e/ (needs backend + a dev server)
```

## Environment

- `src/environments/environment*.ts`: `apiUrl: '/api/v1'`, `notificationPollMs: 60000`.
- `proxy.conf.json` maps `/api` → `http://localhost:4000` for `ng serve`.
- The backend only accepts the refresh cookie (`/auth/refresh`, `/auth/logout`) from the allow-listed Origin
  `http://localhost:4200`. To run E2E against another port, use a proxy config that sets
  `"headers": { "Origin": "http://localhost:4200" }` and `PW_BASE_URL=http://localhost:<port>`.
- E2E env vars: `PW_BASE_URL`, `PW_WEB_SERVER=1`, `E2E_PASSWORD` (default `Veejee@2026`), `E2E_ADMIN`, `E2E_RECRUITER`,
  `E2E_EMPLOYER`, `E2E_CANDIDATE` (defaults: `admin@`, `recruiter@`, `employer@`, `seeker@veejee.example`).
- The backend persists data: specs use unique emails/titles and pick any still-available demo candidate.

## Continue with Google

- `GET /auth/providers` decides at runtime whether the button appears (`google.enabled`) and supplies the client id —
  nothing is hard-coded and no rebuild is needed once `GOOGLE_CLIENT_ID` is configured on the backend. While disabled,
  the button (and the Google script) simply never load.
- The Google Identity Services script (`https://accounts.google.com/gsi/client`) is loaded on demand only on
  `/auth/login`, `/auth/register`, `/auth/register/candidate` and `/auth/register/employer` (popup mode, pill
  "Continue with Google" button, "or" divider). No CSP is set by the SPA; if you add one at the web server, allow
  `https://accounts.google.com` in `script-src`, `frame-src` and `connect-src`.
- The credential goes to `POST /auth/google`: `signed_in` behaves like a normal login; `signup_required` opens
  `/auth/google-complete` (credential kept in memory only) to choose Candidate or Company and fill the required details.
- Google-only accounts: Settings shows "You sign in with Google – set a password via Forgot password" when the server
  reports no password, and account deletion is confirmed by typing DELETE.

## Brand & UI

- Logo: `public/brand/veejee-logo.png` (official image, rendered at a fixed height; if missing, a text wordmark
  "Veejee" + "Services" is shown). Favicon: simple "V" mark.
- Colours: navy `#0B2A5B` (dark bands `#0A1F44`), orange accent `#F7821B` (hover `#E06F0A`, small text `#B85A00`),
  white backgrounds — defined in `src/styles/_bootstrap-theme.scss` and the `--an-*` tokens in `src/styles.scss`
  (the `--an-gold-*` tokens hold the orange scale).
- Bootstrap 5.3 (SCSS) + Bootstrap Icons; no Bootstrap JS — modals (`ModalService`), dropdowns, offcanvas drawers
  and toasts are signal-driven Angular components. Forms use `.form-floating` in `row g-3` grids with `FORM_KIT`
  (Reactive Forms → `.is-invalid` + feedback). Original inline-SVG illustrations live in `shared/illustrations`.

## Roles & portals (route map)

| Path | Access | Contents |
|---|---|---|
| `/`, `/jobs`, `/jobs/:slug`, `/industries`, `/industries/:slug`, `/employers` (client companies), `/employers/:slug` | public | Home, job opportunities ("Apply through Veejee Services"), industries we serve, client companies |
| `/job-seekers`, `/for-employers` (`/employers-info` redirects), `/process`, `/about`, `/services`, `/faq`, `/privacy`, `/terms`, `/refund`, `/contact` | public | CMS-driven pages (`GET /content/:key`) with built-in fallbacks |
| `/auth/login`, `/auth/register`, `/auth/register/candidate` (`/auth/register/jobseeker` redirects), `/auth/register/employer`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/accept-invite` (new staff recruiters) | public | Account flows |
| `/candidate` (+ `profile`, `resumes`, `jobs`, `saved-jobs`, `applications`, `applications/:id`, `interviews`, `notifications`, `settings`) | candidate | 15-stage progress tracker, profile, applications to Veejee Services + companies the profile was shared with, interviews, privacy & consent. `/seeker/*` redirects here |
| `/employer` (+ `company`, `requirements`, `requirements/new`, `requirements/:id`, `requirements/:id/edit`, `candidates`, `candidates/:submissionId`, `interviews`, `history`, `notifications`, `settings`) | employer | Recruitment requirements, submitted candidates (decisions, interview requests, feedback) |
| `/recruiter` (+ `candidates`, `compare`, `candidates/:id`, `applications`, `pipeline`, `requirements`, `requirements/:id`, `submissions`, `submissions/:id`, `interviews`, `notifications`, `settings`) | recruiter; admin with `*` or `recruitment:manage` | Candidate database with advanced search, matching, shortlists, submissions, interview coordination, pipeline |
| `/admin` (+ `candidates`, `employers`, `recruiters`, `jobs`, `shortlists`, `interviews`, `reports`, `users`, `admins`, `content`, `testimonials`, `taxonomy`, `enquiries`, `emails`, `resumes`, `audit-logs`, `settings` (system), `account`) | admin (per-permission guards) | Management console |
| `/notifications`, `/forbidden`, `/error`, `**` | — | Notifications, error / 404 pages |

## Structure

```
src/app/
  core/       auth (signals, in-memory token, single-flight refresh), guards (auth/role/guest/permission/recruiterPortal),
              interceptors, http (envelope unwrap, error codes), services (candidate, recruitment, employer-portal,
              admin, jobs, taxonomy, resumes, employers, account/notifications, content), models (v1 + v2.models.ts)
  shared/     ui (modal, toast, dropdown, offcanvas, focus trap, icons), illustrations, components (cards, page hero/header,
              empty state, skeleton, stage badge/tracker, consent badges, charts, paginator, FORM_KIT…), pipes, utils
  layout/     public layout (navbar + drawer, notifications, user menu, footer), dashboard layout (sidebar/offcanvas)
  features/   home, jobs, industries, employers, static (content/audience/process pages), contact, auth, errors,
              candidate, employer, recruiter, admin, account, notifications
e2e/          Playwright specs + helpers
```

## Testing

- Unit (`npm test`, 66 tests): auth service & interceptor (refresh/retry, single-flight), guards (incl. recruiter
  portal access), candidate registration form, job card, salary pipe, Jobs/Recruitment/Candidate/Employer-portal
  services with `HttpTestingController`, Bootstrap UI infrastructure, utilities.
- E2E (`npm run e2e`): candidate registration (career level + consent), login & role guards, job search & filters,
  candidate portal (stage tracker, profile save, consent toggles, apply through Veejee Services, `/seeker` redirect),
  employer requirement → admin approval, the full consultancy flow (recruiter search → match → shortlist → admin
  approval → submit to company → employer review without contact details → interview request → recruiter schedules →
  employer accepts → recruiter marks placed), and responsive checks (no horizontal scroll at 360/768/1024/1440 px for
  public pages and every portal's main pages; mobile drawers).
