import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormArray, FormBuilder, FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CandidateInterview,
  FEEDBACK_RECOMMENDATIONS,
  FeedbackRecommendation,
  InterviewFeedback,
  Submission,
  SubmissionStatus,
} from '../../core/models';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { formatInrCompact } from '../../shared/pipes/salary-range.pipe';
import { MODAL_DATA, ModalRef } from '../../shared/ui/modal.service';
import { toDateTimeLocalInput } from '../../shared/utils/form-utils';

export const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  submitted: 'New – submitted by Veejee Services',
  company_reviewing: 'Under your review',
  interview_requested: 'Interview requested',
  interview_scheduled: 'Interview scheduled',
  interview_completed: 'Interview completed',
  selected: 'Accepted / selected',
  rejected: 'Not selected',
  on_hold: 'On hold',
  placed: 'Successfully placed',
  withdrawn: 'Withdrawn',
};

/** Statuses on which the company can still decide (accept / reject / hold / request interview). */
export const OPEN_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'submitted',
  'company_reviewing',
  'interview_requested',
  'interview_scheduled',
  'interview_completed',
  'on_hold',
];

export function submissionJobId(s: Submission): string {
  return s.job?.id ?? '';
}

export function interviewModeIcon(mode: string): string {
  return mode === 'video' ? 'bi-camera-video' : mode === 'phone' ? 'bi-telephone' : 'bi-geo-alt';
}

/** Feedback may only be given once the interview has started (server rule: after the interview time). */
export function canGiveFeedback(iv: CandidateInterview): boolean {
  return iv.status !== 'cancelled' && new Date(iv.scheduledAt).getTime() <= Date.now();
}

export function expectedSalaryText(s: Submission): string {
  const e = s.candidateProfile?.expectedSalary;
  if (!e || (!e.min && !e.max)) return '';
  const unit = e.period === 'monthly' ? '/mo' : '/yr';
  if (e.min && e.max) return `₹${formatInrCompact(e.min)}–${formatInrCompact(e.max)} ${unit}`;
  return `₹${formatInrCompact((e.min ?? e.max) as number)} ${unit}`;
}

/** Compact summary of a candidate submitted to the company (no contact details). */
@Component({
  selector: 'app-submission-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, StatusChipComponent, EnumLabelPipe],
  template: `
    @let s = submission();
    @let p = s.candidateProfile;
    <article class="card card-hover sub" data-testid="submitted-candidate-row" [attr.aria-label]="'Candidate ' + s.candidate.name">
      <div class="card-body">
        <div class="who">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <div class="grow">
            <h3 class="name">
              <a [routerLink]="['/employer/candidates', s.id]" class="stretched">{{ s.candidate.name }}</a>
            </h3>
            @if (p?.headline) { <p class="headline">{{ p?.headline }}</p> }
            @if (showJob()) {
              <p class="job"><i class="bi bi-clipboard-check" aria-hidden="true"></i>{{ s.job.title }}</p>
            }
          </div>
          <app-status-chip [status]="s.status" [label]="label()" />
        </div>
        <ul class="facts">
          @if (p?.totalExperienceYears !== undefined) {
            <li><i class="bi bi-briefcase" aria-hidden="true"></i>{{ p?.totalExperienceYears }} yrs</li>
          }
          @if (p?.careerLevel) { <li><i class="bi bi-mortarboard" aria-hidden="true"></i>{{ p?.careerLevel | enumLabel }}</li> }
          @if (p?.location?.city; as city) { <li><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ city }}</li> }
          @if (p?.noticePeriodDays !== undefined && p?.noticePeriodDays !== null) {
            <li><i class="bi bi-hourglass" aria-hidden="true"></i>{{ p?.noticePeriodDays }} days notice</li>
          }
          @if (salary()) { <li><i class="bi bi-cash-stack" aria-hidden="true"></i>{{ salary() }}</li> }
          <li class="ms-auto muted"><i class="bi bi-calendar3" aria-hidden="true"></i>Submitted {{ s.createdAt | date: 'mediumDate' }}</li>
        </ul>
      </div>
    </article>
  `,
  styles: `
    .sub { position: relative; height: 100%; }
    .who { display: flex; gap: var(--an-space-3); align-items: flex-start; flex-wrap: wrap; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; flex: none; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-900); color: var(--an-gold-300); font-weight: 700; }
    .grow { flex: 1 1 180px; min-width: 0; }
    .name { font-size: 1.02rem; margin: 0; overflow-wrap: anywhere; }
    .name a { color: var(--an-navy-900); text-decoration: none; }
    .stretched::after { content: ''; position: absolute; inset: 0; }
    .headline, .job { margin: 2px 0 0; font-size: 0.88rem; color: var(--an-text-2); overflow-wrap: anywhere; }
    .job .bi { color: var(--an-gold-600); margin-right: 4px; }
    .facts { list-style: none; padding: 0; margin: var(--an-space-3) 0 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 0.85rem; color: var(--an-text-2); }
    .facts .bi { color: var(--an-text-muted); margin-right: 4px; }
    .muted { color: var(--an-text-muted); }
  `,
})
export class SubmissionRowComponent {
  readonly submission = input.required<Submission>();
  readonly showJob = input(true);
  protected readonly label = computed(() => SUBMISSION_LABELS[this.submission().status] ?? undefined);
  protected readonly salary = computed(() => expectedSalaryText(this.submission()));
  protected readonly initials = computed(() =>
    this.submission()
      .candidate.name.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join(''),
  );
}

export interface RequestInterviewData {
  submissionId: string;
  candidateName: string;
}

