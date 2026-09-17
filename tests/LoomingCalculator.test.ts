import { describe, it, expect } from 'vitest';
import { LoomingCalculator } from '../src/engine/live/LoomingCalculator';
import { normalizeAngle } from '../src/engine/shared/Metrics';

describe('LoomingCalculator', () => {
  it('computes angular size theta correctly', () => {
    const calc = new LoomingCalculator({ predatorRadiusPx: 50, maxPerceptionDistPx: 400 });
    // Distance 100 px, radius 50 px -> theta = 2 * atan(50/100) = 2 * 0.463648 = ~0.927 rad (~53 deg)
    const res = calc.compute(200, 200, 0, 300, 200, 0.0);
    expect(res.angularLoomRad).toBeCloseTo(2 * Math.atan(50 / 100), 2);
    expect(res.distancePx).toBe(100);
  });

  it('detects approaching expansion vs receding retreat', () => {
    const calc = new LoomingCalculator();
    // Step 1: at distance 200
    calc.compute(0, 0, 0, 200, 0, 0.0);
    // Step 2: predator closes in to 100 at t = 0.1s
    const approach = calc.compute(0, 0, 0, 100, 0, 0.1);
    expect(approach.expansionRate).toBeGreaterThan(0);

    // Step 3: predator retreats to 150 at t = 0.2s
    const retreat = calc.compute(0, 0, 0, 150, 0, 0.2);
    expect(retreat.expansionRate).toBe(0);
  });

  it('correctly splits receptive fields across left and right eye', () => {
    const calc = new LoomingCalculator();
    // Fly facing positive X (heading = 0)
    // Predator on fly's left (X = 100, Y = 180, fly at X = 100, Y = 100 -> angle to pred is +PI/2, left side)
    calc.compute(100, 100, 0, 100, 180, 0.0);
    const leftThreat = calc.compute(100, 100, 0, 100, 140, 0.05);
    expect(leftThreat.leftEyeIntensity).toBeGreaterThan(leftThreat.rightEyeIntensity);

    // Now predator on fly's right (X = 100, Y = 20 -> angle is -PI/2)
    calc.reset();
    calc.compute(100, 100, 0, 100, 20, 0.0);
    const rightThreat = calc.compute(100, 100, 0, 100, 60, 0.05);
    expect(rightThreat.rightEyeIntensity).toBeGreaterThan(rightThreat.leftEyeIntensity);
  });

  it('normalizes angles within [-PI, PI]', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 4);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI, 4);
    expect(normalizeAngle(0)).toBe(0);
  });
});
