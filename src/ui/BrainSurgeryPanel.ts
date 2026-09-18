/**
 * BrainSurgeryPanel.ts
 *
 * Implements the Brain Surgery experimental panel per §12 of AGENTS.md.
 * Compares intact Whole-CNS connectome vs LC4/LPLC2 and DNp01 lesions
 * on the IDENTICAL recorded predator trajectory.
 */

import { RecordedTraceData } from '../engine/recorded/TraceConsumer';

export interface BrainSurgeryPanelCallbacks {
  onSelectCondition?: (condition: 'intact' | 'lc4' | 'dnp01') => void;
  onPlayPause?: (playing: boolean) => void;
  onSeek?: (t: number) => void;
}

export class BrainSurgeryPanel {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: BrainSurgeryPanelCallbacks;

  private intactTrace: RecordedTraceData | null = null;
  private lc4Trace: RecordedTraceData | null = null;
  private dnp01Trace: RecordedTraceData | null = null;

  private activeCondition: 'intact' | 'lc4' | 'dnp01' = 'intact';
  private currentStep: number = 0;
  private isPlaying: boolean = false;
  private animId: number | null = null;

  constructor(parentElement: HTMLElement, callbacks: BrainSurgeryPanelCallbacks = {}) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'brainSurgeryPanel';
    this.container.className = 'brain-surgery-panel';
    parentElement.appendChild(this.container);

