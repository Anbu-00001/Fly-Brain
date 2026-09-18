/**
 * main.ts
 *
 * Application orchestrator: owns the screens, the engines, and — critically —
 * the teardown.
 *
 * WHY THE TEARDOWN IS THE INTERESTING PART
 * ----------------------------------------
 * The previous orchestrator changed screens like this:
 *
 *     private stopExperiment(): void {
 *       this.arenaView?.stop();
 *       this.arenaView3D?.stop();
 *       ...
 *     }
 *     ...
 *     this.screenMount.innerHTML = '';
 *     this.arenaView3D = new Arena3DView(...);   // new WebGL context
 *     this.brainView3D  = new BrainView3D(...);  // another one
 *
 * stop() cancelled animation frames but released nothing. Every visit to the
 * Experiment screen allocated two more WebGL contexts, two more scene graphs and
 * four more permanent window-level event listeners, none of which were ever
 * reclaimed. A few navigations exhausted the browser's context budget and pinned
 * the GPU — which is precisely why this project could not be run for long on a
 * laptop without it overheating.
 *
 * Every screen now owns a DisposalBag. Changing screens empties the bag first and
 * touches the DOM second. Nothing is constructed until it is shown: the 2D and 3D
 * arenas are mutually exclusive rather than both built and one hidden.
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
import { DisposalBag } from './ui/render/Lifecycle';

type ArenaMode = '2d' | '3d';

class AppOrchestrator {
  private state: AppState;
  private liveEngine: LiveEngineAdapter;
  private traceConsumer: TraceConsumer;
  private recorder: InputRecorder;

  private badge!: LiveOrRecordedBadge;
  private aboutDrawer!: AboutDrawer;
  private screenMount!: HTMLElement;

  /** Everything the current screen owns. Emptied on every screen change. */
  private screenBag = new DisposalBag();

  // Live references, valid only while the owning screen is mounted.
  private arenaView: ArenaView | null = null;
  private arenaView3D: Arena3DView | null = null;
  private arenaMode: ArenaMode = '3d';
  private cameraMode3D: CameraMode3D = 'overview';
  private gradientInspector: BrainGradientInspector | null = null;
  private brainPanel: BrainPanel | null = null;
  private neuroRenderer2D: NeuroRenderer2D | null = null;
  private brainView3D: BrainView3D | null = null;
  private replayControls: ReplayControls | null = null;

  private replayAnimId: number | null = null;
  private isReplayPlaying = false;
  private replayTime = 0;
  private replaySpeed = 1.0;
  private countdownTimer: number | null = null;

  constructor() {
    this.recorder = new InputRecorder();
    this.traceConsumer = new TraceConsumer();

    this.state = new AppState({
      onScreenChange: (screen) => this.handleScreenChange(screen),
      onEngineChange: (engine) => this.badge?.update(engine),
    });

    this.liveEngine = new LiveEngineAdapter({
      onReady: (neurons, edges) => {
        console.log(`ENGINE-LIVE ready: ${neurons} neurons, ${edges} edges.`);
      },
      onTick: (data) => {
        if (this.state.getScreen() === 'experiment') {
          this.brainPanel?.updateTick(data, this.liveEngine.getNeuronCount(), this.state.responseWallClockMs);
          this.brainView3D?.updateTick(data);
        }
      },
    });

    this.initDOM();
  }

  private async initDOM(): Promise<void> {
    this.screenMount = document.getElementById('screenMount') as HTMLElement;
    const badgeHolder = document.getElementById('headerBadgeHolder') as HTMLElement;

    this.badge = new LiveOrRecordedBadge(badgeHolder);
    this.aboutDrawer = new AboutDrawer(document.body);
    this.bindNav();

    this.liveEngine.init().catch((err) => {
      console.warn('ENGINE-LIVE background load warning:', err);
    });

    // Release the worker thread if the page goes away.
    window.addEventListener('beforeunload', () => {
      this.teardownScreen();
      this.liveEngine.dispose();
    });

    this.renderHomeScreen();
  }

  private bindNav(): void {
    const nav: Array<[string, () => void]> = [
      ['navExperiment', () => this.renderExperimentScreen()],
      ['navReplay', () => this.renderReplayScreen()],
      ['navSurgery', () => this.renderSurgeryScreen()],
    ];
    for (const [id, go] of nav) {
      document.getElementById(id)?.addEventListener('click', () => {
        this.updateNavButtons(id);
        go();
      });
    }
    document.getElementById('navAbout')?.addEventListener('click', () => this.aboutDrawer.toggle());
  }

  private updateNavButtons(activeId: string): void {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.getElementById(activeId)?.classList.add('active');
  }

  /* ---------- lifecycle ---------- */

  /**
   * Releases every resource the current screen owns, THEN clears the DOM.
   * Order matters: disposing after innerHTML = '' would leave each view holding a
   * detached canvas whose GPU context is still live.
   */
  private teardownScreen(): void {
    this.stopReplayLoop();
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.screenBag.dispose();
    this.screenBag = new DisposalBag();

    this.arenaView = null;
    this.arenaView3D = null;
    this.gradientInspector = null;
    this.brainPanel = null;
    this.neuroRenderer2D = null;
    this.brainView3D = null;
    this.replayControls = null;

    this.liveEngine.stop();
    this.screenMount.innerHTML = '';
  }

  /* ---------- home ---------- */

  private renderHomeScreen(): void {
    this.teardownScreen();
    this.state.setScreen('home');
    this.screenMount.innerHTML = `
      <div class="home-screen">
        <div class="home-hero">
          <span class="hero-tag">CONNECTOME-BASED NEUROSCIENCE EXPERIMENT</span>
          <h1 class="hero-title">FLY ESCAPE</h1>
          <h2 class="hero-subtitle">Can you catch a 166,000-neuron brain?</h2>
          <p class="hero-desc">
            A simulated fruit fly, driven by a connectome-based neural simulation,
            reacts to a looming predator you steer with the mouse.<br />
            <strong>Two engines:</strong> the 166,700-neuron whole-CNS model (MaleCNS v1.0)
            powers Brain Surgery's recorded lesion comparisons; live encounters run on a
            139,255-neuron real-time model of the same fly's visual system (FlyWire FAFB v783).
            Every figure on screen states which engine produced it.
          </p>
          <div class="home-cta-group">
            <button type="button" class="cyber-action-btn primary-escape-btn" id="btnStartExperiment">
              [ START ESCAPE ENCOUNTER ]
            </button>
          </div>
          <div class="home-footer-note">
            Nothing here is trained. Both engines are fixed biological wiring driven by injected input.
          </div>
        </div>
      </div>
    `;
    document.getElementById('btnStartExperiment')?.addEventListener('click', () => {
      this.updateNavButtons('navExperiment');
      this.renderExperimentScreen(true);
    });
  }

  /* ---------- experiment ---------- */

  private renderExperimentScreen(withCountdown = false): void {
    this.teardownScreen();
    this.state.setScreen('experiment');

    const wrap = document.createElement('div');
    wrap.className = 'experiment-view';
    this.screenMount.appendChild(wrap);

    const leftCol = document.createElement('div');
    leftCol.className = 'arena-column';
    wrap.appendChild(leftCol);

    const toolbar = document.createElement('div');
    toolbar.className = 'arena-toolbar';
    toolbar.innerHTML = `
      <div class="arena-mode-group">
        <button type="button" class="arena-btn ${this.arenaMode === '3d' ? 'active' : ''}" id="btnMode3D">3D CHAMBER</button>
        <button type="button" class="arena-btn ${this.arenaMode === '2d' ? 'active' : ''}" id="btnMode2D">2D VECTOR</button>
      </div>
      <div class="arena-cam-group" id="arenaCamGroup" style="display:${this.arenaMode === '3d' ? 'flex' : 'none'}">
        <span class="cam-label">CAMERA</span>
        <button type="button" class="cam-btn active" data-cam="overview">OVERVIEW</button>
        <button type="button" class="cam-btn" data-cam="chase">CHASE</button>
        <button type="button" class="cam-btn" data-cam="compound_eye">COMPOUND EYE</button>
      </div>
    `;
    leftCol.appendChild(toolbar);

    const arenaHolder = document.createElement('div');
    arenaHolder.className = 'arena-holder';
    leftCol.appendChild(arenaHolder);

    this.gradientInspector = new BrainGradientInspector(leftCol, {
      onFlashRegion: (region, intensity) => this.liveEngine.flashBrainRegion(region, intensity),
    });

    this.brainPanel = new BrainPanel(wrap, {
      onToggle3D: (is3D) => this.setBrainView(is3D),
    });
    const panelEl = this.brainPanel.getElement();

    this.neuroRenderer2D = this.screenBag.add(new NeuroRenderer2D(panelEl));
    this.neuroRenderer2D.start();
    this.state.is3DView = false;

    // Only the selected arena is constructed. Building both and hiding one was
    // paying for two renderers to show one.
    this.mountArena(arenaHolder, this.arenaMode);

    toolbar.querySelector('#btnMode3D')?.addEventListener('click', () => {
      if (this.arenaMode === '3d') return;
      this.switchArenaMode(arenaHolder, '3d', toolbar);
    });
    toolbar.querySelector('#btnMode2D')?.addEventListener('click', () => {
      if (this.arenaMode === '2d') return;
      this.switchArenaMode(arenaHolder, '2d', toolbar);
    });
    toolbar.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.cam-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-cam') as CameraMode3D;
        if (mode && this.arenaView3D) {
          this.cameraMode3D = mode;
          this.arenaView3D.setCameraMode(mode);
        }
      });
    });

    this.liveEngine.reset();
    this.liveEngine.start();

    if (withCountdown) this.runCountdown(() => this.startActiveArena());
    else this.startActiveArena();
  }

  /** Builds exactly one arena and registers it for disposal. */
  private mountArena(host: HTMLElement, mode: ArenaMode): void {
    const cb = {
      onLoomUpdate: (gradient: any) => {
        const esc = this.liveEngine.getEscapeState();
        this.gradientInspector?.update(gradient, esc.decision?.drive ?? 0, esc.lobulaActivity);
      },
      onThreatStarted: () => {
        this.state.threatStartTimeMs = performance.now();
      },
      onEncounterEnd: (result: 'escaped' | 'caught', survivalTime: number, ms: number | null) => {
        this.state.responseWallClockMs = ms;
        this.state.survivalTimeS = survivalTime;
        this.state.setStatus(result);
      },
    };

    if (mode === '3d') {
      this.arenaView3D = this.screenBag.add(new Arena3DView(host, this.liveEngine, this.recorder, cb));
      this.arenaView3D.setCameraMode(this.cameraMode3D);
      this.arenaView3D.resize();
    } else {
      this.arenaView = this.screenBag.add(new ArenaView(host, this.liveEngine, this.recorder, cb));
      this.arenaView.resize();
    }
  }

  private switchArenaMode(host: HTMLElement, mode: ArenaMode, toolbar: HTMLElement): void {
    // Dispose the outgoing arena rather than hiding it.
    this.arenaView3D?.dispose();
    this.arenaView?.dispose();
    this.arenaView3D = null;
    this.arenaView = null;

    this.arenaMode = mode;
    toolbar.querySelector('#btnMode3D')?.classList.toggle('active', mode === '3d');
    toolbar.querySelector('#btnMode2D')?.classList.toggle('active', mode === '2d');
    const camGroup = toolbar.querySelector('#arenaCamGroup') as HTMLElement | null;
    if (camGroup) camGroup.style.display = mode === '3d' ? 'flex' : 'none';

    this.mountArena(host, mode);
    this.startActiveArena();
  }

  private startActiveArena(): void {
    if (this.arenaMode === '3d') this.arenaView3D?.startEncounter(Date.now());
    else this.arenaView?.startEncounter(Date.now());
  }

  /** The brain panel's 2D/3D toggle, with the inactive renderer disposed. */
  private setBrainView(is3D: boolean): void {
    if (!this.brainPanel) return;
    this.state.is3DView = is3D;
    const panelEl = this.brainPanel.getElement();

    if (is3D) {
      this.neuroRenderer2D?.dispose();
      this.neuroRenderer2D = null;
      this.brainView3D = this.screenBag.add(new BrainView3D(panelEl));
      this.brainView3D.resize();
      this.brainView3D.start();
    } else {
      this.brainView3D?.dispose();
      this.brainView3D = null;
      this.neuroRenderer2D = this.screenBag.add(new NeuroRenderer2D(panelEl));
      this.neuroRenderer2D.resize();
      this.neuroRenderer2D.start();
    }
  }

  private runCountdown(onComplete: () => void): void {
    let count = 3;
    this.arenaView3D?.setCountdown(count);
    this.arenaView?.setCountdown(count);

    this.countdownTimer = window.setInterval(() => {
      count--;
      if (count > 0) {
        this.arenaView3D?.setCountdown(count);
        this.arenaView?.setCountdown(count);
      } else if (count === 0) {
        this.arenaView3D?.setCountdown(0);
        this.arenaView?.setCountdown(0);
      } else {
        if (this.countdownTimer !== null) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.arenaView3D?.setCountdown(null);
        this.arenaView?.setCountdown(null);
        onComplete();
      }
    }, 700);
  }

  /* ---------- replay ---------- */

  private async renderReplayScreen(): Promise<void> {
    this.teardownScreen();
    this.state.setScreen('replay');

    const wrap = document.createElement('div');
    wrap.className = 'experiment-view replay-view';
    this.screenMount.appendChild(wrap);

    const arenaHolder = document.createElement('div');
    arenaHolder.className = 'arena-holder';
    wrap.appendChild(arenaHolder);

    // Replay always uses the 3D chamber; a second hidden 2D arena bought nothing.
    this.arenaView3D = this.screenBag.add(
      new Arena3DView(arenaHolder, this.liveEngine, this.recorder)
    );
    this.arenaView3D.enableReplayMode(true);
    this.arenaView3D.resetFly(42);
    this.arenaView3D.setCameraMode(this.cameraMode3D);
    this.arenaView3D.resize();

    const trace = await this.traceConsumer.loadTrace('traces/canonical_demo.json');

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
        console.log(`Loaded replay log: ${log.samples.length} samples (${log.dataset})`);
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
      if (this.isReplayPlaying) this.replayAnimId = requestAnimationFrame(loop);
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
    if (!sample || !this.arenaView3D) return;

    // Map the trace's 800x600 arena onto the 3D chamber bounds.
    const x3 = ((sample.flyX - 400) / 400) * 85;
    const z3 = ((sample.flyY - 300) / 300) * 85;
    const px3 = ((sample.mouseX - 400) / 400) * 85;
    const pz3 = ((sample.mouseY - 300) / 300) * 85;

    this.arenaView3D.setFlyPosition(x3, z3, sample.flyHeading, sample.isFlying);
    this.arenaView3D.setPredatorPosition(px3, pz3, sample.threatActive ?? true);
    this.arenaView3D.render();
  }

  /* ---------- brain surgery ---------- */

  private renderSurgeryScreen(): void {
    this.teardownScreen();
    this.state.setScreen('brainSurgery');
    this.screenBag.add(new BrainSurgeryPanel(this.screenMount));
  }

  private handleScreenChange(_screen: ScreenId): void {
    // Reserved: the badge already reacts via onEngineChange.
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AppOrchestrator();
});
