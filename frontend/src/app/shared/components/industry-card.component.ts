import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Industry } from '../../core/models';
import { industryIcon } from '../utils/industry-icons';

@Component({
  selector: 'app-industry-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @let i = industry();
    <a class="ind card card-hover h-100" [routerLink]="['/industries', i.slug]" data-testid="industry-card">
      <span class="badge-art" aria-hidden="true">
        <svg viewBox="0 0 64 64" class="ring"><circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 5" /></svg>
        <span class="tile"><i [class]="'bi ' + icon()"></i></span>
      </span>
      <span class="name">{{ i.name }}</span>
      @if (i.jobCount !== undefined) {
        <span class="count"><span class="num">{{ i.jobCount }}</span> open {{ i.jobCount === 1 ? 'job' : 'jobs' }} <i class="bi bi-arrow-right-short" aria-hidden="true"></i></span>
      }
    </a>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .ind { display: flex; flex-direction: column; gap: var(--an-space-2); padding: var(--an-space-4); text-decoration: none; color: var(--an-text);
      background: linear-gradient(180deg, #fff 0%, #fff 60%, var(--an-navy-50) 100%); }
    .ind:hover { border-color: var(--an-gold-500); }
    .badge-art { position: relative; width: 56px; height: 56px; color: var(--an-gold-300); }
    .ring { position: absolute; inset: -4px; width: 64px; height: 64px; transition: transform 600ms var(--an-ease); }
    .ind:hover .ring { transform: rotate(60deg); }
    .tile { position: absolute; inset: 4px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--an-navy-900), var(--an-navy-600)); color: var(--an-gold-300); font-size: 1.35rem;
      box-shadow: 0 6px 14px rgba(11, 42, 91, 0.18); }
    .name { font-family: var(--an-font-heading); font-weight: 700; color: var(--an-navy-900); line-height: 1.25; overflow-wrap: anywhere; margin-top: var(--an-space-1); }
    .count { font-size: 0.85rem; color: var(--an-text-muted); margin-top: auto; display: inline-flex; align-items: center; gap: 3px; }
    .num { font-weight: 700; color: var(--an-accent-ink); }
    @media (prefers-reduced-motion: reduce) { .ind:hover .ring { transform: none; } }
  `,
})
export class IndustryCardComponent {
  readonly industry = input.required<Industry>();
  protected readonly icon = computed(() => industryIcon(this.industry()));
}
