import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Company logo from GET /employers/:id/logo with an initials fallback. */
@Component({
  selector: 'app-company-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.38">
      @if (src() && !failed()) {
        <img [src]="src()" [alt]="name() + ' logo'" loading="lazy" (error)="failed.set(true)" />
      } @else {
        <span aria-hidden="true">{{ initials() }}</span>
        <span class="sr-only">{{ name() }}</span>
      }
    </span>
  `,
  styles: `
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      border-radius: 12px;
      overflow: hidden;
      background: linear-gradient(135deg, var(--an-navy-800), var(--an-navy-600));
      color: var(--an-gold-300);
      font-family: var(--an-font-heading);
      font-weight: 800;
      border: 1px solid var(--an-border);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #fff;
    }
  `,
})
export class CompanyLogoComponent {
  readonly employerId = input<string | null | undefined>();
  readonly hasLogo = input(false);
  readonly name = input('');
  readonly size = input(48);
  readonly version = input<string | number | undefined>();

  protected readonly failed = signal(false);
  protected readonly src = computed(() => {
    const id = this.employerId();
    if (!id || !this.hasLogo()) {
      return null;
    }
    const v = this.version();
    return `${environment.apiUrl}/employers/${id}/logo${v !== undefined ? `?v=${encodeURIComponent(String(v))}` : ''}`;
  });
  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || 'A',
  );
}
