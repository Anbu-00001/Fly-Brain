/**
 * BrainPanel.ts
 *
 * Implements the right-side Live Brain Activity telemetry panel per §9 of AGENTS.md.
 * Reads ONLY verified engine metrics and cell types.
 */

import { SimulationTickData } from '../engine/shared/ConnectomeTypes';
import { countUp } from './design/effects';

export interface BrainPanelCallbacks {
  onToggle3D?: (is3D: boolean) => void;
}

export class BrainPanel {
  private container: HTMLElement;
  private callbacks: BrainPanelCallbacks;

  // Elements
  private activeCountEl!: HTMLElement;
  private firingPctEl!: HTMLElement;
  private latencyEl!: HTMLElement;
  private spikeRateEl!: HTMLElement;
  private sparklinePolyline!: SVGPolylineElement;

  private barSensory!: HTMLElement;
  private barCentral!: HTMLElement;
  private barDrives!: HTMLElement;
  private barMotor!: HTMLElement;

  private valSensory!: HTMLElement;
  private valCentral!: HTMLElement;
  private valDrives!: HTMLElement;
  private valMotor!: HTMLElement;

  private activeGroupsList!: HTMLElement;
  private toggle3DBtn!: HTMLButtonElement;

  private spikeHistory: number[] = [];
  private is3D: boolean = false;

  constructor(parentElement: HTMLElement, callbacks: BrainPanelCallbacks = {}) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'brainPanel';
    this.container.className = 'brain-panel';
    parentElement.appendChild(this.container);

    this.renderLayout();
    this.bindElements();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-badge-glow">CONNECTOME TELEMETRY</span>
          <h2>LIVE BRAIN ACTIVITY</h2>
        </div>
        <button type="button" class="view-toggle-btn" id="btnToggle3D">
          <span class="toggle-icon">◈</span>
          <span class="toggle-label">3D BRAIN VIEW</span>
        </button>
      </div>

      <!-- Hero Numerical Telemetry -->
      <div class="telemetry-grid">
        <div class="stat-card">
          <span class="stat-label">ACTIVE NEURONS</span>
          <div class="stat-number-row">
            <span class="stat-value highlight-cyan" id="statActiveCount">0</span>
            <span class="stat-sub" id="statFiringPct">(0.0%)</span>
          </div>
          <span class="prov prov-measured" tabindex="0"
            title="Measured: ENGINE-LIVE reports this directly as firedNeurons for the tick on screen.">
            <span class="prov-glyph" aria-hidden="true">●</span>MEASURED
          </span>
        </div>

        <div class="stat-card">
          <span class="stat-label">RESPONSE TIME</span>
          <div class="stat-number-row">
            <span class="stat-value" id="statLatency">--</span>
            <span class="stat-sub">ms wall-clock</span>
          </div>
          <span class="prov prov-derived" tabindex="0"
            title="Derived: browser wall-clock between threat onset and takeoff, measured with performance.now(). This is the simulation's real-time response, NOT a biological reaction latency — ENGINE-LIVE's LIF model carries no biological time.">
            <span class="prov-glyph" aria-hidden="true">◐</span>DERIVED
          </span>
        </div>

        <div class="stat-card">
          <span class="stat-label">SPIKES / TICK</span>
          <div class="stat-number-row">
            <span class="stat-value" id="statSpikeRate">0</span>
            <span class="stat-sub">ticks, not seconds</span>
          </div>
          <span class="prov prov-measured" tabindex="0"
            title="Measured: neurons that fired on the most recent worker tick. Reported per TICK, not per second: the previous build multiplied this by 10 and labelled it Hz, but 10 is the worker's render cadence, not a biological rate.">
            <span class="prov-glyph" aria-hidden="true">●</span>MEASURED
          </span>
        </div>
      </div>

      <!-- Regional Breakdown -->
      <div class="regional-section">
        <div class="section-title">REGIONAL NEURAL DISCHARGE</div>

        <div class="region-row">
          <div class="region-meta">
            <span class="region-tag sensory-tag">SENSORY</span>
            <span class="region-count" id="countSensory">0</span>
          </div>
          <div class="region-bar-bg">
            <div class="region-bar-fill fill-blue" id="barSensory" style="width: 0%"></div>
          </div>
        </div>

        <div class="region-row">
          <div class="region-meta">
            <span class="region-tag central-tag">CENTRAL</span>
            <span class="region-count" id="countCentral">0</span>
          </div>
          <div class="region-bar-bg">
            <div class="region-bar-fill fill-purple" id="barCentral" style="width: 0%"></div>
          </div>
        </div>

        <div class="region-row">
          <div class="region-meta">
            <span class="region-tag drives-tag">DRIVES</span>
            <span class="region-count" id="countDrives">0</span>
          </div>
          <div class="region-bar-bg">
            <div class="region-bar-fill fill-amber" id="barDrives" style="width: 0%"></div>
          </div>
        </div>

        <div class="region-row">
          <div class="region-meta">
            <span class="region-tag motor-tag">MOTOR</span>
            <span class="region-count" id="countMotor">0</span>
          </div>
          <div class="region-bar-bg">
            <div class="region-bar-fill fill-red" id="barMotor" style="width: 0%"></div>
          </div>
        </div>
      </div>

      <!-- Real-time Sparkline -->
      <div class="sparkline-section">
        <div class="section-title">FIRING DENSITY TIMELINE (LAST 60 TICKS)</div>
        <div class="sparkline-container">
          <svg class="sparkline-svg" viewBox="0 0 300 50" preserveAspectRatio="none">
            <polyline id="sparklinePolyline" points="" fill="none" stroke="#00f0ff" stroke-width="2" />
          </svg>
        </div>
      </div>

