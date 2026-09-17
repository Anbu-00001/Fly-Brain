/**
 * BrainGradientInspector.ts
 *
 * Implements the user's explicit requirement:
 * "Also ensure a part of the page which should show how the fly's brain's react
 * to the user's movement based on different gradient of lights flashed in that particular brain part"
 *
 * Visualizes:
 * 1. Retinotopic Compound Eye Ommatidia Field (Left vs Right Eye illuminance gradients)
 * 2. Real-time Neuropil Light Reaction Meters (Optic Lobes, Central Complex, Descending/VNC)
 * 3. Interactive Optogenetic / Optical Flash tools to directly stimulate individual brain parts with light gradients!
 */

import { ReceptiveFieldGradient } from '../engine/shared/ConnectomeTypes';

export interface BrainGradientInspectorCallbacks {
  onFlashRegion?: (regionGroupName: string, intensity: number) => void;
}

export class BrainGradientInspector {
  private container: HTMLElement;
  private eyeCanvas: HTMLCanvasElement;
  private eyeCtx: CanvasRenderingContext2D;
  private callbacks: BrainGradientInspectorCallbacks;

  // Telemetry elements
  private leftLobeFill!: HTMLElement;
  private rightLobeFill!: HTMLElement;
  private cxFill!: HTMLElement;
  private descFill!: HTMLElement;

  private leftLobeVal!: HTMLElement;
  private rightLobeVal!: HTMLElement;
  private cxVal!: HTMLElement;
  private descVal!: HTMLElement;

  private flashIntensity: number = 0.8;

  constructor(parentElement: HTMLElement, callbacks: BrainGradientInspectorCallbacks = {}) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'brainGradientInspector';
    this.container.className = 'brain-gradient-inspector';
    parentElement.appendChild(this.container);

    this.renderLayout();

    this.eyeCanvas = this.container.querySelector('#ommatidiaCanvas') as HTMLCanvasElement;
    this.eyeCtx = this.eyeCanvas.getContext('2d')!;

    this.bindElements();
    this.bindControls();
    this.drawRetina(0, 0, 0, 0);
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title-row">
          <span class="inspector-icon">◈</span>
          <h3>RETINOTOPIC LIGHT GRADIENT & BRAIN REACTION</h3>
        </div>
        <span class="inspector-badge">OPTIC LOBES ⇄ CENTRAL ⇄ MOTOR</span>
      </div>

      <div class="inspector-body">
        <!-- Retinotopic Compound Eye Dome -->
        <div class="ommatidia-panel">
          <div class="sub-heading">COMPOUND EYE RECEPTIVE FIELD</div>
          <div class="canvas-wrap">
            <canvas id="ommatidiaCanvas" width="280" height="150"></canvas>
            <div class="eye-labels">
              <span class="lbl-left">LEFT EYE (L)</span>
              <span class="lbl-center">BINOCULAR (FRONT)</span>
              <span class="lbl-right">RIGHT EYE (R)</span>
            </div>
          </div>
          <div class="receptive-field-metrics" id="rfMetrics">
            <span>AZIMUTH: <strong id="rfAzimuth">0.0°</strong></span>
            <span>LOOM &theta;: <strong id="rfTheta">0.00 rad</strong></span>
            <span>d&theta;/dt: <strong id="rfExpRate">0.00 rad/s</strong></span>
          </div>
        </div>

        <!-- Neuropil Light Reaction Meters -->
        <div class="neuropil-meters-panel">
          <div class="sub-heading">BRAIN REGION LIGHT ACTIVATION GRADIENT</div>

          <div class="meter-card" id="meterLeftLobe">
            <div class="meter-info">
              <span class="meter-name">LEFT OPTIC LOBE (VIS_ME / VIS_LO)</span>
              <span class="meter-val" id="valLeftLobe">0%</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill fill-cyan" id="fillLeftLobe" style="width: 0%"></div>
            </div>
          </div>

          <div class="meter-card" id="meterRightLobe">
            <div class="meter-info">
              <span class="meter-name">RIGHT OPTIC LOBE (VIS_ME / VIS_LO)</span>
              <span class="meter-val" id="valRightLobe">0%</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill fill-cyan" id="fillRightLobe" style="width: 0%"></div>
            </div>
          </div>

