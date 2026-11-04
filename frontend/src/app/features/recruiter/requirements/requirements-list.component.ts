import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { JOB_STATUSES, Requirement } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../../shared/components/paginator.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../../shared/pipes/location.pipe';
import { ModalService } from '../../../shared/ui/modal.service';
import { AssignDialogComponent, AssignDialogData } from '../shared/assign-dialog.component';
import { refId, refName } from '../shared/recruiter-utils';

type AssignedFilter = 'all' | 'me' | 'unassigned';

@Component({
  selector: 'app-requirements-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginatorComponent,
    SkeletonComponent,
    StatusChipComponent,
    EnumLabelPipe,
    LocationsPipe,
  ],
  template: `
    <app-page-header eyebrow="Recruitment" title="Recruitment requirements" illustration="jobs"
      subtitle="Client requirements approved by Veejee Services. Match, shortlist and submit candidates." />

    <ul class="nav nav-pills nav-scroll mb-3" aria-label="Filter by status">
      @for (s of statusTabs; track s.value) {
        <li class="nav-item">
          <button type="button" class="nav-link" [class.active]="(status() ?? 'published') === s.value" (click)="go({ status: s.value })">{{ s.label }}</button>
        </li>
      }
    </ul>

    <form class="card mb-3" (ngSubmit)="search()" role="search" aria-label="Search requirements">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-5">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
              <div class="form-floating">
                <input class="form-control" id="rq-q" [formControl]="qCtrl" placeholder=" " />
                <label for="rq-q">Title or skill</label>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-3">
            <div class="form-floating">
              <input class="form-control" id="rq-emp" [formControl]="empCtrl" placeholder=" " />
              <label for="rq-emp">Company</label>
            </div>
          </div>
          <div class="col-8 col-md-2">
            <div class="form-floating">
              <select class="form-select" id="rq-assigned" [value]="assignedValue()" (change)="onAssigned($event)">
                <option value="all">All</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <label for="rq-assigned">Assigned</label>
            </div>
          </div>
          <div class="col-4 col-md-2 d-grid">
            <button class="btn btn-primary" type="submit"><i class="bi bi-search" aria-hidden="true"></i> Search</button>
          </div>
        </div>
      </div>
    </form>

    @if (list.isLoading()) {
      <app-skeleton variant="card" [count]="4" />
    } @else if (list.error()) {
      <app-empty-state tone="error" title="Requirements could not be loaded" message="Please try again.">
        <button class="btn btn-primary" type="button" (click)="list.reload()">Retry</button>
      </app-empty-state>
    } @else if (list.value(); as res) {
      <div class="d-grid gap-3">
        @for (r of res.items; track r.id) {
          <article class="card card-hover req" data-testid="requirement-row">
            <div class="card-body">
              <div class="d-flex flex-wrap gap-3 align-items-start">
                <div class="grow">
                  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h2 class="h6 m-0"><a [routerLink]="['/recruiter/requirements', r.id]" class="title">{{ r.title }}</a></h2>
                    <app-status-chip [status]="r.status" />
                    @if (r.confidential) {
                      <span class="badge text-bg-dark"><i class="bi bi-incognito" aria-hidden="true"></i> Confidential</span>
                    }
                  </div>
                  <p class="small text-secondary mb-2">
                    <i class="bi bi-building" aria-hidden="true"></i> {{ company(r) }}
                    · <i class="bi bi-geo-alt" aria-hidden="true"></i> {{ r.locations | locations: 2 }}
                    · {{ r.employmentType | enumLabel }} · {{ r.experience.min }}–{{ r.experience.max }} yrs
                  </p>
                  <div class="fill" [attr.aria-label]="(r.filledCount ?? 0) + ' of ' + r.openings + ' vacancies filled'">
                    <div class="d-flex justify-content-between small mb-1">
                      <span>Vacancies filled</span><strong>{{ r.filledCount ?? 0 }} / {{ r.openings }}</strong>
                    </div>
                    <div class="progress" role="progressbar" [attr.aria-valuenow]="fillPct(r)" aria-valuemin="0" aria-valuemax="100">
                      <div class="progress-bar bg-success" [style.width.%]="fillPct(r)"></div>
                    </div>
                  </div>
                </div>
                <ul class="counts">
                  <li><strong>{{ r.counts?.pendingApplications ?? 0 }}</strong><span>Pending applications</span></li>
                  <li><strong>{{ r.counts?.shortlisted ?? 0 }}</strong><span>Shortlisted</span></li>
                  <li><strong>{{ r.counts?.submitted ?? 0 }}</strong><span>Submitted</span></li>
                </ul>
              </div>
              <div class="foot">
                <span class="small text-secondary">
                  <i class="bi bi-person-badge" aria-hidden="true"></i> {{ assignee(r) }}
                  @if (r.publishedAt) { · Approved {{ r.publishedAt | date: 'mediumDate' }} }
                </span>
                <span class="d-flex gap-2">
                  <button type="button" class="btn btn-sm btn-outline-secondary" (click)="assign(r)"><i class="bi bi-person-plus" aria-hidden="true"></i> Assign</button>
                  <a class="btn btn-sm btn-primary" [routerLink]="['/recruiter/requirements', r.id]" [attr.aria-label]="'Open ' + r.title">Open <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
                </span>
              </div>
            </div>
          </article>
        } @empty {
          <app-empty-state illustration="empty-jobs" title="No requirements found" message="Try another status or clear the search." />
        }
      </div>
      <app-paginator [page]="res.page" [limit]="res.limit" [total]="res.total" (pageChange)="onPage($event)" />
    }
  `,
  styles: `
    .req { border-left: 4px solid var(--an-navy-700); }
    .grow { flex: 1 1 300px; min-width: 0; }
    .title { color: var(--an-navy-900); text-decoration: none; overflow-wrap: anywhere; }
    .title:hover { text-decoration: underline; }
    .fill { max-width: 360px; }
    .counts { list-style: none; margin: 0; padding: 0; display: flex; gap: var(--an-space-2); flex-wrap: wrap; }
    .counts li { min-width: 92px; text-align: center; padding: 8px 10px; border-radius: 12px; background: var(--an-surface-2); border: 1px solid var(--an-border); }
    .counts strong { display: block; font-size: 1.25rem; font-family: var(--an-font-heading); color: var(--an-navy-900); }
    .counts span { font-size: 0.72rem; color: var(--an-text-muted); }
    .foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--an-space-2);
      margin-top: var(--an-space-3); padding-top: var(--an-space-3); border-top: 1px solid var(--an-border); }
  `,
})
export default class RequirementsListComponent {
  readonly status = input<string>();
  readonly q = input<string>();
  readonly employer = input<string>();
  readonly assigned = input<string>();
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(RecruitmentService);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly statusTabs = [
    { value: 'published', label: 'Active' },
    ...JOB_STATUSES.filter((s) => s !== 'published' && s !== 'draft').map((s) => ({ value: s, label: s === 'pending_approval' ? 'Pending approval' : s.charAt(0).toUpperCase() + s.slice(1) })),
    { value: 'all', label: 'All' },
  ];
  protected readonly qCtrl = new FormControl('', { nonNullable: true });
  protected readonly empCtrl = new FormControl('', { nonNullable: true });
  protected readonly assignedValue = computed<AssignedFilter>(() => {
    const a = this.assigned();
    return a === 'me' || a === 'unassigned' ? a : 'all';
  });