/** Company asks Veejee Services to arrange an interview (Veejee Services schedules it). */
@Component({
  selector: 'app-request-interview-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5"><i class="bi bi-calendar-plus text-gold" aria-hidden="true"></i> Request an interview</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <form class="modal-body" id="req-interview-form" [formGroup]="form" (ngSubmit)="send()" novalidate>
      <p class="text-secondary small">
        Veejee Services will coordinate with {{ data.candidateName }} and confirm a time with you. Suggest a few slots that work for your panel.
      </p>
      <div class="form-floating mb-3">
        <textarea class="form-control" id="ri-note" formControlName="note" placeholder=" " maxlength="1000" style="height: 7rem"></textarea>
        <label for="ri-note">Note for Veejee Services</label>
      </div>
      <app-field-error [control]="form.controls.note" label="Note" />
      <fieldset>
        <legend class="form-label small mb-2">Preferred slots (optional)</legend>
        <div class="row g-2">
          @for (c of slots.controls; track $index; let i = $index) {
            <div class="col-12 col-sm-6">
              <div class="form-floating">
                <input class="form-control" type="datetime-local" [id]="'ri-slot-' + i" [formControl]="c" [min]="minSlot" placeholder=" " />
                <label [for]="'ri-slot-' + i">Slot {{ i + 1 }}</label>
              </div>
            </div>
          }
        </div>
      </fieldset>
      @if (error()) {
        <div class="alert alert-danger small mt-3 mb-0" role="alert">{{ error() }}</div>
      }
    </form>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="req-interview-form" class="btn btn-primary" [disabled]="sending()">
        @if (sending()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> } @else { <i class="bi bi-send" aria-hidden="true"></i> }
        Send request
      </button>
    </div>
  `,
})
export class RequestInterviewDialogComponent {
  protected readonly data = inject<RequestInterviewData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<Submission>>(ModalRef);
  private readonly api = inject(EmployerPortalService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly minSlot = toDateTimeLocalInput(new Date(Date.now() + 3600_000).toISOString());
  protected readonly slots = new FormArray<FormControl<string>>([
    new FormControl('', { nonNullable: true }),
    new FormControl('', { nonNullable: true }),
    new FormControl('', { nonNullable: true }),
  ]);
  protected readonly form = this.fb.group({ note: ['', Validators.maxLength(1000)] });

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const preferred = this.slots.value.filter(Boolean).map((v) => new Date(v).toISOString());
    this.sending.set(true);
    this.error.set(null);
    this.api
      .requestInterview(this.data.submissionId, this.form.controls.note.value.trim(), preferred)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (s) => {
          this.toast.success('Interview requested');
          this.ref.close(s);
        },
        error: () => this.error.set('The request could not be sent. Please try again.'),
      });
  }
}

export interface FeedbackData {
  interview: CandidateInterview;
  candidateName: string;
}

/** Post-interview feedback from the company to Veejee Services. */
@Component({
  selector: 'app-interview-feedback-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, DatePipe, EnumLabelPipe],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5"><i class="bi bi-chat-square-text text-gold" aria-hidden="true"></i> Interview feedback</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <form class="modal-body" id="feedback-form" [formGroup]="form" (ngSubmit)="send()" novalidate>
      <p class="text-secondary small">
        {{ data.candidateName }} · {{ data.interview.scheduledAt | date: 'medium' }}. Your feedback goes to Veejee Services, who will update the candidate.
      </p>
      <fieldset class="mb-3">
        <legend class="form-label">Rating</legend>
        <div class="btn-group flex-wrap" role="group" aria-label="Rating from 1 to 5">
          @for (r of ratings; track r) {
            <input type="radio" class="btn-check" formControlName="rating" [id]="'fb-r-' + r" [value]="r" />
            <label class="btn btn-outline-primary" [for]="'fb-r-' + r"><i class="bi bi-star-fill" aria-hidden="true"></i> {{ r }}</label>
          }
        </div>
        <app-field-error [control]="form.controls.rating" label="Rating" />
      </fieldset>
      <div class="form-floating mb-3">
        <select class="form-select" id="fb-rec" formControlName="recommendation">
          @for (r of recommendations; track r) {
            <option [value]="r">{{ r | enumLabel }}</option>
          }
        </select>
        <label for="fb-rec">Recommendation</label>
      </div>
      <div class="form-floating">
        <textarea class="form-control" id="fb-text" formControlName="feedback" placeholder=" " maxlength="3000" style="height: 8rem"></textarea>
        <label for="fb-text">Feedback</label>
      </div>
      <app-field-error [control]="form.controls.feedback" label="Feedback" />
      @if (error()) {
        <div class="alert alert-danger small mt-3 mb-0" role="alert">{{ error() }}</div>
      }
    </form>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="feedback-form" class="btn btn-primary" [disabled]="sending()">
        @if (sending()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> } @else { <i class="bi bi-send" aria-hidden="true"></i> }
        Send feedback
      </button>
    </div>
  `,
})
export class InterviewFeedbackDialogComponent {
  protected readonly data = inject<FeedbackData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<InterviewFeedback>>(ModalRef);
  private readonly api = inject(EmployerPortalService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly ratings = [1, 2, 3, 4, 5];
  protected readonly recommendations = FEEDBACK_RECOMMENDATIONS;
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.group({
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    recommendation: ['next_round' as FeedbackRecommendation, Validators.required],
    feedback: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(3000)]],
  });

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.sending.set(true);
    this.error.set(null);
    this.api
      .feedback(this.data.interview.id, { rating: Number(v.rating), feedback: v.feedback.trim(), recommendation: v.recommendation })
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (f) => {
          this.toast.success('Feedback sent');
          this.ref.close(f);
        },
        error: () => this.error.set('Feedback could not be sent. It can only be given after the interview time.'),
      });
  }
}
