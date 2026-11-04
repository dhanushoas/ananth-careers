import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { RecruiterOption } from '../../../core/models';
import { FORM_KIT } from '../../../shared/components/field-error.component';
import { MODAL_DATA, ModalRef } from '../../../shared/ui/modal.service';

export interface AssignDialogData {
  title: string;
  currentId?: string | null;
}

/** Recruiter picker. Closes with `{ recruiterId }` (null = unassign). */
@Component({
  selector: 'app-assign-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5 mb-0"><i class="bi bi-person-check text-gold" aria-hidden="true"></i> {{ data.title }}</h2>
      <button type="button" class="btn-close" aria-label="Close" data-modal-dismiss></button>
    </div>
    <div class="modal-body">
      @if (loading()) {
        <p class="text-secondary"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading recruiters…</p>
      } @else {
        <div class="form-floating">
          <select class="form-select" id="as-recruiter" [formControl]="pick">
            <option value="">Unassigned</option>
            @for (r of recruiters(); track r.id) {
              <option [value]="r.id">{{ r.name }}{{ r.designation ? ' — ' + r.designation : '' }}</option>
            }
          </select>
          <label for="as-recruiter">Recruiter</label>
        </div>
        <button type="button" class="btn btn-link px-0 mt-2" (click)="assignMe()"><i class="bi bi-person-fill-check" aria-hidden="true"></i> Assign to me</button>
      }
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>Cancel</button>
      <button type="button" class="btn btn-primary" (click)="save()" [disabled]="loading()">Save</button>
    </div>
  `,
})
export class AssignDialogComponent implements OnInit {
  protected readonly data = inject<AssignDialogData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<{ recruiterId: string | null }>>(ModalRef);
  private readonly api = inject(RecruitmentService);
  private readonly auth = inject(AuthService);
  protected readonly recruiters = signal<RecruiterOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly pick = new FormControl(this.data.currentId ?? '', { nonNullable: true });

  ngOnInit(): void {
    this.api
      .recruiters()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((list) => this.recruiters.set(list));
  }

  assignMe(): void {
    const me = this.auth.user()?.id;
    if (me) this.ref.close({ recruiterId: me });
  }

  save(): void {
    this.ref.close({ recruiterId: this.pick.value || null });
  }
}
