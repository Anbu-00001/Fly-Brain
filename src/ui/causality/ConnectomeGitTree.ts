/**
 * ConnectomeGitTree.ts
 *
 * Visual DAG representation of counterfactual experiment history ("Connectome Git").
 * Allows branching experiments, lineage inspection, and two-way diff comparisons.
 */

import { ExperimentGraph } from '../../engine/causality/ExperimentGraph';
import { ExperimentNode } from '../../engine/causality/ExperimentTypes';

export interface ConnectomeGitTreeCallbacks {
  onCompareExperiments?: (idA: string, idB: string) => void;
  onSelectNode?: (node: ExperimentNode) => void;
}

export class ConnectomeGitTree {
  private container: HTMLElement;
  private graph: ExperimentGraph;
  private selectedNodeIds: Set<string> = new Set();
  private callbacks: ConnectomeGitTreeCallbacks;

  constructor(
    container: HTMLElement,
    graph: ExperimentGraph,
    callbacks: ConnectomeGitTreeCallbacks = {}
  ) {
    this.container = container;
    this.graph = graph;
    this.callbacks = callbacks;
    this.initDefaultBranches();
    this.render();
  }

  private initDefaultBranches(): void {
    const rootId = this.graph.getRootId();

    // Add classic lesion branches
    if (this.graph.getAllNodes().length === 1) {
      this.graph.branch(rootId, 'DNp01 Silenced (Command Lesion)', [
        { targetNode: 'DNp01', type: 'silence', intensity: 1.0 },
      ]);
      this.graph.branch(rootId, 'LC4 + LPLC2 Silenced (Visual Lesion)', [
        { targetNode: 'LC4', type: 'silence', intensity: 1.0 },
        { targetNode: 'LPLC2', type: 'silence', intensity: 1.0 },
      ]);
      this.graph.branch('EXP-002', 'DNp01 Silenced + LC4 Stimulated', [
        { targetNode: 'LC4', type: 'stimulate', intensity: 1.5 },
      ]);
    }
  }

  public render(): void {
    const nodes = this.graph.getAllNodes();

    const nodesListHtml = nodes
      .map((node) => {
        const isSelected = this.selectedNodeIds.has(node.id);
        const invTags =
          node.interventions.length > 0
            ? node.interventions
                .map((i) => `<span class="inv-mini-tag ${i.type}">${i.type} ${i.targetNode}</span>`)
                .join(' ')
            : '<span class="inv-mini-tag intact">INTACT CONTROL</span>';

        return `
          <div class="git-node-card ${isSelected ? 'selected' : ''}" data-id="${node.id}">
            <div class="git-node-top">
              <span class="commit-hash">${node.id}</span>
              <span class="commit-parent">${node.parentId ? `parent: ${node.parentId}` : 'ROOT'}</span>
              <span class="commit-badge ${node.summary.escaped ? 'escaped' : 'caught'}">
                ${node.summary.escaped ? 'ESCAPED' : 'CAUGHT'}
              </span>
            </div>
            <div class="commit-name">${node.name}</div>
            <div class="commit-invs">${invTags}</div>
          </div>
        `;
      })
      .join('');

    const compareDisabled = this.selectedNodeIds.size !== 2;

    this.container.innerHTML = `
      <div class="connectome-git-view">
        <div class="git-toolbar">
          <div>
            <h3 class="git-title">CONNECTOME GIT // EXPERIMENT BRANCHING</h3>
            <p class="git-subtitle">Select any two experiments to compute their counterfactual differential.</p>
          </div>
          <div class="git-actions">
            <button class="action-btn primary" id="btnGitCompare" ${compareDisabled ? 'disabled' : ''}>
              <span>🔀 COMPARE SELECTED (DIFF)</span>
            </button>
            <button class="action-btn secondary" id="btnGitBranch">
              <span>🌿 BRANCH CURRENT</span>
            </button>
          </div>
        </div>

        <div class="git-nodes-grid">${nodesListHtml}</div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelectorAll('.git-node-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        if (!id) return;

        if (this.selectedNodeIds.has(id)) {
          this.selectedNodeIds.delete(id);
        } else {
          if (this.selectedNodeIds.size >= 2) {
            this.selectedNodeIds.clear();
          }
          this.selectedNodeIds.add(id);
        }

        const node = this.graph.getNode(id);
        if (node) this.callbacks.onSelectNode?.(node);

        this.render();
      });
    });

    this.container.querySelector('#btnGitCompare')?.addEventListener('click', () => {
      const arr = Array.from(this.selectedNodeIds);
      if (arr.length === 2) {
        this.callbacks.onCompareExperiments?.(arr[0], arr[1]);
      }
    });

    this.container.querySelector('#btnGitBranch')?.addEventListener('click', () => {
      const arr = Array.from(this.selectedNodeIds);
      const parentId = arr[0] || this.graph.getRootId();
      this.graph.branch(parentId, `Custom Branch from ${parentId}`, [
        { targetNode: 'VIS_LO', type: 'silence', intensity: 1.0 },
      ]);
      this.render();
    });
  }
}
