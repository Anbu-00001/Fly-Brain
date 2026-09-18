# CLAUDE.md — working notes for FLY ESCAPE

`AGENTS.md` / `GEMINI.md` are the original build constitution, written for the
agent that produced the first version. They are still the authority on intent,
attribution and the LIVE/RECORDED contract, and nothing here overrides them.

This file is different. It is what a Claude session needs in order not to repeat
the specific mistakes that were already made here, plus the facts about the data
that are expensive to re-derive. Read it before touching `src/engine` or any
number that reaches the screen.

---

## 1. The one rule this codebase exists to enforce

**No number, label or cell type reaches the interface without declaring where it
came from.**

The first build violated this repeatedly while claiming the opposite in its own
file headers. Not maliciously — it is simply very easy to write a plausible
constant and a confident comment. So provenance is now a type, not a discipline:

- `src/engine/shared/Provenance.ts` — `Quantity<T>` cannot be constructed without
  a `Provenance`. The five kinds are `measured`, `derived`, `published`,
  `modeled`, `invented`.
- `src/ui/ProvenanceTag.ts` — renders the mark next to the value.

If you add a value to the UI, give it a provenance. If you cannot honestly say
which kind it is, that is the signal that you are inventing it.

**`measured` has a narrow meaning:** the engine *currently producing what is on
screen* reported this field, this frame. Not "a real fly has this". Not "the
model computes this". If in doubt it is `derived` or `modeled`.

---

## 2. Facts about the data, verified against the files

Do not re-derive these from memory or from AGENTS.md prose; they were checked
against `public/data/neuron_meta.json` and the trace JSON on 2026-09-18.

**ENGINE-LIVE (FlyWire FAFB v783), `public/data/neuron_meta.json`:**

| Fact | Value |
|---|---|
| Neurons / edges | 139,255 / 2,698,236 |
| Groups | 63, each with an authoritative `region` field |
| Region totals | sensory 103,847 · central 35,252 · drives 80 · **motor 76** |
| Empty groups | 31 of 63, including *every* `DN_*` and `MN_LEG_*`/`MN_WING_*` |
| `GENERIC_CENTRAL` | 21,955 neurons, `region: "central"` |

**Three traps in that table:**

1. **Regions come from the metadata.** Never classify by name prefix. The old
   code did, with an `else -> motor` catch-all, so `GENERIC_CENTRAL` landed in
   motor and the panel reported ~22,031 motor neurons instead of 76 — a 290x
   overstatement. `tests/ConnectomeMetadata.test.ts` guards this.
2. **`LC4`, `LPLC2` and `DNp01` are NOT in this dataset.** They are the
   scientific centrepiece of the project and they are not addressable live. Any
   live UI that shows activity "for LC4" is fabricating. `EscapeCircuit.ts`
   marks them `literature-only`.
3. **There is no left/right.** The groups are not lateralised. The live
   connectome cannot produce a turn signal, so escape *direction* is authored.

**ENGINE-RECORDED (MaleCNS v1.0), `public/traces/*.json`:** these are real and
were genuinely produced by the `flybrain` package. Intact escapes (giant fiber
fires at step 102, 40 ms at dt = 0.02 s); both the LC4 and DNp01 lesions abolish
escape and the fly is caught at 3.94 s. Treat this tier as trustworthy and do
not regenerate it casually — it needs a ~260 MB download and real compute.

---

## 3. Time. Read this before printing any duration

`ENGINE-LIVE`'s LIF model is **dimensionless**: threshold `1.0`, leak `0.95` per
tick, no `dt`, no membrane time constant, no conduction delays. Its membrane
state is not millivolts and its ticks are not milliseconds.

The old code did `result[k] = v * 100; // 100ms per tick` and printed the result
as reaction latency, and `firedCount * 10` printed as `Hz`. The `10` and `100`
both come from `TARGET_TICK_RATE = 10`, the worker's *render cadence*.

- Live timing is reported in **ticks**. `getFirstSpikeTicks()` says so in its name.
- Wall-clock response time from `performance.now()` is legitimate, but it
  measures *this simulation in this browser*, so it is labelled
  `responseWallClockMs` and carries a `derived` mark.
