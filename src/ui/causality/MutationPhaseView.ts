/**
 * MutationPhaseView.ts
 *
 * FLYBRAIN: NEURAL REALITY ENGINE — Phase 16: Mutation Mode & Dynamical Phase Map.
 *
 * Visualizes the 2D parameter space across Membrane Leak Rate and Firing Threshold,
 * mapping bifurcations between:
 * - ESCAPE (green)
 * - WALK / SUBTHRESHOLD (yellow)
 * - NO RESPONSE (red)
 */

import { MutationPhaseExplorer, PhaseMapGridResult } from '../../engine/causality/MutationPhaseExplorer';
import { PhaseMapPoint } from '../../engine/causality/ExperimentTypes';

export class MutationPhaseView {
  private container: HTMLElement;
  private currentResult: PhaseMapGridResult;
  private selectedPoint: PhaseMapPoint | null = null;
  private stimulusSpeed: number = 2.0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.currentResult = MutationPhaseExplorer.sweepPhaseGrid({ stimulusSpeed: this.stimulusSpeed });
    this.selectedPoint = this.currentResult.grid[0] || null;
    this.render();
  }

  private recompute(): void {
    this.currentResult = MutationPhaseExplorer.sweepPhaseGrid({ stimulusSpeed: this.stimulusSpeed });
    this.renderGridOnly();
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="mutation-phase-container">
        <div class="phase-header">
          <div class="phase-badge">
            <span>🧬</span>
            <span>PHASE 16: MUTATION MODE // DYNAMICAL PHASE MAP</span>
          </div>
          <h3 class="phase-title">CONNECTOME PARAMETER SPACE & BIFURCATION MAP</h3>
          <p class="phase-subtitle">
            Explore the biophysical phase transitions of the Drosophila escape circuit.
            Varying passive leak rate $\\tau_m$ and voltage threshold $V_{th}$ reveals the critical
            boundaries between Escape Takeoff, Subthreshold Freezing/Walking, and Signal Extinction.
          </p>
        </div>

        <div class="phase-controls-bar">
          <div class="speed-slider-group">
            <label class="slider-label">THREAT LOOMING SPEED: <strong id="speedVal">${this.stimulusSpeed.toFixed(1)}x</strong></label>
            <input type="range" min="1.0" max="4.0" step="0.5" value="${this.stimulusSpeed}" id="speedRangeInput" class="phase-slider" />
          </div>
          <div class="legend-group">
            <span class="legend-item"><span class="legend-dot green"></span> ESCAPE (DNp01 Triggered)</span>
            <span class="legend-item"><span class="legend-dot yellow"></span> WALK / SUBTHRESHOLD</span>
            <span class="legend-item"><span class="legend-dot red"></span> NO RESPONSE</span>
          </div>
        </div>

        <div class="phase-main-grid">
          <!-- 2D Interactive Grid -->
          <div class="grid-card">
            <div class="axis-y-label">← HYPO-EXCITABLE (High $V_{th}$) | HYPER-EXCITABLE (Low $V_{th}$) →</div>
            <div class="interactive-phase-grid" id="interactivePhaseGrid">
              <!-- Grid cells rendered here -->
            </div>
            <div class="axis-x-label">LEAK RATE $\\tau_{decay}$ (Passive Membrane Conductance) →</div>
          </div>

          <!-- Selected Point Details Inspector -->
          <div class="point-inspector-card" id="pointInspectorCard">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    this.renderGridOnly();
    this.renderInspector();
    this.bindEvents();
  }

  private renderGridOnly(): void {
    const gridEl = this.container.querySelector('#interactivePhaseGrid');
    if (!gridEl) return;

    const { grid, leakRange, thresholdRange } = this.currentResult;
    gridEl.innerHTML = '';
    (gridEl as HTMLElement).style.gridTemplateColumns = `repeat(${leakRange.length}, 1fr)`;

    // Render in reverse threshold order (high threshold on top, low on bottom)
    const sortedThresholds = [...thresholdRange].reverse();

    for (const thresh of sortedThresholds) {
      for (const leak of leakRange) {
        const point = grid.find((p) => Math.abs(p.leakRate - leak) < 0.001 && Math.abs(p.threshold - thresh) < 0.01);
        if (!point) continue;

        const cell = document.createElement('div');
        cell.className = `phase-cell outcome-${point.outcome.toLowerCase()}`;
        if (this.selectedPoint && Math.abs(this.selectedPoint.leakRate - leak) < 0.001 && Math.abs(this.selectedPoint.threshold - thresh) < 0.01) {
          cell.classList.add('selected');
        }

        cell.title = `Leak: ${leak}, Thresh: ${thresh}V -> ${point.outcome}`;
        cell.innerHTML = `
          <span class="cell-outcome-code">${point.outcome === 'ESCAPE' ? 'ESC' : point.outcome === 'WALK' ? 'WLK' : 'EXT'}</span>
          <span class="cell-latency">${point.latencyMs ? `${point.latencyMs}ms` : '—'}</span>
        `;

        cell.addEventListener('click', () => {
          this.selectedPoint = point;
          this.container.querySelectorAll('.phase-cell').forEach((c) => c.classList.remove('selected'));
          cell.classList.add('selected');
          this.renderInspector();
        });

        gridEl.appendChild(cell);
      }
    }
  }

  private renderInspector(): void {
    const inspectorEl = this.container.querySelector('#pointInspectorCard');
    if (!inspectorEl) return;

    if (!this.selectedPoint) {
      inspectorEl.innerHTML = `<div class="p-3 text-muted">Click any coordinate in the phase grid to inspect biophysical parameters.</div>`;
      return;
    }

    const p = this.selectedPoint;
    const outcomeClass = p.outcome === 'ESCAPE' ? 'text-success' : p.outcome === 'WALK' ? 'text-warning' : 'text-danger';

    inspectorEl.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-badge">POINT INSPECTOR</span>
        <h4 class="inspector-title ${outcomeClass}">CIRCUIT DYNAMICS: ${p.outcome}</h4>
      </div>

      <div class="inspector-metrics">
        <div class="metric-row">
          <span class="metric-label">Membrane Leak Factor:</span>
          <span class="metric-val font-mono">${p.leakRate}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Spike Threshold $V_{th}$:</span>
          <span class="metric-val font-mono">${p.threshold} mV</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Looming Velocity:</span>
          <span class="metric-val font-mono">${p.stimulusSpeed}x</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Escape Latency:</span>
          <span class="metric-val font-mono highlight">${p.latencyMs ? `${p.latencyMs} ms` : 'Infinity (No Takeoff)'}</span>
        </div>
      </div>

      <div class="inspector-explanation">
        ${
          p.outcome === 'ESCAPE'
            ? `<p class="text-success"><strong>Stable Escape Regime:</strong> Feedforward excitation from visual lobula (LC4/LPLC2) successfully integrates above $V_{th}$, triggering the Giant Fiber (DNp01) within ${p.latencyMs}ms.</p>`
            : p.outcome === 'WALK'
            ? `<p class="text-warning"><strong>Subthreshold Walking Regime:</strong> Membrane leak dampens excitation before reaching DNp01 threshold. Low-level VNC motor neurons fire slowly, resulting in evasive crawling rather than flight jump.</p>`
            : `<p class="text-danger"><strong>Signal Extinction Regime:</strong> Exceedingly high threshold or severe leak extinguishes the synaptic cascade in medulla/lobula neuropils. The fly fails to respond to looming predator.</p>`
        }
      </div>
    `;
  }

  private bindEvents(): void {
    const slider = this.container.querySelector('#speedRangeInput') as HTMLInputElement;
    slider?.addEventListener('input', () => {
      this.stimulusSpeed = parseFloat(slider.value);
      const valLabel = this.container.querySelector('#speedVal');
      if (valLabel) valLabel.textContent = `${this.stimulusSpeed.toFixed(1)}x`;
      this.recompute();
    });
  }
}
