import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { MatchItem, Shortlist } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { MatchRingComponent } from '../shared/match-ring.component';
import { formatInr, refName, scoreTone } from '../shared/recruiter-utils';

/** Ranked candidate matches for a requirement. Ranking only — never auto-rejects. */
@Component({
  selector: 'app-matching-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, SkeletonComponent, StatusChipComponent, StageBadgeComponent, EnumLabelPipe, MatchRingComponent],
  template: `
    <div class="card mb-3 filters">
      <div class="card-body">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-5">
            <label for="m-min" class="form-label small mb-1">Minimum match score: <strong>{{ minScore() }}%</strong></label>
            <input type="range" class="form-range" id="m-min" min="0" max="100" step="5" [value]="minScore()" (change)="onMin($event)" />
          </div>
          <div class="col-6 col-md-3">
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" role="switch" id="m-consent" [checked]="consentOnly()" (change)="consentOnly.set(checked($event))" />
              <label class="form-check-label" for="m-consent">Consented profiles only</label>
            </div>
          </div>
          <div class="col-6 col-md-4">
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" role="switch" id="m-incl" [checked]="includeShortlisted()" (change)="includeShortlisted.set(checked($event))" />
              <label class="form-check-label" for="m-incl">Include already shortlisted</label>
            </div>
          </div>
        </div>
        <p class="small text-secondary mb-0 mt-2">
          <i class="bi bi-info-circle" aria-hidden="true"></i> Ranking only — never auto-rejects. Scores are weighted by the matching settings
          @if (weightsText()) { ({{ weightsText() }}) }
          @if (matches.value()?.poolSize !== undefined) { · {{ matches.value()?.poolSize }} candidates evaluated }.
        </p>
      </div>
    </div>

    @if (matches.isLoading()) {
      <app-skeleton variant="card" [count]="3" />
    } @else if (matches.error()) {
      <app-empty-state tone="error" title="Matches could not be loaded">
        <button class="btn btn-primary" type="button" (click)="matches.reload()">Retry</button>
      </app-empty-state>
    } @else {
      <ol class="list-unstyled d-grid gap-3 m-0">
        @for (m of items(); track m.candidate.id; let i = $index) {
          <li class="card match" data-testid="match-row" [class]="'card match tone-' + tone(m.match.score)">
            <div class="card-body">
              <div class="d-flex flex-wrap gap-3 align-items-start">
                <span class="rank" aria-label="Rank">#{{ i + 1 }}</span>
                <app-match-ring [score]="m.match.score" [size]="60" />
                <div class="who">
                  <h3 class="h6 mb-1">
                    <a [routerLink]="['/recruiter/candidates', m.candidate.id]">{{ name(m) }}</a>
                  </h3>
                  <p class="small text-secondary mb-1">{{ m.candidate.headline || 'No headline' }}</p>
                  <p class="small mb-2">
                    {{ m.candidate.totalExperienceYears ?? 0 }} yrs · {{ m.candidate.careerLevel | enumLabel }}
                    @if (m.candidate.location?.city; as city) { · {{ city }} }
                    @if (m.candidate.noticePeriodDays !== null && m.candidate.noticePeriodDays !== undefined) { · {{ m.candidate.noticePeriodDays }}d notice }
                    @if (m.candidate.expectedSalary?.min; as min) { · expects {{ inr(min) }} }
                  </p>
                  <div class="d-flex flex-wrap gap-2">
                    @if (m.candidate.stage) { <app-stage-badge [stage]="m.candidate.stage" /> }
                    <span class="badge" [class]="m.candidate.consent?.profileSharing ? 'badge text-bg-success' : 'badge text-bg-secondary'">
                      <i [class]="m.candidate.consent?.profileSharing ? 'bi bi-shield-check' : 'bi bi-shield-x'" aria-hidden="true"></i>
                      Profile sharing {{ m.candidate.consent?.profileSharing ? 'consented' : 'not consented' }}
                    </span>
                    @if (m.candidate.consent?.contactSharing) {
                      <span class="badge text-bg-info"><i class="bi bi-telephone" aria-hidden="true"></i> Contact sharing</span>
                    }
                    @if (m.shortlistStatus) { <app-status-chip [status]="m.shortlistStatus" [label]="'Shortlist: ' + (m.shortlistStatus | enumLabel)" /> }
                    @if (m.submissionStatus) { <app-status-chip [status]="m.submissionStatus" [label]="'Submission: ' + (m.submissionStatus | enumLabel)" /> }
                  </div>
                </div>
                <div class="act">
                  <button type="button" class="btn btn-gold" (click)="shortlist(m)" [disabled]="!canShortlist(m) || busy() === m.candidate.id">
                    @if (busy() === m.candidate.id) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> } @else { <i class="bi bi-star" aria-hidden="true"></i> }
                    Shortlist
                  </button>
                  <button type="button" class="btn btn-sm btn-link" (click)="toggle(m.candidate.id)" [attr.aria-expanded]="open().has(m.candidate.id)"
                    [attr.aria-controls]="'factors-' + m.candidate.id">
                    {{ open().has(m.candidate.id) ? 'Hide' : 'Show' }} breakdown
                  </button>
                </div>
              </div>
              @if (open().has(m.candidate.id)) {
                <ul class="factors" [id]="'factors-' + m.candidate.id">
                  @for (f of m.match.factors; track f.key) {
                    <li>
                      <div class="d-flex justify-content-between small">
                        <span class="fw-semibold">{{ f.label }} <span class="text-secondary fw-normal">· weight {{ f.weight }}</span></span>
                        <span>{{ pct(f.score) }}%</span>
                      </div>
                      <div class="progress" role="progressbar" [attr.aria-valuenow]="pct(f.score)" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="f.label + ' score'">
                        <div class="progress-bar" [class]="'progress-bar f-' + tone(pct(f.score))" [style.width.%]="pct(f.score)"></div>
                      </div>
                      <p class="small text-secondary mb-0 mt-1">{{ f.reason }}</p>
                    </li>
                  }
                </ul>
              }
            </div>
          </li>
        } @empty {
          <li><app-empty-state illustration="empty-search" title="No matching candidates" message="Lower the minimum score or include profiles without consent to see more of the pool." /></li>
        }
      </ol>
    }
  `,
  styles: `
    .match { border-left: 4px solid var(--an-border-strong); }
    .match.tone-high { border-left-color: var(--an-success); }
    .match.tone-mid { border-left-color: var(--an-gold-500); }
    .rank { font-family: var(--an-font-heading); font-weight: 800; color: var(--an-text-muted); min-width: 2.2rem; padding-top: 18px; }
    .who { flex: 1 1 240px; min-width: 0; }
    .who a { color: var(--an-navy-900); text-decoration: none; }
    .who a:hover { text-decoration: underline; }
    .act { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    @media (max-width: 575.98px) { .act { flex-direction: row; width: 100%; justify-content: space-between; } }
    .factors { list-style: none; margin: var(--an-space-3) 0 0; padding: var(--an-space-3) 0 0; border-top: 1px dashed var(--an-border);
      display: grid; gap: var(--an-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
    .f-high { background: var(--an-success); }
    .f-mid { background: var(--an-gold-500); }
    .f-low { background: var(--an-neutral); }
  `,
})
export class MatchingTabComponent {
  readonly requirementId = input.required<string>();
  readonly shortlisted = output<Shortlist>();

