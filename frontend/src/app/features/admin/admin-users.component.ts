import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AdminUser, Role, UserStatus } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { ADMIN_LIST_STYLES, PagedList, intParam, oneOf, updateQuery } from './admin-shared';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

const ROLES: readonly Role[] = ['candidate', 'employer', 'recruiter', 'admin'];
const STATUSES: readonly UserStatus[] = ['active', 'pending', 'blocked'];

@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserAvatarComponent, 
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StatusChipComponent,
    PaginatorComponent,
    EnumLabelPipe,
  ],
  template: `
    <app-page-header eyebrow="People" title="Users" subtitle="Search accounts across all roles and block or restore access." illustration="team" />

    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-start" role="search">
          <div class="col-12 col-lg-6">
            <div class="input-group">
              <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
              <div class="form-floating">
                <input class="form-control" id="u-q" type="search" placeholder=" " [formControl]="search" />
                <label for="u-q">Search name or email</label>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-lg-3">
            <div class="form-floating">
              <select class="form-select" id="u-role" (change)="onSelect('role', $event)">
                <option value="" [selected]="!role()">All roles</option>
                @for (r of roles; track r) {
                  <option [value]="r" [selected]="r === role()">{{ r | enumLabel }}</option>
                }
              </select>
              <label for="u-role">Role</label>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-lg-3">
            <div class="form-floating">
              <select class="form-select" id="u-status" (change)="onSelect('status', $event)">
                <option value="" [selected]="!status()">All statuses</option>
                @for (s of statuses; track s) {
                  <option [value]="s" [selected]="s === status()">{{ s | enumLabel }}</option>
                }
              </select>
              <label for="u-status">Status</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="table" [count]="6" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load users" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state illustration="empty-search" title="No users found" message="Try a different search or clear the filters." />
    } @else {
      <p class="count">{{ list.total() }} user{{ list.total() === 1 ? '' : 's' }}</p>
      <div class="table-responsive d-none d-md-block">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Email</th>
              <th scope="col">Joined</th>
              <th scope="col">Last login</th>
              <th scope="col" class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (u of list.items(); track u.id) {
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <app-user-avatar [userId]="u.id" [hasAvatar]="u.hasAvatar" [name]="u.name" [size]="36" />
                    <div class="min-w-0">
                      <div class="cell-main">{{ u.name }}</div>
                      <div class="cell-sub">{{ u.email }}@if (u.mobile) { · {{ u.mobile }} }</div>
                    </div>
                  </div>
                </td>
                <td><span class="badge text-bg-light border">{{ u.role | enumLabel }}</span></td>
                <td><app-status-chip [status]="u.status" /></td>
                <td>
                  @if (u.emailVerified) {
                    <span class="text-success small"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Verified</span>
                  } @else {
                    <span class="text-secondary small"><i class="bi bi-dash-circle" aria-hidden="true"></i> Unverified</span>
                  }
                </td>
                <td class="nowrap">{{ u.createdAt | date: 'mediumDate' }}</td>
                <td class="nowrap">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : '—' }}</td>
                <td>
                  <div class="actions-cell">
                    @if (u.id === me()) {
                      <span class="badge text-bg-gold">You</span>
                    } @else if (u.status === 'blocked') {
                      <button class="btn btn-sm btn-outline-success" type="button" (click)="unblock(u)">
                        <i class="bi bi-unlock" aria-hidden="true"></i>Unblock
                      </button>
                    } @else {
                      <button class="btn btn-sm btn-outline-danger" type="button" (click)="block(u)">
                        <i class="bi bi-slash-circle" aria-hidden="true"></i>Block
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
        @for (u of list.items(); track u.id) {
          <article class="card m-card">
            <div class="card-body">
              <div class="d-flex align-items-center gap-3">
                <app-user-avatar [userId]="u.id" [hasAvatar]="u.hasAvatar" [name]="u.name" [size]="44" />
                <div class="min-w-0 flex-grow-1">
                  <div class="cell-main">{{ u.name }}</div>
                  <div class="cell-sub">{{ u.email }}</div>
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2 align-items-center">
                <span class="badge text-bg-light border">{{ u.role | enumLabel }}</span>
                <app-status-chip [status]="u.status" />
                <span class="cell-sub">Joined {{ u.createdAt | date: 'mediumDate' }}</span>
              </div>
              <div class="m-actions">
                @if (u.id === me()) {
                  <span class="badge text-bg-gold">You</span>
                } @else if (u.status === 'blocked') {
                  <button class="btn btn-outline-success" type="button" (click)="unblock(u)">Unblock</button>
                } @else {
                  <button class="btn btn-outline-danger" type="button" (click)="block(u)">Block</button>
                }
              </div>
            </div>
          </article>
        }
      </div>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .min-w-0 { min-width: 0; }
    `,
  ],
})
export default class AdminUsersComponent {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly roles = ROLES;
  protected readonly statuses = STATUSES;
  protected readonly list = new PagedList<AdminUser>();
  protected readonly me = computed(() => this.auth.user()?.id ?? '');

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly role = computed(() => oneOf(this.params().get('role'), ROLES));
  protected readonly status = computed(() => oneOf(this.params().get('status'), STATUSES));
  private readonly query = computed(() => ({
    role: this.role(),
    status: this.status(),
    q: this.params().get('q') ?? undefined,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));
  protected readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', { nonNullable: true });

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.users(q)));
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
    this.list.load(this.admin.users(this.query()));
  }

  block(u: AdminUser): void {
    this.confirm
      .open({
        title: `Block ${u.name}?`,
        message: 'The user will be signed out and unable to sign in until unblocked.',
        confirmText: 'Block user',
        tone: 'danger',
        reason: { label: 'Reason', required: true },
      })
      .subscribe((r) => {
        if (!r) return;
        this.admin.setUserStatus(u.id, 'blocked', r.reason).subscribe(() => {
          this.list.patch(u.id, { status: 'blocked' });
          this.toast.success(`${u.name} has been blocked`);
        });
      });
  }

  unblock(u: AdminUser): void {
    this.confirm
      .open({ title: `Unblock ${u.name}?`, message: 'The user will be able to sign in again.', confirmText: 'Unblock' })
      .subscribe((r) => {
        if (!r) return;
        this.admin.setUserStatus(u.id, 'active').subscribe(() => {
          this.list.patch(u.id, { status: 'active' });
          this.toast.success(`${u.name} has been unblocked`);
        });
      });
  }

  onSelect(key: string, event: Event): void {
    this.setFilter({ [key]: (event.target as HTMLSelectElement).value || null });
  }
}
