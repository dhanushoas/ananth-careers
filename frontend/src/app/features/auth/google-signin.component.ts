import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnInit,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, ROLE_HOME } from '../../core/auth/auth.service';
import { GoogleIdentityService } from '../../core/auth/google-identity.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { ToastService } from '../../core/services/toast.service';
import { GoogleSignupState } from './google-signup.state';
import { safeReturnUrl } from './login.component';

/**
 * "Continue with Google" block (official GIS button + "or" divider). Renders nothing unless
 * GET /auth/providers reports Google as enabled; the client id is always taken from that response.
 */
@Component({
  selector: 'app-google-signin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <div class="google-block" data-testid="google-signin">
        @if (error()) {
          <div class="alert alert-danger d-flex gap-2 py-2 small" role="alert" data-testid="google-error">
            <i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span>
          </div>
        }
        <div class="btn-slot" #slot aria-label="Continue with Google"></div>
        @if (busy()) {
          <p class="small text-secondary text-center mt-2 mb-0" role="status">
            <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Signing you in with Google…
          </p>
        }
        @if (loadFailed()) {
          <p class="small text-secondary text-center mb-0">Google sign-in is unavailable right now. Please use your email instead.</p>
        }
        <div class="or" role="separator" aria-label="or"><span>or</span></div>
      </div>
    }
  `,
  styles: `
    .google-block { margin-bottom: var(--an-space-2); }
    .btn-slot { display: flex; justify-content: center; min-height: 44px; width: 100%; }
    .or { display: flex; align-items: center; gap: var(--an-space-3); margin: var(--an-space-4) 0 var(--an-space-3);
      color: var(--an-text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--an-border); }
  `,
})
export class GoogleSigninComponent implements OnInit {
  readonly context = input<'signin' | 'signup'>('signin');
  readonly returnUrl = input<string | undefined>();
  readonly preferredRole = input<'candidate' | 'employer' | undefined>();

  private readonly auth = inject(AuthService);
  private readonly gis = inject(GoogleIdentityService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly pending = inject(GoogleSignupState);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot');
  private destroyed = false;

  protected readonly enabled = signal(false);
  protected readonly busy = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => (this.destroyed = true));
    this.auth.providers().subscribe((p) => {
      if (this.destroyed || !p.google.enabled || !p.google.clientId) {
        return;
      }
      this.clientId.set(p.google.clientId);
      this.enabled.set(true);
    });
  }

  /** Client id from /auth/providers; the button is drawn once the slot exists. */
  private readonly clientId = signal<string | null>(null);
  private rendered = false;

  constructor() {
    effect(() => {
      const el = this.slot()?.nativeElement;
      const clientId = this.clientId();
      if (!el || !clientId || this.rendered || this.destroyed) {
        return;
      }
      this.rendered = true;
      this.gis
        .renderButton(el, clientId, this.context(), (credential) => this.zone.run(() => this.onCredential(credential)))
        .catch(() => {
          this.rendered = false;
          this.loadFailed.set(true);
        });
    });
  }

  private onCredential(credential: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.auth.googleAuth(credential).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.status === 'signed_in') {
          this.toast.success(`Welcome, ${res.user.name.split(' ')[0]}!`);
          void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? ROLE_HOME[res.user.role]);
        } else {
          this.pending.set({ credential, profile: res.profile, returnUrl: this.returnUrl(), preferredRole: this.preferredRole() });
          void this.router.navigateByUrl('/auth/google-complete');
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const e = toAppError(err);
        this.error.set(
          e.errorCode === 'CONFLICT' || e.status === 409
            ? e.message || 'This email is linked to a different Google account. Sign in with your email and password instead.'
            : friendlyMessage(e),
        );
      },
    });
  }
}
