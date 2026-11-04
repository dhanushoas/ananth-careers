import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Marketing artwork: homepage hero, CTAs, trust shield and process steps. */
@Component({
  selector: 'app-art-marketing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (name()) {
      @case ('hero-home') {
        <svg viewBox="0 0 520 420" width="100%" focusable="false" aria-hidden="true">
          <defs>
            <linearGradient [attr.id]="gid('gold')" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#F7821B" /><stop offset="1" stop-color="#FBB36B" />
            </linearGradient>
            <radialGradient [attr.id]="gid('glow')" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stop-color="#F7821B" stop-opacity="0.35" /><stop offset="1" stop-color="#F7821B" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="300" cy="200" r="190" [attr.fill]="url('glow')" />
          <circle cx="260" cy="210" r="150" fill="none" stroke="#2E5596" stroke-width="1.5" stroke-dasharray="4 8" />
          <!-- company building -->
          <g class="f2">
            <rect x="210" y="120" width="110" height="200" rx="10" fill="#123570" stroke="#2E5596" stroke-width="2" />
            @for (r of [0, 1, 2, 3, 4, 5]; track r) {
              @for (c of [0, 1, 2]; track c) {
                <rect [attr.x]="226 + c * 30" [attr.y]="140 + r * 26" width="18" height="14" rx="3"
                  [attr.fill]="(r + c) % 4 === 0 ? url('gold') : '#1D4380'" />
              }
            }
            <rect x="250" y="286" width="30" height="34" rx="4" [attr.fill]="url('gold')" />
            <path d="M200 320h130" stroke="#2E5596" stroke-width="5" stroke-linecap="round" />
          </g>
          <!-- connection lines -->
          <path d="M138 128C180 128 190 160 210 170M138 300c40 0 50-30 72-40M380 96c-30 10-40 40-60 50M396 286c-30 0-46-20-76-26"
            fill="none" stroke="#FBB36B" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round" />
          <circle cx="210" cy="170" r="5" fill="#FBB36B" /><circle cx="210" cy="260" r="5" fill="#FBB36B" />
          <circle cx="320" cy="146" r="5" fill="#FBB36B" /><circle cx="320" cy="260" r="5" fill="#FBB36B" />
          <!-- candidate card 1 -->
          <g class="f1">
            <rect x="20" y="86" width="130" height="84" rx="14" fill="#fff" />
            <circle cx="50" cy="116" r="15" fill="#FBB36B" /><path d="M34 146a16 16 0 0 1 32 0Z" fill="#0B2A5B" />
            <rect x="76" y="106" width="58" height="8" rx="4" fill="#0B2A5B" /><rect x="76" y="122" width="40" height="6" rx="3" fill="#C5D0E2" />
            <rect x="76" y="138" width="44" height="14" rx="7" fill="#E3F4EA" /><path d="m84 145 4 4 7-7" fill="none" stroke="#146C43" stroke-width="2.5" stroke-linecap="round" />
          </g>
          <!-- candidate card 2 -->
          <g class="f3">
            <rect x="20" y="258" width="130" height="84" rx="14" fill="#fff" />
            <circle cx="50" cy="288" r="15" fill="#C5D0E2" /><path d="M34 318a16 16 0 0 1 32 0Z" fill="#2E5596" />
            <rect x="76" y="278" width="52" height="8" rx="4" fill="#0B2A5B" /><rect x="76" y="294" width="46" height="6" rx="3" fill="#C5D0E2" />
            <rect x="76" y="310" width="54" height="14" rx="7" fill="#FEF0E3" /><path d="m84 317 3 3 3-6 3 6 3-3" fill="none" stroke="#B85A00" stroke-width="2" />
          </g>
          <!-- job card -->
          <g class="f3">
            <rect x="372" y="50" width="130" height="92" rx="14" fill="#fff" />
            <rect x="386" y="64" width="34" height="34" rx="9" fill="#0B2A5B" />
            <path d="M396 90V79a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v11" fill="none" stroke="#FBB36B" stroke-width="3" />
            <rect x="428" y="68" width="60" height="8" rx="4" fill="#0B2A5B" /><rect x="428" y="84" width="40" height="6" rx="3" fill="#C5D0E2" />
            <rect x="386" y="112" width="102" height="16" rx="8" [attr.fill]="url('gold')" />
          </g>
          <!-- match card -->
          <g class="f1">
            <rect x="388" y="236" width="116" height="100" rx="14" fill="#fff" />
            <circle cx="446" cy="272" r="22" fill="#E3F4EA" />
            <path d="m435 272 8 8 15-15" fill="none" stroke="#146C43" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
            <rect x="410" y="304" width="72" height="8" rx="4" fill="#0B2A5B" /><rect x="420" y="318" width="52" height="6" rx="3" fill="#C5D0E2" />
          </g>
          <circle cx="470" cy="190" r="7" fill="#FBB36B" /><circle cx="180" cy="60" r="5" fill="#F7821B" /><circle cx="170" cy="380" r="6" fill="#2E5596" />
        </svg>
      }
      @case ('cta-seeker') {
        <svg viewBox="0 0 240 180" width="100%" focusable="false" aria-hidden="true">
          <circle cx="120" cy="96" r="70" fill="#FEF0E3" />
          <circle cx="100" cy="70" r="20" fill="#FBB36B" /><path d="M64 156a36 36 0 0 1 72 0Z" fill="#0B2A5B" />
          <rect x="132" y="70" width="70" height="52" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="M150 70v-7a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v7" fill="none" stroke="#0B2A5B" stroke-width="4" />
          <rect x="161" y="88" width="12" height="10" rx="2" fill="#F7821B" />
          <path d="M190 40l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#F7821B" />
        </svg>
      }
      @case ('cta-employer') {
        <svg viewBox="0 0 240 180" width="100%" focusable="false" aria-hidden="true">
          <circle cx="120" cy="96" r="70" fill="#E6ECF5" />
          <rect x="54" y="52" width="66" height="104" rx="6" fill="#0B2A5B" />
          @for (r of [0, 1, 2, 3]; track r) {
            <rect x="66" [attr.y]="64 + r * 20" width="14" height="10" rx="2" fill="#FBB36B" /><rect x="94" [attr.y]="64 + r * 20" width="14" height="10" rx="2" fill="#2E5596" />
          }
          @for (p of [0, 1, 2]; track p) {
            <circle [attr.cx]="142 + p * 24" cy="104" r="9" [attr.fill]="p === 1 ? '#F7821B' : '#C5D0E2'" />
            <path [attr.d]="'M' + (128 + p * 24) + ' 140a14 14 0 0 1 28 0Z'" [attr.fill]="p === 1 ? '#0B2A5B' : '#2E5596'" />
          }
          <path d="M126 156h96" stroke="#1D4380" stroke-width="4" stroke-linecap="round" />
        </svg>
      }
      @case ('trust-shield') {
        <svg viewBox="0 0 200 200" width="100%" focusable="false" aria-hidden="true">
          <circle cx="100" cy="100" r="86" fill="#FEF0E3" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#FBB36B" stroke-width="2" stroke-dasharray="4 6" />
          <path d="M100 36l52 18v40c0 34-24 56-52 68-28-12-52-34-52-68V54Z" fill="#0B2A5B" />
          <path d="M100 54l36 12v28c0 24-16 40-36 48-20-8-36-24-36-48V66Z" fill="#1D4380" />
          <rect x="84" y="94" width="32" height="26" rx="5" fill="#F7821B" />
          <path d="M90 94v-8a10 10 0 0 1 20 0v8" fill="none" stroke="#F7821B" stroke-width="5" />
          <circle cx="100" cy="106" r="4" fill="#0B2A5B" />
        </svg>
      }
      @default {
        <svg viewBox="0 0 120 120" width="100%" focusable="false" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="#FEF0E3" />
          <circle cx="60" cy="60" r="40" fill="#0B2A5B" />
          @switch (name()) {
            @case ('step-profile') {
              <circle cx="60" cy="50" r="11" fill="#FBB36B" /><path d="M40 82a20 20 0 0 1 40 0Z" fill="#fff" />
              <circle cx="84" cy="38" r="9" fill="#F7821B" /><path d="M84 33v10m-5-5h10" stroke="#0B2A5B" stroke-width="2.5" stroke-linecap="round" />
            }
            @case ('step-resume') {
              <path d="M46 34h20l10 10v38a4 4 0 0 1-4 4H46a4 4 0 0 1-4-4V38a4 4 0 0 1 4-4Z" fill="#fff" />
              <rect x="48" y="50" width="20" height="4" rx="2" fill="#C5D0E2" /><rect x="48" y="60" width="22" height="4" rx="2" fill="#C5D0E2" />
              <circle cx="78" cy="78" r="11" fill="#F7821B" /><path d="M78 83v-10m-4 4 4-4 4 4" fill="none" stroke="#0B2A5B" stroke-width="2.5" stroke-linecap="round" />
            }
            @case ('step-apply') {
              <path d="m36 60 50-22-14 50-10-18Z" fill="#fff" /><path d="m62 70 24-32" stroke="#C5D0E2" stroke-width="2" />
              <path d="m62 70 10 18 14-50Z" fill="#FBB36B" />
            }
            @default {
              <path d="M38 64l14-10 10 6-14 10Z" fill="#FBB36B" /><path d="M82 64 68 54 54 62l10 10Z" fill="#fff" />
              <path d="M58 60l8-4 6 5-9 5Z" fill="#F7821B" />
              <path d="M60 30l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1Z" fill="#F7821B" />
            }
          }
        </svg>
      }
    }
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; }
    .f1, .f2, .f3 { transform-box: fill-box; }
    .f1 { animation: mk-float 7s ease-in-out infinite; }
    .f2 { animation: mk-float 9s ease-in-out infinite reverse; }
    .f3 { animation: mk-float 8s ease-in-out 1s infinite; }
    @keyframes mk-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @media (prefers-reduced-motion: reduce) { .f1, .f2, .f3 { animation: none; } }
  `,
})
export class ArtMarketingComponent {
  readonly name = input.required<string>();
  readonly uid = input.required<string>();
  protected readonly prefix = computed(() => `mk-${this.uid()}`);

  gid(key: string): string {
    return `${this.prefix()}-${key}`;
  }

  url(key: string): string {
    return `url(#${this.gid(key)})`;
  }
}
