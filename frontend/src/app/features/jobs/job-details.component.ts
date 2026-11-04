import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ModalService } from '../../shared/ui/modal.service';
import { IllustrationComponent } from '../../shared/illustrations/illustration.component';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { JobsService } from '../../core/services/jobs.service';
import { ToastService } from '../../core/services/toast.service';
import { toAppError } from '../../core/http/api-error';
import { Job } from '../../core/models';
import { CompanyLogoComponent } from '../../shared/components/company-logo.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { JobCardComponent } from '../../shared/components/job-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../shared/pipes/location.pipe';
import { SalaryRangePipe } from '../../shared/pipes/salary-range.pipe';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ApplyDialogComponent, ApplyDialogResult } from './apply-dialog.component';
import { SavedJobsState } from './saved-jobs.state';

/** Company label; confidential requirements hide the client (employer is null). */
export function companyOf(job: Pick<Job, 'employer' | 'companyName'>): string {
  return job.employer?.companyName ?? job.companyName ?? 'Veejee Services client (confidential)';
}

@Component({
  selector: 'app-job-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    IllustrationComponent,
    CompanyLogoComponent,
    EmptyStateComponent,
    JobCardComponent,
    SkeletonComponent,
    StatusChipComponent,
    EnumLabelPipe,
    LocationsPipe,
    SalaryRangePipe,
    TimeAgoPipe,
  ],
  templateUrl: './job-details.component.html',
  styleUrl: './job-details.component.scss',
})
export default class JobDetailsComponent {
  readonly slug = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly saved = inject(SavedJobsState);
  private readonly jobsApi = inject(JobsService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly jobRes = rxResource({ params: () => this.slug(), stream: ({ params }) => this.jobsApi.get(params) });
  /** Local copy so `hasApplied` can flip after applying without a reload. */
  protected readonly job = linkedSignal<Job | undefined>(() => this.jobRes.value());
  protected readonly notFound = computed(() => toAppError(this.jobRes.error()).errorCode === 'NOT_FOUND');

  protected readonly similar = rxResource({
    params: () => {
      const j = this.job();
      return j ? { industry: j.industry.slug || j.industry.id, id: j.id } : undefined;
    },
    stream: ({ params }) =>
      this.jobsApi.search({ industry: params.industry, limit: 4, sort: 'latest' }).pipe(
        map((res) => res.items.filter((j) => j.id !== params.id).slice(0, 3)),
        catchError(() => of<Job[]>([])),
      ),
  });

  protected readonly deadlinePassed = computed(() => {
    const d = this.job()?.applicationDeadline;
    return !!d && new Date(d).getTime() < Date.now();
  });
  protected readonly isOpen = computed(() => this.job()?.status === 'published' && !this.deadlinePassed());
  protected readonly experienceText = computed(() => {
    const e = this.job()?.experience;
    if (!e || (e.min === 0 && e.max === 0)) return 'Fresher';
    return e.min === e.max ? `${e.min} years` : `${e.min}–${e.max} years`;
  });
  protected readonly company = computed(() => {
    const j = this.job();
    return j ? companyOf(j) : '';
  });
  protected readonly loginReturn = computed(() => ({ returnUrl: `/jobs/${this.slug()}` }));

  constructor() {
    const title = inject(Title);
    effect(() => {
      const j = this.job();
      if (j) title.setTitle(`${j.title} – ${companyOf(j)} | Veejee Services`);
    });
  }

  apply(): void {
    const job = this.job();
    if (!job) return;
    this.modal
      .open<ApplyDialogComponent, Job, ApplyDialogResult>(ApplyDialogComponent, { data: job, size: 'lg' })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.job.set({ ...job, hasApplied: true, applicationsCount: job.applicationsCount + (result.application ? 1 : 0) });
        if (result.application) {
          this.toast.success('Application submitted to Veejee Services');
        } else {
          this.toast.info('You have already applied for this job through Veejee Services.');
        }
      });
  }

  toggleSave(): void {
    const job = this.job();
    if (job) this.saved.toggle(job).subscribe();
  }

  share(): void {
    const job = this.job();
    if (!job) return;
    const url = `${location.origin}/jobs/${job.slug}`;
    if (navigator.share) {
      navigator.share({ title: job.title, text: `${job.title} – ${companyOf(job)}`, url }).catch(() => undefined);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => this.toast.success('Link copied to clipboard'),
        () => this.toast.error('Could not copy the link'),
      );
    }
  }

  goToApplications(): void {
    void this.router.navigateByUrl('/candidate/applications');
  }
}
