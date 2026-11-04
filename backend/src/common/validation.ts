import { Types } from 'mongoose';
import { z } from 'zod';

/**
 * Removes all HTML markup: dangerous blocks with their contents, comments, then any tag.
 * Repeats until stable so nested tricks like `<scr<script>ipt>` cannot survive.
 * Output is plain text; the Angular client additionally escapes everything it renders.
 */
export function stripHtml(input: string) {
  let prev: string;
  let out = input.replace(/\u0000/g, '');
  do {
    prev = out;
    out = out
      .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?(<\/\1\s*>|$)/gi, '')
      .replace(/<!--[\s\S]*?(-->|$)/g, '')
      .replace(/<\/?[a-zA-Z!?][^>]*(>|$)/g, '');
  } while (out !== prev);
  return out;
}

/** Plain text field: trims and strips any HTML markup (stored XSS defence). */
export const text = (max = 200, min = 0) =>
  z
    .string()
    .transform((s) => stripHtml(s).trim())
    .pipe(z.string().min(min, min ? `Must be at least ${min} characters` : undefined).max(max, `Must be at most ${max} characters`));

export const requiredText = (max = 200, min = 1) => text(max, min);

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v) && String(new Types.ObjectId(v)) === v, 'Invalid id');

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

/** Indian mobile numbers (+91 optional) or generic E.164. */
export const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$|^\+[1-9]\d{7,14}$/, 'Enter a valid mobile number'));

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)));

export const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

export const idParam = z.object({ id: objectId });
