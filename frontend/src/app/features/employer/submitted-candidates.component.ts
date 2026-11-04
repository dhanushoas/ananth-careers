import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, switchMap, tap } from 'rxjs';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { JobsService } from '../../core/services/jobs.service';
import { Job, Paginated, SUBMISSION_STATUSES, Submission, SubmissionStatus } from '../../core/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { SUBMISSION_LABELS, SubmissionRowComponent } from './employer-ui';

@Component({
  selector: 'app-submitted-candidates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent, PaginatorComponent, SkeletonComponent, SubmissionRowComponent],
  template: `
    <app-page-header
      eyebrow="Candidates"
      title="Submitted candidates"
      subtitle="Candidates Veejee Services has screened, shortlisted and submitted to you — always with the candidate's consent."
      illustration="applications"
    />

    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-5">
            <div class="form-floating">
              <select class="form-select" id="sc-job" (change)="setParam('jobId', $event)">
                <option value="" [selected]="!jobId()">All requirements</option>
                @for (j of jobs(); track j.id) {
                  <option [value]="j.id" [selected]="jobId() === j.id">{{ j.title }}</option>
                }
              </select>
              <label for="sc-job">Requirement</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="form-floating">
              <select class="form-select" id="sc-status" (change)="setParam('status', $event)">
                <option value="" [selected]="!status()">All statuses</option>
                @for (s of statuses; track s) {
                  <option [value]="s" [selected]="status() === s">{{ labels[s] }}</option>
                }
              </select>
              <label for="sc-status">Status</label>
            </div>
          </div>
          <div class="col-12 col-md-3">
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" role="switch" id="sc-history" [checked]="history()" (change)="toggleHistory($event)" />
              <label class="form-check-label" for="sc-history">Include closed</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    @if (loading()) {
      <app-skeleton variant="card" [count]="4" />
    } @else if (error()) {
      <app-empty-state tone="error" title="Candidates could not be loaded" message="Please try again.">
        <button class="btn btn-primary" type="button" (click)="reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Retry</button>
      </app-empty-state>
    } @else if (page(); as p) {
      @if (p.items.length) {
        <p class="small text-secondary"><strong class="text-body">{{ p.total }}</strong> {{ p.total === 1 ? 'candidate' : 'candidates' }}</p>
        <div class="grid">
          @for (s of p.items; track s.id) {
            <app-submission-row [submission]="s" />
          }
        </div>
        <app-paginator [page]="p.page" [limit]="p.limit" [total]="p.total" (pageChange)="onPage($event)" />
      } @else {
        <app-empty-state
          illustration="empty-candidates"
          title="No submitted candidates yet"
          [message]="jobId() || status() ? 'No candidates match these filters.' : 'Once Veejee Services screens and shortlists candidates for your requirements, they will appear here.'"
        >
          <a class="btn btn-outline-primary" routerLink="/employer/requirements"><i class="bi bi-clipboard-check" aria-hidden="true"></i>View requirements</a>
        </app-empty-state>
      }
    }
  `,
  styles: `.grid { display: grid; gap: var(--an-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); }`,
})
export default class SubmittedCandidatesComponent implements OnInit {
  private readonly api = inject(EmployerPortalService);
  private readonly jobsApi = inject(JobsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = SUBMISSION_STATUSES;
  protected readonly labels = SUBMISSION_LABELS;
  protected readonly jobs = signal<Job[]>([]);
  protected readonly jobId = signal('');
  protected readonly status = signal<SubmissionStatus | ''>('');
  protected readonly history = signal(false);
  protected readonly pageNo = signal(1);
  protected readonly limit = signal(20);
  protected readonly page = signal<Paginated<Submission> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.jobsApi
      .mine({ limit: 100 })
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((p) => this.jobs.set(p.items));

    this.route.queryParamMap
      .pipe(
        tap((m) => {
          const s = m.get('status') ?? '';
          this.status.set((SUBMISSION_STATUSES as readonly string[]).includes(s) ? (s as SubmissionStatus) : '');
          this.jobId.set(m.get('jobId') ?? '');
          this.history.set(m.get('history') === 'true');
          this.pageNo.set(Math.max(1, Number(m.get('page')) || 1));
          this.limit.set(Math.min(100, Math.max(1, Number(m.get('limit')) || 20)));
        }),
        switchMap(() => this.fetch()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  setParam(key: 'jobId' | 'status', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], { queryParams: { [key]: value || null, page: null }, queryParamsHandling: 'merge' });
  }

  toggleHistory(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    void this.router.navigate([], { queryParams: { history: checked ? 'true' : null, page: null }, queryParamsHandling: 'merge' });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { queryParams: { page: e.page, limit: e.limit }, queryParamsHandling: 'merge' });
  }

  reload(): void {
    this.fetch().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private fetch(): Observable<unknown> {
    this.loading.set(true);
    this.error.set(false);
    return this.api
      .submissions({
        jobId: this.jobId() || undefined,
        status: this.status() || undefined,
        history: this.history() || undefined,
        page: this.pageNo(),
        limit: this.limit(),
      })
      .pipe(
        tap((p) => {
          this.page.set(p);
          this.loading.set(false);
        }),
        catchError(() => {
          this.error.set(true);
          this.loading.set(false);
          return EMPTY;
        }),
      );
  }
}
