import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SUBMISSION_STATUSES, Submission, SubmissionStatus } from '../../../core/models';
import { RecruitmentService } from '../../../core/services/recruitment.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { PageChange, PaginatorComponent } from '../../../shared/components/paginator.component';
import { SkeletonComponent } from '../../../shared/components/skeleton.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';
import { refName } from '../shared/recruiter-utils';

@Component({
  selector: 'app-submissions-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, PaginatorComponent, SkeletonComponent, StatusChipComponent, EnumLabelPipe],
  template: `
    <app-page-header eyebrow="Recruitment" title="Company submissions" illustration="applications"
      subtitle="Candidates Veejee Services has submitted to client companies, with their consent." />

    <form class="card mb-3" (ngSubmit)="search()" aria-label="Filter submissions">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-4">
            <div class="form-floating">
              <select class="form-select" id="sb-status" [value]="status() ?? ''" (change)="onStatus($event)">
                <option value="">All statuses</option>
                @for (s of statuses; track s) {
                  <option [value]="s" [selected]="status() === s">{{ s | enumLabel }}</option>
                }
              </select>
              <label for="sb-status">Status</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="form-floating">
              <input class="form-control" id="sb-emp" [formControl]="empCtrl" placeholder=" " />
              <label for="sb-emp">Company</label>
            </div>
          </div>
          <div class="col-7 col-md-2">
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" role="switch" id="sb-mine" [checked]="mineOn()" (change)="onMine($event)" />
              <label class="form-check-label" for="sb-mine">Mine only</label>
            </div>
          </div>
          <div class="col-5 col-md-2 d-grid">
            <button class="btn btn-primary" type="submit"><i class="bi bi-search" aria-hidden="true"></i> Apply</button>
          </div>
        </div>
      </div>
    </form>

    @if (list.isLoading()) {
      <app-skeleton variant="table" [count]="5" />
    } @else if (list.error()) {
      <app-empty-state tone="error" title="Submissions could not be loaded">
        <button class="btn btn-primary" type="button" (click)="list.reload()">Retry</button>
      </app-empty-state>
    } @else if (list.value(); as res) {
      <ul class="list-unstyled d-grid gap-2 m-0">
        @for (s of res.items; track s.id) {
          <li class="card card-hover sub" data-testid="submission-row">
            <div class="card-body row g-2 align-items-center">
              <div class="col-12 col-md-4 min-w-0">
                <a class="fw-semibold name stretched" [routerLink]="['/recruiter/submissions', s.id]">{{ s.candidate.name }}</a>
                <div class="small text-secondary text-truncate">{{ s.candidateProfile?.headline || '' }}</div>
              </div>
              <div class="col-12 col-md-4 min-w-0 small">
                <div class="text-truncate"><i class="bi bi-briefcase" aria-hidden="true"></i> {{ s.job.title }}</div>
                <div class="text-secondary text-truncate"><i class="bi bi-building" aria-hidden="true"></i> {{ company(s) }}</div>
              </div>
              <div class="col-7 col-md-2 small text-secondary">
                {{ s.createdAt | date: 'mediumDate' }}
                @if (s.contactShared) { <i class="bi bi-telephone text-success ms-1" title="Contact details shared" aria-label="Contact details shared"></i> }
              </div>
              <div class="col-5 col-md-2 text-end"><app-status-chip [status]="s.status" /></div>
            </div>
          </li>
        } @empty {
          <li><app-empty-state illustration="empty-data" title="No submissions found" message="Submit approved shortlisted candidates from a requirement's Shortlist tab." /></li>
        }
      </ul>
      <app-paginator [page]="res.page" [limit]="res.limit" [total]="res.total" (pageChange)="onPage($event)" />
    }
  `,
  styles: `
    .sub { position: relative; border-left: 4px solid var(--an-navy-700); }
    .min-w-0 { min-width: 0; }
    .name { color: var(--an-navy-900); text-decoration: none; }
    .stretched::after { content: ''; position: absolute; inset: 0; }
  `,
})
export default class SubmissionsListComponent {
  readonly status = input<string>();
  readonly employer = input<string>();
  readonly mine = input<string>();
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(RecruitmentService);
  private readonly router = inject(Router);
  protected readonly statuses = SUBMISSION_STATUSES;
  protected readonly empCtrl = new FormControl('', { nonNullable: true });
  protected readonly mineOn = computed(() => this.mine() === 'true');

  private readonly query = computed(() => {
    const st = this.status();
    return {
      status: st && (SUBMISSION_STATUSES as readonly string[]).includes(st) ? (st as SubmissionStatus) : undefined,
      employer: this.employer() || undefined,
      mine: this.mineOn() || undefined,
      page: this.page(),
      limit: 20,
    };
  });
  protected readonly list = rxResource({ params: () => this.query(), stream: ({ params }) => this.api.submissions(params) });

  constructor() {
    effect(() => this.empCtrl.setValue(this.employer() ?? '', { emitEvent: false }));
  }

  protected company(s: Submission): string {
    return refName(s.employer, s.job.companyName ?? 'Company');
  }

  onStatus(event: Event): void {
    this.go({ status: (event.target as HTMLSelectElement).value || null });
  }

  onMine(event: Event): void {
    this.go({ mine: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  search(): void {
    this.go({ employer: this.empCtrl.value.trim() || null });
  }

  private go(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: { ...params, page: null }, queryParamsHandling: 'merge' });
  }

  onPage(e: PageChange): void {
    void this.router.navigate([], { queryParams: { page: e.page }, queryParamsHandling: 'merge' });
  }
}
