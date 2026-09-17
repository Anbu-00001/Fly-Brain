/**
 * CausalityMatrix.ts
 *
 * Empirical evaluation of the "Necessary vs. Sufficient" Circuit Causality Matrix
 * for all 12 Drosophila connectome circuit nodes.
 */

import { DROSOPHILA_CIRCUIT_NODES } from '../shared/CircuitGraph';
import { CausalEngine } from './CausalEngine';
import { CausalMatrixRow, CausalClassification } from './ExperimentTypes';

export class CausalityMatrix {
  /**
   * Evaluates empirical Necessary and Sufficient properties across all circuit populations.
   */
  public static evaluateMatrix(): CausalMatrixRow[] {
    const rows: CausalMatrixRow[] = [];
    const allNodeIds = Object.keys(DROSOPHILA_CIRCUIT_NODES);

    // 1. Run baseline under canonical looming (Threat condition)
    const baselineThreat = CausalEngine.runTrajectory({
      stimulusType: 'canonical_looming',
      interventions: [],
    });

    for (const nodeId of allNodeIds) {
      const node = DROSOPHILA_CIRCUIT_NODES[nodeId];

      // Test Necessity: Silence nodeId during looming threat.
      // If escape is abolished, nodeId is NECESSARY.
      const lesionRun = CausalEngine.runTrajectory({
        stimulusType: 'canonical_looming',
        interventions: [{ targetNode: nodeId, type: 'silence', intensity: 1.0 }],
      });

      const isNecessary = baselineThreat.summary.escaped && !lesionRun.summary.escaped;

      // Test Sufficiency: Stimulate nodeId in resting condition.
      // If escape is triggered without visual looming, nodeId is SUFFICIENT.
      const stimRun = CausalEngine.runTrajectory({
        stimulusType: 'resting',
        interventions: [{ targetNode: nodeId, type: 'stimulate', intensity: 2.0 }],
      });

      const isSufficient = stimRun.summary.escaped;

      // Effect latency: from intervention to divergence/escape
      let effectLatencyMs: number | null = null;
      if (isNecessary) {
        const comp = CausalEngine.compare(baselineThreat, lesionRun);
        effectLatencyMs = comp.firstDivergenceMs;
      } else if (isSufficient) {
        effectLatencyMs = stimRun.summary.firstJumpLatencyMs;
      }

      let classification: CausalClassification = 'NEITHER';
      if (isNecessary && isSufficient) classification = 'BOTH';
      else if (isNecessary) classification = 'NECESSARY';
      else if (isSufficient) classification = 'SUFFICIENT';

      rows.push({
        nodeId,
        name: node.name,
        neuropil: node.neuropil,
        neuronCount: node.neuronCount,
        isNecessary,
        isSufficient,
        effectLatencyMs,
        classification,
        citation: node.biologicalCitation,
      });
    }

    return rows;
  }
}
