/**
 * Provenance.ts
 *
 * The honesty substrate for FLY ESCAPE.
 *
 * Every number this application puts on screen must declare where it came from.
 * AGENTS.md §4/§10/§11 forbid showing counts, labels, or metrics that the active
 * engine did not actually produce. Enforcing that by discipline alone failed once
 * already: an earlier build shipped invented reaction latencies, invented escape
 * thresholds, and cell-type labels that the live connectome cannot resolve.
 *
 * So provenance is a type, not a convention. A `Quantity` cannot be constructed
 * without one, and the UI renders its glyph next to the value. If a reader asks
 * "is that real?", the interface already answered.
 *
 * The five kinds are deliberately ordered from strongest to weakest claim.
 */

export type ProvenanceKind =
  | 'measured'   // read directly out of the active engine for the frame on screen
  | 'derived'    // computed from measured values by a formula we can show
  | 'published'  // a literature value; real biology, but NOT from this simulation
  | 'modeled'    // our modelling choice, informed by literature but not measured
  | 'invented';  // authored by this project: arena, predator, behaviour rendering

export type Provenance =
  /** Reported by the engine named in `engine`, for the data currently displayed. */
  | { kind: 'measured'; engine: 'ENGINE-LIVE' | 'ENGINE-RECORDED'; field: string }
  /** Computed from other quantities. `formula` is shown verbatim to the reader. */
  | { kind: 'derived'; formula: string; from: string[] }
  /** A published biological value. Never implies this simulation reproduced it. */
  | { kind: 'published'; citation: string; note?: string }
  /** A modelling decision. `rationale` says why; `citation` grounds it if it can. */
  | { kind: 'modeled'; rationale: string; citation?: string }
  /** Invented by this project. Not biology. Says so, plainly. */
  | { kind: 'invented'; rationale: string };

/**
 * A value bound to its own epistemic status.
 *
 * `unit` is null for genuinely dimensionless quantities. This matters: the live
 * LIF model integrates in arbitrary units (threshold = 1.0, no dt, no membrane
 * time constant), so its membrane state has NO millivolt interpretation and its
 * ticks have NO millisecond interpretation. Passing null here is the honest
 * answer, and the UI is built to render it rather than invent a unit.
 */
export interface Quantity<T = number> {
  readonly label: string;
  readonly value: T;
  readonly unit: string | null;
  readonly provenance: Provenance;
}

/* ---------- constructors ---------- */

export function measured<T>(
  label: string,
  value: T,
  unit: string | null,
  engine: 'ENGINE-LIVE' | 'ENGINE-RECORDED',
  field: string
): Quantity<T> {
  return { label, value, unit, provenance: { kind: 'measured', engine, field } };
}

export function derived<T>(
  label: string,
  value: T,
  unit: string | null,
  formula: string,
  from: string[]
): Quantity<T> {
  return { label, value, unit, provenance: { kind: 'derived', formula, from } };
}

export function published<T>(
  label: string,
  value: T,
  unit: string | null,
  citation: string,
  note?: string
): Quantity<T> {
  return { label, value, unit, provenance: { kind: 'published', citation, note } };
}

export function modeled<T>(
  label: string,
  value: T,
  unit: string | null,
  rationale: string,
  citation?: string
): Quantity<T> {
  return { label, value, unit, provenance: { kind: 'modeled', rationale, citation } };
}

export function invented<T>(
  label: string,
  value: T,
  unit: string | null,
  rationale: string
): Quantity<T> {
  return { label, value, unit, provenance: { kind: 'invented', rationale } };
}

/* ---------- presentation ---------- */

/** Glyphs are shape-coded, not colour-coded, so they survive colour-blind vision. */
export const PROVENANCE_GLYPH: Record<ProvenanceKind, string> = {
  measured: '●',
  derived: '◐',
  published: '◆',
  modeled: '◇',
  invented: '○',
};

export const PROVENANCE_LABEL: Record<ProvenanceKind, string> = {
  measured: 'MEASURED',
  derived: 'DERIVED',
  published: 'PUBLISHED',
  modeled: 'MODELLED',
  invented: 'AUTHORED',
};

export const PROVENANCE_SUMMARY: Record<ProvenanceKind, string> = {
  measured: 'Read directly from the engine producing what you are looking at.',
  derived: 'Computed from measured values. The formula is shown.',
  published: 'A real published measurement from the literature — not produced by this simulation.',
  modeled: 'A modelling choice made by this project, informed by the literature.',
  invented: 'Authored by this project. The arena, the predator and the rendered body are not biology.',
};

/** One-line explanation for a specific quantity, for tooltips and the audit view. */
export function explainProvenance(p: Provenance): string {
  switch (p.kind) {
    case 'measured':
      return `Measured: ${p.engine} reports this as \`${p.field}\` for the frame on screen.`;
    case 'derived':
      return `Derived: ${p.formula}  (from ${p.from.join(', ')})`;
    case 'published':
      return `Published: ${p.citation}${p.note ? ` — ${p.note}` : ''}. Not produced by this simulation.`;
    case 'modeled':
      return `Modelled: ${p.rationale}${p.citation ? `  Grounded in ${p.citation}.` : ''}`;
    case 'invented':
      return `Authored by this project: ${p.rationale}. Not biological.`;
  }
}

/** True when a value may be presented as something the simulation actually showed. */
export function isFromSimulation(p: Provenance): boolean {
  return p.kind === 'measured' || p.kind === 'derived';
}
