import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, input, model, untracked, viewChild } from '@angular/core';
import { trapFocus } from './focus-trap';

/**
 * Bootstrap offcanvas driven by a signal (no Bootstrap JS).
 * `responsive="lg"` renders it as a static block at ≥lg (Bootstrap `.offcanvas-lg`) and as an
 * overlay drawer below. Escape and backdrop clicks close it; focus is trapped while open.
 */
@Component({
  selector: 'app-offcanvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <div
      #panel
      [class]="classes()"
      [class.show]="open()"
      [attr.role]="open() ? 'dialog' : null"
      [attr.aria-modal]="open() ? 'true' : null"
      [attr.aria-label]="label()"
      [attr.id]="panelId() || null"
      tabindex="-1"
    >
      <div class="offcanvas-header" [class.d-lg-none]="responsive() === 'lg'">
        <ng-content select="[offcanvasTitle]" />
        <button type="button" class="btn-close ms-auto" [attr.aria-label]="'Close ' + label()" (click)="open.set(false)"></button>
      </div>
      <div class="offcanvas-body" [class]="'offcanvas-body ' + bodyClass()">
        <ng-content />
      </div>
    </div>
    @if (open()) {
      <div class="offcanvas-backdrop show" [class.d-lg-none]="responsive() === 'lg'" (click)="open.set(false)" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host { display: contents; }
    .offcanvas.show, .offcanvas-lg.show { visibility: visible; transform: none; }
  `,
})
export class OffcanvasComponent implements OnDestroy {
  readonly open = model(false);
  readonly placement = input<'start' | 'end'>('end');
  readonly label = input('Menu');
  readonly responsive = input<'' | 'lg'>('');
  readonly panelClass = input('');
  readonly bodyClass = input('');
  readonly panelId = input('');

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private release: (() => void) | null = null;

  protected classes(): string {
    const base = this.responsive() === 'lg' ? 'offcanvas-lg' : 'offcanvas';
    return `${base} offcanvas-${this.placement()} ${this.panelClass()}`.trim();
  }

  constructor() {
    effect(() => {
      const isOpen = this.open();
      untracked(() => {
        if (isOpen) {
          document.body.style.overflow = 'hidden';
          queueMicrotask(() => {
            this.release?.();
            this.release = trapFocus(this.panel().nativeElement);
          });
        } else {
          document.body.style.overflow = '';
          this.release?.();
          this.release = null;
        }
      });
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.release?.();
  }
}
