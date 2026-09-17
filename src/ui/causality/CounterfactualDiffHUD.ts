/**
 * CounterfactualDiffHUD.ts
 *
 * Split-screen trajectory comparator and causality forking visualizer.
 * Displays A(t) - B(t) across all observable populations, pins the exact
 * moment causality forks (firstDivergenceMs), and provides the factual
 * "Why Did This Work?" mechanistic report modal.
 */

import { CausalEngine } from '../../engine/causality/CausalEngine';
import {
  CounterfactualComparison,
  InterventionDef,
  ExperimentTrajectory,
} from '../../engine/causality/ExperimentTypes';

export interface CounterfactualDiffCallbacks {
  onNodeSelected?: (nodeId: string) => void;
}

export class CounterfactualDiffHUD {
  private container: HTMLElement;
  private currentBaseline: ExperimentTrajectory | null = null;
  private currentCounterfactual: ExperimentTrajectory | null = null;
  private currentComparison: CounterfactualComparison | null = null;
  private activeInterventions: InterventionDef[] = [];
  private callbacks: CounterfactualDiffCallbacks;

  constructor(container: HTMLElement, callbacks: CounterfactualDiffCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.initDefaultExperiments();
  }

  private initDefaultExperiments(): void {
    this.currentBaseline = CausalEngine.runTrajectory({
      name: 'Baseline (Intact Control)',
      stimulusType: 'canonical_looming',
      interventions: [],
    });

    this.activeInterventions = [{ targetNode: 'DNp01', type: 'silence', intensity: 1.0 }];

    this.currentCounterfactual = CausalEngine.runTrajectory({
      name: 'Counterfactual (DNp01 Silenced)',
      stimulusType: 'canonical_looming',
      interventions: this.activeInterventions,
    });

    this.currentComparison = CausalEngine.compare(
      this.currentBaseline,
      this.currentCounterfactual
    );

    this.render();
  }

  public setCounterfactual(interventions: InterventionDef[], name?: string): void {
    this.activeInterventions = interventions;
    if (!this.currentBaseline) {
      this.currentBaseline = CausalEngine.runTrajectory();
    }

    this.currentCounterfactual = CausalEngine.runTrajectory({
      name: name || `Counterfactual (${interventions.map((i) => `${i.type} ${i.targetNode}`).join(', ')})`,
      stimulusType: 'canonical_looming',
      interventions,
    });

    this.currentComparison = CausalEngine.compare(
      this.currentBaseline,
      this.currentCounterfactual
    );

    this.render();
  }

