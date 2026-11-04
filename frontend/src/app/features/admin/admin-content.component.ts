import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, of } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { silentContext } from '../../core/http/http-context';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { unwrapContent } from '../../core/services/content.service';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { CONTENT_KEYS, ContentKey, ContentValue } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { FieldErrorComponent, ValidationStateDirective } from '../../shared/components/field-error.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ADMIN_LIST_STYLES } from './admin-shared';
import { BiPipe } from '../../shared/ui/icons';

type Kind = 'faq' | 'home' | 'page' | 'process' | 'audience';
type BlockGroup = FormGroup<{ icon: FormControl<string>; title: FormControl<string>; body: FormControl<string> }>;
type Mode = 'form' | 'json';

const KEY_LABELS: Record<ContentKey, string> = {
  home: 'Home page',
  about: 'About us',
  services: 'Our services',
  process: 'Recruitment process',
  'job-seekers': 'For job seekers',
  employers: 'For employers',
  faq: 'FAQ',
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  refund: 'Refund policy',
};

const KEY_ICONS: Record<ContentKey, string> = {
  home: 'bi-house',
  about: 'bi-people',
  services: 'bi-briefcase',
  process: 'bi-diagram-3',
  'job-seekers': 'bi-person-badge',
  employers: 'bi-buildings',
  faq: 'bi-question-circle',
  privacy: 'bi-shield-lock',
  terms: 'bi-file-earmark-text',
  refund: 'bi-arrow-counterclockwise',
};

const DEFAULT_TITLES: Partial<Record<ContentKey, string>> = {
  about: 'About Veejee Services',
  services: 'Our services',
  process: 'How our recruitment process works',
  'job-seekers': 'For job seekers',
  employers: 'For employers',
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  refund: 'Refund policy',
};

function kindOf(key: ContentKey): Kind {
  if (key === 'process') return 'process';
  if (key === 'job-seekers' || key === 'employers') return 'audience';
  return key === 'faq' ? 'faq' : key === 'home' ? 'home' : 'page';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}

/** Editor for a list of {icon, title, body} blocks (benefits / process steps). */
@Component({
  selector: 'app-block-list-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldErrorComponent, ValidationStateDirective, BiPipe],
  template: `
    <div class="card">
      <div class="card-body">
        <h2 class="h6 mb-1"><i [class]="'bi ' + headingIcon() + ' me-2 text-gold'" aria-hidden="true"></i>{{ heading() }}</h2>
        <p class="cell-sub mb-3">Icon: a Bootstrap Icons name (e.g. <code>bi-shield-check</code>) or a Material Symbols name — previewed beside each item.</p>
        <div class="d-grid gap-3">
          @for (g of array().controls; track g; let i = $index) {
            <fieldset class="block" [formGroup]="g">
              <legend class="visually-hidden">{{ itemLabel() }} {{ i + 1 }}</legend>
              <div class="d-flex justify-content-between align-items-center mb-2 gap-2">
                <span class="d-flex align-items-center gap-2 min-w-0">
                  <span class="prev" aria-hidden="true"><i [class]="'bi ' + (g.controls.icon.value | bi: 'bi-circle')"></i></span>
                  <strong class="text-truncate">{{ itemLabel() }} {{ i + 1 }}</strong>
                </span>
                <span class="d-flex gap-1 flex-none">
                  <button class="btn btn-light btn-icon" type="button" (click)="move(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Move ' + itemLabel().toLowerCase() + ' ' + (i + 1) + ' up'"><i class="bi bi-arrow-up" aria-hidden="true"></i></button>
                  <button class="btn btn-light btn-icon" type="button" (click)="move(i, 1)" [disabled]="i === array().length - 1" [attr.aria-label]="'Move ' + itemLabel().toLowerCase() + ' ' + (i + 1) + ' down'"><i class="bi bi-arrow-down" aria-hidden="true"></i></button>
                  <button class="btn btn-light btn-icon text-danger" type="button" (click)="remove(i)" [attr.aria-label]="'Remove ' + itemLabel().toLowerCase() + ' ' + (i + 1)"><i class="bi bi-trash" aria-hidden="true"></i></button>
                </span>
              </div>
              <div class="row g-2 align-items-start">
                <div class="col-12 col-md-4">
                  <div class="form-floating">
                    <input class="form-control" [id]="prefix() + '-icon-' + i" formControlName="icon" placeholder=" " />
                    <label [for]="prefix() + '-icon-' + i">Icon</label>
                  </div>
                </div>
                <div class="col-12 col-md-8">
                  <div class="form-floating">
                    <input class="form-control" [id]="prefix() + '-title-' + i" formControlName="title" placeholder=" " />
                    <label [for]="prefix() + '-title-' + i">Title</label>
                  </div>
                  <app-field-error [control]="g.controls.title" label="Title" />
                </div>
                <div class="col-12">
                  <div class="form-floating">
                    <textarea class="form-control" [id]="prefix() + '-body-' + i" formControlName="body" placeholder=" " style="height: 6rem"></textarea>
                    <label [for]="prefix() + '-body-' + i">Description</label>
                  </div>
                  <app-field-error [control]="g.controls.body" label="Description" />
                </div>
              </div>
            </fieldset>
          }
        </div>
        <button class="btn btn-outline-primary mt-3" type="button" (click)="add.emit()"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add {{ itemLabel().toLowerCase() }}</button>
      </div>
    </div>
  `,
  styles: `
    .block { border-left: 3px solid var(--an-gold-500); padding: var(--an-space-3); background: var(--an-surface-2); border-radius: var(--an-radius); min-width: 0; }
    .prev { width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--an-navy-900); color: var(--an-gold-300); font-size: 1.1rem; }
    .min-w-0 { min-width: 0; }
    .flex-none { flex: none; }
    .cell-sub { font-size: 0.82rem; color: var(--an-text-muted); }
  `,
})
export class BlockListEditorComponent {
  readonly array = input.required<FormArray<BlockGroup>>();
  readonly heading = input('Items');
  readonly headingIcon = input('bi-list-check');
  readonly itemLabel = input('Item');
  readonly prefix = input('blk');
  readonly add = output<void>();
  readonly changed = output<void>();

