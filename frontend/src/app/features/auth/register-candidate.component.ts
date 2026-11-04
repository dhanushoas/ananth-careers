import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { CareerLevel } from '../../core/models';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PasswordFieldComponent } from '../../shared/components/password-field.component';
import { applyServerErrors, matchFieldsValidator, mobileValidator, passwordPolicyValidator } from '../../shared/utils/form-utils';
import { AuthShellComponent } from './auth-shell.component';
import { GoogleSigninComponent } from './google-signin.component';
import { RegistrationSuccessComponent } from './registration-success.component';

export const SHARE_CONSENT_LABEL = 'I agree that Veejee Services may share my profile with client companies for suitable roles';

@Component({
  selector: 'app-register-candidate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleSigninComponent, ...FORM_KIT, RouterLink, PasswordFieldComponent, AuthShellComponent, RegistrationSuccessComponent],
  template: `
    <app-auth-shell
      [title]="done() ? 'Check your inbox' : 'Register with Veejee Services'"
      [subtitle]="done() ? undefined : 'Create your free candidate profile. Our recruiters will match you with suitable roles at our client companies.'"
      [art]="done() ? 'auth-verify-success' : 'auth-register-seeker'"
      panelTitle="Your recruitment partner from registration to placement."
      [points]="[
        'Free for candidates – always',
        'Recruiters screen and shortlist you for suitable roles',
        'Your profile is shared only with your consent'
      ]"
    >
      @if (done()) {
        <app-registration-success [email]="form.controls.email.value" />
      } @else {
        @if (formError()) {
          <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ formError() }}</span></div>
        }
        <app-google-signin context="signup" preferredRole="candidate" />
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate data-testid="register-candidate-form">
          <div class="row g-3 align-items-start">
            <div class="col-12">
              <div class="form-floating">
                <input class="form-control" id="cd-name" formControlName="name" autocomplete="name" placeholder=" " required />
                <label for="cd-name">Full name</label>
              </div>
              <app-field-error [control]="form.controls.name" label="Full name" />
            </div>
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="cd-email" type="email" formControlName="email" autocomplete="email" placeholder=" " required />
                <label for="cd-email">Email</label>
              </div>
              <app-field-error [control]="form.controls.email" label="Email" />
            </div>
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="cd-mobile" type="tel" formControlName="mobile" autocomplete="tel" placeholder=" " required />
                <label for="cd-mobile">Mobile number</label>
              </div>
              <app-field-error [control]="form.controls.mobile" label="Mobile number" />
            </div>
            <div class="col-12 col-md-6">
              <app-password-field [control]="form.controls.password" label="Password" inputId="cd-password" autocomplete="new-password"
                hint="8+ characters with a letter and a digit." />
            </div>
            <div class="col-12 col-md-6">
              <app-password-field [control]="form.controls.confirmPassword" label="Confirm password" inputId="cd-confirm" autocomplete="new-password" />
            </div>
            <div class="col-12">
              <fieldset>
                <legend class="form-label mb-2">Career level</legend>
                <div class="btn-group w-100 level" role="group" aria-label="Career level">
                  <input type="radio" class="btn-check" id="cd-fresher" formControlName="careerLevel" value="fresher" />
                  <label class="btn btn-outline-primary" for="cd-fresher"><i class="bi bi-mortarboard" aria-hidden="true"></i> Fresher</label>
                  <input type="radio" class="btn-check" id="cd-experienced" formControlName="careerLevel" value="experienced" />
                  <label class="btn btn-outline-primary" for="cd-experienced"><i class="bi bi-briefcase" aria-hidden="true"></i> Experienced</label>
                </div>
              </fieldset>
            </div>
            <div class="col-12">
              <div class="consent card">
                <div class="card-body">
                  <div class="form-check m-0">
                    <input class="form-check-input" type="checkbox" id="cd-share" formControlName="shareProfileConsent" />
                    <label class="form-check-label" for="cd-share">{{ shareLabel }}</label>
                  </div>
                  <p class="small text-secondary mb-0 mt-2">
                    <i class="bi bi-shield-lock" aria-hidden="true"></i>
                    Optional. Companies never browse our database – we share your profile only for roles that suit you, and you can
                    change this any time in your privacy settings.
                  </p>
                </div>
              </div>
            </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="cd-terms" formControlName="acceptTerms" />
                <label class="form-check-label" for="cd-terms">I agree to the <a routerLink="/terms" target="_blank">Terms of use</a></label>
              </div>
              @if (form.controls.acceptTerms.touched && form.controls.acceptTerms.invalid) {
                <div class="invalid-feedback d-block" role="alert">You must accept the Terms of use.</div>
              }
              <div class="form-check mt-2">
                <input class="form-check-input" type="checkbox" id="cd-privacy" formControlName="acceptPrivacy" />
                <label class="form-check-label" for="cd-privacy">I have read the <a routerLink="/privacy" target="_blank">Privacy policy</a> and consent to processing of my data</label>
              </div>
              @if (form.controls.acceptPrivacy.touched && form.controls.acceptPrivacy.invalid) {
                <div class="invalid-feedback d-block" role="alert">You must accept the Privacy policy.</div>
              }
            </div>
            <div class="col-12 d-grid">
              <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Creating account… } @else { <i class="bi bi-person-plus" aria-hidden="true"></i> Create account }
              </button>
            </div>
          </div>
        </form>
        <p class="text-center text-secondary small mt-4 mb-0">Already registered? <a routerLink="/auth/login" class="fw-semibold">Sign in</a> · Hiring? <a routerLink="/auth/register/employer" class="fw-semibold">Register your company</a></p>
      }
    </app-auth-shell>
  `,
  styles: `
    fieldset { min-width: 0; }
    .level .btn { min-height: 48px; }
    .consent { background: var(--an-gold-100); border-color: var(--an-gold-300); box-shadow: none; }
  `,
})
export default class RegisterCandidateComponent {
  private readonly auth = inject(AuthService);
  protected readonly shareLabel = SHARE_CONSENT_LABEL;

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, mobileValidator]],
      password: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]],
      careerLevel: ['' as CareerLevel | ''],
      shareProfileConsent: [false],
      acceptTerms: [false, [Validators.requiredTrue]],
      acceptPrivacy: [false, [Validators.requiredTrue]],
    },
    { validators: [matchFieldsValidator('password', 'confirmPassword')] },
  );
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly formError = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.formError.set(null);
    this.auth
      .registerCandidate({
        name: v.name.trim(),
        email: v.email.trim(),
        mobile: v.mobile.trim(),
        password: v.password,
        acceptTerms: true,
        acceptPrivacy: true,
        careerLevel: v.careerLevel || undefined,
        shareProfileConsent: v.shareProfileConsent || undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.done.set(true),
        error: (err: unknown) => {
          const e = toAppError(err);
          const rest = applyServerErrors(this.form, e);
          if (e.errorCode === 'DUPLICATE_RESOURCE' || e.errorCode === 'CONFLICT') {
            this.form.controls.email.setErrors({ server: 'An account with this email already exists.' });
            this.form.controls.email.markAsTouched();
          } else if (!e.details.length || rest.length) {
            this.formError.set(rest.join(' ') || friendlyMessage(e));
          }
        },
      });
  }
}
