/**
 * BreakpointsAndCQL.test.ts
 *
 * Unit tests for GDB breakpoint evaluation, Circuit Query Language (CQL),
 * and Connectome Git experiment branching.
 */

import { describe, it, expect } from 'vitest';
import { BreakpointManager } from '../src/engine/causality/BreakpointManager';
import { CircuitQueryLanguage } from '../src/engine/causality/CircuitQueryLanguage';
import { ExperimentGraph } from '../src/engine/causality/ExperimentGraph';
import { CausalEngine } from '../src/engine/causality/CausalEngine';

describe('Breakpoints, CQL, and Experiment Graph', () => {
  it('BreakpointManager detects spike triggers and pauses execution', () => {
    let hitFired = false;
    let hitNode = '';

    const mgr = new BreakpointManager((ev) => {
      hitFired = true;
      hitNode = ev.targetNode || '';
    });

    mgr.addRule({
      id: 'test_dnp01',
      name: 'Break on DNp01',
      type: 'spike',
      targetNode: 'DNp01',
      threshold: 0,
      enabled: true,
    });

    const trajectory = CausalEngine.runTrajectory();
    for (let i = 0; i < trajectory.samples.length; i++) {
      const sample = trajectory.samples[i];
      const paused = mgr.evaluateSample(sample, i);
      if (paused) break;
    }

    expect(hitFired).toBe(true);
    expect(hitNode).toBe('DNp01');
    expect(mgr.getIsPaused()).toBe(true);
  });

  it('CQL correctly parses WHAT_IF, CAUSES, PATH, and BREAK WHEN queries', () => {
    const ast1 = CircuitQueryLanguage.parse('WHAT_IF SILENCE DNp01');
    expect(ast1.queryType).toBe('WHAT_IF');
    expect(ast1.targetNode).toBe('DNp01');
    expect(ast1.interventionType).toBe('silence');

    const ast2 = CircuitQueryLanguage.parse('CAUSES prevent_escape');
    expect(ast2.queryType).toBe('CAUSES');
    expect(ast2.condition).toBe('prevent_escape');

    const ast3 = CircuitQueryLanguage.parse('PATH LC4 -> MOTOR');
    expect(ast3.queryType).toBe('PATH');
    expect(ast3.targetNode).toBe('LC4');
    expect(ast3.compareWith).toBe('MOTOR');

    const ast4 = CircuitQueryLanguage.parse('BREAK WHEN DNp01 > 0.8');
    expect(ast4.queryType).toBe('BREAK_WHEN');
    expect(ast4.targetNode).toBe('DNp01');
    expect(ast4.threshold).toBe(0.8);
  });

  it('CQL executes WHAT_IF queries and returns counterfactual data', () => {
    const res = CircuitQueryLanguage.execute('WHAT_IF SILENCE DNp01');
    expect(res.success).toBe(true);
    expect(res.data?.comparison).toBeDefined();
    expect(res.data?.report).toContain('COUNTERFACTUAL EXPERIMENT REPORT');
  });

  it('ExperimentGraph branches counterfactuals and computes diffs', () => {
    const git = new ExperimentGraph();
    const rootId = git.getRootId();

    expect(rootId).toBe('EXP-001');

    const childNode = git.branch(rootId, 'DNp01 Lesion Branch', [
      { targetNode: 'DNp01', type: 'silence', intensity: 1.0 },
    ]);

    expect(childNode.id).toBe('EXP-002');
    expect(childNode.parentId).toBe('EXP-001');

    const diff = git.diff(rootId, childNode.id);
    expect(diff.behavioralEffect.outcomeChanged).toBe(true);
    expect(diff.firstDivergenceMs).toBeDefined();
  });
});
