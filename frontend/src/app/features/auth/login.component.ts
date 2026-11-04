import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, ROLE_HOME } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { AppError } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PasswordFieldComponent } from '../../shared/components/password-field.component';
import { AuthShellComponent } from './auth-shell.component';
import { GoogleSigninComponent } from './google-signin.component';

/** Only allow same-app relative return URLs (open-redirect defence). */
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/auth')) {
    return null;
  }
  return url;
}

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleSigninComponent, ...FORM_KIT, RouterLink, PasswordFieldComponent, AuthShellComponent],
  template: `
    <app-auth-shell title="Welcome back" subtitle="Sign in to your Veejee Services account – candidates, companies and recruiters." art="auth-login">
      @if (error(); as e) {
        <div class="alert alert-danger d-flex gap-2" role="alert" data-testid="login-error">
          <i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i>
          <div>
            <p class="mb-1">{{ message(e) }}</p>
            @if (e.errorCode === 'EMAIL_NOT_VERIFIED') {
              <button class="btn btn-sm btn-outline-danger" type="button" (click)="resend()" [disabled]="resending()">Resend verification email</button>
            }
          </div>
        </div>
      }
      <app-google-signin context="signin" [returnUrl]="returnUrl()" />
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <input class="form-control" id="login-email" type="email" formControlName="email" autocomplete="email" placeholder=" " required />
              <label for="login-email">Email</label>
            </div>
            <app-field-error [control]="form.controls.email" label="Email" />
          </div>
          <div class="col-12">
            <app-password-field [control]="form.controls.password" label="Password" inputId="login-password" autocomplete="current-password" />
          </div>
          <div class="col-12 d-flex justify-content-end">
            <a routerLink="/auth/forgot-password" class="small fw-semibold">Forgot password?</a>
          </div>
          <div class="col-12 d-grid">
            <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span class="visually-hidden">Signing in</span>
              } @else {
                <i class="bi bi-box-arrow-in-right" aria-hidden="true"></i>
              }
              Sign in
            </button>
          </div>
        </div>
      </form>
      <p class="text-center text-secondary mt-4 mb-0">New to Veejee Services? <a routerLink="/auth/register" class="fw-semibold">Create an account</a></p>
    </app-auth-shell>
  `,
})
export default class LoginComponent {
  /** Bound from ?returnUrl= */
  readonly returnUrl = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly loading = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal<AppError | null>(null);

  protected message(e: AppError): string {
    return friendlyMessage(e);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth
      .login({ email: email.trim(), password })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (user) => {
          this.toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
          void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? ROLE_HOME[user.role]);
        },
        error: (err: unknown) => this.error.set(toAppError(err)),
      });
  }

  resend(): void {
    const email = this.form.controls.email.value.trim();
    if (!email) {
      return;
    }
    this.resending.set(true);
    this.auth
      .resendVerification(email)
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe(() => this.toast.success('If the account exists, a new verification email is on its way.'));
  }
}
