/**
 * AskTheBrainHero.ts
 *
 * The Hero Experience for FLYBRAIN: CAUSALITY ENGINE.
 * "Don't just manipulate the brain. Reverse-engineer it."
 *
 * User selects a behavioral target objective; the engine automatically searches
 * candidate circuits in real time, runs counterfactuals, optimizes intervention cost,
 * and presents minimal and alternative solutions along with the Pareto frontier.
 */

import { CausalSearch } from '../../engine/causality/CausalSearch';
import {
  CausalTargetObjective,
  CausalSearchResult,
  MinimalInterventionSolution,
} from '../../engine/causality/ExperimentTypes';

export interface AskTheBrainHeroCallbacks {
  onSolutionSelected?: (solution: MinimalInterventionSolution) => void;
  onViewCounterfactual?: (solution: MinimalInterventionSolution) => void;
}

export class AskTheBrainHero {
  private container: HTMLElement;
  private callbacks: AskTheBrainHeroCallbacks;
  private currentObjective: CausalTargetObjective = 'prevent_escape';
  private isSearching: boolean = false;
  private lastResult: CausalSearchResult | null = null;

  public getLastResult(): CausalSearchResult | null {
    return this.lastResult;
  }

  constructor(container: HTMLElement, callbacks: AskTheBrainHeroCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="ask-brain-hero">
        <div class="hero-header">
          <div class="hero-badge">
            <span class="pulsing-dot"></span>
            <span>NEURAL CAUSALITY ENGINE // DISCOVERY LABORATORY</span>
          </div>
          <h2 class="hero-title">ASK THE BRAIN: WHAT DO YOU WANT TO DISCOVER?</h2>
          <p class="hero-subtitle">
            Give the system a behavioral objective. The machine automatically searches the Drosophila connectome,
            executes counterfactual experiments, and discovers the minimal causal intervention.
          </p>
        </div>

        <div class="objective-selector-bar">
          <div class="selector-label">TARGET BEHAVIOR:</div>
          <div class="objective-chips" id="heroObjectiveChips">
            <button class="obj-chip active" data-obj="prevent_escape">🚫 Prevent Escape</button>
            <button class="obj-chip" data-obj="trigger_escape">⚡ Trigger Escape</button>
            <button class="obj-chip" data-obj="delay_escape">⏱️ Delay Escape</button>
            <button class="obj-chip" data-obj="reverse_direction">🔄 Reverse Direction</button>
            <button class="obj-chip" data-obj="suppress_visual_preserve_motor">👁️ Visual Off / Motor On</button>
            <button class="obj-chip" data-obj="maximize_startle">💥 Maximize Startle</button>
            <button class="obj-chip" data-obj="minimize_activation">📉 Minimize Activation</button>
          </div>
          <button class="action-btn primary large hero-search-btn" id="btnExecuteSearch">
            <span class="btn-icon">⚡</span>
            <span>SEARCH CONNECTOME FOR CAUSAL SET</span>
          </button>
        </div>

        <div class="hero-search-progress" id="heroSearchProgress" style="display: none;">
          <div class="search-terminal-log">
            <div class="term-line" id="termLine1">> INITIALIZING COUNTERFACTUAL ENVIRONMENT...</div>
            <div class="term-line" id="termLine2">> SEARCHING 10 CANDIDATE NEURAL POPULATIONS...</div>
            <div class="term-line" id="termLine3">> EXECUTING DELTA DEBUGGING & COMBINATORIAL SUBSETS...</div>
            <div class="term-line" id="termLine4">> MINIMIZING MULTI-OBJECTIVE INTERVENTION COST...</div>
          </div>
          <div class="search-bar-track">
            <div class="search-bar-fill" id="searchBarFill"></div>
          </div>
        </div>

        <div class="hero-results-container" id="heroResultsContainer">
          <!-- Populated dynamically upon search completion -->
        </div>
      </div>
    `;

    this.bindEvents();
    // Run initial search for default objective
    this.executeSearch();
  }

  private bindEvents(): void {
    const chipHolder = this.container.querySelector('#heroObjectiveChips');
    chipHolder?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.obj-chip') as HTMLButtonElement;
      if (!btn) return;
      this.container.querySelectorAll('.obj-chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      this.currentObjective = btn.getAttribute('data-obj') as CausalTargetObjective;
      this.executeSearch();
    });

    const searchBtn = this.container.querySelector('#btnExecuteSearch');
    searchBtn?.addEventListener('click', () => {
      this.executeSearch();
    });
  }

  public executeSearch(): void {
    if (this.isSearching) return;
    this.isSearching = true;

    const progressBox = this.container.querySelector('#heroSearchProgress') as HTMLElement;
    const resultsBox = this.container.querySelector('#heroResultsContainer') as HTMLElement;
    const fill = this.container.querySelector('#searchBarFill') as HTMLElement;

    if (progressBox) progressBox.style.display = 'block';
    if (resultsBox) resultsBox.style.opacity = '0.4';
    if (fill) fill.style.width = '10%';

    setTimeout(() => {
      if (fill) fill.style.width = '60%';
    }, 80);

    setTimeout(() => {
      if (fill) fill.style.width = '100%';
      const result = CausalSearch.search(this.currentObjective);
      this.lastResult = result;
      this.isSearching = false;

      if (progressBox) progressBox.style.display = 'none';
      if (resultsBox) {
        resultsBox.style.opacity = '1.0';
        this.renderResults(result);
      }
    }, 200);
  }

  private renderResults(result: CausalSearchResult): void {
    const resultsBox = this.container.querySelector('#heroResultsContainer');
    if (!resultsBox) return;

    const min = result.minimalSolution;
    const alts = result.alternativeSolutions;

    const minInterventionsHtml = min.interventions
      .map(
        (i) =>
          `<span class="intervention-tag ${i.type}">
            <strong>${i.type.toUpperCase()}</strong> ${i.targetNode}
          </span>`
      )
      .join(' + ');

    const altsHtml = alts
      .map((alt, idx) => {
        const tags = alt.interventions
          .map((i) => `<span class="tag-small">${i.type.toUpperCase()} ${i.targetNode}</span>`)
          .join(' + ');
        return `
          <div class="alt-solution-card" data-idx="${idx}">
            <div class="alt-header">
              <span class="alt-badge">ALTERNATIVE #${idx + 1}</span>
              <span class="alt-cost">Cost Score: ${alt.costScore}</span>
            </div>
            <div class="alt-interventions">${tags}</div>
            <div class="alt-meta">
              <span>Neurons Affected: <strong>${alt.totalNeuronsAffected}</strong></span>
              <span>Divergence: <strong>${alt.latencyToDivergenceMs} ms</strong></span>
            </div>
          </div>
        `;
      })
      .join('');

    const paretoHtml = result.paretoFrontier
      .map(
        (p, idx) => `
        <div class="pareto-dot-row">
          <span class="pareto-rank">#${idx + 1}</span>
          <div class="pareto-bar-track">
            <div class="pareto-bar-fill" style="width: ${Math.max(15, (1.0 - idx * 0.15) * 100)}%;"></div>
          </div>
          <span class="pareto-cost">${p.neuronCost} cells</span>
        </div>
      `
      )
      .join('');

    resultsBox.innerHTML = `
      <div class="results-grid">
        <div class="solution-hero-card">
          <div class="card-status-strip">
            <span class="status-pill success">OPTIMAL 1-MINIMAL SOLUTION FOUND</span>
            <span class="eval-stat">Evaluated ${result.evaluationsCount} combinations in ${result.searchDurationMs}ms</span>
          </div>

          <div class="minimal-solution-body">
            <div class="solution-formula">${minInterventionsHtml}</div>
            <p class="solution-explanation">${min.explanation}</p>

            <div class="metrics-dashboard-row">
              <div class="dash-metric">
                <div class="metric-num highlight">${min.interventions.length}</div>
                <div class="metric-lbl">Interventions Needed</div>
              </div>
              <div class="dash-metric">
                <div class="metric-num">${min.totalNeuronsAffected}</div>
                <div class="metric-lbl">Neurons Affected</div>
              </div>
              <div class="dash-metric">
                <div class="metric-num">${min.latencyToDivergenceMs} ms</div>
                <div class="metric-lbl">First Divergence Point</div>
              </div>
              <div class="dash-metric">
                <div class="metric-num text-success">${min.costScore}</div>
                <div class="metric-lbl">Normalized Cost C</div>
              </div>
            </div>

            <div class="solution-actions-row">
              <button class="action-btn primary" id="btnInspectCounterfactual">
                <span>🔀 VIEW COUNTERFACTUAL FORK ($A(t) - B(t)$)</span>
              </button>
              <button class="action-btn secondary" id="btnHighlightCircuitIn3D">
                <span>🧠 HIGHLIGHT DISCOVERED CIRCUIT IN 3D</span>
              </button>
            </div>
          </div>
        </div>

        <div class="alternatives-sidebar">
          <div class="sidebar-block">
            <h4 class="sidebar-title">PARETO FRONTIER (COST VS EFFECT)</h4>
            <div class="pareto-mini-chart">${paretoHtml}</div>
          </div>

          <div class="sidebar-block">
            <h4 class="sidebar-title">ALTERNATIVE CIRCUIT SOLUTIONS</h4>
            <div class="alts-list">${altsHtml || '<div class="no-alts">No other single-circuit solutions found.</div>'}</div>
          </div>
        </div>
      </div>
    `;

    // Bind action buttons
    resultsBox.querySelector('#btnInspectCounterfactual')?.addEventListener('click', () => {
      this.callbacks.onViewCounterfactual?.(min);
    });

    resultsBox.querySelector('#btnHighlightCircuitIn3D')?.addEventListener('click', () => {
      this.callbacks.onSolutionSelected?.(min);
    });

    resultsBox.querySelectorAll('.alt-solution-card').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.getAttribute('data-idx') || '0', 10);
        if (alts[idx]) {
          this.callbacks.onSolutionSelected?.(alts[idx]);
        }
      });
    });
  }

  public getSelectedObjective(): CausalTargetObjective {
    return this.currentObjective;
  }
}
