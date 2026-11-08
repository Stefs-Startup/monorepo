import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TaskAccountabilityStatus } from '../../models/pulse.models';

@Component({
  selector: 'app-stalled-task-card',
  standalone: true,
  template: `
    @if (status; as item) {
      <article class="stalled-card" [attr.aria-label]="item.task.title">
        <div class="card-top-row">
          <span
            class="category-badge"
            [class.habitual]="item.category === 'HABITUALLY_DEFERRED'"
            [class.drifting]="item.category === 'LONG_STANDING_GHOSTED'"
            [class.committed]="item.category === 'ACTIVE_COMMITTED'"
          >
            {{ item.badgeLabel }}
          </span>
          <span class="list-badge">{{ item.task.taskListTitle }} • {{ item.task.energy }}</span>
        </div>

        <h3 class="task-title">{{ item.task.title }}</h3>

        @if (item.task.notes) {
          <p class="task-notes">{{ item.task.notes }}</p>
        }
        @if (item.task.blockerNote) {
          <p class="blocker-banner">Blocker: {{ item.task.blockerNote }}</p>
        }

        <div class="metrics-row">
          <span>Deferrals: <strong>{{ item.task.deferCount }}×</strong></span>
          <span>Age: <strong>{{ item.daysOld }}d</strong></span>
          <span>Idle: <strong>{{ item.daysUntouched }}d</strong></span>
          @if (item.daysOverdue > 0) {
            <span class="overdue-tag">Overdue: <strong>{{ item.daysOverdue }}d</strong></span>
          }
        </div>

        <div class="actions-row">
          <button
            type="button"
            class="action-btn primary-action"
            aria-label="Talk through task with partner"
            (click)="reflect.emit(item.task.id)"
          >
            Talk it through
          </button>
          <button
            type="button"
            class="action-btn secondary-action"
            aria-label="Commit task to Today's Top 3"
            (click)="triage.emit({ taskId: item.task.id, action: 'COMMIT_TODAY' })"
          >
            {{ item.task.commitment === 'TODAY_TOP_3' ? 'Unpin Top 3' : 'Commit Top 3' }}
          </button>
          <button
            type="button"
            class="action-btn tonal-action"
            aria-label="Shrink task to 5 minute starter"
            (click)="triage.emit({ taskId: item.task.id, action: 'SHRINK_TO_5M' })"
          >
            Shrink to 5m
          </button>
          <button
            type="button"
            class="action-btn tonal-action"
            aria-label="Defer task to tomorrow"
            (click)="triage.emit({ taskId: item.task.id, action: 'RESCHEDULE' })"
          >
            Tomorrow
          </button>
          <button
            type="button"
            class="action-btn tonal-action"
            aria-label="Mark task completed"
            (click)="triage.emit({ taskId: item.task.id, action: 'COMPLETE' })"
          >
            Done ✓
          </button>
        </div>
      </article>
    }
  `,
  styles: [`
    .stalled-card {
      background: var(--md-surface-container);
      color: var(--md-on-surface);
      border: 1px solid var(--md-surface-variant);
      border-radius: 22px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .category-badge {
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      background: var(--md-tertiary-container);
      color: var(--md-on-tertiary-container);
    }
    .category-badge.habitual {
      background: var(--md-error-container);
      color: var(--md-on-error-container);
    }
    .category-badge.drifting {
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
    }
    .category-badge.committed {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .list-badge {
      font-size: 0.78rem;
      color: var(--md-on-surface-variant);
      font-weight: 600;
    }
    .task-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
    }
    .task-notes {
      margin: 0;
      font-size: 0.88rem;
      color: var(--md-on-surface-variant);
    }
    .blocker-banner {
      margin: 0;
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
      font-size: 0.84rem;
      font-weight: 600;
    }
    .metrics-row {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      font-size: 0.82rem;
      color: var(--md-on-surface-variant);
    }
    .overdue-tag {
      color: var(--md-error);
    }
    .actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }
    .action-btn {
      min-height: 48px;
      padding: 0 14px;
      border-radius: 14px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .primary-action {
      background: var(--md-primary);
      color: var(--md-on-primary);
    }
    .secondary-action {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .tonal-action {
      background: var(--md-surface-container-high);
      color: var(--md-on-surface);
      border-color: var(--md-surface-variant);
    }
  `]
})
export class StalledTaskCardComponent {
  @Input() status: TaskAccountabilityStatus | null = null;
  @Output() reflect = new EventEmitter<string>();
  @Output() triage = new EventEmitter<{ taskId: string; action: string }>();
}
