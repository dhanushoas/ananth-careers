import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AccountService } from '../../core/services/account.service';
import { toAppError, friendlyMessage } from '../../core/http/api-error';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { MODAL_DATA, ModalRef } from '../../shared/ui/modal.service';

export interface DeleteAccountDialogData {
  /** Google-only account (no password): confirm by typing DELETE. */
  passwordless?: boolean;
}

/**
 * Confirms permanent account deletion. Password accounts confirm with their password; accounts that
 * sign in with Google (no password) type DELETE. Closes with `true` on success.
 */
@Component({
  selector: 'app-delete-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5 d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle-fill text-danger" aria-hidden="true"></i> Delete your account?
        </h2>
        <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss [disabled]="busy()"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-flex gap-2" role="note">
          <i class="bi bi-shield-exclamation" aria-hidden="true"></i>
          <span>This permanently anonymises your account, deletes your resumes and signs you out everywhere. This cannot be undone.</span>
        </div>
        @if (!passwordless()) {
          <div class="input-group">
            <div class="form-floating">
              <input class="form-control" id="del-password" [type]="show() ? 'text' : 'password'" formControlName="password"
                autocomplete="current-password" placeholder=" " data-testid="delete-password" data-autofocus />
              <label for="del-password">Confirm your password</label>
            </div>
            <button class="btn btn-outline-secondary" type="button" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
              <i [class]="show() ? 'bi bi-eye-slash' : 'bi bi-eye'" aria-hidden="true"></i>
            </button>
          </div>
          <app-field-error [control]="form.controls.password" label="Password" />
          <button type="button" class="btn btn-link btn-sm px-0 mt-2" (click)="usePasswordless()">
            <i class="bi bi-google" aria-hidden="true"></i> I sign in with Google and don’t have a password
          </button>
        } @else {
          <p class="small text-secondary">You sign in with Google, so there’s no password to confirm. Type <strong>DELETE</strong> to confirm.</p>
          <div class="form-floating">
            <input class="form-control" id="del-confirm" formControlName="confirm" autocomplete="off" placeholder=" "
              data-testid="delete-confirm" data-autofocus />
            <label for="del-confirm">Type DELETE to confirm</label>
          </div>
          @if (form.controls.confirm.touched && form.controls.confirm.invalid) {
            <div class="invalid-feedback d-block" role="alert">Please type DELETE in capital letters.</div>
          }
        }
        @if (error()) {
          <div class="invalid-feedback d-block" role="alert">{{ error() }}</div>
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-secondary" type="button" data-modal-dismiss [disabled]="busy()">Cancel</button>
        <button class="btn btn-danger" type="submit" [disabled]="busy()">
          @if (busy()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Deleting…
          } @else {
            <i class="bi bi-trash3" aria-hidden="true"></i> Delete account
          }
        </button>
      </div>
    </form>
  `,
})
export class DeleteAccountDialogComponent {
  private readonly account = inject(AccountService);
  private readonly ref = inject<ModalRef<boolean>>(ModalRef);
  private readonly data = inject<DeleteAccountDialogData | undefined>(MODAL_DATA, { optional: true });

  protected readonly passwordless = signal(this.data?.passwordless === true);
  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', this.passwordless() ? [] : [Validators.required]],
    confirm: ['', this.passwordless() ? [Validators.required, Validators.pattern(/^DELETE$/)] : []],
  });
  protected readonly busy = signal(false);
  protected readonly show = signal(false);
  protected readonly error = signal<string | null>(null);

  usePasswordless(): void {
    this.passwordless.set(true);
    this.error.set(null);
    const { password, confirm } = this.form.controls;
    password.clearValidators();
    password.setValue('');
    password.updateValueAndValidity();
    confirm.setValidators([Validators.required, Validators.pattern(/^DELETE$/)]);
    confirm.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const confirmation = this.passwordless() ? ({ confirm: 'DELETE' } as const) : this.form.controls.password.value;
    this.account
      .deleteAccount(confirmation)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.ref.close(true),
        error: (err: unknown) => {
          const e = toAppError(err);
          if (!this.passwordless() && e.status === 400 && /google|DELETE/i.test(e.message)) {
            this.usePasswordless();
            this.error.set('This account signs in with Google. Type DELETE to confirm instead.');
          } else if (e.errorCode === 'INVALID_CREDENTIALS') {
            this.form.controls.password.setErrors({ server: 'The password you entered is incorrect.' });
            this.form.controls.password.markAsTouched();
          } else {
            this.error.set(friendlyMessage(e));
          }
        },
      });
  }
}
