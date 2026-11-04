import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { AdminStatsV2 } from '../../core/models';
import { DonutChartComponent } from '../../shared/components/donut-chart.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { CountUpComponent } from '../../shared/illustrations/count-up.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { FunnelComponent, FunnelStep } from './admin-widgets';

interface QueueCard {
  label: string;
  value: number;
  icon: string;
  link: string;
  query?: Record<string, string>;
  permission: string;
  hint: string;
}

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    DonutChartComponent,
    EmptyStateComponent,
    SkeletonComponent,
    CountUpComponent,
    IllustrationComponent,
    RevealDirective,
    TimeAgoPipe,
    FunnelComponent,
  ],
  template: `
    <section class="welcome hero-navy">
      <div class="copy">
        <span class="eyebrow">Admin console</span>
        <h1 class="h3 mb-1">Welcome, {{ firstName() }}</h1>
        <p class="mb-0">Veejee Services at a glance — candidates, client companies, requirements and the recruitment pipeline.</p>
        <div class="d-flex flex-wrap gap-2 mt-3">
          @if (auth.hasPermission('shortlists:approve')) {
            <a class="btn btn-gold" routerLink="/admin/shortlists"><i class="bi bi-patch-check" aria-hidden="true"></i> Shortlist approvals</a>
          }
          @if (auth.canRecruit()) {
            <a class="btn btn-outline-light" routerLink="/recruiter"><i class="bi bi-person-workspace" aria-hidden="true"></i> Recruitment portal</a>
          }
        </div>
      </div>
      <app-illustration name="dashboard-admin" class="art d-none d-md-block" />
    </section>

    @if (loading() && !stats()) {
      <app-skeleton variant="stat" [count]="4" />
      <app-skeleton class="d-block mt-4" variant="card" [count]="2" />
    } @else if (error(); as err) {
      <app-empty-state tone="error" title="Couldn't load the dashboard" [message]="err">
        <button class="btn btn-primary" type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Try again</button>
      </app-empty-state>
    } @else if (stats(); as s) {
      <section aria-label="Key figures" class="stat-grid mb-4">
        @for (t of tiles(); track t.label) {
          <div class="card stat">
            <i [class]="'bi ' + t.icon" aria-hidden="true"></i>
            <span class="s-label">{{ t.label }}</span>
            <span class="s-value"><app-count-up [value]="t.value" /></span>
            <span class="s-sub">{{ t.sub }}</span>
          </div>
        }
      </section>

      @if (queues().length) {
        <section class="mb-4" aria-labelledby="attn-h">
          <h2 id="attn-h" class="h5 mb-3"><i class="bi bi-bell text-gold" aria-hidden="true"></i> Needs attention</h2>
          <div class="queues">
            @for (q of queues(); track q.label) {
              <a class="card card-hover queue" [class.hot]="q.value > 0" [routerLink]="q.link" [queryParams]="q.query ?? null">
                <span class="q-icon"><i [class]="'bi ' + q.icon" aria-hidden="true"></i></span>
                <span class="min-w-0">
                  <span class="q-value">{{ q.value | number }}</span>
                  <span class="q-label">{{ q.label }}</span>
                  <span class="q-hint">{{ q.hint }}</span>
                </span>
                <i class="bi bi-chevron-right ms-auto text-secondary" aria-hidden="true"></i>
              </a>
            }
          </div>
        </section>
      }

      <div class="row g-4">
        <div class="col-12 col-xl-7">
          <section class="card h-100" appReveal>
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h2 class="h5 m-0"><i class="bi bi-funnel text-gold" aria-hidden="true"></i> Recruitment pipeline</h2>
                <span class="badge text-bg-gold">{{ s.pipeline.placedThisMonth | number }} placed this month</span>
              </div>
              <app-funnel [steps]="funnel()" label="Recruitment pipeline from shortlist to placement" />
            </div>
          </section>
        </div>
        <div class="col-12 col-md-6 col-xl-5">
          <section class="card h-100" appReveal>
            <div class="card-body">
              <app-donut-chart title="Candidates by career level" [data]="careerData()" centerLabel="Candidates" />
            </div>
          </section>
        </div>
        <div class="col-12 col-md-6 col-xl-5">
          <section class="card h-100" appReveal>
            <div class="card-body">
              <app-donut-chart title="Client companies" [data]="companyData()" centerLabel="Companies" />
            </div>
          </section>
        </div>
        <div class="col-12 col-xl-7">
          <section class="card h-100" appReveal>
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 m-0"><i class="bi bi-clock-history text-gold" aria-hidden="true"></i> Recent activity</h2>
                @if (auth.hasPermission('audit:view')) {
                  <a routerLink="/admin/audit-logs" class="small fw-semibold">View all</a>
                }
              </div>
              @if (s.recentAuditLogs.length) {
                <ul class="list-group list-group-flush">
                  @for (l of s.recentAuditLogs.slice(0, 8); track l.id) {
                    <li class="list-group-item px-0 d-flex gap-3 align-items-start">
                      <span class="a-dot" aria-hidden="true"><i class="bi bi-activity"></i></span>
                      <span class="min-w-0 flex-grow-1">
                        <span class="d-block fw-semibold text-break">{{ l.action }}</span>
                        <span class="d-block small text-secondary text-break">
                          {{ actorName(l.actor) }}@if (l.entityType) { · {{ l.entityType }} }
                        </span>
                      </span>
                      <time class="small text-secondary text-nowrap" [attr.datetime]="l.createdAt" [title]="l.createdAt | date: 'medium'">{{ l.createdAt | timeAgo }}</time>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-secondary mb-0">No recent activity.</p>
              }
            </div>
          </section>
        </div>
      </div>
    }
  `,
  styles: `
    .welcome { display: flex; align-items: center; justify-content: space-between; gap: var(--an-space-4); padding: var(--an-space-5);
      border-radius: var(--an-radius-xl); margin-bottom: var(--an-space-5); }
    .welcome .copy { min-width: 0; flex: 1 1 auto; }
    .welcome .art { width: 200px; flex: none; }
    .stat { display: flex; flex-direction: column; gap: 2px; padding: var(--an-space-4); }
    .s-label { font-size: 0.85rem; color: var(--an-text-2); }
    .s-value { font-family: var(--an-font-heading); font-size: 1.8rem; font-weight: 800; color: var(--an-navy-900); line-height: 1.1; }
    .s-sub { font-size: 0.78rem; color: var(--an-text-muted); }
    .queues { display: grid; gap: var(--an-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
    .queue { display: flex; align-items: center; gap: var(--an-space-3); padding: var(--an-space-3) var(--an-space-4); text-decoration: none; color: inherit; }
    .queue.hot { border-left: 4px solid var(--an-gold-500); }
    .q-icon { width: 44px; height: 44px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-50); color: var(--an-navy-700); font-size: 1.2rem; }
    .queue.hot .q-icon { background: var(--an-gold-100); color: var(--an-gold-700); }
    .q-value { display: block; font-family: var(--an-font-heading); font-weight: 800; font-size: 1.35rem; color: var(--an-navy-900); line-height: 1.1; }
    .q-label { display: block; font-weight: 600; font-size: 0.9rem; }
    .q-hint { display: block; font-size: 0.78rem; color: var(--an-text-muted); }
    .min-w-0 { min-width: 0; }
    .a-dot { width: 32px; height: 32px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-50); color: var(--an-navy-700); }
  `,
})
export default class AdminDashboardComponent {
  protected readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);

  protected readonly stats = signal<AdminStatsV2 | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly firstName = computed(() => (this.auth.user()?.name ?? 'Admin').split(' ')[0]);

  protected readonly tiles = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Candidates', value: s.candidates.total, icon: 'bi-person-vcard', sub: `${s.candidates.freshers} freshers · ${s.candidates.experienced} experienced` },
      { label: 'Client companies', value: s.companies.total, icon: 'bi-building', sub: `${s.companies.verified} verified · ${s.companies.pending} pending` },
      { label: 'Active requirements', value: s.requirements.active, icon: 'bi-clipboard-check', sub: `${s.requirements.pendingApproval} awaiting approval` },
      { label: 'Successfully placed', value: s.pipeline.placed, icon: 'bi-trophy', sub: `${s.pipeline.placedThisMonth} this month` },
      { label: 'Recruiters', value: s.recruiters, icon: 'bi-person-badge', sub: 'Veejee Services staff' },
      { label: 'Under review', value: s.candidates.underReview, icon: 'bi-hourglass-split', sub: 'Candidates being screened' },
      { label: 'Interviews scheduled', value: s.pipeline.interviewsScheduled, icon: 'bi-calendar2-event', sub: 'Across all companies' },
      { label: 'Blocked users', value: s.blockedUsers, icon: 'bi-slash-circle', sub: 'Accounts blocked by admins' },
    ];
  });

  protected readonly queues = computed<QueueCard[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const all: QueueCard[] = [
      {
        label: 'Shortlists awaiting approval',
        value: s.pipeline.pendingShortlists,
        icon: 'bi-patch-check',
        link: '/admin/shortlists',
        permission: 'shortlists:approve',
        hint: 'Approve before recruiters submit to companies',
      },
      {
        label: 'Companies to verify',
        value: s.companies.pending,
        icon: 'bi-building-check',
        link: '/admin/employers',
        query: { verificationStatus: 'pending' },
        permission: 'employers:verify',
        hint: 'New client companies',
      },
      {
        label: 'Requirements to approve',
        value: s.requirements.pendingApproval,
        icon: 'bi-clipboard-check',
        link: '/admin/jobs',
        query: { status: 'pending_approval' },
        permission: 'jobs:moderate',
        hint: 'Posted by companies',
      },
      {
        label: 'New enquiries',
        value: s.newEnquiries,
        icon: 'bi-envelope',
        link: '/admin/enquiries',
        query: { status: 'new' },
        permission: 'enquiries:manage',
        hint: 'From the contact form',
      },
    ];
    return all.filter((q) => this.auth.hasPermission(q.permission));
  });

  protected readonly funnel = computed<FunnelStep[]>(() => {
    const p = this.stats()?.pipeline;
    if (!p) return [];
    return [
      { label: 'Shortlisted', value: p.shortlisted, icon: 'bi-star' },
      { label: 'Submitted to companies', value: p.submitted, icon: 'bi-send-check' },
      { label: 'Interviews scheduled', value: p.interviewsScheduled, icon: 'bi-calendar2-event' },
      { label: 'Selected', value: p.selected, icon: 'bi-hand-thumbs-up' },
      { label: 'Successfully placed', value: p.placed, icon: 'bi-trophy' },
    ];
  });

  protected readonly careerData = computed(() => {
    const c = this.stats()?.candidates;
    return c ? [{ label: 'Experienced', value: c.experienced }, { label: 'Freshers', value: c.freshers }].filter((d) => d.value > 0) : [];
  });

  protected readonly companyData = computed(() => {
    const c = this.stats()?.companies;
    return c ? [{ label: 'Verified', value: c.verified }, { label: 'Pending verification', value: c.pending }].filter((d) => d.value > 0) : [];
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .statsV2()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (s) => this.stats.set({ ...s, recentAuditLogs: s.recentAuditLogs ?? [] }),
        error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))),
      });
  }

  protected actorName(a: AdminStatsV2['recentAuditLogs'][number]['actor']): string {
    if (!a) return 'System';
    return typeof a === 'string' ? a : a.name;
  }
}
