/**
 * Metrics.ts
 *
 * Pure metric and calculation utilities.
 * Sourced and deterministic.
 */

export function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes rolling average spike rate (Hz) across a history window
 */
export function computeSpikeRate(spikes: number[], windowDurationS: number, totalNeurons: number): number {
  if (windowDurationS <= 0 || spikes.length === 0) return 0;
  const total = spikes.reduce((sum, n) => sum + n, 0);
  return total / (windowDurationS * (totalNeurons / 1000)); // normalized spikes per 1k neurons per sec
}

/**
 * Computes reaction latency from the moment looming threshold is exceeded
 * to the moment of escape command firing.
 */
export function computeLatencyMs(threatStartTimeMs: number, escapeTimeMs: number | null): number | null {
  if (escapeTimeMs === null || escapeTimeMs < threatStartTimeMs) return null;
  return Math.round(escapeTimeMs - threatStartTimeMs);
}

export interface Obstacle3D {
  x: number;
  z: number;
  radius: number;
  height: number;
}

/**
 * Computes whether an obstacle occludes direct line of sight from predator to fly.
 */
export function isLineOfSightOccluded(
  flyX: number,
  flyZ: number,
  predX: number,
  predZ: number,
  obstacle: Obstacle3D
): boolean {
  const dx = predX - flyX;
  const dz = predZ - flyZ;
  const lineDist = Math.hypot(dx, dz);
  if (lineDist < 1e-6) return false;

  const fx = obstacle.x - flyX;
  const fz = obstacle.z - flyZ;

  const t = (fx * dx + fz * dz) / (lineDist * lineDist);
  if (t <= 0 || t >= 1) return false;

  const closestX = flyX + t * dx;
  const closestZ = flyZ + t * dz;

  const distToCenter = Math.hypot(obstacle.x - closestX, obstacle.z - closestZ);
  return distToCenter < obstacle.radius;
}

/**
 * Calculates compound eye aspect intensity modulation:
 * When obstacle blocks line of sight, looming flux is attenuated.
 */
export function calculateEffectiveLoomFlux(
  rawLoomIntensity: number,
  isOccluded: boolean,
  occlusionAttenuationFactor: number = 0.15
): number {
  return isOccluded ? rawLoomIntensity * occlusionAttenuationFactor : rawLoomIntensity;
}

