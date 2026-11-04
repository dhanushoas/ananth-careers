import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Suppress the global error toast for this request (caller handles errors itself). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Do not attempt a token refresh + retry when this request returns TOKEN_EXPIRED. */
export const SKIP_AUTH_RETRY = new HttpContextToken<boolean>(() => false);

export function silentContext(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}
