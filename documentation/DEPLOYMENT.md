# Veejee Services – Production Deployment Guide

Target setup: **MongoDB Atlas**, an **API on Render** (a long-running Node 24 service), and the **frontend on Vercel** (`https://ananth-careers.vercel.app`). Vercel proxies `/api/*` to Render, so the browser sees a single origin.

> Never commit `.env` files, passwords or keys. Every secret below goes into the Render or Vercel dashboard.

## 1. MongoDB Atlas

1. In cluster `ananth-careers`, go to **Database Access** and create a dedicated user, for example `ananth_api`. Give it the *readWrite* role on the `ananth` database only. Don't use an admin user for the application.
2. Under **Network Access**, allow only the egress IPs of your Render service. Render publishes static outbound IPs per region; see Render → Service → *Outbound IPs*. Avoid `0.0.0.0/0`.
3. Set the connection string in Render as `MONGODB_URI`:
   `mongodb+srv://ananth_api:<password>@ananth-careers.jkotd2j.mongodb.net/ananth?retryWrites=true&w=majority`
   Note the `/ananth` database name. URL-encode special characters in the password.
4. **Backups:** enable Cloud Backup with continuous point-in-time restore on an M10+ tier, or scheduled snapshots. Test a restore into a staging cluster each quarter.
5. Atlas encrypts data at rest by default. TLS is enforced by `mongodb+srv`.

## 2. File storage (S3-compatible)

Render's disk is ephemeral, so production uses `STORAGE_DRIVER=s3`. Any S3-compatible store works: AWS S3 (`ap-south-1`), Cloudflare R2, DigitalOcean Spaces, and so on.
- Create a **private** bucket, block public access, and enable versioning.
- Create an access key scoped to that bucket only, with `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject`.
- For R2 or Spaces, also set `S3_ENDPOINT` and `S3_REGION` (`auto` for R2).
- Generate `FILE_ENCRYPTION_KEY` once with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and store it in a password manager. **If you lose or change it, every stored resume becomes unreadable.**

## 3. Email (SMTP)

Use a transactional provider such as Amazon SES (Mumbai), Brevo, Postmark or Zoho ZeptoMail. Verify your sending domain with SPF, DKIM and DMARC, then set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`. Failed emails retry with back-off. You can inspect and retry them under **Admin → Email outbox**.

## 4. API on Render

1. In Render, choose **New → Blueprint**, connect `dhanushoas/ananth-careers` and pick the branch. Set **Blueprint Path** to `deployment/render.yaml`.
2. Fill in the `sync: false` secrets: `MONGODB_URI`, `FILE_ENCRYPTION_KEY`, the S3 settings and the SMTP settings. `JWT_ACCESS_SECRET` is generated automatically.
3. The pre-deploy step runs `seed.js --indexes`. This syncs indexes and upserts industries and categories. To create the first super admin, temporarily add `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (12+ characters) and `SEED_ADMIN_MOBILE`, deploy once, then **remove them**.
4. Health check: `GET /health` returns 200 when the database is reachable. API docs are at `/api/docs`.
5. Note the service URL, for example `https://ananth-api.onrender.com`. Use a paid instance in production, because free instances sleep.

Process behaviour:
- `SIGTERM` triggers a graceful shutdown. The server stops accepting connections, finishes in-flight requests within 15 s, stops the email worker and closes MongoDB.
- The driver reconnects automatically after transient database outages, and requests during an outage get `503 SERVICE_UNAVAILABLE`.

## 5. Frontend on Vercel

1. Vercel project → Settings → General: **Root Directory** `frontend`, Framework *Angular*, build command `npm run build`. The output directory is set in `frontend/vercel.json`.
2. In `frontend/vercel.json`, replace the API host in the `/api/(.*)` rewrite with your Render URL.
3. Pushes to the production branch deploy automatically. Preview deployments get their own URLs. To allow a preview origin, add it to `CORS_ORIGINS` and to the Origin allow-list (the same variable).

## 6. Custom domain, DNS and TLS

- **Vercel → Domains:** add `ananthcareers.in` (or your domain). Create the A/CNAME records Vercel shows, and TLS is provisioned automatically.
- After the domain switch, update `FRONTEND_URL` and `CORS_ORIGINS` on Render. Email links use `FRONTEND_URL`.
- Optional: give the API its own subdomain (`api.ananthcareers.in`) through Render custom domains. Keep the Vercel rewrite so the browser stays same-origin.

## 7. CI/CD

`.github/workflows/ci.yml` runs on each push and PR. It typechecks, runs the backend tests (in-memory MongoDB replica set), runs the frontend unit tests, builds both apps and runs `npm audit`. Render and Vercel auto-deploy from the branch after CI passes. In GitHub branch protection, require the CI checks before merge.

## 8. Monitoring and logs

- The API writes structured JSON logs (pino). Request IDs come back in the `x-request-id` header. Passwords, tokens and cookies are redacted.
- Ship logs from Render to a log service such as Better Stack or Datadog with Render log streams.
- Add uptime monitoring on `/health` and on the frontend URL.
- For error monitoring, add Sentry: `@sentry/node` in `server.ts` and `@sentry/angular` in the SPA. Set the DSN through environment variables and scrub PII.

## 9. Backup and recovery

| Asset | Backup | Recovery |
|---|---|---|
| MongoDB | Atlas continuous backup / daily snapshots, 30-day retention | Atlas restore to new cluster, then switch `MONGODB_URI` |
| Files | Bucket versioning plus lifecycle rules (or cross-region replication) | Restore object versions |
| Encryption key and secrets | Password manager or secret vault (two custodians) | Re-enter in Render |
| Code / config | GitHub | Redeploy commit |

## 10. Go-live checklist

- [ ] `NODE_ENV=production`, `COOKIE_SECURE` unset (defaults to true), `TRUST_PROXY=2`
- [ ] Atlas user least-privilege, IP allow-list restricted, backups on
- [ ] S3 bucket private, `FILE_ENCRYPTION_KEY` backed up
- [ ] SMTP domain authenticated (SPF/DKIM/DMARC)
- [ ] Seed admin variables removed after first deploy, admin password rotated
- [ ] Policy pages reviewed by legal counsel (DPDP Act 2023 / DPDP Rules), Grievance Officer contact published
- [ ] `npm audit --omit=dev` clean in both apps
- [ ] Demo data **not** loaded (the seed refuses `--demo` in production)