  private readonly api = inject(RecruitmentService);
  private readonly toast = inject(ToastService);

  protected readonly minScore = signal(0);
  protected readonly consentOnly = signal(false);
  protected readonly includeShortlisted = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly open = signal<Set<string>>(new Set());
  /** Local overrides after shortlisting (candidateId → status). */
  private readonly overrides = signal<Record<string, Shortlist['status']>>({});

  protected readonly matches = rxResource({
    params: () => ({
      id: this.requirementId(),
      minScore: this.minScore() || undefined,
      consentOnly: this.consentOnly() || undefined,
      includeShortlisted: this.includeShortlisted(),
    }),
    stream: ({ params }) =>
      this.api.matches(params.id, { minScore: params.minScore, consentOnly: params.consentOnly, includeShortlisted: params.includeShortlisted }),
  });

  protected readonly items = computed<MatchItem[]>(() => {
    const o = this.overrides();
    return (this.matches.value()?.items ?? []).map((m) => (o[m.candidate.id] ? { ...m, shortlistStatus: o[m.candidate.id] } : m));
  });

  protected readonly weightsText = computed(() => {
    const w = this.matches.value()?.weights;
    if (!w) return '';
    const labels: Record<string, string> = { skills: 'skills', experience: 'experience', education: 'education', location: 'location', salary: 'salary', noticePeriod: 'notice' };
    return Object.entries(w)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${labels[k] ?? k} ${v}`)
      .join(', ');
  });

  protected canShortlist(m: MatchItem): boolean {
    if (m.submissionStatus) return false;
    return !m.shortlistStatus || m.shortlistStatus === 'removed' || m.shortlistStatus === 'rejected';
  }

  protected name(m: MatchItem): string {
    return refName(m.candidate.user, 'Candidate');
  }

  protected tone(score: number): string {
    return scoreTone(score);
  }

  protected pct(score: number): number {
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  }

  protected inr(v: number | null | undefined): string {
    return formatInr(v);
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  onMin(event: Event): void {
    this.minScore.set(Number((event.target as HTMLInputElement).value));
  }

  toggle(id: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  shortlist(m: MatchItem): void {
    this.busy.set(m.candidate.id);
    this.api
      .shortlist({ jobId: this.requirementId(), candidateId: m.candidate.id, source: 'match' })
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe((s) => {
        this.overrides.update((o) => ({ ...o, [m.candidate.id]: s.status }));
        this.toast.success('Candidate shortlisted');
        if (s.status === 'pending_approval') {
          this.toast.info('Pending admin approval — you can submit it to the company once approved.');
        }
        this.shortlisted.emit(s);
      });
  }
}
