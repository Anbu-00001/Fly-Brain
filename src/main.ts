/**
 * main.ts
 *
 * Master orchestrator for FLY ESCAPE.
 * Coordinates views, connectome engine adapters, and state machines.
 */

import { LiveEngineAdapter } from './engine/live/LiveEngineAdapter';
import { TraceConsumer } from './engine/recorded/TraceConsumer';
import { AppState, ScreenId } from './state/AppState';
import { InputRecorder } from './state/InputRecorder';
import { LiveOrRecordedBadge } from './ui/LiveOrRecordedBadge';
import { ArenaView } from './ui/ArenaView';
import { BrainGradientInspector } from './ui/BrainGradientInspector';
import { BrainPanel } from './ui/BrainPanel';
import { NeuroRenderer2D } from './ui/NeuroRenderer2D';
import { BrainView3D } from './ui/BrainView3D';
import { ReplayControls } from './ui/ReplayControls';
import { BrainSurgeryPanel } from './ui/BrainSurgeryPanel';
import { AboutDrawer } from './ui/AboutDrawer';

class AppOrchestrator {
  private state: AppState;
  private liveEngine: LiveEngineAdapter;
  private traceConsumer: TraceConsumer;
  private recorder: InputRecorder;

  private badge!: LiveOrRecordedBadge;
  private aboutDrawer!: AboutDrawer;
  private screenMount!: HTMLElement;

  // Experiment components
  private arenaView: ArenaView | null = null;
  private gradientInspector: BrainGradientInspector | null = null;
  private brainPanel: BrainPanel | null = null;
  private neuroRenderer2D: NeuroRenderer2D | null = null;
  private brainView3D: BrainView3D | null = null;

  // Replay & Surgery components
  private replayControls: ReplayControls | null = null;

  private replayAnimId: number | null = null;
  private isReplayPlaying: boolean = false;
  private replayTime: number = 0;
  private replaySpeed: number = 1.0;

  constructor() {
    this.recorder = new InputRecorder();
    this.traceConsumer = new TraceConsumer();

    this.state = new AppState({
      onScreenChange: (screen) => this.handleScreenChange(screen),
      onEngineChange: (engine) => this.badge?.update(engine),
    });

    this.liveEngine = new LiveEngineAdapter({
      onReady: (neurons, edges) => {
        console.log(`Live Connectome Ready: ${neurons} neurons, ${edges} edges.`);
      },
      onTick: (data) => {
        if (this.state.getScreen() === 'experiment') {
          this.brainPanel?.updateTick(data, this.liveEngine.getNeuronCount(), this.state.reactionLatencyMs);
          this.brainView3D?.updateTick(data);
        }
      },
    });

    this.initDOM();
  }

  private async initDOM(): Promise<void> {
    this.screenMount = document.getElementById('screenMount') as HTMLElement;
    const badgeHolder = document.getElementById('headerBadgeHolder') as HTMLElement;

    // 1. Mount Persistent LIVE/RECORDED badge (§11)
    this.badge = new LiveOrRecordedBadge(badgeHolder);

    // 2. Mount About Drawer (§10)
    this.aboutDrawer = new AboutDrawer(document.body);

    // 3. Bind header navigation buttons
    this.bindNav();

    // 4. Initialize Live Engine in background
    this.liveEngine.init().catch((err) => {
      console.warn('Live engine background load warning:', err);
    });

    // 5. Initial screen: Home
    this.renderHomeScreen();
  }

  private bindNav(): void {
    const btnExp = document.getElementById('navExperiment');
    const btnReplay = document.getElementById('navReplay');
    const btnSurgery = document.getElementById('navSurgery');
    const btnAbout = document.getElementById('navAbout');

    btnExp?.addEventListener('click', () => {
      this.updateNavButtons('navExperiment');
      this.renderExperimentScreen();
    });

    btnReplay?.addEventListener('click', () => {
      this.updateNavButtons('navReplay');
      this.renderReplayScreen();
    });

    btnSurgery?.addEventListener('click', () => {
      this.updateNavButtons('navSurgery');
      this.renderSurgeryScreen();
    });

    btnAbout?.addEventListener('click', () => {
      this.aboutDrawer.toggle();
    });
  }

  private updateNavButtons(activeId: string): void {
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach((b) => b.classList.remove('active'));
    document.getElementById(activeId)?.classList.add('active');
  }

