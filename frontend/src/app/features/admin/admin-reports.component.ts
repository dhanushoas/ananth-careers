import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { ReportsV2 } from '../../core/models';
import { BarChartComponent, ChartDatum } from '../../shared/components/bar-chart.component';
import { DonutChartComponent } from '../../shared/components/donut-chart.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LineChartComponent } from '../../shared/components/line-chart.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { enumLabel } from '../../shared/pipes/enum-label.pipe';
import { toDateInput } from '../../shared/utils/form-utils';
import { FunnelComponent, FunnelStep, MonthlyChartComponent } from './admin-widgets';

/** Accepts `[{industry|label|name, count}]` or a `{ key: count }` map. */
function toDatums(value: unknown): ChartDatum[] {
  if (Array.isArray(value)) {
    return value
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => {
        const rawLabel = x['industry'] ?? x['label'] ?? x['name'] ?? x['status'];
        const label =
          typeof rawLabel === 'string'
            ? rawLabel
            : typeof rawLabel === 'object' && rawLabel !== null && typeof (rawLabel as { name?: unknown }).name === 'string'
              ? (rawLabel as { name: string }).name
              : 'Other';
        return { label, value: Number(x['count'] ?? x['value'] ?? 0) || 0 };
      });
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>).map(([label, v]) => ({ label, value: Number(v) || 0 }));
  }
  return [];
}

@Component({
  selector: 'app-admin-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    BarChartComponent,
    DonutChartComponent,
    EmptyStateComponent,
    LineChartComponent,
    PageHeaderComponent,
    SkeletonComponent,
    FunnelComponent,
    MonthlyChartComponent,
  ],
  template: `
    <app-page-header eyebrow="Analytics" title="Reports & analytics" subtitle="Registrations, pipeline conversion, placements and recruiter performance." illustration="analytics" />

    <form class="card mb-4" [formGroup]="range" (ngSubmit)="load()" aria-label="Report date range">
      <div class="card-body">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-sm-6 col-lg-3">
            <div class="form-floating">
              <input class="form-control" id="rep-from" type="date" formControlName="from" placeholder=" " />
              <label for="rep-from">From</label>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-lg-3">
            <div class="form-floating">
              <input class="form-control" id="rep-to" type="date" formControlName="to" placeholder=" " />
              <label for="rep-to">To</label>
            </div>
          </div>
          <div class="col-12 col-lg-6 d-flex flex-wrap gap-2 align-items-center">
            @for (p of presets; track p.days) {
              <button class="btn btn-sm btn-outline-primary" type="button" (click)="preset(p.days)">{{ p.label }}</button>
            }
            <button class="btn btn-primary ms-lg-auto" type="submit" [disabled]="loading()"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Update</button>
          </div>
        </div>
      </div>
    </form>

    @if (loading() && !report()) {
      <app-skeleton variant="card" [count]="4" />
    } @else if (error(); as err) {
      <app-empty-state tone="error" title="Couldn't load reports" [message]="err">
        <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
      </app-empty-state>
    } @else if (report(); as r) {
      <div class="row g-4">
        <div class="col-12">
          <section class="card"><div class="card-body"><app-monthly-chart title="Monthly activity (last 12 months)" [points]="r.monthly" /></div></section>
        </div>
        <div class="col-12 col-xl-6">
          <section class="card h-100">
            <div class="card-body">
              <h2 class="h6 mb-3"><i class="bi bi-funnel text-gold" aria-hidden="true"></i> Recruitment funnel</h2>
              <app-funnel [steps]="funnel()" label="Recruitment funnel from application to placement" />
              <p class="small text-secondary mt-3 mb-0">Overall conversion (applied → placed): <strong>{{ overall() }}</strong></p>
            </div>
          </section>
        </div>
        <div class="col-12 col-md-6 col-xl-3">
          <section class="card h-100"><div class="card-body"><app-donut-chart title="Submissions by status" [data]="submissionsByStatus()" centerLabel="Submissions" /></div></section>
        </div>
        <div class="col-12 col-md-6 col-xl-3">
          <section class="card h-100"><div class="card-body"><app-donut-chart title="Freshers vs experienced" [data]="careerLevels()" centerLabel="Candidates" /></div></section>
        </div>
        <div class="col-12 col-lg-6">
          <section class="card h-100"><div class="card-body"><app-line-chart title="Candidate registrations" valueLabel="Candidates" [points]="candidateRegs()" /></div></section>
        </div>
        <div class="col-12 col-lg-6">
          <section class="card h-100"><div class="card-body"><app-line-chart title="Company registrations" valueLabel="Companies" [points]="companyRegs()" /></div></section>
        </div>
        <div class="col-12 col-lg-6">
          <section class="card h-100"><div class="card-body"><app-bar-chart title="Placements by industry" labelHeader="Industry" valueHeader="Placements" [data]="placementsByIndustry()" /></div></section>
        </div>
        <div class="col-12 col-lg-6">
          <section class="card h-100"><div class="card-body"><app-bar-chart title="Requirements by industry" labelHeader="Industry" valueHeader="Requirements" [data]="requirementsByIndustry()" /></div></section>
        </div>
        <div class="col-12">
          <section class="card">
            <div class="card-body">
              <h2 class="h6 mb-3"><i class="bi bi-person-badge text-gold" aria-hidden="true"></i> Recruiter performance</h2>
              @if (r.recruiterPerformance.length) {
                <div class="table-responsive">
                  <table class="table table-hover align-middle mb-0" data-testid="recruiter-performance">
                    <thead>
                      <tr>
                        <th scope="col">Recruiter</th>
                        <th scope="col" class="text-end">Shortlisted</th>
                        <th scope="col" class="text-end">Submitted</th>
                        <th scope="col" class="text-end">Interviews</th>
                        <th scope="col" class="text-end">Placements</th>
                        <th scope="col" class="conv-col">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of performance(); track p.recruiterId) {
                        <tr>
                          <td>
                            <span class="fw-semibold">{{ p.name }}</span>
                            @if (!p.active) { <span class="badge text-bg-secondary ms-1">Inactive</span> }
                          </td>
                          <td class="text-end">{{ p.shortlisted | number }}</td>
                          <td class="text-end">{{ p.submitted | number }}</td>
                          <td class="text-end">{{ p.interviews | number }}</td>
                          <td class="text-end fw-bold">{{ p.placements | number }}</td>
                          <td>
                            <div class="d-flex align-items-center gap-2">
                              <div class="progress flex-grow-1" role="progressbar" [attr.aria-valuenow]="convPct(p.conversionRate)" aria-valuemin="0" aria-valuemax="100"
                                [attr.aria-label]="p.name + ' conversion'">
                                <div class="progress-bar bg-success" [style.width.%]="convPct(p.conversionRate)"></div>
                              </div>
                              <span class="small text-nowrap">{{ convPct(p.conversionRate) }}%</span>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-secondary mb-0">No recruiter activity in this period.</p>
              }
            </div>
          </section>
        </div>
      </div>
    }
  `,
  styles: `
    .conv-col { min-width: 160px; }
  `,
})
export default class AdminReportsComponent {
  private readonly admin = inject(AdminService);

