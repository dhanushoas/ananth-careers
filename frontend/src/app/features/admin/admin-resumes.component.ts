import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ResumesService } from '../../core/services/resumes.service';
import { ToastService } from '../../core/services/toast.service';
import { AdminResume } from '../../core/models';
import { saveBlobResponse } from '../../shared/utils/download';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PaginatorComponent, PageChange } from '../../shared/components/paginator.component';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { ADMIN_LIST_STYLES, PagedList, intParam, updateQuery } from './admin-shared';

@Component({
  selector: 'app-admin-resumes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PaginatorComponent,
    FileSizePipe,
  ],
  template: `
    <app-page-header eyebrow="Documents" title="Resumes" subtitle="Stored resumes are encrypted at rest. Downloads and deletions are audit-logged." illustration="resumes" />

    <div class="card mb-4">
      <div class="card-body">
        <div class="input-group" role="search">
          <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
          <div class="form-floating">
            <input class="form-control" id="res-q" type="search" placeholder=" " [formControl]="search" />
            <label for="res-q">Search by file or owner</label>
          </div>
        </div>
      </div>
    </div>

    @if (list.loading() && !list.items().length) {
      <app-skeleton variant="table" [count]="6" />
    } @else if (list.error(); as err) {
      <app-empty-state tone="error" illustration="error" title="Couldn't load resumes" [message]="err">
        <button class="btn btn-primary" type="button" (click)="reload()">Try again</button>
      </app-empty-state>
    } @else if (!list.items().length) {
      <app-empty-state illustration="empty-resumes" title="No resumes found" />
    } @else {
      <p class="count">{{ list.total() }} resume{{ list.total() === 1 ? '' : 's' }}</p>
      <div class="table-responsive d-none d-md-block">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Owner</th>
              <th scope="col">Size</th>
              <th scope="col">Uploaded</th>
              <th scope="col" class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of list.items(); track r.id) {
              @let owner = r.owner ?? r.user;
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <span class="pdf"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>
                    <div class="min-w-0">
                      <div class="cell-main">{{ r.originalName }}</div>
                      @if (r.isPrimary) {
                        <span class="badge text-bg-gold">Primary</span>
                      }
                    </div>
                  </div>
                </td>
                <td>
                  @if (owner) {
                    <div>{{ owner.name }}</div>
                    <div class="cell-sub">{{ owner.email }}</div>
                  } @else {
                    —
                  }
                </td>
                <td class="nowrap">{{ r.size | fileSize }}</td>
                <td class="nowrap">{{ r.createdAt | date: 'mediumDate' }}</td>
                <td>
                  <div class="actions-cell">
                    <button class="btn btn-sm btn-outline-primary" type="button" [disabled]="busy() === r.id" (click)="download(r)">
                      <i class="bi bi-download" aria-hidden="true"></i>Download
                    </button>
                    <button class="btn btn-sm btn-outline-danger" type="button" [disabled]="busy() === r.id" (click)="remove(r)">
                      <i class="bi bi-trash" aria-hidden="true"></i>Delete
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="mobile-list d-md-none">
        @for (r of list.items(); track r.id) {
          @let owner = r.owner ?? r.user;
          <article class="card m-card">
            <div class="card-body">
              <div class="d-flex align-items-start gap-3">
                <span class="pdf"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>
                <div class="min-w-0 flex-grow-1">
                  <div class="cell-main">{{ r.originalName }}</div>
                  <div class="cell-sub">{{ owner ? owner.name : '—' }} · {{ r.size | fileSize }} · {{ r.createdAt | date: 'mediumDate' }}</div>
                  @if (r.isPrimary) {
                    <span class="badge text-bg-gold">Primary</span>
                  }
                </div>
              </div>
              <div class="m-actions">
                <button class="btn btn-outline-primary" type="button" [disabled]="busy() === r.id" (click)="download(r)">
                  <i class="bi bi-download" aria-hidden="true"></i>Download
                </button>
                <button class="btn btn-outline-danger" type="button" [disabled]="busy() === r.id" (click)="remove(r)">
                  <i class="bi bi-trash" aria-hidden="true"></i>Delete
                </button>
              </div>
            </div>
          </article>
        }
      </div>
      <app-paginator [page]="list.page()" [limit]="list.limit()" [total]="list.total()" (pageChange)="onPage($event)" />
    }
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `.min-w-0 { min-width: 0; }
    .pdf { width: 40px; height: 40px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-danger-bg); color: var(--an-danger); font-size: 1.2rem; }`,
  ],
})
export default class AdminResumesComponent {
  private readonly admin = inject(AdminService);
  private readonly resumes = inject(ResumesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly list = new PagedList<AdminResume>();
  protected readonly busy = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly query = computed(() => ({
    q: this.params().get('q') ?? undefined,
    page: intParam(this.params().get('page'), 1),
    limit: intParam(this.params().get('limit'), 20),
  }));
  protected readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', { nonNullable: true });

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.list.load(this.admin.resumes(q)));
    });
    this.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => updateQuery(this.router, this.route, { q: v.trim() || null }));
  }

  onPage(e: PageChange): void {
    updateQuery(this.router, this.route, { page: e.page, limit: e.limit });
  }

  reload(): void {
    this.list.load(this.admin.resumes(this.query()));
  }

  download(r: AdminResume): void {
    this.busy.set(r.id);
    this.resumes
      .download(r.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe((res) => saveBlobResponse(res, r.originalName || 'resume.pdf'));
  }

  remove(r: AdminResume): void {
    this.confirm
      .open({
        title: 'Delete this resume?',
        message: `"${r.originalName}" will be permanently removed. This cannot be undone.`,
        confirmText: 'Delete',
        tone: 'danger',
      })
      .subscribe((res) => {
        if (!res) return;
        this.busy.set(r.id);
        this.admin
          .deleteResume(r.id)
          .pipe(finalize(() => this.busy.set(null)))
          .subscribe(() => {
            this.list.remove(r.id);
            this.toast.success('Resume deleted');
          });
      });
  }
}
