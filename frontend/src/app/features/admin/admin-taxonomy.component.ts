import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ToastService } from '../../core/services/toast.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { Category, Industry } from '../../core/models';
import { applyServerErrors, emptyToUndefined } from '../../shared/utils/form-utils';
import { industryIcon } from '../../shared/utils/industry-icons';
import { BiPipe, MATERIAL_TO_BI, biIcon } from '../../shared/ui/icons';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MODAL_DATA, ModalRef, ModalService } from '../../shared/ui/modal.service';
import { ADMIN_LIST_STYLES } from './admin-shared';

interface IndustryDialogData {
  industry?: Industry;
}

@Component({
  selector: 'app-industry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, BiPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5"><i class="bi bi-grid me-2 text-gold" aria-hidden="true"></i>{{ data.industry ? 'Edit industry' : 'New industry' }}</h2>
        <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
      </div>
      <div class="modal-body">
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <input class="form-control" id="ind-name" formControlName="name" placeholder=" " />
              <label for="ind-name">Name</label>
            </div>
            <app-field-error [control]="form.controls.name" label="Name" />
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea class="form-control" id="ind-desc" formControlName="description" placeholder=" " style="height: 6rem"></textarea>
              <label for="ind-desc">Description</label>
            </div>
            <app-field-error [control]="form.controls.description" label="Description" />
          </div>
          <div class="col-12 col-md-7">
            <div class="input-group">
              <div class="form-floating">
                <input class="form-control" id="ind-icon" formControlName="icon" placeholder=" " list="ind-icon-options" aria-describedby="ind-icon-hint" />
                <label for="ind-icon">Icon name</label>
              </div>
              <span class="input-group-text preview" aria-hidden="true"><i [class]="'bi ' + (form.controls.icon.value | bi)"></i></span>
            </div>
            <datalist id="ind-icon-options">
              @for (name of iconNames; track name) {
                <option [value]="name"></option>
              }
            </datalist>
            <div id="ind-icon-hint" class="form-text">Material Symbols name stored by the API (e.g. terminal, storefront); preview shows the site icon.</div>
            <app-field-error [control]="form.controls.icon" label="Icon" />
          </div>
          <div class="col-12 col-md-5">
            <div class="form-floating">
              <input class="form-control" id="ind-order" type="number" formControlName="order" min="0" placeholder=" " />
              <label for="ind-order">Display order</label>
            </div>
            <app-field-error [control]="form.controls.order" label="Order" />
          </div>
          <div class="col-12">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="ind-active" formControlName="active" />
              <label class="form-check-label" for="ind-active">Active (visible on the site)</label>
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
  styles: `.preview { min-width: 56px; justify-content: center; font-size: 1.4rem; color: var(--an-navy-700); background: var(--an-navy-50); }`,
})
export class IndustryDialogComponent {
  protected readonly data = inject<IndustryDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<Industry>>(ModalRef);
  private readonly taxonomy = inject(TaxonomyService);
  private readonly toast = inject(ToastService);
  protected readonly iconNames = Object.keys(MATERIAL_TO_BI);
  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.industry?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    description: [this.data.industry?.description ?? '', [Validators.maxLength(500)]],
    icon: [this.data.industry?.icon ?? '', [Validators.pattern(/^[a-z0-9_-]*$/), Validators.maxLength(60)]],
    order: [this.data.industry?.order ?? 0, [Validators.min(0), Validators.max(9999)]],
    active: [this.data.industry?.active ?? true],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      name: v.name.trim(),
      description: emptyToUndefined(v.description),
      icon: emptyToUndefined(v.icon),
      order: Number(v.order) || 0,
      active: v.active,
    };
    const req: Observable<Industry> = this.data.industry
      ? this.taxonomy.updateIndustry(this.data.industry.id, body)
      : this.taxonomy.createIndustry(body);
    this.saving.set(true);
    req.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (industry) => {
        this.toast.success(this.data.industry ? 'Industry updated' : 'Industry created');
        this.ref.close(industry ?? ({ id: '' } as Industry));
      },
      error: (e: unknown) => applyServerErrors(this.form as FormGroup, toAppError(e)),
    });
  }
}

interface CategoryDialogData {
  industry: Industry;
  category?: Category;
}

@Component({
  selector: 'app-category-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">{{ data.category ? 'Edit category' : 'New category in ' + data.industry.name }}</h2>
        <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
      </div>
      <div class="modal-body">
        <div class="row g-3 align-items-start">
          <div class="col-12">
            <div class="form-floating">
              <input class="form-control" id="cat-name" formControlName="name" placeholder=" " />
              <label for="cat-name">Name</label>
            </div>
            <app-field-error [control]="form.controls.name" label="Name" />
          </div>
          <div class="col-12">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="cat-active" formControlName="active" />
              <label class="form-check-label" for="cat-active">Active</label>
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
})
export class CategoryDialogComponent {
  protected readonly data = inject<CategoryDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<Category>>(ModalRef);
  private readonly taxonomy = inject(TaxonomyService);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    active: [this.data.category?.active ?? true],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), industry: this.data.industry.id, active: v.active };
    const req: Observable<Category> = this.data.category
      ? this.taxonomy.updateCategory(this.data.category.id, body)
      : this.taxonomy.createCategory(body);
    this.saving.set(true);
    req.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (c) => {
        this.toast.success(this.data.category ? 'Category updated' : 'Category created');
        this.ref.close(c ?? ({ id: '' } as Category));
      },
      error: (e: unknown) => applyServerErrors(this.form as FormGroup, toAppError(e)),
    });
  }
}

