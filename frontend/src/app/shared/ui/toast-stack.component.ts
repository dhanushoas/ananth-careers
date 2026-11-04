import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="toast show align-items-center border-0 app-toast"
          [class]="'toast show align-items-center border-0 app-toast toast-' + t.kind"
          [attr.role]="t.kind === 'error' ? 'alert' : 'status'"
          data-testid="toast"
        >
          <div class="d-flex align-items-center">
            <i class="bi ms-3" [class]="'bi ms-3 ' + icon(t.kind)" aria-hidden="true"></i>
            <div class="toast-body">{{ t.text }}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Dismiss" (click)="toast.dismiss(t.id)"></button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .app-toast { color: #fff; background: var(--an-navy-900); box-shadow: var(--an-shadow-3); }
    .toast-success { background: #0f5132; }
    .toast-error { background: #7a1810; }
    .app-toast .bi { font-size: 1.15rem; color: var(--an-gold-300); }
    .toast-success .bi { color: #a3e4bf; }
    .toast-error .bi { color: #ffb4ab; }
    .btn-close { min-height: 0; }
  `,
})
export class ToastStackComponent {
  protected readonly toast = inject(ToastService);

  icon(kind: string): string {
    return kind === 'success' ? 'bi-check-circle-fill' : kind === 'error' ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill';
  }
}
