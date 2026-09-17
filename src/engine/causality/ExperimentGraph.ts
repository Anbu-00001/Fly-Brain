/**
 * ExperimentGraph.ts
 *
 * "Connectome Git": Immutable experiment directed acyclic graph (DAG).
 * Tracks counterfactual lineage, parent-child experiment branching,
 * and executes instantaneous two-way diffs between arbitrary experiments.
 */

import { CausalEngine } from './CausalEngine';
import {
  ExperimentTrajectory,
  ExperimentNode,
  CounterfactualComparison,
  InterventionDef,
} from './ExperimentTypes';

export class ExperimentGraph {
  private nodes: Map<string, ExperimentNode> = new Map();
  private trajectories: Map<string, ExperimentTrajectory> = new Map();
  private rootId: string = 'EXP-001';

  constructor() {
    this.initRootBaseline();
  }

  private initRootBaseline(): void {
    const baseline = CausalEngine.runTrajectory({
      name: 'Baseline (Intact Control)',
      stimulusType: 'canonical_looming',
      interventions: [],
    });

    const rootNode: ExperimentNode = {
      id: 'EXP-001',
      parentId: null,
      name: 'Baseline (Intact Control)',
      interventions: [],
      summary: baseline.summary,
      timestamp: baseline.timestamp,
      children: [],
    };

    this.nodes.set('EXP-001', rootNode);
    this.trajectories.set('EXP-001', baseline);
    this.rootId = 'EXP-001';
  }

  public getRootId(): string {
    return this.rootId;
  }

  public getNode(id: string): ExperimentNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): ExperimentNode[] {
    return Array.from(this.nodes.values());
  }

  public getTrajectory(id: string): ExperimentTrajectory | undefined {
    return this.trajectories.get(id);
  }

  /**
   * Branches a new experiment from an existing parent node.
   */
  public branch(
    parentId: string,
    name: string,
    additionalInterventions: InterventionDef[]
  ): ExperimentNode {
    const parent = this.nodes.get(parentId);
    if (!parent) throw new Error(`Parent experiment '${parentId}' not found.`);

    // Inherit parent interventions and merge with additional
    const combinedInterventions: InterventionDef[] = [
      ...parent.interventions,
      ...additionalInterventions,
    ];

    const expIndex = (this.nodes.size + 1).toString().padStart(3, '0');
    const newId = `EXP-${expIndex}`;

    const trajectory = CausalEngine.runTrajectory({
      name,
      stimulusType: 'canonical_looming',
      interventions: combinedInterventions,
    });

    const newNode: ExperimentNode = {
      id: newId,
      parentId,
      name,
      interventions: combinedInterventions,
      summary: trajectory.summary,
      timestamp: trajectory.timestamp,
      children: [],
    };

    parent.children.push(newId);
    this.nodes.set(newId, newNode);
    this.trajectories.set(newId, trajectory);

    return newNode;
  }

  /**
   * Compares any two arbitrary experiment nodes.
   */
  public diff(nodeIdA: string, nodeIdB: string): CounterfactualComparison {
    const trajA = this.trajectories.get(nodeIdA);
    const trajB = this.trajectories.get(nodeIdB);

    if (!trajA || !trajB) {
      throw new Error(`Cannot diff: one or both experiments (${nodeIdA}, ${nodeIdB}) not found.`);
    }

    return CausalEngine.compare(trajA, trajB);
  }
}
