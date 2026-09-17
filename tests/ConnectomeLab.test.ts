/**
 * ConnectomeLab.test.ts
 *
 * Unit tests for Connectome Lab:
 * - Neural cascade propagation & domino graph traversal
 * - Intervention state & challenge verification
 * - URL hash sharing serialization
 */

import { describe, it, expect } from 'vitest';
import {
  getDownstreamCascade,
  calculateDominoMetrics,
  validateChallengeOutcome,
  encodeLabExperimentHash,
  decodeLabExperimentHash,
} from '../src/engine/shared/CircuitGraph';

describe('Connectome Lab Circuit Graph & Cascade Traversal', () => {
  it('correctly maps downstream cascade from LC4 looming detector to Giant Fiber and VNC', () => {
    const cascade = getDownstreamCascade('LC4');
    const nodeIds = cascade.map((c) => c.nodeId);

    expect(nodeIds).toContain('LC4');
    expect(nodeIds).toContain('DNp01');
    expect(nodeIds).toContain('VNC_CPG');
  });

  it('correctly traces full sensory visual cascade from photoreceptors to motor jump', () => {
    const cascade = getDownstreamCascade('VIS_R1R6', 5);
    const nodeIds = cascade.map((c) => c.nodeId);

    expect(nodeIds).toContain('VIS_R1R6');
    expect(nodeIds).toContain('VIS_ME');
    expect(nodeIds).toContain('LC4');
    expect(nodeIds).toContain('DNp01');
    expect(nodeIds).toContain('VNC_CPG');
  });

  it('calculates domino reachability and latency to motor command', () => {
    const metrics = calculateDominoMetrics('LPLC2');
    expect(metrics.reachesMotor).toBe(true);
    expect(metrics.timeToMotorMs).toBeGreaterThan(0);
    expect(metrics.totalNeurons).toBeGreaterThan(100);
  });

  it('validates Challenge 1: STOP THE ESCAPE when DNp01 is silenced', () => {
    const passed = validateChallengeOutcome('prevent_escape', [
      { type: 'silence', target: 'DNp01', intensity: 0 },
    ]);
    expect(passed).toBe(true);

    const failed = validateChallengeOutcome('prevent_escape', [
      { type: 'silence', target: 'MB_KC', intensity: 0 },
    ]);
    expect(failed).toBe(false);
  });

  it('validates Challenge 2: TRIGGER ESCAPE when Giant Fiber or looming circuit is stimulated', () => {
    const passed = validateChallengeOutcome('trigger_escape', [
      { type: 'stimulate', target: 'DNp01', intensity: 0.8 },
    ]);
    expect(passed).toBe(true);
  });

  it('serializes and deserializes shareable URL hash without backend', () => {
    const experiment = {
      challengeId: 'challenge-01',
      selectedCircuit: 'DNp01',
      interventions: [
        { type: 'silence', target: 'DNp01', intensity: 0 },
        { type: 'stimulate', target: 'LC4', intensity: 0.75 },
      ],
    };

    const hash = encodeLabExperimentHash(experiment);
    expect(hash).toContain('#lab?');
    expect(hash).toContain('challenge-01');

    const decoded = decodeLabExperimentHash(hash);
    expect(decoded.challengeId).toBe('challenge-01');
    expect(decoded.selectedCircuit).toBe('DNp01');
    expect(decoded.interventions.length).toBe(2);
    expect(decoded.interventions[0].target).toBe('DNp01');
    expect(decoded.interventions[0].type).toBe('silence');
  });
});
