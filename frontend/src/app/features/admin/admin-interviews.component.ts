import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize, map } from 'rxjs';
import { RecruitmentService } from '../../core/services/recruitment.service';
import { AuthService } from '../../core/auth/auth.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { CandidateInterview, PersonRef, Ref } from '../../core/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { ADMIN_LIST_STYLES, oneOf, updateQuery } from './admin-shared';

const STATUSES = ['scheduled', 'rescheduled', 'completed', 'cancelled'] as const;
type InterviewStatusFilter = (typeof STATUSES)[number];

const MODE_ICONS: Record<string, string> = { in_person: 'bi-geo-alt', video: 'bi-camera-video', phone: 'bi-telephone' };

@Component({
  selector: 'app-admin-interviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent, PageHeaderComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe],
  template: `
    <app-page-header
      eyebrow="Recruitment"
      title="Interview management"
      subtitle="Interviews coordinated by Veejee Services recruiters between candidates and client companies."
      illustration="interviews"
    />

    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-6">
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" role="switch" id="iv-upcoming" [checked]="upcoming()" (change)="onUpcoming($event)" />
              <label class="form-check-label" for="iv-upcoming">Upcoming interviews only</label>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="form-floating">
              <select class="form-select" id="iv-status" (change)="onStatus($event)">
                <option value="" [selected]="!status()">All statuses</option>
                @for (s of statuses; track s) {
                  <option [value]="s" [selected]="status() === s">{{ s | enumLabel }}</option>
                }
              </select>
              <label for="iv-status">Status</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    @if (loading() && !items().length) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (error(); as err) {
      <app-empty-state tone="error" title="Couldn't load interviews" [message]="err">
        <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
      </app-empty-state>
    } @else if (!items().length) {
      <app-empty-state illustration="empty-interviews" title="No interviews" message="Interviews scheduled by recruiters will appear here." />
    } @else {
      <p class="count">{{ items().length }} interview{{ items().length === 1 ? '' : 's' }}</p>
      <ul class="list-unstyled d-grid gap-3 m-0">
        @for (iv of items(); track iv.id) {
          <li class="card iv" data-testid="admin-interview-row">
            <div class="card-body d-flex flex-wrap gap-3 align-items-start">
              <div class="date" aria-hidden="true">
                <span class="d-m">{{ iv.scheduledAt | date: 'MMM' }}</span>
                <span class="d-d">{{ iv.scheduledAt | date: 'd' }}</span>
              </div>
              <div class="min-w-0 flex-grow-1">
                <div class="cell-main">{{ name(iv.candidate) }} <span class="text-secondary fw-normal">for</span> {{ iv.job?.title || 'Requirement' }}</div>
                <div class="cell-sub"><i class="bi bi-building" aria-hidden="true"></i> {{ iv.employer?.companyName || 'Client company' }}</div>
                <div class="cell-sub">
                  <i class="bi bi-clock" aria-hidden="true"></i> {{ iv.scheduledAt | date: 'EEE, d MMM y, h:mm a' }} · {{ iv.durationMinutes }} min
                  · <i [class]="'bi ' + modeIcon(iv.mode)" aria-hidden="true"></i> {{ iv.mode | enumLabel }}
                </div>
                @if (iv.location) {
                  <div class="cell-sub"><i class="bi bi-pin-map" aria-hidden="true"></i> {{ iv.location }}</div>
                }
              </div>
              <div class="d-flex flex-column align-items-end gap-1">
                <app-status-chip [status]="iv.status" />
                <app-status-chip [status]="iv.candidateResponse" [label]="'Candidate: ' + (iv.candidateResponse | enumLabel)" />
                @if (canRecruit() && iv.submission) {
                  <a class="btn btn-sm btn-light mt-1" [routerLink]="['/recruiter/submissions', iv.submission]">Open submission</a>
                }
              </div>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .min-w-0 { min-width: 0; }
      .iv { border-left: 4px solid var(--an-navy-700); }
      .date { width: 56px; flex: none; text-align: center; border-radius: var(--an-radius); background: var(--an-navy-900); color: #fff; padding: 6px 0; }
      .d-m { display: block; font-size: 0.72rem; text-transform: uppercase; color: var(--an-gold-300); letter-spacing: 0.06em; }
      .d-d { display: block; font-family: var(--an-font-heading); font-weight: 800; font-size: 1.4rem; line-height: 1; }
    `,
  ],
})
export default class AdminInterviewsComponent {
  private readonly recruitment = inject(RecruitmentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly canRecruit = inject(AuthService).canRecruit;

  protected readonly statuses = STATUSES;
  protected readonly items = signal<CandidateInterview[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly upcoming = computed(() => this.params().get('upcoming') !== 'false');
  protected readonly status = computed<InterviewStatusFilter | undefined>(() => oneOf(this.params().get('status'), STATUSES));

  constructor() {
    effect(() => {
      this.upcoming();
      this.status();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const src: Observable<CandidateInterview[]> = this.recruitment
      .interviews({ upcoming: this.upcoming() || undefined, status: this.status() })
      .pipe(map((r: CandidateInterview[] | { items?: CandidateInterview[] }) => (Array.isArray(r) ? r : (r.items ?? []))));
    src.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (list) => this.items.set([...list].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())),
      error: (e: unknown) => this.error.set(friendlyMessage(toAppError(e))),
    });
  }

  onUpcoming(event: Event): void {
    updateQuery(this.router, this.route, { upcoming: (event.target as HTMLInputElement).checked ? null : 'false' });
  }

  onStatus(event: Event): void {
    updateQuery(this.router, this.route, { status: (event.target as HTMLSelectElement).value || null });
  }

  protected modeIcon(mode: string): string {
    return MODE_ICONS[mode] ?? 'bi-calendar2-event';
  }

  protected name(p: Ref<PersonRef> | undefined): string {
    return !p ? 'Candidate' : typeof p === 'string' ? 'Candidate' : p.name;
  }
}
