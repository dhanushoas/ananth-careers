import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { friendlyMessage, toAppError } from '../../../core/http/api-error';
import { CandidateProfile, Shortlist, Submission } from '../../../core/models';
import { FORM_KIT } from '../../../shared/components/field-error.component';
import { MODAL_DATA, ModalRef } from '../../../shared/ui/modal.service';
import { refName, refObj } from './recruiter-utils';

export interface SubmitDialogData {
  shortlist: Shortlist;
  companyName?: string;
}

/**
 * Submit an approved shortlist to the client company. Requires the candidate's profile-sharing
 * consent; contact details can only be shared with contact-sharing consent.
 */
@Component({
  selector: 'app-submit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <div class="min-w-0">
        <h2 class="modal-title h5 mb-0"><i class="bi bi-send-check text-gold" aria-hidden="true"></i> Submit to company</h2>
        <p class="small text-secondary mb-0">{{ candidateName() }} → {{ company() }} · {{ data.shortlist.job.title }}</p>
      </div>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (!profileConsent()) {
        <div class="alert alert-danger d-flex gap-2" role="alert" data-testid="consent-required">
          <i class="bi bi-shield-x" aria-hidden="true"></i>
          <span><strong>Consent required.</strong> This candidate has not consented to sharing their profile with companies, so it cannot be submitted. Ask the candidate to enable profile sharing in their privacy settings.</span>
        </div>
      } @else {
        <p class="small text-secondary">The company will see the approved profile, resume and your summary. Contact details are shared only if you enable it below and the candidate has consented.</p>
      }
      @if (error()) {
        <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span></div>
      }
      <form [formGroup]="form" id="submit-form" (ngSubmit)="submit()" novalidate>
        <div class="form-floating">
          <textarea class="form-control" id="sd-summary" formControlName="summary" placeholder=" " maxlength="3000" style="height: 9rem" data-autofocus></textarea>
          <label for="sd-summary">Summary for the company</label>
        </div>
        <app-field-error [control]="form.controls.summary" label="Summary" />
        <div class="form-text mb-3">Why this candidate fits: key skills, experience, availability and expectations.</div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="sd-contact" formControlName="shareContact" aria-describedby="sd-contact-help" />
          <label class="form-check-label" for="sd-contact">Share contact details</label>
        </div>
        <div class="form-text" id="sd-contact-help">
          @if (contactConsent()) {
            The candidate has consented to sharing their email and phone with client companies.
          } @else {
            <i class="bi bi-lock" aria-hidden="true"></i> Disabled — the candidate has not consented to sharing contact details. The company will contact the candidate through Veejee Services.
          }
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="submit-form" class="btn btn-gold" [disabled]="saving() || !profileConsent()">
        @if (saving()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> }
        Submit
      </button>
    </div>
  `,
  styles: `.min-w-0 { min-width: 0; }`,
})
export class SubmitDialogComponent {
  protected readonly data = inject<SubmitDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<Submission>>(ModalRef);
  private readonly api = inject(RecruitmentService);
  private readonly toast = inject(ToastService);

  private readonly profile = refObj<Partial<CandidateProfile>>(this.data.shortlist.candidateProfile);
  protected readonly profileConsent = signal(this.profile?.consent?.profileSharing !== false);
  protected readonly contactConsent = signal(this.profile?.consent?.contactSharing === true);
  protected readonly candidateName = computed(() => refName(this.data.shortlist.candidate, 'Candidate'));
  protected readonly company = computed(() => this.data.companyName ?? this.data.shortlist.job.companyName ?? 'the company');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    summary: ['', [Validators.maxLength(3000)]],
    shareContact: [{ value: false, disabled: !this.contactConsent() }],
  });

  submit(): void {
    if (this.form.invalid || !this.profileConsent()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .submit({ shortlistId: this.data.shortlist.id, summary: v.summary.trim() || undefined, shareContact: this.contactConsent() && v.shareContact })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (s) => {
          this.toast.success('Submitted to company');
          this.ref.close(s);
        },
        error: (err: unknown) => {
          const e = toAppError(err);
          if (e.errorCode === 'CONSENT_REQUIRED') {
            this.profileConsent.set(false);
          } else if (e.errorCode === 'CONTACT_CONSENT_REQUIRED') {
            this.contactConsent.set(false);
            this.form.controls.shareContact.setValue(false);
            this.form.controls.shareContact.disable();
          }
          this.error.set(friendlyMessage(e));
        },
      });
  }
}
