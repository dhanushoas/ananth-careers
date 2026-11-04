import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IllustrationComponent } from '../illustrations/illustration.component';
import { finalize } from 'rxjs';
import { ApplicationsService } from '../../core/services/applications.service';
import { AuthService } from '../../core/auth/auth.service';
import { Message } from '../../core/models';
import { EnumLabelPipe } from '../pipes/enum-label.pipe';

/** Conversation between candidate and company on an application. */
@Component({
  selector: 'app-message-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, EnumLabelPipe, IllustrationComponent],
  template: `
    <section class="thread" aria-labelledby="msg-heading">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 head">
        <h2 id="msg-heading" class="h"><i class="bi bi-chat-dots text-gold" aria-hidden="true"></i> Messages</h2>
        <button class="btn btn-sm btn-outline-primary" type="button" (click)="load()" [disabled]="loading()">
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Refresh
        </button>
      </div>
      <div class="list" #list role="log" aria-live="polite" tabindex="0" aria-label="Message history">
        @if (loading() && !messages().length) {
          <p class="muted">Loading messages…</p>
        } @else if (error()) {
          <p class="muted">Messages could not be loaded.</p>
        } @else {
          @for (m of messages(); track m.id) {
            <div class="msg" [class.mine]="m.sender.id === myId()">
              <p class="meta">
                <strong>{{ m.sender.id === myId() ? 'You' : m.sender.name }}</strong>
                <span class="role">{{ m.sender.role | enumLabel }}</span>
                · <time [attr.datetime]="m.createdAt">{{ m.createdAt | date: 'short' }}</time>
              </p>
              <p class="text">{{ m.body }}</p>
            </div>
          } @empty {
            <div class="empty-msg">
              <app-illustration name="empty-messages" class="art" />
              <p class="muted mb-0">No messages yet. Start the conversation below.</p>
            </div>
          }
        }
      </div>
      @if (canSend()) {
        <form class="compose" (ngSubmit)="send()">
          <div class="form-floating">
            <textarea class="form-control" id="msg-body" [formControl]="body" maxlength="2000" placeholder="Write a message" style="height: 6.5rem" data-testid="message-input"></textarea>
            <label for="msg-body">Write a message</label>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-2 gap-2">
            <span class="form-text m-0">{{ body.value.length }} / 2000</span>
            <button class="btn btn-primary" type="submit" [disabled]="body.invalid || sending()">
              @if (sending()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> } @else { <i class="bi bi-send" aria-hidden="true"></i> }
              Send
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    .h { font-size: 1.1rem; margin: 0; display: flex; align-items: center; gap: 8px; }
    .empty-msg { text-align: center; padding: var(--an-space-3); } .empty-msg .art { width: 120px; margin: 0 auto var(--an-space-2); }
    .head { margin-bottom: var(--an-space-3); }
    .list { display: flex; flex-direction: column; gap: var(--an-space-3); max-height: 420px; overflow-y: auto;
      padding: var(--an-space-3); background: var(--an-surface-2); border-radius: var(--an-radius); }
    .msg { max-width: 85%; align-self: flex-start; background: var(--an-surface); border: 1px solid var(--an-border);
      border-radius: 12px 12px 12px 4px; padding: var(--an-space-2) var(--an-space-3); }
    .msg.mine { align-self: flex-end; background: var(--an-navy-100); border-color: #cdd8ea; border-radius: 12px 12px 4px 12px; }
    .meta { margin: 0 0 2px; font-size: 0.78rem; color: var(--an-text-muted); }
    .role { margin-left: 4px; }
    .text { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
    .compose { margin-top: var(--an-space-3); }
  `,
})
export class MessageThreadComponent implements OnInit {
  readonly applicationId = input.required<string>();
  readonly canSend = input(true);

  private readonly applications = inject(ApplicationsService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listEl = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal(false);
  protected readonly myId = computed(() => this.auth.user()?.id ?? '');
  protected readonly body = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.applications
      .messages(this.applicationId())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (msgs) => {
          this.error.set(false);
          this.messages.set(msgs);
          this.scrollToEnd();
        },
        error: () => this.error.set(true),
      });
  }

  send(): void {
    if (this.body.invalid) {
      return;
    }
    this.sending.set(true);
    this.applications
      .sendMessage(this.applicationId(), this.body.value.trim())
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((msg) => {
        this.messages.update((list) => [...list, msg]);
        this.body.reset('');
        this.scrollToEnd();
      });
  }

  private scrollToEnd(): void {
    queueMicrotask(() => {
      const el = this.listEl()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
