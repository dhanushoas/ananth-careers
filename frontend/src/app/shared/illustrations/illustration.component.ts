import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ArtAuthComponent } from './art-auth.component';
import { ArtBannerComponent } from './art-banner.component';
import { ArtEmptyComponent } from './art-empty.component';
import { ArtMarketingComponent } from './art-marketing.component';

/** Every illustration name available to pages. Implementations are original inline SVG. */
export const ILLUSTRATIONS = [
  // empty / status states
  'empty-generic', 'empty-jobs', 'empty-search', 'empty-applications', 'empty-interviews', 'empty-resumes',
  'empty-notifications', 'empty-messages', 'empty-saved', 'empty-candidates', 'empty-team', 'empty-data',
  'error', 'not-found', 'forbidden', 'pending-approval', 'success',
  // page header banners
  'about', 'services', 'industries', 'employers', 'recruiters', 'contact', 'faq', 'policy', 'jobs', 'company',
  'dashboard-seeker', 'dashboard-employer', 'dashboard-admin', 'settings', 'notifications', 'profile', 'resumes',
  'interviews', 'team', 'analytics', 'applications', 'moderation', 'content',
  // auth
  'auth-login', 'auth-register', 'auth-register-seeker', 'auth-register-employer', 'auth-verify-success',
  'auth-verify-fail', 'auth-password', 'auth-invite',
  // marketing
  'hero-home', 'cta-seeker', 'cta-employer', 'trust-shield', 'step-profile', 'step-resume', 'step-apply', 'step-hired',
] as const;
export type IllustrationName = (typeof ILLUSTRATIONS)[number];

type Group = 'empty' | 'banner' | 'auth' | 'marketing';

const EMPTY_GROUP: ReadonlySet<string> = new Set([
  'empty-generic', 'empty-jobs', 'empty-search', 'empty-applications', 'empty-interviews', 'empty-resumes',
  'empty-notifications', 'empty-messages', 'empty-saved', 'empty-candidates', 'empty-team', 'empty-data',
  'error', 'not-found', 'forbidden', 'pending-approval', 'success',
]);
const MARKETING_GROUP: ReadonlySet<string> = new Set([
  'hero-home', 'cta-seeker', 'cta-employer', 'trust-shield', 'step-profile', 'step-resume', 'step-apply', 'step-hired',
]);

export function illustrationGroup(name: IllustrationName): Group {
  if (EMPTY_GROUP.has(name)) return 'empty';
  if (MARKETING_GROUP.has(name)) return 'marketing';
  if (name.startsWith('auth-')) return 'auth';
  return 'banner';
}

let instanceSeq = 0;

/**
 * Decorative, original inline-SVG artwork (navy/gold/white). Always aria-hidden.
 * Size it with CSS on the host (it fills its width and keeps aspect ratio).
 * Gradient ids are suffixed per instance so multiple illustrations can share a page.
 */
@Component({
  selector: 'app-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArtEmptyComponent, ArtBannerComponent, ArtAuthComponent, ArtMarketingComponent],
  host: { 'aria-hidden': 'true', class: 'app-illustration' },
  template: `
    @switch (group()) {
      @case ('empty') { <app-art-empty [name]="name()" /> }
      @case ('auth') { <app-art-auth [name]="name()" [uid]="uid" /> }
      @case ('marketing') { <app-art-marketing [name]="name()" [uid]="uid" /> }
      @default { <app-art-banner [name]="name()" /> }
    }
  `,
  styles: `:host { display: block; line-height: 0; } :host ::ng-deep svg { display: block; width: 100%; height: auto; }`,
})
export class IllustrationComponent {
  readonly name = input.required<IllustrationName>();
  protected readonly uid = `i${++instanceSeq}`;
  protected readonly group = computed(() => illustrationGroup(this.name()));
}