  /**
   * Home Screen per §9
   */
  private renderHomeScreen(): void {
    this.state.setScreen('home');
    this.screenMount.innerHTML = `
      <div class="home-screen">
        <div class="home-hero">
          <span class="hero-tag">CONNECTOME-BASED NEUROSCIENCE EXPERIMENT</span>
          <h1 class="hero-title">FLY ESCAPE</h1>
          <h2 class="hero-subtitle">Can you catch a 166,000-neuron brain?</h2>
          <p class="hero-desc">
            A simulated fruit fly, driven by a genuine connectome-based neural simulation,
            reacts to a looming predator steered with your mouse.<br />
            <strong>Scientific architecture:</strong> The full 166,000-neuron whole-CNS model powers Brain Surgery's recorded comparisons;
            live encounters run on a 139,000-neuron real-time connectome of the same fly's visual and motor system.
          </p>
          <button type="button" class="cyber-action-btn" id="btnStartExperiment">
            [ START EXPERIMENT ]
          </button>
          <div class="home-footer-note">
            Zero trained AI · Real EM connectomes (FlyWire FAFB v783 & MaleCNS v1.0) · 100% Static WebAssembly/JS
          </div>
        </div>
      </div>
    `;

    const btnStart = document.getElementById('btnStartExperiment');
    btnStart?.addEventListener('click', () => {
      this.updateNavButtons('navExperiment');
      this.renderExperimentScreen(true);
    });
  }

  /**
   * Experiment Screen: Live Encounter + Receptive Field Inspector + Telemetry
   */
  private renderExperimentScreen(withCountdown: boolean = false): void {
    this.stopReplayLoop();
    this.state.setScreen('experiment');
    this.screenMount.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'experiment-view';
    this.screenMount.appendChild(wrap);

    // Left Column: Arena + Brain Gradient Inspector
    const leftCol = document.createElement('div');
    leftCol.className = 'arena-column';
    wrap.appendChild(leftCol);

    // Arena
    this.arenaView = new ArenaView(leftCol, this.liveEngine, this.recorder, {
      onLoomUpdate: (gradient) => {
        const acc = this.liveEngine.getAccumulators();
        this.gradientInspector?.update(gradient, acc.flight * 3, acc.startle * 3);
      },
      onThreatStarted: () => {
        this.state.threatStartTimeMs = performance.now();
      },
      onEncounterEnd: (result, survivalTime, latencyMs) => {
        this.state.reactionLatencyMs = latencyMs;
        this.state.survivalTimeS = survivalTime;
        this.state.setStatus(result);
        console.log(`Encounter ended: ${result}, survival: ${survivalTime.toFixed(2)}s, latency: ${latencyMs}ms`);
      },
    });

    // Receptive Field & Brain Gradient Inspector (User Requirement)
    this.gradientInspector = new BrainGradientInspector(leftCol, {
      onFlashRegion: (region, intensity) => {
        this.liveEngine.flashBrainRegion(region, intensity);
      },
    });

    // Right Column: Brain Telemetry Panel
    this.brainPanel = new BrainPanel(wrap, {
      onToggle3D: (is3D) => {
        this.state.is3DView = is3D;
        if (this.brainView3D && this.neuroRenderer2D) {
          const v3d = this.brainView3D.getElement();
          const v2d = this.neuroRenderer2D.getElement();
          if (is3D) {
            v2d.style.display = 'none';
            v3d.style.display = 'block';
            this.brainView3D.resize();
            this.brainView3D.start();
            this.neuroRenderer2D.stop();
          } else {
            v3d.style.display = 'none';
            v2d.style.display = 'block';
            this.neuroRenderer2D.resize();
            this.neuroRenderer2D.start();
            this.brainView3D.stop();
          }
        }
      },
    });

    // Mount 2D & 3D Brain View components into panel
    const panelEl = this.brainPanel.getElement();
    this.neuroRenderer2D = new NeuroRenderer2D(panelEl);
    this.brainView3D = new BrainView3D(panelEl);
    this.brainView3D.getElement().style.display = 'none'; // default is 2D
    this.neuroRenderer2D.start();

    // Start countdown if triggered from start
    if (withCountdown) {
      this.runCountdown(() => {
        this.arenaView?.startEncounter(Date.now());
      });
    } else {
      this.arenaView.startEncounter(Date.now());
    }
  }

