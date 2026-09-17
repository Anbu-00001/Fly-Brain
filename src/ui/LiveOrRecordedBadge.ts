/**
 * LiveOrRecordedBadge.ts
 *
 * Implements the mandatory, non-negotiable UI contract from §11 of AGENTS.md:
 * "Whenever brain data is on screen, an unmissable, persistent badge states which mode produced it...
 * The exact neuron count shown MUST match the engine that actually produced the data currently displayed —
 * never show 166,700 while ENGINE-LIVE is running, and never show 139,255 while replaying an ENGINE-RECORDED trace."
 */

import { EngineMode, LIVE_ENGINE_METADATA, RECORDED_ENGINE_METADATA } from '../engine/shared/ConnectomeTypes';

export class LiveOrRecordedBadge {
  private container: HTMLElement;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'liveOrRecordedBadge';
    this.container.className = 'engine-mode-badge badge-live';
    parentElement.appendChild(this.container);
    this.update('LIVE');
  }

  public update(mode: EngineMode): void {
    if (mode === 'LIVE') {
      this.container.className = 'engine-mode-badge badge-live';
      this.container.innerHTML = `
        <span class="badge-indicator pulse-live">●</span>
        <span class="badge-mode">LIVE SIMULATION</span>
        <span class="badge-sep">/</span>
        <span class="badge-name">${LIVE_ENGINE_METADATA.name}</span>
        <span class="badge-count">${LIVE_ENGINE_METADATA.totalNeurons.toLocaleString()} neurons</span>
        <span class="badge-dataset">${LIVE_ENGINE_METADATA.datasetName} (Brain)</span>
      `;
    } else {
      this.container.className = 'engine-mode-badge badge-recorded';
      this.container.innerHTML = `
        <span class="badge-indicator pulse-recorded">◆</span>
        <span class="badge-mode">RECORDED REPLAY</span>
        <span class="badge-sep">/</span>
        <span class="badge-name">${RECORDED_ENGINE_METADATA.name}</span>
        <span class="badge-count">${RECORDED_ENGINE_METADATA.totalNeurons.toLocaleString()} neurons</span>
        <span class="badge-dataset">${RECORDED_ENGINE_METADATA.datasetName} (Whole CNS)</span>
      `;
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
