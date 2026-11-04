import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { CandidateService } from '../../core/services/candidate.service';
import { RESUME_MAX_BYTES, ResumesService } from '../../core/services/resumes.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { CandidateApplication, Job, Resume } from '../../core/models';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { MODAL_DATA, ModalRef } from '../../shared/ui/modal.service';

export interface ApplyDialogResult {
  application?: CandidateApplication;
  alreadyApplied?: boolean;
}

@Component({
  selector: 'app-apply-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, DatePipe, FileUploadComponent, FileSizePipe],
  host: { style: 'display: contents' },
  template: `
    <div class="modal-header">
      <div class="min-w-0">
        <h2 class="modal-title h5 mb-0"><i class="bi bi-send text-gold" aria-hidden="true"></i> Apply for {{ job.title }}</h2>
        <p class="small text-secondary mb-0">{{ company }} · via Veejee Services</p>
      </div>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (error()) {
        <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span></div>
      }
      <form [formGroup]="form" id="apply-form" (ngSubmit)="submit()" novalidate>
        <fieldset>
          <legend class="h6">Choose a resume</legend>
          @if (loadingResumes()) {
            <p class="text-secondary"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading your resumes…</p>
          } @else {
            @if (resumes().length) {
              <div class="list-group mb-3">
                @for (r of resumes(); track r.id) {
                  <label class="list-group-item d-flex gap-3 align-items-center resume" [class.active-resume]="form.controls.resumeId.value === r.id">
                    <input class="form-check-input flex-shrink-0 m-0" type="radio" formControlName="resumeId" [value]="r.id" />
                    <i class="bi bi-file-earmark-pdf fs-4 text-danger" aria-hidden="true"></i>
                    <span class="min-w-0">
                      <span class="d-block fw-semibold text-truncate">{{ r.originalName }}</span>
                      <span class="d-block small text-secondary">{{ r.size | fileSize }} · uploaded {{ r.createdAt | date: 'mediumDate' }}</span>
                    </span>
                    @if (r.isPrimary) {
                      <span class="badge text-bg-gold ms-auto">Primary</span>
                    }
                  </label>
                }
              </div>
            } @else {
              <p class="text-secondary">You haven't uploaded a resume yet. Upload a PDF to continue.</p>
            }
            @if (resumes().length < 5) {
              <app-file-upload label="Upload a new resume" hint="PDF" icon="bi-file-earmark-arrow-up" [maxBytes]="maxBytes" [busy]="uploading()" (fileSelected)="upload($event)" />
            }
            @if (form.controls.resumeId.touched && form.controls.resumeId.invalid) {
              <div class="invalid-feedback d-block" role="alert">Please choose a resume.</div>
            }
          }
        </fieldset>
        <div class="form-floating mt-3">
          <textarea class="form-control" id="cover-letter" formControlName="coverLetter" maxlength="3000" placeholder=" " style="height: 8rem"></textarea>
          <label for="cover-letter">Cover letter (optional)</label>
        </div>
        <div class="d-flex justify-content-between">
          <app-field-error [control]="form.controls.coverLetter" label="Cover letter" />
          <span class="form-text ms-auto">{{ form.controls.coverLetter.value.length }} / 3000</span>
        </div>
        <p class="small text-secondary mt-2 mb-0"><i class="bi bi-shield-lock" aria-hidden="true"></i> Your application goes to Veejee Services. A recruiter reviews it, and your profile is shared with the company only if you are shortlisted and have consented. Manage resumes in <a routerLink="/candidate/resumes" data-modal-dismiss>My resumes</a>.</p>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="apply-form" class="btn btn-gold" [disabled]="submitting() || uploading()" data-testid="submit-application">
        @if (submitting()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Submitting… } @else { Submit application }
      </button>
    </div>
  `,
  styles: `
    .min-w-0 { min-width: 0; }
    .resume { cursor: pointer; min-height: 56px; }
    .active-resume { background: var(--an-gold-100); border-color: var(--an-gold-300); }
  `,
})
export class ApplyDialogComponent implements OnInit {
  protected readonly job = inject<Job>(MODAL_DATA);
  private readonly ref = inject<ModalRef<ApplyDialogResult>>(ModalRef);
  private readonly resumesApi = inject(ResumesService);
  private readonly candidates = inject(CandidateService);
  protected readonly company = this.job.employer?.companyName ?? this.job.companyName ?? 'Veejee Services client (confidential)';

  protected readonly maxBytes = RESUME_MAX_BYTES;
  protected readonly resumes = signal<Resume[]>([]);
  protected readonly loadingResumes = signal(true);
  protected readonly uploading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    resumeId: ['', Validators.required],
    coverLetter: ['', Validators.maxLength(3000)],
  });

  ngOnInit(): void {
    this.resumesApi
      .list()
      .pipe(finalize(() => this.loadingResumes.set(false)))
      .subscribe((list) => {
        this.resumes.set(list);
        const primary = list.find((r) => r.isPrimary) ?? list[0];
        if (primary) this.form.controls.resumeId.setValue(primary.id);
      });
  }

  upload(file: File): void {
    this.uploading.set(true);
    this.resumesApi
      .upload(file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe((resume) => {
        this.resumes.update((list) => [...list, resume]);
        this.form.controls.resumeId.setValue(resume.id);
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.candidates
      .apply({ jobId: this.job.id, resumeId: v.resumeId || undefined, coverLetter: v.coverLetter.trim() || undefined })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (application) => this.ref.close({ application }),
        error: (err: unknown) => {
          const e = toAppError(err);
          if (e.errorCode === 'ALREADY_APPLIED' || e.errorCode === 'DUPLICATE_RESOURCE' || e.errorCode === 'CONFLICT') {
            this.ref.close({ alreadyApplied: true });
            return;
          }
          this.error.set(friendlyMessage(e));
        },
      });
  }
}