  private readonly query = computed(() => {
    const status = this.status() ?? 'published';
    const assigned = this.assignedValue();
    return {
      status: status === 'all' ? undefined : status,
      q: this.q() || undefined,
      employer: this.employer() || undefined,
      assigned: assigned === 'all' ? undefined : assigned,
      page: this.page(),
      limit: 20,
    };
  });
  protected readonly list = rxResource({ params: () => this.query(), stream: ({ params }) => this.api.requirements(params) });

  constructor() {
    effect(() => {
      this.qCtrl.setValue(this.q() ?? '', { emitEvent: false });
      this.empCtrl.setValue(this.employer() ?? '', { emitEvent: false });
    });
  }

  protected company(r: Requirement): string {
    return r.employer?.companyName ?? r.companyName ?? 'Confidential client';
  }

  protected assignee(r: Requirement): string {
    return r.assignedRecruiter ? `Assigned to ${refName(r.assignedRecruiter)}` : 'Unassigned';
  }

  protected fillPct(r: Requirement): number {
    return r.openings ? Math.min(100, Math.round(((r.filledCount ?? 0) / r.openings) * 100)) : 0;
  }

  search(): void {
    this.go({ q: this.qCtrl.value.trim() || null, employer: this.empCtrl.value.trim() || null });
  }

  onAssigned(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.go({ assigned: v === 'all' ? null : v });
  }

  go(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: { ...params, page: null }, queryParamsHandling: 'merge' });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { queryParams: { page: e.page }, queryParamsHandling: 'merge' });
  }

  assign(r: Requirement): void {
    this.modal
      .open<AssignDialogComponent, AssignDialogData, { recruiterId: string | null }>(AssignDialogComponent, {
        data: { title: `Assign “${r.title}”`, currentId: refId(r.assignedRecruiter) },
      })
      .afterClosed()
      .pipe(
        filter((res): res is { recruiterId: string | null } => !!res),
        switchMap((res) => this.api.assignRequirement(r.id, res.recruiterId)),
      )
      .subscribe(() => {
        this.toast.success('Requirement assignment updated');
        this.list.reload();
      });
  }
}
