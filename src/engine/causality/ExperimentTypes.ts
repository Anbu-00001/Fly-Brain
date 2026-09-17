/**
 * ExperimentTypes.ts
 *
 * Ground-truth types and data contracts for FLYBRAIN: CAUSALITY ENGINE.
 * Defines experiments, neural trajectories, counterfactual comparisons,
 * minimal causal search, Delta Debugging, GDB breakpoints, CQL AST, and Causal Atlas.
 */

export type CausalTargetObjective =
  | 'prevent_escape'
  | 'trigger_escape'
  | 'delay_escape'
  | 'reverse_direction'
  | 'suppress_visual_preserve_motor'
  | 'maximize_startle'
  | 'minimize_activation';

export type InterventionType = 'silence' | 'stimulate' | 'invert' | 'amplify';

export interface InterventionDef {
  targetNode: string; // ID from DROSOPHILA_CIRCUIT_NODES (e.g. 'DNp01', 'LC4')
  type: InterventionType;
  intensity: number; // e.g. 1.0 (default), 2.0 (amplify), -1.0 (invert)
  startMs?: number;
  durationMs?: number;
}

export interface PopulationSample {
  tMs: number;
  nodeSpikes: Record<string, number>;
  nodeVoltages: Record<string, number>;
  totalFired: number;
  motorOutput: number;
  isEscaped: boolean;
}

export interface ExperimentSummary {
  escaped: boolean;
  firstJumpLatencyMs: number | null;
  totalSpikes: number;
  peakMotor: number;
  headingRad: number;
}

export interface ExperimentTrajectory {
  id: string;
  name: string;
  seed: number;
  engine: 'LIVE' | 'RECORDED';
  dataset: string;
  stimulusType: 'canonical_looming' | 'resting' | 'lateral_looming';
  interventions: InterventionDef[];
  samples: PopulationSample[];
  summary: ExperimentSummary;
  timestamp: string;
}

export interface CounterfactualComparison {
  baselineId: string;
  counterfactualId: string;
  firstDivergenceMs: number | null;
  earliestAffectedPopulation: string | null;
  strongestDifferential: {
    population: string;
    deltaPct: number;
    baselineRate: number;
    counterfactualRate: number;
  } | null;
  deltaTrajectories: Record<string, number[]>; // population -> array of (A - B)
  timePointsMs: number[];
  behavioralEffect: {
    baselineEscaped: boolean;
    counterfactualEscaped: boolean;
    baselineLatencyMs: number | null;
    counterfactualLatencyMs: number | null;
    outcomeChanged: boolean;
    description: string;
  };
}

export interface MinimalInterventionSolution {
  interventions: InterventionDef[];
  totalNeuronsAffected: number;
  latencyToDivergenceMs: number;
  costScore: number;
  success: boolean;
  explanation: string;
}

export interface ParetoFrontierPoint {
  solution: MinimalInterventionSolution;
  neuronCost: number;
  interventionCount: number;
  behavioralEffectiveness: number; // 0.0 to 1.0
}

export interface CausalSearchResult {
  objective: CausalTargetObjective;
  minimalSolution: MinimalInterventionSolution;
  alternativeSolutions: MinimalInterventionSolution[];
  paretoFrontier: ParetoFrontierPoint[];
  evaluationsCount: number;
  searchDurationMs: number;
  strategyUsed: 'delta_debugging' | 'bfs_search' | 'beam_search' | 'genetic' | 'adaptive';
}

export type CausalClassification = 'NECESSARY' | 'SUFFICIENT' | 'BOTH' | 'NEITHER';

export interface CausalMatrixRow {
  nodeId: string;
  name: string;
  neuropil: string;
  neuronCount: number;
  isNecessary: boolean;
  isSufficient: boolean;
  effectLatencyMs: number | null;
  classification: CausalClassification;
  citation: string;
}

export interface BreakpointRule {
  id: string;
  name: string;
  type: 'spike' | 'threshold' | 'delta' | 'compound';
  targetNode?: string;
  threshold?: number;
  operator?: '>' | '>=' | '==' | '<';
  condition?: string;
  enabled: boolean;
}

export interface BreakpointHitEvent {
  ruleId: string;
  ruleName: string;
  tMs: number;
  targetNode?: string;
  currentValue: number;
  threshold: number;
}