  public render(): void {
    if (!this.currentComparison || !this.currentBaseline || !this.currentCounterfactual) return;

    const comp = this.currentComparison;
    const diff = comp.strongestDifferential;
    const divTime = comp.firstDivergenceMs !== null ? `${comp.firstDivergenceMs} ms` : 'None detected';
    const earliestNode = comp.earliestAffectedPopulation || 'None';

    const diffPctStr = diff ? `${diff.deltaPct > 0 ? '+' : ''}${diff.deltaPct}%` : '0%';

    // Generate population delta rows
    const topDeltas = Object.entries(comp.deltaTrajectories)
      .map(([node, deltas]) => {
        const maxDelta = Math.max(...deltas.map(Math.abs), 0);
        return { node, maxDelta, deltas };
      })
      .sort((a, b) => b.maxDelta - a.maxDelta)
      .slice(0, 6);

    const deltaRowsHtml = topDeltas
      .map((d) => {
        const isEarliest = d.node === earliestNode;
        return `
          <div class="diff-pop-row ${isEarliest ? 'earliest' : ''}" data-node="${d.node}">
            <div class="pop-name-col">
              <span class="pop-id">${d.node}</span>
              ${isEarliest ? '<span class="earliest-badge">FIRST DIVERGENCE</span>' : ''}
            </div>
            <div class="pop-bar-col">
              <div class="diff-sparkline-bar" style="width: ${Math.min(100, d.maxDelta * 3)}%;"></div>
            </div>
            <div class="pop-val-col">Δ ${d.maxDelta} spikes</div>
          </div>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <div class="counterfactual-diff-hud">
        <div class="hud-top-bar">
          <div class="fork-title-box">
            <span class="title-icon">🔀</span>
            <span class="title-text">COUNTERFACTUAL REPLAY: DIVERGENCE ANALYSIS</span>
          </div>
          <button class="action-btn primary why-btn" id="btnWhyDidThisWork">
            <span>❓ WHY DID THIS WORK?</span>
          </button>
        </div>

        <!-- Divergence Metrics Strip -->
        <div class="divergence-telemetry-grid">
          <div class="telem-cell">
            <div class="cell-label">FIRST DIVERGENCE</div>
            <div class="cell-value text-accent">${divTime}</div>
          </div>
          <div class="telem-cell">
            <div class="cell-label">EARLIEST AFFECTED</div>
            <div class="cell-value text-cyan">${earliestNode}</div>
          </div>
          <div class="telem-cell">
            <div class="cell-label">STRONGEST DIFFERENTIAL</div>
            <div class="cell-value text-coral">${diff?.population || 'None'} (${diffPctStr})</div>
          </div>
          <div class="telem-cell">
            <div class="cell-label">BEHAVIORAL OUTCOME</div>
            <div class="cell-value ${comp.behavioralEffect.outcomeChanged ? 'text-danger' : 'text-success'}">
              ${comp.behavioralEffect.baselineEscaped ? 'ESCAPED' : 'CAUGHT'} → ${comp.behavioralEffect.counterfactualEscaped ? 'ESCAPED' : 'ABOLISHED'}
            </div>
          </div>
        </div>

        <!-- Split Causality Forking Diagram -->
        <div class="causal-fork-diagram">
          <div class="fork-column baseline-col">
            <div class="column-header">
              <span class="cond-dot green"></span>
              <span>BASELINE (INTACT)</span>
            </div>
            <div class="fork-node-box">
              <div class="fork-step">1. VIS_R1R6 (Photoreceptor Looming Input)</div>
              <div class="fork-arrow">↓</div>
              <div class="fork-step">2. VIS_LO & LC4 (Looming Feature Extraction)</div>
              <div class="fork-arrow">↓</div>
              <div class="fork-step active-step">3. DNp01 (Giant Fiber Escape Command Fired @ 38ms)</div>
              <div class="fork-arrow">↓</div>
              <div class="fork-step motor-step">4. VNC_MOT (Thoracic Motor Jump Extensor Escapes)</div>
            </div>
          </div>

          <div class="fork-divider">
            <div class="divider-line"></div>
            <div class="fork-pill">DIVERGENCE POINT: ${divTime}</div>
            <div class="divider-line"></div>
          </div>

          <div class="fork-column counterfactual-col">
            <div class="column-header">
              <span class="cond-dot red"></span>
              <span>COUNTERFACTUAL (${this.activeInterventions.map((i) => `${i.type.toUpperCase()} ${i.targetNode}`).join(', ')})</span>
            </div>
            <div class="fork-node-box">
              <div class="fork-step">1. VIS_R1R6 (Identical Looming Threat)</div>
              <div class="fork-arrow">↓</div>
              <div class="fork-step">2. VIS_LO & LC4 (Identical Retinotopic Excitation)</div>
              <div class="fork-arrow">↓</div>
              <div class="fork-step severed-step">3. DNp01 [SILENCED / CLAMPED] ✕ (Command Blocked)</div>
              <div class="fork-arrow">↓</div>
              <div class="fork-step silent-step">4. VNC_MOT [INACTIVE] ✕ (Stationary / Fly Caught)</div>
            </div>
          </div>
        </div>

        <!-- Differential Traces (A - B) -->
        <div class="population-deltas-section">
          <h4 class="section-heading">NEURAL POPULATION DIFFERENTIALS: $A(t) - B(t)$</h4>
          <div class="deltas-list">${deltaRowsHtml}</div>
        </div>
      </div>

      <!-- Mechanistic Report Modal (Hidden by default) -->
      <div class="mechanistic-modal-backdrop" id="mechanisticModal" style="display: none;">
        <div class="mechanistic-modal-card">
          <div class="modal-header">
            <h3>FACTUAL MECHANISTIC REPORT // CAUSAL ATTRIBUTION</h3>
            <button class="modal-close-btn" id="btnCloseModal">✕</button>
          </div>
          <div class="modal-body">
            <pre class="report-pre" id="reportPreContent"></pre>
          </div>
          <div class="modal-footer">
            <button class="action-btn secondary" id="btnCopyReport">COPY FACTUAL REPORT</button>
            <button class="action-btn primary" id="btnDismissModal">CLOSE</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const whyBtn = this.container.querySelector('#btnWhyDidThisWork');
    const modal = this.container.querySelector('#mechanisticModal') as HTMLElement;
    const reportPre = this.container.querySelector('#reportPreContent') as HTMLElement;
    const closeBtn = this.container.querySelector('#btnCloseModal');
    const dismissBtn = this.container.querySelector('#btnDismissModal');
    const copyBtn = this.container.querySelector('#btnCopyReport');

    whyBtn?.addEventListener('click', () => {
      if (!this.currentComparison) return;
      const report = CausalEngine.generateMechanisticReport(
        this.currentComparison,
        this.activeInterventions
      );
      if (reportPre) reportPre.textContent = report;
      if (modal) modal.style.display = 'flex';
    });

    closeBtn?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    dismissBtn?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    copyBtn?.addEventListener('click', () => {
      if (reportPre?.textContent) {
        navigator.clipboard?.writeText(reportPre.textContent);
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => {
          copyBtn.textContent = 'COPY FACTUAL REPORT';
        }, 2000);
      }
    });

    this.container.querySelectorAll('.diff-pop-row').forEach((row) => {
      row.addEventListener('click', () => {
        const node = row.getAttribute('data-node');
        if (node) this.callbacks.onNodeSelected?.(node);
      });
    });
  }
}
