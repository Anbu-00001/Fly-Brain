/**
 * LoomingCalculator.ts
 *
 * Implements biophysically grounded looming predator stimulus computation.
 * Based on Drosophila escape biology (Gabbiani et al., 1999, 2002; von Reyn et al., 2014):
 * - Visual angle: theta(t) = 2 * arctan(R / r(t))
 * - Angular expansion rate: d(theta)/dt
 * - Looming detector activation: product/linear combo of theta and d(theta)/dt
 * - Retinotopic spatial gradient: splits stimulus across compound eye hemifields
 *   (left eye, right eye, frontal binocular overlap, posterior)
 */

import { ReceptiveFieldGradient } from '../shared/ConnectomeTypes';
import { normalizeAngle, clamp, euclideanDistance } from '../shared/Metrics';

export interface LoomingParams {
  predatorRadiusPx: number;  // Half-size of the approaching predator
  maxPerceptionDistPx: number; // Distance beyond which the fly does not resolve the threat
  loomGain: number;          // Gain for converting angular expansion to neural stimulus
}

export const DEFAULT_LOOM_PARAMS: LoomingParams = {
  predatorRadiusPx: 45,
  maxPerceptionDistPx: 380,
  loomGain: 1.6,
};

export class LoomingCalculator {
  private params: LoomingParams;
  private prevDistance: number | null = null;
  private prevTimeS: number | null = null;
  private prevThetaRad: number = 0;

  constructor(params: Partial<LoomingParams> = {}) {
    this.params = { ...DEFAULT_LOOM_PARAMS, ...params };
  }

  public reset(): void {
    this.prevDistance = null;
    this.prevTimeS = null;
    this.prevThetaRad = 0;
  }

  /**
   * Calculates the looming stimulus and retinotopic receptive field light gradients.
   *
   * @param flyX Current fly X position in arena pixels
   * @param flyY Current fly Y position in arena pixels
   * @param flyHeading Current fly heading in radians (0 = facing positive X)
   * @param predX Current predator X position
   * @param predY Current predator Y position
   * @param currentTimeS Current time in seconds
   */
  public compute(
    flyX: number,
    flyY: number,
    flyHeading: number,
    predX: number,
    predY: number,
    currentTimeS: number
  ): ReceptiveFieldGradient {
    const dist = euclideanDistance(flyX, flyY, predX, predY);
    const R = this.params.predatorRadiusPx;

    // Subtended visual angle theta (radians)
    // Clamped distance to avoid division by zero
    const effectiveDist = Math.max(R * 0.75, dist);
    const theta = 2 * Math.atan(R / effectiveDist);

    // Compute angular expansion velocity d(theta)/dt
    let expansionRate = 0;
    if (this.prevTimeS !== null && this.prevDistance !== null) {
      const dt = currentTimeS - this.prevTimeS;
      if (dt > 0.0001) {
        // Approaching velocity v = -dr/dt
        const radialVel = (this.prevDistance - dist) / dt;
        if (radialVel > 0) {
          // Analytical derivative of 2 * atan(R/r) w.r.t r is -2*R / (r^2 + R^2)
          expansionRate = (2 * R * radialVel) / (effectiveDist * effectiveDist + R * R);
        } else {
          expansionRate = 0; // retreating
        }
      }
    }

    this.prevDistance = dist;
    this.prevTimeS = currentTimeS;
    this.prevThetaRad = theta;

    // Relative bearing to predator from fly's perspective
    // Angle in arena coordinates
    const worldAngleToPred = Math.atan2(predY - flyY, predX - flyX);
    // Relative angle: 0 = directly ahead, >0 = to the left, <0 = to the right, +/- PI = behind
    const bearing = normalizeAngle(worldAngleToPred - flyHeading);

    // If beyond perception distance, intensities decay smoothly to 0
    const distanceAttenuation = clamp(1.0 - dist / this.params.maxPerceptionDistPx, 0, 1);

    // Looming threat intensity = angular size combined with expansion rate
    // Classic LC4/LPLC2 model: combination of size threshold + expansion threshold
    const loomActivation = (theta * 0.4 + expansionRate * 1.2) * this.params.loomGain * distanceAttenuation;
    const baseIntensity = clamp(loomActivation, 0, 1);

    // Retinotopic distribution across compound eyes:
    // Left eye receptive field centered around +PI/3 (+60 deg)
    // Right eye receptive field centered around -PI/3 (-60 deg)
    // Anterior (frontal) centered around 0 deg (binocular zone)
    // Posterior centered around +/- PI (dorsal/rear blind spot or low sensitivity)

    // Receptive field cosine weightings (half-wave rectified)
    const leftCos = Math.sin(bearing);   // > 0 when predator is on left (bearing in (0, PI))
    const rightCos = -Math.sin(bearing); // > 0 when predator is on right (bearing in (-PI, 0))
    const frontCos = Math.cos(bearing);  // > 0 when predator is in front (bearing in (-PI/2, PI/2))

    // Calculate eye-specific intensities with contrast gradient
    const leftWeight = clamp(leftCos * 0.75 + frontCos * 0.45, 0, 1);
    const rightWeight = clamp(rightCos * 0.75 + frontCos * 0.45, 0, 1);
    const anteriorWeight = clamp(frontCos, 0, 1);
    const posteriorWeight = clamp(-frontCos, 0, 1);

    return {
      leftEyeIntensity: clamp(baseIntensity * leftWeight, 0, 1),
      rightEyeIntensity: clamp(baseIntensity * rightWeight, 0, 1),
      anteriorIntensity: clamp(baseIntensity * anteriorWeight, 0, 1),
      posteriorIntensity: clamp(baseIntensity * posteriorWeight * 0.4, 0, 1),
      angularLoomRad: theta,
      expansionRate: expansionRate,
      bearingRad: bearing,
      distancePx: dist,
    };
  }
}
