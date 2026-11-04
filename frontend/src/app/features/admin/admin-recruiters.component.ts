import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { StaffRecruiter, StaffRecruiterInput } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';
import { MODAL_DATA, ModalRef, ModalService } from '../../shared/ui/modal.service';
import { applyServerErrors, csvToList, emptyToUndefined, mobileValidator } from '../../shared/utils/form-utils';
import { ADMIN_LIST_STYLES, PagedList, intParam, updateQuery } from './admin-shared';

interface RecruiterDialogData {
  recruiter?: StaffRecruiter;
}

/** Add (invite) or edit a Veejee Services recruiter. */
@Component({
  selector: 'app-recruiter-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5 mb-0">
        <i [class]="editing ? 'bi bi-pencil-square text-gold' : 'bi bi-person-plus text-gold'" aria-hidden="true"></i>
        {{ editing ? 'Edit recruiter' : 'Add a recruiter' }}
      </h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (!editing) {
        <p class="small text-secondary">The recruiter receives an email invitation to set a password and join the Veejee Services recruitment portal.</p>
      }
      @if (error()) {
        <div class="alert alert-danger d-flex gap-2" role="alert"><i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i><span>{{ error() }}</span></div>
      }
      <form id="recruiter-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="row g-3 align-items-start">
          @if (!editing) {
            <div class="col-12">
              <div class="form-floating">
                <input class="form-control" id="rf-name" formControlName="name" autocomplete="off" placeholder=" " data-autofocus />
                <label for="rf-name">Full name</label>
              </div>
              <app-field-error [control]="form.controls.name" label="Full name" />
            </div>
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="rf-email" type="email" formControlName="email" autocomplete="off" placeholder=" " />
                <label for="rf-email">Work email</label>
              </div>
              <app-field-error [control]="form.controls.email" label="Work email" />
            </div>
            <div class="col-12 col-md-6">
              <div class="form-floating">
                <input class="form-control" id="rf-mobile" type="tel" formControlName="mobile" autocomplete="off" placeholder=" " />
                <label for="rf-mobile">Mobile number</label>
              </div>
              <app-field-error [control]="form.controls.mobile" label="Mobile number" />
            </div>
          } @else {
            <div class="col-12">
              <p class="mb-0"><strong>{{ data.recruiter?.user?.name }}</strong> <span class="text-secondary">· {{ data.recruiter?.user?.email }}</span></p>
            </div>
          }
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="rf-designation" formControlName="designation" placeholder=" " />
              <label for="rf-designation">Designation (optional)</label>
            </div>
            <app-field-error [control]="form.controls.designation" label="Designation" />
          </div>
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="rf-code" formControlName="employeeCode" placeholder=" " />
              <label for="rf-code">Employee code (optional)</label>
            </div>
            <app-field-error [control]="form.controls.employeeCode" label="Employee code" />
          </div>
          <div class="col-12">
            <div class="form-floating">
              <input class="form-control" id="rf-spec" formControlName="specializations" placeholder=" " aria-describedby="rf-spec-hint" />
              <label for="rf-spec">Specializations (optional)</label>
            </div>
            <div class="form-text" id="rf-spec-hint">Comma separated, e.g. IT & Software Development, Banking & Finance.</div>
            @if (specs().length) {
              <div class="d-flex flex-wrap gap-1 mt-2" aria-hidden="true">
                @for (s of specs(); track s) {
                  <span class="badge text-bg-light border">{{ s }}</span>
                }
              </div>
            }
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="submit" form="recruiter-form" class="btn btn-primary" [disabled]="saving()">
        @if (saving()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> }
        {{ editing ? 'Save changes' : 'Send invitation' }}
      </button>
    </div>
  `,
})
export class RecruiterFormDialogComponent {
  protected readonly data = inject<RecruiterDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<StaffRecruiter>>(ModalRef);
  private readonly admin = inject(AdminService);
  protected readonly editing = !!this.data.recruiter;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', this.editing ? [] : [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', this.editing ? [] : [Validators.required, Validators.email]],
    mobile: ['', this.editing ? [] : [Validators.required, mobileValidator]],
    designation: [this.data.recruiter?.designation ?? '', Validators.maxLength(100)],
    employeeCode: [this.data.recruiter?.employeeCode ?? '', Validators.maxLength(40)],
    specializations: [(this.data.recruiter?.specializations ?? []).join(', '), Validators.maxLength(500)],
  });
  private readonly specText = toSignal(this.form.controls.specializations.valueChanges, {
    initialValue: this.form.controls.specializations.value,
  });
  protected readonly specs = computed(() => csvToList(this.specText()));

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const common: StaffRecruiterInput = {
      designation: emptyToUndefined(v.designation),
      employeeCode: emptyToUndefined(v.employeeCode),
      specializations: csvToList(v.specializations),
    };
    const req$ = this.data.recruiter
      ? this.admin.updateStaffRecruiter(this.data.recruiter.id, common)
      : this.admin.createStaffRecruiter({ ...common, name: v.name.trim(), email: v.email.trim(), mobile: v.mobile.trim() });
    this.saving.set(true);
    this.error.set(null);
    req$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r) => this.ref.close(r),
      error: (err: unknown) => {
        const e = toAppError(err);
        const rest = applyServerErrors(this.form, e);
        if (e.errorCode === 'DUPLICATE_RESOURCE' || e.errorCode === 'CONFLICT') {
          this.form.controls.email.setErrors({ server: 'An account with this email already exists.' });
          this.form.controls.email.markAsTouched();
        } else if (!e.details.length || rest.length) {
          this.error.set(rest.join(' ') || friendlyMessage(e));
        }
      },
    });
  }
}

@Component({
  selector: 'app-admin-recruiters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, EmptyStateComponent, PageHeaderComponent, PaginatorComponent, SkeletonComponent, UserAvatarComponent],
  template: `
    <app-page-header
      eyebrow="Recruitment team"
      title="Recruiter management"
      subtitle="Veejee Services recruiters screen candidates, match them to company requirements and coordinate interviews."
      illustration="team"
    >
      <button class="btn btn-gold" type="button" (click)="add()" data-testid="add-recruiter"><i class="bi bi-person-plus" aria-hidden="true"></i> Add recruiter</button>
    </app-page-header>

    <ul class="nav nav-pills nav-scroll mb-3" role="tablist" aria-label="Filter recruiters">
      @for (t of tabs; track t.value) {
        <li class="nav-item" role="presentation">
          <button class="nav-link" type="button" role="tab" [class.active]="activeFilter() === t.value" [attr.aria-selected]="activeFilter() === t.value"
            (click)="setFilter(t.value)"><i [class]="'bi ' + t.icon" aria-hidden="true"></i> {{ t.label }}</button>
        </li>
      }
    </ul>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="card" [count]="4" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" title="Couldn't load recruiters" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state illustration="empty-team" title="No recruiters here" message="Add a recruiter to invite them to the Veejee Services recruitment portal.">
        <button class="btn btn-primary" type="button" (click)="add()">Add recruiter</button>
      </app-empty-state>
    } @else {
      <p class="count">{{ list.total() }} recruiter{{ list.total() === 1 ? '' : 's' }}</p>
      <div class="row g-3">
        @for (r of list.items(); track r.id) {
          <div class="col-12 col-lg-6">
            <article class="card card-hover h-100 rec" [class.inactive]="!r.active" data-testid="recruiter-row">
              <div class="card-body d-flex flex-column gap-3">
                <div class="d-flex gap-3 align-items-start">
                  <app-user-avatar [userId]="r.user.id" [hasAvatar]="r.user.hasAvatar ?? false" [name]="r.user.name" [size]="48" />
                  <div class="min-w-0 flex-grow-1">
                    <div class="cell-main">{{ r.user.name }}</div>
                    <div class="cell-sub">{{ r.designation || 'Recruiter' }}@if (r.employeeCode) { · {{ r.employeeCode }} }</div>
                    <div class="cell-sub"><i class="bi bi-envelope" aria-hidden="true"></i> {{ r.user.email }}@if (r.user.mobile) { · {{ r.user.mobile }} }</div>
                  </div>
                  <div class="d-flex flex-column align-items-end gap-1">
                    <span class="badge rounded-pill" [class]="r.active ? 'badge rounded-pill text-bg-success' : 'badge rounded-pill text-bg-secondary'">{{ r.active ? 'Active' : 'Inactive' }}</span>
                    @if (invitePending(r)) {
                      <span class="badge rounded-pill text-bg-warning">Invite pending</span>
                    }
                  </div>
                </div>
                <div class="metrics">
                  <div class="m"><span class="m-v">{{ r.assignedCandidates ?? 0 | number }}</span><span class="m-l">Assigned candidates</span></div>
                  <div class="m"><span class="m-v">{{ r.placements ?? 0 | number }}</span><span class="m-l">Placements</span></div>
                  <div class="m"><span class="m-v">{{ r.createdAt ? (r.createdAt | date: 'MMM y') : '—' }}</span><span class="m-l">Joined</span></div>
                </div>
                @if (r.specializations?.length) {
                  <div class="d-flex flex-wrap gap-1" aria-label="Specializations">
                    @for (s of r.specializations; track s) {
                      <span class="badge spec">{{ s }}</span>
                    }
                  </div>
                }
                <div class="d-flex flex-wrap gap-2 mt-auto justify-content-end">
                  @if (invitePending(r)) {
                    <button class="btn btn-sm btn-outline-primary" type="button" [disabled]="busy() === r.id" (click)="resend(r)">
                      <i class="bi bi-envelope-arrow-up" aria-hidden="true"></i> Resend invite
                    </button>
                  }
                  <button class="btn btn-sm btn-light" type="button" (click)="edit(r)" [disabled]="busy() === r.id">
                    <i class="bi bi-pencil" aria-hidden="true"></i> Edit
                  </button>
                  @if (r.active) {
                    <button class="btn btn-sm btn-outline-danger" type="button" [disabled]="busy() === r.id" (click)="setActive(r, false)">
                      <i class="bi bi-person-dash" aria-hidden="true"></i> Deactivate
                    </button>
                  } @else {
                    <button class="btn btn-sm btn-success" type="button" [disabled]="busy() === r.id" (click)="setActive(r, true)">
                      <i class="bi bi-person-check" aria-hidden="true"></i> Activate
                    </button>
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
      .rec.inactive { opacity: 0.8; }
      .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--an-space-2); }
      .m { background: var(--an-surface-2); border-radius: var(--an-radius); padding: var(--an-space-2) var(--an-space-3); min-width: 0; }
      .m-v { display: block; font-family: var(--an-font-heading); font-weight: 800; color: var(--an-navy-900); font-size: 1.15rem; }
      .m-l { display: block; font-size: 0.74rem; color: var(--an-text-muted); }
      .spec { background: var(--an-gold-100); color: var(--an-gold-700); border: 1px solid var(--an-gold-300); font-weight: 600; }
    `,
  ],
})
export default class AdminRecruitersComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly modal = inject(ModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = [
    { value: 'true', label: 'Active', icon: 'bi-person-check' },
    { value: 'false', label: 'Inactive', icon: 'bi-person-dash' },
    { value: '', label: 'All', icon: 'bi-people' },
  ];
  protected readonly list = new PagedList<StaffRecruiter>();
  protected readonly busy = signal<string | null>(null);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly activeFilter = computed(() => {
    const a = this.params().get('active');
    return a === 'true' || a === 'false' ? a : '';
  });
  private readonly query = computed(() => ({
    active: this.activeFilter() === '' ? undefined : this.activeFilter() === 'true',
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.staffRecruiters(q)));
    });
  }

  reload(): void {
    this.list.load(this.admin.staffRecruiters(this.query()));
  }

  setFilter(value: string): void {
    updateQuery(this.router, this.route, { active: value || null });
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  protected invitePending(r: StaffRecruiter): boolean {
    return r.user.emailVerified === false || r.user.status === 'pending';
  }

  add(): void {
    this.modal
      .open<RecruiterFormDialogComponent, RecruiterDialogData, StaffRecruiter>(RecruiterFormDialogComponent, { data: {}, size: 'lg' })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        this.toast.success('Invitation sent to the new recruiter');
        this.reload();
      });
  }

  edit(recruiter: StaffRecruiter): void {
    this.modal
      .open<RecruiterFormDialogComponent, RecruiterDialogData, StaffRecruiter>(RecruiterFormDialogComponent, { data: { recruiter }, size: 'lg' })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        this.list.patch(recruiter.id, {
          designation: r.designation,
          employeeCode: r.employeeCode,
          specializations: r.specializations ?? [],
        });
        this.toast.success('Recruiter updated');
      });
  }

  setActive(r: StaffRecruiter, active: boolean): void {
    this.confirm
      .open({
        title: active ? `Reactivate ${r.user.name}?` : `Deactivate ${r.user.name}?`,
        message: active
          ? 'They will be able to sign in to the recruitment portal again.'
          : 'They will lose access to the recruitment portal. Their candidates and history are kept and can be reassigned.',
        confirmText: active ? 'Activate' : 'Deactivate',
        tone: active ? 'default' : 'danger',
      })
      .subscribe((res) => {
        if (!res) return;
        this.busy.set(r.id);
        this.admin
          .updateStaffRecruiter(r.id, { active })
          .pipe(finalize(() => this.busy.set(null)))
          .subscribe(() => {
            const filter = this.activeFilter();
            if (filter !== '' && (filter === 'true') !== active) {
              this.list.remove(r.id);
            } else {
              this.list.patch(r.id, { active });
            }
            this.toast.success(active ? `${r.user.name} reactivated` : `${r.user.name} deactivated`);
          });
      });
  }

  resend(r: StaffRecruiter): void {
    this.busy.set(r.id);
    this.admin
      .resendRecruiterInvite(r.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe(() => this.toast.success(`Invitation re-sent to ${r.user.email}`));
  }
}
