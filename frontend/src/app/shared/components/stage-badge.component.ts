import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CandidateStage, STAGE_LABELS } from '../../core/models';
import { StatusChipComponent } from './status-chip.component';

/** Candidate pipeline stage (15-stage model) as a status badge with the official label. */
@Component({
  selector: 'app-stage-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusChipComponent],
  template: `<app-status-chip [status]="stage()" [label]="text()" />`,
})
export class StageBadgeComponent {
  readonly stage = input.required<CandidateStage | string>();
  readonly label = input<string>();
  protected readonly text = computed(() => this.label() || STAGE_LABELS[this.stage() as CandidateStage] || this.stage());
}
