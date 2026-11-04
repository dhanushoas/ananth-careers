import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, of, switchMap, tap } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { CandidateInterview } from '../../../core/models';
import { ConfirmService } from '../../../shared/components/confirm-dialog.component';
import { ModalService } from '../../../shared/ui/modal.service';
import { ScheduleInterviewData, ScheduleInterviewDialogComponent } from './schedule-interview-dialog.component';

/** Shared schedule / reschedule / cancel / complete flows for recruiter interview screens. */
@Injectable({ providedIn: 'root' })
export class InterviewActions {
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(RecruitmentService);
  private readonly toast = inject(ToastService);

  /** Emits the saved interview, or nothing when cancelled. */
  schedule(data: ScheduleInterviewData): Observable<CandidateInterview> {
    return this.modal
      .open<ScheduleInterviewDialogComponent, ScheduleInterviewData, CandidateInterview>(ScheduleInterviewDialogComponent, {
        data,
        size: 'lg',
      })
      .afterClosed()
      .pipe(filter((r): r is CandidateInterview => !!r));
  }

  cancel(iv: CandidateInterview): Observable<CandidateInterview> {
    return this.confirm
      .open({
        title: 'Cancel this interview?',
        message: 'The candidate and the company will be notified.',
        confirmText: 'Cancel interview',
        cancelText: 'Keep',
        tone: 'danger',
        reason: { label: 'Reason (optional)' },
      })
      .pipe(
        switchMap((r) =>
          r
            ? this.api.cancelInterview(iv.id, r.reason).pipe(map((res): CandidateInterview => ({ ...iv, ...(res ?? {}), status: 'cancelled' })))
            : of<CandidateInterview | null>(null),
        ),
        filter((r): r is CandidateInterview => !!r),
        tap(() => this.toast.success('Interview cancelled')),
      );
  }

  complete(iv: CandidateInterview): Observable<CandidateInterview> {
    return this.confirm
      .open({ title: 'Mark interview as completed?', message: 'The company can then share feedback.', confirmText: 'Mark completed' })
      .pipe(
        switchMap((r) =>
          r
            ? this.api.completeInterview(iv.id).pipe(map((res): CandidateInterview => ({ ...iv, ...(res ?? {}), status: 'completed' })))
            : of<CandidateInterview | null>(null),
        ),
        filter((r): r is CandidateInterview => !!r),
        tap(() => this.toast.success('Interview marked as completed')),
      );
  }
}
