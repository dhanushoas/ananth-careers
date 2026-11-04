import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { friendlyMessage, toAppError } from '../../../core/http/api-error';
import { CandidateInterview, INTERVIEW_MODES, InterviewMode } from '../../../core/models';
import { FORM_KIT } from '../../../shared/components/field-error.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { MODAL_DATA, ModalRef } from '../../../shared/ui/modal.service';
import { applyServerErrors, emptyToUndefined, toDateTimeLocalInput } from '../../../shared/utils/form-utils';

export interface ScheduleInterviewData {
  submissionId: string;
  /** When present the dialog reschedules this interview (PATCH). */
  interview?: CandidateInterview;
  candidateName?: string;
  companyName?: string;
  /** Employer's preferred slots, shown as hints. */
  preferredSlots?: string[];
}

function futureValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) || t <= Date.now() ? { futureDate: true } : null;
}

const httpsValidator = (control: AbstractControl): ValidationErrors | null => {
  const v = (control.value as string)?.trim();
  if (!v) return null;
  return /^https:\/\/[^\s]+$/i.test(v) ? null : { pattern: true };
};

/** Schedule or reschedule an interview for a company submission (Veejee Services coordinates). */
@Component({
  selector: 'app-schedule-interview-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, EnumLabelPipe],
  template: `
    <div class="modal-header">
      <div class="min-w-0">
        <h2 class="modal-title h5 mb-0"><i class="bi bi-calendar2-plus text-gold" aria-hidden="true"></i> {{ data.interview ? 'Reschedule interview' : 'Schedule interview' }}</h2>
        @if (data.candidateName || data.companyName) {
          <p class="small text-secondary mb-0">{{ data.candidateName }}@if (data.companyName) { · {{ data.companyName }} }</p>
        }
      </div>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (data.preferredSlots; as slots) {
        @if (slots.length) {
        <div class="alert alert-info small d-flex gap-2">
          <i class="bi bi-clock-history" aria-hidden="true"></i>
          <span><strong>Company's preferred slots:</strong> {{ slots.join(' · ') }}</span>
        </div>
        }
      }
      @if (error()) {
        <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span></div>
      }
      <form [formGroup]="form" id="schedule-form" (ngSubmit)="submit()" novalidate>
        <div class="row g-3 align-items-start">
          <div class="col-12 col-md-7">
            <div class="form-floating">
              <input class="form-control" id="si-when" type="datetime-local" formControlName="scheduledAt" placeholder=" " required data-autofocus />
              <label for="si-when">Date &amp; time</label>
            </div>
            <app-field-error [control]="form.controls.scheduledAt" label="Date & time" />
          </div>
          <div class="col-12 col-md-5">
            <div class="form-floating">
              <input class="form-control" id="si-duration" type="number" min="15" max="480" step="15" formControlName="durationMinutes" placeholder=" " required />
              <label for="si-duration">Duration (minutes)</label>
            </div>
            <app-field-error [control]="form.controls.durationMinutes" label="Duration" />
          </div>
          <div class="col-12 col-md-5">
            <div class="form-floating">
              <select class="form-select" id="si-mode" formControlName="mode">
                @for (m of modes; track m) {
                  <option [value]="m">{{ m | enumLabel }}</option>
                }
              </select>
              <label for="si-mode">Mode</label>
            </div>
          </div>
          @if (form.controls.mode.value === 'in_person') {
            <div class="col-12 col-md-7">
              <div class="form-floating">
                <input class="form-control" id="si-location" formControlName="location" placeholder=" " />
                <label for="si-location">Location</label>
              </div>
              <app-field-error [control]="form.controls.location" label="Location" />
            </div>
          }
          @if (form.controls.mode.value === 'video') {
            <div class="col-12 col-md-7">
              <div class="form-floating">
                <input class="form-control" id="si-link" type="url" formControlName="meetingLink" placeholder=" " />
                <label for="si-link">Meeting link</label>
              </div>
              <app-field-error [control]="form.controls.meetingLink" label="Meeting link" />
              <div class="form-text">Must start with https://</div>
            </div>
          }
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="si-notes" formControlName="notes" placeholder=" " style="height: 6rem" maxlength="1000"></textarea>
              <label for="si-notes">Notes</label>
            </div>
            <div class="form-text">Shared with the candidate and the company in the invitation.</div>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="schedule-form" class="btn btn-primary" [disabled]="saving()">
        @if (saving()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> }
        {{ data.interview ? 'Reschedule' : 'Schedule' }}
      </button>
    </div>
  `,
  styles: `.min-w-0 { min-width: 0; }`,
})
export class ScheduleInterviewDialogComponent implements OnInit {
  protected readonly data = inject<ScheduleInterviewData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<CandidateInterview>>(ModalRef);
  private readonly api = inject(RecruitmentService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modes = INTERVIEW_MODES;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    scheduledAt: ['', [Validators.required, futureValidator]],
    durationMinutes: [45, [Validators.required, Validators.min(15), Validators.max(480)]],
    mode: ['video' as InterviewMode, Validators.required],
    location: [''],
    meetingLink: ['', [httpsValidator]],
    notes: ['', Validators.maxLength(1000)],
  });

  ngOnInit(): void {
    const iv = this.data.interview;
    if (iv) {
      this.form.patchValue({
        scheduledAt: toDateTimeLocalInput(iv.scheduledAt),
        durationMinutes: iv.durationMinutes,
        mode: iv.mode,
        location: iv.location ?? '',
        meetingLink: iv.meetingLink ?? '',
        notes: iv.notes ?? '',
      });
    }
    this.applyModeValidators(this.form.controls.mode.value);
    this.form.controls.mode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => this.applyModeValidators(m));
  }

  private applyModeValidators(mode: InterviewMode): void {
    const { location, meetingLink } = this.form.controls;
    location.setValidators(mode === 'in_person' ? [Validators.required] : []);
    meetingLink.setValidators(mode === 'video' ? [Validators.required, httpsValidator] : [httpsValidator]);
    location.updateValueAndValidity({ emitEvent: false });
    meetingLink.updateValueAndValidity({ emitEvent: false });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      scheduledAt: new Date(v.scheduledAt).toISOString(),
      durationMinutes: Number(v.durationMinutes),
      mode: v.mode,
      location: v.mode === 'in_person' ? emptyToUndefined(v.location) : undefined,
      meetingLink: v.mode === 'video' ? emptyToUndefined(v.meetingLink) : undefined,
      notes: emptyToUndefined(v.notes),
    };
    this.saving.set(true);
    this.error.set(null);
    const iv = this.data.interview;
    const req$ = iv ? this.api.rescheduleInterview(iv.id, body) : this.api.scheduleInterview({ submissionId: this.data.submissionId, ...body });
    req$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res) => {
        this.toast.success(iv ? 'Interview rescheduled' : 'Interview scheduled');
        this.ref.close(res);
      },
      error: (err: unknown) => {
        const e = toAppError(err);
        const rest = applyServerErrors(this.form, e);
        if (!e.details.length || rest.length) this.error.set(rest.join(' ') || friendlyMessage(e));
      },
    });
  }
}
