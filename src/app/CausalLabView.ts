/**
 * CausalLabView.ts
 *
 * Master orchestrator for FLYBRAIN: CAUSALITY ENGINE & DISCOVERY LABORATORY.
 * Coordinates Ask The Brain Hero, Counterfactual Diff HUD, Causality Matrix,
 * GDB Breakpoints Debugger, Connectome Git DAG, Causal Atlas, and CQL Terminal,
 * synchronized with real-time 3D connectome visualization.
 */

import { AskTheBrainHero } from '../ui/causality/AskTheBrainHero';
import { CounterfactualDiffHUD } from '../ui/causality/CounterfactualDiffHUD';
import { CausalityMatrixView } from '../ui/causality/CausalityMatrixView';
import { BreakpointDebuggerHUD } from '../ui/causality/BreakpointDebuggerHUD';
import { ConnectomeGitTree } from '../ui/causality/ConnectomeGitTree';
import { CausalAtlasView } from '../ui/causality/CausalAtlasView';
import { CqlConsole } from '../ui/causality/CqlConsole';
import { BreakpointManager } from '../engine/causality/BreakpointManager';
import { ExperimentGraph } from '../engine/causality/ExperimentGraph';
import { LabBrain3D } from '../ui/lab/LabBrain3D';
import { LiveEngineAdapter } from '../engine/live/LiveEngineAdapter';

export type CausalSubTab =
  | 'ask'
  | 'diff'
  | 'matrix'
  | 'debugger'
  | 'git'
  | 'atlas'
  | 'cql';

export class CausalLabView {
  private mount: HTMLElement;
  private liveEngine: LiveEngineAdapter;
  private currentTab: CausalSubTab = 'ask';

  // Sub-components
  private counterfactualDiffHUD: CounterfactualDiffHUD | null = null;
  private cqlConsole: CqlConsole | null = null;

  // Shared state engines
  private breakpointManager: BreakpointManager;
  private experimentGraph: ExperimentGraph;
  private brain3D: LabBrain3D | null = null;

  constructor(mount: HTMLElement, liveEngine: LiveEngineAdapter) {
    this.mount = mount;
    this.liveEngine = liveEngine;
    this.breakpointManager = new BreakpointManager();
    this.experimentGraph = new ExperimentGraph();
    this.render();
  }

  private render(): void {
    this.mount.innerHTML = `
      <div class="causal-lab-layout">
        <!-- Sub-Header / Causal Lab Navigation -->
        <header class="causal-lab-subheader">
          <div class="causal-brand">
            <span class="causal-logo-icon">⚡</span>
            <div class="causal-logo-text">
              <span class="logo-title">CAUSAL LAB</span>
              <span class="logo-subtitle">NEURAL CIRCUIT DEBUGGER</span>
            </div>
          </div>

          <nav class="causal-subtabs" id="causalSubTabs">
            <button class="subtab-btn ${this.currentTab === 'ask' ? 'active' : ''}" data-tab="ask">
              ⚡ ASK THE BRAIN
            </button>
            <button class="subtab-btn ${this.currentTab === 'diff' ? 'active' : ''}" data-tab="diff">
              🔀 COUNTERFACTUAL DIFF
            </button>
            <button class="subtab-btn ${this.currentTab === 'matrix' ? 'active' : ''}" data-tab="matrix">
              📊 CAUSALITY MATRIX
            </button>
            <button class="subtab-btn ${this.currentTab === 'debugger' ? 'active' : ''}" data-tab="debugger">
              🐛 GDB BREAKPOINTS
            </button>
            <button class="subtab-btn ${this.currentTab === 'git' ? 'active' : ''}" data-tab="git">
              🌿 CONNECTOME GIT
            </button>
            <button class="subtab-btn ${this.currentTab === 'atlas' ? 'active' : ''}" data-tab="atlas">
              🗺️ CAUSAL ATLAS
            </button>
            <button class="subtab-btn ${this.currentTab === 'cql' ? 'active' : ''}" data-tab="cql">
              💻 CQL CONSOLE
            </button>
          </nav>
        </header>

        <!-- Main Workspace Area -->
        <div class="causal-workspace-grid">
          <!-- Left / Active Sub-View Panel -->
          <div class="causal-active-panel" id="causalActivePanel"></div>

          <!-- Right Side: 3D Connectome Companion Canvas -->
          <div class="causal-3d-companion">
            <div class="companion-header">
              <span class="companion-title">CONNECTOME CAUSAL TOPOLOGY</span>
              <span class="companion-tag">3D INSTANCED</span>
            </div>
            <div class="companion-canvas-mount" id="causal3DCanvasMount"></div>
          </div>
        </div>
      </div>
    `;

    this.bindNavigation();
    this.init3DCompanion();
    this.mountCurrentTab();
  }

