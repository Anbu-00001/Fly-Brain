/**
 * RegionInspectorHUD.ts
 *
 * Biological Metadata & Telemetry Inspector for CONNECTOME LAB:
 * Displays verified biological attributes, population neuron counts,
 * synaptic input/output targets, circuit roles, and literature citations.
 */

import { CircuitNode } from '../../engine/shared/CircuitGraph';

export class RegionInspectorHUD {
  private container: HTMLElement;
  private currentNode: CircuitNode | null = null;
  private currentSpikeRateHz: number = 0;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'regionInspectorHUD';
    this.container.className = 'region-inspector-hud';
    parentElement.appendChild(this.container);

    this.renderEmpty();
  }

  public getCurrentNode(): CircuitNode | null {
    return this.currentNode;
  }

  public setNode(node: CircuitNode | null, spikeRateHz: number = 0): void {
    this.currentNode = node;
    this.currentSpikeRateHz = spikeRateHz;

    if (!node) {
      this.renderEmpty();
      return;
    }

    this.renderNode(node);
  }

  public updateSpikeRate(spikeRateHz: number): void {
    this.currentSpikeRateHz = spikeRateHz;
    const rateValEl = this.container.querySelector('#hudSpikeRateVal');
    const rateBarEl = this.container.querySelector('#hudSpikeRateBar') as HTMLElement;
    if (rateValEl) {
      rateValEl.textContent = `${spikeRateHz.toFixed(1)} Hz`;
    }
    if (rateBarEl) {
      const pct = Math.min(100, (spikeRateHz / 80) * 100);
      rateBarEl.style.width = `${pct}%`;
    }
  }

  private renderEmpty(): void {
    this.container.innerHTML = `
      <div class="hud-header">
        <span class="hud-badge-tag">CIRCUIT INSPECTOR</span>
        <span class="hud-status-live">READY</span>
      </div>
      <div class="hud-empty-state">
        <div class="hud-pulse-ring">◈</div>
        <p>SELECT ANY NEUROPIL IN 3D</p>
        <span class="hud-hint">Click a population to inspect wiring, receptive field, and downstream projections</span>
      </div>
    `;
  }

  private renderNode(node: CircuitNode): void {
    const regionClass = `tag-${node.region}`;
    const inputsList = node.inputs.length > 0 ? node.inputs.join(', ') : 'Primary Sensory Input';
    const outputsList = node.outputs.length > 0 ? node.outputs.join(', ') : 'Final Motor Effector';

    this.container.innerHTML = `
      <div class="hud-header">
        <div class="hud-title-group">
          <span class="hud-badge-tag ${regionClass}">${node.region.toUpperCase()} • LAYER ${node.order}</span>
          <h3 class="hud-node-name">${node.name}</h3>
        </div>
        <div class="hud-id-tag">[${node.id}]</div>
      </div>

      <div class="hud-telemetry-row">
        <div class="hud-stat-box">
          <span class="hud-stat-label">POPULATION</span>
          <span class="hud-stat-val highlight-cyan">${node.neuronCount.toLocaleString()}</span>
          <span class="hud-stat-sub">neurons</span>
        </div>
        <div class="hud-stat-box">
          <span class="hud-stat-label">DISCHARGE RATE</span>
          <span class="hud-stat-val highlight-amber" id="hudSpikeRateVal">${this.currentSpikeRateHz.toFixed(1)} Hz</span>
          <span class="hud-stat-sub">firing rate</span>
        </div>
      </div>

      <div class="hud-meter-row">
        <div class="hud-meter-fill" id="hudSpikeRateBar" style="width: ${Math.min(100, (this.currentSpikeRateHz / 80) * 100)}%"></div>
      </div>

      <div class="hud-detail-grid">
        <div class="hud-detail-item">
          <span class="hud-detail-label">ANATOMICAL NEUROPIL:</span>
          <span class="hud-detail-val">${node.neuropil}</span>
        </div>
        <div class="hud-detail-item">
          <span class="hud-detail-label">TRANSMITTER:</span>
          <span class="hud-detail-val capitalize">${node.neurotransmitter}</span>
        </div>
        <div class="hud-detail-item">
          <span class="hud-detail-label">SYNAPTIC INPUTS:</span>
          <span class="hud-detail-val highlight-blue">${inputsList}</span>
        </div>
        <div class="hud-detail-item">
          <span class="hud-detail-label">TARGET PROJECTIONS:</span>
          <span class="hud-detail-val highlight-purple">${outputsList}</span>
        </div>
      </div>

      <div class="hud-role-box">
        <span class="hud-role-title">BIOLOGICAL CIRCUIT ROLE:</span>
        <p class="hud-role-desc">${node.role}</p>
        <span class="hud-citation">Citation: ${node.biologicalCitation}</span>
      </div>
    `;
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
