# FLY ESCAPE

**Can you catch a 166,000-neuron brain?**

An interactive *Drosophila* escape experiment driven by real, published
connectome reconstructions. You steer a looming predator with the mouse; a
simulated fly reacts. Then you lesion the circuit that produced the reaction and
watch the escape disappear.

> **What makes this different from a demo:** every number on screen states where
> it came from — measured from the running engine, derived from those
> measurements, published in the literature, modelled by this project, or simply
> authored by us. Nothing is presented as biology unless it is.

---

## Why this exists

Two remarkable datasets were published recently: the complete synaptic wiring of
an adult fly brain (FlyWire FAFB) and of a whole male central nervous system
(MaleCNS). Both are freely available. Almost nobody outside the field ever
interacts with them.

This project is a thin, well-engineered layer over that existing work. It does
not contain a new simulator and does not claim scientific novelty. It tries to
do one thing well: make a real connectome legible by letting you poke it and
break it, without lying to you about what you are seeing.

## What is actually happening

```
  YOU                  ENGINE-LIVE                      SCREEN
  ───                  ───────────                      ──────
  mouse ──> looming ──> inject into VIS_R1R6,   ──> measured spikes ──> telemetry
            geometry    VIS_ME, VIS_LO, VIS_LPTC        per group        + arena
                        (real FlyWire groups)
                              │
                              ├─ measured lobula activity ─┐
                              │                            ├─> escape decision
            angular size θ ───┴─ angular expansion dθ/dt ──┘   (MODELLED)
```

The escape decision follows the published decomposition of the giant-fiber
looming response: **LC4** encodes angular *velocity* roughly linearly, **LPLC2**
encodes angular *size* as a Gaussian peaked near 42°, and giant-fiber-mediated
takeoff becomes likely around a **39°** angular size.

### The honest limitation, stated up front

ENGINE-LIVE ships FlyWire FAFB v783 rolled into 63 neuropil groups. In that
packaging, **`LC4`, `LPLC2` and `DNp01` are not addressable populations.** Two
consequences we surface rather than hide:

- **The live engine has 76 motor neurons.** Every descending (`DN_*`) and
  leg/wing (`MN_*`) group in this dataset is empty. The fly's rendered movement
  is our interpretation of activity, not a motor readout.
- **The groups are not lateralised.** The live connectome cannot tell the fly
  which way to turn, so escape *direction* is computed from stimulus geometry
  and labelled AUTHORED throughout.

To lesion the *actual* looming detectors and the *actual* giant fiber, the
experiment moves to ENGINE-RECORDED. That is what Brain Surgery does, and it is
why Brain Surgery is recorded rather than live.

---

## Architecture: two engines, one honest line between them

| | **ENGINE-LIVE** | **ENGINE-RECORDED** |
|---|---|---|
| Dataset | FlyWire FAFB v783 | MaleCNS v1.0 |
| Neurons / edges | 139,255 / 2,698,236 | 166,700 / 25,582,938 |
| Coverage | Adult brain | Whole CNS (brain + optic lobes + VNC) |
| Where it runs | Web Worker, in your browser | Python, offline, ahead of time |
| Resolves LC4/LPLC2/DNp01 | **No** | **Yes** |
| Powers | the interactive chase | Replay and Brain Surgery |

Everything shipped is static. **No backend, no database, no accounts, no Python
at runtime.** `precompute/` is developer tooling that regenerates the recorded
traces; you never need it to run the app.

A persistent badge states which engine produced whatever is on screen, and the
neuron count shown always matches that engine. If the homepage subtitle and the
live counter disagree, that is correct: they describe different engines.

---

## Reading the interface

Every value carries a mark. The mark is a **shape** first and a colour second,
so it survives greyscale and colour-blind vision.

| Mark | Meaning |
|---|---|
| ● **MEASURED** | Read directly from the engine producing what is on screen, this frame. |
| ◐ **DERIVED** | Computed from measured values. The formula is shown. |
| ◆ **PUBLISHED** | A real literature measurement — *not* produced by this simulation. |
| ◇ **MODELLED** | A modelling choice made by this project, informed by the literature. |
| ○ **AUTHORED** | Invented here. The arena, the predator and the rendered body are not biology. |

This is enforced by the type system, not by discipline: `Quantity<T>` in
`src/engine/shared/Provenance.ts` cannot be constructed without a provenance.

### A note on time

ENGINE-LIVE's leaky integrate-and-fire model is **dimensionless** — threshold
1.0, no `dt`, no membrane time constant, no conduction delays. Its ticks are not
milliseconds and its membrane state is not millivolts. Live timing is therefore
reported in **ticks**, and the wall-clock response time is labelled as exactly
that. ENGINE-RECORDED genuinely integrates at `dt = 0.02 s`, so milliseconds are
real there.

---

## Brain Surgery

