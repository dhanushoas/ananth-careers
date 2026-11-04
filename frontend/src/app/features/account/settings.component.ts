import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountService } from '../../core/services/account.service';
import { ToastService } from '../../core/services/toast.service';
import { toAppError } from '../../core/http/api-error';
import { AuthUser, ConsentHistoryEntry, ConsentResponse } from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { ModalService } from '../../shared/ui/modal.service';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { saveJson } from '../../shared/utils/download';
import {
  applyServerErrors,
  matchFieldsValidator,
  mobileValidator,
  passwordPolicyValidator,
} from '../../shared/utils/form-utils';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

/** Account settings shared by every role (mounted at `<role home>/settings`). */
@Component({
  selector: 'app-account-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ...FORM_KIT,
    PageHeaderComponent,
    IllustrationComponent,
    FileUploadComponent,
    UserAvatarComponent,
    EnumLabelPipe,
    DatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export default class SettingsComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly candidates = inject(CandidateService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly avatarVersion = signal(0);
  protected readonly savingDetails = signal(false);
  protected readonly avatarBusy = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly consentBusy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly signingOutAll = signal(false);
  protected readonly marketing = signal(false);
  protected readonly profileSharing = signal(false);
  protected readonly contactSharing = signal(false);
  protected readonly consentHistory = signal<ConsentHistoryEntry[]>([]);
  protected readonly consentLoading = signal(false);
  protected readonly privacyBusy = signal(false);
  protected readonly showPasswords = signal(false);

  protected readonly details = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    mobile: ['', [Validators.required, mobileValidator]],
  });

  protected readonly password = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [matchFieldsValidator('newPassword', 'confirmPassword')] },
  );

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.details.setValue({ name: user.name, mobile: user.mobile ?? '' });
      // v2 returns marketing consent under user.consent.marketingEmails.
      const nested = (user as AuthUser & { consent?: { marketingEmails?: boolean } }).consent;
      this.marketing.set(user.marketingEmails ?? nested?.marketingEmails ?? false);
    }
    if (this.auth.role() === 'candidate') {
      this.loadConsent();
    }
  }

  private applyConsent(res: ConsentResponse): void {
    this.profileSharing.set(res.current.profileSharing);
    this.contactSharing.set(res.current.contactSharing);
    this.consentHistory.set(
      [...(res.history ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
  }

  private loadConsent(): void {
    this.consentLoading.set(true);
    this.candidates
      .consent()
      .pipe(
        finalize(() => this.consentLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.applyConsent(res));
  }

  consentLabel(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('contact')) return 'Contact sharing';
    if (t.includes('profile')) return 'Profile sharing';
    if (t.includes('privacy')) return 'Privacy policy';
    if (t.includes('term')) return 'Terms of use';
    if (t.includes('marketing')) return 'Marketing emails';
    return type;
  }

  setProfileSharing(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.checked;
    // Turning profile sharing off also withdraws contact sharing.
    this.savePrivacy(value ? { profileSharing: true } : { profileSharing: false, contactSharing: false }, input);
  }

  setContactSharing(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.savePrivacy({ contactSharing: input.checked }, input);
  }

  private savePrivacy(body: { profileSharing?: boolean; contactSharing?: boolean }, input: HTMLInputElement): void {
    this.privacyBusy.set(true);
    this.candidates
      .updateConsent(body)
      .pipe(finalize(() => this.privacyBusy.set(false)))
      .subscribe({
        next: (res) => {
          this.applyConsent(res);
          this.toast.success('Privacy preferences updated');
        },
        error: () => {
          input.checked = !input.checked;
        },
      });
  }

  saveDetails(): void {
    if (this.details.invalid) {
      this.details.markAllAsTouched();
      return;
    }
    const v = this.details.getRawValue();
    this.savingDetails.set(true);
    this.account
      .updateMe({ name: v.name.trim(), mobile: v.mobile.trim() })
      .pipe(finalize(() => this.savingDetails.set(false)))
      .subscribe({
        next: () => {
          this.details.markAsPristine();
          this.toast.success('Your details have been updated.');
        },
        error: (err: unknown) => applyServerErrors(this.details, toAppError(err)),
      });
  }

  uploadAvatar(file: File): void {
    this.avatarBusy.set(true);
    this.account
      .uploadAvatar(file)
      .pipe(finalize(() => this.avatarBusy.set(false)))
      .subscribe(() => {
        this.avatarVersion.update((v) => v + 1);
        this.toast.success('Profile photo updated.');
      });
  }

  removeAvatar(): void {
    this.avatarBusy.set(true);
    this.account
      .deleteAvatar()
      .pipe(finalize(() => this.avatarBusy.set(false)))
      .subscribe(() => {
        this.avatarVersion.update((v) => v + 1);
        this.toast.success('Profile photo removed.');
      });
  }

  /** True once the server reports this is a Google-only account without a password. */
  protected readonly googleOnly = signal(false);

  changePassword(): void {
    if (this.password.invalid) {
      this.password.markAllAsTouched();
      return;
    }
    const v = this.password.getRawValue();
    this.savingPassword.set(true);
    this.auth
      .changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword })
      .pipe(finalize(() => this.savingPassword.set(false)))
      .subscribe({
        next: () => {
          this.password.reset();
          this.toast.success('Your password has been changed.');
        },
        error: (err: unknown) => {
          const e = toAppError(err);
          if (e.status === 400 && /google/i.test(e.message)) {
            this.googleOnly.set(true);
            this.password.reset();
            return;
          }
          if (e.errorCode === 'INVALID_CREDENTIALS') {
            this.password.controls.currentPassword.setErrors({ server: 'Your current password is incorrect.' });
            this.password.controls.currentPassword.markAsTouched();
            return;
          }
          const unmatched = applyServerErrors(this.password, e);
          if (unmatched.length || !e.details.length) {
            this.toast.error(unmatched.join(' ') || e.message);
          }
        },
      });
  }

  toggleConsent(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.checked;
    this.consentBusy.set(true);
    this.account
      .updateConsent(value)
      .pipe(finalize(() => this.consentBusy.set(false)))
      .subscribe({
        next: () => {
          this.marketing.set(value);
          this.toast.success(value ? 'You will receive career updates by email.' : 'You have unsubscribed from marketing emails.');
        },
        error: () => {
          input.checked = !value;
          this.marketing.set(!value);
        },
      });
  }

  exportData(): void {
    this.exporting.set(true);
    this.account
      .exportData()
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((data) => {
        saveJson(data, 'veejee-my-data.json');
        this.toast.success('Your data export has been downloaded.');
      });
  }

  logoutAll(): void {
    this.confirm
      .open({
        title: 'Sign out of all devices?',
        message: 'You will be signed out everywhere, including this browser.',
        confirmText: 'Sign out everywhere',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.signingOutAll.set(true);
        this.auth
          .logoutAll()
          .pipe(finalize(() => this.signingOutAll.set(false)))
          .subscribe(() => this.toast.success('You have been signed out of all devices.'));
      });
  }

  deleteAccount(): void {
    this.modal
      .open<DeleteAccountDialogComponent, { passwordless: boolean }, boolean>(DeleteAccountDialogComponent, {
        data: { passwordless: this.googleOnly() },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.auth.clearSession();
          this.toast.success('Your account has been deleted.');
          void this.router.navigateByUrl('/');
        }
      });
  }
}
