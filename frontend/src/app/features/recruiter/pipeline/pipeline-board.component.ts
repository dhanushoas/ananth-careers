import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { CANDIDATE_STAGES, CandidateProfile, CandidateStage, STAGE_LABELS } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { candidateName, initials, locationText, refName } from '../candidates/recruiter-utils';

const PAGE_LIMIT = 100;

/** Column accents by phase of the recruitment journey. */
function phase(stage: CandidateStage): 'intake' | 'screen' | 'company' | 'interview' | 'outcome' | 'closed' {
  if (['registered', 'profile_incomplete', 'profile_completed'].includes(stage)) return 'intake';
  if (['under_review', 'screening', 'shortlisted'].includes(stage)) return 'screen';
  if (['submitted', 'company_reviewing'].includes(stage)) return 'company';
  if (['interview_requested', 'interview_scheduled', 'interview_completed'].includes(stage)) return 'interview';
  if (['selected', 'placed'].includes(stage)) return 'outcome';
  return 'closed';
}

@Component({
  selector: 'app-pipeline-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-page-header eyebrow="Recruiter portal" title="Recruitment pipeline" illustration="analytics"
      subtitle="Every candidate’s journey with Veejee Services, from registration to successful placement." />

    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div class="btn-group" role="group" aria-label="Whose candidates">
        <input type="radio" class="btn-check" name="pl-scope" id="pl-me" [checked]="mine()" (change)="mine.set(true)" />
        <label class="btn btn-outline-primary" for="pl-me"><i class="bi bi-person" aria-hidden="true"></i> My candidates</label>
        <input type="radio" class="btn-check" name="pl-scope" id="pl-all" [checked]="!mine()" (change)="mine.set(false)" />
        <label class="btn btn-outline-primary" for="pl-all"><i class="bi bi-people" aria-hidden="true"></i> All candidates</label>
      </div>
      @if (data.value(); as d) {
        <span class="small text-secondary">
          {{ d.items.length }} of {{ d.total }} candidates shown@if (d.total > d.items.length) { (most recent {{ limit }}) }
        </span>
      }
    </div>

    @if (data.isLoading()) {
      <app-skeleton variant="card" [count]="4" />
    } @else if (data.error()) {
      <app-empty-state tone="error" title="The pipeline could not be loaded">
        <button class="btn btn-primary" type="button" (click)="data.reload()">Retry</button>
      </app-empty-state>
    } @else if (!(data.value()?.items?.length)) {
      <app-empty-state illustration="empty-candidates" title="No candidates in this pipeline yet"
        [message]="mine() ? 'Claim candidates from the candidate database to see them here.' : 'Candidates appear here as they register.'">
        <a class="btn btn-primary" routerLink="/recruiter/candidates" [queryParams]="{ assigned: 'unassigned' }">Find unassigned candidates</a>
      </app-empty-state>
    } @else {
      <!-- Desktop / tablet: kanban -->
      <div class="board d-none d-md-flex" tabindex="0" role="region" aria-label="Pipeline board, scroll horizontally">
        @for (col of columns(); track col.stage) {
          <section class="col-card" [class]="'col-card ph-' + col.phase" [attr.aria-label]="col.label + ', ' + col.items.length + ' candidates'">
            <header class="col-head">
              <span class="t">{{ col.label }}</span>
              <span class="badge rounded-pill count">{{ col.items.length }}</span>
            </header>
            <div class="col-body">
              @for (c of col.items; track c.id) {
                <a class="cand" [routerLink]="['/recruiter/candidates', c.id]">
                  <span class="av" aria-hidden="true">{{ initials(name(c)) }}</span>
                  <span class="min-w-0">
                    <span class="d-block fw-semibold text-truncate">{{ name(c) }}</span>
                    <span class="d-block small text-secondary text-truncate">{{ c.headline || loc(c.location) }}</span>
                    <span class="d-block small text-body-tertiary">{{ c.careerLevel === 'fresher' ? 'Fresher' : (c.totalExperienceYears ?? 0) + ' yrs' }} · {{ who(c) }}</span>
                  </span>
                </a>
              } @empty {
                <p class="empty small">No candidates</p>
              }
            </div>
          </section>
        }
      </div>

      <!-- Phones: accordion -->
      <div class="accordion d-md-none" id="pipeline-acc">
        @for (col of columns(); track col.stage) {
          @if (col.items.length) {
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button" type="button" [class.collapsed]="open() !== col.stage" (click)="toggle(col.stage)"
                  [attr.aria-expanded]="open() === col.stage" [attr.aria-controls]="'acc-' + col.stage">
                  <span class="dot" [class]="'dot ph-' + col.phase" aria-hidden="true"></span>
                  {{ col.label }} <span class="badge rounded-pill text-bg-light ms-2">{{ col.items.length }}</span>
                </button>
              </h2>
              <div class="accordion-collapse collapse" [class.show]="open() === col.stage" [id]="'acc-' + col.stage">
                <div class="accordion-body d-grid gap-2">
                  @for (c of col.items; track c.id) {
                    <a class="cand" [routerLink]="['/recruiter/candidates', c.id]">
                      <span class="av" aria-hidden="true">{{ initials(name(c)) }}</span>
                      <span class="min-w-0">
                        <span class="d-block fw-semibold text-truncate">{{ name(c) }}</span>
                        <span class="d-block small text-secondary text-truncate">{{ c.headline || loc(c.location) }}</span>
                      </span>
                    </a>
                  }
                </div>
              </div>
            </div>
          }
        }
      </div>
    }
  `,
  styles: `
    .board { gap: var(--an-space-3); overflow-x: auto; padding-bottom: var(--an-space-3); align-items: flex-start; scroll-snap-type: x proximity; }
    .col-card { flex: 0 0 250px; scroll-snap-align: start; background: var(--an-surface-2); border: 1px solid var(--an-border);
      border-radius: var(--an-radius-lg); border-top: 4px solid var(--accent, var(--an-navy-700)); max-height: 70vh; display: flex; flex-direction: column; }
    .col-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; font-weight: 700; font-size: 0.86rem; }
    .count { background: var(--an-surface); color: var(--an-text); border: 1px solid var(--an-border); }
    .col-body { display: grid; gap: 8px; padding: 0 10px 10px; overflow-y: auto; }
    .cand { display: flex; gap: 10px; align-items: center; padding: 10px; background: var(--an-surface); border: 1px solid var(--an-border);
      border-radius: var(--an-radius); text-decoration: none; color: inherit; transition: box-shadow var(--an-dur) var(--an-ease), transform var(--an-dur) var(--an-ease); }
    .cand:hover, .cand:focus-visible { box-shadow: var(--an-shadow-2); transform: translateY(-1px); }
    .av { flex: none; width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-900); color: var(--an-gold-300); font-size: 0.78rem; font-weight: 700; }
    .min-w-0 { min-width: 0; }
    .empty { color: var(--an-text-muted); text-align: center; margin: 8px 0; }
    .ph-intake { --accent: #8a94a6; } .ph-screen { --accent: var(--an-navy-700); } .ph-company { --accent: var(--an-info); }
    .ph-interview { --accent: var(--an-gold-500); } .ph-outcome { --accent: var(--an-success); } .ph-closed { --accent: var(--an-danger); }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; background: var(--accent); }
  `,
})
export default class PipelineBoardComponent {
  private readonly api = inject(RecruitmentService);
  protected readonly limit = PAGE_LIMIT;
  protected readonly mine = signal(true);
  protected readonly open = signal<CandidateStage | null>(null);

  protected readonly data = rxResource({
    params: () => ({ assigned: this.mine() ? 'me' : undefined, limit: PAGE_LIMIT, sort: 'recent' as const }),
    stream: ({ params }) => this.api.candidates(params),
  });

  protected readonly columns = computed(() => {
    const items = this.data.value()?.items ?? [];
    const by = new Map<CandidateStage, CandidateProfile[]>();
    for (const c of items) {
      const st = (c.stage ?? 'registered') as CandidateStage;
      by.set(st, [...(by.get(st) ?? []), c]);
    }
    return CANDIDATE_STAGES.map((stage) => ({ stage, label: STAGE_LABELS[stage], phase: phase(stage), items: by.get(stage) ?? [] }));
  });

  protected readonly name = candidateName;
  protected readonly initials = initials;
  protected readonly loc = locationText;

  protected who(c: CandidateProfile): string {
    return refName(c.assignedRecruiter ?? null, 'Unassigned');
  }

  toggle(stage: CandidateStage): void {
    this.open.update((s) => (s === stage ? null : stage));
  }
}
