import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize, map } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { friendlyMessage, toAppError } from '../../../core/http/api-error';
import { CandidateStage, RECRUITER_SETTABLE_STAGES, STAGE_LABELS, Shortlist } from '../../../core/models';
import { FORM_KIT } from '../../../shared/components/field-error.component';
import { MODAL_DATA, ModalRef } from '../../../shared/ui/modal.service';

export interface CandidateDialogData {
  candidateId: string;
  name: string;
  stage?: CandidateStage;
  applicationId?: string;
  jobId?: string;
}

/** Change a candidate's stage (recruiter-settable stages only). */
@Component({
  selector: 'app-stage-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5"><i class="bi bi-signpost-split text-gold" aria-hidden="true"></i> Update stage – {{ data.name }}</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }
      <form [formGroup]="form" id="stage-form" (ngSubmit)="save()" novalidate>
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <select class="form-select" id="sd-stage" formControlName="stage" data-autofocus>
                @for (s of stages; track s) { <option [value]="s">{{ labels[s] }}</option> }
              </select>
              <label for="sd-stage">New stage</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="sd-note" formControlName="note" placeholder=" " maxlength="2000" style="height: 7rem"></textarea>
              <label for="sd-note">Note (optional)</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="sd-visible" formControlName="visibleToCandidate" />
              <label class="form-check-label" for="sd-visible">Visible to candidate</label>
            </div>
            <div class="form-text">When off, the note stays internal to Veejee Services.</div>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="stage-form" class="btn btn-primary" [disabled]="saving()">Update stage</button>
    </div>
  `,
})
export class StageDialogComponent {
  protected readonly data = inject<CandidateDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<boolean>>(ModalRef);
  private readonly api = inject(RecruitmentService);
  protected readonly stages = RECRUITER_SETTABLE_STAGES;
  protected readonly labels = STAGE_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    stage: [
      (this.data.stage && RECRUITER_SETTABLE_STAGES.includes(this.data.stage) ? this.data.stage : 'under_review') as CandidateStage,
      Validators.required,
    ],
    note: ['', Validators.maxLength(2000)],
    visibleToCandidate: false,
  });

  save(): void {
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .setStage(this.data.candidateId, v.stage, v.note.trim(), v.visibleToCandidate)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => this.ref.close(true), error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))) });
  }
}

/** E-mail a candidate (logged by the backend). */
@Component({
  selector: 'app-contact-candidate-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5"><i class="bi bi-envelope text-gold" aria-hidden="true"></i> Contact {{ data.name }}</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      <p class="small text-secondary">The message is e-mailed to the candidate from Veejee Services and logged on their record.</p>
      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }
      <form [formGroup]="form" id="contact-form" (ngSubmit)="send()" novalidate>
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <input class="form-control" id="cc-subject" formControlName="subject" placeholder=" " maxlength="150" data-autofocus />
              <label for="cc-subject">Subject</label>
            </div>
            <app-field-error [control]="form.controls.subject" label="Subject" />
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="cc-message" formControlName="message" placeholder=" " maxlength="5000" style="height: 10rem"></textarea>
              <label for="cc-message">Message</label>
            </div>
            <app-field-error [control]="form.controls.message" label="Message" />
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="contact-form" class="btn btn-primary" [disabled]="saving()"><i class="bi bi-send" aria-hidden="true"></i> Send</button>
    </div>
  `,
})
export class ContactCandidateDialogComponent {
  protected readonly data = inject<CandidateDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<boolean>>(ModalRef);
  private readonly api = inject(RecruitmentService);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    subject: ['', [Validators.required, Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5000)]],
  });

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .contactCandidate(this.data.candidateId, v.subject.trim(), v.message.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => this.ref.close(true), error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))) });
  }
}

/** Shortlist the candidate for a published requirement. */
@Component({
  selector: 'app-shortlist-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5"><i class="bi bi-star text-gold" aria-hidden="true"></i> Shortlist {{ data.name }}</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      <p class="small text-secondary">
        Shortlists may need approval by Veejee Services management before the profile can be submitted to the company.
      </p>
      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }
      <form [formGroup]="form" id="shortlist-form" (ngSubmit)="save()" novalidate>
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <select class="form-select" id="sl-job" formControlName="jobId" data-autofocus>
                <option value="" disabled>{{ requirements.isLoading() ? 'Loading requirements…' : 'Choose a requirement' }}</option>
                @for (r of requirements.value() ?? []; track r.id) {
                  <option [value]="r.id">{{ r.title }} – {{ r.companyName || r.employer?.companyName || 'Client company' }}</option>
                }
              </select>
              <label for="sl-job">Requirement</label>
            </div>
            <app-field-error [control]="form.controls.jobId" label="Requirement" />
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="sl-note" formControlName="note" placeholder=" " maxlength="2000" style="height: 7rem"></textarea>
              <label for="sl-note">Why this candidate? (optional)</label>
            </div>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="shortlist-form" class="btn btn-gold" [disabled]="saving()">Shortlist</button>
    </div>
  `,
})
export class ShortlistDialogComponent {
  protected readonly data = inject<CandidateDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<Shortlist>>(ModalRef);
  private readonly api = inject(RecruitmentService);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly requirements = rxResource({
    stream: () => this.api.requirements({ status: 'published', limit: 100 }).pipe(map((p) => p.items)),
  });
  protected readonly form = inject(FormBuilder).nonNullable.group({
    jobId: [this.data.jobId ?? '', Validators.required],
    note: ['', Validators.maxLength(2000)],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .shortlist({
        jobId: v.jobId,
        candidateId: this.data.candidateId,
        applicationId: this.data.applicationId,
        note: v.note.trim() || undefined,
        source: this.data.applicationId ? 'application' : 'search',
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: (s) => this.ref.close(s), error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))) });
  }
}
