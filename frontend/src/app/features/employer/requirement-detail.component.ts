import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { JobsService } from '../../core/services/jobs.service';
import { toAppError } from '../../core/http/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../shared/pipes/location.pipe';
import { SalaryRangePipe } from '../../shared/pipes/salary-range.pipe';
import { SubmissionRowComponent } from './employer-ui';

/** A requirement with the candidates Veejee Services has submitted for it. */
@Component({
  selector: 'app-employer-requirement-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe, LocationsPipe, SalaryRangePipe, SubmissionRowComponent],
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb small">
        <li class="breadcrumb-item"><a routerLink="/employer/requirements">Requirements</a></li>
        <li class="breadcrumb-item active" aria-current="page">{{ job.value()?.title ?? 'Requirement' }}</li>
      </ol>
    </nav>
    @if (job.isLoading()) {
      <app-skeleton variant="card" [count]="2" />
    } @else if (job.error()) {
      <app-empty-state tone="error" [illustration]="notFound() ? 'not-found' : 'error'" [title]="notFound() ? 'Requirement not found' : 'Requirement could not be loaded'">
        <a class="btn btn-outline-primary" routerLink="/employer/requirements"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to requirements</a>
      </app-empty-state>
    } @else if (job.value(); as j) {
      <section class="card head mb-4">
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
            <h1 class="h3 m-0 title">{{ j.title }}</h1>
            <app-status-chip [status]="j.status" />
            @if (j.confidential) { <span class="badge text-bg-light border"><i class="bi bi-incognito" aria-hidden="true"></i> Confidential</span> }
          </div>
          <ul class="facts">
            <li><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ j.locations | locations: 3 }}</li>
            <li><i class="bi bi-briefcase" aria-hidden="true"></i>{{ j.employmentType | enumLabel }} · {{ j.workMode | enumLabel }}</li>
            <li><i class="bi bi-bar-chart-steps" aria-hidden="true"></i>{{ j.experience.min }}–{{ j.experience.max }} yrs</li>
            <li><i class="bi bi-cash-stack" aria-hidden="true"></i>{{ j.salary | salaryRange }}</li>
            <li><i class="bi bi-people" aria-hidden="true"></i>{{ j.openings }} {{ j.openings === 1 ? 'vacancy' : 'vacancies' }}</li>
            @if (j.noticePeriodMaxDays) { <li><i class="bi bi-hourglass" aria-hidden="true"></i>Notice ≤ {{ j.noticePeriodMaxDays }} days</li> }
            <li><i class="bi bi-calendar3" aria-hidden="true"></i>Created {{ j.createdAt | date: 'mediumDate' }}</li>
          </ul>
          @if (j.status === 'rejected' && j.rejectionReason) {
            <div class="alert alert-danger small py-2 mt-3 mb-0">Not approved: {{ j.rejectionReason }}</div>
          }
          @if (j.status === 'pending_approval') {
            <div class="alert alert-warning small py-2 mt-3 mb-0"><i class="bi bi-hourglass-split" aria-hidden="true"></i> Awaiting Veejee Services approval. Sourcing starts once approved.</div>
          }
          <div class="d-flex flex-wrap gap-2 mt-3">
            @if (j.status !== 'closed') {
              <a class="btn btn-outline-primary btn-sm" [routerLink]="['/employer/requirements', j.id, 'edit']"><i class="bi bi-pencil" aria-hidden="true"></i>Edit requirement</a>
            }
          </div>
        </div>
      </section>

      <h2 class="h5 mb-3"><i class="bi bi-person-check text-gold" aria-hidden="true"></i> Candidates submitted by Veejee Services</h2>
      @if (subs.isLoading()) {
        <app-skeleton variant="card" [count]="2" />
      } @else if (subs.error()) {
        <app-empty-state tone="error" title="Candidates could not be loaded" [compact]="true">
          <button class="btn btn-outline-primary" type="button" (click)="subs.reload()">Retry</button>
        </app-empty-state>
      } @else {
        <div class="grid">
          @for (s of subs.value() ?? []; track s.id) {
            <app-submission-row [submission]="s" [showJob]="false" />
          } @empty {
            <app-empty-state illustration="empty-candidates" [compact]="true" title="No candidates submitted yet"
              message="Veejee Services recruiters are working on this requirement. You will be notified when a candidate is submitted." />
          }
        </div>
      }
    }
  `,
  styles: `
    .head { border-left: 4px solid var(--an-gold-500); }
    .title { overflow-wrap: anywhere; }
    .facts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--an-text-2); font-size: 0.92rem; }
    .facts .bi { color: var(--an-gold-600); margin-right: 4px; }
    .grid { display: grid; gap: var(--an-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); }
  `,
})
export default class RequirementDetailComponent {
  readonly id = input.required<string>();
  private readonly jobsApi = inject(JobsService);
  private readonly api = inject(EmployerPortalService);

  protected readonly job = rxResource({ params: () => this.id(), stream: ({ params }) => this.jobsApi.get(params) });
  protected readonly subs = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.submissions({ jobId: params, history: true, limit: 100 }).pipe(map((p) => p.items)),
  });
  protected readonly notFound = computed(() => toAppError(this.job.error()).errorCode === 'NOT_FOUND');
}
