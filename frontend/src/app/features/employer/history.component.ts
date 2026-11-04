import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { Submission, SubmissionStatus } from '../../core/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { SubmissionRowComponent } from './employer-ui';

interface RequirementGroup {
  jobId: string;
  title: string;
  items: Submission[];
  counts: { total: number; inProgress: number; selected: number; placed: number; rejected: number };
}

const IN_PROGRESS: readonly SubmissionStatus[] = ['submitted', 'company_reviewing', 'interview_requested', 'interview_scheduled', 'interview_completed', 'on_hold'];

/** Recruitment progress & history, grouped by requirement. */
@Component({
  selector: 'app-employer-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent, SkeletonComponent, SubmissionRowComponent],
  template: `
    <app-page-header eyebrow="History" title="Recruitment progress & history" illustration="analytics"
      subtitle="Every candidate Veejee Services has submitted to you, grouped by requirement, with outcomes." />

    @if (data.isLoading()) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (data.error()) {
      <app-empty-state tone="error" title="History could not be loaded">
        <button class="btn btn-primary" type="button" (click)="data.reload()">Retry</button>
      </app-empty-state>
    } @else {
      <div class="d-grid gap-4">
        @for (g of groups(); track g.jobId) {
          <section class="card group">
            <div class="card-header d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <h2 class="h6 mb-0"><a [routerLink]="['/employer/requirements', g.jobId]">{{ g.title }}</a></h2>
              <div class="d-flex flex-wrap gap-2 small">
                <span class="badge text-bg-light border">{{ g.counts.total }} submitted</span>
                <span class="badge text-bg-info">{{ g.counts.inProgress }} in progress</span>
                <span class="badge text-bg-success">{{ g.counts.selected + g.counts.placed }} selected / placed</span>
                <span class="badge text-bg-secondary">{{ g.counts.rejected }} not selected</span>
              </div>
            </div>
            <div class="card-body">
              @if (g.counts.total) {
                <div class="progress mb-3" role="img" [attr.aria-label]="'Outcome ratio for ' + g.title">
                  <div class="progress-bar bg-success" [style.width.%]="pct(g.counts.selected + g.counts.placed, g.counts.total)"></div>
                  <div class="progress-bar bg-info" [style.width.%]="pct(g.counts.inProgress, g.counts.total)"></div>
                  <div class="progress-bar bg-secondary" [style.width.%]="pct(g.counts.rejected, g.counts.total)"></div>
                </div>
              }
              <div class="grid">
                @for (s of g.items; track s.id) {
                  <app-submission-row [submission]="s" [showJob]="false" />
                }
              </div>
            </div>
          </section>
        } @empty {
          <app-empty-state illustration="empty-candidates" title="No recruitment history yet"
            message="Candidates submitted by Veejee Services will appear here with their outcomes.">
            <a class="btn btn-gold" routerLink="/employer/requirements/new"><i class="bi bi-plus-circle" aria-hidden="true"></i>Post a requirement</a>
          </app-empty-state>
        }
      </div>
    }
  `,
  styles: `
    .group { border-top: 3px solid var(--an-navy-700); }
    .group h2 a { color: var(--an-navy-900); text-decoration: none; overflow-wrap: anywhere; }
    .grid { display: grid; gap: var(--an-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); }
    .progress { height: 0.5rem; }
  `,
})
export default class EmployerHistoryComponent {
  private readonly api = inject(EmployerPortalService);
  protected readonly data = rxResource({ stream: () => this.api.submissions({ history: true, limit: 100 }).pipe(map((p) => p.items)) });

  protected readonly groups = computed<RequirementGroup[]>(() => {
    const byJob = new Map<string, RequirementGroup>();
    for (const s of this.data.value() ?? []) {
      const id = s.job?.id ?? 'unknown';
      let g = byJob.get(id);
      if (!g) {
        g = { jobId: id, title: s.job?.title ?? 'Requirement', items: [], counts: { total: 0, inProgress: 0, selected: 0, placed: 0, rejected: 0 } };
        byJob.set(id, g);
      }
      g.items.push(s);
      g.counts.total++;
      if (IN_PROGRESS.includes(s.status)) g.counts.inProgress++;
      else if (s.status === 'selected') g.counts.selected++;
      else if (s.status === 'placed') g.counts.placed++;
      else if (s.status === 'rejected' || s.status === 'withdrawn') g.counts.rejected++;
    }
    return [...byJob.values()];
  });

  pct(n: number, total: number): number {
    return total ? (n / total) * 100 : 0;
  }
}
