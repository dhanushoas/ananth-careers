import { ChangeDetectionStrategy, Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { applyServerErrors, mobileValidator, passwordPolicyValidator } from '../../shared/utils/form-utils';
import { toAppError } from '../../core/http/api-error';
import { ADMIN_PERMISSIONS, AdminUser } from '../../core/models';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { MODAL_DATA, ModalRef, ModalService } from '../../shared/ui/modal.service';
import { ADMIN_LIST_STYLES, PagedList, intParam, updateQuery } from './admin-shared';

export const PERMISSION_LABELS: Record<string, string> = {
  '*': 'Super admin (all permissions)',
  'users:manage': 'Manage users',
  'employers:verify': 'Verify companies',
  'recruiters:manage': 'Manage Veejee Services recruiters',
  'jobs:moderate': 'Moderate requirements',
  'recruitment:manage': 'Recruitment portal access',
  'shortlists:approve': 'Approve shortlists',
  'candidates:assign': 'Assign candidates to recruiters',
  'resumes:manage': 'Manage resumes',
  'taxonomy:manage': 'Manage industries & categories',
  'content:manage': 'Manage website content',
  'enquiries:manage': 'Manage enquiries',
  'emails:manage': 'Manage email outbox',
  'settings:manage': 'Manage system settings',
  'reports:view': 'View reports',
  'audit:view': 'View audit logs',
  'admins:manage': 'Manage admins',
};

let checklistSeq = 0;

/** Checklist of permissions with a "super admin" switch that supersedes the rest. */
@Component({
  selector: 'app-permission-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="perms">
      <legend class="fs-6 fw-semibold">Permissions</legend>
      <div class="form-check form-switch super mb-2">
        <input class="form-check-input" type="checkbox" role="switch" [id]="uid + '-super'" [checked]="isSuper()" (change)="onToggle('*', $event)" />
        <label class="form-check-label fw-semibold" [for]="uid + '-super'">{{ labels['*'] }}</label>
      </div>
      <div class="row g-1">
        @for (p of all; track p) {
          <div class="col-12 col-sm-6">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                [id]="uid + '-' + p"
                [checked]="isSuper() || value().includes(p)"
                [disabled]="isSuper()"
                (change)="onToggle(p, $event)"
              />
              <label class="form-check-label" [for]="uid + '-' + p">{{ labels[p] }}</label>
            </div>
          </div>
        }
      </div>
    </fieldset>
  `,
  styles: `
    .perms { border: 1px solid var(--an-border); border-radius: var(--an-radius); padding: var(--an-space-3) var(--an-space-4); margin: 0;
      background: var(--an-surface-2); }
    legend { float: none; width: auto; padding: 0 6px; margin: 0; }
    .super { padding-bottom: var(--an-space-2); border-bottom: 1px dashed var(--an-border-strong); }
    .form-check { min-height: 2rem; display: flex; align-items: center; gap: 0.5rem; }
  `,
})
export class PermissionChecklistComponent {
  readonly value = model<string[]>([]);
  protected readonly uid = `perm-${++checklistSeq}`;
  protected readonly all = ADMIN_PERMISSIONS;
  protected readonly labels = PERMISSION_LABELS;
  protected readonly isSuper = computed(() => this.value().includes('*'));

  onToggle(p: string, event: Event): void {
    this.toggle(p, (event.target as HTMLInputElement).checked);
  }

  toggle(p: string, checked: boolean): void {
    let next: string[];
    if (p === '*') {
      next = checked ? ['*'] : [];
    } else {
      next = checked ? [...this.value().filter((v) => v !== p), p] : this.value().filter((v) => v !== p);
    }
    this.value.set(next);
  }
}

interface PermissionsDialogData {
  user: AdminUser;
}

@Component({
  selector: 'app-admin-permissions-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PermissionChecklistComponent],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5"><i class="bi bi-shield-lock me-2 text-gold" aria-hidden="true"></i>Permissions for {{ data.user.name }}</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      <app-permission-checklist [(value)]="perms" />
      @if (empty()) {
        <div class="invalid-feedback d-block" role="alert">Select at least one permission.</div>
      }
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline-secondary" type="button" data-modal-dismiss>Cancel</button>
      <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="save()">
        @if (saving()) {
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        }
        Save permissions
      </button>
    </div>
  `,
})
export class AdminPermissionsDialogComponent {
  protected readonly data = inject<PermissionsDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<string[]>>(ModalRef);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  protected readonly perms = signal<string[]>([...this.data.user.permissions]);
  protected readonly saving = signal(false);
  protected readonly empty = signal(false);

  save(): void {
    if (!this.perms().length) {
      this.empty.set(true);
      return;
    }
    this.saving.set(true);
    this.admin
      .setPermissions(this.data.user.id, this.perms())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe(() => {
        this.toast.success('Permissions updated');
        this.ref.close(this.perms());
      });
  }
}

@Component({
  selector: 'app-admin-admins',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ...FORM_KIT,
    PermissionChecklistComponent,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StatusChipComponent,
    UserAvatarComponent,
    PaginatorComponent,
  ],
  template: `
    <app-page-header eyebrow="Access control" title="Administrators" subtitle="Create admin accounts and control what each admin can do." illustration="team">
      <button class="btn btn-primary" type="button" (click)="showCreate.set(!showCreate())" [attr.aria-expanded]="showCreate()" aria-controls="create-admin">
        <i [class]="showCreate() ? 'bi bi-x-lg' : 'bi bi-person-plus'" aria-hidden="true"></i>
        {{ showCreate() ? 'Close form' : 'New admin' }}
      </button>
    </app-page-header>

    @if (showCreate()) {
      <form id="create-admin" class="card mb-4 fade-in" [formGroup]="form" (ngSubmit)="create()" novalidate aria-labelledby="create-h">
        <div class="card-body">
          <h2 id="create-h" class="h5 mb-3">Create an administrator</h2>
          <div class="row g-3 align-items-start">
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="adm-name" formControlName="name" autocomplete="off" placeholder=" " />
                <label for="adm-name">Full name</label>
              </div>
              <app-field-error [control]="form.controls.name" label="Name" />
            </div>
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="adm-email" type="email" formControlName="email" autocomplete="off" placeholder=" " />
                <label for="adm-email">Email</label>
              </div>
              <app-field-error [control]="form.controls.email" label="Email" />
            </div>
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="adm-mobile" type="tel" formControlName="mobile" autocomplete="off" placeholder=" " />
                <label for="adm-mobile">Mobile</label>
              </div>
              <app-field-error [control]="form.controls.mobile" label="Mobile" />
            </div>
            <div class="col-12 col-md-6">
              <div class="input-group">
                <div class="form-floating">
                  <input
                    class="form-control"
                    id="adm-pass"
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="new-password"
                    placeholder=" "
                    aria-describedby="adm-pass-hint"
                  />
                  <label for="adm-pass">Temporary password</label>
                </div>
                <button class="btn btn-outline-secondary" type="button" (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                  <i [class]="showPassword() ? 'bi bi-eye-slash' : 'bi bi-eye'" aria-hidden="true"></i>
                </button>
              </div>
              <div id="adm-pass-hint" class="form-text">8–128 characters with a letter and a digit.</div>
              <app-field-error [control]="form.controls.password" label="Password" />
            </div>
            <div class="col-12">
              <app-permission-checklist [(value)]="perms" />
              @if (permError()) {
                <div class="invalid-feedback d-block" role="alert">Select at least one permission.</div>
              }
            </div>
          </div>
          <div class="d-flex flex-wrap justify-content-end gap-2 mt-4">
            <button class="btn btn-outline-secondary" type="button" (click)="showCreate.set(false)">Cancel</button>
            <button class="btn btn-primary" type="submit" [disabled]="creating()">
              @if (creating()) {
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
              }
              Create admin
            </button>
          </div>
        </div>
      </form>
    }

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="table" [count]="4" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load admins" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state illustration="empty-team" title="No administrators found" />
    } @else {
      <div class="row g-3">
        @for (u of list.items(); track u.id) {
          <div class="col-12 col-xl-6">
            <article class="card card-hover h-100">
              <div class="card-body d-flex flex-column gap-3">
                <div class="d-flex align-items-center gap-3">
                  <app-user-avatar [userId]="u.id" [hasAvatar]="u.hasAvatar" [name]="u.name" [size]="48" />
                  <div class="min-w-0 flex-grow-1">
                    <div class="cell-main">{{ u.name }}</div>
                    <div class="cell-sub">{{ u.email }} · since {{ u.createdAt | date: 'mediumDate' }}</div>
                  </div>
                  <app-status-chip [status]="u.status" />
                </div>
                <ul class="d-flex flex-wrap gap-1 list-unstyled m-0" aria-label="Permissions">
                  @for (p of u.permissions; track p) {
                    <li>
                      <span class="badge" [class.text-bg-gold]="p === '*'" [class.text-bg-light]="p !== '*'" [class.border]="p !== '*'">
                        @if (p === '*') {
                          <i class="bi bi-stars" aria-hidden="true"></i> Super admin
                        } @else {
                          {{ labels[p] ?? p }}
                        }
                      </span>
                    </li>
                  } @empty {
                    <li class="cell-sub">No permissions</li>
                  }
                </ul>
                <div class="mt-auto d-flex justify-content-end">
                  @if (u.id !== me()) {
                    <button class="btn btn-sm btn-outline-primary" type="button" (click)="editPermissions(u)">
                      <i class="bi bi-shield-lock" aria-hidden="true"></i>Edit permissions
                    </button>
                  } @else {
                    <span class="badge text-bg-gold">You</span>
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
  styles: [ADMIN_LIST_STYLES, `.min-w-0 { min-width: 0; }`],
})
export default class AdminAdminsComponent {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly labels = PERMISSION_LABELS;
  protected readonly list = new PagedList<AdminUser>();
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly showCreate = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly creating = signal(false);
  protected readonly permError = signal(false);
  protected readonly perms = signal<string[]>([]);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    mobile: ['', [Validators.required, mobileValidator]],
    password: ['', [Validators.required, passwordPolicyValidator]],
  });

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly query = computed(() => ({
    role: 'admin' as const,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.users(q)));
    });
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.users(this.query()));
  }

  create(): void {
    this.permError.set(this.perms().length === 0);
    if (this.form.invalid || this.permError()) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    const v = this.form.getRawValue();
    this.admin
      .createAdmin({ name: v.name.trim(), email: v.email.trim(), mobile: v.mobile.trim(), password: v.password, permissions: this.perms() })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(`Admin account created for ${v.name}`);
          this.form.reset({ name: '', email: '', mobile: '', password: '' });
          this.perms.set([]);
          this.showCreate.set(false);
          this.reload();
        },
        error: (e: unknown) => applyServerErrors(this.form as FormGroup, toAppError(e)),
      });
  }

  editPermissions(user: AdminUser): void {
    this.modal
      .open<AdminPermissionsDialogComponent, PermissionsDialogData, string[]>(AdminPermissionsDialogComponent, {
        data: { user },
        size: 'lg',
      })
      .afterClosed()
      .subscribe((permissions) => {
        if (permissions) {
          this.list.patch(user.id, { permissions });
        }
      });
  }
}
