import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EMPTY, Observable, catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { JobsService } from '../../core/services/jobs.service';
import { ToastService } from '../../core/services/toast.service';
import { JOB_STATUSES, Job, JobStatus, Paginated, Requirement } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../shared/pipes/location.pipe';
import { CompanyContextService } from './company-context.service';
import { VerificationBannerComponent } from './workspace-state.component';
import { DropdownComponent } from '../../shared/ui/dropdown.component';

@Component({
  selector: 'app-requirements-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    DropdownComponent,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StatusChipComponent,
    PaginatorComponent,
    EnumLabelPipe,
    LocationsPipe,
    VerificationBannerComponent,
  ],
  template: `
    <app-page-header eyebrow="Hiring" title="Recruitment requirements" subtitle="Requirements you have shared with Veejee Services. Once approved, our recruiters source, screen and submit consented candidates." illustration="jobs">
      <a class="btn btn-gold" routerLink="/employer/requirements/new"><i class="bi bi-plus-circle" aria-hidden="true"></i>Post a requirement</a>
    </app-page-header>
    <app-verification-banner />

    <div class="card mb-4">
      <div class="card-body d-flex flex-column flex-lg-row gap-3 align-items-lg-center">
        <ul class="nav nav-pills nav-scroll flex-grow-1 min-w-0" aria-label="Filter requirements by status">
          <li class="nav-item">
            <a class="nav-link" [class.active]="!status()" [routerLink]="[]" [queryParams]="{ status: null, page: null }" queryParamsHandling="merge"
              [attr.aria-current]="!status() ? 'true' : null"><i class="bi bi-collection" aria-hidden="true"></i>All</a>
          </li>
          @for (s of statuses; track s) {
            <li class="nav-item">
              <a class="nav-link" [class.active]="status() === s" [routerLink]="[]" [queryParams]="{ status: s, page: null }" queryParamsHandling="merge"
                [attr.aria-current]="status() === s ? 'true' : null">{{ s | enumLabel }}</a>
            </li>
          }
        </ul>
        <div class="input-group search">
          <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
          <input class="form-control" type="search" id="jobs-search" [formControl]="search" placeholder="Search requirements" aria-label="Search requirements" />
        </div>
      </div>
    </div>

    @if (loading()) {
      <app-skeleton variant="table" [count]="5" />
    } @else if (error()) {
      <app-empty-state tone="error" illustration="error" title="Requirements could not be loaded" message="Please try again.">
        <button class="btn btn-outline-primary" type="button" (click)="reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Retry</button>
      </app-empty-state>
    } @else if (page(); as p) {
      @if (p.items.length) {
        <ul class="list">
          @for (j of p.items; track j.id) {
            <li class="card card-hover job" [class]="'card card-hover job st-' + j.status" data-testid="requirement-row">
              <div class="card-body">
                <div class="main">
                  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h2 class="title"><a [routerLink]="['/employer/requirements', j.id]">{{ j.title }}</a></h2>
                    <app-status-chip [status]="j.status" />
                    @if (j.featured) { <app-status-chip status="featured" label="Featured" /> }
                    @if (j.confidential) { <span class="badge text-bg-light border"><i class="bi bi-incognito" aria-hidden="true"></i> Confidential</span> }
                  </div>
                  <p class="meta">
                    <span><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ j.locations | locations }}</span>
                    <span><i class="bi bi-briefcase" aria-hidden="true"></i>{{ j.employmentType | enumLabel }} · {{ j.workMode | enumLabel }}</span>
                  </p>
                  <p class="meta small">
                    <span><i class="bi bi-calendar3" aria-hidden="true"></i>Created {{ j.createdAt | date: 'mediumDate' }}</span>
                    @if (j.publishedAt) { <span><i class="bi bi-broadcast" aria-hidden="true"></i>Published {{ j.publishedAt | date: 'mediumDate' }}</span> }
                    @if (j.postedBy; as by) { <span><i class="bi bi-person" aria-hidden="true"></i>{{ by.name }}</span> }
                    @if (j.status === 'pending_approval') { <span class="text-warning-emphasis"><i class="bi bi-hourglass-split" aria-hidden="true"></i>Awaiting Veejee Services approval</span> }
                  </p>
                  @if (j.status === 'rejected' && j.rejectionReason) {
                    <div class="alert alert-danger small py-2 mb-0 mt-2"><i class="bi bi-exclamation-octagon me-1" aria-hidden="true"></i>Rejected: {{ j.rejectionReason }}</div>
                  }
                </div>
                <div class="side">
                  <div class="kpis">
                    <div class="kpi"><strong>{{ j.openings }}</strong><span>Vacancies</span></div>
                    <div class="kpi"><strong>{{ filled(j) }}</strong><span>Filled</span></div>
                    <div class="kpi"><strong>{{ j.applicationsCount }}</strong><span>Applied</span></div>
                  </div>
                  <div class="d-flex gap-2 align-items-center">
                    <a class="btn btn-outline-primary btn-sm" [routerLink]="['/employer/requirements', j.id]"><i class="bi bi-person-check" aria-hidden="true"></i>Candidates</a>
                    <app-dropdown align="end" buttonClass="btn btn-light btn-icon" [ariaLabel]="'More actions for ' + j.title">
                      <i toggle class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                      @if (j.status !== 'closed') {
                        <a class="dropdown-item" [routerLink]="['/employer/requirements', j.id, 'edit']"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</a>
                      }
                      @if (j.status === 'draft' || j.status === 'rejected') {
                        <button class="dropdown-item" type="button" (click)="submit(j)"><i class="bi bi-send" aria-hidden="true"></i>Submit for approval</button>
                      }
                      @if (j.status === 'published') {
                        <a class="dropdown-item" [routerLink]="['/jobs', j.slug || j.id]"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>View public listing</a>
                        <button class="dropdown-item" type="button" (click)="close(j)"><i class="bi bi-lock" aria-hidden="true"></i>Close requirement</button>
                      }
                      @if (j.status === 'closed') {
                        <button class="dropdown-item" type="button" (click)="reopen(j)"><i class="bi bi-unlock" aria-hidden="true"></i>Reopen requirement</button>
                      }
                      <hr class="dropdown-divider" />
                      <button class="dropdown-item text-danger" type="button" (click)="remove(j)"><i class="bi bi-trash" aria-hidden="true"></i>Delete</button>
                    </app-dropdown>
                  </div>
                </div>
              </div>
            </li>
          }
        </ul>
        <app-paginator [page]="p.page" [limit]="p.limit" [total]="p.total" (pageChange)="onPage($event)" />
      } @else {
        <app-empty-state [illustration]="status() || q() ? 'empty-search' : 'empty-jobs'" title="No requirements found"
          [message]="status() || q() ? 'Try a different filter or search.' : 'Post your first requirement and Veejee Services will start sourcing candidates.'">
          <a class="btn btn-gold" routerLink="/employer/requirements/new"><i class="bi bi-plus-circle" aria-hidden="true"></i>Post a requirement</a>
        </app-empty-state>
      }
    }
  `,
  styles: `
    .min-w-0 { min-width: 0; }
    .search { max-width: 100%; }
    @media (min-width: 992px) { .search { width: 300px; flex: none; } }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--an-space-3); }
    .job { border-left: 4px solid var(--an-border-strong); }
    .job.st-published { border-left-color: var(--an-success); }
    .job.st-pending_approval { border-left-color: var(--an-gold-500); }
    .job.st-rejected { border-left-color: var(--an-danger); }
    .job .card-body { display: flex; flex-wrap: wrap; gap: var(--an-space-3); justify-content: space-between; align-items: flex-start; }
    .main { flex: 1 1 320px; min-width: 0; }
    .title { font-size: 1.05rem; margin: 0; overflow-wrap: anywhere; }
    .title a { color: var(--an-navy-900); text-decoration: none; }
    .title a:hover { text-decoration: underline; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 6px 0 0; color: var(--an-text-2); font-size: 0.9rem; }
    .meta .bi { color: var(--an-text-muted); margin-right: 4px; }
    .side { display: flex; flex-wrap: wrap; gap: var(--an-space-3); align-items: center; }
    .kpis { display: flex; gap: var(--an-space-2); }
    .kpi { display: flex; flex-direction: column; align-items: center; min-width: 72px; padding: 6px 10px; border-radius: 10px; background: var(--an-navy-50); }
    .kpi strong { font-family: var(--an-font-heading); font-size: 1.15rem; color: var(--an-navy-900); line-height: 1.1; }
    .kpi span { font-size: 0.72rem; color: var(--an-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  `,
})
export default class RequirementsListComponent implements OnInit {
  protected readonly ctx = inject(CompanyContextService);
  private readonly jobs = inject(JobsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = JOB_STATUSES;
  protected readonly status = signal<JobStatus | null>(null);
  protected readonly q = signal('');
  protected readonly pageNo = signal(1);
  protected readonly limit = signal(20);
  protected readonly page = signal<Paginated<Job> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly search = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        tap((m) => {
          const s = m.get('status');
          this.status.set(s && (JOB_STATUSES as readonly string[]).includes(s) ? (s as JobStatus) : null);
          this.q.set(m.get('q') ?? '');
          this.pageNo.set(Math.max(1, Number(m.get('page')) || 1));
          this.limit.set(Math.min(100, Math.max(1, Number(m.get('limit')) || 20)));
          if (this.search.value !== this.q()) this.search.setValue(this.q(), { emitEvent: false });
        }),
        switchMap(() => this.fetch()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => void this.router.navigate([], { queryParams: { q: q.trim() || null, page: null }, queryParamsHandling: 'merge' }));
  }