    this.render();
    this.canvas = this.container.querySelector('#surgeryCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.bindEvents();
    this.loadTraces();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="surgery-header">
        <div class="surgery-title-group">
          <span class="surgery-badge">ENGINE-RECORDED PRECOMPUTE</span>
          <h2>BRAIN SURGERY — INTACT VS. LESIONED CONNECTOME</h2>
        </div>
        <div class="surgery-tabs">
          <button type="button" class="tab-btn active" data-condition="intact">1. INTACT WHOLE-CNS</button>
          <button type="button" class="tab-btn" data-condition="lc4">2. LC4/LPLC2 LESION (VISUAL)</button>
          <button type="button" class="tab-btn" data-condition="dnp01">3. DNP01 LESION (GIANT FIBER)</button>
        </div>
      </div>

      <div class="surgery-content-grid">
        <!-- Comparative Dual Arena Canvas -->
        <div class="surgery-arena-wrap">
          <div class="surgery-arena-header">
            <span id="surgeryConditionLabel">CONDITION: INTACT WHOLE-CNS (166,700 NEURONS)</span>
            <span class="trajectory-ident-badge">IDENTICAL PREDATOR PATH</span>
          </div>
          <canvas id="surgeryCanvas" width="560" height="380"></canvas>
          <div class="surgery-playback-bar">
            <button type="button" class="ctrl-btn" id="surgeryPlayBtn">▶</button>
            <input type="range" id="surgerySlider" min="0" max="500" value="0" step="1" />
            <span id="surgeryTimeLabel">0.00s / 10.00s</span>
          </div>
        </div>

        <!-- Comparative Telemetry Table -->
        <div class="surgery-table-wrap">
          <div class="table-title">CIRCUIT LESION EXPERIMENT COMPARISON</div>
          <table class="surgery-table">
            <thead>
              <tr>
                <th>CONDITION</th>
                <th>ABLATED POPULATION</th>
                <th>LATENCY</th>
                <th>OUTCOME</th>
              </tr>
            </thead>
            <tbody>
              <tr id="rowIntact" class="row-active">
                <td><strong class="tag-intact">INTACT</strong></td>
                <td>0 cells (Normal)</td>
                <td>40 ms</td>
                <td><span class="status-escaped">ESCAPED</span></td>
              </tr>
              <tr id="rowLC4">
                <td><strong class="tag-lesioned">LC4/LPLC2 LESION</strong></td>
                <td>311 lobula cells</td>
                <td>None (blind)</td>
                <td><span class="status-caught">CAUGHT</span></td>
              </tr>
              <tr id="rowDNp01">
                <td><strong class="tag-lesioned">DNP01 LESION</strong></td>
                <td>2 Giant Fibers</td>
                <td>Severed</td>
                <td><span class="status-caught">CAUGHT</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Scientific Insight Box -->
          <div class="surgery-insight-card" id="surgeryInsight">
            <h4>CIRCUIT MECHANISM INSIGHT</h4>
            <p id="insightText">
              In the intact connectome, optical looming triggers lobula projection neurons LC4 and LPLC2,
              which form electrical and chemical synapses onto Giant Fiber DNp01. DNp01 fires within 40 ms,
              transmitting the jump command down the ventral nerve cord to initiate evasive takeoff.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const tabs = this.container.querySelectorAll('.tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const cond = tab.getAttribute('data-condition') as 'intact' | 'lc4' | 'dnp01';
        this.selectCondition(cond);
      });
    });

    const playBtn = this.container.querySelector('#surgeryPlayBtn') as HTMLButtonElement;
    playBtn?.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      playBtn.textContent = this.isPlaying ? '❚❚' : '▶';
      if (this.isPlaying) this.startLoop();
      else this.stopLoop();
    });

    const slider = this.container.querySelector('#surgerySlider') as HTMLInputElement;
    slider?.addEventListener('input', () => {
      this.currentStep = parseInt(slider.value, 10);
      this.renderCanvas();
    });
  }

  private async loadTraces(): Promise<void> {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('traces/brain_surgery_intact.json').then((r) => r.json()),
        fetch('traces/brain_surgery_lc4_lesion.json').then((r) => r.json()),
        fetch('traces/brain_surgery_dnp01_lesion.json').then((r) => r.json()),
      ]);
      this.intactTrace = r1;
      this.lc4Trace = r2;
      this.dnp01Trace = r3;
      this.renderCanvas();
    } catch (err) {
      console.warn('Failed to load Brain Surgery traces:', err);
    }
  }

  public selectCondition(cond: 'intact' | 'lc4' | 'dnp01'): void {
    this.activeCondition = cond;

    const label = this.container.querySelector('#surgeryConditionLabel');
    const insightText = this.container.querySelector('#insightText');
    const rowIntact = this.container.querySelector('#rowIntact');
    const rowLC4 = this.container.querySelector('#rowLC4');
    const rowDNp01 = this.container.querySelector('#rowDNp01');

    rowIntact?.classList.toggle('row-active', cond === 'intact');
    rowLC4?.classList.toggle('row-active', cond === 'lc4');
    rowDNp01?.classList.toggle('row-active', cond === 'dnp01');

    if (cond === 'intact') {
      if (label) label.textContent = 'CONDITION: INTACT WHOLE-CNS (166,700 NEURONS)';
      if (insightText) {
        insightText.textContent =
          'In the intact connectome, optical looming triggers lobula projection neurons LC4 and LPLC2, which form direct and indirect synapses onto Giant Fiber DNp01. DNp01 fires at 40 ms, initiating escape takeoff.';
      }
    } else if (cond === 'lc4') {
      if (label) label.textContent = 'CONDITION: LC4/LPLC2 ABLATION (311 NEURONS SILENCED)';
      if (insightText) {
        insightText.textContent =
          'LC4 and LPLC2 lobula columnar neurons are silenced. The fly is blind to visual expansion. DNp01 receives zero looming excitation, never fires, and the predator catches the fly on the ground.';
      }
    } else {
      if (label) label.textContent = 'CONDITION: DNP01 GIANT FIBER ABLATION (2 NEURONS SILENCED)';
      if (insightText) {
        insightText.textContent =
          'DNp01 escape command neurons are severed. Although upstream visual lobula circuits detect the loom, the motor command cannot reach the VNC jump circuit. The fly is unable to jump and is caught.';
      }
    }

    this.callbacks.onSelectCondition?.(cond);
    this.renderCanvas();
  }

  private startLoop(): void {
    const loop = () => {
      if (!this.isPlaying) return;
      const trace = this.getActiveTrace();
      if (trace && this.currentStep < trace.samples.length - 1) {
        this.currentStep++;
        const slider = this.container.querySelector('#surgerySlider') as HTMLInputElement;
        if (slider) slider.value = String(this.currentStep);
        this.renderCanvas();
        this.animId = requestAnimationFrame(loop);
      } else {
        this.isPlaying = false;
        const playBtn = this.container.querySelector('#surgeryPlayBtn') as HTMLButtonElement;
        if (playBtn) playBtn.textContent = '▶';
      }
    };
    this.animId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  /** Releases the animation frame and detaches the panel. */
  public dispose(): void {
    this.stopLoop();
    if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
  }

  private getActiveTrace(): RecordedTraceData | null {
    if (this.activeCondition === 'intact') return this.intactTrace;
    if (this.activeCondition === 'lc4') return this.lc4Trace;
    return this.dnp01Trace;
  }

  private renderCanvas(): void {
    const trace = this.getActiveTrace();
    if (!trace || trace.samples.length === 0) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Arena background
    ctx.fillStyle = '#060a0f';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(20, 35, 55, 0.5)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const sIdx = Math.min(trace.samples.length - 1, this.currentStep);
    const cur = trace.samples[sIdx];

    // Scale factors from 800x600 arena to 560x380 canvas
    const sx = w / 800;
    const sy = h / 600;

    // Draw full trajectory ghost trail
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < trace.samples.length; i++) {
      const s = trace.samples[i];
      if (i === 0) ctx.moveTo(s.mouseX * sx, s.mouseY * sy);
      else ctx.lineTo(s.mouseX * sx, s.mouseY * sy);
    }
    ctx.stroke();

    // Draw Fly path trail up to current step
    ctx.beginPath();
    ctx.strokeStyle = trace.summary.escaped ? '#00f0ff' : '#f59e0b';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= sIdx; i++) {
      const s = trace.samples[i];
      if (i === 0) ctx.moveTo(s.flyX * sx, s.flyY * sy);
      else ctx.lineTo(s.flyX * sx, s.flyY * sy);
    }
    ctx.stroke();

    // Draw predator
    const px = cur.mouseX * sx;
    const py = cur.mouseY * sy;
    ctx.beginPath();
    ctx.arc(px, py, 30 * sx, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ff3366';
    ctx.font = '10px monospace';
    ctx.fillText('PREDATOR', px + 35 * sx, py);

    // Draw Fly
    const fx = cur.flyX * sx;
    const fy = cur.flyY * sy;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(cur.flyHeading);

    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * sx, 7 * sy, 0, 0, Math.PI * 2);
    ctx.fillStyle = cur.isFlying ? '#38bdf8' : '#64748b';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Compound eyes
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath(); ctx.arc(10 * sx, -4 * sy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10 * sx, 4 * sy, 3, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // Outcome stamp if finished
    if (sIdx >= trace.samples.length - 1 || cur.caught) {
      ctx.fillStyle = cur.caught ? '#ff3366' : '#00f0ff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = cur.caught ? '#ff3366' : '#00f0ff';
      ctx.shadowBlur = 15;
      const text = cur.caught ? 'PREDATOR CAUGHT FLY (LESION FAILED ESCAPE)' : 'FLY ESCAPED VIA GIANT FIBER';
      ctx.fillText(text, w / 2, 40);
      ctx.shadowBlur = 0;
    }

    // Update time label
    const timeEl = this.container.querySelector('#surgeryTimeLabel');
    if (timeEl) timeEl.textContent = `${cur.t.toFixed(2)}s / ${trace.durationS.toFixed(2)}s`;
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
