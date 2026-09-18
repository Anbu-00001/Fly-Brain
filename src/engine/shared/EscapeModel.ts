/**
 * EscapeModel.ts
 *
 * The escape decision, rebuilt on published looming physiology instead of
 * hand-tuned constants.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The previous build decided the fly's escape with:
 *
 *     escapeTriggered = accumStartle > 25 || accumFlight > 18
 *
 * where accumStartle and accumFlight were sums of five unsourced gain constants
 * over two neuropil groups. Nothing in that expression came from biology, yet the
 * interface presented its output as the fly's neural decision.
 *
 * WHAT THIS IS INSTEAD
 * --------------------
 * Drosophila's giant-fiber (GF/DNp01) escape is driven by two visual projection
 * populations that encode complementary features of a looming object:
 *
 *   LC4   -> angular VELOCITY of expansion, contributing roughly linearly
 *   LPLC2 -> angular SIZE, contributing as a Gaussian peaked near 42 deg
 *
 * Ache et al. (2019) show that summing a linear function of angular velocity with
 * a Gaussian function of angular size reproduces GF looming-response dynamics and
 * predicts the peak response time. That sum is the model implemented here.
 *
 * WHAT THIS IS NOT — READ BEFORE TRUSTING THE OUTPUT
 * --------------------------------------------------
 * ENGINE-LIVE's dataset (FlyWire FAFB v783, rolled into 63 neuropil groups) does
 * NOT resolve LC4, LPLC2 or DNp01 as addressable populations. We verified this
 * against public/data/neuron_meta.json: those labels are absent. Therefore:
 *
 *   - This module is a MODELLED READOUT, not a measurement of LC4/LPLC2/DNp01.
 *   - It is driven by stimulus geometry plus the live engine's coarse lobula
 *     activity (VIS_LO, VIS_LPTC), which ARE real groups in that dataset.
 *   - Every quantity it returns is tagged `modeled`, `published` or `invented`.
 *     None is tagged `measured`. That is deliberate and must stay true.
 *
 * ENGINE-RECORDED (MaleCNS v1.0) *does* resolve LC4/LPLC2/DNp01, which is exactly
 * why Brain Surgery's lesion comparisons run there and not here.
 *
 * DIRECTIONALITY IS AUTHORED, NOT NEURAL
 * --------------------------------------
 * The live dataset's groups are not lateralised — there is no left/right split to
 * read. The previous build hid this by computing left and right motor drive with
 * identical formulas, so the connectome contributed exactly zero directional
 * information while the interface implied it steered the fly. We do not repeat
 * that. Escape direction is computed from stimulus geometry and labelled
 * `invented`, because that is what it is.
 */

import { Quantity, published, modeled, invented, derived } from './Provenance';

/* ---------- citations, kept as data so the UI can render them ---------- */

export const CITATIONS = {
  vonReyn2014:
    'von Reyn, C.R. et al. "A spike-timing mechanism for action selection." ' +
    'Nature Neuroscience 17, 962–970 (2014). doi:10.1038/nn.3741',
  ache2019:
    'Ache, J.M. et al. "Neural Basis for Looming Size and Velocity Encoding in the ' +
    'Drosophila Giant Fiber Escape Pathway." Current Biology 29, 1073–1081 (2019). ' +
    'doi:10.1016/j.cub.2019.01.079',
  klapoetke2017:
    'Klapoetke, N.C. et al. "Ultra-selective looming detection from radial motion ' +
    'opponency." Nature 551, 237–241 (2017). doi:10.1038/nature24626',
} as const;

/* ---------- published constants ---------- */

/**
 * Angular size at which GF-mediated takeoffs become likely. von Reyn et al. (2014)
 * estimate a ~39 deg size threshold; Ache et al. (2019) fit a Gaussian peaking at
 * 42 deg, "very close to the 39 deg size threshold estimated previously".
 */
export const GF_SIZE_THRESHOLD_DEG = 39;
export const LPLC2_GAUSSIAN_PEAK_DEG = 42;

/**
 * Width of the LPLC2 size tuning. Ache et al. report the Gaussian's peak but the
 * width we use here is a fitting choice, not a published figure — it is tagged
 * `modeled` wherever it surfaces, never `published`.
 */
export const LPLC2_GAUSSIAN_SIGMA_DEG = 14;

/** Anatomy of the LC4/LPLC2 -> GF convergence (Ache et al. 2019). */
export const GF_INPUT_ANATOMY = {
  lc4Neurons: 55,
  lplc2Neurons: 108,
  lc4Synapses: 2442,
  lplc2Synapses: 1366,
} as const;

/* ---------- channel responses ---------- */

/** LPLC2: Gaussian tuning on angular size. Returns 0..1. */
export function lplc2SizeResponse(thetaDeg: number): number {
  const z = (thetaDeg - LPLC2_GAUSSIAN_PEAK_DEG) / LPLC2_GAUSSIAN_SIGMA_DEG;
  return Math.exp(-0.5 * z * z);
}

