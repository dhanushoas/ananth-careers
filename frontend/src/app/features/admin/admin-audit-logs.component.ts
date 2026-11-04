import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, JsonPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AuditLog } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { ADMIN_LIST_STYLES, PagedList, intParam, updateQuery } from './admin-shared';
import { auditActorName } from './admin-shared';

@Component({
  selector: 'app-admin-audit-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PaginatorComponent,
  ],
  template: `
    <app-page-header eyebrow="Compliance" title="Audit logs" subtitle="An append-only trail of sensitive actions across the platform." illustration="policy" />

    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-start" role="search">
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="aud-action" [formControl]="action" placeholder="e.g. job.approve" />
              <label for="aud-action">Action (e.g. job.approve)</label>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="aud-actor" [formControl]="actor" placeholder=" " />
              <label for="aud-actor">Actor (user id or email)</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="table" [count]="8" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load audit logs" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state illustration="empty-data" title="No audit entries" message="Nothing matches these filters." />
    } @else {
      <div class="table-responsive d-none d-md-block">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Target</th>
              <th scope="col">IP</th>
              <th scope="col" class="right"><span class="visually-hidden">Details</span></th>
            </tr>
          </thead>
          <tbody>
            @for (log of list.items(); track log.id) {
              <tr>
                <td class="nowrap">{{ log.createdAt | date: 'medium' }}</td>
                <td>
                  <div class="cell-main">{{ actorName(log.actor) }}</div>
                  @if (actorRole(log); as role) {
                    <div class="cell-sub">{{ role }}</div>
                  }
                </td>
                <td><code class="act">{{ log.action }}</code></td>
                <td>
                  @if (targetType(log) || targetId(log)) {
                    {{ targetType(log) }}
                    @if (targetId(log)) {
                      <div class="cell-sub mono">{{ targetId(log) }}</div>
                    }
                  } @else {
                    —
                  }
                </td>
                <td class="mono">{{ log.ip || '—' }}</td>
                <td>
                  <div class="actions-cell">
                    @if (log.meta) {
                      <button class="btn btn-sm btn-light" type="button" (click)="toggle(log.id)" [attr.aria-expanded]="expanded() === log.id">
                        <i [class]="expanded() === log.id ? 'bi bi-chevron-up' : 'bi bi-code-slash'" aria-hidden="true"></i>
                        {{ expanded() === log.id ? 'Hide' : 'Details' }}
                      </button>
                    }
                  </div>
                </td>
              </tr>
              @if (expanded() === log.id && log.meta) {
                <tr>
                  <td colspan="6" class="bg-light"><pre class="meta">{{ log.meta | json }}</pre></td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <ol class="timeline d-md-none">
        @for (log of list.items(); track log.id) {
          <li>
            <span class="dot" aria-hidden="true"></span>
            <div class="card m-card">
              <div class="card-body">
                <code class="act">{{ log.action }}</code>
                <div class="cell-main">{{ actorName(log.actor) }}</div>
                <div class="cell-sub">
                  {{ log.createdAt | date: 'medium' }}
                  @if (targetType(log)) {
                    · {{ targetType(log) }}
                  }
                  @if (log.ip) {
                    · {{ log.ip }}
                  }
                </div>
                @if (log.meta) {
                  <button class="btn btn-sm btn-light align-self-start" type="button" (click)="toggle(log.id)" [attr.aria-expanded]="expanded() === log.id">
                    {{ expanded() === log.id ? 'Hide details' : 'Details' }}
                  </button>
                  @if (expanded() === log.id) {
                    <pre class="meta">{{ log.meta | json }}</pre>
                  }
                }
              </div>
            </div>
          </li>
        }
      </ol>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" [pageSizeOptions]="[20, 50, 100]" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      code, .mono { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 0.82rem; }
      .meta { margin: 0; max-height: 320px; overflow: auto; font-size: 0.8rem; white-space: pre-wrap; overflow-wrap: anywhere; }
      .act { background: var(--an-navy-50); color: var(--an-navy-800); padding: 2px 8px; border-radius: 6px; overflow-wrap: anywhere; }
      .timeline { list-style: none; margin: 0; padding: 0 0 0 18px; border-left: 2px solid var(--an-border); display: grid; gap: var(--an-space-3); }
      .timeline li { position: relative; }
      .dot { position: absolute; left: -26px; top: 18px; width: 14px; height: 14px; border-radius: 50%; background: var(--an-gold-500); border: 3px solid var(--an-surface); box-shadow: 0 0 0 1px var(--an-border-strong); }
    `,
  ],
})
export default class AdminAuditLogsComponent {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly list = new PagedList<AuditLog>();
  protected readonly expanded = signal<string | null>(null);
  protected readonly actorName = auditActorName;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly query = computed(() => ({
    action: this.params().get('action') ?? undefined,
    actor: this.params().get('actor') ?? undefined,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 50),
  }));
  protected readonly action = new FormControl(this.route.snapshot.queryParamMap.get('action') ?? '', { nonNullable: true });
  protected readonly actor = new FormControl(this.route.snapshot.queryParamMap.get('actor') ?? '', { nonNullable: true });

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.auditLogs(q)));
    });
    this.action.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => updateQuery(this.router, this.route, { action: v.trim() || null }));
    this.actor.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => updateQuery(this.router, this.route, { actor: v.trim() || null }));
  }

  /** v2 logs use entityType/entityId; v1 used targetType/targetId. */
  targetType(log: AuditLog): string {
    const l = log as AuditLog & { entityType?: string };
    return l.entityType ?? l.targetType ?? '';
  }

  targetId(log: AuditLog): string {
    const l = log as AuditLog & { entityId?: string };
    return l.entityId ?? l.targetId ?? '';
  }

  actorRole(log: AuditLog): string | null {
    return log.actor && typeof log.actor === 'object' ? (log.actor.role ?? log.actor.email ?? null) : null;
  }

  toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.auditLogs(this.query()));
  }
}
