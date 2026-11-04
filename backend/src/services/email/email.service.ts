import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../common/logger';
import { EmailOutbox } from '../../models';
import { templates, type TemplateData, type TemplateName } from './templates';

const MAX_ATTEMPTS = 5;

function createTransport(): Transporter {
  if (env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      requireTLS: !env.SMTP_SECURE && env.isProd,
    });
  }
  // Development / test without SMTP: render messages to JSON (written to disk in dev for inspection).
  return nodemailer.createTransport({ jsonTransport: true });
}

let transport = createTransport();

/** "Name <email>" → parts (for HTTP email APIs). */
function parseFrom(from: string) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1] || undefined, email: m[2]! } : { name: undefined, email: from.trim() };
}

/**
 * Brevo transactional email over HTTPS (port 443). Used when BREVO_API_KEY is set – required on
 * hosts that block outbound SMTP ports (e.g. Render's free plan).
 */
async function sendViaBrevo(msg: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: parseFrom(env.MAIL_FROM), to: [{ email: msg.to }], subject: msg.subject, htmlContent: msg.html, textContent: msg.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function send(msg: { to: string; subject: string; html: string; text: string }) {
  if (env.BREVO_API_KEY) return sendViaBrevo(msg);
  await transport.sendMail({ from: env.MAIL_FROM, ...msg });
}

/** Test hook – swap the transport (e.g. to simulate SMTP failures). */
export function setTransport(t: Transporter) {
  transport = t;
}

/** Queue an email. Delivery happens asynchronously with retries, so a slow or failing SMTP server never breaks a user request. */
export async function queueEmail<T extends TemplateName>(to: string, template: T, data: TemplateData<T>) {
  const render = templates[template] as (d: TemplateData<T>) => { subject: string; html: string; text: string };
  const { subject, html, text } = render(data);
  return EmailOutbox.create({ to, subject, html, text, template });
}

/**
 * Reserved, never-deliverable domains (RFC 2606 / RFC 6761) used for demo and test accounts.
 * Sending to them through a real SMTP server only produces bounce messages.
 */
const RESERVED_DOMAIN = /(\.(example|test|invalid|localhost)|(^|\.)example\.(com|net|org))$/i;
export const isUndeliverable = (address: string) => RESERVED_DOMAIN.test(address.split('@')[1] ?? '');

async function writeToDisk(template: string, html: string, reason: string, to: string) {
  if (env.isTest) return;
  const dir = path.resolve(env.STORAGE_LOCAL_DIR, 'mail-outbox');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${Date.now()}-${template}.html`), html);
  logger.info({ to, template }, `Email written to ${dir} (${reason})`);
}

async function deliver(id: string) {
  const job = await EmailOutbox.findById(id);
  if (!job) return;
  try {
    if (isUndeliverable(job.to)) {
      // Demo/test address: keep a copy for developers, never hand it to the SMTP server.
      job.status = 'suppressed';
      job.lastError = 'Reserved test domain – not sent';
      if (!env.isProd) await writeToDisk(job.template, job.html, 'test domain, not sent', job.to);
    } else {
      await send({ to: job.to, subject: job.subject, html: job.html, text: job.text });
      job.status = 'sent';
      job.lastError = undefined;
      if (!env.SMTP_HOST && !env.BREVO_API_KEY && env.NODE_ENV === 'development') await writeToDisk(job.template, job.html, 'no SMTP configured', job.to);
    }
    job.sentAt = new Date();
  } catch (err) {
    job.attempts += 1;
    job.lastError = (err as Error).message.slice(0, 500);
    job.status = job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
    // Exponential back-off: 1, 2, 4, 8 minutes.
    job.nextAttemptAt = new Date(Date.now() + 60_000 * 2 ** (job.attempts - 1));
    logger.warn({ to: job.to, template: job.template, attempts: job.attempts, error: job.lastError }, 'Email delivery failed');
  }
  await job.save();
}

/** Claims and delivers due emails. Atomic claim makes it safe to run on several instances. */
export async function processOutbox(batch = 20) {
  let processed = 0;
  // Recover jobs stuck in "sending" after a crash.
  await EmailOutbox.updateMany({ status: 'sending', updatedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }, { status: 'pending' });
  for (let i = 0; i < batch; i++) {
    const job = await EmailOutbox.findOneAndUpdate(
      { status: 'pending', nextAttemptAt: { $lte: new Date() } },
      { status: 'sending' },
      { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
    );
    if (!job) break;
    await deliver(String(job._id));
    processed++;
  }
  return processed;
}

let timer: NodeJS.Timeout | undefined;
let running = false;
export function startEmailWorker() {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processOutbox();
    } catch (err) {
      logger.error({ err }, 'Email worker iteration failed');
    } finally {
      running = false;
    }
  }, env.MAIL_WORKER_INTERVAL_MS);
  timer.unref();
}
export function stopEmailWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

export async function verifyTransport() {
  if (!env.SMTP_HOST) return false;
  try {
    await transport.verify();
    return true;
  } catch (err) {
    logger.error({ err }, 'SMTP verification failed');
    return false;
  }
}
