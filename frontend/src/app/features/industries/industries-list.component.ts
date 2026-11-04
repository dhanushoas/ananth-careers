import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { IndustryCardComponent } from '../../shared/components/industry-card.component';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';

@Component({
  selector: 'app-industries-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IndustryCardComponent, PageHeroComponent, SkeletonComponent, RevealDirective],
  template: `
    <app-page-hero eyebrow="Industries" title="Industries we serve" illustration="industries"
      subtitle="Veejee Services recruits for client companies across these sectors – for freshers and experienced professionals alike.">
      <div class="search mt-4" role="search">
        <div class="input-group input-group-lg">
          <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
          <input class="form-control" type="search" placeholder="Filter industries" aria-label="Filter industries"
            [value]="filter()" (input)="onFilter($event)" />
        </div>
      </div>
    </app-page-hero>
    <div class="container section pt-4">
      @if (industries.isLoading()) {
        <app-skeleton variant="card" [count]="8" />
      } @else if (industries.error()) {
        <app-empty-state tone="error" title="Industries could not be loaded" message="Please check your connection and try again.">
          <button class="btn btn-primary" type="button" (click)="industries.reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
        </app-empty-state>
      } @else {
        <div class="grid">
          @for (i of filtered(); track i.id; let idx = $index) {
            <app-industry-card [industry]="i" appReveal [appRevealDelay]="(idx % 6) * 60" />
          } @empty {
            <app-empty-state illustration="empty-search" title="No industries match" message="Try a different search term." />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .search { max-width: 480px; }
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); }
  `,
})
export default class IndustriesListComponent {
  private readonly taxonomy = inject(TaxonomyService);
  protected readonly filter = signal('');
  onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected readonly industries = rxResource({ stream: () => this.taxonomy.industries() });
  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const list = [...(this.industries.value() ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return q ? list.filter((i) => i.name.toLowerCase().includes(q)) : list;
  });
}
