import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EMPLOYMENT_TYPES, EmploymentType, Industry, Job, JobSearchQuery, WORK_MODES, WorkMode } from '../../core/models';
import { JobsService } from '../../core/services/jobs.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { SavedJobsState } from '../jobs/saved-jobs.state';

/** Published job opportunities, browsed from inside the candidate portal. Applying happens on /jobs/:slug. */
@Component({
  selector: 'app-candidate-available-jobs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, JobCardComponent, PageHeaderComponent, PaginatorComponent, SkeletonComponent, EnumLabelPipe],
  template: `
    <app-page-header title="Available jobs" eyebrow="Candidate" illustration="jobs"
      subtitle="Open requirements from Veejee Services client companies. Apply through Veejee Services and our recruiters take it from there.">
      <a class="btn btn-outline-primary" routerLink="/candidate/saved-jobs"><i class="bi bi-bookmark-star" aria-hidden="true"></i> Saved jobs</a>
    </app-page-header>

    <form class="card filters mb-4" [formGroup]="form" (ngSubmit)="search()" role="search" aria-label="Filter jobs">
      <div class="card-body">
        <div class="row g-2 align-items-stretch">
          <div class="col-12 col-md-6 col-xl-3">
            <div class="form-floating">
              <input class="form-control" id="aj-q" formControlName="q" placeholder=" " />
              <label for="aj-q">Keyword</label>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-2">
            <div class="form-floating">
              <input class="form-control" id="aj-loc" formControlName="location" placeholder=" " />
              <label for="aj-loc">Location</label>
            </div>
          </div>
          <div class="col-12 col-md-4 col-xl-2">
            <div class="form-floating">
              <select class="form-select" id="aj-ind" formControlName="industry">
                <option value="">All industries</option>
                @for (i of industries(); track i.id) {
                  <option [value]="i.slug">{{ i.name }}</option>
                }
              </select>
              <label for="aj-ind">Industry</label>
            </div>
          </div>
          <div class="col-6 col-md-4 col-xl-2">
            <div class="form-floating">
              <select class="form-select" id="aj-type" formControlName="employmentType">
                <option value="">Any</option>
                @for (t of employmentTypes; track t) {
                  <option [value]="t">{{ t | enumLabel }}</option>
                }
              </select>
              <label for="aj-type">Type</label>
            </div>
          </div>
          <div class="col-6 col-md-4 col-xl-1">
            <div class="form-floating">
              <select class="form-select" id="aj-mode" formControlName="workMode">
                <option value="">Any</option>
                @for (m of workModes; track m) {
                  <option [value]="m">{{ m | enumLabel }}</option>
                }
              </select>
              <label for="aj-mode">Mode</label>
            </div>
          </div>
          <div class="col-12 col-xl-2 d-grid">
            <button class="btn btn-primary" type="submit"><i class="bi bi-search" aria-hidden="true"></i> Search</button>
          </div>
        </div>
      </div>
    </form>

    @if (results.isLoading()) {
      <app-skeleton variant="job-card" [count]="6" />
    } @else if (results.error()) {
      <app-empty-state tone="error" illustration="error" title="Jobs could not be loaded" message="Please try again.">
        <button class="btn btn-primary" type="button" (click)="results.reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
      </app-empty-state>
    } @else if (results.value(); as r) {
      <p class="text-secondary small mb-3" aria-live="polite"><strong class="text-body">{{ r.total }}</strong> {{ r.total === 1 ? 'job' : 'jobs' }} found</p>
      <div class="grid">
        @for (job of r.items; track job.id) {
          <app-job-card [job]="job" [showSave]="true" [saved]="saved.isSaved(job)" [saving]="saved.isPending(job.id)" (saveToggle)="toggleSave($event)" />
        } @empty {
          <app-empty-state illustration="empty-search" title="No jobs match your filters" message="Try a broader keyword or location." />
        }
      </div>
      <app-paginator [page]="r.page" [limit]="r.limit" [total]="r.total" [pageSizeOptions]="[12]" (pageChange)="onPage($event)" />
    }
  `,
  styles: `
    .filters { border-top: 3px solid var(--an-gold-500); }
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
  `,
})
export default class CandidateAvailableJobsComponent {
  private readonly jobsApi = inject(JobsService);
  protected readonly saved = inject(SavedJobsState);
  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly workModes = WORK_MODES;
  protected readonly industries = toSignal(
    inject(TaxonomyService)
      .industries()
      .pipe(catchError(() => of<Industry[]>([]))),
    { initialValue: [] as Industry[] },
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    q: '',
    location: '',
    industry: '',
    employmentType: '' as EmploymentType | '',
    workMode: '' as WorkMode | '',
  });
  private readonly query = signal<JobSearchQuery>({ page: 1, limit: 12, sort: 'latest' });
  protected readonly results = rxResource({ params: () => this.query(), stream: ({ params }) => this.jobsApi.search(params) });

  search(): void {
    const v = this.form.getRawValue();
    this.query.set({
      q: v.q.trim() || undefined,
      location: v.location.trim() || undefined,
      industry: v.industry || undefined,
      employmentType: v.employmentType ? [v.employmentType] : undefined,
      workMode: v.workMode ? [v.workMode] : undefined,
      page: 1,
      limit: 12,
      sort: v.q.trim() ? 'relevance' : 'latest',
    });
  }

  onPage(e: PageChange): void {
    this.query.update((q) => ({ ...q, page: e.page }));
  }

  toggleSave(job: Job): void {
    this.saved.toggle(job).subscribe();
  }
}
