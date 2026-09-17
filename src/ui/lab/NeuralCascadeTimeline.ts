/**
 * NeuralCascadeTimeline.ts
 *
 * Connectome Time Machine & Cascade Timeline for CONNECTOME LAB:
 * Allows scrubbing forward and REWINDING the brain backwards to observe
 * action potential propagation from optical stimulus to Giant Fiber jump.
 */

export interface CascadeTimelineCallbacks {
  onSeek?: (timeMs: number) => void;
  onPlayStateChange?: (isPlaying: boolean, isReverse: boolean) => void;
}

export class NeuralCascadeTimeline {
  private container: HTMLElement;
  private sliderInput!: HTMLInputElement;
  private timeDisplayEl!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private rewindBtn!: HTMLButtonElement;
  private speedSelect!: HTMLSelectElement;

  private currentTimeMs: number = 0;
  private maxDurationMs: number = 120; // Canonical escape sequence duration
  private isPlaying: boolean = false;
  private isReverse: boolean = false;
  private playbackSpeed: number = 1.0;
  private animId: number | null = null;
  private lastTimestamp: number = 0;

  private callbacks: CascadeTimelineCallbacks;

  constructor(parentElement: HTMLElement, callbacks: CascadeTimelineCallbacks = {}) {
    this.callbacks = callbacks;

    this.container = document.createElement('div');
    this.container.id = 'neuralCascadeTimeline';
    this.container.className = 'neural-cascade-timeline';
    parentElement.appendChild(this.container);

    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="timeline-header">
        <div class="timeline-title-row">
          <span class="timeline-badge">CONNECTOME TIME MACHINE</span>
          <span class="timeline-subtitle">Rewind & Scrub Neural Action Potentials</span>
        </div>
        <div class="timeline-chronometer">
          <span class="chrono-label">CIRCUIT TIME:</span>
          <span class="chrono-val highlight-cyan" id="timelineChronoVal">0.0 ms</span>
        </div>
      </div>

      <!-- Scrubber Track with Biological Event Markers -->
      <div class="timeline-track-container">
        <div class="timeline-markers-bar">
          <div class="timeline-marker" style="left: 0%">
            <span class="marker-tick">▲</span>
            <span class="marker-label">0ms • PHOTONS (R1-R6)</span>
          </div>
          <div class="timeline-marker" style="left: 12.5%">
            <span class="marker-tick">▲</span>
            <span class="marker-label">15ms • MEDULLA (VIS_ME)</span>
          </div>
          <div class="timeline-marker" style="left: 23.3%">
            <span class="marker-tick">▲</span>
            <span class="marker-label">28ms • LOOMING (LC4/LPLC2)</span>
          </div>
          <div class="timeline-marker highlight-crimson" style="left: 33.3%">
            <span class="marker-tick">▲</span>
            <span class="marker-label">40ms • GIANT FIBER (DNp01)</span>
          </div>
          <div class="timeline-marker" style="left: 40.0%">
            <span class="marker-tick">▲</span>
            <span class="marker-label">48ms • VNC TAKEOFF</span>
          </div>
        </div>

        <input
          type="range"
          class="timeline-slider"
          id="timelineSlider"
          min="0"
          max="${this.maxDurationMs}"
          step="0.5"
          value="0"
        />
      </div>

      <!-- Playback Controls Bar -->
      <div class="timeline-controls-bar">
        <div class="timeline-btn-group">
          <button type="button" class="timeline-ctrl-btn" id="btnTimelineRewind" title="Rewind the brain in reverse">
            ◀◀ REWIND
          </button>
          <button type="button" class="timeline-ctrl-btn" id="btnTimelineStepBack" title="Step back 2ms">
            ◂ STEP
          </button>
          <button type="button" class="timeline-ctrl-btn primary-play-btn" id="btnTimelinePlay">
            ▶ PLAY
          </button>
          <button type="button" class="timeline-ctrl-btn" id="btnTimelineStepFwd" title="Step forward 2ms">
            STEP ▸
          </button>
          <button type="button" class="timeline-ctrl-btn" id="btnTimelineReset">
            ↺ RESET
          </button>
        </div>

        <div class="timeline-speed-group">
          <span class="speed-label">SPEED:</span>
          <select class="timeline-speed-select" id="timelineSpeedSelect">
            <option value="0.25">0.25x (Micro)</option>
            <option value="0.5">0.50x (Slow)</option>
            <option value="1.0" selected>1.0x (Real)</option>
            <option value="2.0">2.0x (Fast)</option>
            <option value="5.0">5.0x (Hyper)</option>
          </select>
        </div>
      </div>
    `;

    this.sliderInput = this.container.querySelector('#timelineSlider') as HTMLInputElement;
    this.timeDisplayEl = this.container.querySelector('#timelineChronoVal') as HTMLElement;
    this.playBtn = this.container.querySelector('#btnTimelinePlay') as HTMLButtonElement;
    this.rewindBtn = this.container.querySelector('#btnTimelineRewind') as HTMLButtonElement;
    this.speedSelect = this.container.querySelector('#timelineSpeedSelect') as HTMLSelectElement;
  }

  private bindEvents(): void {
    this.sliderInput.addEventListener('input', () => {
      this.setTime(parseFloat(this.sliderInput.value));
      this.callbacks.onSeek?.(this.currentTimeMs);
    });

    this.playBtn.addEventListener('click', () => {
      if (this.isPlaying && !this.isReverse) {
        this.pause();
      } else {
        this.play(false);
      }
    });

    this.rewindBtn.addEventListener('click', () => {
      if (this.isPlaying && this.isReverse) {
        this.pause();
      } else {
        this.play(true); // Play in reverse!
      }
    });

    this.container.querySelector('#btnTimelineStepBack')?.addEventListener('click', () => {
      this.pause();
      this.setTime(Math.max(0, this.currentTimeMs - 2.0));
      this.callbacks.onSeek?.(this.currentTimeMs);
    });

    this.container.querySelector('#btnTimelineStepFwd')?.addEventListener('click', () => {
      this.pause();
      this.setTime(Math.min(this.maxDurationMs, this.currentTimeMs + 2.0));
      this.callbacks.onSeek?.(this.currentTimeMs);
    });

    this.container.querySelector('#btnTimelineReset')?.addEventListener('click', () => {
      this.pause();
      this.setTime(0);
      this.callbacks.onSeek?.(0);
    });

    this.speedSelect.addEventListener('change', () => {
      this.playbackSpeed = parseFloat(this.speedSelect.value) || 1.0;
    });
  }

  public setTime(timeMs: number): void {
    this.currentTimeMs = Math.max(0, Math.min(this.maxDurationMs, timeMs));
    this.sliderInput.value = this.currentTimeMs.toString();
    this.timeDisplayEl.textContent = `${this.currentTimeMs.toFixed(1)} ms`;
  }

  public getTime(): number {
    return this.currentTimeMs;
  }

  public play(reverse: boolean = false): void {
    this.isPlaying = true;
    this.isReverse = reverse;
    this.lastTimestamp = performance.now();

    if (reverse) {
      this.rewindBtn.classList.add('active');
      this.playBtn.classList.remove('active');
      this.playBtn.textContent = '▶ PLAY';
      this.rewindBtn.textContent = '⏸ PAUSE';
      if (this.currentTimeMs <= 0) {
        this.setTime(this.maxDurationMs);
      }
    } else {
      this.playBtn.classList.add('active');
      this.rewindBtn.classList.remove('active');
      this.playBtn.textContent = '⏸ PAUSE';
      this.rewindBtn.textContent = '◀◀ REWIND';
      if (this.currentTimeMs >= this.maxDurationMs) {
        this.setTime(0);
      }
    }

    this.callbacks.onPlayStateChange?.(true, reverse);
    this.loop();
  }

  public pause(): void {
    this.isPlaying = false;
    this.playBtn.classList.remove('active');
    this.rewindBtn.classList.remove('active');
    this.playBtn.textContent = '▶ PLAY';
    this.rewindBtn.textContent = '◀◀ REWIND';

    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    this.callbacks.onPlayStateChange?.(false, this.isReverse);
  }

  private loop = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const dtMs = (now - this.lastTimestamp) * this.playbackSpeed;
    this.lastTimestamp = now;

    if (this.isReverse) {
      const next = this.currentTimeMs - dtMs;
      if (next <= 0) {
        this.setTime(0);
        this.pause();
      } else {
        this.setTime(next);
      }
    } else {
      const next = this.currentTimeMs + dtMs;
      if (next >= this.maxDurationMs) {
        this.setTime(this.maxDurationMs);
        this.pause();
      } else {
        this.setTime(next);
      }
    }

    this.callbacks.onSeek?.(this.currentTimeMs);

    if (this.isPlaying) {
      this.animId = requestAnimationFrame(this.loop);
    }
  };

  public getElement(): HTMLElement {
    return this.container;
  }
}
