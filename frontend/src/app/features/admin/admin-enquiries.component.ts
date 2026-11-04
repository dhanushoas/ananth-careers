import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { Enquiry, EnquiryStatus } from '../../core/models';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { MODAL_DATA, ModalRef, ModalService } from '../../shared/ui/modal.service';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ADMIN_LIST_STYLES, PagedList, intParam, oneOf, updateQuery } from './admin-shared';

const STATUSES: readonly EnquiryStatus[] = ['new', 'in_progress', 'resolved'];

@Component({
  selector: 'app-enquiry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, EnumLabelPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5"><i class="bi bi-envelope-paper me-2 text-gold" aria-hidden="true"></i>Update enquiry</h2>
        <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
      </div>
      <div class="modal-body">
        <p class="mb-3 text-break"><strong>{{ data.subject }}</strong> — {{ data.name }}</p>
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <select class="form-select" id="enq-status" formControlName="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s | enumLabel }}</option>
                }
              </select>
              <label for="enq-status">Status</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="enq-notes" formControlName="notes" maxlength="2000" placeholder=" " style="height: 8rem"></textarea>
              <label for="enq-notes">Internal notes</label>
            </div>
            <div class="form-text">Only visible to admins.</div>
            <app-field-error [control]="form.controls.notes" label="Notes" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-secondary" type="button" data-modal-dismiss>Cancel</button>
        <button class="btn btn-primary" type="submit" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          }
          Save
        </button>
      </div>
    </form>
  `,
})
export class EnquiryDialogComponent {
  protected readonly data = inject<Enquiry>(MODAL_DATA);
  private readonly ref = inject<ModalRef<Partial<Enquiry>>>(ModalRef);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  protected readonly statuses = STATUSES;
  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    status: [this.data.status, Validators.required],
    notes: [this.data.notes ?? '', Validators.maxLength(2000)],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.admin
      .updateEnquiry(this.data.id, v.status, v.notes.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe(() => {
        this.toast.success('Enquiry updated');
        this.ref.close({ status: v.status, notes: v.notes.trim() });
      });
  }
}

@Component({
  selector: 'app-admin-enquiries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, StatusChipComponent, PaginatorComponent, EnumLabelPipe, TimeAgoPipe],
  template: `
    <app-page-header eyebrow="Inbox" title="Enquiries" subtitle="Messages submitted through the contact form." illustration="contact" />

    <div class="card mb-4">
      <div class="card-body">
        <ul class="nav nav-pills nav-scroll" role="tablist" aria-label="Enquiry status">
          @for (t of tabs; track t.value) {
            <li class="nav-item" role="presentation">
              <button
                type="button"
                class="nav-link"
                role="tab"
                [class.active]="(status() ?? '') === t.value"
                [attr.aria-selected]="(status() ?? '') === t.value"
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
      <app-skeleton variant="card" [count]="4" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load enquiries" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state illustration="empty-messages" title="No enquiries" message="Nothing matches this filter." />
    } @else {
      <p class="count">{{ list.total() }} enquir{{ list.total() === 1 ? 'y' : 'ies' }}</p>
      <ul class="list-unstyled d-grid gap-3 m-0">
        @for (e of list.items(); track e.id) {
          <li class="card card-hover enq" [class.is-new]="e.status === 'new'">
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                <div class="d-flex gap-3 align-items-start min-w-0 flex-grow-1">
                  <span class="enq-icon"><i class="bi bi-envelope" aria-hidden="true"></i></span>
                  <div class="min-w-0">
                    <h2 class="subject">{{ e.subject }}</h2>
                    <p class="cell-sub mb-0">
                      {{ e.name }} · <a [href]="'mailto:' + e.email">{{ e.email }}</a>
                      @if (e.phone) {
                        · <a [href]="'tel:' + e.phone">{{ e.phone }}</a>
                      }
                    </p>
                  </div>
                </div>
                <div class="d-flex flex-wrap gap-2 align-items-center">
                  <span class="badge text-bg-light border">{{ e.enquiryType | enumLabel }}</span>
                  <app-status-chip [status]="e.status" />
                </div>
              </div>
              <p class="msg" [class.clamp]="expanded() !== e.id" [id]="'enq-msg-' + e.id">{{ e.message }}</p>
              @if (e.notes) {
                <p class="notes"><i class="bi bi-sticky me-1" aria-hidden="true"></i><strong>Notes:</strong> {{ e.notes }}</p>
              }
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                <span class="cell-sub">
                  <i class="bi bi-clock me-1" aria-hidden="true"></i>
                  <time [attr.datetime]="e.createdAt" [title]="e.createdAt | date: 'medium'">{{ e.createdAt | timeAgo }}</time>
                </span>
                <div class="d-flex flex-wrap gap-2">
                  <button
                    class="btn btn-sm btn-light"
                    type="button"
                    (click)="expanded.set(expanded() === e.id ? null : e.id)"
                    [attr.aria-expanded]="expanded() === e.id"
                    [attr.aria-controls]="'enq-msg-' + e.id"
                  >
                    {{ expanded() === e.id ? 'Collapse' : 'Read full message' }}
                  </button>
                  <button class="btn btn-sm btn-outline-primary" type="button" (click)="edit(e)">
                    <i class="bi bi-pencil-square" aria-hidden="true"></i>Update status
                  </button>
                </div>
              </div>
            </div>
          </li>
        }
      </ul>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .min-w-0 { min-width: 0; }
      .enq.is-new { border-left: 4px solid var(--an-gold-500); }
      .enq-icon { width: 40px; height: 40px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
        background: var(--an-navy-50); color: var(--an-navy-700); }
      .is-new .enq-icon { background: var(--an-gold-100); color: var(--an-gold-700); }
      .subject { font-size: 1rem; margin: 0; overflow-wrap: anywhere; }
      .msg { margin: var(--an-space-3) 0 0; white-space: pre-line; color: var(--an-text-2); overflow-wrap: anywhere; }
      .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .notes { margin: var(--an-space-2) 0 0; font-size: 0.88rem; background: var(--an-surface-2); padding: var(--an-space-2) var(--an-space-3); border-radius: 8px; }
    `,
  ],
})
export default class AdminEnquiriesComponent {
  private readonly admin = inject(AdminService);
  private readonly modal = inject(ModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = [
    { value: 'new', label: 'New', icon: 'bi-envelope-exclamation' },
    { value: 'in_progress', label: 'In progress', icon: 'bi-arrow-repeat' },
    { value: 'resolved', label: 'Resolved', icon: 'bi-check2-circle' },
    { value: '', label: 'All', icon: 'bi-collection' },
  ];
  protected readonly list = new PagedList<Enquiry>();
  protected readonly expanded = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly status = computed(() => oneOf(this.params().get('status'), STATUSES));
  private readonly query = computed(() => ({
    status: this.status(),
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.enquiries(q)));
    });
  }

  setFilter(value: string): void {
    updateQuery(this.router, this.route, { status: value || null });
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.enquiries(this.query()));
  }

  edit(e: Enquiry): void {
    this.modal
      .open<EnquiryDialogComponent, Enquiry, Partial<Enquiry>>(EnquiryDialogComponent, { data: e })
      .afterClosed()
      .subscribe((patch) => {
        if (!patch) return;
        const filter = this.status();
        if (filter && patch.status && patch.status !== filter) {
          this.list.remove(e.id);
        } else {
          this.list.patch(e.id, patch);
        }
      });
  }
}
