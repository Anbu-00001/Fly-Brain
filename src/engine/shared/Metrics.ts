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
