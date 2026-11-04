import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { CandidateProfile } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge.component';
import { enumLabel } from '../../../shared/pipes/enum-label.pipe';
import { candidateName, csv, expectedSalaryText, inr, initials, locationText, noticeText } from './recruiter-utils';

interface Row {
  label: string;
  icon: string;
  value: (c: CandidateProfile) => string;
}

@Component({
  selector: 'app-candidate-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent, SkeletonComponent, StageBadgeComponent],
  template: `
    <app-page-header eyebrow="Candidate database" title="Compare candidates" subtitle="Side-by-side view of up to four candidates." illustration="team">
      <a class="btn btn-outline-primary" routerLink="/recruiter/candidates"><i class="bi bi-arrow-left" aria-hidden="true"></i> Back to search</a>
    </app-page-header>

    @if (idList().length < 2) {
      <app-empty-state illustration="empty-search" title="Select 2 to 4 candidates to compare" message="Tick candidates in the candidate database, then choose Compare.">
        <a class="btn btn-primary" routerLink="/recruiter/candidates">Open candidate database</a>
      </app-empty-state>
    } @else if (data.isLoading()) {
      <app-skeleton variant="card" [count]="idList().length" />
    } @else if (data.error()) {
      <app-empty-state tone="error" title="Comparison could not be loaded">
        <button class="btn btn-primary" type="button" (click)="data.reload()">Retry</button>
      </app-empty-state>
    } @else if (data.value(); as list) {
      <div class="scroller" tabindex="0" role="region" aria-label="Candidate comparison">
        <table class="table compare mb-0">
          <thead>
            <tr>
              <th scope="col" class="attr"><span class="visually-hidden">Attribute</span></th>
              @for (c of list; track c.id) {
                <th scope="col">
                  <div class="head">
                    <span class="avatar" aria-hidden="true">{{ initials(name(c)) }}</span>
                    <a class="fw-semibold" [routerLink]="['/recruiter/candidates', c.id]">{{ name(c) }}</a>
                    <span class="small text-secondary fw-normal">{{ c.headline || '—' }}</span>
                    @if (c.stage) { <app-stage-badge [stage]="c.stage" [label]="c.stageLabel" /> }
                  </div>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.label) {
              <tr>
                <th scope="row" class="attr"><i [class]="'bi ' + row.icon" aria-hidden="true"></i> {{ row.label }}</th>
                @for (c of list; track c.id) {
                  <td>{{ row.value(c) }}</td>
                }
              </tr>
            }
            <tr>
              <th scope="row" class="attr"><i class="bi bi-stars" aria-hidden="true"></i> Skills</th>
              @for (c of list; track c.id) {
                <td>
                  <div class="skills">
                    @for (s of c.skills; track s.name) {
                      <span class="badge" [class]="s.type === 'technical' ? 'badge tech' : 'badge soft'">{{ s.name }}</span>
                    } @empty { — }
                  </div>
                </td>
              }
            </tr>
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .scroller { overflow-x: auto; border: 1px solid var(--an-border); border-radius: var(--an-radius-lg); background: var(--an-surface); box-shadow: var(--an-shadow-1); }
    .compare { min-width: 640px; table-layout: fixed; }
    .compare th, .compare td { vertical-align: top; padding: 0.85rem 1rem; }
    .compare thead th { text-transform: none; letter-spacing: 0; font-size: 0.95rem; color: var(--an-text); background: var(--an-navy-50); }
    .attr { width: 180px; position: sticky; left: 0; background: var(--an-surface-2) !important; z-index: 1; font-size: 0.82rem; color: var(--an-text-2); }
    .attr .bi { color: var(--an-gold-600); margin-right: 4px; }
    .head { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-900); color: var(--an-gold-300); font-weight: 700; }
    .skills { display: flex; flex-wrap: wrap; gap: 4px; }
    .tech { background: var(--an-navy-50); color: var(--an-navy-800); border: 1px solid var(--an-navy-100); }
    .soft { background: var(--an-gold-100); color: var(--an-gold-700); border: 1px solid var(--an-gold-300); }
  `,
})
export default class CandidateCompareComponent {
  /** `?ids=a,b,c` (bound via router input binding). */
  readonly ids = input<string>();
  private readonly api = inject(RecruitmentService);

  protected readonly idList = computed(() => csv(this.ids()).slice(0, 4));
  protected readonly data = rxResource({
    params: () => (this.idList().length >= 2 ? this.idList() : undefined),
    stream: ({ params }) =>
      this.api.compare(params).pipe(map((res) => (Array.isArray(res) ? res : (res.items ?? [])))),
  });

  protected readonly name = candidateName;
  protected readonly initials = initials;
  protected readonly rows: Row[] = [
    { label: 'Career level', icon: 'bi-ladder', value: (c) => enumLabel(c.careerLevel) || '—' },
    { label: 'Experience', icon: 'bi-briefcase', value: (c) => `${c.totalExperienceYears ?? 0} years` },
    { label: 'Current role', icon: 'bi-person-workspace', value: (c) => (c.experience?.find((e) => e.current) ?? c.experience?.[0])?.title ?? '—' },
    { label: 'Highest education', icon: 'bi-mortarboard', value: (c) => {
      const e = c.education?.[0];
      return e ? [e.qualification, e.specialization].filter(Boolean).join(' – ') : '—';
    } },
    { label: 'Location', icon: 'bi-geo-alt', value: (c) => locationText(c.location) },
    { label: 'Preferred locations', icon: 'bi-pin-map', value: (c) => c.preferredLocations?.join(', ') || '—' },
    { label: 'Work modes', icon: 'bi-laptop', value: (c) => c.preferredWorkModes?.map(enumLabel).join(', ') || '—' },
    { label: 'Current salary', icon: 'bi-cash', value: (c) => inr(c.currentSalary) },
    { label: 'Expected salary', icon: 'bi-cash-stack', value: (c) => expectedSalaryText(c) },
    { label: 'Notice period', icon: 'bi-hourglass', value: (c) => noticeText(c.noticePeriodDays) },
    { label: 'Availability', icon: 'bi-calendar-check', value: (c) => enumLabel(c.availability) || '—' },
    { label: 'Profile completion', icon: 'bi-pie-chart', value: (c) => `${c.profileCompletion ?? 0}%` },
    { label: 'Profile sharing consent', icon: 'bi-shield-check', value: (c) => (c.consent?.profileSharing ? 'Yes' : 'No') },
    { label: 'Contact sharing consent', icon: 'bi-telephone', value: (c) => (c.consent?.contactSharing ? 'Yes' : 'No') },
  ];
}
