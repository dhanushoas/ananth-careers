import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { JOB_STATUSES, Job, JobStatus } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { CompanyLogoComponent } from '../../shared/components/company-logo.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../shared/pipes/location.pipe';
import { ADMIN_LIST_STYLES, PagedList, intParam, oneOf, updateQuery } from './admin-shared';

const DEFAULT_STATUS: JobStatus = 'pending_approval';

@Component({
  selector: 'app-admin-jobs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StatusChipComponent,
    CompanyLogoComponent,
    PaginatorComponent,
    EnumLabelPipe,
    LocationsPipe,
  ],
  template: `
    <app-page-header
      eyebrow="Moderation"
      title="Requirement moderation"
      subtitle="Review company requirements before they are published on Veejee Services, and highlight featured openings."
      illustration="moderation"
    />

    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-start" role="search">
          <div class="col-12 col-md-7">
            <div class="input-group">
              <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
              <div class="form-floating">
                <input class="form-control" id="job-q" type="search" placeholder=" " [formControl]="search" data-testid="admin-job-search" />
                <label for="job-q">Search title or company</label>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-5">
            <div class="form-floating">
              <select class="form-select" id="job-status" (change)="onStatus($event)" data-testid="admin-job-status">
                @for (s of statuses; track s) {
                  <option [value]="s" [selected]="s === statusParam()">{{ s | enumLabel }}</option>
                }
                <option value="all" [selected]="statusParam() === 'all'">All statuses</option>
              </select>
              <label for="job-status">Status</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="table" [count]="5" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load requirements" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state
        [illustration]="status() === 'pending_approval' ? 'success' : 'empty-search'"
        title="No requirements to show"
        [message]="status() === 'pending_approval' ? 'The moderation queue is empty. Nice work!' : 'Nothing matches these filters.'"
      />
    } @else {
      <p class="count">{{ list.total() }} job{{ list.total() === 1 ? '' : 's' }}</p>

      <div class="table-responsive d-none d-md-block">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Industry</th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
              <th scope="col">Featured</th>
              <th scope="col" class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (j of list.items(); track j.id) {
              <tr data-testid="admin-job-row" [attr.data-job-id]="j.id">
                <td>
                  <div class="job">
                    <app-company-logo [employerId]="j.employer?.id" [hasLogo]="j.employer?.hasLogo ?? false" [name]="company(j)" [size]="40" />
                    <div>
                      <div class="cell-main" data-testid="admin-job-title">{{ j.title }}</div>
                      <div class="cell-sub">{{ company(j) }}@if (j.confidential) { <span class="badge text-bg-light border ms-1"><i class="bi bi-incognito" aria-hidden="true"></i> Confidential</span> } · {{ j.locations | locations: 1 }}</div>
                      <div class="cell-sub">
                        {{ j.employmentType | enumLabel }} · {{ j.workMode | enumLabel }}@if (j.postedBy) { · by {{ j.postedBy.name }} }
                      </div>
                      @if (j.rejectionReason && j.status === 'rejected') {
                        <div class="cell-sub text-danger">Rejected: {{ j.rejectionReason }}</div>
                      }
                    </div>
                  </div>
                </td>
                <td>{{ j.industry.name }}@if (j.category) {<div class="cell-sub">{{ j.category.name }}</div>}</td>
                <td><app-status-chip [status]="j.status" /></td>
                <td class="nowrap">{{ j.createdAt | date: 'mediumDate' }}</td>
                <td>
                  <div class="form-check form-switch m-0">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      role="switch"
                      [id]="'feat-' + j.id"
                      [checked]="j.featured"
                      [disabled]="j.status !== 'published' || busy() === j.id"
                      (change)="onFeatured(j, $event)"
                    />
                    <label class="visually-hidden" [for]="'feat-' + j.id">Feature {{ j.title }}</label>
                  </div>
                </td>
                <td>
                  <div class="actions-cell">
                    @if (j.status === 'pending_approval' || j.status === 'rejected') {
                      <button class="btn btn-sm btn-success" type="button" [disabled]="busy() === j.id" (click)="approve(j)">Approve</button>
                    }
                    @if (j.status === 'pending_approval' || j.status === 'published') {
                      <button class="btn btn-sm btn-outline-danger" type="button" [disabled]="busy() === j.id" (click)="reject(j)">Reject</button>
                    }
                    <a class="btn btn-sm btn-light" [routerLink]="['/jobs', j.slug || j.id]" target="_blank" rel="noopener">
                      <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>Preview
                    </a>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mobile-list d-md-none">
        @for (j of list.items(); track j.id) {
          <article class="card m-card" data-testid="admin-job-card" [attr.data-job-id]="j.id">
            <div class="card-body">
              <div class="d-flex gap-3 align-items-start">
                <app-company-logo [employerId]="j.employer?.id" [hasLogo]="j.employer?.hasLogo ?? false" [name]="company(j)" [size]="44" />
                <div class="flex-grow-1 min-w-0">
                  <div class="cell-main">{{ j.title }}</div>
                  <div class="cell-sub">{{ company(j) }}@if (j.confidential) { <span class="badge text-bg-light border ms-1"><i class="bi bi-incognito" aria-hidden="true"></i> Confidential</span> } · {{ j.industry.name }}</div>
                  <div class="cell-sub">{{ j.createdAt | date: 'mediumDate' }}</div>
                </div>
              </div>
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <app-status-chip [status]="j.status" />
                <div class="form-check form-switch m-0">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    [id]="'mfeat-' + j.id"
                    [checked]="j.featured"
                    [disabled]="j.status !== 'published' || busy() === j.id"
                    (change)="onFeatured(j, $event)"
                  />
                  <label class="form-check-label small" [for]="'mfeat-' + j.id">Featured</label>
                </div>
              </div>
              @if (j.rejectionReason && j.status === 'rejected') {
                <div class="cell-sub text-danger">Rejected: {{ j.rejectionReason }}</div>
              }
              <div class="m-actions">
                @if (j.status === 'pending_approval' || j.status === 'rejected') {
                  <button class="btn btn-success" type="button" [disabled]="busy() === j.id" (click)="approve(j)">Approve</button>
                }
                @if (j.status === 'pending_approval' || j.status === 'published') {
                  <button class="btn btn-outline-danger" type="button" [disabled]="busy() === j.id" (click)="reject(j)">Reject</button>
                }
                <a class="btn btn-light" [routerLink]="['/jobs', j.slug || j.id]" target="_blank" rel="noopener">Preview</a>
              </div>
            </div>
          </article>
        }
      </div>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .job { display: flex; gap: var(--an-space-3); align-items: flex-start; min-width: 240px; }
      .min-w-0 { min-width: 0; }
    `,
  ],
})
export default class AdminJobsComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statuses = JOB_STATUSES;
  protected readonly list = new PagedList<Job>();
  protected readonly busy = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  /** Value shown in the select: a status or 'all'. Missing param → pending_approval. */
  protected readonly statusParam = computed(() => {
    const raw = this.params().get('status');
    if (raw === 'all') return 'all';
    return oneOf(raw, JOB_STATUSES) ?? DEFAULT_STATUS;
  });
  protected readonly status = computed<JobStatus | undefined>(() => {
    const s = this.statusParam();
    return s === 'all' ? undefined : s;
  });
  private readonly query = computed(() => ({
    status: this.status(),
    q: this.params().get('q') ?? undefined,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));
  protected readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', { nonNullable: true });

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.jobs(q)));
    });
    this.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => this.setFilter({ q: v.trim() || null }));
  }

  setFilter(patch: Record<string, string | null>): void {
    updateQuery(this.router, this.route, patch);
  }

  onStatus(event: Event): void {
    this.setFilter({ status: (event.target as HTMLSelectElement).value });
  }

  onFeatured(j: Job, event: Event): void {
    this.toggleFeatured(j, (event.target as HTMLInputElement).checked);
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.jobs(this.query()));
  }

  protected company(j: Job): string {
    return j.employer?.companyName ?? j.companyName ?? 'Confidential client';
  }

  approve(j: Job): void {
    this.confirm
      .open({
        title: 'Approve this requirement?',
        message: `"${j.title}" for ${this.company(j)} will be published as a job opportunity and opened to Veejee Services recruiters.`,
        confirmText: 'Approve',
      })
      .subscribe((r) => {
        if (!r) return;
        this.moderate(j, 'approve');
      });
  }

  reject(j: Job): void {
    this.confirm
      .open({
        title: 'Reject this requirement?',
        message: `The company will see your reason and can edit and resubmit "${j.title}".`,
        confirmText: 'Reject',
        tone: 'danger',
        reason: { label: 'Reason for rejection', required: true, maxLength: 500 },
      })
      .subscribe((r) => {
        if (!r) return;
        this.moderate(j, 'reject', r.reason);
      });
  }

  toggleFeatured(j: Job, featured: boolean): void {
    this.busy.set(j.id);
    this.admin.featureJob(j.id, featured).subscribe({
      next: () => {
        this.busy.set(null);
        this.list.patch(j.id, { featured });
        this.toast.success(featured ? 'Requirement marked as featured' : 'Requirement removed from featured');
      },
      error: () => {
        this.busy.set(null);
        this.list.patch(j.id, { featured: j.featured });
      },
    });
  }

  private moderate(j: Job, action: 'approve' | 'reject', reason?: string): void {
    this.busy.set(j.id);
    const next: JobStatus = action === 'approve' ? 'published' : 'rejected';
    this.admin.moderateJob(j.id, action, reason).subscribe({
      next: () => {
        this.busy.set(null);
        const filter = this.status();
        if (filter && filter !== next) {
          this.list.remove(j.id);
        } else {
          this.list.patch(j.id, { status: next, rejectionReason: reason ?? null });
        }
        this.toast.success(action === 'approve' ? 'Requirement approved' : 'Requirement rejected');
      },
      error: () => this.busy.set(null),
    });
  }
}
