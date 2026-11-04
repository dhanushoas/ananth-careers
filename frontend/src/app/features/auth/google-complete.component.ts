import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService, ROLE_HOME } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { GoogleSignup, Industry } from '../../core/models';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ToastService } from '../../core/services/toast.service';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { applyServerErrors, emptyToUndefined, mobileValidator, urlValidator } from '../../shared/utils/form-utils';
import { AuthShellComponent } from './auth-shell.component';
import { GoogleSignupState } from './google-signup.state';
import { safeReturnUrl } from './login.component';

type AccountType = 'candidate' | 'employer';

/** Second step of "Continue with Google" for new users: choose account type and complete required details. */
@Component({
  selector: 'app-google-complete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell title="Finish creating your account" subtitle="Just a few details and you're in." art="auth-register"
      panelTitle="Welcome to Veejee Services.">
      @if (pending(); as p) {
        <div class="who card mb-4">
          <div class="card-body d-flex align-items-center gap-3">
            @if (p.profile.picture && !pictureFailed()) {
              <img [src]="p.profile.picture" alt="" class="avatar" referrerpolicy="no-referrer" (error)="pictureFailed.set(true)" />
            } @else {
              <span class="avatar initials" aria-hidden="true">{{ initials() }}</span>
            }
            <div class="min-w-0">
              <p class="mb-0 fw-semibold">Hi {{ p.profile.name }}!</p>
              <p class="mb-0 small text-secondary text-truncate">{{ p.profile.email }} · <i class="bi bi-google" aria-hidden="true"></i> verified by Google</p>
            </div>
          </div>
        </div>

        @if (error(); as err) {
          <div class="alert alert-danger d-flex gap-2" role="alert" data-testid="google-complete-error">
            <i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i>
            <div>
              <p class="mb-1">{{ err }}</p>
              @if (expired()) {
                <a class="btn btn-sm btn-outline-danger" [routerLink]="role() === 'employer' ? '/auth/register/employer' : '/auth/login'">Continue with Google again</a>
              }
            </div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <fieldset class="mb-3">
            <legend class="form-label">I want to</legend>
            <div class="row g-2">
              <div class="col-12 col-sm-6">
                <input type="radio" class="btn-check" id="gc-candidate" value="candidate" formControlName="role" />
                <label class="btn btn-outline-primary w-100 choice" for="gc-candidate">
                  <i class="bi bi-person-badge" aria-hidden="true"></i> Find a job <span class="small d-block fw-normal">Candidate</span>
                </label>
              </div>
              <div class="col-12 col-sm-6">
                <input type="radio" class="btn-check" id="gc-employer" value="employer" formControlName="role" />
                <label class="btn btn-outline-primary w-100 choice" for="gc-employer">
                  <i class="bi bi-buildings" aria-hidden="true"></i> Hire through us <span class="small d-block fw-normal">Company</span>
                </label>
              </div>
            </div>
          </fieldset>

          <div class="row g-3 align-items-start">
            <div class="col-12" [class.col-md-6]="role() === 'candidate'">
              <div class="form-floating">
                <input class="form-control" id="gc-mobile" type="tel" formControlName="mobile" autocomplete="tel" placeholder=" " required />
                <label for="gc-mobile">Mobile number</label>
              </div>
              <app-field-error [control]="form.controls.mobile" label="Mobile number" />
            </div>

            @if (role() === 'candidate') {
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <select class="form-select" id="gc-level" formControlName="careerLevel">
                    <option value="fresher">Fresher</option>
                    <option value="experienced">Experienced</option>
                  </select>
                  <label for="gc-level">Career level</label>
                </div>
              </div>
              <div class="col-12">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="gc-share" formControlName="shareProfileConsent" />
                  <label class="form-check-label" for="gc-share">
                    I agree that Veejee Services may share my profile with client companies for suitable roles
                  </label>
                </div>
                <div class="form-text">Optional. We only ever share your profile with a company after a recruiter shortlists you, and you can change this anytime in Settings.</div>
              </div>
            } @else {
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <input class="form-control" id="gc-company" formControlName="companyName" autocomplete="organization" placeholder=" " />
                  <label for="gc-company">Company name</label>
                </div>
                <app-field-error [control]="form.controls.companyName" label="Company name" />
              </div>
              <div class="col-12 col-md-6">
                <div class="form-floating">
                  <select class="form-select" id="gc-industry" formControlName="industryId">
                    <option value="" disabled>Select an industry</option>
                    @for (i of industries(); track i.id) {
                      <option [value]="i.id">{{ i.name }}</option>
                    }
                  </select>
                  <label for="gc-industry">Industry</label>
                </div>
                <app-field-error [control]="form.controls.industryId" label="Industry" />
              </div>
              <div class="col-12">
                <div class="form-floating">
                  <input class="form-control" id="gc-website" type="url" formControlName="website" placeholder=" " />
                  <label for="gc-website">Website (optional)</label>
                </div>
                <app-field-error [control]="form.controls.website" label="Website" />
              </div>
            }

            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="gc-terms" formControlName="acceptTerms" />
                <label class="form-check-label" for="gc-terms">I agree to the <a routerLink="/terms" target="_blank">Terms of use</a></label>
              </div>
              @if (form.controls.acceptTerms.touched && form.controls.acceptTerms.invalid) {
                <div class="invalid-feedback d-block" role="alert">You must accept the Terms of use.</div>
              }
              <div class="form-check mt-2">
                <input class="form-check-input" type="checkbox" id="gc-privacy" formControlName="acceptPrivacy" />
                <label class="form-check-label" for="gc-privacy">I have read the <a routerLink="/privacy" target="_blank">Privacy policy</a></label>
              </div>
              @if (form.controls.acceptPrivacy.touched && form.controls.acceptPrivacy.invalid) {
                <div class="invalid-feedback d-block" role="alert">You must accept the Privacy policy.</div>
              }
            </div>
            <div class="col-12 d-grid">
              <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Creating your account… } @else {
                  <i class="bi bi-check2-circle" aria-hidden="true"></i> Create my account }
              </button>
            </div>
          </div>
        </form>
      } @else {
        <div class="alert alert-info d-flex gap-2" role="status">
          <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
          <span>Your Google sign-in session has ended. Please choose “Continue with Google” again.</span>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-primary" routerLink="/auth/login">Back to sign in</a>
          <a class="btn btn-outline-primary" routerLink="/auth/register">Create an account</a>
        </div>
      }
    </app-auth-shell>
  `,
  styles: `
    .who { background: var(--an-surface-2); box-shadow: none; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex: none; }
    .initials { display: inline-flex; align-items: center; justify-content: center; background: var(--an-gold-100); color: var(--an-gold-700); font-weight: 800; }
    .min-w-0 { min-width: 0; }
    .choice { min-height: 64px; flex-direction: column; gap: 0; }
  `,
})
export default class GoogleCompleteComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly state = inject(GoogleSignupState);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly pending = this.state.pending;
  protected readonly pictureFailed = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expired = signal(false);
  protected readonly industries = toSignal(
    inject(TaxonomyService)
      .industries()
      .pipe(catchError(() => of<Industry[]>([]))),
    { initialValue: [] as Industry[] },
  );
  protected readonly initials = computed(() =>
    (this.pending()?.profile.name ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join(''),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    role: ['candidate' as AccountType, Validators.required],
    mobile: ['', [Validators.required, mobileValidator]],
    careerLevel: ['fresher' as 'fresher' | 'experienced'],
    shareProfileConsent: [false],
    companyName: [''],
    industryId: [''],
    website: ['', [urlValidator]],
    acceptTerms: [false, Validators.requiredTrue],
    acceptPrivacy: [false, Validators.requiredTrue],
  });
  protected readonly role = toSignal(this.form.controls.role.valueChanges, { initialValue: 'candidate' as AccountType });

  ngOnInit(): void {
    const preferred = this.pending()?.preferredRole;
    if (preferred) {
      this.form.controls.role.setValue(preferred);
    }
    this.form.controls.role.valueChanges.subscribe((r) => this.applyRoleValidators(r));
    this.applyRoleValidators(this.form.controls.role.value);
  }

  private applyRoleValidators(role: AccountType): void {
    const { companyName, industryId } = this.form.controls;
    companyName.setValidators(role === 'employer' ? [Validators.required, Validators.minLength(2), Validators.maxLength(150)] : []);
    industryId.setValidators(role === 'employer' ? [Validators.required] : []);
    companyName.updateValueAndValidity({ emitEvent: false });
    industryId.updateValueAndValidity({ emitEvent: false });
  }

  submit(): void {
    const p = this.pending();
    if (!p) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const signup: GoogleSignup =
      v.role === 'candidate'
        ? {
            role: 'candidate',
            mobile: v.mobile.trim(),
            acceptTerms: true,
            acceptPrivacy: true,
            careerLevel: v.careerLevel,
            shareProfileConsent: v.shareProfileConsent,
          }
        : {
            role: 'employer',
            mobile: v.mobile.trim(),
            acceptTerms: true,
            acceptPrivacy: true,
            companyName: v.companyName.trim(),
            industryId: v.industryId,
            website: emptyToUndefined(v.website),
          };
    this.loading.set(true);
    this.error.set(null);
    this.expired.set(false);
    this.auth
      .googleAuth(p.credential, signup)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          if (res.status === 'signed_in') {
            this.state.clear();
            this.toast.success(`Welcome to Veejee Services, ${res.user.name.split(' ')[0]}!`);
            void this.router.navigateByUrl(safeReturnUrl(p.returnUrl) ?? ROLE_HOME[res.user.role]);
          } else {
            this.error.set('We could not finish creating your account. Please try again.');
          }
        },
        error: (err: unknown) => {
          const e = toAppError(err);
          if (e.errorCode === 'GOOGLE_TOKEN_INVALID' || e.status === 401) {
            this.expired.set(true);

            this.error.set('Your Google sign-in has expired. Please click “Continue with Google” again.');
            return;
          }
          const rest = applyServerErrors(this.form, e);
          if (!e.details.length || rest.length) {
            this.error.set(rest.join(' ') || friendlyMessage(e));
          }
        },
      });
  }
}
