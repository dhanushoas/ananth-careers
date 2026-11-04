import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { MODAL_DATA, ModalRef, ModalService } from './modal.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginatorComponent, PageChange } from '../components/paginator.component';
import { FORM_KIT } from '../components/field-error.component';

@Component({
  selector: 'app-test-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-header"><h2 class="modal-title">Hello {{ data.name }}</h2><button class="btn-close" data-modal-dismiss aria-label="Close"></button></div>
    <div class="modal-body"><button id="ok" (click)="ref.close('ok')">OK</button></div>
  `,
})
class TestModalComponent {
  protected readonly data = inject<{ name: string }>(MODAL_DATA);
  protected readonly ref = inject<ModalRef<string>>(ModalRef);
}

@Component({
  selector: 'app-test-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `<input id="f" class="form-control" [formControl]="ctrl" /><app-field-error [control]="ctrl" label="Email" />`,
})
class TestFormComponent {
  readonly ctrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

describe('Bootstrap UI infrastructure', () => {
  afterEach(() => {
    document.querySelectorAll('.modal, .modal-backdrop').forEach((el) => el.remove());
    document.body.classList.remove('modal-open');
  });

  it('ModalService renders content with data, returns the result and cleans up', async () => {
    const modal = TestBed.inject(ModalService);
    let result: string | undefined = 'unset';
    modal.open<TestModalComponent, { name: string }, string>(TestModalComponent, { data: { name: 'Asha' } })
      .afterClosed()
      .subscribe((r) => (result = r));
    TestBed.tick();
    const dialog = document.querySelector('.modal[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(dialog.textContent).toContain('Hello Asha');
    (dialog.querySelector('#ok') as HTMLButtonElement).click();
    expect(result).toBe('ok');
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('ModalService closes with undefined on Escape and [data-modal-dismiss]', () => {
    const modal = TestBed.inject(ModalService);
    const results: (string | undefined)[] = [];
    modal.open<TestModalComponent, { name: string }, string>(TestModalComponent, { data: { name: 'A' } }).afterClosed().subscribe((r) => results.push(r));
    TestBed.tick();
    (document.querySelector('.modal') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    modal.open<TestModalComponent, { name: string }, string>(TestModalComponent, { data: { name: 'B' } }).afterClosed().subscribe((r) => results.push(r));
    TestBed.tick();
    (document.querySelector('[data-modal-dismiss]') as HTMLElement).click();
    expect(results).toEqual([undefined, undefined]);
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('ToastService queues, de-duplicates and dismisses messages', () => {
    vi.useFakeTimers();
    const toast = TestBed.inject(ToastService);
    toast.success('Saved');
    toast.success('Saved');
    toast.error('Failed');
    expect(toast.toasts().map((t) => t.text)).toEqual(['Saved', 'Failed']);
    toast.dismiss(toast.toasts()[0].id);
    expect(toast.toasts().length).toBe(1);
    vi.advanceTimersByTime(6000);
    expect(toast.toasts().length).toBe(0);
    vi.useRealTimers();
  });

  it('PaginatorComponent shows range text and emits 1-based pages', async () => {
    const fixture = TestBed.createComponent(PaginatorComponent);
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('limit', 10);
    fixture.componentRef.setInput('total', 35);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Showing 11–20 of 35');
    const events: PageChange[] = [];
    fixture.componentInstance.pageChange.subscribe((e) => events.push(e));
    (el.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    (el.querySelector('[aria-label="Previous page"]') as HTMLButtonElement).click();
    expect(events).toEqual([
      { page: 3, limit: 10 },
      { page: 1, limit: 10 },
    ]);
  });

  it('FORM_KIT marks touched invalid controls with .is-invalid and shows feedback', async () => {
    const fixture = TestBed.createComponent(TestFormComponent);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('#f') as HTMLInputElement;
    expect(input.classList.contains('is-invalid')).toBe(false);
    fixture.componentInstance.ctrl.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.classList.contains('is-invalid')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).querySelector('.invalid-feedback')?.textContent).toContain('Email is required.');
    fixture.componentInstance.ctrl.setValue('x@y.z');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.classList.contains('is-invalid')).toBe(false);
  });
});
