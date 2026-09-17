/**
 * CausalEngine.test.ts
 *
 * Unit tests for deterministic counterfactual execution, divergence detection,
 * and mechanistic report generation.
 */

import { describe, it, expect } from 'vitest';
import { CausalEngine } from '../src/engine/causality/CausalEngine';

describe('CausalEngine: Deterministic Counterfactuals & Divergence', () => {
  it('produces byte-for-byte identical trajectories under identical seeds and conditions', () => {
    const run1 = CausalEngine.runTrajectory({ seed: 48192, stimulusType: 'canonical_looming' });
    const run2 = CausalEngine.runTrajectory({ seed: 48192, stimulusType: 'canonical_looming' });

    expect(run1.summary.escaped).toBe(run2.summary.escaped);
    expect(run1.summary.firstJumpLatencyMs).toBe(run2.summary.firstJumpLatencyMs);
    expect(run1.summary.totalSpikes).toBe(run2.summary.totalSpikes);
    expect(run1.samples.length).toBe(run2.samples.length);

    // Verify sample-by-sample equivalence
    for (let i = 0; i < run1.samples.length; i++) {
      expect(run1.samples[i].totalFired).toBe(run2.samples[i].totalFired);
      expect(run1.samples[i].motorOutput).toBe(run2.samples[i].motorOutput);
    }
  });

  it('silencing DNp01 abolishes escape and diverges at expected biological latency', () => {
    const baseline = CausalEngine.runTrajectory({ stimulusType: 'canonical_looming', interventions: [] });
    const lesionDNp01 = CausalEngine.runTrajectory({
      stimulusType: 'canonical_looming',
      interventions: [{ targetNode: 'DNp01', type: 'silence', intensity: 1.0 }],
    });

    expect(baseline.summary.escaped).toBe(true);
    expect(lesionDNp01.summary.escaped).toBe(false);

    const comp = CausalEngine.compare(baseline, lesionDNp01);

    expect(comp.behavioralEffect.outcomeChanged).toBe(true);
    expect(comp.firstDivergenceMs).toBeGreaterThan(0);
    expect(comp.firstDivergenceMs).toBeLessThanOrEqual(50);
    expect(comp.strongestDifferential?.population).toBe('DNp01');
  });

  it('generates a factual, scientifically honest mechanistic report', () => {
    const baseline = CausalEngine.runTrajectory();
    const counterfactual = CausalEngine.runTrajectory({
      interventions: [{ targetNode: 'DNp01', type: 'silence', intensity: 1.0 }],
    });

    const comp = CausalEngine.compare(baseline, counterfactual);
    const report = CausalEngine.generateMechanisticReport(comp, [
      { targetNode: 'DNp01', type: 'silence', intensity: 1.0 },
    ]);

    expect(report).toContain('COMPUTATIONAL COUNTERFACTUAL');
    expect(report).toContain('Under this simulation and intervention model');
    expect(report).not.toContain('proves DNp01 causes escape in real flies');
  });
});
