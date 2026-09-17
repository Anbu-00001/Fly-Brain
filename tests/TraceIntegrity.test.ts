import { describe, it, expect } from 'vitest';
import canonicalDemo from '../public/traces/canonical_demo.json';
import intactTrace from '../public/traces/brain_surgery_intact.json';
import lc4LesionTrace from '../public/traces/brain_surgery_lc4_lesion.json';
import dnp01LesionTrace from '../public/traces/brain_surgery_dnp01_lesion.json';

describe('Precomputed Trace Integrity', () => {
  it('canonical demo conforms to ENGINE-RECORDED MaleCNS specifications', () => {
    expect(canonicalDemo.engine).toBe('RECORDED');
    expect(canonicalDemo.neuronCount).toBe(166700);
    expect(canonicalDemo.totalEdges).toBe(25582938);
    expect(canonicalDemo.samples.length).toBeGreaterThanOrEqual(500);
    expect(canonicalDemo.summary.escaped).toBe(true);
    expect(canonicalDemo.summary.firstJumpLatencyMs).toBe(40);
  });

  it('Brain Surgery intact vs lesioned conditions show clear biological differences on identical trajectory', () => {
    // Check intact escape
    expect(intactTrace.summary.escaped).toBe(true);
    expect(intactTrace.summary.caught).toBe(false);
    expect(intactTrace.summary.firstJumpLatencyMs).toBe(40);

    // Check LC4/LPLC2 lesion failure
    expect(lc4LesionTrace.lesionType).toBe('lc4');
    expect(lc4LesionTrace.lesionedNeuronCount).toBe(311);
    expect(lc4LesionTrace.summary.escaped).toBe(false);
    expect(lc4LesionTrace.summary.caught).toBe(true);
    expect(lc4LesionTrace.summary.firstJumpLatencyMs).toBeNull();

    // Check DNp01 Giant Fiber lesion failure
    expect(dnp01LesionTrace.lesionType).toBe('dnp01');
    expect(dnp01LesionTrace.lesionedNeuronCount).toBe(2);
    expect(dnp01LesionTrace.summary.escaped).toBe(false);
    expect(dnp01LesionTrace.summary.caught).toBe(true);
    expect(dnp01LesionTrace.summary.firstJumpLatencyMs).toBeNull();

    // Verify predator trajectory is identical in all conditions
    expect(intactTrace.samples[150].mouseX).toBe(lc4LesionTrace.samples[150].mouseX);
    expect(intactTrace.samples[150].mouseY).toBe(lc4LesionTrace.samples[150].mouseY);
    expect(intactTrace.samples[250].mouseX).toBe(dnp01LesionTrace.samples[250].mouseX);
    expect(intactTrace.samples[250].mouseY).toBe(dnp01LesionTrace.samples[250].mouseY);
  });
});
