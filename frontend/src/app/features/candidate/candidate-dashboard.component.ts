import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CandidateInterview, CandidateProfile, CandidateSubmission, STAGE_LABELS } from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { ConsentBadgesComponent } from '../../shared/components/consent-badges.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StageTrackerComponent } from '../../shared/components/stage-tracker.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { CountUpComponent } from '../../shared/illustrations/count-up.component';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { RevealDirective } from '../../shared/illustrations/reveal.directive';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { SavedJobsState } from '../jobs/saved-jobs.state';
import { CandidateInterviewCardComponent } from './interview-card.component';

@Component({
  selector: 'app-candidate-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ConsentBadgesComponent,
    EmptyStateComponent,
    JobCardComponent,
    SkeletonComponent,
    StageTrackerComponent,
    StatusChipComponent,
    CountUpComponent,
    IllustrationComponent,
    RevealDirective,
    TimeAgoPipe,
    CandidateInterviewCardComponent,
  ],
  templateUrl: './candidate-dashboard.component.html',
  styleUrl: './candidate-dashboard.component.scss',
})
export default class CandidateDashboardComponent {
  private readonly api = inject(CandidateService);
  protected readonly auth = inject(AuthService);
  protected readonly saved = inject(SavedJobsState);

  protected readonly dashboard = rxResource({ stream: () => this.api.dashboard() });
  /** Profile supplies the candidate-visible stage history for the tracker. */
  protected readonly profile = rxResource({
    stream: () => this.api.profile().pipe(catchError(() => of<CandidateProfile | null>(null))),
  });
  protected readonly submissions = rxResource({
    stream: () => this.api.submissions().pipe(catchError(() => of<CandidateSubmission[]>([]))),
  });
  protected readonly interviewsOverride = signal<CandidateInterview[] | null>(null);

  protected readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0] || 'there');
  protected readonly stageLabel = computed(() => {
    const d = this.dashboard.value();
    return d ? d.stageLabel || STAGE_LABELS[d.stage] || d.stage : '';
  });
  protected readonly interviews = computed(() => this.interviewsOverride() ?? this.dashboard.value()?.upcomingInterviews ?? []);
  protected readonly activeSubmissions = computed(() => (this.submissions.value() ?? []).filter((s) => s.active).slice(0, 4));

  protected readonly nextStep = computed(() => {
    const d = this.dashboard.value();
    if (!d) return null;
    if (d.profileCompletion < 100) {
      return { icon: 'bi-person-lines-fill', text: 'Complete your profile so our recruiters can match you with client requirements.', link: '/candidate/profile', cta: 'Complete profile' };
    }
    if (!d.hasResume) {
      return { icon: 'bi-file-earmark-arrow-up', text: 'Upload your resume — it is reviewed by Veejee Services recruiters.', link: '/candidate/resumes', cta: 'Upload resume' };
    }
    if (!d.consent?.profileSharing) {
      return { icon: 'bi-shield-check', text: 'Allow profile sharing so we can submit you to client companies.', link: '/candidate/settings', cta: 'Review consent' };
    }
    return { icon: 'bi-search', text: 'Browse open requirements and apply through Veejee Services.', link: '/candidate/jobs', cta: 'Browse jobs' };
  });

  onInterviewUpdated(iv: CandidateInterview): void {
    this.interviewsOverride.set(this.interviews().map((i) => (i.id === iv.id ? iv : i)));
  }
}
