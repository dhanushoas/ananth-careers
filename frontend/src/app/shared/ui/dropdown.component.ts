import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';

let dropdownSeq = 0;

/**
 * Bootstrap dropdown driven by signals (no Bootstrap JS/Popper).
 * Usage:
 * <app-dropdown buttonClass="btn btn-light" ariaLabel="More actions" align="end">
 *   <ng-container toggle><i class="bi bi-three-dots-vertical"></i></ng-container>
 *   <button class="dropdown-item" type="button" (click)="...">Edit</button>
 * </app-dropdown>
 * Clicking a `.dropdown-item` closes the menu. Arrow keys move between items; Escape closes.
 */
@Component({
  selector: 'app-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dropdown d-inline-block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
  template: `
    <button
      #toggleBtn
      type="button"
      [class]="buttonClass()"
      [class.show]="open()"
      [attr.aria-label]="ariaLabel() || null"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="menuId"
      [attr.data-testid]="testId() || null"
      (click)="toggle()"
      (keydown.arrowdown)="openAndFocus($event)"
    >
      <ng-content select="[toggle]" />
    </button>
    <div
      #menu
      class="dropdown-menu"
      [class.show]="open()"
      [class.dropdown-menu-end]="align() === 'end'"
      [id]="menuId"
      [style.width]="menuWidth() || null"
      (click)="onMenuClick($event)"
      (keydown)="onMenuKeydown($event)"
    >
      <ng-content />
    </div>
  `,
  styles: `
    :host { position: relative; }
    .dropdown-menu.show { display: block; position: absolute; top: 100%; margin-top: 4px; z-index: 1050; max-height: min(70vh, 520px); overflow-y: auto; }
    .dropdown-menu-end.show { right: 0; left: auto; }
    .dropdown-menu:not(.dropdown-menu-end).show { left: 0; }
  `,
})
export class DropdownComponent {
  readonly buttonClass = input('btn btn-light');
  readonly ariaLabel = input('');
  readonly align = input<'start' | 'end'>('start');
  readonly menuWidth = input('');
  readonly testId = input('');

  protected readonly menuId = `app-dropdown-${++dropdownSeq}`;
  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toggleBtn = viewChild.required<ElementRef<HTMLButtonElement>>('toggleBtn');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(restoreFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus) this.toggleBtn().nativeElement.focus();
  }

  openAndFocus(event: Event): void {
    event.preventDefault();
    this.open.set(true);
    queueMicrotask(() => this.items()[0]?.focus());
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  onMenuClick(event: MouseEvent): void {
    const item = (event.target as HTMLElement).closest('.dropdown-item');
    if (item) this.open.set(false);
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  private items(): HTMLElement[] {
    return Array.from(this.menu().nativeElement.querySelectorAll<HTMLElement>('.dropdown-item:not(.disabled):not([disabled])'));
  }
}
