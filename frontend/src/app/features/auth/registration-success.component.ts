import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';

@Component({
  selector: 'app-registration-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IllustrationComponent],
  template: `
    <div class="ok" role="status" data-testid="registration-success">
      <app-illustration name="success" class="art" />
      <p class="mb-0">We've sent a verification link to <strong>{{ email() }}</strong>. Open it to activate your account, then sign in.</p>
      <ng-content />
      <div class="d-flex flex-wrap justify-content-center gap-2 mt-2">
        <a class="btn btn-primary" routerLink="/auth/login"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Go to sign in</a>
        <button class="btn btn-outline-primary" type="button" (click)="resend()" [disabled]="sending()">
          <i class="bi bi-envelope-arrow-up" aria-hidden="true"></i> Resend email
        </button>
      </div>
    </div>
  `,
  styles: `
    .ok { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--an-space-3); color: var(--an-text-2); }
    .art { width: 170px; }
  `,
})
export class RegistrationSuccessComponent {
  readonly email = input.required<string>();
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly sending = signal(false);

  resend(): void {
    this.sending.set(true);
    this.auth
      .resendVerification(this.email())
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe(() => this.toast.success('Verification email sent again.'));
  }
}
