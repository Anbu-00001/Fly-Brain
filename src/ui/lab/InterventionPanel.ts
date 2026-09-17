/**
 * InterventionPanel.ts
 *
 * Neural Alchemy / Intervention Controls for CONNECTOME LAB:
 * Enables real-time manipulation of verified Drosophila circuits:
 * - STIMULATE: Inject excitatory voltage into target population
 * - SILENCE: Inhibit/ablate population to zero firing
 * - INVERT: Apply polarity inhibition
 * - AMPLIFY: Multiplies synaptic gain (200%)
 */

export type InterventionType = 'stimulate' | 'silence' | 'invert' | 'amplify';

export interface ActiveIntervention {
  id: string;
  type: InterventionType;
  targetId: string;
  targetName: string;
  intensity: number;
  durationMs: number;
  timestamp: number;
}

export interface InterventionCallbacks {
  onApplyIntervention?: (intervention: ActiveIntervention) => void;
  onRemoveIntervention?: (interventionId: string) => void;
  onClearAll?: () => void;
}

export class InterventionPanel {
  private container: HTMLElement;
  private activeInterventions: ActiveIntervention[] = [];
  private callbacks: InterventionCallbacks;

  private currentType: InterventionType = 'stimulate';
  private targetSelect!: HTMLSelectElement;
  private intensitySlider!: HTMLInputElement;
  private intensityValEl!: HTMLElement;
  private durationSlider!: HTMLInputElement;
  private durationValEl!: HTMLElement;
  private activeListEl!: HTMLElement;

