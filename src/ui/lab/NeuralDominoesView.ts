/**
 * NeuralDominoesView.ts
 *
 * "NEURAL DOMINOES" Mode for CONNECTOME LAB:
 * Visualizes layer-by-layer synaptic cascades from any selected source population,
 * showing downstream reachability, total neurons affected, and propagation latency.
 */

import { calculateDominoMetrics } from '../../engine/shared/CircuitGraph';

export interface DominoesCallbacks {
  onTriggerCascade?: (nodeIds: string[]) => void;
  onSelectNode?: (nodeId: string) => void;
}

export class NeuralDominoesView {
  private container: HTMLElement;
  private currentSourceId: string = 'LC4';
  private callbacks: DominoesCallbacks;

  constructor(parentElement: HTMLElement, callbacks: DominoesCallbacks = {}) {
    this.callbacks = callbacks;

    this.container = document.createElement('div');
    this.container.id = 'neuralDominoesView';
    this.container.className = 'neural-dominoes-view';
    parentElement.appendChild(this.container);

    this.render();
  }

  public setSourceNode(nodeId: string): void {
    this.currentSourceId = nodeId;
    this.render();
  }

  public render(): void {
    const metrics = calculateDominoMetrics(this.currentSourceId);

    this.container.innerHTML = `
      <div class="dominoes-header">
        <div class="dominoes-title-group">
          <span class="dominoes-badge">SYNAPTIC PROPAGATION</span>
          <h3>NEURAL DOMINOES</h3>
        </div>
        <div class="source-tag highlight-cyan">SOURCE: [${metrics.startNodeId}]</div>
      </div>

      <!-- Hero Metrics Row -->
      <div class="dominoes-metrics-grid">
        <div class="domino-card">
          <span class="card-label">REACHABLE NODES</span>
          <span class="card-value highlight-cyan">${metrics.reachableCount}</span>
          <span class="card-sub">populations</span>
        </div>
        <div class="domino-card">
          <span class="card-label">DOWNSTREAM NEURONS</span>
          <span class="card-value highlight-purple">${metrics.totalNeurons.toLocaleString()}</span>
          <span class="card-sub">biological neurons</span>
        </div>
        <div class="domino-card">
          <span class="card-label">CASCADE DEPTH</span>
          <span class="card-value highlight-amber">${metrics.maxDepth}</span>
          <span class="card-sub">synaptic layers</span>
        </div>
        <div class="domino-card">
          <span class="card-label">MOTOR LATENCY</span>
          <span class="card-value highlight-crimson">${metrics.timeToMotorMs !== null ? `${metrics.timeToMotorMs.toFixed(1)}ms` : 'N/A'}</span>
          <span class="card-sub">time to jump command</span>
        </div>
      </div>

      <!-- Layer by Layer Cascade Visualizer -->
      <div class="dominoes-flow-container">
        <div class="flow-title">DOWNSTREAM CASCADE PATHWAY</div>
        <div class="flow-steps-list">
          ${metrics.cascadeSteps.map((step, idx) => `
            <div class="flow-step-item" data-id="${step.nodeId}">
              <div class="step-num">${idx === 0 ? 'SOURCE' : `ORDER ${step.layer}`}</div>
              <div class="step-card step-${step.region}">
                <div class="step-node-name">${step.name}</div>
                <div class="step-meta">
                  <span class="step-region-tag">${step.region.toUpperCase()}</span>
                  <span class="step-latency">+${step.estimatedLatencyMs.toFixed(1)}ms</span>
                </div>
              </div>
              ${idx < metrics.cascadeSteps.length - 1 ? '<div class="step-arrow">↓</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="dominoes-action-bar">
        <button type="button" class="trigger-cascade-btn" id="btnTriggerDomino">
          🔥 [ FIRE DOMINO CASCADE ]
        </button>
      </div>
    `;

    this.bindEvents(metrics.cascadeSteps.map((s) => s.nodeId));
  }

  private bindEvents(nodeIds: string[]): void {
    this.container.querySelector('#btnTriggerDomino')?.addEventListener('click', () => {
      this.callbacks.onTriggerCascade?.(nodeIds);
    });

    const stepItems = this.container.querySelectorAll('.flow-step-item');
    stepItems.forEach((item) => {
      const id = item.getAttribute('data-id');
      item.addEventListener('click', () => {
        if (id) this.callbacks.onSelectNode?.(id);
      });
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
