import { Injectable, signal } from '@angular/core';

export interface PendingGoogleSignup {
  /** Google ID token — kept in memory only, never persisted. */
  credential: string;
  profile: { email: string; name: string; picture?: string | null };
  /** Where to go after sign-in (validated by safeReturnUrl). */
  returnUrl?: string;
  /** Pre-selected account type, e.g. when started from the company registration page. */
  preferredRole?: 'candidate' | 'employer';
}

/** Hands the Google credential from the login/register page to /auth/google-complete (memory only). */
@Injectable({ providedIn: 'root' })
export class GoogleSignupState {
  readonly pending = signal<PendingGoogleSignup | null>(null);

  set(value: PendingGoogleSignup): void {
    this.pending.set(value);
  }

  clear(): void {
    this.pending.set(null);
  }
}
