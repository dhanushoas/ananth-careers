import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { ToastService } from '../../core/services/toast.service';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { IllustrationName } from '../../shared/illustrations/illustration.component';
import { AuthShellComponent } from './auth-shell.component';

type State = 'verifying' | 'success' | 'error' | 'missing';

@Component({
  selector: 'app-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell title="Email verification" [art]="art()" [panelTitle]="state() === 'success' ? 'You are all set.' : 'Let’s confirm it’s you.'">
      @switch (state()) {
        @case ('verifying') {
          <div class="text-center py-4" role="status">
            <div class="spinner-border text-primary" aria-hidden="true"></div>
            <p class="mt-3 mb-0 text-secondary">Verifying your email…</p>
          </div>
        }
        @case ('success') {
          <div class="alert alert-success d-flex gap-2" role="status">
            <i class="bi bi-patch-check-fill" aria-hidden="true"></i><span>Your email is verified. You can now sign in.</span>
          </div>
          <a class="btn btn-primary btn-lg w-100" routerLink="/auth/login"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Sign in</a>
        }
        @default {
          <div class="alert alert-danger d-flex gap-2" role="alert">
            <i class="bi bi-link-45deg" aria-hidden="true"></i>
            <span>{{ state() === 'missing' ? 'This verification link is incomplete.' : errorMessage() }}</span>
          </div>
          <p class="text-secondary">Enter your email and we'll send you a fresh verification link.</p>
          <form (ngSubmit)="resend()" novalidate>
            <div class="form-floating">
              <input class="form-control" id="ve-email" type="email" [formControl]="email" autocomplete="email" placeholder=" " />
              <label for="ve-email">Email</label>
            </div>
            <app-field-error [control]="email" label="Email" />
            <button class="btn btn-primary w-100 mt-3" type="submit" [disabled]="sending()">
              <i class="bi bi-envelope-arrow-up" aria-hidden="true"></i> Resend verification email
            </button>
          </form>
        }
      }
    </app-auth-shell>
  `,
})
export default class VerifyEmailComponent implements OnInit {
  readonly token = input<string>();
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly state = signal<State>('verifying');
  protected readonly errorMessage = signal('');
  protected readonly sending = signal(false);
  protected readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected readonly art = computed<IllustrationName>(() =>
    this.state() === 'success' ? 'auth-verify-success' : this.state() === 'verifying' ? 'auth-login' : 'auth-verify-fail',
  );

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('missing');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      error: (err: unknown) => {
        const e = toAppError(err);
        this.errorMessage.set(
          e.errorCode === 'VALIDATION_ERROR' || e.errorCode === 'NOT_FOUND' || e.errorCode === 'INVALID_STATE'
            ? 'This verification link is invalid or has expired.'
            : friendlyMessage(e),
        );
        this.state.set('error');
      },
    });
  }

  resend(): void {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.sending.set(true);
    this.auth
      .resendVerification(this.email.value.trim())
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe(() => this.toast.success('If an unverified account exists for this email, a new link has been sent.'));
  }
}