@Component({
  selector: 'app-admin-taxonomy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SkeletonComponent, EmptyStateComponent],
  template: `
    <app-page-header
      eyebrow="Taxonomy"
      title="Industries & categories"
      subtitle="Industries power the homepage grid and job filters; categories refine them."
      illustration="industries"
    >
      <button class="btn btn-primary" type="button" (click)="editIndustry()">
        <i class="bi bi-plus-lg" aria-hidden="true"></i>New industry
      </button>
    </app-page-header>

    @if (loading() && !industries().length) {
      <app-skeleton variant="table" [count]="6" />
    } @else if (error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load industries" [message]="err">
        <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
      </app-empty-state>
    } @else if (!industries().length) {
      <app-empty-state illustration="industries" title="No industries yet" message="Create the first industry to start organising jobs.">
        <button class="btn btn-primary" type="button" (click)="editIndustry()"><i class="bi bi-plus-lg" aria-hidden="true"></i>New industry</button>
      </app-empty-state>
    } @else {
      <div class="row g-4 align-items-start">
        <div class="col-12 col-xl-7">
          <ul class="list-unstyled d-grid gap-2 m-0" aria-label="Industries">
            @for (i of industries(); track i.id) {
              <li class="card ind" [class.selected]="selected()?.id === i.id" [class.inactive]="!i.active">
                <div class="card-body d-flex flex-wrap align-items-center gap-2 py-2 px-3">
                  <button type="button" class="ind-main" (click)="select(i)" [attr.aria-pressed]="selected()?.id === i.id">
                    <span class="ic"><i [class]="'bi ' + icon(i)" aria-hidden="true"></i></span>
                    <span class="d-flex flex-column min-w-0">
                      <span class="cell-main">{{ i.name }}</span>
                      <span class="cell-sub">
                        <span class="badge text-bg-light border me-1">{{ i.jobCount ?? 0 }} jobs</span>
                        order {{ i.order ?? 0 }}{{ i.active ? '' : ' · inactive' }}
                      </span>
                    </span>
                  </button>
                  <div class="d-flex align-items-center gap-1 ms-auto">
                    <div class="form-check form-switch m-0 me-1">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        [id]="'ind-act-' + i.id"
                        [checked]="i.active"
                        (change)="onToggleIndustry(i, $event)"
                      />
                      <label class="visually-hidden" [for]="'ind-act-' + i.id">Active: {{ i.name }}</label>
                    </div>
                    <button class="btn btn-light btn-icon" type="button" (click)="editIndustry(i)" [attr.aria-label]="'Edit ' + i.name">
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button class="btn btn-light btn-icon text-danger" type="button" (click)="deleteIndustry(i)" [attr.aria-label]="'Delete ' + i.name">
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>

        <div class="col-12 col-xl-5">
          <section class="card cats" aria-live="polite" [attr.aria-label]="selected() ? 'Categories in ' + selected()!.name : 'Categories'">
            <div class="card-body">
              @if (selected(); as ind) {
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h2 class="h6 m-0 d-flex align-items-center gap-2">
                    <span class="ic sm"><i [class]="'bi ' + icon(ind)" aria-hidden="true"></i></span>{{ ind.name }}
                  </h2>
                  <button class="btn btn-sm btn-outline-primary" type="button" (click)="editCategory()">
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>Add category
                  </button>
                </div>
                @if (catLoading()) {
                  <app-skeleton variant="lines" [count]="4" />
                } @else {
                  <ul class="list-group list-group-flush">
                    @for (c of categories(); track c.id) {
                      <li class="list-group-item d-flex align-items-center gap-2 px-0">
                        <span class="flex-grow-1 min-w-0" [class.text-secondary]="!c.active">{{ c.name }}{{ c.active ? '' : ' (inactive)' }}</span>
                        <div class="form-check form-switch m-0">
                          <input
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            [id]="'cat-act-' + c.id"
                            [checked]="c.active"
                            (change)="onToggleCategory(c, $event)"
                          />
                          <label class="visually-hidden" [for]="'cat-act-' + c.id">Active: {{ c.name }}</label>
                        </div>
                        <button class="btn btn-light btn-icon" type="button" (click)="editCategory(c)" [attr.aria-label]="'Edit ' + c.name">
                          <i class="bi bi-pencil" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-light btn-icon text-danger" type="button" (click)="deleteCategory(c)" [attr.aria-label]="'Delete ' + c.name">
                          <i class="bi bi-trash" aria-hidden="true"></i>
                        </button>
                      </li>
                    } @empty {
                      <li class="list-group-item px-0">
                        <app-empty-state [compact]="true" illustration="empty-data" title="No categories yet" />
                      </li>
                    }
                  </ul>
                }
              } @else {
                <div class="text-center text-secondary py-4">
                  <i class="bi bi-hand-index fs-2 d-block mb-2 text-gold" aria-hidden="true"></i>
                  Select an industry to manage its categories.
                </div>
              }
            </div>
          </section>
        </div>
      </div>
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .min-w-0 { min-width: 0; }
      .ind { transition: border-color var(--an-dur) var(--an-ease), box-shadow var(--an-dur) var(--an-ease); }
      .ind.selected { border-color: var(--an-navy-700); box-shadow: 0 0 0 1px var(--an-navy-700), var(--an-shadow-2); }
      .ind.inactive { opacity: 0.75; }
      .ind-main { flex: 1 1 220px; min-width: 0; display: flex; align-items: center; gap: var(--an-space-3); background: none; border: 0;
        padding: 6px 4px; text-align: left; font: inherit; cursor: pointer; border-radius: 8px; min-height: 44px; }
      .ic { width: 44px; height: 44px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
        background: var(--an-navy-50); color: var(--an-navy-700); font-size: 1.3rem; }
      .ic.sm { width: 32px; height: 32px; font-size: 1rem; }
      .selected .ic { background: var(--an-navy-900); color: var(--an-gold-300); }
      @media (min-width: 1200px) { .cats { position: sticky; top: 84px; } }
    `,
  ],
})
export default class AdminTaxonomyComponent implements OnInit {
  private readonly taxonomy = inject(TaxonomyService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly modal = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly industries = signal<Industry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.industries().find((i) => i.id === this.selectedId()) ?? null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly catLoading = signal(false);

  protected icon(i: Industry): string {
    return biIcon(industryIcon(i));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.taxonomy
      .allIndustries()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => this.industries.set([...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))),
        error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))),
      });
  }

  select(i: Industry): void {
    this.selectedId.set(i.id);
    this.loadCategories(i.id);
  }

  private loadCategories(industryId: string): void {
    this.catLoading.set(true);
    this.taxonomy
      .categories(industryId)
      .pipe(finalize(() => this.catLoading.set(false)))
      .subscribe((cats) => this.categories.set(cats));
  }

  editIndustry(industry?: Industry): void {
    this.modal
      .open<IndustryDialogComponent, IndustryDialogData, Industry>(IndustryDialogComponent, { data: { industry } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.taxonomy.invalidate();
          this.load();
        }
      });
  }

  onToggleIndustry(i: Industry, event: Event): void {
    const input = event.target as HTMLInputElement;
    const active = input.checked;
    this.taxonomy.updateIndustry(i.id, { active }).subscribe({
      next: () => {
        this.taxonomy.invalidate();
        this.industries.update((list) => list.map((x) => (x.id === i.id ? { ...x, active } : x)));
        this.toast.success(`${i.name} ${active ? 'activated' : 'deactivated'}`);
      },
      error: () => (input.checked = !active),
    });
  }

  deleteIndustry(i: Industry): void {
    this.confirm
      .open({
        title: `Delete ${i.name}?`,
        message: 'Industries that are still used by jobs may be refused by the server — deactivate them instead.',
        confirmText: 'Delete',
        tone: 'danger',
      })
      .subscribe((r) => {
        if (!r) return;
        this.taxonomy.deleteIndustry(i.id).subscribe(() => {
          this.taxonomy.invalidate();
          this.industries.update((list) => list.filter((x) => x.id !== i.id));
          if (this.selectedId() === i.id) {
            this.selectedId.set(null);
            this.categories.set([]);
          }
          this.toast.success('Industry deleted');
        });
      });
  }

  editCategory(category?: Category): void {
    const industry = this.selected();
    if (!industry) return;
    this.modal
      .open<CategoryDialogComponent, CategoryDialogData, Category>(CategoryDialogComponent, { data: { industry, category } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.taxonomy.invalidate();
          this.loadCategories(industry.id);
        }
      });
  }

  onToggleCategory(c: Category, event: Event): void {
    const input = event.target as HTMLInputElement;
    const active = input.checked;
    this.taxonomy.updateCategory(c.id, { active }).subscribe({
      next: () => {
        this.taxonomy.invalidate();
        this.categories.update((list) => list.map((x) => (x.id === c.id ? { ...x, active } : x)));
        this.toast.success(`${c.name} ${active ? 'activated' : 'deactivated'}`);
      },
      error: () => (input.checked = !active),
    });
  }

  deleteCategory(c: Category): void {
    this.confirm.open({ title: `Delete ${c.name}?`, confirmText: 'Delete', tone: 'danger' }).subscribe((r) => {
      if (!r) return;
      this.taxonomy.deleteCategory(c.id).subscribe(() => {
        this.taxonomy.invalidate();
        this.categories.update((list) => list.filter((x) => x.id !== c.id));
        this.toast.success('Category deleted');
      });
    });
  }
}
