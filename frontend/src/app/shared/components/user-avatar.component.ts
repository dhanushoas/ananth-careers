import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { AccountService } from '../../core/services/account.service';

/**
 * Avatar for a user. GET /users/:id/avatar requires auth, so the image is fetched as a blob
 * through HttpClient (interceptor adds the bearer token) and shown via an object URL.
 */
@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.4">
      @if (src()) {
        <img [src]="src()" [alt]="name() + ' avatar'" />
      } @else {
        <span aria-hidden="true">{{ initials() }}</span>
      }
    </span>
  `,
  styles: `
    .avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; overflow: hidden; flex: none;
      background: var(--an-gold-100); color: var(--an-gold-700); font-weight: 700; font-family: var(--an-font-heading);
      border: 1px solid var(--an-gold-300); }
    img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class UserAvatarComponent {
  readonly userId = input<string | null | undefined>();
  readonly hasAvatar = input(false);
  readonly name = input('');
  readonly size = input(36);
  /** Change to force a reload (e.g. after upload). */
  readonly version = input(0);

  private readonly account = inject(AccountService);
  protected readonly src = signal<string | null>(null);
  protected readonly initials = computed(
    () =>
      this.name()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join('') || '?',
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    let current: string | null = null;
    const revoke = (): void => {
      if (current) {
        URL.revokeObjectURL(current);
        current = null;
      }
    };
    effect((onCleanup) => {
      const id = this.userId();
      const has = this.hasAvatar();
      this.version();
      revoke();
      this.src.set(null);
      if (!id || !has) {
        return;
      }
      const sub = this.account.avatar(id).subscribe({
        next: (res) => {
          if (res.body) {
            current = URL.createObjectURL(res.body);
            this.src.set(current);
          }
        },
        error: () => this.src.set(null),
      });
      onCleanup(() => sub.unsubscribe());
    });
    destroyRef.onDestroy(revoke);
  }
}
