/**
 * EscapeCircuit.ts
 *
 * The looming-to-escape pathway, as a small annotated map. This is the content
 * behind the explorable explanation: it is what the project is actually about.
 *
 * It replaces CircuitGraph.ts, which was removed because it could not be repaired
 * in place. That file declared itself "Sourced strictly from published connectome
 * reconstructions" and then:
 *
 *   - gave LC4 -> DNp01 a synaptic weight of 720 and LPLC2 -> DNp01 a weight of
 *     280, commented "Synaptic count from FlyWire/MaleCNS EM reconstructions".
 *     The published counts are 2,442 and 1,366 (Ache et al. 2019). The numbers
 *     were invented and the attribution was false.
 *   - assigned every synapse a latency of 8.0 ms, or 4.0 ms into DNp01, and
 *     summed them into an "estimatedLatencyMs" shown to the reader as biology.
 *   - listed LC4, LPLC2 and DNp01 beside groups that ENGINE-LIVE genuinely
 *     resolves, with no indication that the live engine cannot address them.
 *
 * Every node below therefore carries `resolvedIn`, which states plainly which
 * engine can actually address it, and counts carry their own provenance.
 *
 * VERIFIED AGAINST THE DATA, not from memory: the group names and neuron counts
 * marked ENGINE-LIVE were checked against public/data/neuron_meta.json. The names
 * LC4, LPLC2 and DNp01 are absent from that file, which is why they are marked
 * literature-only.
 */

import { Quantity, measured, published } from './Provenance';
import { CITATIONS, GF_INPUT_ANATOMY } from './EscapeModel';

/** Which engine, if any, can address this population as a unit. */
export type ResolvedIn =
  /** A real group in ENGINE-LIVE's 63-group FlyWire rollup. Addressable live. */
  | 'ENGINE-LIVE'
  /** Addressable in ENGINE-RECORDED (MaleCNS v1.0) via brain.cells([...]). */
  | 'ENGINE-RECORDED'
  /** Real biology, but not addressable in either engine as packaged here. */
  | 'literature-only';

export interface CircuitNode {
  id: string;
  name: string;
  neuropil: string;
  region: 'sensory' | 'central' | 'motor';
  /** Position along the pathway, 0 = photoreceptors, 5 = muscle. */
  order: number;
  resolvedIn: ResolvedIn;
  /**
   * ENGINE-LIVE group name, when one exists. null means the live engine cannot
   * show activity for this node and the UI must not pretend it can.
   */
  liveGroup: string | null;
  role: string;
  citation: string;
}

/**
 * The pathway, coarse to fine. Ordered; the UI renders it in this order.
 *
 * Note the honest discontinuity at order 2/3: the live engine resolves the
 * lobula as a bulk neuropil (VIS_LO) but not the LC4/LPLC2 columnar populations
 * inside it, and resolves no descending giant fiber at all. That gap is the
 * single most important thing this diagram has to communicate, because it is
 * exactly where the previous build quietly invented data.
 */
