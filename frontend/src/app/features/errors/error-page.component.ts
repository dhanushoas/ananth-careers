import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IllustrationComponent, IllustrationName } from '../../shared/illustrations/illustration.component';

type Kind = 'not-found' | 'forbidden' | 'error';

const COPY: Record<Kind, { code: string; title: string; text: string; art: IllustrationName }> = {
  'not-found': {
    code: '404',
    title: 'We couldn’t find that page',
    text: 'The page may have moved, or the link might be out of date. Try searching for jobs or head back home.',
    art: 'not-found',
  },
  forbidden: {
    code: '403',
    title: 'You don’t have access to this page',
    text: 'This area is reserved for a different type of account. Sign in with the right account or return to your dashboard.',
    art: 'forbidden',
  },
  error: {
    code: '500',
    title: 'Something went wrong',
    text: 'An unexpected error occurred. Please try again in a moment.',
    art: 'error',
  },
};

@Component({
  selector: 'app-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IllustrationComponent],
  template: `
    <section class="wrap bg-blobs">
      <div class="container text-center inner">
        <app-illustration class="art" [name]="copy().art" />
        <span class="code">{{ copy().code }}</span>
        <h1>{{ copy().title }}</h1>
        <p class="text">{{ copy().text }}</p>
        <div class="d-flex flex-wrap justify-content-center gap-2 mt-3">
          @if (kind() === 'forbidden' && auth.isAuthenticated()) {
            <a class="btn btn-primary" [routerLink]="auth.homeUrl()"><i class="bi bi-speedometer2" aria-hidden="true"></i> Go to my dashboard</a>
          } @else if (kind() === 'forbidden') {
            <a class="btn btn-primary" routerLink="/auth/login"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Sign in</a>
          } @else {
            <a class="btn btn-primary" routerLink="/"><i class="bi bi-house" aria-hidden="true"></i> Back to home</a>
          }
          <a class="btn btn-gold" routerLink="/jobs"><i class="bi bi-search" aria-hidden="true"></i> Browse jobs</a>
          <button class="btn btn-outline-secondary" type="button" (click)="location.back()"><i class="bi bi-arrow-left" aria-hidden="true"></i> Go back</button>
        </div>
      </div>
    </section>
  `,
  styles: `
    .wrap { padding-block: var(--an-space-8); }
    .inner { position: relative; display: flex; flex-direction: column; align-items: center; }
    .art { width: min(320px, 80%); margin-bottom: var(--an-space-3); }
    .code { font-family: var(--an-font-heading); font-weight: 800; letter-spacing: 0.2em; color: var(--an-accent-ink); }
    .text { color: var(--an-text-2); max-width: 52ch; }
  `,
})
export default class ErrorPageComponent {
  readonly kind = input<Kind>('not-found');
  protected readonly auth = inject(AuthService);
  protected readonly location = inject(Location);
  protected readonly copy = computed(() => COPY[this.kind()] ?? COPY['not-found']);
}
