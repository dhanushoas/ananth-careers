import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Fade/slide-in when scrolled into view (IntersectionObserver, reduced-motion aware).
 * Usage: `<section appReveal>` or `<div appReveal [appRevealDelay]="120">`.
 * Styles live in `_patterns.scss` (`.reveal` / `.revealed`).
 */
@Directive({ selector: '[appReveal]' })
export class RevealDirective implements OnInit, OnDestroy {
  /** Delay in milliseconds before the transition starts (useful for staggering). */
  readonly appRevealDelay = input(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    const el = this.el;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('revealed');
      return;
    }
    el.classList.add('reveal');
    const delay = this.appRevealDelay();
    if (delay > 0) {
      el.style.setProperty('--reveal-delay', `${delay}ms`);
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('revealed');
            this.observer?.unobserve(el);
          }
        }
      },
      { threshold: 0.15 },
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
