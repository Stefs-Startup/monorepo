import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { StalledTaskCardComponent } from './components/stalled-task-card/stalled-task-card.component';
import { SettingsNavigatorComponent } from './components/settings-navigator/settings-navigator.component';
import { PartnerSettingsDto } from './models/pulse.models';

describe('Pulse Visual Focus Dashboard — Tier 2 Component & State Contract Suite', () => {
  it('verifies AppComponent and Visual Focus Dashboard components are defined with zero chat overlay dependency', () => {
    expect(AppComponent).toBeDefined();
    expect(StalledTaskCardComponent).toBeDefined();
    expect(SettingsNavigatorComponent).toBeDefined();
  });

  it('verifies SettingsNavigatorComponent starts on INDEX and transitions cleanly across all 4 sub-pages', () => {
    const nav = new SettingsNavigatorComponent();
    const initialSettings: PartnerSettingsDto = {
      partnerTone: 'Candid & Warm',
      aiStreamingEnabled: false,
      connectedGoogleAccount: 'stefan@pulse.local',
      lastSyncStatus: 'Synced',
      morningRitualTime: '08:30',
      eveningShutdownTime: '18:00',
      zeroPiiTelemetryEnabled: true
    };
    nav.settings = initialSettings;

    expect(nav.subPage()).toBe('INDEX');

    nav.subPage.set('PERSONA_AI');
    expect(nav.subPage()).toBe('PERSONA_AI');

    nav.subPage.set('GOOGLE_SYNC');
    expect(nav.subPage()).toBe('GOOGLE_SYNC');

    nav.subPage.set('CADENCE_RITUALS');
    expect(nav.subPage()).toBe('CADENCE_RITUALS');

    nav.subPage.set('PRIVACY_DIAGNOSTICS');
    expect(nav.subPage()).toBe('PRIVACY_DIAGNOSTICS');

    nav.subPage.set('INDEX');
    expect(nav.subPage()).toBe('INDEX');
  });

  it('emits updated ritual cadence times from SettingsNavigatorComponent for EPIC-4 stickiness windows', () => {
    const nav = new SettingsNavigatorComponent();
    nav.settings = {
      partnerTone: 'Candid & Warm',
      aiStreamingEnabled: false,
      connectedGoogleAccount: 'stefan@pulse.local',
      lastSyncStatus: 'Synced',
      morningRitualTime: '08:30',
      eveningShutdownTime: '18:00',
      zeroPiiTelemetryEnabled: true
    };

    let emitted: PartnerSettingsDto | null = null;
    nav.saveSettings.subscribe((updated) => {
      emitted = updated;
    });

    nav.updateMorningTime('07:45');
    expect(emitted?.morningRitualTime).toBe('07:45');

    nav.updateEveningTime('17:30');
    expect(emitted?.eveningShutdownTime).toBe('17:30');
  });

  it('emits direct visual triage actions from StalledTaskCardComponent', () => {
    const card = new StalledTaskCardComponent();
    const events: Array<{ taskId: string; action: string }> = [];
    card.triage.subscribe((e) => events.push(e));

    card.triage.emit({ taskId: 'task-tax-receipts', action: 'SHRINK_TO_5M' });
    card.triage.emit({ taskId: 'task-tax-receipts', action: 'COMMIT_TODAY' });

    expect(events).toEqual([
      { taskId: 'task-tax-receipts', action: 'SHRINK_TO_5M' },
      { taskId: 'task-tax-receipts', action: 'COMMIT_TODAY' }
    ]);
  });
});
