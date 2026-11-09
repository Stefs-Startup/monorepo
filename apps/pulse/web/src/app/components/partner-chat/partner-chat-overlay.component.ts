import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ConversationalMessage,
  QuickReplySpecDto,
  TaskAccountabilityStatus
} from '../../models/pulse.models';

@Component({
  selector: 'app-partner-chat-overlay',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="chat-backdrop" role="dialog" aria-modal="true" aria-label="Reflect with Partner">
      <div class="chat-sheet">
        <header class="chat-top-bar">
          <button
            type="button"
            class="icon-btn"
            aria-label="Close Reflect overlay"
            (click)="close.emit()"
          >
            ✕
          </button>
          <div class="chat-title-group">
            <h2 class="chat-title">Reflect</h2>
            <span class="chat-subtitle">Candid Accountability Partner</span>
          </div>
          <button
            type="button"
            class="pill-btn"
            aria-label="Switch to next task"
            (click)="nextTask.emit()"
          >
            Next task →
          </button>
        </header>

        @if (activeStatus; as status) {
          <section class="context-banner" aria-label="Active task context">
            <div class="context-meta">
              <span class="badge-pill">{{ status.badgeLabel }}</span>
              <span class="energy-pill">{{ status.task.energy }}</span>
            </div>
            <h3 class="context-task-title">{{ status.task.title }}</h3>
            @if (status.task.notes) {
              <p class="context-task-notes">{{ status.task.notes }}</p>
            }
          </section>
        }

        <div class="messages-stream" role="log" aria-live="polite">
          @for (msg of messages; track msg.id) {
            <div
              class="message-bubble"
              [class.partner-bubble]="msg.role === 'PARTNER'"
              [class.user-bubble]="msg.role === 'USER'"
            >
              <div class="message-sender">
                {{ msg.role === 'PARTNER' ? 'Partner' : 'You' }}
              </div>
              <p class="message-text">{{ msg.text }}</p>
              @if (msg.suggestedActionCode; as actionCode) {
                <button
                  type="button"
                  class="suggested-action-btn"
                  (click)="applyAction.emit(actionCode)"
                >
                  Apply Recommended Move: {{ formatActionLabel(actionCode) }}
                </button>
              }
            </div>
          }
        </div>

        <div class="quick-replies-row" aria-label="Quick reflection replies">
          @for (chip of quickReplies; track chip.id) {
            <button
              type="button"
              class="quick-chip"
              (click)="sendQuickReply(chip.messageText)"
            >
              {{ chip.label }}
            </button>
          }
        </div>

        <form class="chat-input-bar" (ngSubmit)="submitDraft()">
          <input
            type="text"
            name="draftMessage"
            [(ngModel)]="draftMessage"
            placeholder="Name what's holding this task back…"
            aria-label="Reflection message input"
            class="chat-input"
          />
          <button
            type="submit"
            class="send-btn"
            aria-label="Send reflection message"
            [disabled]="!draftMessage.trim()"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .chat-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 15, 12, 0.62);
      display: flex;
      justify-content: center;
      align-items: flex-end;
      z-index: 1000;
      padding: 16px;
    }
    .chat-sheet {
      width: 100%;
      max-width: 720px;
      height: min(86vh, 760px);
      background: var(--md-surface);
      color: var(--md-on-surface);
      border-radius: 28px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--md-surface-variant);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.28);
    }
    .chat-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: var(--md-surface-container);
      border-bottom: 1px solid var(--md-surface-variant);
      min-height: 64px;
    }
    .chat-title-group {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .chat-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
    }
    .chat-subtitle {
      font-size: 0.78rem;
      color: var(--md-on-surface-variant);
    }
    .icon-btn {
      min-width: 48px;
      min-height: 48px;
      border-radius: 14px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-surface-container-low);
      color: var(--md-on-surface);
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }
    .pill-btn {
      min-height: 48px;
      padding: 0 14px;
      border-radius: 14px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
      font-weight: 600;
      cursor: pointer;
    }
    .context-banner {
      padding: 14px 18px;
      background: var(--md-surface-container-low);
      border-bottom: 1px solid var(--md-surface-variant);
    }
    .context-meta {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }
    .badge-pill {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
    }
    .energy-pill {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--md-tertiary-container);
      color: var(--md-on-tertiary-container);
    }
    .context-task-title {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
    }
    .context-task-notes {
      margin: 4px 0 0;
      font-size: 0.86rem;
      color: var(--md-on-surface-variant);
    }
    .messages-stream {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .message-bubble {
      max-width: 84%;
      padding: 12px 16px;
      border-radius: 20px;
      line-height: 1.45;
    }
    .partner-bubble {
      align-self: flex-start;
      background: var(--md-surface-container-high);
      color: var(--md-on-surface);
      border-bottom-left-radius: 6px;
    }
    .user-bubble {
      align-self: flex-end;
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border-bottom-right-radius: 6px;
    }
    .message-sender {
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 4px;
      opacity: 0.85;
    }
    .message-text {
      margin: 0;
      font-size: 0.95rem;
    }
    .suggested-action-btn {
      margin-top: 10px;
      min-height: 48px;
      padding: 8px 14px;
      border-radius: 14px;
      border: none;
      background: var(--md-primary);
      color: var(--md-on-primary);
      font-weight: 700;
      cursor: pointer;
    }
    .quick-replies-row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 10px 18px;
      background: var(--md-surface-container-low);
      border-top: 1px solid var(--md-surface-variant);
    }
    .quick-chip {
      white-space: nowrap;
      min-height: 40px;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid var(--md-outline);
      background: var(--md-surface);
      color: var(--md-on-surface);
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
    }
    .chat-input-bar {
      display: flex;
      gap: 10px;
      padding: 12px 18px;
      background: var(--md-surface-container);
      border-top: 1px solid var(--md-surface-variant);
    }
    .chat-input {
      flex: 1;
      min-height: 48px;
      padding: 0 14px;
      border-radius: 14px;
      border: 1px solid var(--md-outline);
      background: var(--md-surface);
      color: var(--md-on-surface);
      font-size: 0.95rem;
    }
    .send-btn {
      min-width: 84px;
      min-height: 48px;
      border-radius: 14px;
      border: none;
      background: var(--md-primary);
      color: var(--md-on-primary);
      font-weight: 700;
      cursor: pointer;
    }
    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class PartnerChatOverlayComponent {
  @Input() activeStatus: TaskAccountabilityStatus | null = null;
  @Input() messages: ConversationalMessage[] = [];
  @Input() quickReplies: QuickReplySpecDto[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() nextTask = new EventEmitter<void>();
  @Output() sendMessage = new EventEmitter<string>();
  @Output() applyAction = new EventEmitter<string>();

  draftMessage = '';

  sendQuickReply(text: string): void {
    this.sendMessage.emit(text);
  }

  submitDraft(): void {
    const trimmed = this.draftMessage.trim();
    if (!trimmed) return;
    this.sendMessage.emit(trimmed);
    this.draftMessage = '';
  }

  formatActionLabel(code: string): string {
    switch (code) {
      case 'SHRINK_TO_5M':
        return 'Shrink to 5m Starter & Pin';
      case 'COMMIT_TODAY':
        return "Commit to Today's Top 3";
      case 'RESCHEDULE':
        return 'Reschedule for Tomorrow';
      case 'DELEGATE':
        return 'Mark Waiting-On';
      case 'DROP_CONSCIOUSLY':
        return 'Consciously Drop Task';
      default:
        return code;
    }
  }
}