The centrepiece result. One fixed predator trajectory, run three times through
the whole-CNS connectome:

| Condition | Giant fiber | Outcome |
|---|---|---|
| **Intact** | fires at step 102 (40 ms) | escapes |
| **LC4 / LPLC2 lesioned** (311 neurons) | never fires | caught at 3.94 s |
| **DNp01 lesioned** (2 neurons) | never fires | caught at 3.94 s |

Removing two neurons out of 166,700 — one bilateral pair — abolishes the escape.
That is the whole point of the giant fiber, and you can watch it happen.

These are precomputed deterministic traces, labelled RECORDED, never live.

---

## Install and run

```bash
npm install
npm run dev
```

That is all. No Python, no server, no dataset download beyond the ~12 MB
connectome that ships with the repo.

```bash
npm run build      # typecheck + production bundle
npx vitest run     # 31 tests
```

<details>
<summary>Regenerating the recorded traces (optional, not needed to run the app)</summary>

```bash
cd precompute
pip install -r requirements.txt     # pulls flybrain + ~260 MB of connectome files
python generate_demo_trace.py
python generate_lesion_traces.py
```

Requires real desktop compute. The committed traces in `public/traces/` are the
output of exactly these scripts.
</details>

---

## What is biological, and what is not

| Layer | Status |
|---|---|
| The wiring | **Real.** EM-reconstructed connectomes, published and cited below. |
| The neuron model | **An approximation.** Leaky integrate-and-fire is not how biological neurons work. |
| The escape decision | **Modelled.** Follows published LC4/LPLC2 tuning; not a measurement of those cells. |
| The arena and predator | **Authored.** Invented by this project. No biological counterpart. |
| The fly's movement | **Authored.** Our interpretation of activity, not validated animal behaviour. |

**Nothing in this project is trained, and nothing here thinks.** Both engines are
fixed biological wiring driven by injected input. There is no learning, no
training, no adaptation, and no claim of sentience.

## Limitations

- The live engine cannot resolve the very cell types the project is about (above).
- The live LIF model carries no biological time, so live latencies are not
  comparable to published reaction times.
- Escape direction and locomotion are authored, not read out of the connectome.
- The recorded traces cover one fixed trajectory. They are a demonstration of a
  known result, not a new finding.
- LIF over a static connectome omits neuromodulation, graded potentials, gap
  junctions, synaptic plasticity and conduction delays.

## Attribution

Full third-party license texts are in [`NOTICE.md`](./NOTICE.md).

**Connectome data**
- Dorkenwald, S., Matsliah, A., Sterling, A.R. *et al.* "Neuronal wiring diagram
  of an adult brain." *Nature* **634**, 124–138 (2024).
  <https://doi.org/10.1038/s41586-024-07558-y> — FlyWire Codex, FlyWire Consortium.
- Berg, S. *et al.* "Sexual dimorphism in the complete connectome of the
  *Drosophila* male central nervous system." *Cell* (2026).
  doi:10.1016/j.cell.2026.08.015 — MaleCNS v1.0, FlyEM/HHMI Janelia, University
  of Cambridge, MRC Laboratory of Molecular Biology, Google Research.
  Data **CC BY 4.0**.

**Escape physiology**
- von Reyn, C.R. *et al.* "A spike-timing mechanism for action selection."
  *Nature Neuroscience* **17**, 962–970 (2014). doi:10.1038/nn.3741
- Ache, J.M. *et al.* "Neural Basis for Looming Size and Velocity Encoding in the
  *Drosophila* Giant Fiber Escape Pathway." *Current Biology* **29**, 1073–1081
  (2019). doi:10.1016/j.cub.2019.01.079
- Klapoetke, N.C. *et al.* "Ultra-selective looming detection from radial motion
  opponency." *Nature* **551**, 237–241 (2017). doi:10.1038/nature24626

**Upstream code**
- ENGINE-LIVE is adapted from `snedea/flybrain` (**MIT**), which carries forward
  credit to the FlyWire Consortium; Timothy Busbice, Gabriel Garrett and Geoffrey
  Churchill (GoPiGo Connectome); Zach Rispoli; and Seth Miller / `heyseth/worm-sim`.
- ENGINE-RECORDED uses the `flybrain` PyPI package (**MIT**, source
  `alextitonis/fly.ai`), whose neuron model follows "Fly64" by Jessica Paquette.
- UI motion effects are hand-ported from [React Bits](https://reactbits.dev)
  into plain TypeScript. React Bits is **MIT + Commons Clause**, not plain MIT:
  you may use these effects inside an application, but you may not republish
  them as a component library, *including as a ported version*. See
  [`NOTICE.md`](./NOTICE.md) §4 before reusing `src/ui/design/effects.ts`.

This project's own code is **MIT** — see [`LICENSE`](./LICENSE).
