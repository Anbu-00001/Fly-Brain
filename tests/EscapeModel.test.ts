/**
 * EscapeModel.test.ts
 *
 * Locks down the escape decision against the published physiology it claims to
 * implement. The build these tests replace decided escape with
 * `accumStartle > 25 || accumFlight > 18` and had no test at all, so nothing
 * objected when the thresholds drifted or when the channels stopped meaning
 * anything.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEscapeDecision,
  lplc2SizeResponse,
  lc4VelocityResponse,
  describeDecision,
  GF_SIZE_THRESHOLD_DEG,
  LPLC2_GAUSSIAN_PEAK_DEG,
  LC4_SATURATION_DEG_PER_S,
  MIN_LOBULA_ACTIVITY,
} from '../src/engine/shared/EscapeModel';

const deg = (d: number) => (d * Math.PI) / 180;

describe('LPLC2 size channel', () => {
  it('peaks at the published 42 deg Gaussian centre', () => {
    const atPeak = lplc2SizeResponse(LPLC2_GAUSSIAN_PEAK_DEG);
    expect(atPeak).toBeCloseTo(1.0, 6);
    // Strictly lower on both sides -- it is a tuning curve, not a step.
    expect(lplc2SizeResponse(LPLC2_GAUSSIAN_PEAK_DEG - 20)).toBeLessThan(atPeak);
    expect(lplc2SizeResponse(LPLC2_GAUSSIAN_PEAK_DEG + 20)).toBeLessThan(atPeak);
  });

  it('is symmetric about the peak', () => {
    const lo = lplc2SizeResponse(LPLC2_GAUSSIAN_PEAK_DEG - 11);
    const hi = lplc2SizeResponse(LPLC2_GAUSSIAN_PEAK_DEG + 11);
    expect(lo).toBeCloseTo(hi, 10);
  });
});

describe('LC4 velocity channel', () => {
  it('is zero for a receding object', () => {
    expect(lc4VelocityResponse(-50)).toBe(0);
    expect(lc4VelocityResponse(0)).toBe(0);
  });

  it('rises monotonically with expansion velocity, then saturates at 1', () => {
    const a = lc4VelocityResponse(30);
    const b = lc4VelocityResponse(90);
    expect(b).toBeGreaterThan(a);
    expect(lc4VelocityResponse(LC4_SATURATION_DEG_PER_S * 4)).toBe(1);
  });
});

describe('escape decision', () => {
  const fastApproach = deg(400); // rad/s, well past saturation

  it('does not trigger below the published 39 deg size threshold', () => {
    const d = computeEscapeDecision({
      thetaRad: deg(GF_SIZE_THRESHOLD_DEG - 5),
      expansionRateRadPerS: fastApproach,
      lobulaActivity: 0.5,
    });
    expect(d.thetaDeg).toBeLessThan(GF_SIZE_THRESHOLD_DEG);
    expect(d.triggered).toBe(false);
  });

  it('triggers at the Gaussian peak with strong expansion and live activity', () => {
    const d = computeEscapeDecision({
      thetaRad: deg(LPLC2_GAUSSIAN_PEAK_DEG),
      expansionRateRadPerS: fastApproach,
      lobulaActivity: 0.5,
    });
    expect(d.triggered).toBe(true);
    expect(d.sizeChannel).toBeCloseTo(1.0, 3);
    expect(d.velocityChannel).toBe(1);
  });

  it('cannot trigger from geometry alone when the live engine is silent', () => {
    // This is the guard that keeps the model honest: a perfect stimulus with no
    // measured lobula response must not produce an escape.
    const d = computeEscapeDecision({
      thetaRad: deg(LPLC2_GAUSSIAN_PEAK_DEG),
      expansionRateRadPerS: fastApproach,
      lobulaActivity: MIN_LOBULA_ACTIVITY / 2,
    });
    expect(d.triggered).toBe(false);
  });

  it('is deterministic — identical input gives identical output', () => {
    const input = { thetaRad: deg(41), expansionRateRadPerS: deg(120), lobulaActivity: 0.3 };
    expect(computeEscapeDecision(input)).toEqual(computeEscapeDecision(input));
  });
});

describe('provenance discipline', () => {
  it('never labels any part of the escape decision as measured', () => {
    // The live engine cannot resolve LC4/LPLC2/DNp01, so nothing this model
    // produces may claim to be a measurement of them. If someone later tags one
    // of these `measured`, this test is the thing that should stop them.
    const d = computeEscapeDecision({
      thetaRad: deg(42),
      expansionRateRadPerS: deg(200),
      lobulaActivity: 0.4,
    });
    const kinds = describeDecision(d, 0.4).map((q) => q.provenance.kind);
    expect(kinds).not.toContain('measured');
    expect(kinds).toContain('published');
    expect(kinds).toContain('modeled');
    expect(kinds).toContain('invented');
  });

  it('attributes escape direction to the project, not to the connectome', () => {
    const d = computeEscapeDecision({ thetaRad: deg(42), expansionRateRadPerS: deg(200), lobulaActivity: 0.4 });
    const dir = describeDecision(d, 0.4).find((q) => q.label === 'Escape direction');
    expect(dir?.provenance.kind).toBe('invented');
  });
});