export const ESCAPE_PATHWAY: CircuitNode[] = [
  {
    id: 'VIS_R1R6',
    name: 'Photoreceptors R1–R6',
    neuropil: 'Retina / Lamina',
    region: 'sensory',
    order: 0,
    resolvedIn: 'ENGINE-LIVE',
    liveGroup: 'VIS_R1R6',
    role: 'Convert incoming light into graded potentials. Histaminergic.',
    citation: 'Dorkenwald et al. Nature 634, 124–138 (2024)',
  },
  {
    id: 'VIS_ME',
    name: 'Medulla interneurons',
    neuropil: 'Medulla',
    region: 'sensory',
    order: 1,
    resolvedIn: 'ENGINE-LIVE',
    liveGroup: 'VIS_ME',
    role: 'Contrast filtering, edge detection, early motion preprocessing.',
    citation: 'Dorkenwald et al. Nature 634, 124–138 (2024)',
  },
  {
    id: 'VIS_LO',
    name: 'Lobula (bulk neuropil)',
    neuropil: 'Lobula',
    region: 'sensory',
    order: 2,
    resolvedIn: 'ENGINE-LIVE',
    liveGroup: 'VIS_LO',
    role:
      'Object feature extraction. This is the finest resolution ENGINE-LIVE offers ' +
      'here: the columnar populations below live inside this group but cannot be ' +
      'addressed separately.',
    citation: 'Dorkenwald et al. Nature 634, 124–138 (2024)',
  },
  {
    id: 'LC4',
    name: 'LC4 — looming velocity detectors',
    neuropil: 'Lobula columnar / GF lateral dendrite',
    region: 'sensory',
    order: 3,
    resolvedIn: 'literature-only',
    liveGroup: null,
    role:
      'Encode angular EXPANSION VELOCITY of a looming object, contributing ' +
      'approximately linearly to the giant fiber response.',
    citation: CITATIONS.ache2019,
  },
  {
    id: 'LPLC2',
    name: 'LPLC2 — looming size detectors',
    neuropil: 'Lobula plate / GF lateral dendrite',
    region: 'sensory',
    order: 3,
    resolvedIn: 'literature-only',
    liveGroup: null,
    role:
      'Encode angular SIZE, contributing as a Gaussian peaked near 42°. Silencing ' +
      'LPLC2 removes the size component of the GF looming response, leaving velocity.',
    citation: CITATIONS.ache2019,
  },
  {
    id: 'DNp01',
    name: 'DNp01 — the Giant Fiber',
    neuropil: 'Lateral posterior slope / cervical connective',
    region: 'motor',
    order: 4,
    resolvedIn: 'literature-only',
    liveGroup: null,
    role:
      'The escape command neuron: one bilateral pair. Its activation forces a fast ' +
      'short-mode takeoff that trades wing stabilisation for speed.',
    citation: CITATIONS.vonReyn2014,
  },
];

/**
 * Published connectivity onto the giant fiber. These are the numbers the previous
 * build invented; they are stated here with their source and are NOT claimed to
 * have been reproduced by either engine in this app.
 */
export const GF_CONVERGENCE: Quantity<number>[] = [
  published('LC4 neurons onto GF', GF_INPUT_ANATOMY.lc4Neurons, 'neurons', CITATIONS.ache2019),
  published('LPLC2 neurons onto GF', GF_INPUT_ANATOMY.lplc2Neurons, 'neurons', CITATIONS.ache2019),
  published('LC4 synapses onto GF', GF_INPUT_ANATOMY.lc4Synapses, 'synapses', CITATIONS.ache2019),
  published('LPLC2 synapses onto GF', GF_INPUT_ANATOMY.lplc2Synapses, 'synapses', CITATIONS.ache2019),
];

/** True when the live engine can show real activity for this node. */
export function isLiveAddressable(node: CircuitNode): boolean {
  return node.resolvedIn === 'ENGINE-LIVE' && node.liveGroup !== null;
}

/**
 * Builds the live neuron count for a node, measured from the engine, or returns
 * null when the live engine cannot resolve it. Returning null is the point: the
 * UI renders "not resolvable in this engine" rather than inventing a number.
 */
export function liveNeuronCount(
  node: CircuitNode,
  getGroupSize: (name: string) => number
): Quantity<number> | null {
  if (!isLiveAddressable(node) || !node.liveGroup) return null;
  return measured(
    `${node.name} neurons`,
    getGroupSize(node.liveGroup),
    'neurons',
    'ENGINE-LIVE',
    `neuron_meta.groups[${node.liveGroup}].neuron_count`
  );
}

/**
 * The gap in the pathway, stated explicitly for the UI to render.
 * This is a feature of the explanation, not an apology for it.
 */
export const RESOLUTION_GAP = {
  title: 'Where the live engine stops',
  body:
    'ENGINE-LIVE rolls FlyWire FAFB v783 into 63 neuropil groups. That is enough to ' +
    'drive and observe the lobula, but LC4, LPLC2 and DNp01 are not addressable in it. ' +
    'Live encounters therefore show real lobula activity and a MODELLED escape decision. ' +
    'To lesion the actual looming detectors and the actual giant fiber, the experiment ' +
    'has to move to ENGINE-RECORDED (MaleCNS v1.0), which does resolve them — that is ' +
    'what Brain Surgery does, and why it is recorded rather than live.',
} as const;
