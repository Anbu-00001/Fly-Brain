/**
 * ProvenanceTag.ts
 *
 * Renders a Quantity together with where it came from.
 *
 * This is the interface-level half of the honesty substrate. Provenance.ts makes
 * it impossible to construct a value without declaring its status; this module
 * makes that status visible, so the reader never has to take a number on trust.
 *
 * Design notes:
 *
 *   - The glyph carries the meaning, the colour reinforces it. A reader with
 *     colour-blind vision, or a greyscale screenshot in a paper, still gets the
 *     distinction between a measurement and a modelling assumption.
 *   - The explanation is a native `title` plus aria-label rather than a custom
 *     tooltip, so it works with keyboard focus and screen readers and cannot
 *     escape its container.
 *   - Nothing here can render a value whose provenance is missing, because the
 *     type system does not allow such a value to exist.
 */

import {
  Quantity,
  Provenance,
  ProvenanceKind,
  PROVENANCE_GLYPH,
  PROVENANCE_LABEL,
  PROVENANCE_SUMMARY,
  explainProvenance,
} from '../engine/shared/Provenance';

const KINDS: ProvenanceKind[] = ['measured', 'derived', 'published', 'modeled', 'invented'];

/** A small inline badge: glyph + kind, explained on hover/focus. */
export function provenanceBadge(p: Provenance): HTMLElement {
  const el = document.createElement('span');
  el.className = `prov prov-${p.kind}`;
  el.tabIndex = 0;
  el.title = explainProvenance(p);
  el.setAttribute('aria-label', explainProvenance(p));
  el.innerHTML = `<span class="prov-glyph" aria-hidden="true">${PROVENANCE_GLYPH[p.kind]}</span>${PROVENANCE_LABEL[p.kind]}`;
  return el;
}

/** Formats the value itself, leaving unitless quantities genuinely unitless. */
export function formatQuantity(q: Quantity<number | string>): string {
  const v = typeof q.value === 'number' ? String(q.value) : q.value;
  // A null unit is meaningful: the live LIF model's state has no physical unit,
  // and appending a plausible-looking one would be the exact failure this
  // codebase is being repaired for.
  return q.unit ? `${v} ${q.unit}` : v;
}

/** A labelled row: name, value, provenance. The default way to show a number. */
export function quantityRow(q: Quantity<number | string>): HTMLElement {
  const row = document.createElement('div');
  row.className = 'meter-card';

  const info = document.createElement('div');
  info.className = 'meter-info';

  const name = document.createElement('span');
  name.className = 'meter-name';
  name.textContent = q.label;

  const val = document.createElement('span');
  val.className = 'meter-val';
  val.textContent = formatQuantity(q);

  info.append(name, val);
  row.append(info, provenanceBadge(q.provenance));
  return row;
}

/**
 * The legend. Mounted once per screen that shows numbers, so the glyph system is
 * always self-explanatory rather than something the reader must already know.
 */
export function provenanceLegend(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'prov-legend';
  el.setAttribute('role', 'note');
  el.setAttribute('aria-label', 'How to read the provenance marks on every value');

  for (const kind of KINDS) {
    const item = document.createElement('div');
    item.className = 'prov-legend-item';

    const tag = document.createElement('span');
    tag.className = `prov prov-${kind}`;
    tag.innerHTML = `<span class="prov-glyph" aria-hidden="true">${PROVENANCE_GLYPH[kind]}</span>${PROVENANCE_LABEL[kind]}`;

    const desc = document.createElement('span');
    desc.className = 'prov-legend-desc';
    desc.textContent = PROVENANCE_SUMMARY[kind];

    item.append(tag, desc);
    el.appendChild(item);
  }
  return el;
}

/** Renders a list of quantities as a block, with the legend beneath it. */
export function quantityPanel(
  title: string,
  quantities: Quantity<number | string>[],
  withLegend = true
): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'regional-section';
  wrap.setAttribute('data-reveal', '');

  const heading = document.createElement('h4');
  heading.className = 'section-title';
  heading.textContent = title;
  wrap.appendChild(heading);

  for (const q of quantities) wrap.appendChild(quantityRow(q));
  if (withLegend) wrap.appendChild(provenanceLegend());
  return wrap;
}
