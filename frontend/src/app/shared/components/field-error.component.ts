import { ChangeDetectionStrategy, Component, DestroyRef, Directive, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NgControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';

/** Turns validator errors into a readable message. */
export function validationMessage(errors: ValidationErrors | null, label = 'This field'): string {
  if (!errors) {
    return '';
  }
  if (typeof errors['server'] === 'string') {
    return errors['server'];
  }
  if (errors['required']) {
    return `${label} is required.`;
  }
  if (errors['requiredTrue']) {
    return `You must accept this to continue.`;
  }
  if (errors['email']) {
    return 'Enter a valid email address.';
  }
  if (errors['minlength']) {
    const e = errors['minlength'] as { requiredLength: number };
    return `${label} must be at least ${e.requiredLength} characters.`;
  }
  if (errors['maxlength']) {
    const e = errors['maxlength'] as { requiredLength: number };
    return `${label} must be at most ${e.requiredLength} characters.`;
  }
  if (errors['min']) {
    const e = errors['min'] as { min: number };
    return `${label} must be at least ${e.min}.`;
  }
  if (errors['max']) {
    const e = errors['max'] as { max: number };
    return `${label} must be at most ${e.max}.`;
  }
  if (errors['passwordLength']) {
    return 'Password must be 8–128 characters long.';
  }
  if (errors['passwordComplexity']) {
    return 'Password must contain at least one letter and one digit.';
  }
  if (errors['mismatch']) {
    return 'Passwords do not match.';
  }
  if (errors['mobile']) {
    return 'Enter a valid mobile number (10–15 digits).';
  }
  if (errors['url']) {
    return 'Enter a valid URL starting with http:// or https://.';
  }
  if (errors['pattern']) {
    return `${label} has an invalid format.`;
  }
  if (errors['futureDate']) {
    return 'Choose a date and time in the future.';
  }
  return `${label} is invalid.`;
}

function shouldShow(control: AbstractControl): boolean {
  return control.invalid && (control.touched || control.dirty);
}

/**
 * Bootstrap validation feedback for a control: renders `.invalid-feedback.d-block` once the
 * control is touched/dirty and invalid. Place it right after the input (or its `.form-floating`).
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-contents' },
  template: `
    @if (message()) {
      <div class="invalid-feedback d-block" [attr.id]="id() || null" role="alert">{{ message() }}</div>
    }
  `,
  styles: `:host { display: contents; }`,
})
export class FieldErrorComponent implements OnInit {
  readonly control = input.required<AbstractControl>();
  readonly label = input('This field');
  /** Optional id so the input can reference it via aria-describedby. */
  readonly id = input('');

  protected readonly message = signal('');
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const control = this.control();
    const update = (): void =>
      this.message.set(shouldShow(control) ? validationMessage(control.errors, this.label()) : '');
    update();
    control.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(update);
  }
}

/**
 * Adds Bootstrap `.is-invalid` (and `aria-invalid`) to any reactive form control element once it
 * is touched/dirty and invalid. Applies automatically to inputs/selects/textareas bound with
 * `formControlName` or `[formControl]`.
 */
@Directive({
  selector:
    'input[formControlName], select[formControlName], textarea[formControlName], input[formControl], select[formControl], textarea[formControl]',
  host: {
    '[class.is-invalid]': 'invalid()',
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
  },
})
export class ValidationStateDirective implements OnInit {
  private readonly ngControl = inject(NgControl, { self: true });
  private readonly destroyRef = inject(DestroyRef);
  protected readonly invalid = signal(false);

  ngOnInit(): void {
    const control = this.ngControl.control;
    if (!control) {
      return;
    }
    const update = (): void => this.invalid.set(shouldShow(control));
    update();
    control.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(update);
  }
}

/** Everything a Bootstrap reactive form needs: import `FORM_KIT` in a component's `imports`. */
export const FORM_KIT = [ReactiveFormsModule, FieldErrorComponent, ValidationStateDirective] as const;
