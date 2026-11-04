import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface PageChange {
  page: number;
  limit: number;
}

/** Bootstrap pagination with the API's 1-based `page` / `limit` semantics. */
@Component({
  selector: 'app-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <nav class="d-flex flex-wrap align-items-center justify-content-between gap-3" aria-label="Pagination">
        <p class="small text-secondary mb-0">
          Showing {{ from() }}–{{ to() }} of {{ total() }}
        </p>
        <div class="d-flex flex-wrap align-items-center gap-2">
          @if (pageSizeOptions().length > 1) {
            <label class="visually-hidden" for="page-size-{{ uid }}">Items per page</label>
            <select class="form-select form-select-sm w-auto" id="page-size-{{ uid }}" [value]="limit()" (change)="onSize($event)">
              @for (s of pageSizeOptions(); track s) {
                <option [value]="s" [selected]="s === limit()">{{ s }} / page</option>
              }
            </select>
          }
          @if (pages() > 1) {
            <ul class="pagination mb-0">
              <li class="page-item" [class.disabled]="page() <= 1">
                <button type="button" class="page-link" (click)="go(page() - 1)" [disabled]="page() <= 1" aria-label="Previous page">
                  <i class="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
              </li>
              @for (p of windowPages(); track $index) {
                @if (p === 0) {
                  <li class="page-item disabled d-none d-sm-block"><span class="page-link">…</span></li>
                } @else {
                  <li class="page-item" [class.active]="p === page()" [class.d-none]="p !== page()" [class.d-sm-block]="true">
                    <button type="button" class="page-link" (click)="go(p)" [attr.aria-current]="p === page() ? 'page' : null"
                      [attr.aria-label]="'Page ' + p">{{ p }}</button>
                  </li>
                }
              }
              <li class="page-item" [class.disabled]="page() >= pages()">
                <button type="button" class="page-link" (click)="go(page() + 1)" [disabled]="page() >= pages()" aria-label="Next page">
                  <i class="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
              </li>
            </ul>
          }
        </div>
      </nav>
    }
  `,
  styles: `:host { display: block; margin-top: var(--an-space-4); }`,
})
export class PaginatorComponent {
  private static seq = 0;
  protected readonly uid = ++PaginatorComponent.seq;
  readonly page = input(1);
  readonly limit = input(20);
  readonly total = input(0);
  readonly pageSizeOptions = input([10, 20, 50]);
  readonly pageChange = output<PageChange>();

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.limit()))));
  protected readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.limit() + 1));
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.limit()));
  /** Page numbers with 0 as an ellipsis marker. */
  protected readonly windowPages = computed(() => {
    const total = this.pages();
    const current = this.page();
    const set = new Set<number>([1, total, current - 1, current, current + 1]);
    const list = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out: number[] = [];
    list.forEach((p, i) => {
      if (i > 0 && p - list[i - 1] > 1) out.push(0);
      out.push(p);
    });
    return out;
  });

  go(p: number): void {
    if (p >= 1 && p <= this.pages() && p !== this.page()) {
      this.pageChange.emit({ page: p, limit: this.limit() });
    }
  }

  onSize(event: Event): void {
    const limit = Number((event.target as HTMLSelectElement).value);
    this.pageChange.emit({ page: 1, limit });
  }
}
