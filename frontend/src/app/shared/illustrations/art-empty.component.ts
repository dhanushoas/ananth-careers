import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Empty / status-state artwork (viewBox 240x180). Original flat SVG. */
@Component({
  selector: 'app-art-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 240 180" width="100%" focusable="false" aria-hidden="true">
      <ellipse cx="120" cy="166" rx="84" ry="8" fill="#E6ECF5" />
      <circle cx="120" cy="86" r="66" fill="#F3F6FB" />
      <circle cx="196" cy="34" r="5" fill="#FBB36B" />
      <circle cx="40" cy="58" r="4" fill="#C5D0E2" />
      @switch (name()) {
        @case ('empty-jobs') {
          <rect x="70" y="62" width="100" height="74" rx="10" fill="#0B2A5B" />
          <path d="M100 62v-10a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v10" fill="none" stroke="#0B2A5B" stroke-width="7" />
          <rect x="70" y="88" width="100" height="6" fill="#1D4380" />
          <rect x="112" y="84" width="16" height="14" rx="3" fill="#F7821B" />
          <circle cx="178" cy="126" r="16" fill="#fff" stroke="#C5D0E2" stroke-width="3" />
          <path d="M171 126h14" stroke="#2E5596" stroke-width="3" stroke-linecap="round" />
        }
        @case ('empty-search') {
          <rect x="62" y="54" width="92" height="78" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="74" y="68" width="50" height="7" rx="3.5" fill="#E6ECF5" />
          <rect x="74" y="84" width="66" height="7" rx="3.5" fill="#E6ECF5" />
          <rect x="74" y="100" width="40" height="7" rx="3.5" fill="#E6ECF5" />
          <circle cx="150" cy="98" r="26" fill="#fff" stroke="#0B2A5B" stroke-width="8" />
          <path d="m169 117 20 20" stroke="#0B2A5B" stroke-width="10" stroke-linecap="round" />
          <path d="m142 90 16 16m0-16-16 16" stroke="#F7821B" stroke-width="4" stroke-linecap="round" />
        }
        @case ('empty-applications') {
          <rect x="66" y="40" width="84" height="104" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="90" y="32" width="36" height="16" rx="6" fill="#0B2A5B" />
          <path d="m80 72 6 6 10-12m-16 30 6 6 10-12m-16 30 6 6 10-12" fill="none" stroke="#F7821B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="104" y="70" width="34" height="6" rx="3" fill="#E6ECF5" />
          <rect x="104" y="94" width="28" height="6" rx="3" fill="#E6ECF5" />
          <rect x="104" y="118" width="32" height="6" rx="3" fill="#E6ECF5" />
          <circle cx="168" cy="118" r="20" fill="#F7821B" />
          <path d="M168 108v20m-10-10h20" stroke="#0B2A5B" stroke-width="4" stroke-linecap="round" />
        }
        @case ('empty-interviews') {
          <rect x="64" y="50" width="112" height="92" rx="12" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="M64 62a12 12 0 0 1 12-12h88a12 12 0 0 1 12 12v12H64Z" fill="#0B2A5B" />
          <path d="M92 42v18m56-18v18" stroke="#F7821B" stroke-width="6" stroke-linecap="round" />
          @for (r of [0, 1]; track r) {
            @for (c of [0, 1, 2, 3]; track c) {
              <rect [attr.x]="78 + c * 22" [attr.y]="86 + r * 24" width="14" height="14" rx="3" [attr.fill]="r === 1 && c === 2 ? '#F7821B' : '#E6ECF5'" />
            }
          }
        }
        @case ('empty-resumes') {
          <path d="M78 34h56l26 26v82a8 8 0 0 1-8 8H78a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8Z" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="M134 34v20a6 6 0 0 0 6 6h20" fill="#E6ECF5" />
          <circle cx="100" cy="70" r="11" fill="#FBB36B" />
          <rect x="118" y="64" width="28" height="6" rx="3" fill="#1D4380" />
          <rect x="84" y="94" width="62" height="6" rx="3" fill="#E6ECF5" />
          <rect x="84" y="108" width="54" height="6" rx="3" fill="#E6ECF5" />
          <rect x="84" y="122" width="44" height="6" rx="3" fill="#E6ECF5" />
          <circle cx="164" cy="128" r="18" fill="#0B2A5B" />
          <path d="M164 136v-15m-7 7 7-7 7 7" fill="none" stroke="#FBB36B" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('empty-notifications') {
          <path d="M120 40a30 30 0 0 1 30 30v26l10 16H80l10-16V70a30 30 0 0 1 30-30Z" fill="#0B2A5B" />
          <path d="M108 120a12 12 0 0 0 24 0" fill="#F7821B" />
          <rect x="116" y="32" width="8" height="10" rx="4" fill="#0B2A5B" />
          <path d="M164 56c6 5 8 12 8 18M76 56c-6 5-8 12-8 18" fill="none" stroke="#C5D0E2" stroke-width="4" stroke-linecap="round" />
          <text x="170" y="48" font-size="18" font-weight="700" fill="#F7821B" font-family="sans-serif">z</text>
          <text x="182" y="36" font-size="13" font-weight="700" fill="#FBB36B" font-family="sans-serif">z</text>
        }
        @case ('empty-messages') {
          <path d="M60 52h82a10 10 0 0 1 10 10v40a10 10 0 0 1-10 10H92l-18 14v-14H60a10 10 0 0 1-10-10V62a10 10 0 0 1 10-10Z" fill="#0B2A5B" />
          <circle cx="80" cy="82" r="5" fill="#FBB36B" /><circle cx="100" cy="82" r="5" fill="#FBB36B" /><circle cx="120" cy="82" r="5" fill="#FBB36B" />
          <path d="M178 84h-58a8 8 0 0 0-8 8v30a8 8 0 0 0 8 8h36l14 11v-11h8a8 8 0 0 0 8-8V92a8 8 0 0 0-8-8Z" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="124" y="100" width="44" height="6" rx="3" fill="#C5D0E2" />
          <rect x="124" y="112" width="30" height="6" rx="3" fill="#E6ECF5" />
        }
        @case ('empty-saved') {
          <rect x="70" y="56" width="86" height="80" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="82" y="72" width="44" height="7" rx="3.5" fill="#1D4380" />
          <rect x="82" y="88" width="60" height="6" rx="3" fill="#E6ECF5" />
          <rect x="82" y="102" width="50" height="6" rx="3" fill="#E6ECF5" />
          <path d="M140 40h36v62l-18-12-18 12Z" fill="#F7821B" />
          <path d="m158 52 4 8 9 1-6.5 6 1.6 9-8.1-4.3-8.1 4.3 1.6-9-6.5-6 9-1Z" fill="#fff" />
        }
        @case ('empty-candidates') {
          @for (p of [0, 1, 2]; track p) {
            <g [attr.transform]="'translate(' + (62 + p * 42) + ' ' + (p === 1 ? 46 : 62) + ')'">
              <rect width="36" height="62" rx="10" [attr.fill]="p === 1 ? '#0B2A5B' : '#fff'" stroke="#C5D0E2" stroke-width="2" />
              <circle cx="18" cy="20" r="9" [attr.fill]="p === 1 ? '#FBB36B' : '#C5D0E2'" />
              <path d="M7 50a11 11 0 0 1 22 0" [attr.fill]="p === 1 ? '#F7821B' : '#E6ECF5'" />
            </g>
          }
          <circle cx="174" cy="126" r="16" fill="#fff" stroke="#0B2A5B" stroke-width="5" />
          <path d="m185 137 10 10" stroke="#0B2A5B" stroke-width="6" stroke-linecap="round" />
        }
        @case ('empty-team') {
          <circle cx="120" cy="70" r="16" fill="#FBB36B" />
          <path d="M94 128a26 26 0 0 1 52 0Z" fill="#0B2A5B" />
          <circle cx="80" cy="84" r="12" fill="#C5D0E2" />
          <path d="M60 130a20 20 0 0 1 40 0Z" fill="#2E5596" />
          <circle cx="160" cy="84" r="12" fill="none" stroke="#F7821B" stroke-width="3" stroke-dasharray="5 4" />
          <path d="M140 130a20 20 0 0 1 40 0" fill="none" stroke="#F7821B" stroke-width="3" stroke-dasharray="5 4" />
          <path d="M160 79v10m-5-5h10" stroke="#F7821B" stroke-width="3" stroke-linecap="round" />
        }
        @case ('empty-data') {
          <rect x="58" y="46" width="124" height="94" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="58" y="46" width="124" height="20" rx="10" fill="#0B2A5B" />
          @for (r of [0, 1, 2]; track r) {
            <rect x="70" [attr.y]="78 + r * 18" width="30" height="8" rx="4" fill="#E6ECF5" />
            <rect x="108" [attr.y]="78 + r * 18" width="62" height="8" rx="4" fill="#F3F6FB" stroke="#E6ECF5" />
          }
          <circle cx="180" cy="132" r="14" fill="#F7821B" />
          <path d="M174 132h12" stroke="#0B2A5B" stroke-width="3" stroke-linecap="round" />
        }
        @case ('error') {
          <path d="M120 38 176 134H64Z" fill="#FDECEA" stroke="#B42318" stroke-width="5" stroke-linejoin="round" />
          <rect x="116" y="70" width="8" height="34" rx="4" fill="#B42318" />
          <circle cx="120" cy="118" r="5" fill="#B42318" />
          <path d="M44 120c10-6 16 6 26 0M170 54c8-5 14 5 22 0" fill="none" stroke="#C5D0E2" stroke-width="3" stroke-linecap="round" />
        }
        @case ('not-found') {
          <path d="M120 38c-20 0-36 15-36 35 0 26 36 61 36 61s36-35 36-61c0-20-16-35-36-35Z" fill="#0B2A5B" />
          <text x="120" y="84" text-anchor="middle" font-size="30" font-weight="800" fill="#FBB36B" font-family="sans-serif">?</text>
          <path d="M60 148c20-14 40 6 60-6s40 4 60-8" fill="none" stroke="#F7821B" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round" />
        }
        @case ('forbidden') {
          <rect x="82" y="78" width="76" height="60" rx="10" fill="#0B2A5B" />
          <path d="M96 78V64a24 24 0 0 1 48 0v14" fill="none" stroke="#C5D0E2" stroke-width="9" />
          <circle cx="120" cy="102" r="8" fill="#FBB36B" />
          <rect x="117" y="104" width="6" height="18" rx="3" fill="#FBB36B" />
        }
        @case ('pending-approval') {
          <circle cx="120" cy="86" r="44" fill="#fff" stroke="#0B2A5B" stroke-width="6" />
          <path d="M120 58v28l18 12" fill="none" stroke="#F7821B" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="120" cy="86" r="5" fill="#0B2A5B" />
          <circle cx="168" cy="126" r="16" fill="#FEF0E3" stroke="#F7821B" stroke-width="2" />
          <path d="M162 126h3m4 0h3m4 0h1" stroke="#B85A00" stroke-width="3" stroke-linecap="round" />
        }
        @case ('success') {
          <circle cx="120" cy="86" r="46" fill="#E3F4EA" />
          <circle cx="120" cy="86" r="32" fill="#146C43" />
          <path d="m104 86 11 11 22-22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M60 50l6 6m110-6-6 6M58 120l8-2m116 2-8-2" stroke="#F7821B" stroke-width="3" stroke-linecap="round" />
        }
        @default {
          <rect x="74" y="58" width="92" height="76" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="M74 84h26l6 10h28l6-10h26" fill="none" stroke="#C5D0E2" stroke-width="2" />
          <path d="M74 84v40a10 10 0 0 0 10 10h72a10 10 0 0 0 10-10V84h-26l-6 10h-28l-6-10Z" fill="#0B2A5B" />
          <rect x="88" y="66" width="40" height="6" rx="3" fill="#FBB36B" />
        }
      }
    </svg>
  `,
  styles: `:host { display: block; } svg { display: block; width: 100%; height: auto; }`,
})
export class ArtEmptyComponent {
  readonly name = input.required<string>();
}
