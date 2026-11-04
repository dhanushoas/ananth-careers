import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { EmployersService } from '../../core/services/employers.service';
import { toAppError } from '../../core/http/api-error';
import { CompanyLogoComponent } from '../../shared/components/company-logo.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';

@Component({
  selector: 'app-employer-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CompanyLogoComponent, EmptyStateComponent, JobCardComponent, SkeletonComponent, IllustrationComponent],
  template: `
    @if (profile.isLoading()) {
      <div class="container section"><app-skeleton variant="lines" [count]="5" /></div>
    } @else if (profile.error()) {
      <div class="container section">
        <app-empty-state [tone]="notFound() ? 'neutral' : 'error'" [illustration]="notFound() ? 'not-found' : 'error'"
          [title]="notFound() ? 'Company not found' : 'Company could not be loaded'" message="The company may no longer be listed on Veejee Services.">
          <a class="btn btn-primary" routerLink="/employers">All companies</a>
        </app-empty-state>
      </div>
    } @else if (profile.value(); as p) {
      @let e = p.employer;
      <section class="cover hero-navy" aria-hidden="true">
        <app-illustration name="company" class="cover-art d-none d-md-block" />
      </section>
      <div class="container">
        <div class="card head-card">
          <div class="card-body head">
            <app-company-logo class="logo" [employerId]="e.id" [hasLogo]="e.hasLogo" [name]="e.companyName" [size]="96" />
            <div class="info">
              <h1 class="h2 mb-2">{{ e.companyName }} <i class="bi bi-patch-check-fill text-info fs-4" aria-label="Verified client company" title="Verified client company"></i></h1>
              <ul class="facts">
                @if (e.industry; as ind) { <li><i class="bi bi-grid" aria-hidden="true"></i>{{ ind.name }}</li> }
                @if (e.headquarters) { <li><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ e.headquarters }}</li> }
                @if (e.size) { <li><i class="bi bi-people" aria-hidden="true"></i>{{ e.size }} employees</li> }
                @if (e.foundedYear) { <li><i class="bi bi-calendar3" aria-hidden="true"></i>Founded {{ e.foundedYear }}</li> }
              </ul>
            </div>
            @if (safeWebsite(); as site) {
              <a class="btn btn-outline-primary site" [href]="site" target="_blank" rel="noopener noreferrer">
                Visit website <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
              </a>
            }
          </div>
        </div>
      </div>
      <div class="container section layout">
        <aside class="aside">
          <div class="card">
            <div class="card-body">
              <h2 class="h5"><i class="bi bi-building text-gold" aria-hidden="true"></i> About {{ e.companyName }}</h2>
              <p class="prose mb-0">{{ e.description || 'This company has not added a description yet.' }}</p>
            </div>
          </div>
          <div class="card mt-3 stat">
            <div class="card-body d-flex align-items-center gap-3">
              <span class="tile"><i class="bi bi-briefcase" aria-hidden="true"></i></span>
              <div><strong class="fs-4 d-block">{{ p.jobs.length }}</strong><span class="text-secondary small">open requirements</span></div>
            </div>
          </div>
        </aside>
        <section>
          <h2 class="h4 mb-1">Open requirements</h2>
          <p class="text-secondary small mb-3">Apply through Veejee Services – our recruiters review every application before profiles are shared with the company.</p>
          <div class="grid">
            @for (j of p.jobs; track j.id) {
              <app-job-card [job]="j" />
            } @empty {
              <app-empty-state illustration="empty-jobs" title="No open positions right now" message="Check back soon — this company posts new roles regularly." />
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .cover { height: 150px; position: relative; overflow: hidden; }
    @media (min-width: 768px) { .cover { height: 190px; } }
    .cover-art { position: absolute; right: 6%; bottom: -10px; width: 220px; opacity: 0.9; }
    .head-card { margin-top: -64px; position: relative; z-index: 1; box-shadow: var(--an-shadow-3); }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--an-space-4); }
    .logo { border: 4px solid #fff; border-radius: 18px; box-shadow: var(--an-shadow-2); }
    .info { flex: 1 1 260px; min-width: 0; }
    h1 { overflow-wrap: anywhere; }
    .facts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--an-space-2) var(--an-space-4); color: var(--an-text-2); }
    .facts li { display: inline-flex; align-items: center; gap: 6px; }
    .facts .bi { color: var(--an-gold-600); }
    .layout { display: grid; gap: var(--an-space-5); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 992px) { .layout { grid-template-columns: 340px minmax(0, 1fr); align-items: start; } .aside { position: sticky; top: calc(var(--an-header-h) + 16px); } }
    .tile { width: 48px; height: 48px; border-radius: 12px; background: var(--an-gold-100); color: var(--an-gold-700); display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; }
    .grid { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
  `,
})
export default class EmployerProfileComponent {
  readonly slug = input.required<string>();
  private readonly api = inject(EmployersService);
  protected readonly profile = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.bySlug(params) });
  protected readonly notFound = computed(() => toAppError(this.profile.error()).errorCode === 'NOT_FOUND');
  protected readonly safeWebsite = computed(() => {
    const w = this.profile.value()?.employer.website;
    return w && /^https?:\/\//i.test(w) ? w : null;
  });

  constructor() {
    const title = inject(Title);
    effect(() => {
      const p = this.profile.value();
      if (p) title.setTitle(`${p.employer.companyName} – Careers | Veejee Services`);
    });
  }
}
