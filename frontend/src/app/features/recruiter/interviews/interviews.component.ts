import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { CandidateInterview, InterviewStatus } from '../../../core/models';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { InterviewItemComponent } from '../shared/interview-item.component';

interface DayGroup {
  key: string;
  date: Date;
  items: CandidateInterview[];
}

const STATUSES: (InterviewStatus | '')[] = ['', 'scheduled', 'rescheduled', 'completed', 'cancelled'];

/** Interview coordination: day-grouped agenda of interviews Veejee Services has scheduled. */
@Component({
  selector: 'app-recruiter-interviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, EmptyStateComponent, PageHeaderComponent, SkeletonComponent, InterviewItemComponent],
  template: `
    <app-page-header eyebrow="Coordination" title="Interview coordination" illustration="interviews"
      subtitle="Every interview between candidates and client companies, scheduled by Veejee Services." />

    <div class="card mb-3">
      <div class="card-body d-flex flex-wrap gap-3 align-items-center">
        <ul class="nav nav-pills" aria-label="Time range">
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="upcoming()" (click)="upcoming.set(true)">Upcoming</button></li>
          <li class="nav-item"><button type="button" class="nav-link" [class.active]="!upcoming()" (click)="upcoming.set(false)">All</button></li>
        </ul>
        <div class="form-floating status">
          <select class="form-select" id="iv-status" (change)="onStatus($event)">
            @for (s of statuses; track s) {
              <option [value]="s" [selected]="status() === s">{{ s ? label(s) : 'All statuses' }}</option>
            }
          </select>
          <label for="iv-status">Status</label>
        </div>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" role="switch" id="iv-mine" [checked]="mine()" (change)="mine.set(checked($event))" />
          <label class="form-check-label" for="iv-mine">My candidates only</label>
        </div>
        <span class="ms-auto small text-secondary">{{ list().length }} {{ list().length === 1 ? 'interview' : 'interviews' }}</span>
      </div>
    </div>

    @if (data.isLoading() && !data.value()) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (data.error()) {
      <app-empty-state tone="error" title="Interviews could not be loaded">
        <button class="btn btn-primary" type="button" (click)="data.reload()">Retry</button>
      </app-empty-state>
    } @else {
      @for (g of groups(); track g.key) {
        <section class="day" [attr.aria-labelledby]="'day-' + g.key">
          <h2 class="day-h" [id]="'day-' + g.key">
            <span class="cal" aria-hidden="true"><span>{{ g.date | date: 'MMM' }}</span><strong>{{ g.date | date: 'd' }}</strong></span>
            <span>{{ g.date | date: 'EEEE, d MMMM y' }} @if (isToday(g.date)) { <span class="badge text-bg-gold ms-1">Today</span> }</span>
          </h2>
          <div class="d-grid gap-2">
            @for (iv of g.items; track iv.id) {
              <app-interview-item [interview]="iv" [showContext]="true" (changed)="onChanged($event)" />
            }
          </div>
        </section>
      } @empty {
        <app-empty-state illustration="empty-interviews" title="No interviews here"
          message="When a company requests an interview, schedule it from the submission page." />
      }
    }
  `,
  styles: `
    .status { min-width: 200px; }
    .day { margin-bottom: var(--an-space-5); }
    .day-h { display: flex; align-items: center; gap: var(--an-space-3); font-size: 1rem; margin-bottom: var(--an-space-3); }
    .cal { display: inline-flex; flex-direction: column; align-items: center; width: 46px; border-radius: 10px; overflow: hidden;
      border: 1px solid var(--an-border); background: #fff; line-height: 1.1; }
    .cal span { width: 100%; text-align: center; background: var(--an-gold-500); color: var(--an-navy-950); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 2px 0; }
    .cal strong { font-size: 1.1rem; padding: 3px 0; color: var(--an-navy-900); }
  `,
})
export default class RecruiterInterviewsComponent {
  private readonly api = inject(RecruitmentService);
  protected readonly statuses = STATUSES;
  protected readonly upcoming = signal(true);
  protected readonly status = signal<InterviewStatus | ''>('');
  protected readonly mine = signal(false);
  protected readonly list = signal<CandidateInterview[]>([]);

  protected readonly data = rxResource({
    params: () => ({ upcoming: this.upcoming() || undefined, status: this.status() || undefined, mine: this.mine() || undefined }),
    stream: ({ params }) => this.api.interviews(params),
  });

  protected readonly groups = computed<DayGroup[]>(() => {
    const asc = this.upcoming();
    const sorted = [...this.list()].sort((a, b) => {
      const d = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      return asc ? d : -d;
    });
    const map = new Map<string, DayGroup>();
    for (const iv of sorted) {
      const d = new Date(iv.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const g = map.get(key) ?? { key, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] };
      g.items.push(iv);
      map.set(key, g);
    }
    return [...map.values()];
  });

  constructor() {
    effect(() => {
      const v = this.data.value();
      // The contract returns an array; tolerate a paginated envelope too.
      const items = Array.isArray(v) ? v : ((v as unknown as { items?: CandidateInterview[] } | undefined)?.items ?? []);
      this.list.set(items);
    });
  }

  protected label(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected isToday(d: Date): boolean {
    return d.toDateString() === new Date().toDateString();
  }

  onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as InterviewStatus | '');
  }

  onChanged(iv: CandidateInterview): void {
    this.list.update((l) => l.map((x) => (x.id === iv.id ? iv : x)));
  }
}
