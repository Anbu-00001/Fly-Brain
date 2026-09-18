/**
 * AppState.ts
 *
 * Central state machine for FLY ESCAPE.
 * Coordinates screens, engine modes, encounters, and telemetry.
 */

import { EngineMode, LIVE_ENGINE_METADATA, RECORDED_ENGINE_METADATA } from '../engine/shared/ConnectomeTypes';

export type ScreenId = 'home' | 'experiment' | 'replay' | 'brainSurgery' | 'lab' | 'causality';

export type EncounterStatus = 'idle' | 'countdown' | 'running' | 'escaped' | 'caught';

export interface AppStateListeners {
  onScreenChange?: (screen: ScreenId) => void;
  onStatusChange?: (status: EncounterStatus) => void;
  onEngineChange?: (mode: EngineMode) => void;
  onTelemetryUpdate?: () => void;
}

export class AppState {
  private currentScreen: ScreenId = 'home';
  private currentEngine: EngineMode = 'LIVE';
  private encounterStatus: EncounterStatus = 'idle';

  // Live telemetry metrics
  public totalActiveNeurons: number = 0;
  public totalNeuronsOnScreen: number = LIVE_ENGINE_METADATA.totalNeurons;
  public responseWallClockMs: number | null = null;
  public threatStartTimeMs: number | null = null;
  public escapeStartTimeMs: number | null = null;
  public survivalTimeS: number = 0;

  // View toggles
  public is3DView: boolean = false;
  public isReceptiveFieldInspectorOpen: boolean = true;
  public isAboutDrawerOpen: boolean = false;

  private listeners: AppStateListeners = {};

  constructor(listeners: AppStateListeners = {}) {
    this.listeners = listeners;
  }

  public setScreen(screen: ScreenId): void {
    if (this.currentScreen === screen) return;
    this.currentScreen = screen;

    // Brain Surgery and Canonical Replay are RECORDED mode per §11 and §12
    if (screen === 'brainSurgery' || screen === 'replay') {
      this.setEngine('RECORDED');
    } else if (screen === 'experiment' || screen === 'lab' || screen === 'causality') {
      this.setEngine('LIVE');
    }

    this.listeners.onScreenChange?.(screen);
  }

  public getScreen(): ScreenId {
    return this.currentScreen;
  }

  public setEngine(mode: EngineMode): void {
    if (this.currentEngine === mode) return;
    this.currentEngine = mode;
    this.totalNeuronsOnScreen = mode === 'LIVE'
      ? LIVE_ENGINE_METADATA.totalNeurons
      : RECORDED_ENGINE_METADATA.totalNeurons;

    this.listeners.onEngineChange?.(mode);
  }

  public getEngine(): EngineMode {
    return this.currentEngine;
  }

  public setStatus(status: EncounterStatus): void {
    this.encounterStatus = status;
    this.listeners.onStatusChange?.(status);
  }

  public getStatus(): EncounterStatus {
    return this.encounterStatus;
  }

  public resetEncounter(): void {
    this.encounterStatus = 'idle';
    this.responseWallClockMs = null;
    this.threatStartTimeMs = null;
    this.escapeStartTimeMs = null;
    this.survivalTimeS = 0;
  }
}
