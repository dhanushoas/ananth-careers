import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { EmployersService } from '../../core/services/employers.service';
import { TaxonomyService } from '../../core/services/taxonomy.service';
import { ToastService } from '../../core/services/toast.service';
import { toAppError } from '../../core/http/api-error';
import { COMPANY_SIZES, CompanySize, Employer, EmployerInput } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { FORM_KIT } from '../../shared/components/field-error.component';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { CompanyLogoComponent } from '../../shared/components/company-logo.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { applyServerErrors, emptyToUndefined, mobileValidator, numberOrUndefined, urlValidator } from '../../shared/utils/form-utils';
import { CompanyContextService } from './company-context.service';

@Component({
  selector: 'app-company-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_KIT, RouterLink, PageHeaderComponent, FileUploadComponent, CompanyLogoComponent, StatusChipComponent, EmptyStateComponent],
  template: `
    <app-page-header eyebrow="Company" title="Company profile" subtitle="Veejee Services uses these details to verify your company and to brief candidates about your requirements." illustration="company">
      @if (employer()?.verificationStatus === 'verified') {
        <a class="btn btn-outline-primary" [routerLink]="['/employers', employer()!.slug]">
          <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>View public page
        </a>
      }
    </app-page-header>

    @if (!employer()) {
      <app-empty-state tone="error" illustration="error" title="Company details could not be loaded" message="Please refresh the page or try again later.">
        <button class="btn btn-outline-primary" type="button" (click)="reload()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Retry</button>
      </app-empty-state>
    } @else {
      @let e = employer()!;
      <div class="layout">
        <aside class="side">
          <section class="card summary">
            <div class="cover" aria-hidden="true"></div>
            <div class="card-body pt-0">
              <div class="logo-wrap"><app-company-logo [employerId]="e.id" [hasLogo]="e.hasLogo" [name]="e.companyName" [size]="84" [version]="logoVersion()" /></div>
              <h2 class="h5 mt-3 mb-2 name">{{ e.companyName }}</h2>
              <div class="d-flex flex-wrap gap-2 mb-2">
                <app-status-chip [status]="e.verificationStatus" />
                @if (e.featured) { <app-status-chip status="featured" label="Featured" /> }
              </div>
              <ul class="list-unstyled small text-secondary mb-0 facts">
                @if (industryName(e)) { <li><i class="bi bi-grid" aria-hidden="true"></i>{{ industryName(e) }}</li> }
                @if (e.headquarters) { <li><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ e.headquarters }}</li> }
                @if (e.size) { <li><i class="bi bi-people" aria-hidden="true"></i>{{ e.size }} employees</li> }
              </ul>
              @if (e.verificationStatus === 'rejected' && e.rejectionReason) {
                <div class="alert alert-danger small py-2 mt-3 mb-0"><i class="bi bi-exclamation-octagon me-1" aria-hidden="true"></i>Verification rejected: {{ e.rejectionReason }}</div>
              }
            </div>
          </section>

          <section class="card">
              <div class="card-header d-flex align-items-center gap-2"><i class="bi bi-image text-gold" aria-hidden="true"></i><h2 class="h6 mb-0">Company logo</h2></div>
              <div class="card-body">
                <app-file-upload
                  label="Upload a logo"
                  hint="PNG, JPEG or WebP"
                  icon="bi-image"
                  accept="image/png,image/jpeg,image/webp"
                  [mimeTypes]="['image/png', 'image/jpeg', 'image/webp']"
                  [maxBytes]="2 * 1024 * 1024"
                  [busy]="uploading()"
                  (fileSelected)="uploadLogo($event)"
                />
              </div>
            </section>
        </aside>

        <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="card-header d-flex align-items-center gap-2"><i class="bi bi-building text-gold" aria-hidden="true"></i><h2 class="h6 mb-0">Company details</h2></div>
            <div class="card-body">
              @if (formError()) {
                <div class="alert alert-danger py-2" role="alert">{{ formError() }}</div>
              }
              <div class="row g-3 align-items-start">
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-name" type="text" formControlName="companyName" placeholder=" " required maxlength="150" autocomplete="organization" />
                    <label for="co-name">Company name</label>
                  </div>
                  <app-field-error [control]="form.controls.companyName" label="Company name" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <select class="form-select" id="co-industry" formControlName="industry" required>
                      <option value="" disabled>Select an industry</option>
                      @for (i of industries(); track i.id) {
                        <option [value]="i.id">{{ i.name }}</option>
                      }
                    </select>
                    <label for="co-industry">Industry</label>
                  </div>
                  <app-field-error [control]="form.controls.industry" label="Industry" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-website" type="url" formControlName="website" placeholder=" " />
                    <label for="co-website">Website</label>
                  </div>
                  <app-field-error [control]="form.controls.website" label="Website" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <select class="form-select" id="co-size" formControlName="size">
                      <option value="">Not specified</option>
                      @for (sz of sizes; track sz) {
                        <option [value]="sz">{{ sz }} employees</option>
                      }
                    </select>
                    <label for="co-size">Company size</label>
                  </div>
                </div>
                <div class="col-12">
                  <div class="form-floating">
                    <textarea class="form-control" id="co-desc" formControlName="description" maxlength="5000" placeholder=" " style="height: 9rem"></textarea>
                    <label for="co-desc">About the company</label>
                  </div>
                  <div class="form-text">Shown on your public company page. Describe your mission, culture and benefits.</div>
                  <app-field-error [control]="form.controls.description" label="Description" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-founded" type="number" formControlName="foundedYear" placeholder=" " min="1800" [max]="currentYear" />
                    <label for="co-founded">Founded year</label>
                  </div>
                  <app-field-error [control]="form.controls.foundedYear" label="Founded year" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-hq" type="text" formControlName="headquarters" placeholder=" " maxlength="150" />
                    <label for="co-hq">Headquarters</label>
                  </div>
                </div>
                <div class="col-12">
                  <div class="form-floating">
                    <textarea class="form-control" id="co-address" formControlName="address" maxlength="500" placeholder=" " style="height: 5.5rem"></textarea>
                    <label for="co-address">Address</label>
                  </div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-reg" type="text" formControlName="registrationNumber" placeholder=" " maxlength="50" />
                    <label for="co-reg">Registration number (CIN / GSTIN)</label>
                  </div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-cperson" type="text" formControlName="contactPerson" placeholder=" " maxlength="120" autocomplete="name" />
                    <label for="co-cperson">Contact person</label>
                  </div>
                  <div class="form-text">The person Veejee Services coordinates hiring with.</div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-cemail" type="email" formControlName="contactEmail" placeholder=" " />
                    <label for="co-cemail">Contact email</label>
                  </div>
                  <app-field-error [control]="form.controls.contactEmail" label="Contact email" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-floating">
                    <input class="form-control" id="co-cphone" type="tel" formControlName="contactPhone" placeholder=" " />
                    <label for="co-cphone">Contact phone</label>
                  </div>
                  <app-field-error [control]="form.controls.contactPhone" label="Contact phone" />
                </div>
              </div>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-end">
              <button class="btn btn-primary" type="submit" [disabled]="saving()">
                @if (saving()) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> } @else { <i class="bi bi-check2" aria-hidden="true"></i> }
                Save company profile
              </button>
            </div>
          </form>
      </div>
    }
  `,
  styles: `
    .layout { display: grid; gap: var(--an-space-4); grid-template-columns: minmax(0, 1fr); align-items: start; }
    @media (min-width: 1200px) { .layout { grid-template-columns: 320px minmax(0, 1fr); } }
    .side { display: grid; gap: var(--an-space-4); min-width: 0; }
    .summary { overflow: hidden; }
    .cover { height: 84px; background:
      radial-gradient(circle at 85% 20%, rgba(247, 130, 27, 0.45) 0, transparent 40%),
      repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 12px),
      linear-gradient(120deg, var(--an-navy-900), var(--an-navy-600)); }
    .logo-wrap { margin-top: -42px; display: inline-block; padding: 4px; background: #fff; border-radius: 16px; box-shadow: var(--an-shadow-2); }
    .name { overflow-wrap: anywhere; }
    .facts { display: grid; gap: 6px; }
    .facts .bi { color: var(--an-gold-600); margin-right: 6px; }
  `,
})
export default class CompanyProfileComponent implements OnInit {
  protected readonly ctx = inject(CompanyContextService);
  private readonly employers = inject(EmployersService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly employer = this.ctx.employer;
  protected readonly industries = toSignal(inject(TaxonomyService).industries().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly sizes = COMPANY_SIZES;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly logoVersion = signal<number>(Date.now());
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    companyName: ['', [Validators.required, Validators.maxLength(150)]],
    industry: ['', Validators.required],
    website: ['', urlValidator],
    description: ['', Validators.maxLength(5000)],
    size: ['' as CompanySize | ''],
    foundedYear: [null as number | null, [Validators.min(1800), Validators.max(this.currentYear)]],
    headquarters: [''],
    address: [''],
    registrationNumber: [''],
    contactPerson: ['', Validators.maxLength(120)],
    contactEmail: ['', Validators.email],
    contactPhone: ['', mobileValidator],
  });

