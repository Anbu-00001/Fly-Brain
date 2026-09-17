/**
 * ConnectomeTypes.ts
 *
 * Strict types for Drosophila connectome engines:
 * - ENGINE-LIVE: FlyWire FAFB v783 (139,255 neurons, ~2.7M edges)
 * - ENGINE-RECORDED: MaleCNS v1.0 (166,700 neurons, ~25.6M edges)
 *
 * Sourced strictly from upstream data. No fabricated cell types or region counts.
 */

export type EngineMode = 'LIVE' | 'RECORDED';

export type MacroRegion = 'sensory' | 'central' | 'drives' | 'motor';

export interface EngineMetadata {
  mode: EngineMode;
  name: string;
  datasetName: string;
  totalNeurons: number;
  totalEdges: number;
  citation: string;
  license: string;
  coverage: string;
}

export const LIVE_ENGINE_METADATA: EngineMetadata = {
  mode: 'LIVE',
  name: 'ENGINE-LIVE',
  datasetName: 'FlyWire FAFB v783',
  totalNeurons: 139255,
  totalEdges: 2698236,
  citation: 'Dorkenwald et al. Nature 634, 124–138 (2024)',
  license: 'MIT (code) / FlyWire Codex (data)',
  coverage: 'Adult female brain',
};

export const RECORDED_ENGINE_METADATA: EngineMetadata = {
  mode: 'RECORDED',
  name: 'ENGINE-RECORDED',
  datasetName: 'MaleCNS v1.0',
  totalNeurons: 166700,
  totalEdges: 25582938,
  citation: 'Berg et al. Cell (2026)',
  license: 'MIT (code) / CC BY 4.0 (data)',
  coverage: 'Adult male central nervous system (brain + optic lobes + VNC)',
};

/**
 * Receptive field light gradient distribution across the compound eye
 */
export interface ReceptiveFieldGradient {
  leftEyeIntensity: number;   // 0.0 - 1.0
  rightEyeIntensity: number;  // 0.0 - 1.0
  anteriorIntensity: number;  // 0.0 - 1.0 (frontal)
  posteriorIntensity: number; // 0.0 - 1.0 (rear)
  angularLoomRad: number;     // Subtended visual angle theta
  expansionRate: number;      // d(theta)/dt (rad/s)
  bearingRad: number;         // Relative predator angle (-PI to +PI)
  distancePx: number;         // Euclidean distance
}

/**
 * Tick metrics payload received from simulation
 */
export interface SimulationTickData {
  tickCount: number;
  firedCount: number;
  activeNeurons: number;
  regionalFired: {
    sensory: number;
    central: number;
    drives: number;
    motor: number;
  };
  groupSpikes: Record<string, number>;
  dtMs: number;
  escapeCommandFired: boolean;
}

/**
 * Deterministic input log entry for byte-for-byte replay
 */
export interface InputLogSample {
  t: number;      // timestamp in seconds (fixed step)
  mouseX: number;
  mouseY: number;
  threatActive: boolean;
}

export interface ReplayLog {
  version: 1;
  engine: EngineMode;
  dataset: string;
  neuronCount: number;
  seed: number;
  arenaWidth: number;
  arenaHeight: number;
  initialFly: { x: number; y: number; heading: number };
  samples: InputLogSample[];
  summary?: {
    escaped: boolean;
    survivalTimeS: number;
    firstJumpLatencyMs: number | null;
    totalSpikes: number;
  };
}
