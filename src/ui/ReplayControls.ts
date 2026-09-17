/**
 * ReplayControls.ts
 *
 * Implements deterministic replay scrubber, playback controls, and JSON export/import
 * conforming to §13 of AGENTS.md.
 */

import { ReplayLog } from '../engine/shared/ConnectomeTypes';

export interface ReplayControlsCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (timeS: number) => void;
  onStep?: (direction: 1 | -1) => void;
  onSpeedChange?: (speed: number) => void;
  onImport?: (log: ReplayLog) => void;
  onExport?: () => void;
}

export class ReplayControls {
  private container: HTMLElement;
  private callbacks: ReplayControlsCallbacks;

  private playPauseBtn!: HTMLButtonElement;
  private timelineSlider!: HTMLInputElement;
  private timeDisplay!: HTMLElement;
  private speedSelect!: HTMLSelectElement;

  private isPlaying: boolean = false;
  private durationS: number = 10.0;
  private currentTimeS: number = 0;

  constructor(parentElement: HTMLElement, callbacks: ReplayControlsCallbacks = {}) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'replayControls';
    this.container.className = 'replay-controls-bar';
    parentElement.appendChild(this.container);

    this.render();
    this.bindElements();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="replay-bar-inner">
        <!-- Play / Pause & Step buttons -->
        <div class="replay-btn-group">
          <button type="button" class="ctrl-btn" id="btnStepBack" title="Step Back (-0.1s)">⮜</button>
          <button type="button" class="ctrl-btn play-btn" id="btnPlayPause" title="Play / Pause">▶</button>
          <button type="button" class="ctrl-btn" id="btnStepForward" title="Step Forward (+0.1s)">⮞</button>
        </div>

        <!-- Scrubber Timeline -->
        <div class="timeline-wrap">
          <input type="range" class="timeline-slider" id="timelineSlider" min="0" max="10" step="0.02" value="0" />
          <div class="time-label" id="timeDisplay">0.00s / 10.00s</div>
        </div>

        <!-- Speed & Export/Import Controls -->
        <div class="replay-aux-group">
          <div class="speed-picker">
            <label for="speedSelect">SPEED:</label>
            <select id="speedSelect" class="cyber-select">
              <option value="0.5">0.5x</option>
              <option value="1.0" selected>1.0x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>

          <button type="button" class="cyber-btn-outline" id="btnExportLog">
            ↓ EXPORT JSON
          </button>

          <label class="cyber-btn-outline file-upload-label">
            ↑ IMPORT JSON
            <input type="file" id="fileImportLog" accept=".json" style="display: none;" />
          </label>
        </div>
      </div>
    `;
  }

  private bindElements(): void {
    this.playPauseBtn = this.container.querySelector('#btnPlayPause') as HTMLButtonElement;
    this.timelineSlider = this.container.querySelector('#timelineSlider') as HTMLInputElement;
    this.timeDisplay = this.container.querySelector('#timeDisplay') as HTMLElement;
    this.speedSelect = this.container.querySelector('#speedSelect') as HTMLSelectElement;

    const btnBack = this.container.querySelector('#btnStepBack') as HTMLButtonElement;
    const btnFwd = this.container.querySelector('#btnStepForward') as HTMLButtonElement;
    const btnExport = this.container.querySelector('#btnExportLog') as HTMLButtonElement;
    const fileImport = this.container.querySelector('#fileImportLog') as HTMLInputElement;

    this.playPauseBtn.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      this.playPauseBtn.textContent = this.isPlaying ? '❚❚' : '▶';
      if (this.isPlaying) this.callbacks.onPlay?.();
      else this.callbacks.onPause?.();
    });

    this.timelineSlider.addEventListener('input', () => {
      const val = parseFloat(this.timelineSlider.value);
      this.currentTimeS = val;
      this.updateTimeDisplay();
      this.callbacks.onSeek?.(val);
    });

    btnBack.addEventListener('click', () => this.callbacks.onStep?.(-1));
    btnFwd.addEventListener('click', () => this.callbacks.onStep?.(1));

    this.speedSelect.addEventListener('change', () => {
      const spd = parseFloat(this.speedSelect.value);
      this.callbacks.onSpeedChange?.(spd);
    });

    btnExport.addEventListener('click', () => {
      this.callbacks.onExport?.();
    });

    fileImport.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const log = JSON.parse(event.target?.result as string) as ReplayLog;
          this.callbacks.onImport?.(log);
        } catch (err) {
          alert('Invalid replay JSON file.');
        }
      };
      reader.readAsText(file);
    });
  }

  public setDuration(durationS: number): void {
    this.durationS = durationS;
    this.timelineSlider.max = String(durationS);
    this.updateTimeDisplay();
  }

  public setTime(t: number): void {
    this.currentTimeS = t;
    this.timelineSlider.value = String(t);
    this.updateTimeDisplay();
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    this.playPauseBtn.textContent = this.isPlaying ? '❚❚' : '▶';
  }

  private updateTimeDisplay(): void {
    this.timeDisplay.textContent = `${this.currentTimeS.toFixed(2)}s / ${this.durationS.toFixed(2)}s`;
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