          <div class="meter-card" id="meterCX">
            <div class="meter-info">
              <span class="meter-name">CENTRAL COMPLEX (CX_EPG / CX_PFN)</span>
              <span class="meter-val" id="valCX">0%</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill fill-amber" id="fillCX" style="width: 0%"></div>
            </div>
          </div>

          <div class="meter-card" id="meterDesc">
            <div class="meter-info">
              <span class="meter-name">DESCENDING ESCAPE COMMAND (GNG_DESC / DN)</span>
              <span class="meter-val" id="valDesc">0%</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill fill-crimson" id="fillDesc" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- Interactive Optical Flash Tool -->
        <div class="optical-flash-tools">
          <div class="sub-heading">INTERACTIVE OPTICAL FLASH STIMULATOR</div>
          <div class="flash-btn-grid">
            <button type="button" class="cyber-btn flash-btn" id="btnFlashLeft">
              ⚡ FLASH LEFT LOBE
            </button>
            <button type="button" class="cyber-btn flash-btn" id="btnFlashRight">
              ⚡ FLASH RIGHT LOBE
            </button>
            <button type="button" class="cyber-btn flash-btn-warn" id="btnFlashLoom">
              💥 FLASH FRONTAL LOOM
            </button>
          </div>
          <div class="intensity-slider-row">
            <label for="flashIntensitySlider">PULSE INTENSITY:</label>
            <input type="range" id="flashIntensitySlider" min="0.2" max="1.5" step="0.1" value="0.8" />
            <span id="flashIntensityVal">0.8</span>
          </div>
        </div>
      </div>
    `;
  }

  private bindElements(): void {
    this.leftLobeFill = this.container.querySelector('#fillLeftLobe') as HTMLElement;
    this.rightLobeFill = this.container.querySelector('#fillRightLobe') as HTMLElement;
    this.cxFill = this.container.querySelector('#fillCX') as HTMLElement;
    this.descFill = this.container.querySelector('#fillDesc') as HTMLElement;

    this.leftLobeVal = this.container.querySelector('#valLeftLobe') as HTMLElement;
    this.rightLobeVal = this.container.querySelector('#valRightLobe') as HTMLElement;
    this.cxVal = this.container.querySelector('#valCX') as HTMLElement;
    this.descVal = this.container.querySelector('#valDesc') as HTMLElement;
  }

  private bindControls(): void {
    const btnLeft = this.container.querySelector('#btnFlashLeft') as HTMLButtonElement;
    const btnRight = this.container.querySelector('#btnFlashRight') as HTMLButtonElement;
    const btnLoom = this.container.querySelector('#btnFlashLoom') as HTMLButtonElement;
    const slider = this.container.querySelector('#flashIntensitySlider') as HTMLInputElement;
    const sliderVal = this.container.querySelector('#flashIntensityVal') as HTMLElement;

    slider?.addEventListener('input', () => {
      this.flashIntensity = parseFloat(slider.value);
      sliderVal.textContent = this.flashIntensity.toFixed(1);
    });

    btnLeft?.addEventListener('click', () => {
      this.triggerFlashEffect('left');
      this.callbacks.onFlashRegion?.('VIS_ME', this.flashIntensity);
    });

    btnRight?.addEventListener('click', () => {
      this.triggerFlashEffect('right');
      this.callbacks.onFlashRegion?.('VIS_ME', this.flashIntensity);
    });

    btnLoom?.addEventListener('click', () => {
      this.triggerFlashEffect('both');
      this.callbacks.onFlashRegion?.('VIS_LO', this.flashIntensity * 1.3);
    });
  }

  public update(
    gradient: ReceptiveFieldGradient,
    cxActivation: number = 0,
    descActivation: number = 0
  ): void {
    // Update metrics
    const azimuthDeg = Math.round((gradient.bearingRad * 180) / Math.PI);
    const azEl = this.container.querySelector('#rfAzimuth');
    if (azEl) azEl.textContent = `${azimuthDeg > 0 ? '+' : ''}${azimuthDeg}°`;

    const thEl = this.container.querySelector('#rfTheta');
    if (thEl) thEl.textContent = `${gradient.angularLoomRad.toFixed(2)} rad`;

    const expEl = this.container.querySelector('#rfExpRate');
    if (expEl) expEl.textContent = `${gradient.expansionRate.toFixed(2)} rad/s`;

    // Update gradient meters
    const leftPct = Math.round(gradient.leftEyeIntensity * 100);
    const rightPct = Math.round(gradient.rightEyeIntensity * 100);
    const cxPct = Math.round(Math.min(100, cxActivation));
    const descPct = Math.round(Math.min(100, descActivation));

    this.leftLobeFill.style.width = `${leftPct}%`;
    this.leftLobeVal.textContent = `${leftPct}%`;

    this.rightLobeFill.style.width = `${rightPct}%`;
    this.rightLobeVal.textContent = `${rightPct}%`;

    this.cxFill.style.width = `${cxPct}%`;
    this.cxVal.textContent = `${cxPct}%`;

    this.descFill.style.width = `${descPct}%`;
    this.descVal.textContent = `${descPct}%`;

    // Re-draw Retina dome
    this.drawRetina(
      gradient.leftEyeIntensity,
      gradient.rightEyeIntensity,
      gradient.bearingRad,
      gradient.angularLoomRad
    );
  }

  private drawRetina(leftI: number, rightI: number, bearingRad: number, thetaRad: number): void {
    const ctx = this.eyeCtx;
    const w = this.eyeCanvas.width;
    const h = this.eyeCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h - 20;
    const radius = 100;

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0);
    ctx.strokeStyle = 'rgba(30, 48, 70, 0.6)';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Receptive ommatidia sectors (32 hex segments)
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const angle0 = Math.PI - (i / segments) * Math.PI;
      const angle1 = Math.PI - ((i + 1) / segments) * Math.PI;
      const midAngle = (angle0 + angle1) / 2;

      // Angular distance to current threat bearing
      // In this hemisphere: left side is angle in [PI/2, PI], right is [0, PI/2]
      const flyBearing = midAngle - Math.PI / 2; // -PI/2 (right) to +PI/2 (left)
      const diff = Math.abs(flyBearing - bearingRad);

      let intensity = 0;
      if (flyBearing > 0) {
        intensity = leftI * Math.max(0, Math.cos(diff));
      } else {
        intensity = rightI * Math.max(0, Math.cos(diff));
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, angle0, angle1, true);

      if (intensity > 0.05) {
        // Glowing cyan-amber gradient
        const r = Math.round(50 + intensity * 200);
        const g = Math.round(180 + intensity * 50);
        const b = Math.round(255 - intensity * 150);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.6})`;
        ctx.lineWidth = 14 + intensity * 6;
      } else {
        ctx.strokeStyle = 'rgba(20, 32, 48, 0.4)';
        ctx.lineWidth = 14;
      }
      ctx.stroke();
    }

    // Threat optical vector arrow
    if (thetaRad > 0.02) {
      const threatVisualAngle = Math.PI / 2 + bearingRad; // map bearing to canvas angle
      const rayLen = radius + Math.min(30, thetaRad * 25);
      const rayX = centerX + Math.cos(threatVisualAngle) * rayLen;
      const rayY = centerY - Math.sin(threatVisualAngle) * rayLen;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(rayX, rayY);
      ctx.strokeStyle = 'rgba(255, 60, 100, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Threat locus point
      ctx.beginPath();
      ctx.arc(rayX, rayY, 5 + Math.min(8, thetaRad * 6), 0, Math.PI * 2);
      ctx.fillStyle = '#ff3366';
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Central Fly Head schematic
    ctx.beginPath();
    ctx.arc(centerX, centerY, 16, Math.PI, 0);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLY', centerX, centerY - 4);
  }

  private triggerFlashEffect(side: 'left' | 'right' | 'both'): void {
    if (side === 'left' || side === 'both') {
      this.leftLobeFill.classList.add('flash-pulse');
      setTimeout(() => this.leftLobeFill.classList.remove('flash-pulse'), 400);
    }
    if (side === 'right' || side === 'both') {
      this.rightLobeFill.classList.add('flash-pulse');
      setTimeout(() => this.rightLobeFill.classList.remove('flash-pulse'), 400);
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
