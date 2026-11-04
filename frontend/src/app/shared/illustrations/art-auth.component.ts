import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Auth page artwork (viewBox 360x300), designed for dark navy panels and light compact headers. */
@Component({
  selector: 'app-art-auth',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 360 300" width="100%" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gid()" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F7821B" />
          <stop offset="1" stop-color="#FBB36B" />
        </linearGradient>
      </defs>
      <circle cx="290" cy="64" r="54" [attr.fill]="fill()" opacity="0.22" />
      <circle cx="56" cy="250" r="38" fill="#2E5596" opacity="0.45" />
      <circle cx="320" cy="250" r="6" fill="#FBB36B" />
      <circle cx="40" cy="60" r="5" fill="#F7821B" />
      @switch (name()) {
        @case ('auth-login') {
          <rect x="70" y="70" width="190" height="150" rx="18" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <circle cx="165" cy="112" r="20" [attr.fill]="fill()" />
          <path d="M165 104v8m0 0" stroke="#0B2A5B" stroke-width="5" stroke-linecap="round" />
          <rect x="100" y="146" width="130" height="16" rx="8" fill="#1D4380" />
          <rect x="100" y="172" width="130" height="16" rx="8" fill="#1D4380" />
          <circle cx="114" cy="180" r="3" fill="#C5D0E2" /><circle cx="124" cy="180" r="3" fill="#C5D0E2" /><circle cx="134" cy="180" r="3" fill="#C5D0E2" />
          <g class="float">
            <rect x="222" y="168" width="70" height="56" rx="10" fill="#fff" />
            <path d="M240 168v-12a17 17 0 0 1 34 0v12" fill="none" stroke="#fff" stroke-width="7" />
            <circle cx="257" cy="192" r="7" fill="#0B2A5B" /><rect x="254" y="194" width="6" height="14" rx="3" fill="#0B2A5B" />
          </g>
        }
        @case ('auth-register') {
          <g class="float">
            <rect x="60" y="80" width="110" height="140" rx="16" fill="#fff" />
            <circle cx="115" cy="122" r="20" fill="#FBB36B" /><path d="M85 186a30 30 0 0 1 60 0Z" fill="#0B2A5B" />
          </g>
          <rect x="190" y="60" width="110" height="160" rx="16" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <rect x="214" y="90" width="62" height="70" rx="6" fill="#1D4380" />
          <rect x="224" y="100" width="16" height="12" rx="2" [attr.fill]="fill()" /><rect x="250" y="100" width="16" height="12" rx="2" fill="#C5D0E2" />
          <rect x="224" y="122" width="16" height="12" rx="2" fill="#C5D0E2" /><rect x="250" y="122" width="16" height="12" rx="2" [attr.fill]="fill()" />
          <rect x="214" y="176" width="62" height="12" rx="6" [attr.fill]="fill()" />
          <path d="M170 150h20" stroke="#FBB36B" stroke-width="3" stroke-dasharray="4 4" />
        }
        @case ('auth-register-seeker') {
          <g class="float">
            <circle cx="140" cy="110" r="30" fill="#FBB36B" />
            <path d="M92 216a48 48 0 0 1 96 0Z" fill="#fff" />
          </g>
          <path d="M160 222h40" stroke="#2E5596" stroke-width="3" />
          <rect x="200" y="70" width="104" height="132" rx="14" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <rect x="216" y="88" width="50" height="8" rx="4" [attr.fill]="fill()" />
          <rect x="216" y="106" width="72" height="6" rx="3" fill="#2E5596" /><rect x="216" y="120" width="60" height="6" rx="3" fill="#2E5596" />
          <rect x="216" y="142" width="28" height="14" rx="7" fill="#C5D0E2" /><rect x="250" y="142" width="34" height="14" rx="7" fill="#C5D0E2" />
          <rect x="216" y="172" width="72" height="16" rx="8" [attr.fill]="fill()" />
          <path d="M234 46l4 9 10 1-7.5 6.6 2.2 9.7-8.7-5.3-8.7 5.3 2.2-9.7L220 56l10-1Z" fill="#FBB36B" />
        }
        @case ('auth-register-employer') {
          <rect x="70" y="80" width="90" height="150" rx="8" fill="#123570" stroke="#2E5596" stroke-width="2" />
          @for (r of [0, 1, 2, 3, 4]; track r) {
            <rect x="86" [attr.y]="98 + r * 24" width="20" height="14" rx="3" [attr.fill]="r % 2 ? '#2E5596' : fill()" />
            <rect x="124" [attr.y]="98 + r * 24" width="20" height="14" rx="3" [attr.fill]="r % 2 ? fill() : '#2E5596'" />
          }
          <rect x="170" y="140" width="70" height="90" rx="8" fill="#1D4380" />
          <rect x="192" y="196" width="26" height="34" rx="3" [attr.fill]="fill()" />
          <path d="M50 232h270" stroke="#2E5596" stroke-width="4" stroke-linecap="round" />
          <g class="float">
            <rect x="236" y="70" width="80" height="58" rx="12" fill="#fff" />
            <path d="m256 99 10 10 20-20" fill="none" stroke="#146C43" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          </g>
        }
        @case ('auth-verify-success') {
          <rect x="80" y="90" width="200" height="130" rx="14" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <path d="m84 96 96 70 96-70" fill="none" stroke="#2E5596" stroke-width="4" stroke-linejoin="round" />
          <g class="float">
            <circle cx="250" cy="96" r="36" fill="#146C43" stroke="#E3F4EA" stroke-width="6" />
            <path d="m234 96 11 11 22-22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
          </g>
        }
        @case ('auth-verify-fail') {
          <rect x="80" y="90" width="200" height="130" rx="14" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <path d="m84 96 96 70 96-70" fill="none" stroke="#2E5596" stroke-width="4" stroke-linejoin="round" />
          <g class="float">
            <circle cx="250" cy="96" r="36" fill="#B42318" stroke="#FDECEA" stroke-width="6" />
            <path d="m236 82 28 28m0-28-28 28" stroke="#fff" stroke-width="7" stroke-linecap="round" />
          </g>
        }
        @case ('auth-password') {
          <circle cx="160" cy="150" r="64" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <circle cx="140" cy="140" r="26" fill="none" [attr.stroke]="fill()" stroke-width="12" />
          <path d="m158 158 56 56m-18-18 14-14m-30-2 12-12" [attr.stroke]="fill()" stroke-width="12" stroke-linecap="round" />
          <g class="float">
            <rect x="226" y="70" width="88" height="40" rx="20" fill="#fff" />
            @for (d of [0, 1, 2, 3]; track d) {
              <circle [attr.cx]="246 + d * 16" cy="90" r="5" fill="#0B2A5B" />
            }
          </g>
        }
        @case ('auth-invite') {
          <rect x="70" y="100" width="210" height="130" rx="14" [attr.fill]="fill()" />
          <path d="M70 114l105 70 105-70" fill="none" stroke="#B85A00" stroke-width="3" />
          <g class="float">
            <rect x="100" y="56" width="150" height="110" rx="12" fill="#fff" />
            <circle cx="175" cy="92" r="16" fill="#0B2A5B" /><path d="M150 140a25 25 0 0 1 50 0Z" fill="#2E5596" />
            <circle cx="232" cy="72" r="12" fill="#F7821B" /><path d="M232 66v12m-6-6h12" stroke="#0B2A5B" stroke-width="3" stroke-linecap="round" />
          </g>
        }
        @default {
          <rect x="80" y="80" width="200" height="140" rx="16" fill="#123570" stroke="#2E5596" stroke-width="2" />
          <rect x="104" y="108" width="90" height="12" rx="6" [attr.fill]="fill()" />
          <rect x="104" y="132" width="150" height="10" rx="5" fill="#2E5596" />
        }
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; }
    .float { animation: art-float 6s ease-in-out infinite; transform-box: fill-box; }
    @keyframes art-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    @media (prefers-reduced-motion: reduce) { .float { animation: none; } }
  `,
})
export class ArtAuthComponent {
  readonly name = input.required<string>();
  readonly uid = input.required<string>();
  protected readonly gid = computed(() => `aa-g-${this.uid()}`);
  protected readonly fill = computed(() => `url(#${this.gid()})`);
}
