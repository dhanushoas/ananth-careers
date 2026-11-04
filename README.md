# Veejee Services – Your Recruitment Partner

A full-stack recruitment **consultancy** platform. Veejee Services works between job seekers and companies:

**Candidate registration → profile → resume → screening → filtering & matching → shortlisting → company submission (with consent) → employer review → interview coordination → selection → successful placement.**

Companies post recruitment requirements and see only candidates that Veejee Services has screened, shortlisted and submitted to them, with each candidate's consent. The recruitment team controls screening and coordination end to end.

| | |
|---|---|
| Frontend | Angular 22 · TypeScript 6 · Bootstrap 5.3 · Bootstrap Icons · SCSS · Signals · Reactive Forms |
| Backend | Node.js 24 LTS · Express 5 · TypeScript · Mongoose 9 · Zod · Pino |
| Database | MongoDB Atlas (replica set: transactions, text search, TTL indexes) |
| Security | JWT access tokens + rotating httpOnly refresh cookies · Argon2id · Helmet · rate limiting · AES-256-GCM file encryption · DPDP consent ledger |
| Integrations | Nodemailer (durable outbox with retry), S3-compatible storage, Swagger/OpenAPI |
| Testing | Jest + Supertest (backend) · Angular unit tests · Playwright E2E |

## Portals

| Portal | Who | Highlights |
|---|---|---|
| Public website | Everyone | Job opportunities, industries, services, how the process works, for job seekers, for employers, contact |
| Candidate `/candidate` | Job seekers | Profile (education, skills, experience, preferences), resumes, applications, 15-stage status tracker, interviews, **consent management** |
| Employer `/employer` | Companies | Recruitment requirements, submitted candidates, accept / reject / request interview, interview feedback, progress |
| Recruiter `/recruiter` | Veejee Services recruiters | Candidate database with advanced filters, **matching engine with transparent scores**, compare, shortlists, company submissions, interview coordination, pipeline, internal notes |
| Admin `/admin` | Management | Recruiters, companies, requirement moderation, **shortlist approvals**, reports and recruiter performance, content, settings, audit logs |

```
ANANTH/            (repository: ananth-careers)
├── backend/          Express API – src/modules/<feature>/{routes,service}.ts, models, middleware, services, tests
├── frontend/         Angular SPA – core / shared / layout / features (public, candidate, employer, recruiter, admin)
├── documentation/    API-CONTRACT.md · ARCHITECTURE.md (ER diagram) · DEPLOYMENT.md · SECURITY.md
├── deployment/       render.yaml · nginx/ · pm2/
└── .github/workflows CI pipeline
```

## Quick start (local)

Prerequisites: Node.js 24.15 or newer. No local MongoDB is needed.

```bash
# 1. API with an in-memory MongoDB replica set + demo data  (http://localhost:4000, docs at /api/docs)
cd backend
cp .env.example .env        # set JWT_ACCESS_SECRET and FILE_ENCRYPTION_KEY (commands are in the file)
npm install
npm run dev:memory

# 2. Website  (http://localhost:4200 – proxies /api to :4000)
cd ../frontend
npm install
npm start
```

**Demo accounts** (development only, password `Veejee@2026`):

| Role | Email |
|---|---|
| Super admin | `admin@veejee.example` |
| Veejee Services recruiters | `recruiter@veejee.example`, `recruiter2@veejee.example` |
| Company (Northwind Technologies) | `employer@veejee.example` |
| Candidate (already submitted to Northwind) | `seeker@veejee.example` |
| More demo candidates | `rahul.candidate@…`, `sneha.candidate@…`, `priya.candidate@…`, and others (all `@veejee.example`) |

- **Emails:** without SMTP settings, emails are saved as HTML files in `backend/storage/mail-outbox/`. To deliver real email, add SMTP settings to `backend/.env`.
- **Demo data:** loaded only with `dev:memory` or `npm run seed -- --demo`. It is clearly separated and refused when `NODE_ENV=production`.
- **Brand logo:** put the official file at `frontend/public/brand/veejee-logo.png`.

## Scripts

| Backend | |
|---|---|
| `npm run dev` / `npm run dev:memory` | Watch mode against `MONGODB_URI`, or an in-memory database with demo data |
| `npm test` | Integration and unit tests, including the full consultancy workflow |
| `npm run typecheck` · `npm run build` · `npm start` | Production compile and run |
| `npm run seed [-- --demo] [-- --indexes]` | Industries, platform settings and first admin; optional demo data; index sync |

| Frontend | |
|---|---|
| `npm start` · `npm test` · `npm run build` · `npx playwright test` | Dev server · unit tests · production build · E2E (needs both apps running) |

## Documentation
- [API contract (v2)](documentation/API-CONTRACT.md)
- [Architecture, workflow & ER diagram](documentation/ARCHITECTURE.md)
- [Production deployment (Atlas · Render · Vercel)](documentation/DEPLOYMENT.md)
- [Security & privacy](documentation/SECURITY.md)