/**
 * LC4: approximately linear in angular expansion velocity. Returns 0..1.
 * `saturationDegPerS` is a normalisation choice so the channel is comparable to
 * the size channel; it is a modelling parameter, not a published constant.
 */
export const LC4_SATURATION_DEG_PER_S = 180;

export function lc4VelocityResponse(dThetaDtDegPerS: number): number {
  if (dThetaDtDegPerS <= 0) return 0; // receding objects do not drive escape
  return Math.min(1, dThetaDtDegPerS / LC4_SATURATION_DEG_PER_S);
}

/* ---------- the decision ---------- */

export interface EscapeInput {
  /** Subtended angular size of the predator, radians. */
  thetaRad: number;
  /** d(theta)/dt, radians per second. */
  expansionRateRadPerS: number;
  /**
   * Normalised 0..1 lobula activity actually measured from ENGINE-LIVE this tick
   * (VIS_LO + VIS_LPTC spike fraction). Gates the model: the decision may only
   * fire while the live visual system is genuinely responding.
   */
  lobulaActivity: number;
}

export interface EscapeDecision {
  /** Combined drive, 0..1. */
  drive: number;
  /** True when the model calls for a giant-fiber-style short-mode takeoff. */
  triggered: boolean;
  /** Per-channel breakdown, for the explorable-explanation panel. */
  sizeChannel: number;
  velocityChannel: number;
  /** Angular size in degrees — the quantity the published threshold refers to. */
  thetaDeg: number;
}

/**
 * Relative weighting of the two channels. Ache et al. describe the GF response as
 * a sum of the two; the exact mixing weight is ours.
 */
export const CHANNEL_MIX = { size: 0.6, velocity: 0.4 } as const;

/**
 * Drive required to trigger. The published threshold is expressed in angular size
 * (39 deg), which the size channel encodes; we additionally require live lobula
 * activity so the decision cannot fire from geometry alone.
 */
export const TRIGGER_DRIVE = 0.5;
export const MIN_LOBULA_ACTIVITY = 0.02;

export function computeEscapeDecision(input: EscapeInput): EscapeDecision {
  const thetaDeg = (input.thetaRad * 180) / Math.PI;
  const dThetaDtDegPerS = (input.expansionRateRadPerS * 180) / Math.PI;

  const sizeChannel = lplc2SizeResponse(thetaDeg);
  const velocityChannel = lc4VelocityResponse(dThetaDtDegPerS);

  const raw = CHANNEL_MIX.size * sizeChannel + CHANNEL_MIX.velocity * velocityChannel;

  // Gate on genuine live visual activity, and on the published size threshold.
  const gate = input.lobulaActivity >= MIN_LOBULA_ACTIVITY;
  const pastThreshold = thetaDeg >= GF_SIZE_THRESHOLD_DEG;

  return {
    drive: raw,
    triggered: gate && pastThreshold && raw >= TRIGGER_DRIVE,
    sizeChannel,
    velocityChannel,
    thetaDeg,
  };
}

/* ---------- provenance-tagged reporting ---------- */

/** Everything this model puts on screen, each carrying its epistemic status. */
export function describeDecision(d: EscapeDecision, lobulaActivity: number): Quantity<number | string>[] {
  return [
    derived('Angular size', Number(d.thetaDeg.toFixed(1)), '°', 'θ = 2·arctan(R / r)', [
      'predator radius (authored)',
      'predator distance (authored)',
    ]),
    published(
      'GF size threshold',
      GF_SIZE_THRESHOLD_DEG,
      '°',
      CITATIONS.vonReyn2014,
      'Estimated angular size for giant-fiber-mediated takeoff in real flies'
    ),
    modeled(
      'LPLC2 size channel',
      Number(d.sizeChannel.toFixed(3)),
      null,
      'Gaussian tuning on angular size, peak 42°',
      CITATIONS.ache2019
    ),
    modeled(
      'LC4 velocity channel',
      Number(d.velocityChannel.toFixed(3)),
      null,
      'Linear in angular expansion velocity, saturating',
      CITATIONS.ache2019
    ),
    modeled(
      'Escape drive',
      Number(d.drive.toFixed(3)),
      null,
      'Weighted sum of the size and velocity channels',
      CITATIONS.ache2019
    ),
    invented(
      'Escape direction',
      'away from predator bearing',
      null,
      'ENGINE-LIVE groups are not lateralised, so no left/right signal exists to read'
    ),
    derived('Lobula activity gate', Number(lobulaActivity.toFixed(4)), 'fraction', 'VIS_LO + VIS_LPTC spikes / group size', [
      'ENGINE-LIVE groupSpikes',
    ]),
  ];
}
