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
import { Arena3DView, CameraMode3D } from './ui/Arena3DView';
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
  private arenaView3D: Arena3DView | null = null;
  private arenaMode: '3d' | '2d' = '3d';
  private cameraMode3D: CameraMode3D = 'overview';

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
    this.stopExperiment();
    this.state.setScreen('experiment');
    this.screenMount.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'experiment-view';
    this.screenMount.appendChild(wrap);

    // Left Column: Arena Toolbar + Arenas (3D / 2D) + Brain Gradient Inspector
    const leftCol = document.createElement('div');
    leftCol.className = 'arena-column';
    wrap.appendChild(leftCol);

    // Arena Toolbar with Mode and Camera selection
    const toolbar = document.createElement('div');
    toolbar.className = 'arena-toolbar';
    toolbar.innerHTML = `
      <div class="arena-mode-group">
        <button type="button" class="arena-btn active" id="btnMode3D">◈ 3D CYBER-TERRARIUM</button>
        <button type="button" class="arena-btn" id="btnMode2D">☵ 2D VECTOR</button>
      </div>
      <div class="arena-cam-group" id="arenaCamGroup">
        <span class="cam-label">CAMERA:</span>
        <button type="button" class="cam-btn active" data-cam="overview">OVERVIEW</button>
        <button type="button" class="cam-btn" data-cam="chase">CHASE CAM</button>
        <button type="button" class="cam-btn" data-cam="compound_eye">COMPOUND EYE POV</button>
      </div>
    `;
    leftCol.appendChild(toolbar);

    // Arena Holder containing both 3D and 2D canvas elements
    const arenaHolder = document.createElement('div');
    arenaHolder.style.flex = '1';
    arenaHolder.style.position = 'relative';
    arenaHolder.style.minHeight = '0';
    arenaHolder.style.overflow = 'hidden';
    leftCol.appendChild(arenaHolder);

    // 1. Initialize 3D Arena View (Three.js)
    this.arenaView3D = new Arena3DView(arenaHolder, this.liveEngine, this.recorder, {
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
      },
    });

    // 2. Initialize 2D Tactical Vector Arena (Canvas2D)
    this.arenaView = new ArenaView(arenaHolder, this.liveEngine, this.recorder, {
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
      },
    });

    // Default view is 3D
    this.arenaView.getElement().style.display = 'none';
    this.arenaView3D.getElement().style.display = 'block';

    // Bind toolbar buttons
    const btn3D = toolbar.querySelector('#btnMode3D') as HTMLButtonElement;
    const btn2D = toolbar.querySelector('#btnMode2D') as HTMLButtonElement;
    const camGroup = toolbar.querySelector('#arenaCamGroup') as HTMLElement;
    const camBtns = toolbar.querySelectorAll('.cam-btn');

    btn3D.addEventListener('click', () => {
      if (this.arenaMode === '3d') return;
      this.arenaMode = '3d';
      btn3D.classList.add('active');
      btn2D.classList.remove('active');
      camGroup.style.display = 'flex';

      this.arenaView?.stop();
      if (this.arenaView) this.arenaView.getElement().style.display = 'none';
      if (this.arenaView3D) {
        this.arenaView3D.getElement().style.display = 'block';
        this.arenaView3D.setCameraMode(this.cameraMode3D);
        this.arenaView3D.resize();
        this.arenaView3D.startEncounter(Date.now());
      }
    });

    btn2D.addEventListener('click', () => {
      if (this.arenaMode === '2d') return;
      this.arenaMode = '2d';
      btn2D.classList.add('active');
      btn3D.classList.remove('active');
      camGroup.style.display = 'none';

      this.arenaView3D?.stop();
      if (this.arenaView3D) this.arenaView3D.getElement().style.display = 'none';
      if (this.arenaView) {
        this.arenaView.getElement().style.display = 'block';
        this.arenaView.resize();
        this.arenaView.startEncounter(Date.now());
      }
    });

    camBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        camBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-cam') as CameraMode3D;
        if (mode && this.arenaView3D) {
          this.cameraMode3D = mode;
          this.arenaView3D.setCameraMode(mode);
        }
      });
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
        if (this.arenaMode === '3d') {
          this.arenaView3D?.startEncounter(Date.now());
        } else {
          this.arenaView?.startEncounter(Date.now());
        }
      });
    } else {
      if (this.arenaMode === '3d') {
        this.arenaView3D.startEncounter(Date.now());
      } else {
        this.arenaView.startEncounter(Date.now());
      }
    }
  }

  private runCountdown(onComplete: () => void): void {
    let count = 3;
    this.arenaView3D?.setCountdown(count);
    this.arenaView?.setCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.arenaView3D?.setCountdown(count);
        this.arenaView?.setCountdown(count);
      } else if (count === 0) {
        this.arenaView3D?.setCountdown(0);
        this.arenaView?.setCountdown(0);
      } else {
        clearInterval(interval);
        this.arenaView3D?.setCountdown(null);
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
    this.stopReplayLoop();
    this.state.setScreen('replay');
    this.screenMount.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'experiment-view';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    this.screenMount.appendChild(wrap);

    // Toolbar for replay view
    const toolbar = document.createElement('div');
    toolbar.className = 'arena-toolbar';
    toolbar.innerHTML = `
      <div class="arena-mode-group">
        <button type="button" class="arena-btn active" id="btnReplayMode3D">◈ 3D CYBER-TERRARIUM</button>
        <button type="button" class="arena-btn" id="btnReplayMode2D">☵ 2D VECTOR</button>
      </div>
      <div class="arena-cam-group" id="replayCamGroup">
        <span class="cam-label">CAMERA:</span>
        <button type="button" class="cam-btn active" data-cam="overview">OVERVIEW</button>
        <button type="button" class="cam-btn" data-cam="chase">CHASE CAM</button>
        <button type="button" class="cam-btn" data-cam="compound_eye">COMPOUND EYE POV</button>
      </div>
    `;
    wrap.appendChild(toolbar);

    const arenaHolder = document.createElement('div');
    arenaHolder.style.flex = '1';
    arenaHolder.style.position = 'relative';
    arenaHolder.style.minHeight = '0';
    arenaHolder.style.overflow = 'hidden';
    wrap.appendChild(arenaHolder);

    // Mount 3D and 2D Arenas in Replay mode
    this.arenaView3D = new Arena3DView(arenaHolder, this.liveEngine, this.recorder);
    this.arenaView3D.enableReplayMode(true);
    this.arenaView3D.resetFly(42);

    this.arenaView = new ArenaView(arenaHolder, this.liveEngine, this.recorder);
    this.arenaView.enableReplayMode(true);
    this.arenaView.resetFly(42);

    // Default replay is 3D
    this.arenaMode = '3d';
    this.arenaView.getElement().style.display = 'none';
    this.arenaView3D.getElement().style.display = 'block';

    const btn3D = toolbar.querySelector('#btnReplayMode3D') as HTMLButtonElement;
    const btn2D = toolbar.querySelector('#btnReplayMode2D') as HTMLButtonElement;
    const camGroup = toolbar.querySelector('#replayCamGroup') as HTMLElement;
    const camBtns = toolbar.querySelectorAll('.cam-btn');

    btn3D.addEventListener('click', () => {
      this.arenaMode = '3d';
      btn3D.classList.add('active');
      btn2D.classList.remove('active');
      camGroup.style.display = 'flex';
      if (this.arenaView) this.arenaView.getElement().style.display = 'none';
      if (this.arenaView3D) {
        this.arenaView3D.getElement().style.display = 'block';
        this.arenaView3D.resize();
        this.syncReplayFrame();
      }
    });

    btn2D.addEventListener('click', () => {
      this.arenaMode = '2d';
      btn2D.classList.add('active');
      btn3D.classList.remove('active');
      camGroup.style.display = 'none';
      if (this.arenaView3D) this.arenaView3D.getElement().style.display = 'none';
      if (this.arenaView) {
        this.arenaView.getElement().style.display = 'block';
        this.arenaView.resize();
        this.syncReplayFrame();
      }
    });

    camBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        camBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-cam') as CameraMode3D;
        if (mode && this.arenaView3D) {
          this.cameraMode3D = mode;
          this.arenaView3D.setCameraMode(mode);
          this.syncReplayFrame();
        }
      });
    });

    // Load canonical precomputed trace (MaleCNS v1.0, 166,700 neurons)
    const trace = await this.traceConsumer.loadTrace('traces/canonical_demo.json');

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
    if (!sample) return;

    if (this.arenaView) {
      this.arenaView.setFlyPosition(sample.flyX, sample.flyY, sample.flyHeading, sample.isFlying);
      this.arenaView.setPredatorPosition(sample.mouseX, sample.mouseY, sample.threatActive ?? true);
      if (this.arenaMode === '2d') {
        this.arenaView.render();
      }
    }

    if (this.arenaView3D) {
      // Map 2D 800x600 coordinates to 3D chamber bounds (-85 to +85)
      const x3 = ((sample.flyX - 400) / 400) * 85;
      const z3 = ((sample.flyY - 300) / 300) * 85;
      const px3 = ((sample.mouseX - 400) / 400) * 85;
      const pz3 = ((sample.mouseY - 300) / 300) * 85;

      this.arenaView3D.setFlyPosition(x3, z3, sample.flyHeading, sample.isFlying);
      this.arenaView3D.setPredatorPosition(px3, pz3, sample.threatActive ?? true);
      if (this.arenaMode === '3d') {
        this.arenaView3D.render();
      }
    }
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
    this.arenaView3D?.stop();
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
