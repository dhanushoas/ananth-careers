import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Veejee Services logo: the official image (`public/brand/veejee-logo.png`) with a text-wordmark
 * fallback if the file is missing. On dark backgrounds (`light`) the image sits on a white chip.
 */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a routerLink="/" class="brand" [class.light]="light()" [class.compact]="compact()" aria-label="Veejee Services – Your Recruitment Partner, home">
      @if (!imgFailed()) {
        <span class="img-wrap">
          <img
            src="brand/veejee-logo.png"
            alt="Veejee Services – Your Recruitment Partner"
            [style.height.px]="height()"
            (error)="imgFailed.set(true)"
            decoding="async"
          />
        </span>
      } @else {
        <span class="word" aria-hidden="true">
          <span class="name"><span class="v">Veejee</span><span class="s">Services</span></span>
          @if (showTagline()) {
            <span class="tagline">Your Recruitment Partner</span>
          }
        </span>
      }
    </a>
  `,
  styles: `
    .brand { display: inline-flex; align-items: center; text-decoration: none; min-height: 44px; }
    .img-wrap { display: inline-flex; align-items: center; }
    img { display: block; width: auto; max-width: min(220px, 52vw); object-fit: contain; }
    .light .img-wrap { background: #fff; border-radius: 10px; padding: 4px 10px; }
    .word { display: flex; flex-direction: column; line-height: 1.05; }
    .name { font-family: var(--an-font-heading); font-weight: 800; font-size: 1.35rem; letter-spacing: -0.01em; }
    .v { color: var(--an-navy-900); }
    .s { color: var(--an-gold-600); }
    .light .v { color: #fff; }
    .light .s { color: var(--an-gold-300); }
    .tagline { font-size: 0.68rem; letter-spacing: 0.03em; color: var(--an-text-muted); white-space: nowrap; }
    .light .tagline { color: var(--an-on-dark-2); }
    @media (max-width: 399.98px) { .tagline { display: none; } }
  `,
})
export class BrandLogoComponent {
  readonly light = input(false);
  readonly showTagline = input(true);
  readonly compact = input(false);
  /** Rendered logo height in px. */
  readonly height = input(44);
  protected readonly imgFailed = signal(false);
}
