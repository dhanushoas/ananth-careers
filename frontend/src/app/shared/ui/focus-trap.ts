const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Keeps keyboard focus inside `container` (Tab / Shift+Tab wrap) and focuses the first
 * focusable element (or `[autofocus]`). Returns a release function that restores focus.
 */
export function trapFocus(container: HTMLElement, autoFocus = true): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
      return;
    }
    const items = focusables(container);
    if (!items.length) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeydown);
  if (autoFocus) {
    queueMicrotask(() => {
      const preferred = container.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (preferred ?? focusables(container)[0] ?? container).focus();
    });
  }
  return () => {
    container.removeEventListener('keydown', onKeydown);
    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
  };
}
