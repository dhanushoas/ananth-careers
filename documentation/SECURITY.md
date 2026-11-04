# Veejee Services – Security & Privacy Overview

| Area | Implementation |
|---|---|
| Passwords | Argon2id (19 MiB, t=2). Policy: 8–128 characters with a letter and a digit. Login timing is equalised for unknown accounts. Failed logins are audit-logged |
| Brute force | 5 failed logins lock the account for 15 min. Per-IP rate limits apply globally, on auth endpoints and on contact. Nginx `limit_req` is available for self-hosting |
| Access tokens | HS256 JWT, 15 min lifetime, issuer and audience checked, kept in SPA memory only. The user is reloaded on every request, so blocking or deleting an account takes effect immediately |
| Refresh tokens | Random 48-byte secret stored as a SHA-256 hash. Sent in an httpOnly, Secure, SameSite=Strict cookie scoped to `/api/v1/auth`. Rotated on each use, and **reuse detection revokes the whole token family**. Password reset or change revokes the other sessions |
| CSRF | The cookie is SameSite=Strict. Cookie endpoints also require an `X-Requested-With` header (forces a CORS pre-flight) and an allow-listed `Origin` |
| Authorization | Roles (candidate / employer / recruiter = Veejee Services staff / admin) plus fine-grained admin permissions. Only staff can screen, shortlist, submit and schedule. Companies see only candidates submitted to them, with contact details only under explicit contact consent. Internal recruiter notes are never returned to candidates or companies. Confidential requirements hide the client publicly |
| Input | Every param, query and body passes through a Zod schema to typed primitives (blocks NoSQL operator injection). `$`, dotted and prototype-polluting keys are stripped. Flat query parser. All free text is HTML-stripped before storage |
| Output | Uniform error envelope with no stack traces. Secrets (`passwordHash`, storage keys, lock counters) are removed in serialisers. Helmet sets a strict CSP (`default-src 'none'`), `nosniff`, frame denial and HSTS in production. `x-powered-by` is removed |
| CORS | Explicit origin allow-list, credentials enabled only for those origins |
| Uploads | Memory buffer with size limits (resume 5 MB, images 2 MB), MIME allow-list, **magic-byte verification**, a per-user resume cap, sanitised filenames and random storage keys |
| Encryption | TLS in transit. Atlas encryption at rest. Every uploaded file is additionally **AES-256-GCM encrypted by the API** before storage (plus S3 SSE). The platform does **not** claim end-to-end encryption |
| Secrets | Environment only, validated at boot (the server refuses to start if it's misconfigured). `.env` is gitignored. Logger redaction covers authorization headers, cookies, passwords and tokens |
| Audit | Append-only `auditlogs` for logins, failures, lockouts, registrations, moderation, verification, block/unblock, permission changes, resume downloads by companies, content edits and account deletion |
| Privacy (DPDP Act 2023) | Separate, revocable consents for profile sharing and contact sharing, stored as an append-only ledger (`candidate_consent`: type, version, timestamp, IP). Every submission references the consent record that authorised it, and submission is blocked without consent. Data export, account erasure (files deleted, records anonymised, consent withdrawn), TTL retention, data minimisation (companies never receive DOB or gender) |
| Payments (future) | The gateway (e.g. Razorpay) holds card and bank data; only order and payment IDs would be stored |
| Dependencies | `npm audit` in CI. Exact versions pinned via lockfiles. npm install scripts are restricted (`allowScripts`) |

## Testing evidence

`backend/tests/*.test.ts` (Jest + Supertest against a real MongoDB replica set) covers:
- injection, XSS stripping, lockout, token tampering
- refresh rotation, reuse detection and CSRF rejection
- RBAC and permission boundaries, cross-company isolation, resume access control
- blocked users, file type spoofing, size limits
- security headers and CORS
- email retry/failure, and DPDP export/erasure

## Reporting a vulnerability

Email the security contact listed on the Contact page. Please don't open public issues for vulnerabilities.
