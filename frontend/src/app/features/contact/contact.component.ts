import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ContentService } from '../../core/services/content.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { EnquiryType } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { applyServerErrors, emptyToUndefined, mobileValidator } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, PageHeroComponent, IllustrationComponent, RevealDirective],
  template: `
    <app-page-hero eyebrow="Contact" title="Let's talk about your next move" illustration="contact"
      subtitle="Whether you're looking for a role or hiring through us, the Veejee Services recruitment team is here to help." />
    <div class="container layout">
      <aside class="info">
        @for (c of cards; track c.title; let i = $index) {
          <div class="card card-hover info-card" appReveal [appRevealDelay]="i * 80">
            <div class="card-body d-flex gap-3">
              <span class="i-tile"><i [class]="'bi ' + c.icon" aria-hidden="true"></i></span>
              <div>
                <h2 class="h6 mb-1">{{ c.title }}</h2>
                <p class="small text-secondary mb-0">{{ c.text }}</p>
              </div>
            </div>
          </div>
        }
      </aside>
      <div class="card form-card">
        <div class="card-body">
          @if (sent()) {
            <div class="text-center py-3" role="status" data-testid="contact-success">
              <app-illustration name="success" class="ok-art" />
              <h2 class="h4 mt-3">Thank you, {{ form.controls.name.value.split(' ')[0] }}!</h2>
              <p class="text-secondary">Your enquiry has been received. A confirmation has been sent to {{ form.controls.email.value }}.</p>
              <div class="d-flex flex-wrap justify-content-center gap-2">
                <button class="btn btn-outline-primary" type="button" (click)="reset()">Send another message</button>
                <a class="btn btn-gold" routerLink="/jobs">Browse jobs</a>
              </div>
            </div>
          } @else {
            <h2 class="h4 mb-3"><i class="bi bi-envelope-paper text-gold" aria-hidden="true"></i> Send us a message</h2>
            @if (error()) {
              <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span></div>
            }
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <fieldset class="mb-3">
                <legend class="form-label">I am a</legend>
                <div class="btn-group flex-wrap" role="group" aria-label="Enquiry type">
                  @for (t of types; track t.value) {
                    <input type="radio" class="btn-check" formControlName="enquiryType" [id]="'enq-' + t.value" [value]="t.value" />
                    <label class="btn btn-outline-primary" [for]="'enq-' + t.value"><i [class]="'bi ' + t.icon" aria-hidden="true"></i> {{ t.label }}</label>
                  }
                </div>
              </fieldset>
              <div class="row g-3 align-items-start">
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="c-name" formControlName="name" autocomplete="name" placeholder=" " required />
                    <label for="c-name">Your name</label>
                  </div>
                  <app-field-error [control]="form.controls.name" label="Name" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="c-email" type="email" formControlName="email" autocomplete="email" placeholder=" " required />
                    <label for="c-email">Email</label>
                  </div>
                  <app-field-error [control]="form.controls.email" label="Email" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="c-phone" type="tel" formControlName="phone" autocomplete="tel" placeholder=" " />
                    <label for="c-phone">Phone (optional)</label>
                  </div>
                  <app-field-error [control]="form.controls.phone" label="Phone" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="c-subject" formControlName="subject" placeholder=" " required />
                    <label for="c-subject">Subject</label>
                  </div>
                  <app-field-error [control]="form.controls.subject" label="Subject" />
                </div>
                <div class="col-12">
                  <div class="form-floating">
                    <textarea class="form-control" id="c-message" formControlName="message" placeholder=" " maxlength="5000" style="height: 9rem" required></textarea>
                    <label for="c-message">Message</label>
                  </div>
                  <app-field-error [control]="form.controls.message" label="Message" />
                </div>
                <div class="col-12">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="c-consent" formControlName="consent" />
                    <label class="form-check-label" for="c-consent">
                      I agree that Veejee Services may use these details to respond to my enquiry, as described in the <a routerLink="/privacy">Privacy policy</a>.
                    </label>
                  </div>
                  @if (form.controls.consent.touched && form.controls.consent.invalid) {
                    <div class="invalid-feedback d-block" role="alert">Please give consent so we can respond.</div>
                  }
                </div>
                <div class="col-12 d-flex justify-content-end">
                  <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
                    @if (loading()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Sending… } @else { <i class="bi bi-send" aria-hidden="true"></i> Send message }
                  </button>
                </div>
              </div>
            </form>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .layout { display: grid; gap: var(--an-space-5); padding-block: var(--an-space-5) var(--an-space-8); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 992px) { .layout { grid-template-columns: 340px minmax(0, 1fr); align-items: start; } }
    .info { display: grid; gap: var(--an-space-3); }
    .i-tile { flex: none; width: 46px; height: 46px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-gold-100); color: var(--an-gold-700); font-size: 1.25rem; }
    .form-card { border-top: 4px solid var(--an-gold-500); }
    .form-card > .card-body { padding: var(--an-space-5); }
    @media (max-width: 575.98px) { .form-card > .card-body { padding: var(--an-space-4); } }
    .ok-art { width: 170px; margin: 0 auto; }
    .btn-group .btn { min-width: 120px; }
  `,
})
export default class ContactComponent implements OnInit {
  /** Optional ?type=employer|candidate preselects the enquiry type. */
  readonly type = input<string>();
  private readonly api = inject(ContentService);
  private readonly auth = inject(AuthService);

  protected readonly cards = [
    { icon: 'bi-person-workspace', title: 'Candidates', text: 'Questions about registering, your profile, consent, applications or interviews.' },
    { icon: 'bi-buildings', title: 'Employers', text: 'Hiring requirements, bulk hiring and how we shortlist candidates for you.' },
    { icon: 'bi-clock-history', title: 'Response time', text: 'We usually reply within one business day, with an email confirmation right away.' },
    { icon: 'bi-shield-lock', title: 'Your privacy', text: 'Enquiry details are used only to respond to you.' },
  ];
  protected readonly types: { value: EnquiryType; label: string; icon: string }[] = [
    { value: 'candidate', label: 'Candidate', icon: 'bi-person' },
    { value: 'employer', label: 'Employer', icon: 'bi-building' },
    { value: 'general', label: 'Other', icon: 'bi-chat' },
  ];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    enquiryType: ['general' as EnquiryType, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [mobileValidator]],
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    consent: [false, Validators.requiredTrue],
  });
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const t = this.type();
    if (t === 'employer' || t === 'candidate' || t === 'general') {
      this.form.controls.enquiryType.setValue(t);
    }
    const user = this.auth.user();
    if (user) {
      this.form.patchValue({ name: user.name, email: user.email, phone: user.mobile ?? '' });
      if (user.role === 'candidate' || user.role === 'employer') {
        this.form.controls.enquiryType.setValue(user.role);
      }
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.api
      .contact({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: emptyToUndefined(v.phone),
        subject: v.subject.trim(),
        message: v.message.trim(),
        enquiryType: v.enquiryType,
        consent: true,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: (err: unknown) => {
          const e = toAppError(err);
          const rest = applyServerErrors(this.form, e);
          if (!e.details.length || rest.length) {
            this.error.set(rest.join(' ') || friendlyMessage(e));
          }
        },
      });
  }

  reset(): void {
    this.form.patchValue({ subject: '', message: '', consent: false });
    this.form.markAsUntouched();
    this.sent.set(false);
  }
}