- `ENGINE-RECORDED` genuinely integrates at `dt = 0.02 s`. Milliseconds are real
  there, and the trace JSON key stays `firstJumpLatencyMs`. Do not "unify" these
  two names — the distinction is the point.

---

## 4. The machine constraint — this is an operational rule, not a nicety

**The maintainer's laptop overheats and crashes when this app is run badly.**
That is a hardware reality to design around, not a bug to dismiss.

Root causes, all fixed — do not reintroduce them:

- Screens were torn down with `innerHTML = ''` after `stop()` but never
  `dispose()`, so each visit to Experiment leaked two `WebGLRenderer`s.
- `renderer.dispose()` does **not** release a WebGL context. You also need
  `forceContextLoss()` and to detach the canvas. Use
  `releaseRenderer()` from `ui/render/Lifecycle.ts`; never call `dispose()` alone.
- `Arena3DView` attached four anonymous `window` listeners per instance and
  never removed them, retaining the whole scene graph. All listeners are now
  `AbortController`-scoped.
- The Experiment screen constructed the 2D *and* 3D arenas and hid one.

**Rules:**
- Every screen owns a `DisposalBag`. Empty it *before* touching the DOM.
- Anything that allocates GPU memory or starts a loop returns a disposer.
- Use `RenderLoop` (frame cap + `visibilitychange` pause), not bare `requestAnimationFrame`.
- Cap pixel ratio via `clampedPixelRatio()`.

**When working here:** `npm run build` and `npx vitest run` are cheap and safe.
`npm run dev` with a browser tab open runs a 139k-neuron simulation plus WebGL
continuously — do not leave one running, and do not start one just to "check"
something a test can answer.

---

## 5. Architecture

```
src/
  engine/
    shared/   Provenance · EscapeModel · EscapeCircuit · ConnectomeTypes · Metrics
    live/     LiveEngineAdapter (wraps the Web Worker) · LoomingCalculator
    recorded/ TraceConsumer (reads static JSON only — no Python at runtime)
  ui/
    design/   tokens.css · effects.ts (React Bits ports)
    render/   Lifecycle.ts (disposal, render budget, WebGL fallback)
    ...       Arena3DView · ArenaView · BrainPanel · BrainSurgeryPanel · AboutDrawer
  state/      AppState · InputRecorder · SeededRNG
```

`engine/` must not import from `ui/`. The UI must not reach into raw connectome
structures; it goes through the adapter.

**Scope:** four screens — Experiment, Replay, Brain Surgery, Methods & Limits.
A previous build grew a "God Mode" lab, a causal debugger, a query language,
neural dominoes and an audio synth: 6,453 LOC that AGENTS.md never asked for,
while the specified features were reporting invented numbers. That was deleted.
Before adding a surface, check it against AGENTS.md §5's P0–P3 tiers.

---

## 6. UI conventions

Vanilla TS and CSS. No React — this app's hot paths are a Web Worker, a canvas
and a Three.js scene, and React buys nothing there. The visual language is
ported by hand from React Bits (reactbits.dev) into `ui/design/effects.ts`.

**React Bits is MIT + Commons Clause, not plain MIT.** The condition forbids
redistributing the components "whether alone, in a bundle, or as a ported
version". Using them inside this application is fine; lifting
`ui/design/effects.ts` out as a component library is not. See `NOTICE.md` §4.

- One accent (cyan = live measurement). Colour is spent on **provenance**.
- Only the arena and the neural activity glow. Chrome recedes.
- All tokens live in `ui/design/tokens.css`. No new hex colours in `style.css`.
- Every effect honours `prefers-reduced-motion` and returns a disposer.
- Never animate a number the reader is trying to read. `countUp` is short and
  capped for exactly this reason.

---

## 7. Before you commit

```bash
npx tsc --noEmit     # strict; must be clean
npx vitest run       # 31 tests
npm run build
```

One logical change per commit, conventional prefix (AGENTS.md §15).
**Do not `git push`** unless explicitly asked.

The tests that matter most are `tests/ConnectomeMetadata.test.ts` (reads the
real shipped metadata and fails if the claims and the data diverge) and
`tests/EscapeModel.test.ts` (asserts no part of the escape decision is ever
labelled `measured`). If either starts failing, the fix is almost certainly to
correct the claim, not the test.