      <!-- Active Functional Groups List -->
      <div class="groups-section">
        <div class="section-title">ACTIVE FUNCTIONAL CIRCUITS</div>
        <div class="groups-scroll" id="activeGroupsList">
          <div class="group-pill-idle">Awaiting stimulation...</div>
        </div>
      </div>
    `;
  }

  private bindElements(): void {
    this.activeCountEl = this.container.querySelector('#statActiveCount') as HTMLElement;
    this.firingPctEl = this.container.querySelector('#statFiringPct') as HTMLElement;
    this.latencyEl = this.container.querySelector('#statLatency') as HTMLElement;
    this.spikeRateEl = this.container.querySelector('#statSpikeRate') as HTMLElement;
    this.sparklinePolyline = this.container.querySelector('#sparklinePolyline') as SVGPolylineElement;

    this.barSensory = this.container.querySelector('#barSensory') as HTMLElement;
    this.barCentral = this.container.querySelector('#barCentral') as HTMLElement;
    this.barDrives = this.container.querySelector('#barDrives') as HTMLElement;
    this.barMotor = this.container.querySelector('#barMotor') as HTMLElement;

    this.valSensory = this.container.querySelector('#countSensory') as HTMLElement;
    this.valCentral = this.container.querySelector('#countCentral') as HTMLElement;
    this.valDrives = this.container.querySelector('#countDrives') as HTMLElement;
    this.valMotor = this.container.querySelector('#countMotor') as HTMLElement;

    this.activeGroupsList = this.container.querySelector('#activeGroupsList') as HTMLElement;
    this.toggle3DBtn = this.container.querySelector('#btnToggle3D') as HTMLButtonElement;

    this.toggle3DBtn.addEventListener('click', () => {
      this.is3D = !this.is3D;
      this.toggle3DBtn.classList.toggle('active', this.is3D);
      const label = this.toggle3DBtn.querySelector('.toggle-label') as HTMLElement;
      if (label) label.textContent = this.is3D ? '2D PARTICLE VIEW' : '3D BRAIN VIEW';
      this.callbacks.onToggle3D?.(this.is3D);
    });
  }

  public updateTick(data: SimulationTickData, totalNeurons: number, latencyMs: number | null): void {
    // 1. Numerical counts
    countUp(this.activeCountEl, data.firedCount);
    const pct = ((data.firedCount / totalNeurons) * 100).toFixed(1);
    this.firingPctEl.textContent = `(${pct}%)`;

    if (latencyMs !== null) {
      this.latencyEl.textContent = String(latencyMs);
    }

    // 2. Rolling sparkline
    this.spikeHistory.push(data.firedCount);
    if (this.spikeHistory.length > 60) {
      this.spikeHistory.shift();
    }
    this.updateSparkline();

    // 3. Spikes on this tick. Deliberately NOT converted to Hz: multiplying by
    //    the worker's 10/sec render cadence would state a biological rate the
    //    dimensionless LIF model cannot support.
    countUp(this.spikeRateEl, data.firedCount);

    // 4. Regional breakdown
    const rf = data.regionalFired;
    const regMax = Math.max(1, rf.sensory, rf.central, rf.drives, rf.motor);

    countUp(this.valSensory, rf.sensory);
    this.barSensory.style.width = `${Math.round((rf.sensory / regMax) * 100)}%`;

    countUp(this.valCentral, rf.central);
    this.barCentral.style.width = `${Math.round((rf.central / regMax) * 100)}%`;

    countUp(this.valDrives, rf.drives);
    this.barDrives.style.width = `${Math.round((rf.drives / regMax) * 100)}%`;

    countUp(this.valMotor, rf.motor);
    this.barMotor.style.width = `${Math.round((rf.motor / regMax) * 100)}%`;

    // 5. Active Groups Pills
    const topActive = Object.entries(data.groupSpikes)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (topActive.length > 0) {
      this.activeGroupsList.innerHTML = topActive
        .map(([name, count]) => `
          <div class="group-pill">
            <span class="group-pill-name">${name}</span>
            <span class="group-pill-count">${count}</span>
          </div>
        `)
        .join('');
    }
  }

  private updateSparkline(): void {
    if (this.spikeHistory.length < 2) return;
    const max = Math.max(10, ...this.spikeHistory);
    const width = 300;
    const height = 45;
    const stepX = width / (this.spikeHistory.length - 1);

    const points = this.spikeHistory
      .map((val, idx) => {
        const x = Math.round(idx * stepX);
        const y = Math.round(height - (val / max) * height) + 2;
        return `${x},${y}`;
      })
      .join(' ');

    this.sparklinePolyline.setAttribute('points', points);
  }

  public reset(): void {
    this.spikeHistory = [];
    this.sparklinePolyline.setAttribute('points', '');
    this.activeCountEl.textContent = '0';
    this.firingPctEl.textContent = '(0.0%)';
    this.latencyEl.textContent = '--';
    this.valSensory.textContent = '0';
    this.valCentral.textContent = '0';
    this.valDrives.textContent = '0';
    this.valMotor.textContent = '0';
    this.barSensory.style.width = '0%';
    this.barCentral.style.width = '0%';
    this.barDrives.style.width = '0%';
    this.barMotor.style.width = '0%';
    this.activeGroupsList.innerHTML = '<div class="group-pill-idle">Awaiting stimulation...</div>';
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
