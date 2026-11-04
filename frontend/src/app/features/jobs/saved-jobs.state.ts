import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CandidateService } from '../../core/services/candidate.service';
import { ToastService } from '../../core/services/toast.service';
import { Job } from '../../core/models';

/** Tracks saved-job toggles for the signed-in candidate across job cards and details. */
@Injectable({ providedIn: 'root' })
export class SavedJobsState {
  private readonly auth = inject(AuthService);
  private readonly api = inject(CandidateService);
  private readonly toast = inject(ToastService);
  private readonly overrides = signal<Record<string, boolean>>({});
  private readonly pending = signal<Record<string, boolean>>({});

  readonly canSave = computed(() => this.auth.role() === 'candidate');

  isSaved(job: Job): boolean {
    const o = this.overrides()[job.id];
    return o ?? job.isSaved ?? false;
  }

  isPending(jobId: string): boolean {
    return this.pending()[jobId] === true;
  }

  toggle(job: Job): Observable<unknown> {
    const saved = this.isSaved(job);
    this.pending.update((p) => ({ ...p, [job.id]: true }));
    const req$ = saved ? this.api.unsaveJob(job.id) : this.api.saveJob(job.id);
    return req$.pipe(
      tap(() => {
        this.overrides.update((o) => ({ ...o, [job.id]: !saved }));
        this.toast.success(saved ? 'Removed from saved jobs' : 'Job saved');
      }),
      finalize(() => this.pending.update((p) => ({ ...p, [job.id]: false }))),
    );
  }
}
