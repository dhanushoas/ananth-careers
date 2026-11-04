import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { AudienceContent, ContentValue } from '../../core/models';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { IllustrationComponent, IllustrationName } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { AUDIENCE_FALLBACK } from './content-fallbacks';
import { contentIcon } from './content-icons';

type AudienceKey = 'job-seekers' | 'employers';

interface Step {
  icon: string;
  title: string;
  body: string;
}

function asAudience(value: ContentValue | null | undefined): AudienceContent | null {
  const benefits = value?.['benefits'];
  if (!value || !Array.isArray(benefits) || !benefits.length) return null;
  const valid = benefits.filter(
    (b): b is { icon?: string; title: string; body: string } =>
      typeof b === 'object' && b !== null && typeof (b as Record<string, unknown>)['title'] === 'string',
  );
  if (!valid.length) return null;
  const steps = Array.isArray(value['steps']) ? (value['steps'] as AudienceContent['steps']) : undefined;
  return {
    title: typeof value['title'] === 'string' ? (value['title'] as string) : undefined,
    intro: typeof value['intro'] === 'string' ? (value['intro'] as string) : undefined,
    benefits: valid,
    steps,
  };
}

/** /job-seekers and /for-employers – content keys `job-seekers` / `employers`. */
@Component({
  selector: 'app-audience-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeroComponent, SkeletonComponent, IllustrationComponent, RevealDirective],
  template: `
    <app-page-hero
      [eyebrow]="isSeeker() ? 'For job seekers' : 'For employers'"
      [title]="page().title || (isSeeker() ? 'Register once. We do the matching.' : 'Screened candidates for every requirement')"
      [subtitle]="page().intro"
      [illustration]="isSeeker() ? 'cta-seeker' : 'cta-employer'"
    >
      <div class="d-flex flex-wrap gap-2 mt-4">
        @if (isSeeker()) {
          <a class="btn btn-gold btn-lg" routerLink="/auth/register/candidate"><i class="bi bi-person-plus" aria-hidden="true"></i> Register as a candidate</a>
          <a class="btn btn-outline-light btn-lg" routerLink="/jobs"><i class="bi bi-search" aria-hidden="true"></i> Browse job opportunities</a>
        } @else {
          <a class="btn btn-gold btn-lg" routerLink="/auth/register/employer"><i class="bi bi-building-add" aria-hidden="true"></i> Hire through Veejee Services</a>
          <a class="btn btn-outline-light btn-lg" routerLink="/contact" [queryParams]="{ type: 'employer' }"><i class="bi bi-chat-dots" aria-hidden="true"></i> Talk to our team</a>
        }
      </div>
    </app-page-hero>

    <div class="container section pt-4">
      @if (content.isLoading()) {
        <app-skeleton variant="card" [count]="4" />
      } @else {
        <section aria-labelledby="benefits-title">
          <h2 id="benefits-title" class="h3 mb-4 text-center">{{ isSeeker() ? 'Why register with Veejee Services' : 'Why hire through Veejee Services' }}</h2>
          <div class="benefits">
            @for (b of page().benefits; track b.title; let i = $index) {
              <article class="card card-hover benefit" appReveal [appRevealDelay]="i * 80">
                <div class="card-body">
                  <span class="b-icon"><i [class]="'bi ' + icon(b.icon)" aria-hidden="true"></i></span>
                  <h3 class="h6 mt-3 mb-1">{{ b.title }}</h3>
                  <p class="small text-secondary mb-0">{{ b.body }}</p>
                </div>
              </article>
            }
          </div>
        </section>

        @if (steps().length) {
          <section class="steps-wrap section-alt bg-dots" aria-labelledby="steps-title">
            <div class="steps-grid">
              <app-illustration [name]="art()" class="steps-art d-none d-lg-block" appReveal />
              <div>
                <span class="eyebrow">How it works</span>
                <h2 id="steps-title" class="h3 mb-4">{{ isSeeker() ? 'Your journey with us' : 'Hiring with Veejee Services' }}</h2>
                <ol class="steps">
                  @for (s of steps(); track $index; let i = $index) {
                    <li appReveal [appRevealDelay]="i * 90">
                      <span class="num" aria-hidden="true">{{ i + 1 }}</span>
                      <div>
                        <h3 class="h6 mb-1">{{ s.title }}</h3>
                        @if (s.body) {
                          <p class="small text-secondary mb-0">{{ s.body }}</p>
                        }
                      </div>
                    </li>
                  }
                </ol>
              </div>
            </div>
          </section>
        }

        <aside class="consent hero-navy" appReveal>
          <i class="bi bi-shield-lock c-icon" aria-hidden="true"></i>
          <div class="grow">
            <h2 class="h5 mb-1">{{ isSeeker() ? 'Your profile, your consent' : 'Consent-based recruitment' }}</h2>
            <p class="mb-0">
              @if (isSeeker()) {
                Companies never browse our database. We share your profile only for suitable roles, and only when you agree.
              } @else {
                You receive candidates who have been screened by our recruiters and who agreed to share their profile with you.
              }
            </p>
          </div>
          <a class="btn btn-gold" routerLink="/process">How our process works <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
        </aside>
      }
    </div>
  `,
  styles: `
    .benefits { display: grid; gap: var(--an-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
    .b-icon { width: 52px; height: 52px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;
      font-size: 1.4rem; background: linear-gradient(135deg, var(--an-navy-900), var(--an-navy-600)); color: var(--an-gold-300); }
    .steps-wrap { margin: var(--an-space-7) calc(-1 * var(--an-gutter)); padding: var(--an-space-6) var(--an-gutter); }
    .steps-grid { display: grid; gap: var(--an-space-6); align-items: center; grid-template-columns: minmax(0, 1fr); max-width: var(--an-container); margin: 0 auto; }
    @media (min-width: 992px) { .steps-grid { grid-template-columns: 320px minmax(0, 1fr); } }
    .steps-art { width: 100%; }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--an-space-4); }
    .steps li { display: flex; gap: var(--an-space-3); align-items: flex-start; }
    .num { flex: none; width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-gold-500); color: var(--an-navy-950); font-weight: 800; }
    .consent { display: flex; flex-wrap: wrap; align-items: center; gap: var(--an-space-4); padding: var(--an-space-5); border-radius: var(--an-radius-xl); }
    .c-icon { font-size: 2.2rem; color: var(--an-gold-300); }
    .grow { flex: 1 1 260px; min-width: 0; }
  `,
})
export default class AudiencePageComponent {
  /** From route data. */
  readonly contentKey = input.required<AudienceKey>();
  private readonly api = inject(ContentService);

  protected readonly isSeeker = computed(() => this.contentKey() === 'job-seekers');
  protected readonly art = computed<IllustrationName>(() => (this.isSeeker() ? 'profile' : 'company'));
  protected readonly content = rxResource({ params: () => this.contentKey(), stream: ({ params }) => this.api.content(params) });
  protected readonly page = computed<AudienceContent>(
    () => asAudience(this.content.value()) ?? AUDIENCE_FALLBACK[this.contentKey()],
  );
  protected readonly steps = computed<Step[]>(() =>
    (this.page().steps ?? AUDIENCE_FALLBACK[this.contentKey()].steps ?? []).map((s) =>
      typeof s === 'string' ? { icon: '', title: s, body: '' } : { icon: s.icon ?? '', title: s.title, body: s.body ?? '' },
    ),
  );

  constructor() {
    const title = inject(Title);
    effect(() => title.setTitle(`${this.isSeeker() ? 'For Job Seekers' : 'For Employers'} | Veejee Services`));
  }

  protected icon(name: string | undefined): string {
    return contentIcon(name);
  }
}
