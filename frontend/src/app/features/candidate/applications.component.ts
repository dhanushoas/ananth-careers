import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  CANDIDATE_APPLICATION_STATUSES,
  CandidateApplication,
  CandidateApplicationStatus,
  CandidateSubmission,
} from '../../core/models';
import { CandidateService } from '../../core/services/candidate.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../shared/components/paginator.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { LocationsPipe } from '../../shared/pipes/location.pipe';
import { HistoryTimelineComponent } from './history-timeline.component';
import { CandidateInterviewCardComponent } from './interview-card.component';

type Tab = 'applications' | 'shared';

export const WITHDRAWABLE: readonly CandidateApplicationStatus[] = ['applied', 'under_review'];

/** Company shown for an application: confidential requirements hide the client. */
export function applicationCompany(a: CandidateApplication): string {
  const emp = a.job.employer;
  if (emp && typeof emp === 'object') return emp.companyName;
  return a.job.companyName ?? 'Veejee Services client (confidential)';
}

@Component({
  selector: 'app-candidate-applications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginatorComponent,
    SkeletonComponent,
    StatusChipComponent,
    EnumLabelPipe,
    LocationsPipe,
    HistoryTimelineComponent,
    CandidateInterviewCardComponent,
  ],
  templateUrl: './applications.component.html',
  styleUrl: './applications.component.scss',
})
export default class CandidateApplicationsComponent {
  /** ?status= filter for the applications tab. */
  readonly status = input<string>();
  /** ?tab=shared opens the second tab. */
  readonly tab = input<string>();

  private readonly api = inject(CandidateService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly statuses = CANDIDATE_APPLICATION_STATUSES;
  protected readonly activeTab = signal<Tab>('applications');
  protected readonly page = signal(1);
  protected readonly busyId = signal<string | null>(null);
  protected readonly expanded = signal<string | null>(null);

  protected readonly statusFilter = computed(() => {
    const s = this.status();
    return s && (CANDIDATE_APPLICATION_STATUSES as readonly string[]).includes(s) ? (s as CandidateApplicationStatus) : undefined;
  });

  protected readonly applications = rxResource({
    params: () => ({ status: this.statusFilter(), page: this.page(), limit: 10 }),
    stream: ({ params }) => this.api.applications(params),
  });
  protected readonly submissions = rxResource({ stream: () => this.api.submissions() });
  protected readonly sortedSubmissions = computed<CandidateSubmission[]>(() =>
    [...(this.submissions.value() ?? [])].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
  );

  constructor() {
    effect(() => {
      if (this.tab() === 'shared') this.activeTab.set('shared');
    });
  }

  protected company = applicationCompany;

  canWithdraw(a: CandidateApplication): boolean {
    return WITHDRAWABLE.includes(a.status);
  }

  setTab(t: Tab): void {
    this.activeTab.set(t);
    void this.router.navigate([], { queryParams: { tab: t === 'shared' ? 'shared' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.page.set(1);
    void this.router.navigate([], { queryParams: { status: value || null }, queryParamsHandling: 'merge' });
  }

  onPage(e: PageChange): void {
    this.page.set(e.page);
  }

  toggle(id: string): void {
    this.expanded.update((cur) => (cur === id ? null : id));
  }

  withdraw(a: CandidateApplication): void {
    this.confirm
      .open({
        title: 'Withdraw this application?',
        message: `Veejee Services will stop considering you for “${a.job.title}”. This cannot be undone.`,
        confirmText: 'Withdraw application',
        tone: 'danger',
        reason: { label: 'Reason (optional)', maxLength: 500 },
      })
      .subscribe((res) => {
        if (!res) return;
        this.busyId.set(a.id);
        this.api
          .withdraw(a.id, res.reason)
          .pipe(finalize(() => this.busyId.set(null)))
          .subscribe(() => {
            this.toast.success('Application withdrawn');
            this.applications.reload();
          });
      });
  }
}
