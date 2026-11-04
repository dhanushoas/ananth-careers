import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { Industry } from '../../core/models';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PasswordFieldComponent } from '../../shared/components/password-field.component';
import {
  applyServerErrors,
  emptyToUndefined,
  matchFieldsValidator,
  mobileValidator,
  passwordPolicyValidator,
  urlValidator,
} from '../../shared/utils/form-utils';
import { AuthShellComponent } from './auth-shell.component';
import { GoogleSigninComponent } from './google-signin.component';
import { RegistrationSuccessComponent } from './registration-success.component';

@Component({
  selector: 'app-register-employer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleSigninComponent, ...FORM_KIT, RouterLink, PasswordFieldComponent, AuthShellComponent, RegistrationSuccessComponent],
  template: `
    <app-auth-shell
      [title]="done() ? 'Check your inbox' : 'Register your company'"
      [subtitle]="done() ? undefined : 'Post recruitment requirements once Veejee Services verifies your company – we send you screened candidates.'"
      [art]="done() ? 'auth-verify-success' : 'auth-register-employer'"
      panelTitle="Screened candidates for every requirement."
      [points]="['Post recruitment requirements', 'Receive shortlisted, consented candidates', 'Veejee Services schedules every interview']"
    >
      @if (done()) {
        <app-registration-success [email]="form.controls.email.value">
          <p class="small text-secondary mb-0">After verifying your email, our team will review <strong>{{ form.controls.companyName.value }}</strong>. Your requirements go live once Veejee Services has verified the company.</p>
        </app-registration-success>
      } @else {
        @if (formError()) {
          <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ formError() }}</span></div>
        }
        <app-google-signin context="signup" preferredRole="employer" />
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <fieldset class="mb-4">
            <legend class="legend"><span class="step">1</span> Your details</legend>
            <div class="row g-3 align-items-start">
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <input class="form-control" id="em-name" formControlName="name" autocomplete="name" placeholder=" " required />
                  <label for="em-name">Full name</label>
                </div>
                <app-field-error [control]="form.controls.name" label="Full name" />
              </div>
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <input class="form-control" id="em-mobile" type="tel" formControlName="mobile" autocomplete="tel" placeholder=" " required />
                  <label for="em-mobile">Mobile number</label>
                </div>
                <app-field-error [control]="form.controls.mobile" label="Mobile number" />
              </div>
              <div class="col-12">
                <div class="form-floating">
                  <input class="form-control" id="em-email" type="email" formControlName="email" autocomplete="email" placeholder=" " required />
                  <label for="em-email">Work email</label>
                </div>
                <app-field-error [control]="form.controls.email" label="Work email" />
              </div>
              <div class="col-12 col-md-6">
                <app-password-field [control]="form.controls.password" label="Password" inputId="em-password" autocomplete="new-password"
                  hint="8+ characters, a letter and a digit." />
              </div>
              <div class="col-12 col-md-6">
                <app-password-field [control]="form.controls.confirmPassword" label="Confirm password" inputId="em-confirm" autocomplete="new-password" />
              </div>
            </div>
          </fieldset>
          <fieldset class="mb-4">
            <legend class="legend"><span class="step">2</span> Company</legend>
            <div class="row g-3 align-items-start">
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <input class="form-control" id="em-company" formControlName="companyName" autocomplete="organization" placeholder=" " required />
                  <label for="em-company">Company name</label>
                </div>
                <app-field-error [control]="form.controls.companyName" label="Company name" />
              </div>
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <select class="form-select" id="em-industry" formControlName="industryId" required>
                    <option value="" disabled>Select an industry</option>
                    @for (i of industries(); track i.id) {
                      <option [value]="i.id">{{ i.name }}</option>
                    }
                  </select>
                  <label for="em-industry">Industry</label>
                </div>
                <app-field-error [control]="form.controls.industryId" label="Industry" />
              </div>
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <input class="form-control" id="em-website" type="url" formControlName="website" placeholder=" " />
                  <label for="em-website">Website (optional)</label>
                </div>
                <app-field-error [control]="form.controls.website" label="Website" />
              </div>
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <input class="form-control" id="em-reg" formControlName="registrationNumber" placeholder=" " aria-describedby="em-reg-hint" />
                  <label for="em-reg">Registration number (optional)</label>
                </div>
                <app-field-error [control]="form.controls.registrationNumber" label="Registration number" />
                <div class="form-text" id="em-reg-hint">CIN / GSTIN helps us verify faster.</div>
              </div>
            </div>
          </fieldset>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="em-terms" formControlName="acceptTerms" />
            <label class="form-check-label" for="em-terms">I agree to the <a routerLink="/terms" target="_blank">Terms of use</a></label>
          </div>
          @if (form.controls.acceptTerms.touched && form.controls.acceptTerms.invalid) {
            <div class="invalid-feedback d-block" role="alert">You must accept the Terms of use.</div>
          }
          <div class="form-check mt-2">
            <input class="form-check-input" type="checkbox" id="em-privacy" formControlName="acceptPrivacy" />
            <label class="form-check-label" for="em-privacy">I have read the <a routerLink="/privacy" target="_blank">Privacy policy</a></label>
          </div>
          @if (form.controls.acceptPrivacy.touched && form.controls.acceptPrivacy.invalid) {
            <div class="invalid-feedback d-block" role="alert">You must accept the Privacy policy.</div>
          }
          <div class="d-grid mt-4">
            <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
              @if (loading()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Registering… } @else { <i class="bi bi-building-add" aria-hidden="true"></i> Register company }
            </button>
          </div>
        </form>
        <p class="text-center text-secondary mt-4 mb-0">Already registered? <a routerLink="/auth/login" class="fw-semibold">Sign in</a></p>
      }
    </app-auth-shell>
  `,
  styles: `
    fieldset { min-width: 0; }
    .legend { font-family: var(--an-font-heading); font-weight: 700; color: var(--an-navy-900); font-size: 1.05rem; display: flex; align-items: center; gap: 10px; margin-bottom: var(--an-space-3); }
    .step { width: 28px; height: 28px; border-radius: 50%; background: var(--an-gold-100); color: var(--an-gold-700); border: 1px solid var(--an-gold-300);
      display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; }
  `,
})
export default class RegisterEmployerComponent {
  private readonly auth = inject(AuthService);
  protected readonly industries = toSignal(
    inject(TaxonomyService)
      .industries()
      .pipe(catchError(() => of<Industry[]>([]))),
    { initialValue: [] as Industry[] },
  );

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, mobileValidator]],
      password: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]],
      companyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      industryId: ['', [Validators.required]],
      website: ['', [urlValidator]],
      registrationNumber: ['', [Validators.maxLength(50)]],
      acceptTerms: [false, [Validators.requiredTrue]],
      acceptPrivacy: [false, [Validators.requiredTrue]],
    },
    { validators: [matchFieldsValidator('password', 'confirmPassword')] },
  );
  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly formError = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.formError.set(null);
    this.auth
      .registerEmployer({
        name: v.name.trim(),
        email: v.email.trim(),
        mobile: v.mobile.trim(),
        password: v.password,
        companyName: v.companyName.trim(),
        industryId: v.industryId,
        website: emptyToUndefined(v.website),
        registrationNumber: emptyToUndefined(v.registrationNumber),
        acceptTerms: true,
        acceptPrivacy: true,
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
