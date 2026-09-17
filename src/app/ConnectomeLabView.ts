/**
 * ConnectomeLabView.ts
 *
 * Master orchestrator for CONNECTOME LAB ("God Mode"):
 * - Full-screen interactive 3D fly nervous system (LabBrain3D)
 * - Region Inspector HUD & Biological Metadata
 * - Neural Cascade Timeline & Brain Rewind (0 - 120ms)
 * - Neural Alchemy Interventions (Stimulate, Silence, Invert, Amplify)
 * - "Can You Break The Fly?" Experimental Challenges
 * - Neural Dominoes Synaptic Graph View
 * - Web Audio Polyphonic Neural Synthesizer
 * - Automated 30-Second Cinematic Showcase
 */

import { LiveEngineAdapter } from '../engine/live/LiveEngineAdapter';
import { DROSOPHILA_CIRCUIT_NODES, CircuitNode } from '../engine/shared/CircuitGraph';
import { LabBrain3D } from '../ui/lab/LabBrain3D';
import { RegionInspectorHUD } from '../ui/lab/RegionInspectorHUD';
import { NeuralCascadeTimeline } from '../ui/lab/NeuralCascadeTimeline';
import { InterventionPanel, ActiveIntervention } from '../ui/lab/InterventionPanel';
import { ChallengeManager } from '../ui/lab/ChallengeManager';
import { NeuralDominoesView } from '../ui/lab/NeuralDominoesView';
import { NeuralAudioSynth } from '../ui/lab/NeuralAudioSynth';

export type LabTabId = 'live' | 'cascade' | 'dominoes' | 'challenges' | 'cinematic';

export class ConnectomeLabView {
  private container: HTMLElement;
  private liveEngine: LiveEngineAdapter;

  private currentTab: LabTabId = 'live';
  private selectedNode: CircuitNode | null = null;

  // Components
  private labBrain!: LabBrain3D;
  private inspectorHUD!: RegionInspectorHUD;
  private cascadeTimeline!: NeuralCascadeTimeline;
  private interventionPanel!: InterventionPanel;
  private challengeManager!: ChallengeManager;
  private dominoesView!: NeuralDominoesView;
  private audioSynth!: NeuralAudioSynth;

  // UI holders
  private rightPanelMount!: HTMLElement;
  private bottomBarMount!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private cinematicOverlay!: HTMLElement;

  private isCinematicRunning: boolean = false;

