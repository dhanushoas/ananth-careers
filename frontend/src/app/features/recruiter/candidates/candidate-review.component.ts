import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { ResumesService } from '../../../core/services/resumes.service';
import { TaxonomyService } from '../../../core/services/taxonomy.service';
import { ToastService } from '../../../core/services/toast.service';
import { toAppError } from '../../../core/http/api-error';
import { Industry, RecruiterOption, ResumeMeta, Shortlist } from '../../../core/models';
import { ConfirmService } from '../../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { FORM_KIT } from '../../../shared/components/field-error.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe, enumLabel } from '../../../shared/pipes/enum-label.pipe';
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { DropdownComponent } from '../../../shared/ui/dropdown.component';
import { ModalService } from '../../../shared/ui/modal.service';
import { saveBlobResponse } from '../../../shared/utils/download';
import {
  CandidateDialogData,
  ContactCandidateDialogComponent,
  ShortlistDialogComponent,
  StageDialogComponent,
} from './candidate-dialogs';
import { candidateName, candidateUser, expectedSalaryText, inr, initials, locationText, noticeText, refId, refName } from './recruiter-utils';

type Tab = 'applications' | 'shortlists' | 'submissions' | 'interviews' | 'consent';

@Component({
  selector: 'app-candidate-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...FORM_KIT,
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    SkeletonComponent,
    StageBadgeComponent,
    StatusChipComponent,
    EnumLabelPipe,
    FileSizePipe,
    TimeAgoPipe,
    DropdownComponent,
  ],
  templateUrl: './candidate-review.component.html',
  styleUrl: './candidate-review.component.scss',
})
export default class CandidateReviewComponent {
  readonly id = input.required<string>();

  private readonly api = inject(RecruitmentService);
  private readonly resumesApi = inject(ResumesService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.candidate(params) });
  protected readonly recruiters = toSignal(this.api.recruiters().pipe(catchError(() => of<RecruiterOption[]>([]))), {
    initialValue: [] as RecruiterOption[],
  });
  private readonly industries = toSignal(inject(TaxonomyService).industries().pipe(catchError(() => of<Industry[]>([]))), {
    initialValue: [] as Industry[],
  });

  protected readonly tab = signal<Tab>('applications');
  protected readonly busy = signal(false);
  protected readonly notFound = computed(() => toAppError(this.detail.error()).errorCode === 'NOT_FOUND');
  protected readonly c = computed(() => this.detail.value()?.candidate);
  protected readonly user = computed(() => candidateUser(this.c()));
  protected readonly name = computed(() => candidateName(this.c()));
  protected readonly techSkills = computed(() => (this.c()?.skills ?? []).filter((s) => s.type === 'technical'));
  protected readonly softSkills = computed(() => (this.c()?.skills ?? []).filter((s) => s.type !== 'technical'));
  protected readonly assignedId = computed(() => refId(this.c()?.assignedRecruiter ?? null));
  protected readonly assignedName = computed(() => refName(this.c()?.assignedRecruiter ?? null, '') || this.recruiters().find((r) => r.id === this.assignedId())?.name || '');
  protected readonly myId = computed(() => this.auth.user()?.id ?? '');
  protected readonly industryNames = computed(() =>
    (this.c()?.preferredIndustries ?? []).map((id) => this.industries().find((i) => i.id === id)?.name ?? id),
  );
  protected readonly requirementOptions = computed(() => {
    const d = this.detail.value();
    const map = new Map<string, string>();
    for (const s of d?.shortlists ?? []) map.set(s.job.id, s.job.title);
    for (const a of d?.applications ?? []) map.set(a.job.id, a.job.title);
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  });

  protected readonly noteForm = inject(FormBuilder).nonNullable.group({
    body: ['', [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)]],
    jobId: '',
  });

  protected readonly initials = initials;
  protected readonly loc = locationText;
  protected readonly inr = inr;
  protected readonly expected = expectedSalaryText;
  protected readonly notice = noticeText;
  protected readonly personName = refName;

  constructor() {
    const title = inject(Title);
    effect(() => {
      if (this.c()) title.setTitle(`${this.name()} – Candidate review | Veejee Services`);
    });
  }

  private dialogData(extra: Partial<CandidateDialogData> = {}): CandidateDialogData {
    return { candidateId: this.id(), name: this.name(), stage: this.c()?.stage, ...extra };
  }

  openStage(): void {
    this.modal
      .open<StageDialogComponent, CandidateDialogData, boolean>(StageDialogComponent, { data: this.dialogData() })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) {
          this.toast.success('Stage updated');
          this.detail.reload();
        }
      });
  }

  openContact(): void {
    this.modal
      .open<ContactCandidateDialogComponent, CandidateDialogData, boolean>(ContactCandidateDialogComponent, { data: this.dialogData(), size: 'lg' })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.toast.success('Message sent to the candidate');
      });
  }

  openShortlist(): void {
    this.modal
      .open<ShortlistDialogComponent, CandidateDialogData, Shortlist>(ShortlistDialogComponent, { data: this.dialogData() })
      .afterClosed()
      .subscribe((s) => {
        if (s) {
          this.toast.success(s.status === 'pending_approval' ? 'Candidate shortlisted – awaiting approval' : 'Candidate shortlisted');
          this.tab.set('shortlists');
          this.detail.reload();
        }
      });
  }

  assign(recruiterId: string | null): void {
    this.busy.set(true);
    this.api
      .assignCandidate(this.id(), recruiterId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe(() => {
        this.toast.success(recruiterId ? 'Recruiter assigned' : 'Candidate unassigned');
        this.detail.reload();
      });
  }

  addNote(): void {
    if (this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }
    const v = this.noteForm.getRawValue();
    this.busy.set(true);
    this.api
      .addNote(this.id(), v.body.trim(), v.jobId || undefined)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe(() => {
        this.noteForm.reset({ body: '', jobId: '' });
        this.toast.success('Note added');
        this.detail.reload();
      });
  }

  deleteNote(noteId: string): void {
    this.confirm
      .open({ title: 'Delete this note?', message: 'The internal note will be permanently removed.', confirmText: 'Delete', tone: 'danger' })
      .subscribe((r) => {
        if (!r) return;
        this.api.deleteNote(noteId).subscribe(() => {
          this.toast.success('Note deleted');
          this.detail.reload();
        });
      });
  }

  download(r: ResumeMeta): void {
    this.resumesApi.download(r.id).subscribe((res) => saveBlobResponse(res, r.originalName || 'resume.pdf'));
  }

  protected jobTitle(job: { title?: string } | string | null | undefined): string {
    return job && typeof job !== 'string' ? (job.title ?? '—') : '—';
  }

  protected companyOf(e: unknown, fallback = 'Client company'): string {
    return e && typeof e === 'object' && 'companyName' in e ? String((e as { companyName: string }).companyName) : fallback;
  }

  protected listLabels(values: readonly string[] | undefined): string {
    return values?.length ? values.map(enumLabel).join(', ') : '—';
  }

  protected shortlistNote(s: Shortlist): string {
    return s.note ?? '';
  }
}
