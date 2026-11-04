import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { RecruitmentService } from '../../core/services/recruitment.service';
import { ToastService } from '../../core/services/toast.service';
import { Employer, RecruiterOption, VerificationStatus } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { CompanyLogoComponent } from '../../shared/components/company-logo.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { ADMIN_LIST_STYLES, PagedList, intParam, oneOf, updateQuery } from './admin-shared';

const STATUSES: readonly VerificationStatus[] = ['pending', 'verified', 'rejected'];

@Component({
  selector: 'app-admin-employers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StatusChipComponent,
    CompanyLogoComponent,
    PaginatorComponent,
  ],
  template: `
    <app-page-header eyebrow="Verification" title="Companies" subtitle="Verify client companies before their requirements can be published, assign a Veejee Services account manager and choose featured companies." illustration="employers" />

    <div class="card mb-4">
      <div class="card-body d-flex flex-column gap-3">
        <ul class="nav nav-pills nav-scroll" role="tablist" aria-label="Verification status">
          @for (t of tabs; track t.value) {
            <li class="nav-item" role="presentation">
              <button
                type="button"
                class="nav-link"
                role="tab"
                [class.active]="(status() ?? '') === t.value"
                [attr.aria-selected]="(status() ?? '') === t.value"
                (click)="setFilter({ verificationStatus: t.value || null })"
              >
                <i [class]="'bi ' + t.icon" aria-hidden="true"></i>{{ t.label }}
              </button>
            </li>
          }
        </ul>
        <div class="input-group" role="search">
          <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
          <div class="form-floating">
            <input class="form-control" id="emp-q" type="search" placeholder=" " [formControl]="search" />
            <label for="emp-q">Search company</label>
          </div>
        </div>
      </div>
    </div>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="card" [count]="4" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load companies" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state
        [illustration]="status() === 'pending' ? 'success' : 'empty-search'"
        title="No companies here"
        [message]="status() === 'pending' ? 'No companies are waiting for verification.' : 'Nothing matches this filter right now.'"
      />
    } @else {
      <p class="count">{{ list.total() }} compan{{ list.total() === 1 ? 'y' : 'ies' }}</p>
      <div class="row g-3">
        @for (e of list.items(); track e.id) {
          <div class="col-12 col-xl-6">
            <article class="card card-hover h-100 emp" data-testid="admin-employer-row" [class.pending]="e.verificationStatus === 'pending'">
              <div class="card-body d-flex flex-column gap-3">
                <div class="d-flex gap-3 align-items-start">
                  <app-company-logo [employerId]="e.id" [hasLogo]="e.hasLogo" [name]="e.companyName" [size]="52" />
                  <div class="min-w-0 flex-grow-1">
                    <div class="cell-main fs-6">{{ e.companyName }}</div>
                    <div class="cell-sub">
                      <i class="bi bi-grid" aria-hidden="true"></i> {{ e.industry ? e.industry.name : '—' }}
                      · <i class="bi bi-calendar3" aria-hidden="true"></i> {{ e.createdAt | date: 'mediumDate' }}
                    </div>
                  </div>
                  <app-status-chip [status]="e.verificationStatus" />
                </div>

                @if (e.rejectionReason && e.verificationStatus === 'rejected') {
                  <div class="alert alert-danger py-2 px-3 mb-0 small"><i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ e.rejectionReason }}</div>
                }

                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div class="form-check form-switch m-0">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      role="switch"
                      [id]="'efeat-' + e.id"
                      [checked]="e.featured"
                      [disabled]="e.verificationStatus !== 'verified' || busy() === e.id"
                      (change)="onFeatured(e, $event)"
                    />
                    <label class="form-check-label small" [for]="'efeat-' + e.id">Featured company</label>
                  </div>
                  <div class="am d-flex align-items-center gap-2">
                    <label class="small text-secondary text-nowrap" [for]="'eam-' + e.id"><i class="bi bi-person-workspace" aria-hidden="true"></i> Account manager</label>
                    <select class="form-select form-select-sm" [id]="'eam-' + e.id" [disabled]="busy() === e.id" (change)="onManager(e, $event)">
                      <option value="" [selected]="!managerId(e)">Unassigned</option>
                      @for (r of recruiters(); track r.id) {
                        <option [value]="r.id" [selected]="managerId(e) === r.id">{{ r.name }}</option>
                      }
                    </select>
                  </div>
                  <button type="button" class="btn btn-sm btn-link px-0" (click)="toggleExpand(e.id)" [attr.aria-expanded]="expanded() === e.id"
                    [attr.aria-controls]="'emp-details-' + e.id">
                    <i [class]="expanded() === e.id ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" aria-hidden="true"></i>
                    {{ expanded() === e.id ? 'Hide details' : 'Company details' }}
                  </button>
                </div>

                @if (expanded() === e.id) {
                  <div class="details fade-in" [id]="'emp-details-' + e.id">
                    <dl class="detail-grid">
                      <div><dt>Website</dt><dd>@if (e.website) {<a [href]="e.website" target="_blank" rel="noopener noreferrer">{{ e.website }}</a>} @else {—}</dd></div>
                      <div><dt>Registration number</dt><dd>{{ e.registrationNumber || '—' }}</dd></div>
                      <div><dt>Contact email</dt><dd>{{ e.contactEmail || '—' }}</dd></div>
                      <div><dt>Contact phone</dt><dd>{{ e.contactPhone || '—' }}</dd></div>
                      <div><dt>Headquarters</dt><dd>{{ e.headquarters || '—' }}</dd></div>
                      <div><dt>Company size</dt><dd>{{ e.size || '—' }}</dd></div>
                      <div><dt>Founded</dt><dd>{{ e.foundedYear || '—' }}</dd></div>
                      <div><dt>Address</dt><dd>{{ e.address || '—' }}</dd></div>
                    </dl>
                    @if (e.description) {
                      <p class="prose small mb-0">{{ e.description }}</p>
                    }
                  </div>
                }

                <div class="m-actions mt-auto">
                  @if (e.verificationStatus !== 'verified') {
                    <button class="btn btn-success" type="button" [disabled]="busy() === e.id" (click)="verify(e)">
                      <i class="bi bi-patch-check" aria-hidden="true"></i>Verify
                    </button>
                  }
                  @if (e.verificationStatus !== 'rejected') {
                    <button class="btn btn-outline-danger" type="button" [disabled]="busy() === e.id" (click)="reject(e)">
                      <i class="bi bi-x-circle" aria-hidden="true"></i>Reject
                    </button>
                  }
                  @if (e.verificationStatus === 'verified') {
                    <a class="btn btn-light" [routerLink]="['/employers', e.slug]" target="_blank" rel="noopener">
                      <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>Public page
                    </a>
                  }
                </div>
              </div>
            </article>
          </div>
        }
      </div>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .min-w-0 { min-width: 0; }
      .emp.pending { border-left: 4px solid var(--an-gold-500); }
      .am { min-width: 0; } .am .form-select { max-width: 200px; }
      .details { background: var(--an-surface-2); border-radius: var(--an-radius); padding: var(--an-space-3); }
    `,
  ],
})
export default class AdminEmployersComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = [
    { value: 'pending', label: 'Pending', icon: 'bi-hourglass-split' },
    { value: 'verified', label: 'Verified', icon: 'bi-patch-check' },
    { value: 'rejected', label: 'Rejected', icon: 'bi-x-circle' },
    { value: '', label: 'All', icon: 'bi-collection' },
  ];
  protected readonly list = new PagedList<Employer>();
  protected readonly recruiters = toSignal(
    inject(RecruitmentService)
      .recruiters()
      .pipe(catchError(() => of<RecruiterOption[]>([]))),
    { initialValue: [] as RecruiterOption[] },
  );
  protected readonly expanded = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly status = computed(() => oneOf(this.params().get('verificationStatus'), STATUSES));
  private readonly query = computed(() => ({
    verificationStatus: this.status(),
    q: this.params().get('q') ?? undefined,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));
  protected readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', { nonNullable: true });

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.employers(q)));
    });
    this.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => this.setFilter({ q: v.trim() || null }));
  }

  setFilter(patch: Record<string, string | null>): void {
    updateQuery(this.router, this.route, patch);
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.employers(this.query()));
  }

  toggleExpand(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  verify(e: Employer): void {
    this.confirm
      .open({ title: `Verify ${e.companyName}?`, message: 'Verified companies can submit recruitment requirements (approved by Veejee Services) and appear in the public client list.', confirmText: 'Verify' })
      .subscribe((r) => {
        if (!r) return;
        this.busy.set(e.id);
        this.admin.verifyEmployer(e.id, 'verified').subscribe({
          next: () => {
            this.busy.set(null);
            this.afterStatusChange(e, 'verified');
            this.toast.success(`${e.companyName} verified`);
          },
          error: () => this.busy.set(null),
        });
      });
  }

  reject(e: Employer): void {
    this.confirm
      .open({
        title: `Reject ${e.companyName}?`,
        message: 'The company will be notified with your reason.',
        confirmText: 'Reject',
        tone: 'danger',
        reason: { label: 'Reason for rejection', required: true },
      })
      .subscribe((r) => {
        if (!r) return;
        this.busy.set(e.id);
        this.admin.verifyEmployer(e.id, 'rejected', r.reason).subscribe({
          next: () => {
            this.busy.set(null);
            this.afterStatusChange(e, 'rejected', r.reason);
            this.toast.success(`${e.companyName} rejected`);
          },
          error: () => this.busy.set(null),
        });
      });
  }

  toggleFeatured(e: Employer, featured: boolean): void {
    this.busy.set(e.id);
    this.admin.updateEmployer(e.id, { featured }).subscribe({
      next: () => {
        this.busy.set(null);
        this.list.patch(e.id, { featured });
        this.toast.success(featured ? `${e.companyName} is now featured` : `${e.companyName} is no longer featured`);
      },
      error: () => {
        this.busy.set(null);
        // Re-emit the unchanged row so the toggle reverts visually.
        this.list.patch(e.id, { featured: e.featured });
      },
    });
  }

  private afterStatusChange(e: Employer, status: VerificationStatus, reason?: string): void {
    const filter = this.status();
    if (filter && filter !== status) {
      this.list.remove(e.id);
    } else {
      this.list.patch(e.id, { verificationStatus: status, rejectionReason: reason ?? null });
    }
  }

  protected managerId(e: Employer): string {
    const m = e.accountManager;
    return !m ? '' : typeof m === 'string' ? m : m.id;
  }

  onManager(e: Employer, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = select.value || null;
    const previous = this.managerId(e);
    this.busy.set(e.id);
    this.admin.updateEmployer(e.id, { accountManager: id }).subscribe({
      next: () => {
        this.busy.set(null);
        const r = this.recruiters().find((x) => x.id === id);
        this.list.patch(e.id, { accountManager: r ? { id: r.id, name: r.name } : null });
        this.toast.success(r ? `${r.name} now manages ${e.companyName}` : `Account manager removed for ${e.companyName}`);
      },
      error: () => {
        this.busy.set(null);
        select.value = previous;
      },
    });
  }

  onFeatured(e: Employer, event: Event): void {
    this.toggleFeatured(e, (event.target as HTMLInputElement).checked);
  }
}
