import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { prefersReducedMotion } from './reveal.directive';

const formatter = new Intl.NumberFormat('en-IN');

/** Animated number counter that starts when visible (reduced-motion: renders final value). */
@Component({
  selector: 'app-count-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ display() }}`,
  styles: `:host { font-variant-numeric: tabular-nums; }`,
})
export class CountUpComponent implements OnDestroy {
  readonly value = input.required<number>();
  readonly durationMs = input(1200);

  protected readonly display = signal('0');
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;
  private frame = 0;
  private visible = false;
  private current = 0;

  constructor() {
    effect(() => {
      const target = Number(this.value()) || 0;
      untracked(() => this.schedule(target));
    });
  }

  private schedule(target: number): void {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      this.current = target;
      this.display.set(formatter.format(target));
      return;
    }
    if (this.visible) {
      this.animate(target);
      return;
    }
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.visible = true;
          this.observer?.disconnect();
          this.observer = null;
          this.animate(target);
        }
      },
      { threshold: 0.3 },
    );
    this.observer.observe(this.el);
  }

  private animate(target: number): void {
    cancelAnimationFrame(this.frame);
    const from = this.current;
    const duration = Math.max(1, this.durationMs());
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      this.current = value;
      this.display.set(formatter.format(value));
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.frame);
    }
  }
}
