import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { ContentValue, ProcessContent } from '../../core/models';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { PROCESS_FALLBACK } from './content-fallbacks';
import { contentIcon } from './content-icons';

function asProcess(value: ContentValue | null | undefined): ProcessContent | null {
  const steps = value?.['steps'];
  if (!value || !Array.isArray(steps)) return null;
  const valid = steps.filter(
    (s): s is { icon?: string; title: string; body: string } =>
      typeof s === 'object' && s !== null && typeof (s as Record<string, unknown>)['title'] === 'string',
  );
  if (!valid.length) return null;
  return {
    title: typeof value['title'] === 'string' ? (value['title'] as string) : PROCESS_FALLBACK.title,
    intro: typeof value['intro'] === 'string' ? (value['intro'] as string) : PROCESS_FALLBACK.intro,
    steps: valid,
  };
}

/** /process – "How our recruitment process works" (content key `process`). */
@Component({
  selector: 'app-process-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeroComponent, SkeletonComponent, IllustrationComponent, RevealDirective],
  template: `
    <app-page-hero eyebrow="Our process" [title]="page().title || 'How our recruitment process works'" [subtitle]="page().intro" illustration="services" />

    <div class="container section pt-4">
      @if (content.isLoading()) {
        <app-skeleton variant="lines" [count]="6" />
      } @else {
        <ol class="timeline" aria-label="Recruitment process steps">
          @for (s of page().steps; track $index; let i = $index; let last = $last) {
            <li class="step" [class.last]="last" appReveal [appRevealDelay]="(i % 4) * 90">
              <div class="marker" aria-hidden="true">
                <span class="dot"><i [class]="'bi ' + icon(s.icon)"></i></span>
              </div>
              <div class="card card-hover body">
                <div class="card-body">
                  <span class="step-no">Step {{ i + 1 }}</span>
                  <h2 class="h5 mt-1 mb-1">{{ s.title }}</h2>
                  <p class="text-secondary mb-0">{{ s.body }}</p>
                </div>
              </div>
            </li>
          }
        </ol>

        <div class="dual">
          <div class="card cta-card" appReveal>
            <div class="card-body d-flex flex-wrap align-items-center gap-3">
              <app-illustration name="cta-seeker" class="cta-art" />
              <div class="grow">
                <h2 class="h5">Looking for a job?</h2>
                <p class="text-secondary small">Register free – our recruiters will match you with suitable requirements.</p>
                <a class="btn btn-primary" routerLink="/auth/register/candidate"><i class="bi bi-person-plus" aria-hidden="true"></i> Register as a candidate</a>
              </div>
            </div>
          </div>
          <div class="card cta-card emp" appReveal [appRevealDelay]="120">
            <div class="card-body d-flex flex-wrap align-items-center gap-3">
              <app-illustration name="cta-employer" class="cta-art" />
              <div class="grow">
                <h2 class="h5">Hiring?</h2>
                <p class="text-secondary small">Post a requirement and receive screened, consented candidates.</p>
                <a class="btn btn-gold" routerLink="/auth/register/employer"><i class="bi bi-building-add" aria-hidden="true"></i> Hire through Veejee Services</a>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .timeline { list-style: none; margin: 0 auto; padding: 0; max-width: 820px; }
    .step { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: var(--an-space-3); padding-bottom: var(--an-space-4); position: relative; }
    .step:not(.last)::before { content: ''; position: absolute; left: 27px; top: 56px; bottom: 0; border-left: 2px dashed var(--an-gold-300); }
    .dot { width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 1.4rem;
      background: linear-gradient(135deg, var(--an-navy-900), var(--an-navy-600)); color: var(--an-gold-300); box-shadow: var(--an-shadow-2); }
    .body { min-width: 0; }
    .step-no { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--an-accent-ink); }
    .dual { display: grid; gap: var(--an-space-4); margin-top: var(--an-space-6); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 992px) { .dual { grid-template-columns: 1fr 1fr; } }
    .cta-card { background: linear-gradient(135deg, #fff, var(--an-navy-50)); }
    .cta-card.emp { background: linear-gradient(135deg, #fff, var(--an-gold-100)); }
    .cta-art { width: 120px; flex: none; }
    .grow { flex: 1 1 220px; min-width: 0; }
  `,
})
export default class ProcessPageComponent {
  private readonly api = inject(ContentService);
  protected readonly content = rxResource({ stream: () => this.api.content('process') });
  protected readonly page = computed<ProcessContent>(() => asProcess(this.content.value()) ?? PROCESS_FALLBACK);

  protected icon(name: string | undefined): string {
    return contentIcon(name, 'bi-check2-circle');
  }
}