  constructor(parentElement: HTMLElement, liveEngine: LiveEngineAdapter) {
    this.liveEngine = liveEngine;
    this.audioSynth = new NeuralAudioSynth();

    this.container = document.createElement('div');
    this.container.id = 'connectomeLabView';
    this.container.className = 'connectome-lab-view';
    parentElement.appendChild(this.container);

    this.renderLayout();
    this.initComponents();
    this.bindEvents();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <!-- Top Lab Sub-Navigation Bar -->
      <div class="lab-sub-header">
        <div class="lab-brand-group">
          <span class="lab-brand-logo">FLYBRAIN <span class="accent-cyan">LAB</span></span>
          <span class="lab-badge">GOD MODE • 139,255 NEURONS</span>
        </div>

        <nav class="lab-nav-tabs">
          <button type="button" class="lab-tab-btn active" data-tab="live">⚡ GOD MODE / LIVE</button>
          <button type="button" class="lab-tab-btn" data-tab="cascade">🧬 CASCADE TIME MACHINE</button>
          <button type="button" class="lab-tab-btn" data-tab="dominoes">🔥 NEURAL DOMINOES</button>
          <button type="button" class="lab-tab-btn" data-tab="challenges">🎯 BREAK THE FLY</button>
          <button type="button" class="lab-tab-btn cinematic-tab-btn" data-tab="cinematic">🎬 CINEMATIC SHOWCASE</button>
        </nav>

        <div class="lab-audio-controls">
          <button type="button" class="sound-toggle-btn" id="btnToggleSound">
            <span class="sound-icon">🔈</span>
            <span class="sound-text">SOUND: OFF</span>
          </button>
        </div>
      </div>

      <!-- Main Lab Workspace Grid -->
      <div class="lab-workspace">
        <!-- 3D Connectome Brain Center Stage -->
        <div class="lab-canvas-area" id="labCanvasMount"></div>

        <!-- Floating Right-Side Panel (Dynamic by tab) -->
        <div class="lab-right-panel" id="labRightPanelMount"></div>
      </div>

      <!-- Bottom Dock Bar for Timeline -->
      <div class="lab-bottom-dock" id="labBottomDockMount"></div>

      <!-- Cinematic Narrative Fullscreen Overlay -->
      <div class="cinematic-overlay" id="cinematicOverlay" style="display: none;">
        <div class="cinematic-text-card" id="cinematicCard">
          <span class="cinematic-sub">CONNECTOME ONLINE</span>
          <h2 class="cinematic-title" id="cinematicTitle">139,255 NEURONS CONNECTED</h2>
          <p class="cinematic-body" id="cinematicBody">Initializing Leaky Integrate-and-Fire simulation over adult Drosophila wiring.</p>
        </div>
        <button type="button" class="cinematic-exit-btn" id="btnExitCinematic">✕ EXIT SHOWCASE</button>
      </div>
    `;

    this.rightPanelMount = this.container.querySelector('#labRightPanelMount') as HTMLElement;
    this.bottomBarMount = this.container.querySelector('#labBottomDockMount') as HTMLElement;
    this.soundBtn = this.container.querySelector('#btnToggleSound') as HTMLButtonElement;
    this.cinematicOverlay = this.container.querySelector('#cinematicOverlay') as HTMLElement;
  }

  private initComponents(): void {
    const canvasMount = this.container.querySelector('#labCanvasMount') as HTMLElement;

    // 1. 3D Lab Brain
    this.labBrain = new LabBrain3D(canvasMount, {
      onSelectNode: (node) => {
        this.selectedNode = node;
        this.inspectorHUD.setNode(node, 24.5 + Math.random() * 15);
        this.interventionPanel.setTargetCircuit(node.id);
        this.dominoesView.setSourceNode(node.id);
        this.audioSynth.triggerNeuralVoice(node.region, 0.7);
      },
      onHoverNode: (node) => {
        if (node) {
          this.audioSynth.triggerNeuralVoice(node.region, 0.3);
        }
      },
    });

    // 2. Region Inspector HUD (always visible on right panel in Live mode)
    this.inspectorHUD = new RegionInspectorHUD(this.rightPanelMount);
    // Select default looming detector LC4
    this.selectedNode = DROSOPHILA_CIRCUIT_NODES['LC4'];
    this.inspectorHUD.setNode(this.selectedNode, 32.0);

    // 3. Intervention Panel
    this.interventionPanel = new InterventionPanel(this.rightPanelMount, {
      onApplyIntervention: (int) => {
        this.handleInterventionApplied(int);
      },
      onRemoveIntervention: () => {
        this.liveEngine.reset();
      },
      onClearAll: () => {
        this.liveEngine.reset();
      },
    });

    // 4. Dominoes View
    this.dominoesView = new NeuralDominoesView(this.rightPanelMount, {
      onTriggerCascade: (nodeIds) => {
        this.labBrain.triggerCascadeAnimation(nodeIds);
        // Trigger polyphonic cascading audio notes
        nodeIds.forEach((id, idx) => {
          setTimeout(() => {
            const node = DROSOPHILA_CIRCUIT_NODES[id];
            if (node) {
              this.audioSynth.triggerNeuralVoice(node.region, 0.75);
            }
          }, idx * 120);
        });
      },
      onSelectNode: (nodeId) => {
        this.labBrain.selectNode(nodeId);
      },
    });

    // 5. Challenge Manager
    this.challengeManager = new ChallengeManager(this.rightPanelMount, {
      onStartChallenge: (def) => {
        this.interventionPanel.clearAll();
        // Trigger live encounter setup in engine
        this.liveEngine.reset();
        this.liveEngine.start();
        if (def.targetCondition === 'prevent_escape') {
          // Simulate canonical looming attack
          this.liveEngine.flashBrainRegion('VIS_LO', 0.85);
        }
      },
      onChallengeComplete: (passed) => {
        if (passed) {
          this.audioSynth.triggerNeuralVoice('central', 0.9, 523.25);
        } else {
          this.audioSynth.triggerNeuralVoice('motor', 0.9, 45.0);
        }
      },
    });

    // 6. Cascade Timeline (docked at bottom)
    this.cascadeTimeline = new NeuralCascadeTimeline(this.bottomBarMount, {
      onSeek: (timeMs) => {
        this.syncTimelineToBrain(timeMs);
      },
      onPlayStateChange: (isPlaying) => {
        if (isPlaying) {
          this.audioSynth.triggerNeuralVoice('sensory', 0.5);
        }
      },
    });

    // Initial Tab Setup
    this.switchTab('live');
    this.labBrain.start();
  }

  private bindEvents(): void {
    const tabBtns = this.container.querySelectorAll('.lab-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as LabTabId;
        if (tab) this.switchTab(tab);
      });
    });

    this.soundBtn.addEventListener('click', () => {
      const enabled = !this.audioSynth.getEnabled();
      this.audioSynth.setEnabled(enabled);
      if (enabled) {
        this.soundBtn.classList.add('active');
        this.soundBtn.innerHTML = '<span class="sound-icon">🔊</span><span class="sound-text">SOUND: ON</span>';
        this.audioSynth.triggerNeuralVoice('sensory', 0.6);
      } else {
        this.soundBtn.classList.remove('active');
        this.soundBtn.innerHTML = '<span class="sound-icon">🔈</span><span class="sound-text">SOUND: OFF</span>';
      }
    });

    this.container.querySelector('#btnExitCinematic')?.addEventListener('click', () => {
      this.exitCinematicShowcase();
    });
  }

  public getCurrentTab(): LabTabId {
    return this.currentTab;
  }

  public switchTab(tab: LabTabId): void {
    this.currentTab = tab;

    // Update active tab button
    const tabBtns = this.container.querySelectorAll('.lab-tab-btn');
    tabBtns.forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });

    // Hide/show panels based on tab
    const inspectorEl = this.inspectorHUD.getElement();
    const interventionEl = this.interventionPanel.getElement();
    const dominoesEl = this.dominoesView.getElement();
    const challengeEl = this.challengeManager.getElement();
    const timelineEl = this.cascadeTimeline.getElement();

    inspectorEl.style.display = 'none';
    interventionEl.style.display = 'none';
    dominoesEl.style.display = 'none';
    challengeEl.style.display = 'none';
    timelineEl.style.display = 'none';

    switch (tab) {
      case 'live':
        inspectorEl.style.display = 'flex';
        interventionEl.style.display = 'flex';
        timelineEl.style.display = 'none';
        break;
      case 'cascade':
        inspectorEl.style.display = 'flex';
        interventionEl.style.display = 'flex';
        timelineEl.style.display = 'flex';
        break;
      case 'dominoes':
        dominoesEl.style.display = 'flex';
        inspectorEl.style.display = 'flex';
        break;
      case 'challenges':
        challengeEl.style.display = 'flex';
        interventionEl.style.display = 'flex';
        break;
      case 'cinematic':
        this.startCinematicShowcase();
        break;
    }

    this.labBrain.resize();
  }

  private handleInterventionApplied(int: ActiveIntervention): void {
    // 1. Flash 3D visual cluster
    this.labBrain.flashCluster(int.targetId, int.intensity * 1.5);

    // 2. Play audio feedback
    const node = DROSOPHILA_CIRCUIT_NODES[int.targetId];
    if (node) {
      this.audioSynth.triggerNeuralVoice(node.region, int.intensity);
    }

    // 3. Inject into simulation engine
    if (int.type === 'stimulate') {
      this.liveEngine.flashBrainRegion(int.targetId, int.intensity);
    } else if (int.type === 'silence') {
      this.liveEngine.flashBrainRegion(int.targetId, 0.0);
    }

    // 4. Trigger downstream cascade animation
    const cascade = node ? node.outputs : [];
    if (cascade.length > 0) {
      this.labBrain.triggerCascadeAnimation([int.targetId, ...cascade]);
    }

    // 5. Evaluate active challenges
    this.challengeManager.evaluateInterventions(this.interventionPanel.getActiveInterventions());
  }

  private syncTimelineToBrain(timeMs: number): void {
    // 0ms: VIS_R1R6, 15ms: VIS_ME, 28ms: LC4/LPLC2, 40ms: DNp01, 48ms: VNC_CPG
    if (timeMs < 10) {
      this.labBrain.flashCluster('VIS_R1R6', 1.0);
    } else if (timeMs >= 10 && timeMs < 25) {
      this.labBrain.flashCluster('VIS_ME', 1.0);
    } else if (timeMs >= 25 && timeMs < 38) {
      this.labBrain.flashCluster('LC4', 1.0);
      this.labBrain.flashCluster('LPLC2', 1.0);
    } else if (timeMs >= 38 && timeMs < 46) {
      this.labBrain.flashCluster('DNp01', 1.2);
      this.audioSynth.triggerNeuralVoice('motor', 0.8);
    } else {
      this.labBrain.flashCluster('VNC_CPG', 1.0);
    }
  }

  /**
   * Automated 30-Second Cinematic Narrative Showcase (§Phase 8)
   */
  private startCinematicShowcase(): void {
    if (this.isCinematicRunning) return;
    this.isCinematicRunning = true;
    this.cinematicOverlay.style.display = 'flex';

    const card = this.container.querySelector('#cinematicCard') as HTMLElement;
    const title = this.container.querySelector('#cinematicTitle') as HTMLElement;
    const body = this.container.querySelector('#cinematicBody') as HTMLElement;

    // Sequence Script:
    // 0s: Connectome Online
    title.textContent = 'CONNECTOME ONLINE: 139,255 NEURONS';
    body.textContent = 'Leaky Integrate-and-Fire simulation active over complete adult Drosophila wiring diagram.';
    this.labBrain.selectNode('VIS_R1R6');
    this.audioSynth.triggerNeuralVoice('sensory', 0.6);

    // 4s: Looming visual stimulus approaches
    setTimeout(() => {
      if (!this.isCinematicRunning) return;
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'fadeCard 0.5s ease';
      title.textContent = 'OPTICAL LOOMING THREAT DETECTED';
      body.textContent = 'Visual expansion flux stimulates 165 LC4 & 146 LPLC2 looming-selective projection neurons.';
      this.labBrain.selectNode('LC4');
      this.labBrain.flashCluster('VIS_LO', 1.0);
      this.audioSynth.triggerNeuralVoice('central', 0.7);
    }, 4000);

    // 9s: Giant Fiber fires escape command
    setTimeout(() => {
      if (!this.isCinematicRunning) return;
      title.textContent = 'ESCAPE COMMAND FIRED: DNp01 GIANT FIBER';
      body.textContent = 'Action potential sweeps down the cervical connective into the ventral nerve cord in 3.8 ms.';
      this.labBrain.selectNode('DNp01');
      this.labBrain.triggerCascadeAnimation(['LC4', 'DNp01', 'VNC_CPG']);
      this.audioSynth.triggerNeuralVoice('motor', 1.0);
    }, 9000);

    // 14s: Now Remove The Circuit
    setTimeout(() => {
      if (!this.isCinematicRunning) return;
      title.textContent = 'NOW SILENCE THE CIRCUIT';
      body.textContent = 'In-silico lesion applied to DNp01 Giant Fiber command neurons.';
      this.labBrain.flashCluster('DNp01', 0.0);
      this.interventionPanel.clearAll();
      this.interventionPanel.setTargetCircuit('DNp01');
    }, 14000);

    // 19s: Escape abolished
    setTimeout(() => {
      if (!this.isCinematicRunning) return;
      title.textContent = 'ESCAPE RESPONSE ABOLISHED';
      body.textContent = 'Re-running identical threat trajectory: visual looming detected, but motor takeoff severed.';
      this.labBrain.selectNode('LC4');
    }, 19000);

    // 24s: Call to action
    setTimeout(() => {
      if (!this.isCinematicRunning) return;
      title.textContent = 'WHAT ELSE WILL YOU BREAK?';
      body.textContent = 'Step into God Mode. Manipulate real Drosophila connectome circuits in real time.';
    }, 24000);
  }

  private exitCinematicShowcase(): void {
    this.isCinematicRunning = false;
    this.cinematicOverlay.style.display = 'none';
    this.switchTab('live');
  }

  public stop(): void {
    this.labBrain?.stop();
    this.cascadeTimeline?.pause();
    this.audioSynth?.suspend();
    this.isCinematicRunning = false;
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
