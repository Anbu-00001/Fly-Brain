import { describe, it, expect } from 'vitest';
import { isLineOfSightOccluded, calculateEffectiveLoomFlux, Obstacle3D } from '../src/engine/shared/Metrics';

describe('3D Arena Kinematics & Obstacle Occlusion', () => {
  const pillar: Obstacle3D = { x: 0, z: 0, radius: 15, height: 40 };

  it('detects when an obstacle directly blocks line of sight', () => {
    // Fly at (-50, 0), predator at (50, 0), obstacle at (0, 0)
    const occluded = isLineOfSightOccluded(-50, 0, 50, 0, pillar);
    expect(occluded).toBe(true);
  });

  it('detects when predator and fly have clear line of sight around obstacle', () => {
    // Fly at (-50, 30), predator at (50, 30), obstacle at (0, 0)
    const occluded = isLineOfSightOccluded(-50, 30, 50, 30, pillar);
    expect(occluded).toBe(false);
  });

  it('does not occlude if obstacle is behind predator or behind fly', () => {
    // Obstacle at (0, 0). Fly at (20, 0), predator at (50, 0).
    const occluded = isLineOfSightOccluded(20, 0, 50, 0, pillar);
    expect(occluded).toBe(false);
  });

  it('attenuates looming optical flux when occluded', () => {
    const rawFlux = 0.85;
    const attenuated = calculateEffectiveLoomFlux(rawFlux, true, 0.2);
    expect(attenuated).toBeCloseTo(0.17, 3);

    const unattenuated = calculateEffectiveLoomFlux(rawFlux, false, 0.2);
    expect(unattenuated).toBe(0.85);
  });
});
