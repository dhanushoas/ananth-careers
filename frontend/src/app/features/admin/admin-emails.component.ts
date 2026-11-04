import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { EmailOutboxItem } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { ADMIN_LIST_STYLES, PagedList, intParam, updateQuery } from './admin-shared';

/**
 * The contract does not enumerate outbox statuses; these are the common ones and any
 * other value coming from the server is still displayed.
 */
const STATUS_TABS = [
  { value: '', label: 'All', icon: 'bi-collection' },
  { value: 'pending', label: 'Pending', icon: 'bi-hourglass-split' },
  { value: 'sent', label: 'Sent', icon: 'bi-send-check' },
  { value: 'failed', label: 'Failed', icon: 'bi-exclamation-octagon' },
  { value: 'suppressed', label: 'Not sent – test address', icon: 'bi-shield-slash' },
];

@Component({
  selector: 'app-admin-emails',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, StatusChipComponent, PaginatorComponent],
  template: `
    <app-page-header eyebrow="Delivery" title="Email outbox" subtitle="Transactional emails queued by the platform. Retry failed deliveries here." illustration="notifications">
      <button class="btn btn-outline-primary" type="button" (click)="reload()" [disabled]="list.loading()">
        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Refresh
      </button>
    </app-page-header>

    <div class="card mb-4">
      <div class="card-body">
        <ul class="nav nav-pills nav-scroll" role="tablist" aria-label="Email status">
          @for (t of tabs; track t.value) {
            <li class="nav-item" role="presentation">
              <button
                type="button"
                class="nav-link"
                role="tab"
                [class.active]="status() === t.value"
                [attr.aria-selected]="status() === t.value"
                (click)="setFilter(t.value)"
              >
                <i [class]="'bi ' + t.icon" aria-hidden="true"></i>{{ t.label }}
              </button>
            </li>
          }
        </ul>
      </div>
    </div>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="table" [count]="6" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load the outbox" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state
        [illustration]="status() === 'failed' ? 'success' : 'empty-notifications'"
        title="No emails"
        [message]="status() === 'failed' ? 'No failed deliveries. Everything went out.' : 'Nothing matches this filter.'"
      />
    } @else {
      <div class="table-responsive d-none d-md-block">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Recipient &amp; subject</th>
              <th scope="col">Status</th>
              <th scope="col">Attempts</th>
              <th scope="col">Queued</th>
              <th scope="col">Sent</th>
              <th scope="col" class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (m of list.items(); track m.id) {
              <tr>
                <td>
                  <div class="cell-main">{{ m.subject }}</div>
                  <div class="cell-sub">{{ m.to }}@if (m.template) { · <code>{{ m.template }}</code> }</div>
                  @if (m.lastError) {
                    <div class="cell-sub text-danger err" [title]="m.lastError">{{ m.lastError }}</div>
                  }
                </td>
                <td><app-status-chip [status]="m.status" /></td>
                <td>{{ m.attempts ?? 0 }}</td>
                <td class="nowrap">{{ m.createdAt | date: 'short' }}</td>
                <td class="nowrap">{{ m.sentAt ? (m.sentAt | date: 'short') : '—' }}</td>
                <td>
                  <div class="actions-cell">
                    @if (m.status === 'failed') {
                      <button class="btn btn-sm btn-outline-primary" type="button" [disabled]="busy() === m.id" (click)="retry(m)">
                        <i class="bi bi-arrow-repeat" aria-hidden="true"></i>Retry
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="mobile-list d-md-none">
        @for (m of list.items(); track m.id) {
          <article class="card m-card">
            <div class="card-body">
              <div class="d-flex justify-content-between gap-2 align-items-start">
                <div class="min-w-0">
                  <div class="cell-main">{{ m.subject }}</div>
                  <div class="cell-sub">{{ m.to }}</div>
                </div>
                <app-status-chip [status]="m.status" />
              </div>
              <div class="cell-sub">
                <i class="bi bi-clock" aria-hidden="true"></i> {{ m.createdAt | date: 'short' }} · {{ m.attempts ?? 0 }} attempt(s)
              </div>
              @if (m.lastError) {
                <div class="cell-sub text-danger">{{ m.lastError }}</div>
              }
              @if (m.status === 'failed') {
                <div class="m-actions">
                  <button class="btn btn-outline-primary" type="button" [disabled]="busy() === m.id" (click)="retry(m)">
                    <i class="bi bi-arrow-repeat" aria-hidden="true"></i>Retry
                  </button>
                </div>
              }
            </div>
          </article>
        }
      </div>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [ADMIN_LIST_STYLES, `.err { max-width: 420px; } .min-w-0 { min-width: 0; } code { font-size: 0.78rem; }`],
})
export default class AdminEmailsComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = STATUS_TABS;
  protected readonly list = new PagedList<EmailOutboxItem>();
  protected readonly busy = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly status = computed(() => this.params().get('status') ?? '');
  private readonly query = computed(() => ({
    status: this.status() || undefined,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.emails(q)));
    });
  }

  setFilter(value: string): void {
    updateQuery(this.router, this.route, { status: value || null });
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.emails(this.query()));
  }

  retry(m: EmailOutboxItem): void {
    this.busy.set(m.id);
    this.admin
      .retryEmail(m.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe((updated) => {
        if (updated && typeof updated === 'object' && 'id' in updated) {
          this.list.replace(updated);
        } else {
          this.list.patch(m.id, { status: 'pending', lastError: null });
        }
        this.toast.success('Email queued for retry');
      });
  }
}
