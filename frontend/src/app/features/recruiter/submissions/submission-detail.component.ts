import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { filter, finalize, switchMap } from 'rxjs';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ToastService } from '../../../core/services/toast.service';
import { toAppError } from '../../../core/http/api-error';
import { CandidateInterview, SubmissionStatus } from '../../../core/models';
import { ConfirmService } from '../../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { FORM_KIT } from '../../../shared/components/field-error.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe, enumLabel } from '../../../shared/pipes/enum-label.pipe';
import { InterviewActions } from '../shared/interview-actions.service';
import { InterviewItemComponent } from '../shared/interview-item.component';
import { refName, refObj } from '../shared/recruiter-utils';

const FINAL: readonly SubmissionStatus[] = ['placed', 'rejected', 'withdrawn'];

/** Status transitions a recruiter can set from the current submission status. */
export function nextStatuses(current: SubmissionStatus): SubmissionStatus[] {
  if (FINAL.includes(current)) return [];
  if (current === 'selected') return ['placed', 'on_hold', 'withdrawn'];
  const base: SubmissionStatus[] = ['selected', 'on_hold', 'rejected', 'withdrawn'];
  if (current === 'interview_scheduled') base.unshift('interview_completed');
  if (current === 'on_hold') base.unshift('company_reviewing');
  return base.filter((s) => s !== current);
}

@Component({
  selector: 'app-submission-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, DatePipe, RouterLink, EmptyStateComponent, SkeletonComponent, StageBadgeComponent, StatusChipComponent, EnumLabelPipe, InterviewItemComponent],
  templateUrl: './submission-detail.component.html',
  styleUrl: './submission-detail.component.scss',
})
export default class SubmissionDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(RecruitmentService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly interviewsUi = inject(InterviewActions);

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.submission(params) });
  protected readonly sub = computed(() => this.detail.value()?.submission);
  protected readonly interviews = signal<CandidateInterview[]>([]);
  protected readonly notFound = computed(() => toAppError(this.detail.error()).errorCode === 'NOT_FOUND');
  protected readonly company = computed(() => {
    const s = this.sub();
    return s ? refName(s.employer, s.job.companyName ?? 'Company') : '';
  });
  protected readonly profileId = computed(() => this.sub()?.candidateProfile?.id ?? null);
  protected readonly options = computed(() => {
    const s = this.sub();
    return s ? nextStatuses(s.status) : [];
  });
  protected readonly isFinal = computed(() => {
    const s = this.sub();
    return !!s && FINAL.includes(s.status);
  });
  protected readonly history = computed(() =>
    [...(this.sub()?.statusHistory ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  );
  protected readonly saving = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    status: ['' as SubmissionStatus | '', Validators.required],
    note: ['', Validators.maxLength(1000)],
    visibleToCandidate: [true],
    joiningDate: [''],
  });

  constructor() {
    effect(() => {
      const d = this.detail.value();
      this.interviews.set(
        [...(d?.interviews ?? [])].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
      );
    });
    const title = inject(Title);
    effect(() => {
      const s = this.sub();
      if (s) title.setTitle(`${s.candidate.name} → ${this.company()} | Veejee Services`);
    });
    this.form.controls.status.valueChanges.subscribe((st) => {
      const jd = this.form.controls.joiningDate;
      jd.setValidators(st === 'placed' ? [Validators.required] : []);
      jd.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected by(ref: unknown, role?: string): string {
    const name = refName(ref as { name?: string } | string | null, '');
    const who = role === 'company' ? 'Company' : role === 'candidate' ? 'Candidate' : role ? 'Veejee Services' : '';
    return [name, who && name ? `(${who})` : who].filter(Boolean).join(' ');
  }

  protected stars(n: number): number[] {
    return Array.from({ length: Math.max(0, Math.min(5, Math.round(n))) }, (_, i) => i);
  }

  protected resumeName(): string {
    const r = refObj<{ originalName: string }>(this.sub()?.resume);
    return r?.originalName ?? 'Primary resume';
  }

  schedule(): void {
    const s = this.sub();
    if (!s) return;
    this.interviewsUi
      .schedule({
        submissionId: s.id,
        candidateName: s.candidate.name,
        companyName: this.company(),
        preferredSlots: s.interviewRequest?.preferredSlots,
      })
      .subscribe(() => this.detail.reload());
  }

  onInterviewChanged(iv: CandidateInterview): void {
    this.interviews.update((list) => list.map((x) => (x.id === iv.id ? iv : x)));
    this.detail.reload();
  }

  updateStatus(): void {
    const s = this.sub();
    if (!s || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const status = v.status as SubmissionStatus;
    const danger = status === 'rejected' || status === 'withdrawn';
    this.confirm
      .open({
        title: `Change status to “${enumLabel(status)}”?`,
        message:
          status === 'placed'
            ? `This records ${s.candidate.name} as successfully placed with ${this.company()}. It cannot be undone.`
            : danger
              ? 'This is a final decision for this submission.'
              : 'The change is recorded in the submission timeline.',
        confirmText: 'Update',
        tone: danger ? 'danger' : 'default',
      })
      .pipe(
        filter((r) => !!r),
        switchMap(() => {
          this.saving.set(true);
          return this.api
            .updateSubmissionStatus(s.id, {
              status,
              note: v.note.trim() || undefined,
              visibleToCandidate: v.visibleToCandidate,
              joiningDate: status === 'placed' && v.joiningDate ? new Date(v.joiningDate).toISOString() : undefined,
            })
            .pipe(finalize(() => this.saving.set(false)));
        }),
      )
      .subscribe(() => {
        this.toast.success('Status updated');
        this.form.reset({ status: '', note: '', visibleToCandidate: true, joiningDate: '' });
        this.detail.reload();
      });
  }
}
