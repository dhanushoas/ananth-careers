import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { MODAL_DATA, ModalRef, ModalService } from '../ui/modal.service';
import { FieldErrorComponent, ValidationStateDirective } from './field-error.component';

export interface ConfirmDialogData {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger';
  /** Show a free-text field (e.g. rejection reason). */
  reason?: { label: string; required?: boolean; maxLength?: number; placeholder?: string };
}

export interface ConfirmResult {
  confirmed: true;
  reason: string;
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldErrorComponent, ValidationStateDirective],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5 d-flex align-items-center gap-2">
        <i class="bi" [class]="data.tone === 'danger' ? 'bi bi-exclamation-triangle-fill text-danger' : 'bi bi-question-circle-fill text-gold'" aria-hidden="true"></i>
        {{ data.title }}
      </h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (data.message) {
        <p class="text-secondary mb-3">{{ data.message }}</p>
      }
      @if (data.reason; as r) {
        <div class="form-floating">
          <textarea
            class="form-control"
            id="confirm-reason"
            [formControl]="reason"
            [attr.maxlength]="r.maxLength ?? 500"
            [placeholder]="r.placeholder ?? r.label"
            style="height: 7rem"
            data-autofocus
          ></textarea>
          <label for="confirm-reason">{{ r.label }}</label>
        </div>
        <app-field-error [control]="reason" [label]="r.label" />
      }
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>{{ data.cancelText ?? 'Cancel' }}</button>
      <button
        type="button"
        class="btn"
        [class.btn-danger]="data.tone === 'danger'"
        [class.btn-primary]="data.tone !== 'danger'"
        (click)="confirm()"
        [attr.data-autofocus]="data.reason ? null : ''"
      >
        {{ data.confirmText ?? 'Confirm' }}
      </button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<ConfirmResult>>(ModalRef);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: this.data.reason?.required ? [Validators.required, Validators.pattern(/\S/)] : [],
  });

  confirm(): void {
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      return;
    }
    this.ref.close({ confirmed: true, reason: this.reason.value.trim() });
  }
}

/** Opens confirmation dialogs; emits the result once, or `undefined` if cancelled. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modal = inject(ModalService);

  open(data: ConfirmDialogData): Observable<ConfirmResult | undefined> {
    return this.modal.open<ConfirmDialogComponent, ConfirmDialogData, ConfirmResult>(ConfirmDialogComponent, { data }).afterClosed();
  }
}
