import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page-header banner artwork (viewBox 240x180). Original flat SVG. */
@Component({
  selector: 'app-art-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 240 180" width="100%" focusable="false" aria-hidden="true">
      <path d="M40 40c30-34 120-36 158-6 34 27 30 92-6 116-40 26-122 24-152-8-26-28-24-74 0-102Z" fill="#E6ECF5" />
      <circle cx="206" cy="30" r="6" fill="#F7821B" />
      <circle cx="28" cy="140" r="4" fill="#C5D0E2" />
      @switch (name()) {
        @case ('about') {
          <circle cx="90" cy="74" r="15" fill="#FBB36B" /><path d="M64 136a26 26 0 0 1 52 0Z" fill="#0B2A5B" />
          <circle cx="150" cy="74" r="15" fill="#C5D0E2" /><path d="M124 136a26 26 0 0 1 52 0Z" fill="#2E5596" />
          <path d="M120 40l4 9 10 1-7.5 6.6 2.2 9.7L120 61l-8.7 5.3 2.2-9.7L106 50l10-1Z" fill="#F7821B" />
          <path d="M104 112h32" stroke="#F7821B" stroke-width="5" stroke-linecap="round" />
        }
        @case ('services') {
          @for (i of [0, 1, 2]; track i) {
            <rect [attr.x]="44 + i * 54" [attr.y]="60 - (i === 1 ? 14 : 0)" width="46" height="68" rx="10" [attr.fill]="i === 1 ? '#0B2A5B' : '#fff'" stroke="#C5D0E2" stroke-width="2" />
            <circle [attr.cx]="67 + i * 54" [attr.cy]="84 - (i === 1 ? 14 : 0)" r="10" [attr.fill]="i === 1 ? '#F7821B' : '#E6ECF5'" />
            <rect [attr.x]="54 + i * 54" [attr.y]="104 - (i === 1 ? 14 : 0)" width="26" height="5" rx="2.5" [attr.fill]="i === 1 ? '#FBB36B' : '#C5D0E2'" />
          }
        }
        @case ('industries') {
          @for (i of [0, 1, 2, 3]; track i) {
            <rect [attr.x]="62 + (i % 2) * 62" [attr.y]="40 + (i > 1 ? 54 : 0)" width="54" height="46" rx="10" [attr.fill]="i === 1 ? '#0B2A5B' : '#fff'" stroke="#C5D0E2" stroke-width="2" />
          }
          <path d="M78 70V56h22v14m-14-8h6" fill="none" stroke="#1D4380" stroke-width="3" />
          <circle cx="151" cy="63" r="9" fill="none" stroke="#FBB36B" stroke-width="3" /><path d="M151 54v-4m0 26v-4m9-9h4m-26 0h4" stroke="#FBB36B" stroke-width="3" />
          <path d="M80 126h20l-4-14H84Z" fill="#F7821B" />
          <path d="M142 128v-14l9-8 9 8v14Z" fill="#2E5596" />
        }
        @case ('employers') {
          <rect x="62" y="48" width="62" height="92" rx="6" fill="#0B2A5B" />
          @for (r of [0, 1, 2, 3]; track r) {
            <rect x="72" [attr.y]="58 + r * 18" width="14" height="10" rx="2" fill="#FBB36B" />
            <rect x="98" [attr.y]="58 + r * 18" width="14" height="10" rx="2" fill="#2E5596" />
          }
          <rect x="130" y="80" width="50" height="60" rx="6" fill="#2E5596" />
          <rect x="140" y="92" width="12" height="9" rx="2" fill="#C5D0E2" /><rect x="158" y="92" width="12" height="9" rx="2" fill="#C5D0E2" />
          <rect x="148" y="118" width="14" height="22" rx="2" fill="#F7821B" />
          <path d="M50 140h140" stroke="#1D4380" stroke-width="4" stroke-linecap="round" />
        }
        @case ('recruiters') {
          <path d="M60 104l28-18 22 12-28 20Z" fill="#FBB36B" />
          <path d="M180 104l-28-18-34 18 22 20Z" fill="#0B2A5B" />
          <path d="M110 98l18-8 12 10-20 12Z" fill="#F7821B" />
          <rect x="50" y="98" width="16" height="30" rx="4" fill="#2E5596" transform="rotate(-30 58 113)" />
          <rect x="174" y="98" width="16" height="30" rx="4" fill="#1D4380" transform="rotate(30 182 113)" />
          <circle cx="120" cy="54" r="14" fill="#fff" stroke="#F7821B" stroke-width="3" /><path d="m113 54 5 5 9-9" fill="none" stroke="#146C43" stroke-width="3" stroke-linecap="round" />
        }
        @case ('contact') {
          <rect x="58" y="62" width="94" height="66" rx="8" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="m60 66 45 34 45-34" fill="none" stroke="#0B2A5B" stroke-width="4" stroke-linejoin="round" />
          <path d="M172 40c-14 0-24 10-24 23 0 18 24 42 24 42s24-24 24-42c0-13-10-23-24-23Z" fill="#F7821B" />
          <circle cx="172" cy="63" r="8" fill="#0B2A5B" />
        }
        @case ('faq') {
          <path d="M54 46h78a10 10 0 0 1 10 10v38a10 10 0 0 1-10 10H84l-16 12v-12H54a10 10 0 0 1-10-10V56a10 10 0 0 1 10-10Z" fill="#0B2A5B" />
          <text x="93" y="88" text-anchor="middle" font-size="34" font-weight="800" fill="#FBB36B" font-family="sans-serif">?</text>
          <path d="M186 76h-46a8 8 0 0 0-8 8v30a8 8 0 0 0 8 8h28l12 10v-10h6a8 8 0 0 0 8-8V84a8 8 0 0 0-8-8Z" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="m150 100 8 8 16-16" fill="none" stroke="#146C43" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('policy') {
          <path d="M80 34h52l22 22v86a8 8 0 0 1-8 8H80a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8Z" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="M132 34v16a6 6 0 0 0 6 6h16" fill="#E6ECF5" />
          @for (r of [0, 1, 2, 3]; track r) {
            <rect x="86" [attr.y]="66 + r * 14" [attr.width]="56 - r * 8" height="6" rx="3" [attr.fill]="r === 0 ? '#1D4380' : '#E6ECF5'" />
          }
          <path d="M164 92l22 8v18c0 14-10 22-22 26-12-4-22-12-22-26v-18Z" fill="#F7821B" />
          <path d="m155 116 6 6 12-12" fill="none" stroke="#0B2A5B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('jobs') {
          <rect x="56" y="70" width="88" height="64" rx="10" fill="#0B2A5B" />
          <path d="M84 70v-9a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v9" fill="none" stroke="#0B2A5B" stroke-width="6" />
          <rect x="94" y="92" width="12" height="12" rx="3" fill="#F7821B" />
          <circle cx="160" cy="80" r="22" fill="#fff" stroke="#F7821B" stroke-width="6" />
          <path d="m176 96 16 16" stroke="#F7821B" stroke-width="8" stroke-linecap="round" />
        }
        @case ('company') {
          <rect x="44" y="52" width="152" height="40" rx="10" fill="#0B2A5B" />
          <path d="M44 80c40-16 90 12 152-6v8a10 10 0 0 1-10 10H54a10 10 0 0 1-10-10Z" fill="#1D4380" />
          <rect x="66" y="74" width="40" height="40" rx="10" fill="#fff" stroke="#F7821B" stroke-width="3" />
          <path d="M80 104V84h12v20" fill="none" stroke="#0B2A5B" stroke-width="3" />
          <rect x="116" y="102" width="60" height="7" rx="3.5" fill="#1D4380" /><rect x="116" y="116" width="40" height="6" rx="3" fill="#C5D0E2" />
        }
        @case ('dashboard-seeker') {
          <circle cx="86" cy="70" r="16" fill="#FBB36B" /><path d="M58 138a28 28 0 0 1 56 0Z" fill="#0B2A5B" />
          <rect x="124" y="52" width="70" height="86" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="m134 72 5 5 9-10m-14 30 5 5 9-10m-14 30 5 5 9-10" fill="none" stroke="#146C43" stroke-width="3" stroke-linecap="round" />
          <rect x="154" y="70" width="30" height="5" rx="2.5" fill="#C5D0E2" /><rect x="154" y="95" width="24" height="5" rx="2.5" fill="#C5D0E2" /><rect x="154" y="120" width="28" height="5" rx="2.5" fill="#F7821B" />
        }
        @case ('dashboard-employer') {
          <rect x="48" y="50" width="144" height="92" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="48" y="50" width="144" height="18" rx="9" fill="#0B2A5B" />
          @for (b of [28, 44, 36, 58, 50]; track $index) {
            <rect [attr.x]="64 + $index * 22" [attr.y]="130 - b" width="12" [attr.height]="b" rx="3" [attr.fill]="$index === 3 ? '#F7821B' : '#2E5596'" />
          }
          <path d="M66 96l22-12 22 8 22-18 22 6 22-16" fill="none" stroke="#FBB36B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('dashboard-admin') {
          <path d="M120 34l44 16v34c0 28-20 46-44 56-24-10-44-28-44-56V50Z" fill="#0B2A5B" />
          <path d="M120 50l30 11v23c0 19-13 31-30 38-17-7-30-19-30-38V61Z" fill="#1D4380" />
          <circle cx="120" cy="82" r="14" fill="none" stroke="#F7821B" stroke-width="4" />
          <path d="M120 64v6m0 24v6m-18-18h6m24 0h6" stroke="#F7821B" stroke-width="4" stroke-linecap="round" />
        }
        @case ('settings') {
          <circle cx="104" cy="92" r="36" fill="#0B2A5B" />
          <circle cx="104" cy="92" r="14" fill="#E6ECF5" />
          @for (a of [0, 45, 90, 135, 180, 225, 270, 315]; track a) {
            <rect x="98" y="48" width="12" height="14" rx="3" fill="#0B2A5B" [attr.transform]="'rotate(' + a + ' 104 92)'" />
          }
          <circle cx="164" cy="70" r="18" fill="#F7821B" /><circle cx="164" cy="70" r="7" fill="#FEF0E3" />
        }
        @case ('notifications') {
          <path d="M112 46a28 28 0 0 1 28 28v24l10 14H74l10-14V74a28 28 0 0 1 28-28Z" fill="#0B2A5B" />
          <path d="M100 118a12 12 0 0 0 24 0" fill="#F7821B" />
          <circle cx="146" cy="56" r="14" fill="#F7821B" /><text x="146" y="61" text-anchor="middle" font-size="14" font-weight="800" fill="#0B2A5B" font-family="sans-serif">3</text>
          <path d="M170 92c6 6 6 18 0 24M178 84c10 10 10 30 0 40" fill="none" stroke="#C5D0E2" stroke-width="4" stroke-linecap="round" />
        }
        @case ('profile') {
          <rect x="62" y="44" width="116" height="96" rx="12" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="62" y="44" width="116" height="30" rx="12" fill="#0B2A5B" />
          <circle cx="92" cy="76" r="16" fill="#FBB36B" stroke="#fff" stroke-width="4" />
          <rect x="74" y="104" width="54" height="7" rx="3.5" fill="#1D4380" /><rect x="74" y="118" width="80" height="6" rx="3" fill="#E6ECF5" />
          <rect x="138" y="86" width="28" height="10" rx="5" fill="#F7821B" />
        }
        @case ('resumes') {
          <rect x="70" y="46" width="72" height="92" rx="8" fill="#C5D0E2" transform="rotate(-8 106 92)" />
          <path d="M96 40h44l18 18v78a8 8 0 0 1-8 8H96a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8Z" fill="#fff" stroke="#0B2A5B" stroke-width="2" />
          <rect x="98" y="62" width="34" height="6" rx="3" fill="#1D4380" /><rect x="98" y="76" width="46" height="5" rx="2.5" fill="#E6ECF5" /><rect x="98" y="88" width="40" height="5" rx="2.5" fill="#E6ECF5" />
          <rect x="98" y="112" width="30" height="16" rx="4" fill="#B42318" /><text x="113" y="124" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="sans-serif">PDF</text>
        }
        @case ('interviews') {
          <rect x="52" y="54" width="88" height="80" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="52" y="54" width="88" height="20" rx="10" fill="#0B2A5B" />
          <rect x="70" y="88" width="16" height="14" rx="3" fill="#F7821B" /><rect x="94" y="88" width="16" height="14" rx="3" fill="#E6ECF5" /><rect x="70" y="108" width="16" height="14" rx="3" fill="#E6ECF5" />
          <circle cx="164" cy="104" r="28" fill="#0B2A5B" /><path d="M164 88v16l11 7" fill="none" stroke="#FBB36B" stroke-width="4" stroke-linecap="round" />
        }
        @case ('team') {
          @for (p of [0, 1, 2]; track p) {
            <circle [attr.cx]="80 + p * 40" [attr.cy]="p === 1 ? 70 : 80" r="13" [attr.fill]="p === 1 ? '#FBB36B' : '#C5D0E2'" />
            <path [attr.d]="'M' + (58 + p * 40) + ' 136a22 22 0 0 1 44 0Z'" [attr.fill]="p === 1 ? '#0B2A5B' : '#2E5596'" />
          }
          <path d="M70 52c20-16 80-16 100 0" fill="none" stroke="#F7821B" stroke-width="3" stroke-dasharray="5 5" />
        }
        @case ('analytics') {
          <circle cx="96" cy="92" r="38" fill="#2E5596" />
          <path d="M96 54a38 38 0 0 1 38 38H96Z" fill="#F7821B" />
          <path d="M96 92 66 116a38 38 0 0 1-8-24Z" fill="#FBB36B" />
          <circle cx="96" cy="92" r="16" fill="#E6ECF5" />
          <path d="M146 130V100m14 30V84m14 46v-38m14 38V70" stroke="#0B2A5B" stroke-width="9" stroke-linecap="round" />
        }
        @case ('applications') {
          @for (i of [0, 1, 2]; track i) {
            <rect [attr.x]="56 + i * 10" [attr.y]="52 + i * 22" width="120" height="30" rx="8" [attr.fill]="i === 2 ? '#0B2A5B' : '#fff'" stroke="#C5D0E2" stroke-width="2" />
            <circle [attr.cx]="72 + i * 10" [attr.cy]="67 + i * 22" r="7" [attr.fill]="i === 2 ? '#FBB36B' : '#C5D0E2'" />
            <rect [attr.x]="86 + i * 10" [attr.y]="64 + i * 22" width="44" height="6" rx="3" [attr.fill]="i === 2 ? '#C5D0E2' : '#E6ECF5'" />
            <rect [attr.x]="146 + i * 10" [attr.y]="62 + i * 22" width="22" height="10" rx="5" [attr.fill]="i === 2 ? '#F7821B' : '#E3F4EA'" />
          }
        }
        @case ('moderation') {
          <rect x="54" y="48" width="96" height="88" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <path d="m66 70 5 5 9-10" fill="none" stroke="#146C43" stroke-width="3" stroke-linecap="round" /><rect x="88" y="66" width="48" height="6" rx="3" fill="#E6ECF5" />
          <path d="m66 96 10 10m0-10-10 10" stroke="#B42318" stroke-width="3" stroke-linecap="round" /><rect x="88" y="98" width="40" height="6" rx="3" fill="#E6ECF5" />
          <rect x="66" y="118" width="10" height="10" rx="2" fill="#FBB36B" /><rect x="88" y="120" width="44" height="6" rx="3" fill="#E6ECF5" />
          <path d="M166 72l20 7v16c0 13-9 21-20 25-11-4-20-12-20-25V79Z" fill="#0B2A5B" />
          <path d="m158 96 6 6 10-11" fill="none" stroke="#F7821B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('content') {
          <rect x="54" y="46" width="112" height="92" rx="10" fill="#fff" stroke="#C5D0E2" stroke-width="2" />
          <rect x="66" y="60" width="50" height="8" rx="4" fill="#1D4380" />
          <rect x="66" y="78" width="88" height="5" rx="2.5" fill="#E6ECF5" /><rect x="66" y="90" width="76" height="5" rx="2.5" fill="#E6ECF5" />
          <rect x="66" y="104" width="40" height="22" rx="4" fill="#FBB36B" />
          <path d="m166 70 16 16-40 40-20 4 4-20Z" fill="#0B2A5B" /><path d="m172 76 10 10" stroke="#F7821B" stroke-width="4" />
        }
        @default {
          <rect x="70" y="56" width="100" height="74" rx="10" fill="#0B2A5B" />
          <rect x="84" y="72" width="44" height="7" rx="3.5" fill="#FBB36B" /><rect x="84" y="88" width="70" height="6" rx="3" fill="#2E5596" />
        }
      }
    </svg>
  `,
  styles: `:host { display: block; } svg { display: block; width: 100%; height: auto; }`,
})
export class ArtBannerComponent {
  readonly name = input.required<string>();
}