export interface CqlAst {
  queryType: 'WHAT_IF' | 'COMPARE' | 'CAUSES' | 'PATH' | 'DOWNSTREAM' | 'BREAK_WHEN';
  rawQuery: string;
  targetNode?: string;
  interventionType?: InterventionType;
  factor?: number;
  compareWith?: string;
  depth?: number;
  condition?: string;
  threshold?: number;
}

export interface ExperimentNode {
  id: string;
  parentId: string | null;
  name: string;
  interventions: InterventionDef[];
  summary: ExperimentSummary;
  timestamp: string;
  children: string[];
}

/* ==========================================================================
   NEURAL REALITY ENGINE DATA CONTRACTS (PROVENANCE & HARDWARE KERNEL)
   ========================================================================== */

export interface ProvenanceRecord {
  sourceEngine: 'ENGINE-LIVE' | 'ENGINE-RECORDED' | 'CROSS-ENGINE';
  executionAuthority: 'WORKER_CONNECTOME_SIMULATION' | 'MALECNS_PRECOMPUTE' | 'EXPERIMENTAL_KERNEL';
  dataset: 'FlyWire FAFB v783' | 'MaleCNS v1.0';
  totalNeurons: number; // 139,255 or 166,700
  totalSynapses: number; // 2,698,236 or 25,600,000
  tick: number;
  timeMs: number;
  populationGroupId: number;
  populationGroupName: string;
  neuronCountInGroup: number;
  rawMetric: {
    activeNeurons: number;
    groupSpikes: number;
    meanVoltage: number;
    motorTakeoffFired: boolean;
  };
  isApproximated: false; // Non-negotiable: strictly false for live execution
  isSynthetic: false;
}

export interface NeuralSnapshotMetadata {
  id: string;
  tickCount: number;
  timeMs: number;
  activeNeuronCount: number;
  cumulativeFiredCount: number;
}

export interface HeadlessExperimentRequest {
  runId: string;
  checkpointId?: string;
  interventions: Array<{
    type: 'silence' | 'invert' | 'amplify' | 'restore' | 'stimulate';
    groupId: number;
    factor?: number;
  }>;
  steps: number;
  recordTrajectory?: boolean;
  runFull?: boolean;
  baselineTrajectory?: any[];
}

export interface HeadlessExperimentResult {
  runId: string;
  checkpointId?: string;
  interventions: Array<{
    type: string;
    groupId: number;
    factor?: number;
  }>;
  stepsRun: number;
  takeoffTick: number;
  takeoffTimeMs: number | null;
  escaped: boolean;
  totalMotorSpikes: number;
  firstDivergenceTick: number;
  firstDivergenceMs: number | null;
  trajectory: Array<{
    tick: number;
    timeMs: number;
    firedNeurons: number;
    groupSpikes: Uint16Array;
    motorFired: boolean;
  }>;
}

export interface CrossEngineReport {
  experimentId: string;
  stimulusType: string;
  timestamp: string;
  liveResult: {
    engine: 'ENGINE-LIVE';
    dataset: 'FlyWire FAFB v783';
    neurons: number;
    escaped: boolean;
    firstMotorEventMs: number | null;
    totalMotorSpikes: number;
  };
  recordedResult: {
    engine: 'ENGINE-RECORDED';
    dataset: 'MaleCNS v1.0';
    neurons: number;
    escaped: boolean;
    firstMotorEventMs: number | null;
    totalMotorSpikes: number;
  };
  concordance: {
    behavioralClass: 'CONCORDANT' | 'DISCORDANT';
    latencyDeltaMs: number | null;
    description: string;
  };
}

export interface ReproducibilityManifest {
  manifestVersion: '1.0.0';
  experimentId: string;
  engine: 'LIVE' | 'RECORDED' | 'CROSS-ENGINE';
  dataset: string;
  datasetHash: string;
  seed: number;
  interventions: InterventionDef[];
  takeoffMs: number | null;
  escaped: boolean;
  resultHash: string;
  provenance: ProvenanceRecord;
}

export interface AutonomousDiscoveryReport {
  budgetRequested: number;
  experimentsCompleted: number;
  uniqueInterventionsTested: number;
  behavioralTransitions: number;
  minimalSolutions: MinimalInterventionSolution[];
  robustSolutions: MinimalInterventionSolution[];
  circuitInteractions: string[];
  durationMs: number;
}

export interface PhaseMapPoint {
  leakRate: number;
  threshold: number;
  stimulusSpeed: number;
  outcome: 'ESCAPE' | 'WALK' | 'NO_RESPONSE';
  latencyMs: number | null;
}
