import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { ContentValue, FaqContent, PolicyContent } from '../../core/models';
import { PageHeroComponent } from '../../shared/components/page-hero.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { IllustrationComponent, IllustrationName } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { FALLBACK_CONTENT, PAGE_TITLES, PageKey } from './content-fallbacks';

const ART: Record<PageKey, IllustrationName> = {
  about: 'about',
  services: 'services',
  faq: 'faq',
  privacy: 'policy',
  terms: 'policy',
  refund: 'policy',
};

const SUBTITLES: Record<PageKey, string> = {
  about: 'Your recruitment partner – connecting screened candidates with client companies across India.',
  services: 'End-to-end recruitment services for candidates and companies.',
  faq: 'Quick answers about registration, consent, shortlisting and interviews.',
  privacy: 'How we collect, use and protect your personal data.',
  terms: 'The rules for using the Veejee Services platform.',
  refund: 'Our policy on refunds for paid services.',
};

/** Value cards shown on About and service cards on Services (static marketing structure). */
const VALUES = [
  { icon: 'bi-shield-check', title: 'Consent first', text: 'Profiles are shared with companies only with the candidate’s consent.' },
  { icon: 'bi-people', title: 'People-centred', text: 'Candidates and companies get real human support.' },
  { icon: 'bi-lightning-charge', title: 'Transparent progress', text: 'Clear status updates from registration to placement.' },
  { icon: 'bi-lock', title: 'Privacy by design', text: 'Encrypted resumes and full control over your data.' },
];
const SERVICES = [
  { icon: 'bi-person-badge', title: 'Candidate registration', text: 'Free profiles and resume hosting for freshers and experienced professionals.' },
  { icon: 'bi-search', title: 'Screening & shortlisting', text: 'Recruiters review profiles and shortlist candidates for each requirement.' },
  { icon: 'bi-bullseye', title: 'Requirement matching', text: 'Transparent match scores across skills, experience, location and salary.' },
  { icon: 'bi-calendar2-check', title: 'Interview coordination', text: 'We schedule in-person, phone and video interviews for companies and candidates.' },
  { icon: 'bi-building-check', title: 'Company requirements', text: 'Verified companies post requirements and receive consented, screened profiles.' },
  { icon: 'bi-trophy', title: 'Placement support', text: 'Offer and joining coordination until the candidate is successfully placed.' },
];

function asFaq(value: ContentValue | null | undefined): FaqContent | null {
  const items = value?.['items'];
  if (!Array.isArray(items)) return null;
  const valid = items.filter(
    (i): i is { question: string; answer: string } =>
      typeof i === 'object' && i !== null && typeof (i as Record<string, unknown>)['question'] === 'string',
  );
  return valid.length ? { items: valid } : null;
}

function asPolicy(value: ContentValue | null | undefined): PolicyContent | null {
  const sections = value?.['sections'];
  if (!Array.isArray(sections)) return null;
  const valid = sections.filter(
    (s): s is { heading: string; body: string } =>
      typeof s === 'object' && s !== null && typeof (s as Record<string, unknown>)['heading'] === 'string',
  );
  if (!valid.length) return null;
  return {
    title: typeof value?.['title'] === 'string' ? (value['title'] as string) : '',
    updatedAt: typeof value?.['updatedAt'] === 'string' ? (value['updatedAt'] as string) : undefined,
    sections: valid,
  };
}

/** Renders /about, /services, /faq, /privacy, /terms, /refund from GET /content/:key. */
@Component({
  selector: 'app-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, PageHeroComponent, SkeletonComponent, IllustrationComponent, RevealDirective],
  templateUrl: './content-page.component.html',
  styleUrl: './content-page.component.scss',
})
export default class ContentPageComponent {
  /** From route data. */
  readonly contentKey = input.required<PageKey>();
  private readonly api = inject(ContentService);
  private readonly titleService = inject(Title);

  protected readonly values = VALUES;
  protected readonly services = SERVICES;
  protected readonly openFaq = signal<number | null>(0);

  protected readonly content = rxResource({
    params: () => this.contentKey(),
    stream: ({ params }) => this.api.content(params),
  });

  protected readonly faq = computed<FaqContent | null>(() => {
    if (this.contentKey() !== 'faq') return null;
    return asFaq(this.content.value()) ?? FALLBACK_CONTENT.faq;
  });

  protected readonly policy = computed<PolicyContent | null>(() => {
    const key = this.contentKey();
    if (key === 'faq') return null;
    return asPolicy(this.content.value()) ?? FALLBACK_CONTENT[key];
  });

  protected readonly isPolicy = computed(() => ['privacy', 'terms', 'refund'].includes(this.contentKey()));
  protected readonly title = computed(() => this.policy()?.title || PAGE_TITLES[this.contentKey()]);
  protected readonly art = computed(() => ART[this.contentKey()]);
  protected readonly subtitle = computed(() => SUBTITLES[this.contentKey()]);

  constructor() {
    effect(() => this.titleService.setTitle(`${this.title()} | Veejee Services`));
  }

  toggleFaq(i: number): void {
    this.openFaq.update((cur) => (cur === i ? null : i));
  }

  scrollTo(event: Event, index: number): void {
    event.preventDefault();
    document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