  private bindNavigation(): void {
    const nav = this.mount.querySelector('#causalSubTabs');
    nav?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.subtab-btn') as HTMLButtonElement;
      if (!btn) return;
      const tab = btn.getAttribute('data-tab') as CausalSubTab;
      if (tab && tab !== this.currentTab) {
        this.currentTab = tab;
        this.mount.querySelectorAll('.subtab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.mountCurrentTab();
      }
    });
  }

  private init3DCompanion(): void {
    const canvasMount = this.mount.querySelector('#causal3DCanvasMount') as HTMLElement;
    if (!canvasMount) return;

    this.brain3D = new LabBrain3D(canvasMount, {
      onHoverNode: () => {},
      onSelectNode: (node) => {
        if (this.currentTab === 'ask') {
          this.cqlConsole?.runQuery(`WHAT_IF SILENCE ${node.id}`);
        }
      },
    });
    this.brain3D.start();
  }

  private mountCurrentTab(): void {
    const panel = this.mount.querySelector('#causalActivePanel') as HTMLElement;
    if (!panel) return;
    panel.innerHTML = '';

    switch (this.currentTab) {
      case 'ask':
        new AskTheBrainHero(panel, {
          onSolutionSelected: (sol) => {
            const target = sol.interventions[0]?.targetNode;
            if (target && this.brain3D) {
              this.brain3D.selectNode(target);
              this.brain3D.triggerCascadeAnimation([target]);
            }
          },
          onViewCounterfactual: (sol) => {
            this.currentTab = 'diff';
            this.updateTabButtons();
            this.mountCurrentTab();
            this.counterfactualDiffHUD?.setCounterfactual(sol.interventions);
          },
        });
        break;

      case 'diff':
        this.counterfactualDiffHUD = new CounterfactualDiffHUD(panel, {
          onNodeSelected: (nodeId) => {
            this.brain3D?.selectNode(nodeId);
            this.brain3D?.triggerCascadeAnimation([nodeId]);
          },
        });
        break;

      case 'matrix':
        new CausalityMatrixView(panel, {
          onSelectPopulation: (nodeId) => {
            this.brain3D?.selectNode(nodeId);
            this.brain3D?.triggerCascadeAnimation([nodeId]);
          },
        });
        break;

      case 'debugger':
        new BreakpointDebuggerHUD(panel, this.breakpointManager, {
          onContinue: () => {
            this.liveEngine.start();
          },
          onStep: (dtMs) => {
            this.liveEngine.step(Math.max(1, Math.floor(dtMs / 10)));
          },
          onRewind: () => {
            this.liveEngine.reset();
          },
        });
        break;

      case 'git':
        new ConnectomeGitTree(panel, this.experimentGraph, {
          onCompareExperiments: (_idA, idB) => {
            this.currentTab = 'diff';
            this.updateTabButtons();
            this.mountCurrentTab();
            const trajB = this.experimentGraph.getTrajectory(idB);
            if (trajB) {
              this.counterfactualDiffHUD?.setCounterfactual(trajB.interventions, trajB.name);
            }
          },
          onSelectNode: (node) => {
            if (node.interventions[0]?.targetNode) {
              this.brain3D?.selectNode(node.interventions[0].targetNode);
            }
          },
        });
        break;

      case 'atlas':
        new CausalAtlasView(panel, {
          onNodeClick: (nodeId) => {
            this.brain3D?.selectNode(nodeId);
            this.brain3D?.triggerCascadeAnimation([nodeId]);
          },
        });
        break;

      case 'cql':
        this.cqlConsole = new CqlConsole(panel, {
          onExecuteResult: (res) => {
            if (res.ast.targetNode) {
              this.brain3D?.selectNode(res.ast.targetNode);
              this.brain3D?.triggerCascadeAnimation([res.ast.targetNode]);
            }
          },
        });
        break;
    }
  }

  private updateTabButtons(): void {
    this.mount.querySelectorAll('.subtab-btn').forEach((b) => {
      const tab = b.getAttribute('data-tab');
      if (tab === this.currentTab) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  public dispose(): void {
    this.brain3D?.dispose();
    this.brain3D = null;
  }
}
