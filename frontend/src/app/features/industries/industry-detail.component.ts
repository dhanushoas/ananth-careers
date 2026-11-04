import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { JobsService } from '../../core/services/jobs.service';
import { toAppError } from '../../core/http/api-error';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { SectionDividerComponent } from '../../shared/illustrations/section-divider.component';
import { industryIcon } from '../../shared/utils/industry-icons';

@Component({
  selector: 'app-industry-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, JobCardComponent, SkeletonComponent, SectionDividerComponent],
  template: `
    @if (detail.isLoading()) {
      <div class="container section"><app-skeleton variant="lines" [count]="4" /></div>
    } @else if (detail.error()) {
      <div class="container section">
        <app-empty-state [tone]="notFound() ? 'neutral' : 'error'" [illustration]="notFound() ? 'not-found' : 'error'"
          [title]="notFound() ? 'Industry not found' : 'Industry could not be loaded'" message="Explore the full list of industries instead.">
          <a class="btn btn-primary" routerLink="/industries">All industries</a>
        </app-empty-state>
      </div>
    } @else if (detail.value(); as d) {
      <section class="hero-navy hero">
        <div class="container">
          <nav aria-label="Breadcrumb">
            <ol class="breadcrumb crumbs">
              <li class="breadcrumb-item"><a routerLink="/industries">Industries</a></li>
              <li class="breadcrumb-item active" aria-current="page">{{ d.industry.name }}</li>
            </ol>
          </nav>
          <div class="head">
            <span class="icon"><i [class]="'bi ' + icon()" aria-hidden="true"></i></span>
            <div class="min-w-0">
              <h1 class="m-0">{{ d.industry.name }}</h1>
              @if (d.industry.jobCount !== undefined) {
                <p class="count mb-0"><span class="badge text-bg-gold">{{ d.industry.jobCount }}</span> open {{ d.industry.jobCount === 1 ? 'position' : 'positions' }}</p>
              }
            </div>
          </div>
          @if (d.industry.description) {
            <p class="desc">{{ d.industry.description }}</p>
          }
        </div>
        <app-section-divider variant="wave" color="#f6f8fb" />
      </section>
      <div class="container section pt-3">
        @if (d.categories.length) {
          <h2 class="h5 mb-3">Categories</h2>
          <ul class="cats">
            @for (c of d.categories; track c.id) {
              @if (c.active !== false) {
                <li><a class="btn btn-sm btn-outline-primary rounded-pill" [routerLink]="['/jobs']" [queryParams]="{ industry: d.industry.slug, category: c.id }"><i class="bi bi-tag" aria-hidden="true"></i> {{ c.name }}</a></li>
              }
            }
          </ul>
        }
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <h2 class="h4 m-0">Latest opportunities in {{ d.industry.name }}</h2>
          <a class="btn btn-primary" [routerLink]="['/jobs']" [queryParams]="{ industry: d.industry.slug }">View all jobs <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
        </div>
        @if (jobs.isLoading()) {
          <app-skeleton variant="job-card" [count]="3" />
        } @else {
          <div class="grid">
            @for (j of jobs.value()?.items ?? []; track j.id) {
              <app-job-card [job]="j" />
            } @empty {
              <app-empty-state illustration="empty-jobs" title="No open jobs right now" message="Register with Veejee Services and our recruiters will contact you when a suitable role opens." />
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    .hero { padding-top: var(--an-space-5); }
    .crumbs { --bs-breadcrumb-divider-color: var(--an-on-dark-2); --bs-breadcrumb-item-active-color: var(--an-on-dark-2); font-size: 0.88rem; }
    .crumbs a { color: var(--an-gold-300); }
    .head { display: flex; align-items: center; gap: var(--an-space-4); }
    .icon { width: 68px; height: 68px; flex: none; border-radius: 18px; background: rgba(247, 130, 27, 0.16); color: var(--an-gold-300);
      display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; border: 1px solid rgba(247, 130, 27, 0.4); }
    .min-w-0 { min-width: 0; }
    h1 { overflow-wrap: anywhere; }
    .count { margin-top: 6px; color: var(--an-on-dark-2); }
    .desc { max-width: 70ch; margin: var(--an-space-4) 0 0; color: var(--an-on-dark-2); }
    .cats { list-style: none; padding: 0; margin: 0 0 var(--an-space-6); display: flex; flex-wrap: wrap; gap: var(--an-space-2); }
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
  `,
})
export default class IndustryDetailComponent {
  readonly slug = input.required<string>();
  private readonly taxonomy = inject(TaxonomyService);
  private readonly jobsApi = inject(JobsService);

  protected readonly detail = rxResource({ params: () => this.slug(), stream: ({ params }) => this.taxonomy.industry(params) });
  protected readonly jobs = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.jobsApi.search({ industry: params, limit: 6, sort: 'latest' }),
  });
  protected readonly icon = computed(() => {
    const d = this.detail.value();
    return d ? industryIcon(d.industry) : 'bi-briefcase';
  });
  protected readonly notFound = computed(() => toAppError(this.detail.error()).errorCode === 'NOT_FOUND');

  constructor() {
    const title = inject(Title);
    effect(() => {
      const d = this.detail.value();
      if (d) title.setTitle(`${d.industry.name} jobs | Veejee Services`);
    });
  }
}