  protected readonly presets = [
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '12 months' },
  ];
  protected readonly range = inject(FormBuilder).nonNullable.group({
    from: toDateInput(new Date(Date.now() - 365 * 86400000).toISOString()),
    to: toDateInput(new Date().toISOString()),
  });
  protected readonly report = signal<ReportsV2 | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly funnel = computed<FunnelStep[]>(() => {
    const f = this.report()?.funnel;
    if (!f) return [];
    return [
      { label: 'Applied', value: f.applied, icon: 'bi-inbox' },
      { label: 'Shortlisted', value: f.shortlisted, icon: 'bi-star' },
      { label: 'Submitted to companies', value: f.submitted, icon: 'bi-send-check' },
      { label: 'Interviewed', value: f.interviewed, icon: 'bi-calendar2-event' },
      { label: 'Selected', value: f.selected, icon: 'bi-hand-thumbs-up' },
      { label: 'Successfully placed', value: f.placed, icon: 'bi-trophy' },
    ];
  });
  protected readonly overall = computed(() => {
    const f = this.report()?.funnel;
    return f && f.applied > 0 ? `${((f.placed / f.applied) * 100).toFixed(1)}%` : '—';
  });
  protected readonly submissionsByStatus = computed(() =>
    toDatums(this.report()?.submissionsByStatus).map((d) => ({ ...d, label: enumLabel(d.label) })),
  );
  protected readonly careerLevels = computed(() => {
    const c = this.report()?.careerLevels;
    return c ? [{ label: 'Experienced', value: c.experienced }, { label: 'Freshers', value: c.fresher }].filter((d) => d.value > 0) : [];
  });
  protected readonly placementsByIndustry = computed(() => toDatums(this.report()?.placementsByIndustry));
  protected readonly requirementsByIndustry = computed(() => toDatums(this.report()?.requirementsByIndustry));
  protected readonly candidateRegs = computed(() => (this.report()?.registrations ?? []).map((r) => ({ date: r.date, count: r.candidates ?? 0 })));
  protected readonly companyRegs = computed(() => (this.report()?.registrations ?? []).map((r) => ({ date: r.date, count: r.employers ?? 0 })));
  protected readonly performance = computed(() =>
    [...(this.report()?.recruiterPerformance ?? [])].sort((a, b) => b.placements - a.placements || b.submitted - a.submitted),
  );

  constructor() {
    this.load();
  }

  preset(days: number): void {
    this.range.setValue({
      from: toDateInput(new Date(Date.now() - days * 86400000).toISOString()),
      to: toDateInput(new Date().toISOString()),
    });
    this.load();
  }

  load(): void {
    const { from, to } = this.range.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .reportsV2(from || undefined, to || undefined)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.report.set(r),
        error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))),
      });
  }

  /** conversionRate may be a 0–1 fraction or a 0–100 percentage. */
  protected convPct(rate: number): number {
    const v = rate <= 1 ? rate * 100 : rate;
    return Math.round(Math.max(0, Math.min(100, v)));
  }
}
