/**
 * MutationPhaseExplorer.ts
 *
 * FLYBRAIN: NEURAL REALITY ENGINE — Phase 16: Mutation Mode & Parameter Space Explorer.
 *
 * Sweeps across membrane leak rate, firing threshold, and looming velocity to map
 * the dynamical phase space of the Drosophila escape circuit:
 * - Phase 1: ESCAPE (DNp01 giant fiber fires)
 * - Phase 2: WALK (subthreshold motor activation, insufficient for takeoff)
 * - Phase 3: NO_RESPONSE (signal dies out in early visual layers)
 */

import { PhaseMapPoint } from './ExperimentTypes';
import { DROSOPHILA_SYNAPTIC_EDGES } from '../shared/CircuitGraph';

export interface PhaseMapGridResult {
  grid: PhaseMapPoint[];
  leakRange: number[];
  thresholdRange: number[];
  stimulusSpeed: number;
  escapeBoundaryThreshold: number;
  walkBoundaryThreshold: number;
}

export class MutationPhaseExplorer {
  /**
   * Sweeps a 2D parameter grid of (leakRate, threshold) at a given stimulus speed.
   */
  public static sweepPhaseGrid(options: {
    stimulusSpeed?: number;
    leakSteps?: number;
    thresholdSteps?: number;
  } = {}): PhaseMapGridResult {
    const stimulusSpeed = options.stimulusSpeed ?? 2.0;
    const leakSteps = options.leakSteps ?? 6;
    const thresholdSteps = options.thresholdSteps ?? 6;

    // Leak rate from 0.80 (very leaky) to 0.99 (low leak)
    const leakMin = 0.80;
    const leakMax = 0.98;
    const leakRange: number[] = [];
    for (let i = 0; i < leakSteps; i++) {
      leakRange.push(Number((leakMin + (i / (leakSteps - 1)) * (leakMax - leakMin)).toFixed(3)));
    }

    // Threshold from 0.4 (hyper-excitable) to 1.8 (hypo-excitable)
    const threshMin = 0.4;
    const threshMax = 1.8;
    const thresholdRange: number[] = [];
    for (let i = 0; i < thresholdSteps; i++) {
      thresholdRange.push(Number((threshMin + (i / (thresholdSteps - 1)) * (threshMax - threshMin)).toFixed(2)));
    }

    const grid: PhaseMapPoint[] = [];

    for (const leak of leakRange) {
      for (const thresh of thresholdRange) {
        const point = this.simulatePoint(leak, thresh, stimulusSpeed);
        grid.push(point);
      }
    }

    return {
      grid,
      leakRange,
      thresholdRange,
      stimulusSpeed,
      escapeBoundaryThreshold: 1.1,
      walkBoundaryThreshold: 1.45,
    };
  }

  /**
   * Simulates a single point in the dynamical parameter space.
   */
  public static simulatePoint(
    leakRate: number,
    threshold: number,
    stimulusSpeed: number
  ): PhaseMapPoint {
    const steps = 40;
    const dtMs = 2.0;
    const voltages: Record<string, number> = {
      VIS_R1R6: 0,
      VIS_ME: 0,
      VIS_LO: 0,
      LC4: 0,
      LPLC2: 0,
      DNp01: 0,
      VNC_MOT: 0,
    };
    const refractory: Record<string, number> = {
      VIS_R1R6: 0,
      VIS_ME: 0,
      VIS_LO: 0,
      LC4: 0,
      LPLC2: 0,
      DNp01: 0,
      VNC_MOT: 0,
    };

    let giantFiberFired = false;
    let motorSpikeCount = 0;
    let latencyMs: number | null = null;

    for (let t = 0; t < steps; t++) {
      const timeMs = t * dtMs;
      const firedThisStep = new Set<string>();

      // Visual input
      if (timeMs >= 4 && timeMs <= 50) {
        voltages['VIS_R1R6'] += Math.sin((timeMs / 50) * Math.PI) * stimulusSpeed * 0.7;
      }

      // Decay & Threshold
      for (const k of Object.keys(voltages)) {
        if (refractory[k] > 0) {
          refractory[k]--;
          voltages[k] = 0;
          continue;
        }

        voltages[k] *= leakRate;

        if (voltages[k] >= threshold) {
          firedThisStep.add(k);
          voltages[k] = 0;
          refractory[k] = 2;
        }
      }

      // Propagate along connectome
      for (const edge of DROSOPHILA_SYNAPTIC_EDGES) {
        if (firedThisStep.has(edge.source) && voltages[edge.target] !== undefined) {
          voltages[edge.target] += (edge.weight / 600.0);
        }
      }

      if (firedThisStep.has('DNp01')) {
        if (!giantFiberFired) {
          giantFiberFired = true;
          latencyMs = timeMs;
        }
      }

      if (firedThisStep.has('VNC_MOT')) {
        motorSpikeCount++;
      }
    }

    let outcome: 'ESCAPE' | 'WALK' | 'NO_RESPONSE';
    if (giantFiberFired) {
      outcome = 'ESCAPE';
    } else if (motorSpikeCount > 0 || voltages['VNC_MOT'] > threshold * 0.5) {
      outcome = 'WALK';
    } else {
      outcome = 'NO_RESPONSE';
    }

    return {
      leakRate,
      threshold,
      stimulusSpeed,
      outcome,
      latencyMs,
    };
  }
}
