import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

/** Global toast notifications rendered by `<app-toast-stack>` (Bootstrap toasts). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string): void {
    this.push('success', message, 4000);
  }

  info(message: string): void {
    this.push('info', message, 4000);
  }

  error(message: string): void {
    this.push('error', message, 6000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, text: string, duration: number): void {
    const id = ++this.seq;
    // Collapse identical consecutive messages.
    const current = this._toasts();
    const last = current[current.length - 1];
    if (last && last.text === text && last.kind === kind) {
      return;
    }
    this._toasts.set([...current.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
