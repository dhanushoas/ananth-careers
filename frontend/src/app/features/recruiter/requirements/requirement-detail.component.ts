import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { filter, finalize, switchMap } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { toAppError } from '../../../core/http/api-error';
import { CandidateApplication, CandidateProfile } from '../../../core/models';
import { ConfirmService } from '../../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../../shared/pipes/location.pipe';
import { SalaryRangePipe } from '../../../shared/pipes/salary-range.pipe';
import { ModalService } from '../../../shared/ui/modal.service';
import { AssignDialogComponent, AssignDialogData } from '../shared/assign-dialog.component';
import { refId, refName, refObj } from '../shared/recruiter-utils';
import { MatchingTabComponent } from './matching-tab.component';
import { ShortlistTabComponent } from './shortlist-tab.component';

type Tab = 'applicants' | 'matching' | 'shortlist' | 'submissions';

@Component({
  selector: 'app-requirement-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    SkeletonComponent,
    StatusChipComponent,
    EnumLabelPipe,
    LocationsPipe,
    SalaryRangePipe,
    MatchingTabComponent,
    ShortlistTabComponent,
  ],
  templateUrl: './requirement-detail.component.html',
  styleUrl: './requirement-detail.component.scss',
})
export default class RequirementDetailComponent {
  readonly id = input.required<string>();
  /** Optional ?tab= deep link. */
  readonly tab = input<string>();

  private readonly api = inject(RecruitmentService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'applicants', label: 'Applicants', icon: 'bi-inbox' },
    { key: 'matching', label: 'Candidate matching', icon: 'bi-magic' },
    { key: 'shortlist', label: 'Shortlist', icon: 'bi-star' },
    { key: 'submissions', label: 'Submissions', icon: 'bi-send-check' },
  ];
  protected readonly active = signal<Tab>('matching');
  protected readonly shortlistVersion = signal(0);
  protected readonly busy = signal<string | null>(null);
  protected readonly showDescription = signal(false);

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.requirement(params) });
  protected readonly req = computed(() => this.detail.value()?.requirement);
  protected readonly company = computed(() => {
    const r = this.req();
    return r ? (r.employer?.companyName ?? r.companyName ?? 'Confidential client') : '';
  });
  protected readonly notFound = computed(() => toAppError(this.detail.error()).errorCode === 'NOT_FOUND');
  protected readonly counts = computed(() => {
    const d = this.detail.value();
    return {
      applicants: d?.applications.length ?? 0,
      shortlist: d?.shortlists.filter((s) => s.status !== 'removed').length ?? 0,
      submissions: d?.submissions.length ?? 0,
    };
  });

  constructor() {
    effect(() => {
      const t = this.tab();
      if (t === 'applicants' || t === 'matching' || t === 'shortlist' || t === 'submissions') this.active.set(t);
    });
    const title = inject(Title);
    effect(() => {
      const r = this.req();
      if (r) title.setTitle(`${r.title} – Requirement | Veejee Services`);
    });
  }

  protected assignee(): string {
    const r = this.req();
    return r?.assignedRecruiter ? refName(r.assignedRecruiter) : 'Unassigned';
  }

  protected appName(a: CandidateApplication): string {
    return refName(a.candidate, 'Candidate');
  }

  protected appProfile(a: CandidateApplication): Partial<CandidateProfile> | null {
    return refObj<Partial<CandidateProfile>>(a.candidateProfile);
  }

  protected appProfileId(a: CandidateApplication): string | null {
    return refId(a.candidateProfile as string | { id: string } | undefined);
  }

  protected employerName(ref: unknown): string {
    return refName(ref as { companyName?: string } | string | null, this.company());
  }

  protected tabCount(key: Tab): number | null {
    const c = this.counts();
    return key === 'matching' ? null : c[key];
  }

  select(t: Tab): void {
    this.active.set(t);
  }

  onTabKey(event: KeyboardEvent, index: number): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : this.tabs.length - 1)) % this.tabs.length;
    this.active.set(this.tabs[next].key);
    queueMicrotask(() => document.getElementById(`rq-tab-${this.tabs[next].key}`)?.focus());
  }

  onShortlisted(): void {
    this.shortlistVersion.update((v) => v + 1);
    this.detail.reload();
  }

  assign(): void {
    const r = this.req();
    if (!r) return;
    this.modal
      .open<AssignDialogComponent, AssignDialogData, { recruiterId: string | null }>(AssignDialogComponent, {
        data: { title: 'Assign requirement', currentId: refId(r.assignedRecruiter) },
      })
      .afterClosed()
      .pipe(
        filter((res): res is { recruiterId: string | null } => !!res),
        switchMap((res) => this.api.assignRequirement(r.id, res.recruiterId)),
      )
      .subscribe(() => {
        this.toast.success('Requirement assignment updated');
        this.detail.reload();
      });
  }

  shortlistApplication(a: CandidateApplication): void {
    const candidateId = this.appProfileId(a);
    if (!candidateId) return;
    this.busy.set(a.id);
    this.api
      .shortlist({ jobId: this.id(), candidateId, applicationId: a.id, source: 'application' })
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe((s) => {
        this.toast.success('Candidate shortlisted');
        if (s.status === 'pending_approval') this.toast.info('Pending admin approval — you can submit it to the company once approved.');
        this.onShortlisted();
      });
  }

  notSuitable(a: CandidateApplication): void {
    this.confirm
      .open({
        title: `Mark ${this.appName(a)} as not shortlisted?`,
        message: 'The candidate will see that their application was not shortlisted for this role.',
        confirmText: 'Not shortlisted',
        tone: 'danger',
        reason: { label: 'Note (optional)' },
      })
      .pipe(
        filter((r) => !!r),
        switchMap((r) => this.api.updateApplication(a.id, 'not_shortlisted', r?.reason)),
      )
      .subscribe(() => {
        this.toast.success('Application updated');
        this.detail.reload();
      });
  }

  review(a: CandidateApplication): void {
    this.api.updateApplication(a.id, 'under_review').subscribe(() => {
      this.toast.success('Marked as under review');
      this.detail.reload();
    });
  }
}
