import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldErrorComponent, ValidationStateDirective } from './field-error.component';

/** Floating-label password input with a show/hide toggle and Bootstrap validation feedback. */
@Component({
  selector: 'app-password-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldErrorComponent, ValidationStateDirective],
  template: `
    <div class="input-group has-validation">
      <div class="form-floating">
        <input
          class="form-control"
          [id]="inputId()"
          [type]="visible() ? 'text' : 'password'"
          [formControl]="control()"
          [attr.autocomplete]="autocomplete()"
          placeholder=" "
          [attr.aria-describedby]="hint() ? inputId() + '-hint' : null"
          required
        />
        <label [for]="inputId()">{{ label() }}</label>
      </div>
      <button
        type="button"
        class="btn btn-outline-secondary toggle"
        (click)="visible.set(!visible())"
        [attr.aria-label]="(visible() ? 'Hide ' : 'Show ') + label().toLowerCase()"
        [attr.aria-pressed]="visible()"
      >
        <i [class]="visible() ? 'bi bi-eye-slash' : 'bi bi-eye'" aria-hidden="true"></i>
      </button>
    </div>
    <app-field-error [control]="control()" [label]="label()" />
    @if (hint()) {
      <div class="form-text" [id]="inputId() + '-hint'">{{ hint() }}</div>
    }
  `,
  styles: `
    :host { display: block; }
    .toggle { min-width: 52px; border-color: var(--bs-border-color); }
    .input-group > .form-floating > .form-control { border-top-right-radius: 0; border-bottom-right-radius: 0; }
  `,
})
export class PasswordFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly label = input('Password');
  readonly inputId = input.required<string>();
  readonly autocomplete = input('current-password');
  readonly hint = input('');
  protected readonly visible = signal(false);
}
