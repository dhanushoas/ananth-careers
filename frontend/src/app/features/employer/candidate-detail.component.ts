import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, finalize, switchMap } from 'rxjs';
import { EmployerPortalService } from '../../core/services/employer-portal.service';
import { ResumesService } from '../../core/services/resumes.service';
import { ToastService } from '../../core/services/toast.service';
import { toAppError } from '../../core/http/api-error';
import { CandidateInterview, EmployerDecision, InterviewFeedback, Submission } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';
import { ModalService } from '../../shared/ui/modal.service';
import { saveBlobResponse } from '../../shared/utils/download';
import {
  FeedbackData,
  InterviewFeedbackDialogComponent,
  OPEN_SUBMISSION_STATUSES,
  RequestInterviewData,
  RequestInterviewDialogComponent,
  SUBMISSION_LABELS,
  canGiveFeedback,
  expectedSalaryText,
  interviewModeIcon,
} from './employer-ui';

@Component({
  selector: 'app-employer-candidate-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe],
  templateUrl: './candidate-detail.component.html',
  styleUrl: './candidate-detail.component.scss',
})
export default class CandidateDetailComponent implements OnInit {
  readonly submissionId = input.required<string>();

  private readonly api = inject(EmployerPortalService);
  private readonly resumes = inject(ResumesService);
  private readonly confirm = inject(ConfirmService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sub = signal<Submission | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<'not-found' | 'error' | null>(null);
  protected readonly busy = signal(false);
  protected readonly downloading = signal(false);

  protected readonly label = computed(() => {
    const s = this.sub();
    return s ? SUBMISSION_LABELS[s.status] : '';
  });
  protected readonly canDecide = computed(() => {
    const s = this.sub();
    return !!s && OPEN_SUBMISSION_STATUSES.includes(s.status);
  });
  protected readonly canRequestInterview = computed(() => {
    const s = this.sub();
    return !!s && ['submitted', 'company_reviewing', 'interview_completed', 'on_hold'].includes(s.status);
  });
  protected readonly salary = computed(() => {
    const s = this.sub();
    return s ? expectedSalaryText(s) : '';
  });
  protected readonly skills = computed(() => {
    const list = this.sub()?.candidateProfile?.skills ?? [];
    return {
      technical: list.filter((k) => k.type !== 'non_technical'),
      soft: list.filter((k) => k.type === 'non_technical'),
    };
  });
  protected readonly history = computed(() =>
    [...(this.sub()?.statusHistory ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  );
  protected readonly interviews = computed(() =>
    [...(this.sub()?.interviews ?? [])].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
  );
  protected readonly resumeId = computed(() => {
    const r = this.sub()?.resume;
    return typeof r === 'string' ? r : (r?.id ?? null);
  });
  protected readonly resumeName = computed(() => {
    const r = this.sub()?.resume;
    return r && typeof r === 'object' ? r.originalName : 'Resume.pdf';
  });

  protected readonly experience = computed(() => this.sub()?.candidateProfile?.experience ?? []);
  protected readonly education = computed(() => this.sub()?.candidateProfile?.education ?? []);
  protected readonly feedbackList = computed(() => this.sub()?.feedback ?? []);
  protected readonly preferredRoles = computed(() => (this.sub()?.candidateProfile?.preferredRoles ?? []).join(', '));
  protected readonly locationText = computed(() => {
    const l = this.sub()?.candidateProfile?.location;
    return [l?.city, l?.state].filter(Boolean).join(', ');
  });
  protected readonly recruiterName = computed(() => {
    const by = this.sub()?.submittedBy;
    return by && typeof by === 'object' ? by.name : '';
  });

  protected readonly modeIcon = interviewModeIcon;
  protected readonly canFeedback = canGiveFeedback;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .submission(this.submissionId())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (s) => this.sub.set(s),
        error: (err: unknown) => this.error.set(toAppError(err).errorCode === 'NOT_FOUND' ? 'not-found' : 'error'),
      });
  }

  accept(): void {
    this.decide('accept', {
      title: 'Accept this candidate?',
      message: 'Veejee Services will be notified that you would like to proceed with this candidate and will coordinate next steps (offer and joining).',
      confirmText: 'Accept',
      reason: { label: 'Note for Veejee Services (optional)', maxLength: 1000 },
      toast: 'Candidate accepted',
    });
  }

  reject(): void {
    this.decide('reject', {
      title: 'Reject this candidate?',
      message: 'The candidate will not be taken forward for this requirement. Veejee Services will inform the candidate. This cannot be undone.',
      confirmText: 'Reject',
      tone: 'danger',
      reason: { label: 'Reason (shared with Veejee Services)', maxLength: 1000 },
      toast: 'Candidate rejected',
    });
  }

  hold(): void {
    this.decide('on_hold', {
      title: 'Put this candidate on hold?',
      message: 'Veejee Services will keep the candidate warm while you decide.',
      confirmText: 'Put on hold',
      reason: { label: 'Note (optional)', maxLength: 1000 },
      toast: 'Candidate put on hold',
    });
  }

  requestInterview(): void {
    const s = this.sub();
    if (!s) return;
    this.modal
      .open<RequestInterviewDialogComponent, RequestInterviewData, Submission>(RequestInterviewDialogComponent, {
        data: { submissionId: s.id, candidateName: s.candidate.name },
        size: 'lg',
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) this.merge(updated);
      });
  }

  giveFeedback(iv: CandidateInterview): void {
    const s = this.sub();
    if (!s) return;
    this.modal
      .open<InterviewFeedbackDialogComponent, FeedbackData, InterviewFeedback>(InterviewFeedbackDialogComponent, {
        data: { interview: iv, candidateName: s.candidate.name },
      })
      .afterClosed()
      .subscribe((f) => {
        if (f) {
          this.sub.update((cur) => (cur ? { ...cur, feedback: [...(cur.feedback ?? []), { ...f, interview: f.interview ?? iv.id }] } : cur));
        }
      });
  }

  hasFeedback(iv: CandidateInterview): boolean {
    return (this.sub()?.feedback ?? []).some((f) => f.interview === iv.id);
  }

  download(): void {
    const id = this.resumeId();
    if (!id) return;
    this.downloading.set(true);
    this.resumes
      .download(id)
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => saveBlobResponse(res, this.resumeName()));
  }

  private decide(
    decision: EmployerDecision,
    opts: { title: string; message: string; confirmText: string; tone?: 'danger'; reason: { label: string; maxLength: number }; toast: string },
  ): void {
    const s = this.sub();
    if (!s) return;
    this.confirm
      .open({ title: opts.title, message: opts.message, confirmText: opts.confirmText, tone: opts.tone, reason: opts.reason })
      .pipe(
        switchMap((r): Observable<Submission> => {
          if (!r) return EMPTY;
          this.busy.set(true);
          return this.api.decide(s.id, decision, r.reason).pipe(finalize(() => this.busy.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        this.toast.success(opts.toast);
        this.merge(updated);
      });
  }

  /** Decision responses may omit populated fields; keep what we already have. */
  private merge(updated: Submission): void {
    this.sub.update((cur) =>
      cur
        ? {
            ...cur,
            status: updated.status ?? cur.status,
            statusHistory: updated.statusHistory?.length ? updated.statusHistory : cur.statusHistory,
            interviewRequest: updated.interviewRequest ?? cur.interviewRequest,
          }
        : updated,
    );
  }
}
