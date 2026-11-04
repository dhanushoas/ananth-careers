import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FileSizePipe } from '../pipes/file-size.pipe';
import { biIcon } from '../ui/icons';

/**
 * Drag-and-drop / click file picker with client-side type & size validation.
 * The server re-validates (magic bytes etc.); this only gives fast feedback.
 */
@Component({
  selector: 'app-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileSizePipe],
  template: `
    <div
      class="drop"
      [class.over]="dragOver()"
      [class.disabled]="busy() || disabled()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <span class="icon-tile" aria-hidden="true"><i [class]="'bi ' + iconClass()"></i></span>
      <p class="mb-0">
        <button type="button" class="btn btn-link p-0 align-baseline" (click)="fileInput().nativeElement.click()" [disabled]="busy() || disabled()">
          {{ label() }}
        </button>
        <span class="text-secondary d-none d-sm-inline"> or drag and drop</span>
      </p>
      <p class="small text-secondary mb-0">{{ hint() }} · Max {{ maxBytes() | fileSize }}</p>
      <input #picker type="file" class="visually-hidden" [accept]="accept()" [attr.aria-label]="label()" (change)="onChange($event)" [disabled]="busy() || disabled()" />
      @if (busy()) {
        <div class="progress w-100 mt-2" role="progressbar" aria-label="Uploading">
          <div class="progress-bar progress-bar-striped progress-bar-animated w-100"></div>
        </div>
      }
    </div>
    @if (error()) {
      <div class="invalid-feedback d-block" role="alert">{{ error() }}</div>
    }
  `,
  styles: `
    .drop {
      display: flex; flex-direction: column; align-items: center; gap: var(--an-space-1); text-align: center;
      padding: var(--an-space-5) var(--an-space-4); border: 2px dashed var(--an-border-strong); border-radius: var(--an-radius-lg);
      background: var(--an-surface-2); transition: border-color var(--an-dur) var(--an-ease), background var(--an-dur) var(--an-ease);
    }
    .drop.over { border-color: var(--an-gold-500); background: var(--an-gold-100); }
    .drop.disabled { opacity: 0.7; }
    .icon-tile { width: 52px; height: 52px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-900); color: var(--an-gold-300); font-size: 1.5rem; margin-bottom: var(--an-space-2); }
  `,
})
export class FileUploadComponent {
  readonly accept = input('application/pdf');
  readonly mimeTypes = input<string[]>(['application/pdf']);
  readonly maxBytes = input(5 * 1024 * 1024);
  readonly label = input('Choose a file');
  readonly hint = input('PDF');
  /** Bootstrap icon class (`bi-…`) or a legacy Material name. */
  readonly icon = input('bi-cloud-arrow-up');
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly fileSelected = output<File>();

  protected readonly dragOver = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected iconClass(): string {
    return biIcon(this.icon(), 'bi-cloud-arrow-up');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.busy() && !this.disabled()) {
      this.dragOver.set(true);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.busy() || this.disabled()) {
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handle(file);
    }
  }

  onChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    if (file) {
      this.handle(file);
    }
    el.value = '';
  }

  private handle(file: File): void {
    const allowed = this.mimeTypes();
    if (allowed.length && !allowed.includes(file.type)) {
      this.error.set(`Unsupported file type. Allowed: ${this.hint()}.`);
      return;
    }
    if (file.size > this.maxBytes()) {
      this.error.set(`File is too large. Maximum size is ${Math.round(this.maxBytes() / (1024 * 1024))} MB.`);
      return;
    }
    this.error.set(null);
    this.fileSelected.emit(file);
  }
}
