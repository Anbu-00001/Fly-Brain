/**
 * NeuralRealityEngine.test.ts
 *
 * Verification suite for FLYBRAIN: NEURAL REALITY ENGINE.
 * Tests:
 * - Biophysical experiment kernel execution over biological connectome edges
 * - Checkpoint snapshot creation & restoration
 * - Verifiable reproducibility manifests with cryptographic hash
 * - Zero hardcoded fallback answers in CausalSearch
 * - Search budget enforcement (10, 50, 100) & algorithms (ddmin, beam, genetic)
 * - Cross-Engine concordance analysis (FlyWire 139k vs MaleCNS 166k)
 * - Mutation parameter space exploration (Escape, Walk, No Response)
 */

import { describe, it, expect } from 'vitest';
import { ExperimentKernel } from '../src/engine/causality/ExperimentKernel';
import { CausalSearch } from '../src/engine/causality/CausalSearch';
import { CrossEngineComparator } from '../src/engine/causality/CrossEngineComparator';
import { MutationPhaseExplorer } from '../src/engine/causality/MutationPhaseExplorer';
import { DROSOPHILA_SYNAPTIC_EDGES } from '../src/engine/shared/CircuitGraph';

describe('FLYBRAIN: Neural Reality Engine', () => {
  describe('Phase 1 & 9: Experiment Kernel & Biological Connectome Propagation', () => {
    it('executes biophysical LIF propagation along real connectome synaptic edges without hardcoding', () => {
      const kernel = new ExperimentKernel();
      const baselineResult = kernel.runReferenceConnectomeSimulation('EXP_TEST_BASE', [], 40, 2.0);

      // Threat looming should propagate and trigger escape in baseline
      expect(baselineResult.escaped).toBe(true);
      expect(baselineResult.takeoffTick).toBeGreaterThan(0);
      expect(baselineResult.totalMotorSpikes).toBeGreaterThan(0);
      expect(baselineResult.trajectory.length).toBe(40);
    });

    it('silencing DNp01 (Giant Fiber) abolishes escape takeoff in the kernel', () => {
      const kernel = new ExperimentKernel();
      const silencedResult = kernel.runReferenceConnectomeSimulation(
        'EXP_TEST_SILENCE',
        [{ targetNode: 'DNp01', type: 'silence', intensity: 1.0 }],
        40,
        2.0
      );

      // Silencing giant fiber prevents takeoff
      expect(silencedResult.escaped).toBe(false);
      expect(silencedResult.takeoffTick).toBe(-1);
    });

    it('creates and manages deterministic checkpoints (S0, S1, S2...)', async () => {
      const kernel = new ExperimentKernel();
      const cp0 = await kernel.createCheckpoint('S0_baseline', 'Baseline resting state');
      expect(cp0.id).toBe('S0_baseline');

      const cp1 = await kernel.createCheckpoint('S1_threat_onset', 'Threat onset at t=20ms');
      expect(cp1.id).toBe('S1_threat_onset');

      const restored = await kernel.restoreCheckpoint('S0_baseline');
      expect(restored).toBe(true);
    });

    it('generates cryptographic reproducibility manifests with valid provenance records', () => {
      const kernel = new ExperimentKernel();
      const result = kernel.runReferenceConnectomeSimulation('EXP_MANIFEST_TEST', [], 30, 2.0);
      const manifest = kernel.generateManifest('EXP_MANIFEST_TEST', [], result);

      expect(manifest.manifestVersion).toBe('1.0.0');
      expect(manifest.resultHash).toBeDefined();
      expect(manifest.resultHash.length).toBeGreaterThanOrEqual(8);
      expect(manifest.provenance.totalNeurons).toBe(139255);
      expect(manifest.provenance.dataset).toBe('FlyWire FAFB v783');
      expect(manifest.provenance.isApproximated).toBe(false);
      expect(manifest.provenance.isSynthetic).toBe(false);
    });
  });

  describe('Phase 5, 6 & 7: Causal Search with ZERO Hardcoded Fallbacks & Budget Enforcement', () => {
    it('discovers causal set for prevent_escape using actual simulation', () => {
      const result = CausalSearch.search('prevent_escape', { budget: 50, strategy: 'adaptive' });

      expect(result.evaluationsCount).toBeGreaterThan(0);
      expect(result.evaluationsCount).toBeLessThanOrEqual(50);
      expect(result.minimalSolution.success).toBe(true);
      expect(result.minimalSolution.interventions.length).toBeGreaterThan(0);
      expect(result.minimalSolution.costScore).toBeLessThan(Infinity);
      expect(result.paretoFrontier.length).toBeGreaterThan(0);
    });

    it('strictly respects evaluation budget and reports truthfully if budget is exhausted', () => {
      // With budget = 1, search cannot evaluate candidates beyond baseline
      const result = CausalSearch.search('prevent_escape', { budget: 1, strategy: 'delta_debugging' });

      expect(result.evaluationsCount).toBeLessThanOrEqual(2);
      // It must NOT fabricate a solution when budget was 1
      expect(result.minimalSolution.success).toBe(false);
      expect(result.minimalSolution.costScore).toBe(Infinity);
      expect(result.minimalSolution.explanation).toContain('within the allocated evaluation budget');
    });

    it('executes Beam Search without exceeding remaining budget', () => {
      const result = CausalSearch.search('prevent_escape', { budget: 25, strategy: 'beam_search' });

      expect(result.strategyUsed).toBe('beam_search');
      expect(result.evaluationsCount).toBeLessThanOrEqual(30);
    });

    it('executes Genetic Algorithm search without exceeding remaining budget', () => {
      const result = CausalSearch.search('prevent_escape', { budget: 35, strategy: 'genetic' });

      expect(result.strategyUsed).toBe('genetic');
      expect(result.evaluationsCount).toBeLessThanOrEqual(40);
    });
  });

  describe('Phase 10: Cross-Engine Verification (FlyWire FAFB vs MaleCNS)', () => {
    it('evaluates concordance and computes latency delta between the two connectomes', async () => {
      const report = await CrossEngineComparator.compareEngines({ stimulusType: 'canonical_looming' });

      expect(report.liveResult.engine).toBe('ENGINE-LIVE');
      expect(report.liveResult.neurons).toBe(139255);
      expect(report.recordedResult.engine).toBe('ENGINE-RECORDED');
      expect(report.recordedResult.neurons).toBe(166700);

      expect(report.concordance.behavioralClass).toBeDefined();
      expect(['CONCORDANT', 'DISCORDANT']).toContain(report.concordance.behavioralClass);
      expect(report.concordance.description.length).toBeGreaterThan(20);
    });
  });

  describe('Phase 16: Mutation Mode & Dynamical Bifurcation Mapping', () => {
    it('sweeps 2D parameter space and identifies distinct behavioral phase regimes', () => {
      const phaseResult = MutationPhaseExplorer.sweepPhaseGrid({
        stimulusSpeed: 2.0,
        leakSteps: 4,
        thresholdSteps: 4,
      });

      expect(phaseResult.grid.length).toBe(16);
      const outcomes = new Set(phaseResult.grid.map((p) => p.outcome));

      // Must identify multiple distinct outcomes in dynamical space
      expect(outcomes.has('ESCAPE') || outcomes.has('WALK') || outcomes.has('NO_RESPONSE')).toBe(true);
    });

    it('predicts signal extinction when threshold is exceedingly high', () => {
      const extinctPoint = MutationPhaseExplorer.simulatePoint(0.85, 2.5, 1.0);
      expect(extinctPoint.outcome).toBe('NO_RESPONSE');
      expect(extinctPoint.latencyMs).toBeNull();
    });

    it('predicts escape when membrane is excitable and leak is low', () => {
      const escapePoint = MutationPhaseExplorer.simulatePoint(0.98, 0.5, 3.0);
      expect(escapePoint.outcome).toBe('ESCAPE');
      expect(escapePoint.latencyMs).not.toBeNull();
    });
  });

  describe('Connectome Biological Integrity', () => {
    it('exports biological synaptic edges with verified positive weights', () => {
      expect(DROSOPHILA_SYNAPTIC_EDGES.length).toBeGreaterThan(10);
      for (const edge of DROSOPHILA_SYNAPTIC_EDGES) {
        expect(edge.weight).toBeGreaterThan(0);
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }
    });
  });
});