  constructor(parentElement: HTMLElement, callbacks: InterventionCallbacks = {}) {
    this.callbacks = callbacks;

    this.container = document.createElement('div');
    this.container.id = 'interventionPanel';
    this.container.className = 'intervention-panel';
    parentElement.appendChild(this.container);

    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="intervention-header">
        <div class="intervention-title-row">
          <span class="intervention-badge">NEURAL ALCHEMY</span>
          <h3>CIRCUIT INTERVENTION</h3>
        </div>
        <div class="intervention-source-tag">LIVE SIMULATION • FLYWIRE</div>
      </div>

      <!-- 4 Tool Mode Buttons -->
      <div class="alchemy-tool-bar">
        <button type="button" class="alchemy-btn active tool-stimulate" data-type="stimulate">
          <span class="tool-dot dot-blue"></span>
          STIMULATE
        </button>
        <button type="button" class="alchemy-btn tool-silence" data-type="silence">
          <span class="tool-dot dot-red"></span>
          SILENCE
        </button>
        <button type="button" class="alchemy-btn tool-invert" data-type="invert">
          <span class="tool-dot dot-purple"></span>
          INVERT
        </button>
        <button type="button" class="alchemy-btn tool-amplify" data-type="amplify">
          <span class="tool-dot dot-yellow"></span>
          AMPLIFY
        </button>
      </div>

      <!-- Parameter Controls Box -->
      <div class="alchemy-controls-card">
        <div class="control-field">
          <label class="control-label" for="interventionTargetSelect">TARGET CIRCUIT:</label>
          <select class="cyber-select" id="interventionTargetSelect">
            <option value="LC4" selected>LC4 (Lobula Columnar Looming Detectors - 165 neurons)</option>
            <option value="LPLC2">LPLC2 (Lobula Plate Looming - 146 neurons)</option>
            <option value="DNp01">DNp01 (Giant Fiber Escape Command - 2 neurons)</option>
            <option value="VIS_ME">VIS_ME (Medulla Motion Preprocessing - 82,318 neurons)</option>
            <option value="VIS_LO">VIS_LO (Lobula Feature Layer - 1,793 neurons)</option>
            <option value="CX_EPG">CX_EPG (Central Complex Compass - 428 neurons)</option>
            <option value="MB_KC">MB_KC (Mushroom Body Valence/Memory - 5,177 neurons)</option>
            <option value="VIS_R1R6">VIS_R1R6 (Retinal Photoreceptors - 11,487 neurons)</option>
          </select>
        </div>

        <div class="control-field" id="intensityField">
          <div class="slider-label-row">
            <label class="control-label" for="interventionIntensity">INTENSITY / GAIN:</label>
            <span class="slider-readout highlight-cyan" id="intensityReadout">75%</span>
          </div>
          <input type="range" class="cyber-slider" id="interventionIntensity" min="10" max="100" value="75" />
        </div>

        <div class="control-field" id="durationField">
          <div class="slider-label-row">
            <label class="control-label" for="interventionDuration">BURST DURATION:</label>
            <span class="slider-readout highlight-amber" id="durationReadout">80 ms</span>
          </div>
          <input type="range" class="cyber-slider" id="interventionDuration" min="20" max="300" step="10" value="80" />
        </div>

        <button type="button" class="fire-intervention-btn" id="btnFireIntervention">
          ⚡ [ FIRE INTERVENTION ]
        </button>
      </div>

      <!-- Active Interventions Roster -->
      <div class="active-interventions-section">
        <div class="active-header-row">
          <span class="active-title">ACTIVE MODIFICATIONS (${this.activeInterventions.length})</span>
          <button type="button" class="clear-all-btn" id="btnClearInterventions">CLEAR ALL</button>
        </div>
        <div class="active-list" id="activeInterventionsList">
          <div class="empty-roster">No active circuit interventions. Connectome running intact biological dynamics.</div>
        </div>
      </div>
    `;

    this.targetSelect = this.container.querySelector('#interventionTargetSelect') as HTMLSelectElement;
    this.intensitySlider = this.container.querySelector('#interventionIntensity') as HTMLInputElement;
    this.intensityValEl = this.container.querySelector('#intensityReadout') as HTMLElement;
    this.durationSlider = this.container.querySelector('#interventionDuration') as HTMLInputElement;
    this.durationValEl = this.container.querySelector('#durationReadout') as HTMLElement;
    this.activeListEl = this.container.querySelector('#activeInterventionsList') as HTMLElement;
  }

  private bindEvents(): void {
    // Tool buttons
    const toolBtns = this.container.querySelectorAll('.alchemy-btn');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.getAttribute('data-type') as InterventionType;
        this.updateToolUI();
      });
    });

    this.intensitySlider.addEventListener('input', () => {
      this.intensityValEl.textContent = `${this.intensitySlider.value}%`;
    });

    this.durationSlider.addEventListener('input', () => {
      this.durationValEl.textContent = `${this.durationSlider.value} ms`;
    });

    this.container.querySelector('#btnFireIntervention')?.addEventListener('click', () => {
      this.fire();
    });

    this.container.querySelector('#btnClearInterventions')?.addEventListener('click', () => {
      this.clearAll();
    });
  }

  public setTargetCircuit(targetId: string): void {
    if (this.targetSelect) {
      for (let i = 0; i < this.targetSelect.options.length; i++) {
        if (this.targetSelect.options[i].value === targetId) {
          this.targetSelect.selectedIndex = i;
          break;
        }
      }
    }
  }

  private updateToolUI(): void {
    const intensityField = this.container.querySelector('#intensityField') as HTMLElement;
    const durationField = this.container.querySelector('#durationField') as HTMLElement;

    if (this.currentType === 'silence') {
      intensityField.style.opacity = '0.4';
      intensityField.style.pointerEvents = 'none';
      durationField.style.opacity = '1.0';
      durationField.style.pointerEvents = 'auto';
    } else {
      intensityField.style.opacity = '1.0';
      intensityField.style.pointerEvents = 'auto';
      durationField.style.opacity = '1.0';
      durationField.style.pointerEvents = 'auto';
    }
  }

  private fire(): void {
    const targetId = this.targetSelect.value;
    const selectedOption = this.targetSelect.options[this.targetSelect.selectedIndex];
    const targetName = selectedOption ? selectedOption.text.split('(')[0].trim() : targetId;
    const intensity = parseFloat(this.intensitySlider.value) / 100;
    const durationMs = parseInt(this.durationSlider.value, 10);

    const intervention: ActiveIntervention = {
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: this.currentType,
      targetId,
      targetName,
      intensity,
      durationMs,
      timestamp: Date.now(),
    };

    this.activeInterventions.push(intervention);
    this.renderRoster();
    this.callbacks.onApplyIntervention?.(intervention);
  }

  public removeIntervention(id: string): void {
    this.activeInterventions = this.activeInterventions.filter((i) => i.id !== id);
    this.renderRoster();
    this.callbacks.onRemoveIntervention?.(id);
  }

  public clearAll(): void {
    this.activeInterventions = [];
    this.renderRoster();
    this.callbacks.onClearAll?.();
  }

  public getActiveInterventions(): ActiveIntervention[] {
    return this.activeInterventions;
  }

  private renderRoster(): void {
    const countEl = this.container.querySelector('.active-title');
    if (countEl) {
      countEl.textContent = `ACTIVE MODIFICATIONS (${this.activeInterventions.length})`;
    }

    if (this.activeInterventions.length === 0) {
      this.activeListEl.innerHTML = `
        <div class="empty-roster">No active circuit interventions. Connectome running intact biological dynamics.</div>
      `;
      return;
    }

    this.activeListEl.innerHTML = '';
    for (const item of this.activeInterventions) {
      const row = document.createElement('div');
      row.className = `roster-item item-${item.type}`;
      row.innerHTML = `
        <div class="roster-meta">
          <span class="roster-type-badge">${item.type.toUpperCase()}</span>
          <span class="roster-target">${item.targetName} (${item.targetId})</span>
          <span class="roster-param">${Math.round(item.intensity * 100)}% • ${item.durationMs}ms</span>
        </div>
        <button type="button" class="roster-del-btn" title="Remove intervention">✕</button>
      `;

      row.querySelector('.roster-del-btn')?.addEventListener('click', () => {
        this.removeIntervention(item.id);
      });

      this.activeListEl.appendChild(row);
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
