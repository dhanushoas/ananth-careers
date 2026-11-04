import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EmployersService } from '../../core/services/employers.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { Industry } from '../../core/models';
import { EmployerCardComponent } from '../../shared/components/employer-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

const boolAttr = (v: unknown): boolean => v === true || v === 'true';

@Component({
  selector: 'app-employers-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EmployerCardComponent, EmptyStateComponent, PageHeroComponent, PaginatorComponent, SkeletonComponent],
  template: `
    <app-page-hero eyebrow="Client companies" title="Our client companies" illustration="employers"
      subtitle="Verified companies that hire through Veejee Services. Candidates apply through us – we screen, shortlist and share profiles with consent." />
    <div class="container section pt-3">
      <form class="card filters" (ngSubmit)="search()" role="search" aria-label="Filter companies">
        <div class="card-body">
          <div class="row g-3 align-items-center">
            <div class="col-12 col-lg-5">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
                <div class="form-floating">
                  <input class="form-control" id="emp-q" [formControl]="qCtrl" placeholder=" " />
                  <label for="emp-q">Company name</label>
                </div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <div class="form-floating">
                <select class="form-select" id="emp-ind" [value]="industry() ?? ''" (change)="onIndustry($event)">
                  <option value="">All industries</option>
                  @for (i of industries(); track i.id) {
                    <option [value]="i.slug" [selected]="i.slug === industry()">{{ i.name }}</option>
                  }
                </select>
                <label for="emp-ind">Industry</label>
              </div>
            </div>
            <div class="col-7 col-md-3 col-lg-2">
              <div class="form-check form-switch m-0">
                <input class="form-check-input" type="checkbox" role="switch" id="emp-feat" [checked]="featured()" (change)="onFeatured($event)" />
                <label class="form-check-label" for="emp-feat">Featured only</label>
              </div>
            </div>
            <div class="col-5 col-md-3 col-lg-2 d-grid">
              <button class="btn btn-primary" type="submit"><i class="bi bi-search" aria-hidden="true"></i> Search</button>
            </div>
          </div>
        </div>
      </form>
      @if (employers.isLoading()) {
        <app-skeleton variant="card" [count]="6" />
      } @else if (employers.error()) {
        <app-empty-state tone="error" title="Companies could not be loaded" message="Please try again.">
          <button class="btn btn-primary" type="button" (click)="employers.reload()">Retry</button>
        </app-empty-state>
      } @else if (employers.value(); as res) {
        <p class="text-secondary mb-3" aria-live="polite"><strong class="text-body">{{ res.total }}</strong> {{ res.total === 1 ? 'company' : 'companies' }}</p>
        <div class="grid">
          @for (e of res.items; track e.id) {
            <app-employer-card [employer]="e" />
          } @empty {
            <app-empty-state illustration="empty-search" title="No companies found" message="Try removing a filter." />
          }
        </div>
        <app-paginator [page]="res.page" [limit]="res.limit" [total]="res.total" [pageSizeOptions]="[18]" (pageChange)="onPage($event)" />
      }
    </div>
  `,
  styles: `
    .filters { margin-bottom: var(--an-space-4); }
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
  `,
})
export default class EmployersListComponent {
  readonly q = input<string>();
  readonly industry = input<string>();
  readonly featured = input(false, { transform: boolAttr });
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly router = inject(Router);
  private readonly api = inject(EmployersService);
  protected readonly qCtrl = new FormControl('', { nonNullable: true });
  protected readonly industries = toSignal(inject(TaxonomyService).industries().pipe(catchError(() => of<Industry[]>([]))), {
    initialValue: [] as Industry[],
  });
  private readonly query = computed(() => ({
    q: this.q() || undefined,
    industry: this.industry() || undefined,
    featured: this.featured() || undefined,
    page: this.page(),
    limit: 18,
  }));
  protected readonly employers = rxResource({ params: () => this.query(), stream: ({ params }) => this.api.list(params) });

  constructor() {
    effect(() => this.qCtrl.setValue(this.q() ?? '', { emitEvent: false }));
  }

  search(): void {
    this.update({ q: this.qCtrl.value.trim() || null });
  }

  onIndustry(event: Event): void {
    this.update({ industry: (event.target as HTMLSelectElement).value || null });
  }

  onFeatured(event: Event): void {
    this.update({ featured: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  update(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: { ...params, page: null }, queryParamsHandling: 'merge' });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { queryParams: { page: e.page }, queryParamsHandling: 'merge' });
  }
}
