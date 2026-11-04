import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell title="Forgot your password?" subtitle="Enter your account email and we'll send you a reset link." art="auth-password"
      panelTitle="Locked out? We’ll get you back in.">
      @if (sent()) {
        <div class="alert alert-success d-flex gap-2" role="status">
          <i class="bi bi-envelope-check-fill" aria-hidden="true"></i>
          <span>If an account exists for <strong>{{ email.value }}</strong>, a password reset link has been sent. The link expires shortly, so use it soon.</span>
        </div>
        <a class="btn btn-primary w-100" routerLink="/auth/login">Back to sign in</a>
      } @else {
        <form (ngSubmit)="submit()" novalidate>
          <div class="form-floating">
            <input class="form-control" id="fp-email" type="email" [formControl]="email" autocomplete="email" placeholder=" " required />
            <label for="fp-email">Email</label>
          </div>
          <app-field-error [control]="email" label="Email" />
          <button class="btn btn-primary btn-lg w-100 mt-3" type="submit" [disabled]="loading()">
            @if (loading()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Sending… } @else { <i class="bi bi-send" aria-hidden="true"></i> Send reset link }
          </button>
        </form>
        <p class="text-center mt-4 mb-0"><a routerLink="/auth/login" class="fw-semibold"><i class="bi bi-arrow-left" aria-hidden="true"></i> Back to sign in</a></p>
      }
    </app-auth-shell>
  `,
})
export default class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  protected readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);

  submit(): void {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth
      .forgotPassword(this.email.value.trim())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => this.sent.set(true));
  }
}
