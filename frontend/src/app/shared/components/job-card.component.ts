import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Job } from '../../core/models';
import { SalaryRangePipe } from '../pipes/salary-range.pipe';
import { TimeAgoPipe } from '../pipes/time-ago.pipe';
import { EnumLabelPipe } from '../pipes/enum-label.pipe';
import { LocationsPipe } from '../pipes/location.pipe';
import { CompanyLogoComponent } from './company-logo.component';

@Component({
  selector: 'app-job-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SalaryRangePipe, TimeAgoPipe, EnumLabelPipe, LocationsPipe, CompanyLogoComponent],
  template: `
    @let j = job();
    <article class="job card card-hover h-100" [class.featured]="j.featured" data-testid="job-card" [attr.aria-labelledby]="'job-title-' + j.id">
      <div class="card-body d-flex flex-column gap-3">
        <div class="top">
          <app-company-logo [employerId]="j.employer?.id" [hasLogo]="j.employer?.hasLogo ?? false" [name]="company()" [size]="48" />
          <div class="heading">
            <h3 class="title" [id]="'job-title-' + j.id">
              <a [routerLink]="['/jobs', j.slug || j.id]" class="stretched">{{ j.title }}</a>
            </h3>
            <p class="company">{{ company() }}@if (j.employer?.verificationStatus === 'verified') {<i class="bi bi-patch-check-fill verified" aria-label="Verified employer" title="Verified employer"></i>}</p>
          </div>
          @if (showSave()) {
            <button
              type="button"
              class="btn btn-light btn-icon save"
              [attr.aria-label]="saved() ? 'Remove ' + j.title + ' from saved jobs' : 'Save ' + j.title"
              [attr.aria-pressed]="saved()"
              [disabled]="saving()"
              (click)="saveToggle.emit(j)"
            >
              <i [class]="saved() ? 'bi bi-bookmark-fill text-gold' : 'bi bi-bookmark'" aria-hidden="true"></i>
            </button>
          }
        </div>

        <ul class="meta" aria-label="Job details">
          <li><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ j.locations | locations }}</li>
          <li><i class="bi bi-briefcase" aria-hidden="true"></i>{{ experienceText() }}</li>
          <li><i class="bi bi-cash-stack" aria-hidden="true"></i>{{ j.salary | salaryRange }}</li>
        </ul>

        <ul class="chips">
          @if (j.featured) {
            <li class="badge text-bg-gold"><i class="bi bi-star-fill" aria-hidden="true"></i> Featured</li>
          }
          <li class="badge chip">{{ j.employmentType | enumLabel }}</li>
          <li class="badge chip">{{ j.workMode | enumLabel }}</li>
          @if (j.industry) {
            <li class="badge chip">{{ j.industry.name }}</li>
          }
        </ul>

        @if (j.skills.length && !compact()) {
          <p class="skills"><span class="visually-hidden">Skills: </span>{{ skillsText() }}</p>
        }

        <div class="footer">
          <span>
            @if (j.hasApplied) {
              <span class="applied"><i class="bi bi-check2-circle" aria-hidden="true"></i> Applied</span>
            } @else {
              Posted {{ j.publishedAt || j.createdAt | timeAgo }}
            }
          </span>
          <span class="cta" aria-hidden="true">View job <i class="bi bi-arrow-right"></i></span>
        </div>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .job { position: relative; }
    .job.featured { border-top: 3px solid var(--an-gold-500); }
    .top { display: flex; gap: var(--an-space-3); align-items: flex-start; }
    .heading { flex: 1; min-width: 0; }
    .title {
      font-size: 1.05rem; line-height: 1.3; margin: 0 0 2px; overflow-wrap: anywhere;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .title a { color: var(--an-navy-900); text-decoration: none; }
    .stretched::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
    .title a:focus-visible { outline: none; }
    .job:has(.stretched:focus-visible) { outline: 3px solid var(--an-gold-500); outline-offset: 2px; }
    .company { margin: 0; color: var(--an-text-2); font-size: 0.92rem; overflow-wrap: anywhere; }
    .verified { color: var(--an-info); margin-left: 4px; font-size: 0.9rem; position: relative; z-index: 1; }
    .save { position: relative; z-index: 1; margin: -6px -6px 0 0; flex: none; }
    .meta { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; color: var(--an-text-2); font-size: 0.9rem; }
    .meta li { display: flex; align-items: center; gap: 8px; min-width: 0; overflow-wrap: anywhere; }
    .meta .bi { color: var(--an-gold-600); }
    .chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { background: var(--an-surface-2); color: var(--an-text-2); border: 1px solid var(--an-border); font-weight: 500; }
    .skills { margin: 0; font-size: 0.85rem; color: var(--an-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: var(--an-space-3);
      border-top: 1px solid var(--an-border); font-size: 0.85rem; color: var(--an-text-muted); }
    .applied { color: var(--an-success); font-weight: 600; }
    .cta { font-weight: 600; color: var(--an-navy-700); display: inline-flex; align-items: center; gap: 4px; }
    .cta .bi { transition: transform var(--an-dur) var(--an-ease); }
    .job:hover .cta .bi { transform: translateX(3px); }
  `,
})
export class JobCardComponent {
  readonly job = input.required<Job>();
  readonly showSave = input(false);
  readonly saved = input(false);
  readonly saving = input(false);
  readonly compact = input(false);
  readonly saveToggle = output<Job>();

  /** Confidential requirements hide the client (employer is null). */
  protected readonly company = computed(() => {
    const j = this.job();
    return j.employer?.companyName ?? j.companyName ?? 'Veejee Services client (confidential)';
  });

  protected readonly experienceText = computed(() => {
    const e = this.job().experience;
    if (!e || (e.min === 0 && e.max === 0)) {
      return 'Fresher';
    }
    if (e.min === e.max) {
      return `${e.min} yr${e.min === 1 ? '' : 's'}`;
    }
    return `${e.min}–${e.max} yrs`;
  });

  protected readonly skillsText = computed(() => {
    const skills = this.job().skills;
    const head = skills.slice(0, 4).join(' · ');
    return skills.length > 4 ? `${head} +${skills.length - 4}` : head;
  });
}
