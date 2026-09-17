/**
 * BreakpointDebuggerHUD.ts
 *
 * "GDB for a Connectome": Interactive debugging HUD.
 * Controls simulation halting, single-stepping, breakpoint rule activation,
 * and real-time membrane potential register monitoring.
 */

import { BreakpointManager } from '../../engine/causality/BreakpointManager';
import { BreakpointHitEvent, PopulationSample } from '../../engine/causality/ExperimentTypes';

export interface BreakpointDebuggerCallbacks {
  onContinue?: () => void;
  onStep?: (dtMs: number) => void;
  onRewind?: () => void;
}

export class BreakpointDebuggerHUD {
  private container: HTMLElement;
  private manager: BreakpointManager;
  private callbacks: BreakpointDebuggerCallbacks;
  private lastHitEvent: BreakpointHitEvent | null = null;
  private currentSample: PopulationSample | null = null;

  constructor(
    container: HTMLElement,
    manager: BreakpointManager,
    callbacks: BreakpointDebuggerCallbacks = {}
  ) {
    this.container = container;
    this.manager = manager;
    this.callbacks = callbacks;

    this.manager.setOnHit((event) => {
      this.lastHitEvent = event;
      this.render();
    });

    this.render();
  }

  public updateSample(sample: PopulationSample): void {
    this.currentSample = sample;
    this.updateRegistersOnly();
  }

  public setBreakpointHit(event: BreakpointHitEvent): void {
    this.lastHitEvent = event;
    this.render();
  }

  public render(): void {
    const isPaused = this.manager.getIsPaused();
    const rules = this.manager.getRules();

    const rulesHtml = rules
      .map(
        (r) => `
        <label class="breakpoint-rule-item">
          <input type="checkbox" data-id="${r.id}" ${r.enabled ? 'checked' : ''} />
          <span class="rule-name">${r.name}</span>
        </label>
      `
      )
      .join('');

    const statusHtml = isPaused
      ? `<div class="dbg-status-banner paused">
          <span class="status-indicator-dot red"></span>
          <span>SIMULATION PAUSED // BREAKPOINT HIT @ ${this.lastHitEvent?.tMs ?? 0} ms (${this.lastHitEvent?.ruleName ?? 'Predicate met'})</span>
        </div>`
      : `<div class="dbg-status-banner running">
          <span class="status-indicator-dot green"></span>
          <span>SIMULATION RUNNING // LISTENING FOR TRIGGER PREDICATES...</span>
        </div>`;

    this.container.innerHTML = `
      <div class="breakpoint-debugger-hud">
        <div class="dbg-header">
          <div class="dbg-title">
            <span class="gdb-badge">GDB</span>
            <span>CONNECTOME DEBUGGER // BREAKPOINT CONTROLLER</span>
          </div>
          <div class="dbg-controls">
            <button class="dbg-btn ${isPaused ? 'primary' : 'secondary'}" id="btnDbgContinue">
              <span>▶ CONTINUE</span>
            </button>
            <button class="dbg-btn" id="btnDbgStep1">
              <span>⏭ STEP 1ms</span>
            </button>
            <button class="dbg-btn" id="btnDbgStep10">
              <span>⏩ STEP 10ms</span>
            </button>
            <button class="dbg-btn danger" id="btnDbgRewind">
              <span>⏮ REWIND</span>
            </button>
          </div>
        </div>

        ${statusHtml}

        <div class="dbg-main-grid">
          <div class="dbg-rules-card">
            <h4 class="card-heading">ACTIVE BREAKPOINT PREDICATES</h4>
            <div class="rules-list">${rulesHtml}</div>
          </div>

          <div class="dbg-registers-card">
            <h4 class="card-heading">MEMBRANE VOLTAGE REGISTERS (V_m)</h4>
            <div class="registers-grid" id="voltageRegistersGrid">
              ${this.generateRegistersHtml()}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private generateRegistersHtml(): string {
    const defaultNodes = ['VIS_R1R6', 'VIS_ME', 'VIS_LO', 'LC4', 'LPLC2', 'DNp01', 'VNC_MOT'];
    return defaultNodes
      .map((node) => {
        const v = this.currentSample?.nodeVoltages[node] ?? 0;
        const spikes = this.currentSample?.nodeSpikes[node] ?? 0;
        const isFired = spikes > 0;
        return `
          <div class="reg-box ${isFired ? 'fired' : ''}">
            <span class="reg-id">${node}</span>
            <span class="reg-val">${v.toFixed(2)} mV</span>
            <span class="reg-spikes">${spikes} spikes</span>
          </div>
        `;
      })
      .join('');
  }

  private updateRegistersOnly(): void {
    const grid = this.container.querySelector('#voltageRegistersGrid');
    if (grid) {
      grid.innerHTML = this.generateRegistersHtml();
    }
  }

  private bindEvents(): void {
    this.container.querySelector('#btnDbgContinue')?.addEventListener('click', () => {
      this.manager.setPaused(false);
      this.callbacks.onContinue?.();
      this.render();
    });

    this.container.querySelector('#btnDbgStep1')?.addEventListener('click', () => {
      this.callbacks.onStep?.(1);
    });

    this.container.querySelector('#btnDbgStep10')?.addEventListener('click', () => {
      this.callbacks.onStep?.(10);
    });

    this.container.querySelector('#btnDbgRewind')?.addEventListener('click', () => {
      this.callbacks.onRewind?.();
    });

    this.container.querySelectorAll('.breakpoint-rule-item input').forEach((input) => {
      input.addEventListener('change', (e) => {
        const checkbox = e.target as HTMLInputElement;
        const id = checkbox.getAttribute('data-id');
        if (id) {
          this.manager.toggleRule(id, checkbox.checked);
        }
      });
    });
  }
}
