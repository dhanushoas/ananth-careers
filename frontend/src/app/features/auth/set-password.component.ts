import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { ToastService } from '../../core/services/toast.service';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PasswordFieldComponent } from '../../shared/components/password-field.component';
import { applyServerErrors, matchFieldsValidator, passwordPolicyValidator } from '../../shared/utils/form-utils';
import { AuthShellComponent } from './auth-shell.component';

/** Handles both /auth/reset-password?token= and /auth/accept-invite?token= (route data `mode`). */
@Component({
  selector: 'app-set-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, PasswordFieldComponent, AuthShellComponent],
  template: `
    <app-auth-shell
      [title]="isInvite() ? 'Join the Veejee Services recruitment team' : 'Set a new password'"
      [subtitle]="isInvite() ? 'You have been invited as a Veejee Services recruiter. Choose a password to activate your staff account.' : 'Choose a strong password you have not used before.'"
      [art]="isInvite() ? 'auth-invite' : 'auth-password'"
      [panelTitle]="isInvite() ? 'Welcome to the Veejee Services team.' : 'A fresh start for your account.'"
    >
      @if (!token()) {
        <div class="alert alert-danger d-flex gap-2" role="alert">
          <i class="bi bi-link-45deg" aria-hidden="true"></i>
          <span>This link is incomplete. Please use the link from your email{{ isInvite() ? '' : ', or request a new one' }}.</span>
        </div>
        @if (!isInvite()) {
          <a class="btn btn-primary w-100" routerLink="/auth/forgot-password">Request a new link</a>
        }
      } @else {
        @if (error()) {
          <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span></div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="row g-3 align-items-start">
            <div class="col-12">
              <app-password-field [control]="form.controls.password" label="New password" inputId="sp-password" autocomplete="new-password"
                hint="8–128 characters with at least one letter and one digit." />
            </div>
            <div class="col-12">
              <app-password-field [control]="form.controls.confirmPassword" label="Confirm password" inputId="sp-confirm" autocomplete="new-password" />
            </div>
            <div class="col-12 d-grid">
              <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Saving… } @else {
                  <i [class]="isInvite() ? 'bi bi-person-check' : 'bi bi-shield-lock'" aria-hidden="true"></i>
                  {{ isInvite() ? 'Activate account' : 'Update password' }}
                }
              </button>
            </div>
          </div>
        </form>
      }
    </app-auth-shell>
  `,
})
export default class SetPasswordComponent {
  readonly token = input<string>();
  /** From route data. */
  readonly mode = input<'reset' | 'invite'>('reset');

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly isInvite = computed(() => this.mode() === 'invite');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [matchFieldsValidator('password', 'confirmPassword')] },
  );

  submit(): void {
    const token = this.token();
    if (!token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const body = { token, password: this.form.controls.password.value };
    const request$ = this.isInvite() ? this.auth.acceptInvite(body) : this.auth.resetPassword(body);
    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => {
        this.toast.success(
          this.isInvite()
            ? 'Your recruiter account is active. Sign in to open the recruiter portal.'
            : 'Password updated. Please sign in with your new password.',
        );
        void this.router.navigateByUrl('/auth/login');
      },
      error: (err: unknown) => {
        const e = toAppError(err);
        const rest = applyServerErrors(this.form, e);
        if (!e.details.length || rest.length) {
          this.error.set(
            e.errorCode === 'NOT_FOUND' || e.errorCode === 'INVALID_STATE'
              ? 'This link is invalid or has expired.'
              : rest.join(' ') || friendlyMessage(e),
          );
        }
      },
    });
  }
}