  filled(j: Job): number {
    return (j as Requirement).filledCount ?? 0;
  }

  reload(): void {
    this.fetch().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { queryParams: { page: e.page, limit: e.limit }, queryParamsHandling: 'merge' });
  }

  submit(j: Job): void {
    this.act(j, this.jobs.submit(j.id), 'Requirement submitted for approval');
  }

  close(j: Job): void {
    this.confirm
      .open({ title: 'Close this requirement?', message: `Veejee Services will stop sourcing for “${j.title}”. You can reopen it later (it will need approval again).`, confirmText: 'Close requirement' })
      .subscribe((r) => r && this.act(j, this.jobs.close(j.id), 'Requirement closed'));
  }

  reopen(j: Job): void {
    this.confirm
      .open({ title: 'Reopen this requirement?', message: 'The requirement will be sent to Veejee Services for approval before it goes live again.', confirmText: 'Reopen' })
      .subscribe((r) => r && this.act(j, this.jobs.reopen(j.id), 'Requirement reopened and sent for approval'));
  }

  remove(j: Job): void {
    this.confirm
      .open({
        title: 'Delete this requirement?',
        message: `“${j.title}” will be removed. Requirements with candidates in progress cannot be deleted — close them instead.`,
        confirmText: 'Delete',
        tone: 'danger',
      })
      .pipe(switchMap((r) => (r ? this.jobs.delete(j.id) : EMPTY)), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.toast.success('Requirement deleted');
        this.reload();
      });
  }

  private act(j: Job, req$: Observable<Job>, message: string): void {
    req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      this.toast.success(message);
      this.page.update((p) => (p ? { ...p, items: p.items.map((x) => (x.id === j.id ? { ...x, ...updated } : x)) } : p));
    });
  }

  private fetch(): Observable<unknown> {
    this.loading.set(true);
    this.error.set(false);
    return this.jobs.mine({ status: this.status() ?? undefined, q: this.q() || undefined, page: this.pageNo(), limit: this.limit() }).pipe(
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
