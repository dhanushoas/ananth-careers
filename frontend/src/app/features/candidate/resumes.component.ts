import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { Resume } from '../../core/models';
import { RESUME_MAX_BYTES, RESUME_MAX_COUNT, ResumesService } from '../../core/services/resumes.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { saveBlobResponse } from '../../shared/utils/download';

@Component({
  selector: 'app-candidate-resumes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, FileUploadComponent, FileSizePipe],
  template: `
    <app-page-header title="Resumes" eyebrow="Candidate" illustration="resumes"
      subtitle="Upload up to 5 PDF resumes. Veejee Services recruiters review your primary resume; it is shared with a company only when you consent." />

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <section class="card upload" aria-labelledby="upload-h">
          <div class="card-body d-flex flex-column gap-3">
            <h2 id="upload-h" class="h5 mb-0 d-flex align-items-center gap-2"><i class="bi bi-cloud-arrow-up text-gold" aria-hidden="true"></i> Upload a resume</h2>
            @if (atLimit()) {
              <div class="alert alert-info d-flex gap-2 mb-0" role="status">
                <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
                <span>You have reached the limit of {{ maxCount }} resumes. Delete one to upload another.</span>
              </div>
            }
            <app-file-upload
              label="Choose a PDF"
              hint="PDF only"
              accept="application/pdf,.pdf"
              [mimeTypes]="['application/pdf']"
              [maxBytes]="maxBytes"
              [busy]="uploading()"
              [disabled]="atLimit()"
              (fileSelected)="upload($event)"
            />
            <p class="text-secondary small mb-0 d-flex gap-2"><i class="bi bi-shield-lock" aria-hidden="true"></i>
              Resumes are stored encrypted and shared only with employers you apply to.</p>
          </div>
        </section>
      </div>

      <section class="col-12 col-lg-7" aria-labelledby="list-h">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 id="list-h" class="h5 mb-0">Your resumes</h2>
          <span class="badge rounded-pill text-bg-light border">{{ resumes().length }} / {{ maxCount }}</span>
        </div>
        <div class="progress mb-3" role="progressbar" aria-label="Resume slots used" [attr.aria-valuenow]="resumes().length" aria-valuemin="0" [attr.aria-valuemax]="maxCount">
          <div class="progress-bar" [class.bg-warning]="atLimit()" [style.width.%]="(resumes().length / maxCount) * 100"></div>
        </div>
        @if (loading()) {
          <app-skeleton variant="table" [count]="3" />
        } @else if (error()) {
          <app-empty-state tone="error" illustration="error" title="We couldn't load your resumes">
            <button class="btn btn-primary" type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
          </app-empty-state>
        } @else {
          <ul class="list-unstyled d-grid gap-3 mb-0">
            @for (r of resumes(); track r.id) {
              <li class="card card-hover item" [class.primary]="r.isPrimary" data-testid="resume-item">
                <div class="card-body d-flex flex-wrap align-items-center gap-3">
                  <span class="file" aria-hidden="true"><i class="bi bi-file-earmark-pdf-fill"></i></span>
                  <div class="info">
                    <p class="name mb-0">
                      {{ r.originalName }}
                      @if (r.isPrimary) {
                        <span class="badge rounded-pill text-bg-gold"><i class="bi bi-star-fill" aria-hidden="true"></i> Primary</span>
                      }
                    </p>
                    <p class="meta mb-0">{{ r.size | fileSize }} · Uploaded {{ r.createdAt | date: 'mediumDate' }}</p>
                  </div>
                  <div class="actions">
                    @if (!r.isPrimary) {
                      <button class="btn btn-outline-primary btn-sm" type="button" (click)="makePrimary(r)" [disabled]="busyId() === r.id">
                        <i class="bi bi-star" aria-hidden="true"></i> Make primary
                      </button>
                    }
                    <button class="btn btn-light btn-icon" type="button" (click)="download(r)" [disabled]="busyId() === r.id"
                            [attr.aria-label]="'Download ' + r.originalName" title="Download">
                      <i class="bi bi-download" aria-hidden="true"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-icon" type="button" (click)="remove(r)" [disabled]="busyId() === r.id"
                            [attr.aria-label]="'Delete ' + r.originalName" title="Delete">
                      <i class="bi bi-trash3" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </li>
            } @empty {
              <li>
                <app-empty-state illustration="empty-resumes" title="No resumes yet" message="Upload a PDF resume to start applying for jobs." />
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: `
    .upload { border-top: 3px solid var(--an-gold-500); }
    .item.primary { border-color: var(--an-gold-300); background: linear-gradient(90deg, var(--an-gold-100), var(--an-surface) 40%); }
    .file { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-danger-bg); color: var(--an-danger); font-size: 1.5rem; flex: none; }
    .info { flex: 1 1 180px; min-width: 0; }
    .name { font-weight: 600; overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .meta { font-size: 0.85rem; color: var(--an-text-muted); }
    .actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  `,
})
export default class ResumesComponent implements OnInit {
  private readonly api = inject(ResumesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxBytes = RESUME_MAX_BYTES;
  protected readonly maxCount = RESUME_MAX_COUNT;
  protected readonly resumes = signal<Resume[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly uploading = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly atLimit = computed(() => this.resumes().length >= RESUME_MAX_COUNT);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (list) => this.resumes.set(list), error: () => this.error.set(true) });
  }

  upload(file: File): void {
    this.uploading.set(true);
    this.api
      .upload(file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe(() => {
        this.toast.success('Resume uploaded.');
        this.load();
      });
  }

  makePrimary(r: Resume): void {
    this.busyId.set(r.id);
    this.api
      .makePrimary(r.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        this.resumes.update((list) => list.map((x) => ({ ...x, isPrimary: x.id === r.id })));
        this.toast.success(`"${r.originalName}" is now your primary resume.`);
      });
  }

  download(r: Resume): void {
    this.busyId.set(r.id);
    this.api
      .download(r.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe((res) => saveBlobResponse(res, r.originalName || 'resume.pdf'));
  }

  remove(r: Resume): void {
    this.confirm
      .open({
        title: 'Delete this resume?',
        message: `"${r.originalName}" will be removed. Resumes attached to active applications cannot be deleted.`,
        confirmText: 'Delete',
        tone: 'danger',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busyId.set(r.id);
        this.api
          .delete(r.id)
          .pipe(finalize(() => this.busyId.set(null)))
          .subscribe(() => {
            this.toast.success('Resume deleted.');
            this.load();
          });
      });
  }
}
