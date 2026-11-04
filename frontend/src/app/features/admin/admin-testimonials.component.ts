import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { AdminTestimonial, Paginated, TestimonialInput } from '../../core/models';
import { applyServerErrors } from '../../shared/utils/form-utils';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { MODAL_DATA, ModalRef, ModalService } from '../../shared/ui/modal.service';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';

/** Publishing a testimonial requires recorded consent from the person quoted. */
function consentRequiredForPublish(group: AbstractControl): ValidationErrors | null {
  const published = group.get('published')?.value as boolean;
  const consent = group.get('consentConfirmed')?.value as boolean;
  return published && !consent ? { consentRequired: true } : null;
}

@Component({
  selector: 'app-testimonial-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5"><i class="bi bi-chat-quote me-2 text-gold" aria-hidden="true"></i>{{ data ? 'Edit testimonial' : 'New testimonial' }}</h2>
        <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
      </div>
      <div class="modal-body">
        <div class="row g-3 align-items-start">
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="t-name" formControlName="name" placeholder=" " />
              <label for="t-name">Name</label>
            </div>
            <app-field-error [control]="form.controls.name" label="Name" />
          </div>
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="t-role" formControlName="role" placeholder=" " />
              <label for="t-role">Role / designation</label>
            </div>
            <app-field-error [control]="form.controls.role" label="Role" />
          </div>
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <input class="form-control" id="t-company" formControlName="company" placeholder=" " />
              <label for="t-company">Company (optional)</label>
            </div>
            <app-field-error [control]="form.controls.company" label="Company" />
          </div>
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <select class="form-select" id="t-rating" formControlName="rating">
                @for (r of [5, 4, 3, 2, 1]; track r) {
                  <option [ngValue]="r">{{ r }} star{{ r === 1 ? '' : 's' }}</option>
                }
              </select>
              <label for="t-rating">Rating</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="t-quote" formControlName="quote" maxlength="1000" placeholder=" " style="height: 8rem"></textarea>
              <label for="t-quote">Quote</label>
            </div>
            <div class="form-text text-end">{{ form.controls.quote.value.length }} / 1000</div>
            <app-field-error [control]="form.controls.quote" label="Quote" />
          </div>
          <div class="col-12">
            <div class="consent">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="t-consent" formControlName="consentConfirmed" />
                <label class="form-check-label" for="t-consent">I confirm this person gave written consent to publish their name and quote.</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="t-published" formControlName="published" />
                <label class="form-check-label" for="t-published">Published on the website</label>
              </div>
              @if (form.hasError('consentRequired')) {
                <div class="invalid-feedback d-block" role="alert">A testimonial can only be published after consent is confirmed.</div>
              } @else {
                <div class="form-text">Only testimonials with confirmed consent appear publicly.</div>
              }
            </div>
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
  styles: `
    .consent { display: flex; flex-direction: column; gap: var(--an-space-2); background: var(--an-surface-2); border-radius: var(--an-radius);
      padding: var(--an-space-3) var(--an-space-4); }
  `,
})
export class TestimonialDialogComponent {
  protected readonly data = inject<AdminTestimonial | null>(MODAL_DATA);
  private readonly ref = inject<ModalRef<AdminTestimonial>>(ModalRef);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(100)]],
      role: [this.data?.role ?? '', [Validators.required, Validators.maxLength(100)]],
      company: [this.data?.company ?? '', [Validators.maxLength(120)]],
      quote: [this.data?.quote ?? '', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      rating: [this.data?.rating ?? 5, [Validators.required, Validators.min(1), Validators.max(5)]],
      consentConfirmed: [this.data?.consentConfirmed ?? false],
      published: [this.data?.published ?? false],
    },
    { validators: consentRequiredForPublish },
  );

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: TestimonialInput = {
      name: v.name.trim(),
      role: v.role.trim(),
      company: v.company.trim(),
      quote: v.quote.trim(),
      rating: Number(v.rating),
      consentConfirmed: v.consentConfirmed,
      published: v.published,
    };
    const req: Observable<AdminTestimonial> = this.data
      ? this.admin.updateTestimonial(this.data.id, body)
      : this.admin.createTestimonial(body);
    this.saving.set(true);
    req.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (t) => {
        this.toast.success(this.data ? 'Testimonial updated' : 'Testimonial created');
        this.ref.close(t && typeof t === 'object' && 'id' in t ? t : ({ ...body, id: this.data?.id ?? '' } as AdminTestimonial));
      },
      error: (e: unknown) => applyServerErrors(this.form as FormGroup, toAppError(e)),
    });
  }
}

