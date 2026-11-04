import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_NAME: z.string().default('Veejee Services'),
    /** Public URL of the Angular app – used to build links in emails. */
    FRONTEND_URL: z.url().default('http://localhost:4200'),
    /** Comma separated CORS allow-list. */
    CORS_ORIGINS: z.string().default('http://localhost:4200'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/ananth'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SECURE: bool.optional(),
    /** OAuth 2.0 Web client ID from Google Cloud Console (public value). Enables "Continue with Google". */
    GOOGLE_CLIENT_ID: z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/, 'Must be a Google OAuth web client ID').optional(),

    /** 32-byte key, base64 encoded – encrypts stored files (AES-256-GCM). */
    FILE_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'FILE_ENCRYPTION_KEY must be 32 bytes, base64 encoded'),

    STORAGE_DRIVER: z.enum(['local', 's3', 'mongo']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('ap-south-1'),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool.default(false),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: bool.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /** Brevo transactional email API key – sends over HTTPS (works where SMTP ports are blocked). */
    BREVO_API_KEY: z.string().min(20).optional(),
    MAIL_FROM: z.string().default('Veejee Services <no-reply@veejee.example>'),
    MAIL_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(10000),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    CONTACT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((v, ctx) => {
    if (v.STORAGE_DRIVER === 's3' && !v.S3_BUCKET) {
      ctx.addIssue({ code: 'custom', path: ['S3_BUCKET'], message: 'S3_BUCKET is required when STORAGE_DRIVER=s3' });
    }
    if (v.NODE_ENV === 'production') {
      if (!v.SMTP_HOST && !v.BREVO_API_KEY) ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'Configure BREVO_API_KEY or SMTP_HOST in production' });
      if (v.COOKIE_SECURE === false)
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Cookies must be secure in production' });
    }
  });

export type Env = z.infer<typeof schema> & { corsOrigins: string[]; cookieSecure: boolean; isProd: boolean; isTest: boolean };

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Fail fast: a misconfigured server must never start.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const v = parsed.data;
  return {
    ...v,
    corsOrigins: v.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    cookieSecure: v.COOKIE_SECURE ?? v.NODE_ENV === 'production',
    isProd: v.NODE_ENV === 'production',
    isTest: v.NODE_ENV === 'test',
  };
}

export const env = load();