  remove(i: number): void {
    this.array().removeAt(i);
    this.array().markAsDirty();
    this.changed.emit();
  }

  move(i: number, delta: number): void {
    const a = this.array();
    const j = i + delta;
    if (j < 0 || j >= a.length) return;
    const ctrl = a.at(i);
    a.removeAt(i, { emitEvent: false });
    a.insert(j, ctrl);
    a.markAsDirty();
    this.changed.emit();
  }
}

@Component({
  selector: 'app-admin-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    BlockListEditorComponent,
    ReactiveFormsModule,
    FieldErrorComponent,
    ValidationStateDirective,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-header eyebrow="CMS" title="Website content" subtitle="Edit the JSON content behind public pages. Changes go live as soon as you save." illustration="content">
      <button class="btn btn-primary" type="button" (click)="save()" [disabled]="saving() || loading() || !!loadError()" data-testid="content-save">
        @if (saving()) {
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        } @else {
          <i class="bi bi-floppy" aria-hidden="true"></i>
        }
        Save changes
      </button>
    </app-page-header>

    <div class="row g-4 align-items-start">
      <aside class="col-12 col-lg-3">
        <div class="d-lg-none mb-1">
          <div class="form-floating">
            <select #keySelect class="form-select" id="content-key" (change)="switchKey(keySelect.value, keySelect)">
              @for (k of keys; track k) {
                <option [value]="k" [selected]="k === key()">{{ labels[k] }} ({{ k }})</option>
              }
            </select>
            <label for="content-key">Content key</label>
          </div>
        </div>
        <nav class="list-group d-none d-lg-flex keys" aria-label="Content keys">
          @for (k of keys; track k) {
            <button
              type="button"
              class="list-group-item list-group-item-action d-flex align-items-center gap-2"
              [class.active]="k === key()"
              [attr.aria-current]="k === key() ? 'page' : null"
              (click)="switchKey(k)"
            >
              <i [class]="'bi ' + keyIcons[k]" aria-hidden="true"></i>
              <span class="flex-grow-1">{{ labels[k] }}</span>
              <code class="small">{{ k }}</code>
            </button>
          }
        </nav>
      </aside>

      <div class="col-12 col-lg-9">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <ul class="nav nav-pills" role="tablist" aria-label="Editor mode">
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link" role="tab" [class.active]="mode() === 'form'" [attr.aria-selected]="mode() === 'form'" (click)="setMode('form')">
                <i class="bi bi-ui-checks" aria-hidden="true"></i>Structured editor
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link" role="tab" [class.active]="mode() === 'json'" [attr.aria-selected]="mode() === 'json'" (click)="setMode('json')">
                <i class="bi bi-braces" aria-hidden="true"></i>Advanced JSON
              </button>
            </li>
          </ul>
          @if (dirty()) {
            <span class="badge text-bg-warning unsaved" role="status"><i class="bi bi-pencil-fill" aria-hidden="true"></i> Unsaved changes</span>
          }
        </div>

        @if (missing() && !loading()) {
          <div class="alert alert-info d-flex gap-2 align-items-start" role="status">
            <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
            <div>No content is stored for “{{ key() }}” yet — you are starting from a template. The public page shows a built-in fallback until you save.</div>
          </div>
        }

        @if (loading()) {
          <app-skeleton variant="card" [count]="2" />
        } @else if (loadError(); as err) {
          <app-empty-state tone="error" illustration="error" title="Couldn't load content" [message]="err">
            <button class="btn btn-primary" type="button" (click)="load(key())">Try again</button>
          </app-empty-state>
        } @else if (mode() === 'json') {
          <div class="card">
            <div class="card-body">
              <label class="form-label" for="content-json">JSON value for “{{ key() }}”</label>
              <textarea
                class="form-control code"
                id="content-json"
                [formControl]="json"
                rows="22"
                spellcheck="false"
                (input)="jsonDirty.set(true)"
                [class.is-invalid]="!!jsonError()"
                aria-describedby="content-json-hint"
              ></textarea>
              <div id="content-json-hint" class="form-text">Must be a JSON object.</div>
              @if (jsonError()) {
                <div class="invalid-feedback d-block" role="alert">{{ jsonError() }}</div>
              }
            </div>
          </div>
        } @else {
          @switch (kind()) {
            @case ('faq') {
              <form class="d-grid gap-3" [formGroup]="faqForm" (ngSubmit)="save()">
                @for (g of faqForm.controls.items.controls; track g; let i = $index) {
                  <fieldset class="card item" [formGroup]="g">
                    <div class="card-body">
                      <legend class="visually-hidden">Question {{ i + 1 }}</legend>
                      <div class="d-flex justify-content-between align-items-center mb-3">
                        <strong><span class="num">{{ i + 1 }}</span>Question</strong>
                        <span class="d-flex gap-1">
                          <button class="btn btn-light btn-icon" type="button" (click)="move(faqForm.controls.items, i, -1)" [disabled]="i === 0" aria-label="Move up"><i class="bi bi-arrow-up" aria-hidden="true"></i></button>
                          <button class="btn btn-light btn-icon" type="button" (click)="move(faqForm.controls.items, i, 1)" [disabled]="i === faqForm.controls.items.length - 1" aria-label="Move down"><i class="bi bi-arrow-down" aria-hidden="true"></i></button>
                          <button class="btn btn-light btn-icon text-danger" type="button" (click)="removeAt(faqForm.controls.items, i)" aria-label="Remove question"><i class="bi bi-trash" aria-hidden="true"></i></button>
                        </span>
                      </div>
                      <div class="row g-3 align-items-start">
                        <div class="col-12">
                          <div class="form-floating">
                            <input class="form-control" [id]="'faq-q-' + i" formControlName="question" placeholder=" " />
                            <label [for]="'faq-q-' + i">Question</label>
                          </div>
                          <app-field-error [control]="g.controls.question" label="Question" />
                        </div>
                        <div class="col-12">
                          <div class="form-floating">
                            <textarea class="form-control" [id]="'faq-a-' + i" formControlName="answer" placeholder=" " style="height: 7rem"></textarea>
                            <label [for]="'faq-a-' + i">Answer</label>
                          </div>
                          <app-field-error [control]="g.controls.answer" label="Answer" />
                        </div>
                      </div>
                    </div>
                  </fieldset>
                }
                <div><button class="btn btn-outline-primary" type="button" (click)="addFaq()"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add question</button></div>
              </form>
            }
            @case ('home') {
              <form class="d-grid gap-3" [formGroup]="homeForm" (ngSubmit)="save()">
                <div class="card">
                  <div class="card-body">
                    <h2 class="h6 mb-3"><i class="bi bi-stars me-2 text-gold" aria-hidden="true"></i>Hero</h2>
                    <div class="row g-3 align-items-start">
                      <div class="col-12">
                        <div class="form-floating">
                          <input class="form-control" id="home-title" formControlName="heroTitle" placeholder=" " />
                          <label for="home-title">Hero title</label>
                        </div>
                        <app-field-error [control]="homeForm.controls.heroTitle" label="Hero title" />
                      </div>
                      <div class="col-12">
                        <div class="form-floating">
                          <textarea class="form-control" id="home-sub" formControlName="heroSubtitle" placeholder=" " style="height: 6rem"></textarea>
                          <label for="home-sub">Hero subtitle</label>
                        </div>
                        <app-field-error [control]="homeForm.controls.heroSubtitle" label="Hero subtitle" />
                      </div>
                    </div>
                  </div>
                </div>
                <div class="card">
                  <div class="card-body">
                    <h2 class="h6 mb-1"><i class="bi bi-bar-chart me-2 text-gold" aria-hidden="true"></i>Highlight stats</h2>
                    <p class="cell-sub mb-3">Optional figures shown on the homepage (live platform stats are shown separately).</p>
                    @for (g of homeForm.controls.stats.controls; track g; let i = $index) {
                      <div class="row g-2 align-items-start mb-2" [formGroup]="g">
                        <div class="col-12 col-sm-6">
                          <div class="form-floating">
                            <input class="form-control" [id]="'stat-l-' + i" formControlName="label" placeholder=" " />
                            <label [for]="'stat-l-' + i">Label</label>
                          </div>
                          <app-field-error [control]="g.controls.label" label="Label" />
                        </div>
                        <div class="col-9 col-sm-4">
                          <div class="form-floating">
                            <input class="form-control" [id]="'stat-v-' + i" formControlName="value" placeholder=" " />
                            <label [for]="'stat-v-' + i">Value</label>
                          </div>
                          <app-field-error [control]="g.controls.value" label="Value" />
                        </div>
                        <div class="col-3 col-sm-2 d-flex">
                          <button class="btn btn-light text-danger w-100 stat-del" type="button" (click)="removeAt(homeForm.controls.stats, i)" aria-label="Remove stat">
                            <i class="bi bi-trash" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>
                    }
                    <button class="btn btn-outline-primary mt-2" type="button" (click)="addStat()"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add stat</button>
                  </div>
                </div>
              </form>
            }
            @case ('process') {
              <form class="d-grid gap-3" [formGroup]="blocksForm" (ngSubmit)="save()">
                <ng-container *ngTemplateOutlet="blockHead" />
                <app-block-list-editor [array]="blocksForm.controls.steps" heading="Process steps" headingIcon="bi-diagram-3" itemLabel="Step"
                  prefix="step" (add)="addBlock(blocksForm.controls.steps)" (changed)="markBlocksDirty()" />
              </form>
            }
            @case ('audience') {
              <form class="d-grid gap-3" [formGroup]="blocksForm" (ngSubmit)="save()">
                <ng-container *ngTemplateOutlet="blockHead" />
                <app-block-list-editor [array]="blocksForm.controls.benefits" heading="Benefits" headingIcon="bi-stars" itemLabel="Benefit"
                  prefix="ben" (add)="addBlock(blocksForm.controls.benefits)" (changed)="markBlocksDirty()" />
                <app-block-list-editor [array]="blocksForm.controls.steps" heading="How it works (steps)" headingIcon="bi-signpost-split"
                  itemLabel="Step" prefix="step" (add)="addBlock(blocksForm.controls.steps)" (changed)="markBlocksDirty()" />
              </form>
            }
            @default {
              <form class="d-grid gap-3" [formGroup]="pageForm" (ngSubmit)="save()">
                <div class="card">
                  <div class="card-body">
                    <div class="form-floating">
                      <input class="form-control" id="page-title" formControlName="title" placeholder=" " />
                      <label for="page-title">Page title</label>
                    </div>
                    <app-field-error [control]="pageForm.controls.title" label="Title" />
                    @if (lastUpdated()) {
                      <div class="form-text"><i class="bi bi-clock-history" aria-hidden="true"></i> Last updated {{ lastUpdated() | date: 'medium' }} — updated automatically on save.</div>
                    }
                  </div>
                </div>
                @for (g of pageForm.controls.sections.controls; track g; let i = $index) {
                  <fieldset class="card item" [formGroup]="g">
                    <div class="card-body">
                      <legend class="visually-hidden">Section {{ i + 1 }}</legend>
                      <div class="d-flex justify-content-between align-items-center mb-3">
                        <strong><span class="num">{{ i + 1 }}</span>Section</strong>
                        <span class="d-flex gap-1">
                          <button class="btn btn-light btn-icon" type="button" (click)="move(pageForm.controls.sections, i, -1)" [disabled]="i === 0" aria-label="Move up"><i class="bi bi-arrow-up" aria-hidden="true"></i></button>
                          <button class="btn btn-light btn-icon" type="button" (click)="move(pageForm.controls.sections, i, 1)" [disabled]="i === pageForm.controls.sections.length - 1" aria-label="Move down"><i class="bi bi-arrow-down" aria-hidden="true"></i></button>
                          <button class="btn btn-light btn-icon text-danger" type="button" (click)="removeAt(pageForm.controls.sections, i)" aria-label="Remove section"><i class="bi bi-trash" aria-hidden="true"></i></button>
                        </span>
                      </div>
                      <div class="row g-3 align-items-start">
                        <div class="col-12">
                          <div class="form-floating">
                            <input class="form-control" [id]="'sec-h-' + i" formControlName="heading" placeholder=" " />
                            <label [for]="'sec-h-' + i">Heading</label>
                          </div>
                          <app-field-error [control]="g.controls.heading" label="Heading" />
                        </div>
                        <div class="col-12">
                          <div class="form-floating">
                            <textarea class="form-control" [id]="'sec-b-' + i" formControlName="body" placeholder=" " style="height: 10rem"></textarea>
                            <label [for]="'sec-b-' + i">Body</label>
                          </div>
                          <div class="form-text">Plain text; line breaks are preserved.</div>
                          <app-field-error [control]="g.controls.body" label="Body" />
                        </div>
                      </div>
                    </div>
                  </fieldset>
                }
                <div><button class="btn btn-outline-primary" type="button" (click)="addSection()"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add section</button></div>
              </form>
            }
          }
        }
      </div>
    </div>
    <ng-template #blockHead>
      <div class="card" [formGroup]="blocksForm">
        <div class="card-body">
          <div class="row g-3 align-items-start">
            <div class="col-12">
              <div class="form-floating">
                <input class="form-control" id="blk-title" formControlName="title" placeholder=" " />
                <label for="blk-title">Page title</label>
              </div>
              <app-field-error [control]="blocksForm.controls.title" label="Title" />
            </div>
            <div class="col-12">
              <div class="form-floating">
                <textarea class="form-control" id="blk-intro" formControlName="intro" placeholder=" " style="height: 6rem"></textarea>
                <label for="blk-intro">Introduction (optional)</label>
              </div>
              <app-field-error [control]="blocksForm.controls.intro" label="Introduction" />
            </div>
          </div>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    ADMIN_LIST_STYLES,
    `
      .unsaved { display: inline-flex; align-items: center; gap: 4px; }
      .item { margin: 0; border-left: 3px solid var(--an-gold-500); }
      .num { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; align-items: center; justify-content: center; margin-right: 8px;
        background: var(--an-navy-900); color: var(--an-gold-300); font-size: 0.8rem; }
      .keys { position: sticky; top: 84px; }
      .keys .list-group-item { min-height: 48px; }
      .keys .list-group-item.active code { color: var(--an-gold-300); }
      .stat-del { min-height: 3.5rem; }
      .code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 0.85rem; line-height: 1.5; min-height: 24rem; }
    `,
  ],
})
export default class AdminContentComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly keys = CONTENT_KEYS;
  protected readonly labels = KEY_LABELS;
  protected readonly keyIcons = KEY_ICONS;
  protected readonly key = signal<ContentKey>('home');
  protected readonly kind = computed(() => kindOf(this.key()));
  protected readonly mode = signal<Mode>('form');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly missing = signal(false);
  protected readonly jsonError = signal<string | null>(null);
  protected readonly jsonDirty = signal(false);
  protected readonly lastUpdated = signal<string | null>(null);
  private readonly formDirty = signal(false);
  protected readonly dirty = computed(() => this.formDirty() || this.jsonDirty());

  /** The value as loaded; unknown keys are preserved when saving from the structured editor. */
  private original: ContentValue = {};

  protected readonly faqForm = this.fb.group({ items: this.fb.array<FormGroup<{ question: FormControl<string>; answer: FormControl<string> }>>([]) });
  protected readonly pageForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    sections: this.fb.array<FormGroup<{ heading: FormControl<string>; body: FormControl<string> }>>([]),
  });
  protected readonly homeForm = this.fb.group({
    heroTitle: ['', Validators.maxLength(200)],
    heroSubtitle: ['', Validators.maxLength(500)],
    stats: this.fb.array<FormGroup<{ label: FormControl<string>; value: FormControl<string> }>>([]),
  });
  protected readonly blocksForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    intro: ['', Validators.maxLength(1000)],
    benefits: this.fb.array<BlockGroup>([]),
    steps: this.fb.array<BlockGroup>([]),
  });
  protected readonly json = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    for (const form of [this.faqForm, this.pageForm, this.homeForm, this.blocksForm] as FormGroup[]) {
      form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        if (form.dirty) this.formDirty.set(true);
      });
    }
    const initial = this.route.snapshot.queryParamMap.get('key');
    const key = (CONTENT_KEYS as readonly string[]).includes(initial ?? '') ? (initial as ContentKey) : 'home';
    this.load(key);
  }

  switchKey(raw: string, select?: HTMLSelectElement): void {
    if (!(CONTENT_KEYS as readonly string[]).includes(raw)) return;
    const next = raw as ContentKey;
    if (next === this.key()) return;
    const go = (): void => {
      void this.router.navigate([], { relativeTo: this.route, queryParams: { key: next }, replaceUrl: true });
      this.load(next);
    };
    if (!this.dirty()) {
      go();
      return;
    }
    const previous = this.key();
    this.confirm
      .open({ title: 'Discard unsaved changes?', message: `Your edits to “${previous}” will be lost.`, confirmText: 'Discard', tone: 'danger' })
      .subscribe((r) => {
        if (r) go();
        else if (select) select.value = previous;
      });
  }

  load(key: ContentKey): void {
    this.key.set(key);
    this.loading.set(true);
    this.loadError.set(null);
    this.missing.set(false);
    this.jsonError.set(null);
    this.api
      .get<unknown>(`/admin/content/${key}`, { context: silentContext() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          const value = unwrapContent(data);
          const empty = !value || Object.keys(value).length === 0;
          this.missing.set(empty);
          this.applyValue(empty ? this.template(key) : value);
        },
        error: (e: unknown) => {
          const err = toAppError(e);
          if (err.errorCode === 'NOT_FOUND') {
            this.missing.set(true);
            this.applyValue(this.template(key));
          } else {
            this.loadError.set(friendlyMessage(err));
          }
        },
      });
  }

  setMode(next: Mode): void {
    if (next === this.mode()) return;
    if (next === 'json') {
      this.json.setValue(JSON.stringify(this.formValue(), null, 2));
      this.jsonError.set(null);
      this.mode.set('json');
      return;
    }
    const parsed = this.parseJson();
    if (!parsed) return;
    const keepDirty = this.dirty();
    this.applyValue(parsed, keepDirty);
    this.mode.set('form');
  }

  save(): void {
    let value: ContentValue | null;
    if (this.mode() === 'json') {
      value = this.parseJson();
      if (!value) return;
      if (this.kind() === 'page') {
        value = { ...value, updatedAt: new Date().toISOString() };
      }
    } else {
      const form = this.activeForm();
      if (form.invalid) {
        form.markAllAsTouched();
        this.toast.error('Please fix the highlighted fields before saving.');
        return;
      }
      value = this.formValue(true);
    }
    const key = this.key();
    this.saving.set(true);
    const req: Observable<unknown> = value ? this.admin.saveContent(key, value) : of(null);
    req.pipe(finalize(() => this.saving.set(false))).subscribe(() => {
      this.toast.success(`${KEY_LABELS[key]} content saved`);
      this.missing.set(false);
      this.applyValue(value ?? {});
      if (this.mode() === 'json') {
        this.json.setValue(JSON.stringify(value, null, 2));
      }
    });
  }

  addFaq(q = '', a = ''): void {
    this.faqForm.controls.items.push(
      this.fb.group({ question: [q, [Validators.required, Validators.maxLength(300)]], answer: [a, [Validators.required, Validators.maxLength(4000)]] }),
    );
    this.markDirty(this.faqForm);
  }

  addSection(h = '', b = ''): void {
    this.pageForm.controls.sections.push(
      this.fb.group({ heading: [h, [Validators.required, Validators.maxLength(200)]], body: [b, [Validators.required, Validators.maxLength(20000)]] }),
    );
    this.markDirty(this.pageForm);
  }

  addStat(l = '', v = ''): void {
    this.homeForm.controls.stats.push(
      this.fb.group({ label: [l, [Validators.required, Validators.maxLength(60)]], value: [v, [Validators.required, Validators.maxLength(30)]] }),
    );
    this.markDirty(this.homeForm);
  }

  addBlock(array: FormArray<BlockGroup>, icon = '', title = '', body = ''): void {
    array.push(this.blockGroup(icon, title, body));
    this.markDirty(this.blocksForm);
  }

  markBlocksDirty(): void {
    this.blocksForm.markAsDirty();
    this.formDirty.set(true);
  }

  private blockGroup(icon: string, title: string, body: string): BlockGroup {
    return this.fb.group({
      icon: [icon, Validators.maxLength(60)],
      title: [title, [Validators.required, Validators.maxLength(120)]],
      body: [body, [Validators.required, Validators.maxLength(2000)]],
    });
  }

  removeAt(array: FormArray, i: number): void {
    array.removeAt(i);
    array.markAsDirty();
    this.formDirty.set(true);
  }

  move(array: FormArray, i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= array.length) return;
    const ctrl = array.at(i);
    array.removeAt(i, { emitEvent: false });
    array.insert(j, ctrl);
    array.markAsDirty();
    this.formDirty.set(true);
  }

  private markDirty(form: FormGroup): void {
    if (!this.loading()) {
      form.markAsDirty();
      this.formDirty.set(true);
    }
  }

  private activeForm(): FormGroup {
    const k = this.kind();
    if (k === 'process' || k === 'audience') return this.blocksForm;
    return k === 'faq' ? this.faqForm : k === 'home' ? this.homeForm : this.pageForm;
  }

  private template(key: ContentKey): ContentValue {
    const k = kindOf(key);
    if (k === 'faq') return { items: [{ question: '', answer: '' }] };
    if (k === 'home') return { heroTitle: '', heroSubtitle: '', stats: [] };
    if (k === 'process') return { title: DEFAULT_TITLES[key] ?? KEY_LABELS[key], intro: '', steps: [{ icon: '', title: '', body: '' }] };
    if (k === 'audience') {
      return { title: DEFAULT_TITLES[key] ?? KEY_LABELS[key], intro: '', benefits: [{ icon: '', title: '', body: '' }], steps: [] };
    }
    return { title: DEFAULT_TITLES[key] ?? KEY_LABELS[key], sections: [{ heading: '', body: '' }] };
  }

  /** Loads a value into the structured form for the current key and resets dirty state. */
  private applyValue(value: ContentValue, keepDirty = false): void {
    this.original = value;
    const k = this.kind();
    if (k === 'faq') {
      this.faqForm.controls.items.clear({ emitEvent: false });
      for (const it of arr(value['items'])) this.addFaq(str(it['question']), str(it['answer']));
      this.faqForm.markAsPristine();
    } else if (k === 'process' || k === 'audience') {
      const c = this.blocksForm.controls;
      c.benefits.clear({ emitEvent: false });
      c.steps.clear({ emitEvent: false });
      this.blocksForm.patchValue(
        { title: str(value['title']) || (DEFAULT_TITLES[this.key()] ?? ''), intro: str(value['intro']) },
        { emitEvent: false },
      );
      for (const b of arr(value['benefits'])) c.benefits.push(this.blockGroup(str(b['icon']), str(b['title']), str(b['body'])));
      const steps: unknown[] = Array.isArray(value['steps']) ? (value['steps'] as unknown[]) : [];
      for (const st of steps) {
        if (typeof st === 'string') {
          c.steps.push(this.blockGroup('', st, st));
        } else if (typeof st === 'object' && st !== null) {
          const o = st as Record<string, unknown>;
          c.steps.push(this.blockGroup(str(o['icon']), str(o['title']), str(o['body'])));
        }
      }
      this.blocksForm.markAsPristine();
    } else if (k === 'home') {
      this.homeForm.controls.stats.clear({ emitEvent: false });
      this.homeForm.patchValue({ heroTitle: str(value['heroTitle']), heroSubtitle: str(value['heroSubtitle']) }, { emitEvent: false });
      for (const s of arr(value['stats'])) this.addStat(str(s['label']), str(s['value']));
      this.homeForm.markAsPristine();
    } else {
      this.pageForm.controls.sections.clear({ emitEvent: false });
      this.pageForm.patchValue({ title: str(value['title']) || (DEFAULT_TITLES[this.key()] ?? '') }, { emitEvent: false });
      for (const s of arr(value['sections'])) this.addSection(str(s['heading']), str(s['body']));
      this.lastUpdated.set(str(value['updatedAt']) || null);
      this.pageForm.markAsPristine();
    }
    this.formDirty.set(keepDirty);
    this.jsonDirty.set(false);
  }

  /** Current structured value merged over the originally loaded object. */
  private formValue(stampUpdatedAt = false): ContentValue {
    const k = this.kind();
    if (k === 'faq') {
      return { ...this.original, items: this.faqForm.getRawValue().items.map((i) => ({ question: i.question.trim(), answer: i.answer.trim() })) };
    }
    if (k === 'process' || k === 'audience') {
      const v = this.blocksForm.getRawValue();
      const block = (b: { icon: string; title: string; body: string }): Record<string, string> => ({
        ...(b.icon.trim() ? { icon: b.icon.trim() } : {}),
        title: b.title.trim(),
        body: b.body.trim(),
      });
      const out: ContentValue = { ...this.original, title: v.title.trim(), steps: v.steps.map(block) };
      if (v.intro.trim()) out['intro'] = v.intro.trim();
      else delete out['intro'];
      if (k === 'audience') out['benefits'] = v.benefits.map(block);
      return out;
    }
    if (k === 'home') {
      const v = this.homeForm.getRawValue();
      return {
        ...this.original,
        heroTitle: v.heroTitle.trim(),
        heroSubtitle: v.heroSubtitle.trim(),
        stats: v.stats.map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
      };
    }
    const v = this.pageForm.getRawValue();
    return {
      ...this.original,
      title: v.title.trim(),
      updatedAt: stampUpdatedAt ? new Date().toISOString() : (this.lastUpdated() ?? undefined),
      sections: v.sections.map((s) => ({ heading: s.heading.trim(), body: s.body.trim() })),
    };
  }

  private parseJson(): ContentValue | null {
    try {
      const parsed: unknown = JSON.parse(this.json.value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.jsonError.set('The value must be a JSON object (e.g. { "title": "…" }).');
        return null;
      }
      this.jsonError.set(null);
      return parsed as ContentValue;
    } catch (e) {
      this.jsonError.set(`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`);
      return null;
    }
  }
}