@Component({
  selector: 'app-admin-testimonials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SkeletonComponent, EmptyStateComponent, StatusChipComponent, PaginatorComponent, RevealDirective],
  template: `
    <app-page-header eyebrow="Social proof" title="Testimonials" subtitle="Shown on the homepage only when published and consent is confirmed." illustration="content">
      <button class="btn btn-primary" type="button" (click)="edit()">
        <i class="bi bi-plus-lg" aria-hidden="true"></i>New testimonial
      </button>
    </app-page-header>

    @if (loading() && !items().length) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load testimonials" [message]="err">
        <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
      </app-empty-state>
    } @else if (!items().length) {
      <app-empty-state illustration="empty-messages" title="No testimonials yet" message="Add a testimonial once you have the person's consent.">
        <button class="btn btn-primary" type="button" (click)="edit()"><i class="bi bi-plus-lg" aria-hidden="true"></i>New testimonial</button>
      </app-empty-state>
    } @else {
      <div class="row g-3">
        @for (t of items(); track t.id) {
          <div class="col-12 col-md-6 col-xl-4" appReveal>
            <article class="card card-hover h-100 quote-card">
              <div class="card-body d-flex flex-column gap-2">
                <div class="d-flex flex-wrap gap-2">
                  <app-status-chip [status]="t.published ? 'published' : 'draft'" />
                  <app-status-chip [status]="t.consentConfirmed ? 'verified' : 'pending'" [label]="t.consentConfirmed ? 'Consent confirmed' : 'Consent missing'" />
                </div>
                <p class="stars mb-0" role="img" [attr.aria-label]="t.rating + ' out of 5 stars'">
                  @for (s of [1, 2, 3, 4, 5]; track s) {
                    <i [class]="s <= t.rating ? 'bi bi-star-fill on' : 'bi bi-star'" aria-hidden="true"></i>
                  }
                </p>
                <blockquote class="mb-0">
                  <i class="bi bi-quote q-mark" aria-hidden="true"></i>
                  {{ t.quote }}
                </blockquote>
                <p class="who mb-0"><strong>{{ t.name }}</strong><br /><span>{{ t.role }}@if (t.company) { · {{ t.company }} }</span></p>
                <div class="mt-auto d-flex gap-2 justify-content-end pt-2">
                  <button class="btn btn-sm btn-outline-primary" type="button" (click)="edit(t)"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</button>
                  <button class="btn btn-sm btn-outline-danger" type="button" (click)="remove(t)"><i class="bi bi-trash" aria-hidden="true"></i>Delete</button>
                </div>
              </div>
            </article>
          </div>
        }
      </div>
      @if (paginated()) {
        <app-paginator [page]="page()" [limit]="limit()" [total]="total()" (pageChange)="onPage($event)" />
      }
    }
  `,
  styles: `
    .quote-card { border-top: 3px solid var(--an-gold-500); }
    .stars .bi { font-size: 1rem; color: var(--an-border-strong); margin-right: 2px; }
    .stars .on { color: var(--an-gold-500); }
    blockquote { color: var(--an-text-2); font-style: italic; overflow-wrap: anywhere; }
    .q-mark { font-size: 1.6rem; color: var(--an-gold-500); vertical-align: -0.35em; }
    .who { font-size: 0.9rem; }
    .who span { color: var(--an-text-muted); }
  `,
})
export default class AdminTestimonialsComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly modal = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<AdminTestimonial[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly paginated = signal(false);
  protected readonly page = signal(1);
  protected readonly limit = signal(20);
  protected readonly total = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .testimonials({ page: this.page(), limit: this.limit() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          // The contract does not say whether this list is paginated; accept both forms.
          if (Array.isArray(res)) {
            this.paginated.set(false);
            this.items.set(res);
            this.total.set(res.length);
          } else {
            const p = res as Paginated<AdminTestimonial>;
            this.paginated.set(true);
            this.items.set(p.items ?? []);
            this.total.set(p.total ?? 0);
            this.page.set(p.page ?? 1);
            this.limit.set(p.limit ?? 20);
          }
        },
        error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))),
      });
  }

  onPage(e: PageChange): void {
    this.page.set(e.page);
    this.limit.set(e.limit);
    this.load();
  }

  edit(t?: AdminTestimonial): void {
    this.modal
      .open<TestimonialDialogComponent, AdminTestimonial | null, AdminTestimonial>(TestimonialDialogComponent, {
        data: t ?? null,
        size: 'lg',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  remove(t: AdminTestimonial): void {
    this.confirm
      .open({ title: 'Delete this testimonial?', message: `The testimonial from ${t.name} will be removed permanently.`, confirmText: 'Delete', tone: 'danger' })
      .subscribe((r) => {
        if (!r) return;
        this.admin.deleteTestimonial(t.id).subscribe(() => {
          this.items.update((list) => list.filter((x) => x.id !== t.id));
          this.total.update((n) => Math.max(0, n - 1));
          this.toast.success('Testimonial deleted');
        });
      });
  }
}