  private runCountdown(onComplete: () => void): void {
    let count = 3;
    this.arenaView?.setCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.arenaView?.setCountdown(count);
      } else if (count === 0) {
        this.arenaView?.setCountdown(0); // "FLY RELEASED"
      } else {
        clearInterval(interval);
        this.arenaView?.setCountdown(null);
        onComplete();
      }
    }, 700);
  }

  /**
   * Replay Screen per §13: Deterministic Input Log & Canonical Trace Replay
   */
  private async renderReplayScreen(): Promise<void> {
    this.stopExperiment();
    this.state.setScreen('replay');
    this.screenMount.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'experiment-view';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    this.screenMount.appendChild(wrap);

    const arenaHolder = document.createElement('div');
    arenaHolder.style.flex = '1';
    arenaHolder.style.position = 'relative';
    wrap.appendChild(arenaHolder);

    // Mount Arena in Replay mode
    this.arenaView = new ArenaView(arenaHolder, this.liveEngine, this.recorder);
    this.arenaView.enableReplayMode(true);

    // Load canonical precomputed trace (MaleCNS v1.0, 166,700 neurons)
    const trace = await this.traceConsumer.loadTrace('traces/canonical_demo.json');
    this.arenaView.resetFly(42);

    // Mount Replay Controls
    this.replayControls = new ReplayControls(wrap, {
      onPlay: () => this.startReplayLoop(),
      onPause: () => this.stopReplayLoop(),
      onSeek: (t) => {
        this.replayTime = t;
        this.syncReplayFrame();
      },
      onStep: (dir) => {
        this.replayTime = Math.max(0, Math.min(trace.durationS, this.replayTime + dir * 0.05));
        this.replayControls?.setTime(this.replayTime);
        this.syncReplayFrame();
      },
      onSpeedChange: (speed) => {
        this.replaySpeed = speed;
      },
      onExport: () => {
        const liveSamples = this.recorder.getSamples();
        const exportData = liveSamples.length > 0 ? this.recorder.stopRecording() : trace;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = liveSamples.length > 0 ? 'live_encounter_log.json' : 'canonical_encounter_male_cns.json';
        a.click();
        URL.revokeObjectURL(url);
      },
      onImport: (log) => {
        console.log('Imported replay log:', log);
        alert(`Loaded replay log: ${log.samples.length} samples (${log.dataset})`);
      },
    });

    this.replayControls.setDuration(trace.durationS);
    this.replayTime = 0;
    this.syncReplayFrame();
  }

  private startReplayLoop(): void {
    if (this.isReplayPlaying) return;
    this.isReplayPlaying = true;
    let lastTs = performance.now();

    const loop = (ts: number) => {
      if (!this.isReplayPlaying) return;
      const dt = ((ts - lastTs) / 1000) * this.replaySpeed;
      lastTs = ts;

      this.replayTime += dt;
      const dur = this.traceConsumer.getDurationS();

      if (this.replayTime >= dur) {
        this.replayTime = dur;
        this.isReplayPlaying = false;
        this.replayControls?.setPlaying(false);
      }

      this.replayControls?.setTime(this.replayTime);
      this.syncReplayFrame();

      if (this.isReplayPlaying) {
        this.replayAnimId = requestAnimationFrame(loop);
      }
    };

    this.replayAnimId = requestAnimationFrame(loop);
  }

  private stopReplayLoop(): void {
    this.isReplayPlaying = false;
    if (this.replayAnimId !== null) {
      cancelAnimationFrame(this.replayAnimId);
      this.replayAnimId = null;
    }
  }

  private syncReplayFrame(): void {
    const sample = this.traceConsumer.getSampleAtTime(this.replayTime);
    if (!sample || !this.arenaView) return;

    this.arenaView.setFlyPosition(sample.flyX, sample.flyY, sample.flyHeading, sample.isFlying);
    this.arenaView.setPredatorPosition(sample.mouseX, sample.mouseY, sample.threatActive ?? true);
    this.arenaView.render();
  }

  /**
   * Brain Surgery Screen (§12)
   */
  private renderSurgeryScreen(): void {
    this.stopExperiment();
    this.stopReplayLoop();
    this.state.setScreen('brainSurgery');
    this.screenMount.innerHTML = '';

    new BrainSurgeryPanel(this.screenMount);
  }

  private stopExperiment(): void {
    this.arenaView?.stop();
    this.neuroRenderer2D?.stop();
    this.brainView3D?.stop();
  }

  private handleScreenChange(_screen: ScreenId): void {
    // Screen transition hook
  }
}

// Bootstrap application on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  new AppOrchestrator();
});
