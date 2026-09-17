/**
 * CausalSearch.test.ts
 *
 * Unit tests for Delta Debugging, minimal intervention search,
 * and the Necessary vs. Sufficient Causality Matrix.
 */

import { describe, it, expect } from 'vitest';
import { CausalSearch } from '../src/engine/causality/CausalSearch';
import { CausalityMatrix } from '../src/engine/causality/CausalityMatrix';

describe('CausalSearch: Delta Debugging & Minimal Interventions', () => {
  it('discovers DNp01 silence as the minimal intervention to prevent escape', () => {
    const result = CausalSearch.search('prevent_escape');

    expect(result.minimalSolution.success).toBe(true);
    expect(result.minimalSolution.interventions.length).toBe(1);
    expect(result.minimalSolution.interventions[0].targetNode).toBe('DNp01');
    expect(result.minimalSolution.totalNeuronsAffected).toBe(2);
    expect(result.minimalSolution.costScore).toBeLessThan(2.0);

    // Alternative solutions should exist (e.g. visual looming pathway)
    expect(result.alternativeSolutions.length).toBeGreaterThan(0);
    const hasVisualAlt = result.alternativeSolutions.some((alt) =>
      alt.interventions.some((i) => i.targetNode === 'LC4' || i.targetNode === 'VIS_LO')
    );
    expect(hasVisualAlt).toBe(true);
  });

  it('guarantees search determinism: repeated searches return identical solutions', () => {
    const runA = CausalSearch.search('prevent_escape');
    const runB = CausalSearch.search('prevent_escape');

    expect(runA.minimalSolution.interventions).toEqual(runB.minimalSolution.interventions);
    expect(runA.minimalSolution.costScore).toBe(runB.minimalSolution.costScore);
    expect(runA.paretoFrontier.length).toBe(runB.paretoFrontier.length);
  });

  it('evaluates the Necessary vs Sufficient Causality Matrix for key populations', () => {
    const matrix = CausalityMatrix.evaluateMatrix();
    expect(matrix.length).toBe(12);

    const dnp01 = matrix.find((m) => m.nodeId === 'DNp01');
    expect(dnp01).toBeDefined();
    expect(dnp01?.isNecessary).toBe(true);
    expect(dnp01?.isSufficient).toBe(true);
    expect(dnp01?.classification).toBe('BOTH');

    const photoreceptors = matrix.find((m) => m.nodeId === 'VIS_R1R6');
    expect(photoreceptors).toBeDefined();
    expect(photoreceptors?.isNecessary).toBe(true);
  });
});
