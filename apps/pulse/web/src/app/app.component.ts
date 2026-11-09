import { Component, OnInit, computed, inject } from '@angular/core';
import { NavTab, PulseStateService } from './services/pulse-state.service';
import { StalledTaskCardComponent } from './components/stalled-task-card/stalled-task-card.component';
import { SettingsNavigatorComponent } from './components/settings-navigator/settings-navigator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    StalledTaskCardComponent,
    SettingsNavigatorComponent
  ],
  template: `
    <div class="app-shell">
      <!-- Compact Material 3 TopAppBar (64px, Contextual Title Only — No Vanity Branding) -->
      <header class="top-app-bar">
        <h1 class="top-bar-title">{{ screenTitle() }}</h1>
        <div class="top-bar-actions">
          <span
            class="connection-pill"
            [class.connected]="state.backendConnected()"
          >
            {{ state.backendConnected() ? 'Spring Boot 4 Live' : 'Local Fallback' }}
          </span>
          <button
            type="button"
            class="icon-action-btn"
            aria-label="Toggle Light or Dark Theme"
            (click)="state.toggleTheme()"
          >
            {{ state.darkTheme() ? '☀ Light' : '☾ Dark' }}
          </button>
          @if (state.activeTab() !== 'SETTINGS') {
            <button
              type="button"
              class="icon-action-btn primary-tonal"
              aria-label="Sync Google Tasks"
              (click)="state.loadState()"
            >
              ↻ Sync Google Tasks
            </button>
          }
        </div>
      </header>

      <!-- Status Banner -->
      <div class="status-strip" role="status" aria-live="polite">
        <span>{{ state.dashboard().statusBanner }}</span>
      </div>

      <!-- Main Viewport (Pure Visual Dashboard for Focus — Zero Chat Clutter) -->
      <main class="viewport-content">
        @switch (state.activeTab()) {
          @case ('HORIZON') {
            <section class="horizon-viewport" aria-label="Accountability Horizon">
              <!-- Today's Top 3 Scarcity Strip -->
              <div class="top3-strip">
                <div class="top3-header">
                  <span class="top3-label">Today's Top 3 Scarcity Gate</span>
                  <span class="top3-counter">
                    {{ state.dashboard().top3Commitments.length }} / 3 Locked
                  </span>
                </div>
                <div class="top3-slots">
                  @for (slot of [0, 1, 2]; track slot) {
                    @if (state.dashboard().top3Commitments[slot]; as committed) {
                      <button
                        type="button"
                        class="top3-slot filled"
                        (click)="state.selectTask(committed.task.id)"
                      >
                        <span class="slot-index">#{{ slot + 1 }}</span>
                        <span class="slot-title">{{ committed.task.title }}</span>
                      </button>
                    } @else {
                      <div class="top3-slot empty">
                        <span class="slot-index">#{{ slot + 1 }}</span>
                        <span class="slot-title">Open commitment slot</span>
                      </div>
                    }
                  }
                </div>
              </div>

              <!-- 3-Window Selector Chips (Habitual, Drifting, Active) -->
              <div class="window-tabs" role="tablist" aria-label="Horizon analytical windows">
                @for (win of state.windows(); track win.windowType; let idx = $index) {
                  <button
                    type="button"
                    role="tab"
                    class="window-tab-chip"
                    [class.active]="state.activeWindowIndex() === idx"
                    [attr.aria-selected]="state.activeWindowIndex() === idx"
                    (click)="state.selectWindow(idx)"
                  >
                    {{ win.shortTabTitle }}
                  </button>
                }
              </div>

              <!-- Active Horizon Window Card (Strict Descending Order #1, #2, #3...) -->
              @if (state.currentWindow(); as windowCard) {
                <article class="horizon-window-card">
                  <div class="window-card-header">
                    <div>
                      <h2 class="window-title">{{ windowCard.title }}</h2>
                      <p class="window-subtitle">{{ windowCard.subtitle }}</p>
                    </div>
                    <span class="headline-stat-pill">{{ windowCard.headlineStat }}</span>
                  </div>

                  @if (windowCard.items.length === 0) {
                    <div class="empty-window-box">
                      <h3>{{ windowCard.emptyStateTitle }}</h3>
                      <p>{{ windowCard.emptyStateBody }}</p>
                    </div>
                  } @else {
                    <div class="descending-bars-list" role="list">
                      @for (bar of windowCard.items; track bar.taskId; let rank = $index) {
                        <button
                          type="button"
                          role="listitem"
                          class="bar-row"
                          [class.selected]="state.selectedTaskStatus()?.task?.id === bar.taskId"
                          (click)="state.selectTask(bar.taskId)"
                        >
                          <div class="bar-rank">#{{ rank + 1 }}</div>
                          <div class="bar-main">
                            <div class="bar-labels">
                              <span class="bar-title">{{ bar.title }}</span>
                              <span class="bar-metrics">
                                <strong>{{ bar.primaryMetricLabel }}</strong> • {{ bar.secondaryMetricLabel }}
                              </span>
                            </div>
                            <div class="bar-track">
                              <div
                                class="bar-fill"
                                [class.habitual]="bar.category === 'HABITUALLY_DEFERRED'"
                                [class.drifting]="bar.category === 'LONG_STANDING_GHOSTED'"
                                [style.width.%]="bar.intensityFraction * 100"
                              ></div>
                            </div>
                          </div>
                        </button>
                      }
                    </div>
                  }
                </article>
              }

              <!-- Selected Node Inspector Card (Direct Visual Triage & Focus Controls) -->
              @if (state.selectedTaskStatus(); as selected) {
                <aside class="inspector-card" aria-label="Selected Task Inspector">
                  <div class="inspector-top">
                    <div>
                      <span class="inspector-badge">{{ selected.badgeLabel }}</span>
                      <h3 class="inspector-title">{{ selected.task.title }}</h3>
                    </div>
                    <span class="inspector-meta">
                      Age: {{ selected.daysOld }}d • Idle: {{ selected.daysUntouched }}d • Deferrals: {{ selected.task.deferCount }}×
                    </span>
                  </div>
                  @if (selected.task.notes) {
                    <p class="inspector-notes">{{ selected.task.notes }}</p>
                  }
                  <div class="inspector-actions">
                    <button
                      type="button"
                      class="inspector-btn primary"
                      aria-label="Commit or Unpin selected task in Today's Top 3"
                      (click)="state.triageTask(selected.task.id, 'COMMIT_TODAY')"
                    >
                      {{ selected.task.commitment === 'TODAY_TOP_3' ? 'Unpin Top 3' : 'Pin to Top 3' }}
                    </button>
                    <button
                      type="button"
                      class="inspector-btn secondary"
                      aria-label="Shrink selected task to 5 minute starter"
                      (click)="state.triageTask(selected.task.id, 'SHRINK_TO_5M')"
                    >
                      Shrink to 5m Starter
                    </button>
                    <button
                      type="button"
                      class="inspector-btn tonal"
                      aria-label="Reschedule selected task for tomorrow"
                      (click)="state.triageTask(selected.task.id, 'RESCHEDULE')"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      class="inspector-btn tonal"
                      aria-label="Park selected task in Someday"
                      (click)="state.triageTask(selected.task.id, 'PARK_SOMEDAY')"
                    >
                      Park Someday
                    </button>
                    <button
                      type="button"
                      class="inspector-btn tonal"
                      aria-label="Mark selected task done"
                      (click)="state.triageTask(selected.task.id, 'COMPLETE')"
                    >
                      Done ✓
                    </button>
                  </div>
                </aside>
              }
            </section>
          }

          @case ('UNDONE_LOG') {
            <section class="undone-log-viewport" aria-label="Undone Log Audit Trail">
              <div class="log-section">
                <h2 class="section-heading">
                  Habitually Undone (Deferred 2×+) • {{ state.dashboard().habituallyUndone.length }}
                </h2>
                <div class="cards-stack">
                  @for (item of state.dashboard().habituallyUndone; track item.task.id) {
                    <app-stalled-task-card
                      [status]="item"
                      (triage)="state.triageTask($event.taskId, $event.action)"
                    />
                  }
                </div>
              </div>

              <div class="log-section">
                <h2 class="section-heading">
                  Long-Standing Drift (5d+ Untouched / Overdue) • {{ state.dashboard().longStandingDrift.length }}
                </h2>
                <div class="cards-stack">
                  @for (item of state.dashboard().longStandingDrift; track item.task.id) {
                    <app-stalled-task-card
                      [status]="item"
                      (triage)="state.triageTask($event.taskId, $event.action)"
                    />
                  }
                </div>
              </div>

              <div class="log-section">
                <h2 class="section-heading">
                  Committed Today (Top 3) • {{ state.dashboard().top3Commitments.length }} / 3
                </h2>
                <div class="cards-stack">
                  @for (item of state.dashboard().top3Commitments; track item.task.id) {
                    <app-stalled-task-card
                      [status]="item"
                      (triage)="state.triageTask($event.taskId, $event.action)"
                    />
                  }
                </div>
              </div>
            </section>
          }

          @case ('SETTINGS') {
            <app-settings-navigator
              [settings]="state.dashboard().settings"
              [breadcrumbs]="state.dashboard().breadcrumbs"
              [wcagAudit]="state.dashboard().wcagContrastAudit"
              (saveSettings)="state.updateSettings($event)"
              (resetDemo)="state.resetDemo()"
            />
          }
        }
      </main>

      <!-- Standard Material 3 Bottom NavigationBar -->
      <nav class="bottom-nav-bar" aria-label="Primary Navigation">
        <button
          type="button"
          class="nav-item"
          [class.active]="state.activeTab() === 'HORIZON'"
          (click)="setTab('HORIZON')"
        >
          <span class="nav-icon">◉</span>
          <span class="nav-label">Horizon</span>
        </button>
        <button
          type="button"
          class="nav-item"
          [class.active]="state.activeTab() === 'UNDONE_LOG'"
          (click)="setTab('UNDONE_LOG')"
        >
          <span class="nav-icon">≡</span>
          <span class="nav-label">Undone Log</span>
        </button>
        <button
          type="button"
          class="nav-item"
          [class.active]="state.activeTab() === 'SETTINGS'"
          (click)="setTab('SETTINGS')"
        >
          <span class="nav-icon">⚙</span>
          <span class="nav-label">Settings</span>
        </button>
      </nav>

      <!-- Top-3 Scarcity Swap Dialog -->
      @if (state.dashboard().swapRequired && state.dashboard().pendingSwapCandidateTaskId; as candidateId) {
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Swap Top 3 Commitment">
          <div class="swap-modal">
            <h3>Today's Top 3 is Full (3/3 Scarcity Cap)</h3>
            <p>
              Honest scarcity keeps your day realistic. Pick which existing Top-3 task to unpin so you can lock in your new priority:
            </p>
            <div class="swap-choices">
              @for (committed of state.dashboard().top3Commitments; track committed.task.id) {
                <button
                  type="button"
                  class="swap-choice-btn"
                  (click)="state.swapTop3(committed.task.id, candidateId)"
                >
                  Swap out "{{ committed.task.title }}"
                </button>
              }
            </div>
            <button
              type="button"
              class="inspector-btn tonal"
              (click)="state.dismissSwapModal()"
            >
              Keep Current Top 3
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding-bottom: 84px;
      background: var(--md-background);
      color: var(--md-on-background);
    }
    .top-app-bar {
      height: 64px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--md-surface-container);
      border-bottom: 1px solid var(--md-surface-variant);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .top-bar-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .top-bar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .connection-pill {
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 700;
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
    }
    .connection-pill.connected {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .icon-action-btn {
      min-height: 48px;
      padding: 0 14px;
      border-radius: 14px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-surface-container-low);
      color: var(--md-on-surface);
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .icon-action-btn.primary-tonal {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .status-strip {
      padding: 8px 20px;
      font-size: 0.82rem;
      font-weight: 600;
      background: var(--md-surface-container-low);
      color: var(--md-on-surface-variant);
      border-bottom: 1px solid var(--md-surface-variant);
    }
    .viewport-content {
      flex: 1;
      max-width: 980px;
      width: 100%;
      margin: 0 auto;
      padding: 16px 20px 32px;
    }
    .horizon-viewport {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .top3-strip {
      background: var(--md-surface-container);
      border: 1px solid var(--md-surface-variant);
      border-radius: 22px;
      padding: 14px 16px;
    }
    .top3-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-size: 0.84rem;
      font-weight: 700;
    }
    .top3-counter {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .top3-slots {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .top3-slot {
      min-height: 48px;
      padding: 10px 12px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: left;
      font-size: 0.85rem;
    }
    .top3-slot.filled {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border: 1px solid var(--md-primary);
      font-weight: 700;
      cursor: pointer;
    }
    .top3-slot.empty {
      background: var(--md-surface-container-low);
      color: var(--md-on-surface-variant);
      border: 1px dashed var(--md-outline);
    }
    .slot-index {
      font-weight: 800;
    }
    .slot-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .window-tabs {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .window-tab-chip {
      min-height: 48px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-surface-container);
      color: var(--md-on-surface);
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .window-tab-chip.active {
      background: var(--md-primary);
      color: var(--md-on-primary);
      border-color: var(--md-primary);
    }
    .horizon-window-card {
      background: var(--md-surface-container);
      border: 1px solid var(--md-surface-variant);
      border-radius: 26px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .window-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .window-title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 800;
    }
    .window-subtitle {
      margin: 4px 0 0;
      font-size: 0.85rem;
      color: var(--md-on-surface-variant);
    }
    .headline-stat-pill {
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 800;
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
    }
    .descending-bars-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-row {
      width: 100%;
      min-height: 60px;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--md-surface-variant);
      background: var(--md-surface-container-low);
      color: var(--md-on-surface);
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: left;
      cursor: pointer;
    }
    .bar-row.selected {
      border: 2px solid var(--md-primary);
      background: var(--md-surface-container-high);
    }
    .bar-rank {
      font-size: 0.95rem;
      font-weight: 800;
      min-width: 28px;
      color: var(--md-primary);
    }
    .bar-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bar-labels {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 0.9rem;
    }
    .bar-title {
      font-weight: 700;
    }
    .bar-metrics {
      font-size: 0.82rem;
      color: var(--md-on-surface-variant);
    }
    .bar-track {
      height: 10px;
      border-radius: 999px;
      background: var(--md-surface-variant);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--md-primary);
    }
    .bar-fill.habitual {
      background: var(--md-error);
    }
    .bar-fill.drifting {
      background: var(--md-secondary);
    }
    .inspector-card {
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-surface-variant);
      border-radius: 22px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .inspector-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 8px;
    }
    .inspector-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 700;
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
      margin-bottom: 6px;
    }
    .inspector-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
    }
    .inspector-meta {
      font-size: 0.82rem;
      color: var(--md-on-surface-variant);
      font-weight: 600;
    }
    .inspector-notes {
      margin: 0;
      font-size: 0.88rem;
      color: var(--md-on-surface-variant);
    }
    .inspector-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .inspector-btn {
      min-height: 48px;
      padding: 0 16px;
      border-radius: 14px;
      font-weight: 700;
      font-size: 0.86rem;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .inspector-btn.primary {
      background: var(--md-primary);
      color: var(--md-on-primary);
    }
    .inspector-btn.secondary {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .inspector-btn.tonal {
      background: var(--md-surface);
      color: var(--md-on-surface);
      border-color: var(--md-outline);
    }
    .undone-log-viewport {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .section-heading {
      margin: 0 0 12px;
      font-size: 1.1rem;
      font-weight: 800;
    }
    .cards-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bottom-nav-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 72px;
      background: var(--md-surface-container);
      border-top: 1px solid var(--md-surface-variant);
      display: flex;
      justify-content: center;
      gap: 24px;
      z-index: 25;
    }
    .nav-item {
      min-width: 112px;
      min-height: 48px;
      border: none;
      background: transparent;
      color: var(--md-on-surface-variant);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-weight: 700;
      cursor: pointer;
    }
    .nav-item.active {
      color: var(--md-primary);
    }
    .nav-icon {
      font-size: 1.15rem;
      padding: 2px 16px;
      border-radius: 999px;
    }
    .nav-item.active .nav-icon {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }
    .nav-label {
      font-size: 0.78rem;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 15, 12, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 950;
      padding: 16px;
    }
    .swap-modal {
      max-width: 480px;
      width: 100%;
      background: var(--md-surface);
      color: var(--md-on-surface);
      border-radius: 24px;
      padding: 22px;
      border: 1px solid var(--md-surface-variant);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .swap-choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .swap-choice-btn {
      min-height: 48px;
      padding: 10px 14px;
      border-radius: 14px;
      border: 1px solid var(--md-primary);
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      font-weight: 700;
      text-align: left;
      cursor: pointer;
    }
  `]
})
export class AppComponent implements OnInit {
  readonly state = inject(PulseStateService);

  readonly screenTitle = computed(() => {
    switch (this.state.activeTab()) {
      case 'HORIZON':
        return 'Horizon';
      case 'UNDONE_LOG':
        return 'Undone Log';
      case 'SETTINGS':
        return 'Settings';
    }
  });

  ngOnInit(): void {
    this.state.loadState();
  }

  setTab(tab: NavTab): void {
    this.state.activeTab.set(tab);
  }
}
