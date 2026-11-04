import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'job-card' | 'card' | 'lines' | 'table' | 'stat';

/** Shimmer placeholders shown while content loads. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-busy': 'true', 'aria-live': 'polite', role: 'status' },
  template: `
    <span class="sr-only">Loading…</span>
    <div class="wrap" [class]="'v-' + variant()">
      @for (i of items(); track i) {
        @switch (variant()) {
          @case ('job-card') {
            <div class="sk-card">
              <div class="row"><span class="b logo"></span><span class="col"><span class="b l60"></span><span class="b l40"></span></span></div>
              <span class="b l80"></span><span class="b l50"></span>
              <div class="row"><span class="b pill"></span><span class="b pill"></span><span class="b pill"></span></div>
            </div>
          }
          @case ('stat') {
            <div class="sk-card stat"><span class="b l40"></span><span class="b big"></span></div>
          }
          @case ('table') {
            <div class="sk-row"><span class="b l30"></span><span class="b l20"></span><span class="b l20"></span><span class="b l10"></span></div>
          }
          @case ('card') {
            <div class="sk-card"><span class="b l60"></span><span class="b l90"></span><span class="b l80"></span><span class="b l40"></span></div>
          }
          @default {
            <span class="b" [style.width.%]="90 - (i % 3) * 15"></span>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .wrap {
      display: grid;
      gap: var(--an-space-4);
    }
    .v-job-card,
    .v-card {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    }
    .v-stat {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    .v-lines,
    .v-table {
      gap: var(--an-space-3);
    }
    .sk-card {
      display: flex;
      flex-direction: column;
      gap: var(--an-space-3);
      padding: var(--an-space-5);
      background: var(--an-surface);
      border: 1px solid var(--an-border);
      border-radius: var(--an-radius-lg);
    }
    .sk-row {
      display: flex;
      gap: var(--an-space-4);
      padding: var(--an-space-3) var(--an-space-4);
      background: var(--an-surface);
      border: 1px solid var(--an-border);
      border-radius: var(--an-radius);
    }
    .row {
      display: flex;
      gap: var(--an-space-3);
      align-items: center;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--an-space-2);
      flex: 1;
    }
    .b {
      display: block;
      height: 12px;
      border-radius: 6px;
      background: linear-gradient(90deg, #eceff4 0%, #f6f8fb 40%, #eceff4 80%);
      background-size: 300% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    .logo {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      flex: none;
    }
    .pill {
      width: 72px;
      height: 22px;
      border-radius: 999px;
    }
    .big {
      height: 28px;
      width: 50%;
    }
    .l10 { width: 10%; }
    .l20 { width: 20%; }
    .l30 { width: 30%; }
    .l40 { width: 40%; }
    .l50 { width: 50%; }
    .l60 { width: 60%; }
    .l80 { width: 80%; }
    .l90 { width: 90%; }
    @keyframes shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: 0 0; }
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('lines');
  readonly count = input(3);
  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
