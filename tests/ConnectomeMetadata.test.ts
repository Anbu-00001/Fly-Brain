/**
 * ConnectomeMetadata.test.ts
 *
 * Regression tests that read the ACTUAL shipped connectome metadata, not a
 * fixture. Every assertion here corresponds to a specific way the previous build
 * misreported the data to the reader.
 *
 * These are the tests that would have caught the bugs. They read
 * public/data/neuron_meta.json directly so they fail if the data and the claims
 * ever diverge again.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LIVE_ENGINE_METADATA } from '../src/engine/shared/ConnectomeTypes';
import { ESCAPE_PATHWAY, isLiveAddressable } from '../src/engine/shared/EscapeCircuit';

interface Group {
  id: number;
  name: string;
  region: 'sensory' | 'central' | 'drives' | 'motor';
  neuron_count: number;
}
interface Meta {
  neuron_count: number;
  edge_count: number;
  group_count: number;
  groups: Group[];
}

const meta: Meta = JSON.parse(
  readFileSync(resolve(__dirname, '../public/data/neuron_meta.json'), 'utf-8')
);
const byName = new Map(meta.groups.map((g) => [g.name, g]));

describe('engine metadata matches the shipped dataset', () => {
  it('declares the neuron and edge counts the data actually has', () => {
    // §11: the number on screen must match the engine that produced the data.
    expect(LIVE_ENGINE_METADATA.totalNeurons).toBe(meta.neuron_count);
    expect(LIVE_ENGINE_METADATA.totalEdges).toBe(meta.edge_count);
  });

  it('group neuron counts sum to the declared total', () => {
    const sum = meta.groups.reduce((a, g) => a + g.neuron_count, 0);
    expect(sum).toBe(meta.neuron_count);
  });
});

describe('region classification', () => {
  /**
   * The previous classifier tested name prefixes and swept everything unmatched
   * into `motor`. GENERIC_CENTRAL has no matching prefix, so 21,955 central
   * neurons were reported as motor -- a 290x overstatement of the motor
   * population. The metadata always carried the correct answer.
   */
  it('GENERIC_CENTRAL is central, not motor', () => {
    const g = byName.get('GENERIC_CENTRAL');
    expect(g).toBeDefined();
    expect(g!.region).toBe('central');
    expect(g!.neuron_count).toBeGreaterThan(20000);
  });

  it('the live motor population is tiny — the dataset has almost no motor neurons', () => {
    const motor = meta.groups
      .filter((g) => g.region === 'motor')
      .reduce((a, g) => a + g.neuron_count, 0);
    // If this ever reports tens of thousands again, prefix-guessing has returned.
    expect(motor).toBeLessThan(1000);
  });

  it('every descending and leg/wing motor group is empty in this dataset', () => {
    // A real limitation worth asserting: the live engine cannot show motor output,
    // which is why the escape readout is modelled rather than measured.
    for (const name of ['DN_WALK', 'DN_FLIGHT', 'DN_TURN', 'DN_STARTLE', 'MN_LEG_L1', 'MN_WING_R']) {
      expect(byName.get(name)?.neuron_count, `${name} should be empty`).toBe(0);
    }
  });
});

describe('cell types the live engine cannot resolve', () => {
  /**
   * LC4, LPLC2 and DNp01 are the scientific centrepiece of this project, and the
   * previous build listed them with invented neuron counts (165 / 146 / 2) and
   * invented synapse weights (720 / 280) under a header claiming the numbers were
   * "sourced strictly from published connectome reconstructions".
   */
  it('LC4, LPLC2 and DNp01 are absent from the live connectome groups', () => {
    for (const name of ['LC4', 'LPLC2', 'DNp01']) {
      expect(byName.has(name), `${name} unexpectedly present in live groups`).toBe(false);
    }
  });

  it('the pathway marks exactly those nodes as not live-addressable', () => {
    const notLive = ESCAPE_PATHWAY.filter((n) => !isLiveAddressable(n)).map((n) => n.id);
    expect(notLive.sort()).toEqual(['DNp01', 'LC4', 'LPLC2']);
  });

  it('every live-addressable pathway node names a group that really exists', () => {
    for (const node of ESCAPE_PATHWAY.filter(isLiveAddressable)) {
      expect(byName.has(node.liveGroup!), `${node.liveGroup} missing from metadata`).toBe(true);
      expect(byName.get(node.liveGroup!)!.neuron_count).toBeGreaterThan(0);
    }
  });

  it('no live-addressable node carries a hardcoded neuron count', () => {
    // Counts must be read from the engine at runtime, never transcribed into TS
    // where they can silently drift from the data.
    for (const node of ESCAPE_PATHWAY) {
      expect(node).not.toHaveProperty('neuronCount');
    }
  });
});
