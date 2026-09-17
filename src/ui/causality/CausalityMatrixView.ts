/**
 * CausalityMatrixView.ts
 *
 * Visual table for the Necessary vs. Sufficient Circuit Causality Matrix.
 * Displays empirical evaluations across all 12 Drosophila connectome populations.
 */

import { CausalityMatrix } from '../../engine/causality/CausalityMatrix';
import { CausalMatrixRow } from '../../engine/causality/ExperimentTypes';

export interface CausalityMatrixViewCallbacks {
  onSelectPopulation?: (nodeId: string) => void;
}

export class CausalityMatrixView {
  private container: HTMLElement;
  private rows: CausalMatrixRow[] = [];
  private currentFilter: string = 'ALL';
  private callbacks: CausalityMatrixViewCallbacks;

  constructor(container: HTMLElement, callbacks: CausalityMatrixViewCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.rows = CausalityMatrix.evaluateMatrix();
    this.render();
  }

  private render(): void {
    const filteredRows =
      this.currentFilter === 'ALL'
        ? this.rows
        : this.rows.filter((r) => r.classification === this.currentFilter);

    const tableRowsHtml = filteredRows
      .map((r) => {
        const badgeClass = r.classification.toLowerCase();
        return `
          <tr class="matrix-row" data-node="${r.nodeId}">
            <td class="cell-node">
              <strong>${r.nodeId}</strong>
              <div class="node-name-sub">${r.name}</div>
            </td>
            <td class="cell-neuropil">${r.neuropil}</td>
            <td class="cell-count">${r.neuronCount.toLocaleString()}</td>
            <td class="cell-bool ${r.isNecessary ? 'yes' : 'no'}">
              ${r.isNecessary ? '✓ YES' : '✕ NO'}
            </td>
            <td class="cell-bool ${r.isSufficient ? 'yes' : 'no'}">
              ${r.isSufficient ? '✓ YES' : '✕ NO'}
            </td>
            <td class="cell-latency">${r.effectLatencyMs !== null ? `${r.effectLatencyMs} ms` : '—'}</td>
            <td class="cell-badge">
              <span class="causal-badge ${badgeClass}">${r.classification}</span>
            </td>
            <td class="cell-citation">${r.citation}</td>
          </tr>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <div class="causality-matrix-view">
        <div class="matrix-header-bar">
          <div>
            <h3 class="matrix-title">CIRCUIT CAUSALITY MATRIX</h3>
            <p class="matrix-subtitle">
              Empirical necessity (ablation abolishes escape) vs. sufficiency (optogenetic activation alone triggers escape).
            </p>
          </div>

          <div class="matrix-filter-pills" id="matrixFilterPills">
            <button class="pill-btn ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">ALL (12)</button>
            <button class="pill-btn ${this.currentFilter === 'BOTH' ? 'active' : ''}" data-filter="BOTH">BOTH (Necessary & Sufficient)</button>
            <button class="pill-btn ${this.currentFilter === 'NECESSARY' ? 'active' : ''}" data-filter="NECESSARY">NECESSARY</button>
            <button class="pill-btn ${this.currentFilter === 'SUFFICIENT' ? 'active' : ''}" data-filter="SUFFICIENT">SUFFICIENT</button>
          </div>
        </div>

        <div class="matrix-table-wrapper">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>POPULATION</th>
                <th>NEUROPIL</th>
                <th>NEURONS</th>
                <th>NECESSARY?</th>
                <th>SUFFICIENT?</th>
                <th>EFFECT LATENCY</th>
                <th>CLASSIFICATION</th>
                <th>BIOLOGICAL CITATION</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const filterHolder = this.container.querySelector('#matrixFilterPills');
    filterHolder?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.pill-btn') as HTMLButtonElement;
      if (!btn) return;
      this.currentFilter = btn.getAttribute('data-filter') || 'ALL';
      this.render();
    });

    this.container.querySelectorAll('.matrix-row').forEach((row) => {
      row.addEventListener('click', () => {
        const nodeId = row.getAttribute('data-node');
        if (nodeId) this.callbacks.onSelectPopulation?.(nodeId);
      });
    });
  }
}
