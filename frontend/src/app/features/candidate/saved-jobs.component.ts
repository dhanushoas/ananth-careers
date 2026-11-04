import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Job, Paginated } from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';

@Component({
  selector: 'app-candidate-saved-jobs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, JobCardComponent, PaginatorComponent],
  template: `
    <app-page-header title="Saved jobs" eyebrow="Candidate" illustration="jobs" subtitle="Jobs you bookmarked to review or apply to later.">
      <a class="btn btn-outline-primary" routerLink="/candidate/jobs"><i class="bi bi-search" aria-hidden="true"></i> Find more jobs</a>
    </app-page-header>
    @if (loading() && !page()) {
      <app-skeleton variant="job-card" [count]="6" />
    } @else if (error()) {
      <app-empty-state tone="error" illustration="error" title="We couldn't load your saved jobs">
        <button class="btn btn-primary" type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
      </app-empty-state>
    } @else if (page(); as p) {
      @if (p.items.length) {
        <div class="grid">
          @for (job of p.items; track job.id) {
            <app-job-card [job]="job" [showSave]="true" [saved]="true" [saving]="savingId() === job.id" (saveToggle)="unsave($event)" />
          }
        </div>
        <app-paginator [page]="p.page" [limit]="p.limit" [total]="p.total" (pageChange)="onPage($event)" />
      } @else {
        <app-empty-state illustration="empty-saved" title="No saved jobs" message="Tap the bookmark icon on any job to save it here.">
          <a class="btn btn-gold" routerLink="/candidate/jobs"><i class="bi bi-search" aria-hidden="true"></i> Browse jobs</a>
        </app-empty-state>
      }
    }
  `,
  styles: `
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
  `,
})
export default class SavedJobsComponent implements OnInit {
  private readonly api = inject(CandidateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly page = signal<Paginated<Job> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly savingId = signal<string | null>(null);
  private query = { page: 1, limit: 12 };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .savedJobs(this.query)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (p) => {
          // If the last item on a page was removed, step back a page.
          if (!p.items.length && p.page > 1) {
            this.query = { ...this.query, page: p.page - 1 };
            this.load();
            return;
          }
          this.page.set(p);
        },
        error: () => this.error.set(true),
      });
  }

  onPage(e: PageChange): void {
    this.query = { page: e.page, limit: e.limit };
    this.load();
  }

  unsave(job: Job): void {
    this.savingId.set(job.id);
    this.api
      .unsaveJob(job.id)
      .pipe(finalize(() => this.savingId.set(null)))
      .subscribe(() => {
        this.toast.success('Removed from saved jobs.');
        this.load();
      });
  }
}