  ngOnInit(): void {
    const e = this.employer();
    if (e) {
      this.patch(e);
    }
  }

  reload(): void {
    this.ctx
      .reload()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const e = this.employer();
        if (e) this.patch(e);
      });
  }

  save(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: EmployerInput = {
      companyName: v.companyName.trim(),
      industry: v.industry,
      website: emptyToUndefined(v.website),
      description: emptyToUndefined(v.description),
      size: v.size || undefined,
      foundedYear: numberOrUndefined(v.foundedYear),
      headquarters: emptyToUndefined(v.headquarters),
      address: emptyToUndefined(v.address),
      registrationNumber: emptyToUndefined(v.registrationNumber),
      contactPerson: emptyToUndefined(v.contactPerson),
      contactEmail: emptyToUndefined(v.contactEmail),
      contactPhone: emptyToUndefined(v.contactPhone),
    };
    this.saving.set(true);
    this.employers
      .updateMe(body)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (e) => {
          this.ctx.setEmployer(e);
          this.patch(e);
          this.toast.success('Company profile saved');
        },
        error: (err: unknown) => {
          const rest = applyServerErrors(this.form, toAppError(err));
          if (rest.length) this.formError.set(rest.join(' '));
        },
      });
  }

  uploadLogo(file: File): void {
    this.uploading.set(true);
    this.employers
      .uploadLogo(file)
      .pipe(
        finalize(() => this.uploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        const current = this.employer();
        // The upload may return the employer or only a status payload; keep hasLogo true either way.
        const next = res && typeof res === 'object' && 'companyName' in res ? (res as Employer) : current;
        if (next) this.ctx.setEmployer({ ...next, hasLogo: true });
        this.logoVersion.set(Date.now());
        this.toast.success('Logo updated');
      });
  }

  /** The backend may send a null industry despite the model typing. */
  protected industryName(e: Employer): string {
    const ind = e.industry as Employer['industry'] | null | undefined;
    return ind?.name ?? '';
  }

  private patch(e: Employer): void {
    this.form.reset({
      companyName: e.companyName,
      industry: e.industry?.id ?? '',
      website: e.website ?? '',
      description: e.description ?? '',
      size: e.size ?? '',
      foundedYear: e.foundedYear ?? null,
      headquarters: e.headquarters ?? '',
      address: e.address ?? '',
      registrationNumber: e.registrationNumber ?? '',
      contactPerson: e.contactPerson ?? '',
      contactEmail: e.contactEmail ?? '',
      contactPhone: e.contactPhone ?? '',
    });
  }
}
