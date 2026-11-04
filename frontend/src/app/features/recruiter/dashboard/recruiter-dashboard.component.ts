import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { CandidateStage, STAGE_LABELS } from '../../../core/models';
import { DonutChartComponent } from '../../../shared/components/donut-chart.component';
import { ChartDatum } from '../../../shared/components/bar-chart.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { CountUpComponent } from '../../../shared/illustrations/count-up.component';
import { IllustrationComponent } from '../../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../../shared/illustrations/reveal.directive';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { refId, refName } from '../candidates/recruiter-utils';

@Component({
  selector: 'app-recruiter-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    DonutChartComponent,
    EmptyStateComponent,
    SkeletonComponent,
    StatusChipComponent,
    CountUpComponent,
    IllustrationComponent,
    RevealDirective,
    EnumLabelPipe,
    TimeAgoPipe,
  ],
  template: `
    <section class="welcome hero-navy">
      <div class="w-text">
        <span class="eyebrow">Recruiter portal</span>
        <h1 class="h2 mb-1">Good to see you, {{ firstName() }}</h1>
        <p class="mb-3">Screen candidates, match them to client requirements and coordinate interviews through to placement.</p>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-gold" routerLink="/recruiter/candidates"><i class="bi bi-search" aria-hidden="true"></i> Search candidates</a>
          <a class="btn btn-outline-light" routerLink="/recruiter/requirements"><i class="bi bi-clipboard-check" aria-hidden="true"></i> Requirements</a>
        </div>
      </div>
      <app-illustration name="analytics" class="w-art d-none d-md-block" />
    </section>

    @if (data.isLoading()) {
      <app-skeleton variant="stat" [count]="5" />
    } @else if (data.error()) {
      <app-empty-state tone="error" title="The dashboard could not be loaded" message="Please try again in a moment.">
        <button class="btn btn-primary" type="button" (click)="data.reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
      </app-empty-state>
    } @else if (data.value(); as d) {
      <section class="stat-grid mb-4" aria-label="Key figures">
        <a class="card stat" routerLink="/recruiter/candidates" [queryParams]="{ assigned: 'me' }">
          <i class="bi bi-people" aria-hidden="true"></i>
          <span class="k">Assigned candidates</span>
          <strong><app-count-up [value]="d.assignedCandidates.total" /></strong>
        </a>
        <a class="card stat" routerLink="/recruiter/applications" [queryParams]="{ status: 'applied' }">
          <i class="bi bi-inbox" aria-hidden="true"></i>
          <span class="k">Pending applications</span>
          <strong><app-count-up [value]="d.pendingApplications" /></strong>
        </a>
        <a class="card stat" routerLink="/recruiter/requirements">
          <i class="bi bi-hourglass-split" aria-hidden="true"></i>
          <span class="k">Shortlists awaiting approval</span>
          <strong><app-count-up [value]="d.pendingApprovals" /></strong>
        </a>
        <a class="card stat" routerLink="/recruiter/submissions">
          <i class="bi bi-send-check" aria-hidden="true"></i>
          <span class="k">Open submissions</span>
          <strong><app-count-up [value]="d.openSubmissions" /></strong>
        </a>
        <div class="card stat">
          <i class="bi bi-trophy" aria-hidden="true"></i>
          <span class="k">Placements this month</span>
          <strong><app-count-up [value]="d.placementsThisMonth" /></strong>
        </div>
      </section>

      <div class="grid">
        <section class="card" appReveal>
          <div class="card-body">
            <app-donut-chart title="My candidates by stage" [data]="stageData()" centerLabel="Assigned" />
          </div>
        </section>

        <section class="card" appReveal>
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h2 class="h6 m-0"><i class="bi bi-calendar-plus text-gold" aria-hidden="true"></i> Interview requests to schedule</h2>
              <span class="badge text-bg-gold">{{ d.interviewRequests.length }}</span>
            </div>
            @for (s of d.interviewRequests; track s.id) {
              <div class="row-item">
                <div class="min-w-0">
                  <strong class="d-block text-truncate">{{ s.candidate.name }}</strong>
                  <span class="small text-secondary">{{ s.job.title }} · {{ companyOf(s) }}</span>
                </div>
                <a class="btn btn-sm btn-gold" [routerLink]="['/recruiter/submissions', s.id]">Schedule</a>
              </div>
            } @empty {
              <app-empty-state [compact]="true" illustration="empty-interviews" title="No pending interview requests" />
            }
          </div>
        </section>

        <section class="card" appReveal>
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h2 class="h6 m-0"><i class="bi bi-calendar2-event text-gold" aria-hidden="true"></i> Upcoming interviews</h2>
              <a class="small fw-semibold" routerLink="/recruiter/interviews">View all</a>
            </div>
            @for (iv of d.upcomingInterviews; track iv.id) {
              <div class="row-item">
                <span class="date-tile" aria-hidden="true">
                  <span>{{ iv.scheduledAt | date: 'd' }}</span><small>{{ iv.scheduledAt | date: 'MMM' }}</small>
                </span>
                <div class="min-w-0 flex-grow-1">
                  <strong class="d-block text-truncate">{{ personName(iv.candidate) }}</strong>
                  <span class="small text-secondary">{{ iv.job?.title }} · {{ iv.scheduledAt | date: 'EEE, h:mm a' }} · {{ iv.mode | enumLabel }}</span>
                </div>
                <app-status-chip [status]="iv.candidateResponse" />
              </div>
            } @empty {
              <app-empty-state [compact]="true" illustration="empty-interviews" title="No interviews scheduled" />
            }
          </div>
        </section>

        <section class="card" appReveal>
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h2 class="h6 m-0"><i class="bi bi-clipboard-check text-gold" aria-hidden="true"></i> My requirements</h2>
              <a class="small fw-semibold" routerLink="/recruiter/requirements" [queryParams]="{ assigned: 'me' }">View all</a>
            </div>
            @for (r of d.myRequirements; track r.id) {
              <a class="req" [routerLink]="['/recruiter/requirements', r.id]">
                <span class="d-flex justify-content-between gap-2">
                  <strong class="text-truncate">{{ r.title }}</strong>
                  <span class="small text-secondary text-nowrap">{{ r.filledCount ?? 0 }}/{{ r.openings }} filled</span>
                </span>
                <span class="small text-secondary d-block">{{ r.companyName || 'Client company' }} · {{ r.applicationsCount ?? 0 }} applications</span>
                <span class="progress mt-2" role="progressbar" [attr.aria-label]="'Positions filled for ' + r.title"
                  [attr.aria-valuenow]="r.filledCount ?? 0" aria-valuemin="0" [attr.aria-valuemax]="r.openings">
                  <span class="progress-bar" [style.width.%]="fill(r.filledCount, r.openings)"></span>
                </span>
              </a>
            } @empty {
              <app-empty-state [compact]="true" illustration="empty-jobs" title="No requirements assigned to you" />
            }
          </div>
        </section>

        <section class="card wide" appReveal>
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h2 class="h6 m-0"><i class="bi bi-inbox text-gold" aria-hidden="true"></i> Recent applications</h2>
              <a class="small fw-semibold" routerLink="/recruiter/applications">Screening queue</a>
            </div>
            <ul class="list-group list-group-flush">
              @for (a of d.recentApplications; track a.id) {
                <li class="list-group-item d-flex flex-wrap align-items-center gap-2 px-0">
                  <div class="min-w-0 flex-grow-1">
                    <a class="fw-semibold" [routerLink]="['/recruiter/candidates', profileId(a.candidateProfile)]">{{ personName(a.candidate) }}</a>
                    <span class="small text-secondary d-block">{{ a.job.title }} · {{ a.job.companyName || 'Client company' }} · {{ a.createdAt | timeAgo }}</span>
                  </div>
                  <app-status-chip [status]="a.status" />
                </li>
              } @empty {
                <li class="list-group-item px-0"><app-empty-state [compact]="true" illustration="empty-applications" title="No recent applications" /></li>
              }
            </ul>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .welcome { display: flex; align-items: center; justify-content: space-between; gap: var(--an-space-4); padding: var(--an-space-5);
      border-radius: var(--an-radius-xl); margin-bottom: var(--an-space-5); }
    .w-text { min-width: 0; max-width: 60ch; }
    .w-art { width: 180px; flex: none; }
    .stat { display: flex; flex-direction: column; gap: 4px; padding: var(--an-space-4); text-decoration: none; color: inherit; }
    .stat .k { color: var(--an-text-2); font-size: 0.88rem; }
    .stat strong { font-family: var(--an-font-heading); font-size: 1.8rem; color: var(--an-navy-900); line-height: 1.1; }
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 992px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .wide { grid-column: 1 / -1; } }
    .row-item { display: flex; align-items: center; gap: var(--an-space-3); padding: 10px 0; border-bottom: 1px solid var(--an-border); }
    .row-item:last-child { border-bottom: 0; }
    .min-w-0 { min-width: 0; }
    .date-tile { flex: none; width: 46px; height: 50px; border-radius: 10px; background: var(--an-navy-900); color: #fff; display: flex;
      flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1; }
    .date-tile small { font-size: 0.65rem; color: var(--an-gold-300); text-transform: uppercase; margin-top: 2px; }
    .req { display: block; padding: 10px 0; border-bottom: 1px solid var(--an-border); text-decoration: none; color: inherit; }
    .req:last-child { border-bottom: 0; }
    .req:hover strong { color: var(--an-navy-700); text-decoration: underline; }
    .progress { display: flex; }
  `,
})
export default class RecruiterDashboardComponent {
  private readonly api = inject(RecruitmentService);
  private readonly auth = inject(AuthService);
  protected readonly data = rxResource({ stream: () => this.api.dashboard() });
  protected readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0] || 'there');
  protected readonly stageData = computed<ChartDatum[]>(() => {
    const by = this.data.value()?.assignedCandidates.byStage ?? {};
    return Object.entries(by)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => ({ label: STAGE_LABELS[k as CandidateStage] ?? k, value: v ?? 0 }));
  });

  protected readonly personName = refName;
  protected readonly profileId = refId;

  protected companyOf(s: { employer: unknown; job: { companyName?: string } }): string {
    const e = s.employer;
    if (e && typeof e === 'object' && 'companyName' in e) return String((e as { companyName: string }).companyName);
    return s.job.companyName ?? 'Client company';
  }

  protected fill(filled: number | undefined, openings: number): number {
    return openings > 0 ? Math.min(100, ((filled ?? 0) / openings) * 100) : 0;
  }
}
