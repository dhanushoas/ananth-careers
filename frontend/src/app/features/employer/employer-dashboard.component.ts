import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { CandidateInterview } from '../../core/models';
import { ChartDatum } from '../../shared/components/bar-chart.component';
import { DonutChartComponent } from '../../shared/components/donut-chart.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { CountUpComponent } from '../../shared/illustrations/count-up.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { EnumLabelPipe, enumLabel } from '../../shared/pipes/enum-label.pipe';
import { CompanyContextService } from './company-context.service';
import { SUBMISSION_LABELS, SubmissionRowComponent, interviewModeIcon } from './employer-ui';
import { VerificationBannerComponent } from './workspace-state.component';

@Component({
  selector: 'app-employer-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    DonutChartComponent,
    EmptyStateComponent,
    SkeletonComponent,
    IllustrationComponent,
    CountUpComponent,
    RevealDirective,
    EnumLabelPipe,
    SubmissionRowComponent,
    VerificationBannerComponent,
  ],
  template: `
    <section class="welcome hero-navy mb-4">
      <div class="copy">
        <span class="eyebrow">Employer portal</span>
        <h1 class="h2 mb-2">Welcome, {{ firstName() }}</h1>
        <p class="mb-3">{{ companyName() }} · Veejee Services screens and submits pre-qualified, consented candidates for your requirements.</p>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-gold" routerLink="/employer/requirements/new"><i class="bi bi-plus-circle" aria-hidden="true"></i>Post a requirement</a>
          <a class="btn btn-outline-light" routerLink="/employer/candidates"><i class="bi bi-person-check" aria-hidden="true"></i>Submitted candidates</a>
        </div>
      </div>
      <app-illustration name="dashboard-employer" class="art d-none d-md-block" />
    </section>

    <app-verification-banner />

    @if (dash.isLoading()) {
      <app-skeleton variant="stat" [count]="4" />
    } @else if (dash.error()) {
      <app-empty-state tone="error" title="Dashboard could not be loaded" message="Please try again.">
        <button class="btn btn-primary" type="button" (click)="dash.reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Retry</button>
      </app-empty-state>
    } @else if (dash.value(); as d) {
      <section class="stat-grid mb-4" aria-label="Summary">
        <a class="card stat" routerLink="/employer/candidates">
          <i class="bi bi-person-check" aria-hidden="true"></i>
          <span class="label">Candidates submitted</span>
          <strong class="value"><app-count-up [value]="d.totals.submitted" /></strong>
        </a>
        <a class="card stat" routerLink="/employer/candidates" [queryParams]="{ status: 'submitted' }">
          <i class="bi bi-hourglass-split" aria-hidden="true"></i>
          <span class="label">Awaiting your review</span>
          <strong class="value"><app-count-up [value]="d.totals.awaitingReview" /></strong>
        </a>
        <a class="card stat" routerLink="/employer/interviews">
          <i class="bi bi-calendar2-event" aria-hidden="true"></i>
          <span class="label">Interviews</span>
          <strong class="value"><app-count-up [value]="d.totals.interviews" /></strong>
        </a>
        <a class="card stat" routerLink="/employer/history">
          <i class="bi bi-trophy" aria-hidden="true"></i>
          <span class="label">Hired</span>
          <strong class="value"><app-count-up [value]="d.totals.hired" /></strong>
        </a>
      </section>

      <div class="charts mb-4">
        <section class="card" appReveal>
          <div class="card-body">
            <app-donut-chart title="Submitted candidates by status" [data]="submissionChart()" centerLabel="Candidates" />
          </div>
        </section>
        <section class="card" appReveal>
          <div class="card-body">
            <app-donut-chart title="Requirements by status" [data]="requirementChart()" centerLabel="Requirements" />
          </div>
        </section>
      </div>

      <div class="cols">
        <section appReveal>
          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <h2 class="h5 m-0">Recently submitted candidates</h2>
            <a class="btn btn-sm btn-link" routerLink="/employer/candidates">View all <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
          </div>
          <div class="d-grid gap-3">
            @for (s of d.recentSubmissions; track s.id) {
              <app-submission-row [submission]="s" />
            } @empty {
              <app-empty-state illustration="empty-candidates" [compact]="true" title="No candidates yet"
                message="Post a requirement — Veejee Services will screen and submit suitable, consented candidates." />
            }
          </div>
        </section>
        <section appReveal>
          <h2 class="h5 mb-3">Upcoming interviews</h2>
          <div class="card">
            <ul class="list-group list-group-flush">
              @for (iv of upcoming(); track iv.id) {
                <li class="list-group-item d-flex gap-3 align-items-start">
                  <span class="iv-ic"><i [class]="'bi ' + modeIcon(iv.mode)" aria-hidden="true"></i></span>
                  <div class="min-w-0">
                    <strong class="d-block text-truncate">{{ name(iv) }}</strong>
                    <span class="small text-secondary d-block">{{ iv.scheduledAt | date: 'EEE, d MMM, h:mm a' }} · {{ iv.mode | enumLabel }}</span>
                    @if (iv.job?.title; as jt) { <span class="small text-secondary d-block text-truncate">{{ jt }}</span> }
                  </div>
                </li>
              } @empty {
                <li class="list-group-item text-secondary small py-4 text-center">
                  <i class="bi bi-calendar2-x d-block fs-3 mb-1" aria-hidden="true"></i>No upcoming interviews.
                </li>
              }
            </ul>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .welcome { display: flex; align-items: center; justify-content: space-between; gap: var(--an-space-4); padding: var(--an-space-5); border-radius: var(--an-radius-xl); }
    .copy { min-width: 0; }
    .art { width: 180px; flex: none; }
    .stat { display: flex; flex-direction: column; gap: 2px; padding: var(--an-space-4); text-decoration: none; color: inherit; }
    .stat .label { font-size: 0.86rem; color: var(--an-text-2); }
    .stat .value { font-family: var(--an-font-heading); font-size: 1.8rem; color: var(--an-navy-900); line-height: 1.1; }
    .charts { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); }
    .cols { display: grid; gap: var(--an-space-5); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 1200px) { .cols { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); } }
    .iv-ic { width: 38px; height: 38px; border-radius: 10px; flex: none; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-50); color: var(--an-navy-700); }
    .min-w-0 { min-width: 0; }
  `,
})
export default class EmployerDashboardComponent {
  private readonly api = inject(EmployerPortalService);
  private readonly auth = inject(AuthService);
  private readonly ctx = inject(CompanyContextService);

  protected readonly dash = rxResource({ stream: () => this.api.dashboard() });
  protected readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);
  protected readonly companyName = computed(() => this.dash.value()?.company.companyName ?? this.ctx.employer()?.companyName ?? 'Your company');
  protected readonly submissionChart = computed<ChartDatum[]>(() =>
    Object.entries(this.dash.value()?.submissionsByStatus ?? {})
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => ({ label: SUBMISSION_LABELS[k as keyof typeof SUBMISSION_LABELS] ?? enumLabel(k), value: v ?? 0 })),
  );
  protected readonly requirementChart = computed<ChartDatum[]>(() =>
    Object.entries(this.dash.value()?.requirementsByStatus ?? {})
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => ({ label: enumLabel(k), value: v ?? 0 })),
  );
  protected readonly upcoming = computed(() => (this.dash.value()?.upcomingInterviews ?? []).slice(0, 6));
  protected readonly modeIcon = interviewModeIcon;

  name(iv: CandidateInterview): string {
    const c = iv.candidate;
    return c && typeof c === 'object' ? c.name : 'Candidate';
  }
}
