import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CandidateInterview } from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { CandidateInterviewCardComponent } from './interview-card.component';

/** Tolerates a plain array (contract) or a paginated envelope. */
export function asList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}

@Component({
  selector: 'app-candidate-interviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, SkeletonComponent, EmptyStateComponent, CandidateInterviewCardComponent],
  template: `
    <app-page-header title="Interview schedule" eyebrow="Candidate" illustration="interviews"
      subtitle="Veejee Services schedules interviews with client companies on your behalf. Accept or decline each invitation.">
      <ul class="nav nav-pills" role="group" aria-label="Interview filter">
        <li class="nav-item">
          <button type="button" class="nav-link" [class.active]="upcoming()" [attr.aria-pressed]="upcoming()" (click)="setUpcoming(true)">
            <i class="bi bi-calendar-week" aria-hidden="true"></i> Upcoming
          </button>
        </li>
        <li class="nav-item">
          <button type="button" class="nav-link" [class.active]="!upcoming()" [attr.aria-pressed]="!upcoming()" (click)="setUpcoming(false)">
            <i class="bi bi-calendar3" aria-hidden="true"></i> All
          </button>
        </li>
      </ul>
    </app-page-header>

    @if (loading()) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (error()) {
      <app-empty-state tone="error" illustration="error" title="We couldn't load your interviews">
        <button class="btn btn-primary" type="button" (click)="load()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
      </app-empty-state>
    } @else {
      <div class="list">
        @for (iv of interviews(); track iv.id) {
          <app-candidate-interview-card [interview]="iv" (updated)="onUpdated($event)" />
        } @empty {
          <app-empty-state class="span-all" illustration="empty-interviews"
            [title]="upcoming() ? 'No upcoming interviews' : 'No interviews yet'"
            message="When a company asks to meet you, Veejee Services will schedule the interview and it will appear here.">
            <a class="btn btn-outline-primary" routerLink="/candidate/applications">View my applications</a>
          </app-empty-state>
        }
      </div>
    }
  `,
  styles: `
    .list { display: grid; gap: var(--an-space-3); }
    @media (min-width: 1200px) { .list { grid-template-columns: repeat(2, minmax(0, 1fr)); } .span-all { grid-column: 1 / -1; } }
  `,
})
export default class CandidateInterviewsComponent implements OnInit {
  private readonly api = inject(CandidateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly interviews = signal<CandidateInterview[]>([]);
  protected readonly upcoming = signal(true);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.load();
  }

  setUpcoming(value: boolean): void {
    if (value !== this.upcoming()) {
      this.upcoming.set(value);
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .interviews(this.upcoming() ? true : undefined)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const dir = this.upcoming() ? 1 : -1;
          this.interviews.set(
            [...asList<CandidateInterview>(res)].sort(
              (a, b) => dir * (new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
            ),
          );
        },
        error: () => this.error.set(true),
      });
  }

  onUpdated(iv: CandidateInterview): void {
    this.interviews.update((list) => list.map((i) => (i.id === iv.id ? iv : i)));
  }
}
