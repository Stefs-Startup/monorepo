import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BreadcrumbEntry,
  ContrastAuditEntry,
  PartnerSettingsDto
} from '../../models/pulse.models';

export type SettingsSubPage =
  | 'INDEX'
  | 'PERSONA_AI'
  | 'GOOGLE_SYNC'
  | 'CADENCE_RITUALS'
  | 'PRIVACY_DIAGNOSTICS';

@Component({
  selector: 'app-settings-navigator',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="settings-container" aria-label="Partner settings navigator">
      @if (subPage() === 'INDEX') {
        <div class="settings-grid">
          <button
            type="button"
            class="settings-index-card"
            (click)="subPage.set('PERSONA_AI')"
          >
            <span class="card-kicker">Category 1</span>
            <h3 class="card-heading">Partner Persona & AI</h3>
            <p class="card-desc">
              Tone ({{ settings.partnerTone }}) and streaming AI reflection adapter.
            </p>
          </button>

          <button
            type="button"
            class="settings-index-card"
            (click)="subPage.set('GOOGLE_SYNC')"
          >
            <span class="card-kicker">Category 2</span>
            <h3 class="card-heading">Google Tasks Sync</h3>
            <p class="card-desc">
              {{ settings.connectedGoogleAccount }} • {{ settings.lastSyncStatus }}
            </p>
          </button>

          <button
            type="button"
            class="settings-index-card"
            (click)="subPage.set('CADENCE_RITUALS')"
          >
            <span class="card-kicker">Category 3</span>
            <h3 class="card-heading">Cadence & Rituals</h3>
            <p class="card-desc">
              Morning Anchor ({{ settings.morningRitualTime }}) & Evening Shutdown ({{ settings.eveningShutdownTime }}).
            </p>
          </button>

          <button
            type="button"
            class="settings-index-card"
            (click)="subPage.set('PRIVACY_DIAGNOSTICS')"
          >
            <span class="card-kicker">Category 4</span>
            <h3 class="card-heading">Privacy & Diagnostics</h3>
            <p class="card-desc">
              Zero-PII telemetry breadcrumbs ({{ breadcrumbs.length }}) & WCAG 2.2 AA audit ({{ wcagAudit.length }} pairs).
            </p>
          </button>
        </div>
      } @else {
        <div class="subpage-card">
          <header class="subpage-header">
            <button
              type="button"
              class="back-btn"
              aria-label="Back to settings index"
              (click)="subPage.set('INDEX')"
            >
              ← Back to Settings Index
            </button>
          </header>

          @switch (subPage()) {
            @case ('PERSONA_AI') {
              <div class="subpage-body">
                <h3>Partner Persona & AI Coaching</h3>
                <label class="field-row">
                  <span>Partner Coaching Tone</span>
                  <select
                    [ngModel]="settings.partnerTone"
                    (ngModelChange)="updateTone($event)"
                    aria-label="Partner Coaching Tone"
                  >
                    <option value="Candid & Warm">Candid & Warm</option>
                    <option value="Direct & Minimalist">Direct & Minimalist</option>
                    <option value="Gentle & Socratic">Gentle & Socratic</option>
                  </select>
                </label>

                <label class="field-row">
                  <span>Enable Live Streaming AI Adapter</span>
                  <input
                    type="checkbox"
                    [ngModel]="settings.aiStreamingEnabled"
                    (ngModelChange)="toggleAiStreaming($event)"
                  />
                </label>
              </div>
            }
            @case ('GOOGLE_SYNC') {
              <div class="subpage-body">
                <h3>Google Tasks Sync & Demo Seed</h3>
                <p>Connected Account: <strong>{{ settings.connectedGoogleAccount }}</strong></p>
                <p>Status: <strong>{{ settings.lastSyncStatus }}</strong></p>
                <button
                  type="button"
                  class="primary-btn"
                  (click)="resetDemo.emit()"
                >
                  Reset & Re-seed Google Tasks Demo Data
                </button>
              </div>
            }
            @case ('CADENCE_RITUALS') {
              <div class="subpage-body">
                <h3>Cadence & Daily Ritual Windows</h3>
                <label class="field-row">
                  <span>Morning Anchor Check-In</span>
                  <input
                    type="time"
                    [ngModel]="settings.morningRitualTime"
                    (ngModelChange)="updateMorningTime($event)"
                  />
                </label>
                <label class="field-row">
                  <span>Evening Honest Shutdown</span>
                  <input
                    type="time"
                    [ngModel]="settings.eveningShutdownTime"
                    (ngModelChange)="updateEveningTime($event)"
                  />
                </label>
              </div>
            }
            @case ('PRIVACY_DIAGNOSTICS') {
              <div class="subpage-body">
                <h3>Zero-PII Telemetry Breadcrumbs & WCAG 2.2 AA Audit</h3>
                <p class="subpage-note">
                  All emails and OAuth bearer tokens are scrubbed via <code>PulseObservability.scrubSensitiveText()</code>.
                </p>

                <h4>WCAG 2.2 AA Token Contrast Verification ({{ wcagAudit.length }} pairs)</h4>
                <div class="audit-list">
                  @for (pair of wcagAudit; track pair.pairName) {
                    <div class="audit-row">
                      <span>{{ pair.pairName }}</span>
                      <strong>{{ pair.contrastRatio }}:1 ({{ pair.passesWcagAA ? 'PASS' : 'FAIL' }})</strong>
                    </div>
                  }
                </div>

                <h4>Recent Zero-PII Breadcrumbs</h4>
                <div class="breadcrumb-list">
                  @for (b of breadcrumbs; track b.timestampIso + b.summary) {
                    <div class="breadcrumb-item">
                      <code>{{ b.summary }}</code>
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
    }
    .settings-index-card {
      text-align: left;
      padding: 20px;
      border-radius: 22px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-surface-container);
      color: var(--md-on-surface);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 132px;
    }
    .card-kicker {
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--md-primary);
    }
    .card-heading {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }
    .card-desc {
      margin: 0;
      font-size: 0.88rem;
      color: var(--md-on-surface-variant);
    }
    .subpage-card {
      background: var(--md-surface-container);
      border: 1px solid var(--md-surface-variant);
      border-radius: 22px;
      padding: 20px;
    }
    .back-btn, .primary-btn {
      min-height: 48px;
      padding: 0 16px;
      border-radius: 14px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      font-weight: 700;
      cursor: pointer;
    }
    .subpage-body {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .field-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--md-surface-container-high);
    }
    .field-row select, .field-row input[type="time"] {
      min-height: 40px;
      padding: 4px 10px;
      border-radius: 10px;
      border: 1px solid var(--md-outline);
      background: var(--md-surface);
      color: var(--md-on-surface);
    }
    .audit-list, .breadcrumb-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }
    .audit-row, .breadcrumb-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--md-surface-container-low);
      font-size: 0.84rem;
    }
  `]
})
export class SettingsNavigatorComponent {
  @Input({ required: true }) settings!: PartnerSettingsDto;
  @Input() breadcrumbs: BreadcrumbEntry[] = [];
  @Input() wcagAudit: ContrastAuditEntry[] = [];

  @Output() saveSettings = new EventEmitter<PartnerSettingsDto>();
  @Output() resetDemo = new EventEmitter<void>();

  readonly subPage = signal<SettingsSubPage>('INDEX');

  updateTone(partnerTone: string): void {
    this.saveSettings.emit({ ...this.settings, partnerTone });
  }

  toggleAiStreaming(aiStreamingEnabled: boolean): void {
    this.saveSettings.emit({ ...this.settings, aiStreamingEnabled });
  }

  updateMorningTime(morningRitualTime: string): void {
    this.saveSettings.emit({ ...this.settings, morningRitualTime });
  }

  updateEveningTime(eveningShutdownTime: string): void {
    this.saveSettings.emit({ ...this.settings, eveningShutdownTime });
  }
}
