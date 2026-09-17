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
  strategyUsed: 'delta_debugging' | 'bfs_search';
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
