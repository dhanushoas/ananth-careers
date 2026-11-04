import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  InjectionToken,
  Injector,
  Type,
  createComponent,
  inject,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { trapFocus } from './focus-trap';

/** Data passed to a modal content component. */
export const MODAL_DATA = new InjectionToken<unknown>('MODAL_DATA');

export interface ModalConfig<D> {
  data?: D;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Close when the backdrop is clicked or Escape is pressed (default true). */
  dismissible?: boolean;
  /** Accessible label if the content has no `.modal-title`. */
  ariaLabel?: string;
  /** Scroll long content inside the modal body (default true). */
  scrollable?: boolean;
}

/** Handle injected into modal content components (replacement for MatDialogRef). */
export class ModalRef<R = unknown> {
  private readonly closed$ = new Subject<R | undefined>();
  /** @internal */ dispose: () => void = () => undefined;
  private isClosed = false;

  close(result?: R): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.dispose();
    this.closed$.next(result);
    this.closed$.complete();
  }

  afterClosed(): Observable<R | undefined> {
    return this.closed$.asObservable();
  }
}

let modalSeq = 0;

/**
 * Bootstrap-styled modal dialogs without Bootstrap's JS. Content components should render
 * `.modal-header` / `.modal-body` / `.modal-footer` and may inject {@link MODAL_DATA} and {@link ModalRef}.
 * Provides focus trapping, Escape/backdrop dismissal, scroll locking and focus restoration.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private openCount = 0;

  open<C, D = unknown, R = unknown>(component: Type<C>, config: ModalConfig<D> = {}): ModalRef<R> {
    const ref = new ModalRef<R>();
    const id = `app-modal-${++modalSeq}`;
    const dismissible = config.dismissible ?? true;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop show';

    const modal = document.createElement('div');
    modal.className = 'modal d-block';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.id = id;
    if (config.ariaLabel) {
      modal.setAttribute('aria-label', config.ariaLabel);
    }

    const dialog = document.createElement('div');
    const sizeClass = config.size && config.size !== 'md' ? ` modal-${config.size}` : '';
    const scrollClass = config.scrollable === false ? '' : ' modal-dialog-scrollable';
    dialog.className = `modal-dialog modal-dialog-centered${scrollClass}${sizeClass}`;
    const content = document.createElement('div');
    content.className = 'modal-content';
    dialog.appendChild(content);
    modal.appendChild(dialog);

    const elementInjector = Injector.create({
      providers: [
        { provide: MODAL_DATA, useValue: config.data },
        { provide: ModalRef, useValue: ref },
      ],
      parent: this.envInjector,
    });
    const compRef: ComponentRef<C> = createComponent(component, {
      environmentInjector: this.envInjector,
      elementInjector,
    });
    this.appRef.attachView(compRef.hostView);
    const host = compRef.location.nativeElement as HTMLElement;
    host.classList.add('modal-host');
    // Let .modal-header/.modal-body/.modal-footer act as direct flex children of .modal-content.
    host.style.display = 'contents';
    content.appendChild(host);

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    this.openCount++;
    document.body.classList.add('modal-open');

    queueMicrotask(() => {
      const title = content.querySelector<HTMLElement>('.modal-title');
      if (title && !config.ariaLabel) {
        title.id ||= `${id}-title`;
        modal.setAttribute('aria-labelledby', title.id);
      }
    });

    const release = trapFocus(modal);
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        ref.close(undefined);
      }
    };
    const onClick = (e: MouseEvent): void => {
      if (dismissible && e.target === modal) {
        ref.close(undefined);
      }
    };
    // Any element with [data-modal-dismiss] closes without a result.
    const onDismiss = (e: MouseEvent): void => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-modal-dismiss]')) {
        ref.close(undefined);
      }
    };
    modal.addEventListener('keydown', onKeydown);
    modal.addEventListener('mousedown', onClick);
    content.addEventListener('click', onDismiss);

    ref.dispose = () => {
      modal.removeEventListener('keydown', onKeydown);
      modal.removeEventListener('mousedown', onClick);
      content.removeEventListener('click', onDismiss);
      this.appRef.detachView(compRef.hostView);
      compRef.destroy();
      modal.remove();
      backdrop.remove();
      this.openCount = Math.max(0, this.openCount - 1);
      if (this.openCount === 0) {
        document.body.classList.remove('modal-open');
      }
      release();
    };
    return ref;
  }
}
