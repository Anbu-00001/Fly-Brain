# AGENTS.md — FLY ESCAPE Build Constitution

*"Can you catch a 166,000-neuron brain?" — strict build rules for the coding agent (Gemini 3.8, in Google Antigravity) working on this project. Written as the lead-engineer pass for a solo developer with a 3-day budget.*

## How to use this file

- Save this exact file as `AGENTS.md` in the project root. Antigravity (v1.20.3+) and Gemini 3.8 read it automatically at the start of every session, and so do Cursor and Claude Code if you ever bring either in as a second opinion.
- If you want Antigravity-only rules to take priority over everything else in the folder, duplicate this file as `GEMINI.md` too — Antigravity applies `GEMINI.md` first and `AGENTS.md` second. One file is enough for this project; only keep both if they diverge.
- This is a constraint set, not inspiration. Where a rule here conflicts with what feels like "best practice," this file wins. Cut a **feature** before you cut a **rule** — see the priority order in §5.
- Anything marked **[VERIFY]** is research that must be re-checked against the live source before you build on it. Everything else is binding as written.
- Do not paraphrase this file into something looser in your own planning notes. Quote the rule, then act on it.

---

## 1. What this project is

FLY ESCAPE is a browser experience built as a thin, well-engineered layer over **existing, real, open-source Drosophila connectome work** — not a from-scratch neuroscience engine. A simulated fly, driven by a genuine connectome-based neural simulation, reacts to a looming predator that the user steers with the mouse. The goal is simply to catch it. The win condition for this project is *existing connectome + new interaction + new experiment + excellent visualization + reproducible results* — not scientific novelty, and not a bigger simulator than the ones that already exist.

You have three days, solo. Every hour spent re-deriving something the ecosystem already published is an hour stolen from the visualization and polish that actually wins this project.

---

## 2. Research findings — read before writing any simulation code **[VERIFY]**

This section documents what was found by web research on 2026-09-18. Repos this small and this new can change; re-confirm the load-bearing facts (license text, neuron/connection counts, that `pip install` and `git clone` still work as described) before you architect around them, and flag anything that no longer matches instead of silently improvising around it.

### 2.1 The name collision you must not trip over

There are **two unrelated open-source projects that are both informally called "flybrain."** Never write the bare word "flybrain" in code, commit messages, or docs without one of the qualifiers below — this is exactly the kind of mix-up that wastes half a day.

- **`ENGINE-LIVE`** — a browser-native JavaScript simulation, GitHub repo `snedea/flybrain`.
- **`ENGINE-RECORDED`** — a Python package on PyPI literally named `flybrain`, source at `alextitonis/fly.ai`.

They use different connectomes, different neuron counts, and different licenses for their data. Treat them as two separate dependencies with two separate NOTICE entries.

### 2.2 ENGINE-LIVE — `snedea/flybrain` (browser-native, real-time, zero backend)

- Repo: `https://github.com/snedea/flybrain` · Hosted demo: `https://flybrain.app`
- What it is: a leaky-integrate-and-fire (LIF) simulation of **139,255 neurons and ~2.7M connections** from the **FlyWire FAFB v783** connectome, stepped in real time inside a Web Worker, rendered with WebGL. It already runs by opening `index.html` — no server, no build step required to view it.
- Data source / citation to preserve: Dorkenwald, S., Matsliah, A., Sterling, A.R. *et al.* "Neuronal wiring diagram of an adult brain." *Nature* 634, 124–138 (2024). https://doi.org/10.1038/s41586-024-07558-y. The connectome file is derived from the FlyWire Codex public dataset (`codex.flywire.ai`).
- Existing interaction surface (per its README): toolbar actions **Feed, Touch, Air, Light, Temp**. None of these is a "looming predator" stimulus — that channel does not exist yet and is the main thing you are adding.
- Existing neuron grouping: **Sensory, Central, Drives, Motor** (FlyWire cell-type annotations rolled up into four buckets). This is coarser than individual cell types like LC4/LPLC2 — confirm at the code level whether finer per-cell-type querying is exposed before promising it in the UI.
- License: **MIT** (`license.md` in the repo).
- Attribution chain to carry forward verbatim in your own NOTICE file: the FlyWire Consortium; Timothy Busbice, Gabriel Garrett, Geoffrey Churchill and the GoPiGo Connectome project (original connectome-driven-robot concept); Zach Rispoli (ported the *C. elegans* connectome to JavaScript); Seth Miller / `heyseth/worm-sim` (the 302-neuron browser simulation this project was forked from, scaled up to the fly).
- Caveat: this is a small, young repo (single-digit stars at time of writing). Treat it the way you'd treat any dependency you didn't write — read the actual source in `js/` and `data/` before assuming any capability, and have a fallback plan if something in the README doesn't hold up when you run it.

### 2.3 ENGINE-RECORDED — `flybrain` on PyPI (Python, MaleCNS, high-fidelity)

- PyPI: `https://pypi.org/project/flybrain/` (v0.1.0) · Source: `https://github.com/alextitonis/fly.ai` · Homepage: `https://flyaiworld.com`
- What it is: the **complete central nervous system** (brain + optic lobes + ventral nerve cord) of an adult male fly as a spiking network — **166,700 neurons, 25.6 million connections**, from the **MaleCNS v1.0** connectome. This is the number in the project's own subtitle. Nothing in it is trained; you inject input on real neurons and read out what fires.
- It ships almost exactly the circuit this project is about, as its own documented example:

  ```python
  from flybrain import FlyBrain

  brain = FlyBrain(device="auto")
  left_loom = brain.cells(["LC4", "LPLC2"], side="L")   # real looming-detector visual projection neurons
  giant_fiber = brain.cells(["DNp01"], side="L")         # the real Giant Fiber escape command neuron

  for step in range(50):
      fired = brain.step(inject=[(left_loom, 0.8)])
      if set(giant_fiber) & set(fired):
          print(f"left giant fiber fired at {step * brain.dt:.2f} s")
  ```

  LC4/LPLC2 (looming-selective lobula columnar/plate neurons) and DNp01 (the "Giant Fiber," Drosophila's classic escape-command descending neuron) are real, decades-studied cell types, not something to invent — use these exact labels, do not rename them for flavor.
- Also exposes: `Trace` / `run` / `Readout` (reservoir-computing helpers you likely won't need), and `Eyes` / `FeatureDetectors` — a visual encoder that drives the fly's own visual projection neurons, which is the natural place to plug in a rendered looming stimulus rather than injecting hand-picked cell types directly.
- Runtime profile: **not browser-executable.** CPU path uses `numba` (JIT-compiled native code), GPU path needs `CuPy`/CUDA. First run downloads ~260 MB of prebuilt connectome files (or you can build from the ~1.1 GB raw MaleCNS release). Steps take ~12–15 ms on a 24-thread CPU after warmup, ~1.4 ms on an RTX 4060. This is real desktop/server compute, not something that runs inside a browser tab.
- License: **code MIT; connectome data CC BY 4.0** (MaleCNS v1.0 by FlyEM/HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology, and Google Research — `https://male-cns.janelia.org/download/`). CC BY requires attribution wherever the data or its outputs are shown, including exported traces.
- Required citation if you use it: Berg, S. *et al.* (2026). "Sexual dimorphism in the complete connectome of the *Drosophila* male central nervous system." *Cell.* DOI 10.1016/j.cell.2026.08.015 (preprint DOI 10.1101/2025.10.09.680999). Project page: `https://male-cns.janelia.org`.
- The neuron model is credited by its authors to "Fly64" by Jessica Paquette (`github.com/ornata/fly`) — verify that repo's own license directly if you ever vendor code from it rather than just citing it; you are not currently planning to touch its code directly (see §3).

### 2.4 Mandatory verification checklist — do this before writing adapter code

- [ ] Open both URLs above fresh; confirm they still exist and the license files still say what §2.2/§2.3 say.
- [ ] `pip install flybrain` in a scratch venv; run the exact snippet in §2.3; confirm it prints a giant-fiber firing time. If it doesn't work as documented, stop and report to the human rather than guessing at a fix that touches the simulation internals.
- [ ] Clone `snedea/flybrain`; open `index.html` locally; confirm the fly loads and the toolbar behaves as described. Read `js/` far enough to find (a) how a toolbar action turns into a spike injection, and (b) whether individual cell types are queryable or only the four coarse regions are.
- [ ] Re-read both license files verbatim and copy them, unmodified, into `NOTICE.md` (§14) — do not summarize a license from memory.
- [ ] If any of the above has changed or doesn't hold up, do not silently substitute a different repo or invent behavior to compensate — stop and flag it (§18).

---

## 3. Engine decision — the architecture this project uses

**Default architecture: two engines, split by exactly the LIVE-vs-RECORDED line the original brief already asks the UI to draw.**

### 3.1 Runtime (what `npm install && npm run dev` gives anyone who clones this repo)

100% static, browser-only. **`ENGINE-LIVE`** (the FlyWire browser sim) drives the actual chase: mouse-controlled predator, continuous looming stimulus, real-time spike visualization, real escape behavior. Zero backend, zero Python, at runtime — for anyone running the finished repo, including strangers on GitHub/X/Reddit watching the demo clip.

### 3.2 Dev-time only (not shipped, not required to run the app)

A small `precompute/` Python folder wraps **`ENGINE-RECORDED`** (the MaleCNS package) to generate **deterministic JSON trace files**, checked into the repo, that power:

- the guaranteed 20–30s demo replay (§10 requires determinism anyway — precomputing it is not a shortcut, it's the correct way to guarantee it),
- Brain Surgery's intact-vs-lesioned comparison (§12 only ever replays one fixed trajectory twice — it never needs live arbitrary input).

This is why the split is not a compromise: neither of those two features needs low-latency interactivity, so precomputing them with the more scientifically complete, whole-CNS, correctly-named engine is strictly better than trying to fake it with the coarser live engine.

### 3.3 Why this satisfies the brief's own constraints

- "Reuse the existing engine, don't rewrite it" — both engines are used almost entirely as-is; you are writing adapters, not simulators.
- "Run locally, preferably statically in the browser" — the shipped runtime is fully static; Python only ever runs on your machine, ahead of time, to produce data files.
- "No giant backend architecture" — there is no backend, ever, in the shipped app.
- "`npm install && npm run dev` as the first command" — literally true for the shipped app; nobody who clones this repo needs Python installed.
- The LIVE/RECORDED UI distinction the brief asks for (§11) stops being a UI affordance you have to invent and becomes a direct, honest description of which engine actually produced what's on screen.

### 3.4 The alternative, and why it's not the default

You could instead run `ENGINE-RECORDED` live via a small local WebSocket server, so the "true" 166,700-neuron whole-CNS connectome drives the interactive chase too. This is a legitimate engineering choice, but it adds real integration risk (process orchestration, latency handling, packaging so a stranger can still start it easily) inside a 3-day solo budget, and you still have to build the precomputed RECORDED tier regardless, because the guaranteed demo and Brain Surgery both require determinism. If you want to attempt it anyway, treat it as a P3 stretch on top of the default architecture (§5), never as a replacement for it, and never let it put the P0 finish line at risk.

---

## 4. Absolute constraints

**MUST:**
- Reuse `ENGINE-LIVE` and `ENGINE-RECORDED` per §3; do not write your own LIF solver, spike propagation, or connectome parser.
- Keep simulation/adapter code and UI code in separate directories (§7) — the UI must never reach into raw connectome data structures directly.
- Make every replay and every Brain Surgery comparison byte-for-byte deterministic (§10, §13).
- Show only neuron counts, region names, and cell-type labels that the active engine actually reports for whatever is currently on screen (§11).
- Put every third-party project's exact license text in `NOTICE.md` (§14), verbatim, before calling the project "done."

**MUST NOT / NEVER:**
- Fork or rewrite either engine's core simulation logic.
- Claim or imply the fly is thinking, conscious, or has learned anything (§10) — neither engine trains anything.
- Present a precomputed trace as if it were the live simulation, or vice versa (§11).
- Invent a cell type, brain region, or neuron count that isn't sourced from one of the two engines' own data.
- Add accounts, a database, authentication, a cloud backend, social features, multiplayer, or extra AI agents. If a feature idea needs any of these, it does not belong in this project.

---

## 5. Scope, priority order, and a 3-day schedule

Priority order (unchanged from the brief — if time runs out, this is the cut line, in this exact order):

| Tier | Contents |
|---|---|
| **P0** | Fly visible · predator visible · working encounter · working connectome integration (`ENGINE-LIVE`) |
| **P1** | Cyberpunk-lab visual pass · live brain activity panel · deterministic replay |
| **P2** | Brain Surgery · intact-vs-lesioned comparison (`ENGINE-RECORDED` precompute) |
| **P3** | 3D brain toggle · sound · particles · extra telemetry · (optionally) a live `ENGINE-RECORDED` backend per §3.4 |

Suggested day-by-day checkpoints — adjust the hours, not the order:

- **Day 1 — finish P0.** Run the §2.4 verification checklist. Scaffold Vite + TS. Vendor `ENGINE-LIVE`'s connectome loader and worker; get a fly rendered and idling. Build the predator entity (mouse-follow) and a distance-to-looming-intensity function. Read `ENGINE-LIVE`'s source far enough to find its real injection point, then wire looming intensity into it. Commit/tag once you can watch the fly visibly react as the predator closes in — that's the P0 finish line.
- **Day 2 — P1, and start P2's data.** Build the right-side brain panel (counts, region breakdown, spike history, reaction latency) reading only real `ENGINE-LIVE` output. Do the dark/glowing visual pass on the arena and panel. Build the home screen and countdown. Design and freeze the input-log replay format (§13); script and record the one canonical demo encounter (§9) as an input log. In parallel, stand up `precompute/`: install `ENGINE-RECORDED`, get the LC4/LPLC2 → DNp01 example running locally, and generate the first "intact" trace for the *same* canonical predator path used in the live demo, so the numbers in both modes tell a consistent story.
- **Day 3 — finish P2, then P3 only if time remains.** Build Brain Surgery's UI; generate 2–3 lesion trace variants from `precompute/` (start with the visual pathway and the giant fiber — see §12). Wire up intact-vs-lesioned. Add the LIVE/RECORDED badge everywhere brain data is shown (§11). Build the About/Scientific-limits drawer (§10). Write `NOTICE.md` and `README.md` (§14, §16). Do a mobile-layout pass, a WebGL-failure fallback, and a console-error sweep. Clean up git history into meaningful commits (§15). Record the 20–30s demo clip. Only then, if hours remain, reach into P3.

**Scope-creep tripwires — stop yourself the moment one of these is true:**
- You're about to implement your own spiking-neuron solver → stop, one already exists in both engines.
- You're about to hand-parse raw MaleCNS EM connectivity files → stop, use `ENGINE-RECORDED`'s own loader.
- You've spent more than ~2 hours on any single P2/P3 item while a P0/P1 item is still red → stop, drop back down.
- You're reaching for a database, an account system, or a cloud endpoint to make replay "shareable" → stop, a replay is a JSON blob; a file download/upload (or a URL-encoded blob) is enough.
- You're tempted to soften a scientific-honesty rule (§10) to make a screenshot more impressive → stop, cut a visual feature instead; honesty is not in the cuttable tier.

---

## 6. Explicitly forbidden

No accounts · no database · no authentication · no cloud backend · no social features · no multiplayer beyond the single local user vs. simulation · no extra AI agents bolted onto the experience · no giant custom backend of any kind · no rewriting either engine's neuroscience code · no fabricated metrics, counts, or cell types · no drawing individual synapses as DOM elements (use particles/instancing/heatmaps) · no broken mobile layout · no console errors in normal use.

---

## 7. Repository structure

```
fly-escape/
├── AGENTS.md                 # this file (and/or GEMINI.md)
├── README.md
├── NOTICE.md                 # verbatim third-party licenses + attribution (§14)
├── LICENSE                   # this project's own license (MIT recommended)
├── package.json / vite.config.ts / index.html
├── src/
│   ├── app/                  # screens: Home, Experiment, Replay, BrainSurgery, About
│   ├── engine/
│   │   ├── live/             # ENGINE-LIVE adapter: worker wrapper + the NEW looming channel
│   │   ├── recorded/         # ENGINE-RECORDED trace consumer — reads static JSON only, no Python here
│   │   └── shared/           # region/cell-type labels (sourced, never invented) + pure metric functions
│   ├── ui/                   # Arena, BrainPanel, BrainView3D, ExperimentSummary, ReplayControls, BrainSurgeryPanel, AboutDrawer, LiveOrRecordedBadge
│   └── state/                # game/app state, seeded RNG, input-log format (§13)
├── precompute/                # OFFLINE Python tooling — never imported by the web app at runtime
│   ├── README.md              # states up front: "you do not need Python to run the app"
│   ├── requirements.txt       # flybrain, etc.
│   ├── generate_demo_trace.py
│   └── generate_lesion_traces.py
├── public/traces/             # checked-in JSON output from precompute/ — this is what recorded/ reads
├── vendor/                    # ENGINE-LIVE source you copy in, with its license.md preserved alongside
└── tests/
```

Simulation/adapter code and UI code must not import across the `engine/` ↔ `ui/` boundary except through the narrow interfaces in `engine/shared`. This is what makes it possible to swap or upgrade either engine later without touching the visuals.

---

## 8. Tech stack

- TypeScript, Vite, React only if it genuinely helps (this app is animation-and-canvas-heavy; plain TS + Three.js may need less ceremony than React for the Arena specifically — your call).
- Three.js for 3D; Canvas/WebGL for 2D and the particle/heatmap brain visuals; a Web Worker for `ENGINE-LIVE`'s simulation loop so the render thread never blocks.
- No large libraries without a specific reason. No state-management framework for a project this size — plain state modules are enough.
- `precompute/` is an isolated Python project (its own `requirements.txt`); it must never be imported by, or become a runtime dependency of, the Vite app.

---

## 9. Visual design and the primary experience

Aesthetic: scientific instrument crossed with a cyberpunk laboratory — near-black background, thin technical typography, glowing particle-rendered neurons, a subtle grid/scanline texture, large numerical telemetry, smooth transitions. Not a generic admin dashboard, not a childish game UI.

Layout: left/main is the arena (dark, minimal, the fly and predator clearly visible, smooth animation); right panel is the live brain — total active neurons, activity by region, sensory/motor/escape activity where the engine actually reports it, a spike-rate history, reaction latency. A "BRAIN VIEW" toggle switches to a stylized 3D pulse that visibly travels **visual input → sensory → central processing → motor → escape**, using only labels the active engine actually provides.

Home screen: title, subtitle ("Can you catch a 166,000-neuron brain?" — the number belongs to `ENGINE-RECORDED`; see §11 for how to keep this honest once the live mode is running on `ENGINE-LIVE`'s 139,255), a footer reading "Connectome-based computational neuroscience experiment," a `[ START EXPERIMENT ]` button, then a 3…2…1…"FLY RELEASED" countdown into the encounter.

---

## 10. Scientific honesty

**Never write, in any UI copy, README line, or code comment intended for a reader:**
- "The real fly is thinking" / "the fly brain learned how to escape" / "we recreated a conscious fly" — or any variant implying sentience, learning, or training. Neither engine trains anything; both are fixed, real wiring driven by injected input.
- The bare word "AI" to describe the connectome simulation itself. (`ENGINE-RECORDED`'s own upstream project brands itself with "ai" in its name — that's their call; ours should be more precise. Call it a *connectome-based neural simulation* or a *leaky integrate-and-fire model over real synaptic wiring data*, not "AI.")
- Any neuron count, region name, or cell type not actually sourced from one of the two engines' own data for whatever is currently on screen.

**Always distinguish, in the About/Scientific-limits drawer:** published biological wiring (the real EM-reconstructed connectome) vs. the computational neuron model (a leaky-integrate-and-fire approximation, not literally how biological neurons work) vs. the engineering interface (this app's adapters and UI) vs. the user-created environment (the arena, the predator's motion — invented by you, not biological) vs. any behavioral approximation (the fly's on-screen movement is your interpretation of motor output, not independently validated animal behavior).

The drawer must state, in plain language, both citations from §2.2/§2.3, both licenses, and a link to both upstream projects.

---

## 11. LIVE vs RECORDED — non-negotiable UI contract

Whenever brain data is on screen, an unmissable, persistent badge states which mode produced it — for example "● LIVE SIMULATION — ENGINE-LIVE, 139,255 neurons, FlyWire FAFB (brain)" in one state, "◆ RECORDED REPLAY — ENGINE-RECORDED precompute, 166,700 neurons, MaleCNS v1.0 (whole CNS)" in the other. The exact neuron count shown **must match the engine that actually produced the data currently displayed** — never show 166,700 while `ENGINE-LIVE` is running, and never show 139,255 while replaying an `ENGINE-RECORDED` trace. If this makes the homepage subtitle and the live-mode counter disagree, that's correct and expected — resolve it with copy ("the full 166,000-neuron whole-CNS model powers Brain Surgery's recorded comparisons; live encounters run on a 139,000-neuron real-time build of the same fly's visual system"), not by fudging a number.

---

## 12. Brain Surgery

Built entirely on `ENGINE-RECORDED`, offline, via `precompute/`. Steps:

1. Before writing any lesion code, check whether the installed `flybrain` package already exposes a native silencing/ablation mechanism (look for anything like a mask, a `silence(...)`, or an excluded-population argument in its actual installed source — do not assume one exists or doesn't from this document alone).
2. If nothing native exists, use the smallest defensible fallback: identify the target population's neuron IDs via `brain.cells([...])`, then force those IDs to never appear in the `fired` set (or zero their outgoing weights) at every step, before running the same fixed input log through the network again.
3. Start with only groups that map cleanly onto real cell types the package already exposes — the visual/looming pathway (`LC4`, `LPLC2`) and the escape command neuron (`DNp01`) are confirmed to exist per §2.3. Only add a third group (e.g., a broader descending/motor population) once you've confirmed its exact label by introspecting the installed package, not by guessing at a name that sounds plausible.
4. Re-run the *identical* recorded predator trajectory (same input log as the canonical demo) once intact and once per lesion, and report: trajectory comparison, reaction-latency comparison, survival comparison, neural-activity comparison. Label the result "recorded" per §11 — Brain Surgery is never live.

---

## 13. Replay determinism

- Fix the timestep and seed every source of randomness (predator-entry variation, any stochastic element of either engine) from a single seed stored with the run.
- Record encounters as a plain input log: an ordered list of `{ t, mouseX, mouseY }` samples (or equivalent), not as a video and not as a description — a replay is a re-play of the exact same input through the exact same seeded simulation, nothing more.
- A "replay" that produces a different outcome on a second run is a bug, not an acceptable feature — fix it before moving on, it will otherwise quietly break Brain Surgery's comparisons too.
- Exporting/importing a saved encounter is just a file download/upload of that JSON blob (see §6 — no backend needed for this).

---

## 14. Attribution — required `NOTICE.md` content

Copy each license verbatim (§2.4), then list, at minimum:

- `ENGINE-LIVE`: MIT license text; credits to the FlyWire Consortium, the GoPiGo Connectome project (Busbice, Garrett, Churchill), Zach Rispoli, and Seth Miller / `heyseth/worm-sim`; the Dorkenwald et al. 2024 *Nature* citation.
- `ENGINE-RECORDED`: MIT license text for the code; CC BY 4.0 notice for the MaleCNS v1.0 data (FlyEM/HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology, Google Research); the Berg et al. 2026 *Cell* citation; a note that the neuron model follows "Fly64" by Jessica Paquette.
- A one-line statement of this project's own license (MIT recommended) for the code you wrote.

---

## 15. Git discipline

One logical change per commit, using conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`) — for example `feat: integrate ENGINE-LIVE connectome adapter`, `feat: add looming stimulus channel`, `feat: add deterministic replay`, `feat: add brain surgery lesion experiment`, `docs: add architecture and attribution`. No single commit containing the whole project. History should read like a real project's, because it will be public.

---

## 16. README checklist

- [ ] Hero image or GIF of the demo
- [ ] One-sentence description
- [ ] Why this exists
- [ ] Architecture diagram (the LIVE/RECORDED split from §3 is the diagram)
- [ ] How the connectome is used, for each engine
- [ ] What's biological vs. engineered (mirrors §10)
- [ ] Install / run instructions — must be exactly `npm install` then `npm run dev` for the shipped app; Python only mentioned under an optional "regenerating the recorded traces" section
- [ ] Link to the recorded demo clip
- [ ] Brain Surgery explanation
- [ ] Limitations
- [ ] Attribution (point to `NOTICE.md`)
- [ ] Both licenses named explicitly
- [ ] Both scientific references, cited in full (§2.2, §2.3)

No overclaiming anywhere in this file — it's the first thing a stranger reads.

---

## 17. Definition of done

- [ ] No fabricated metrics, counts, or cell types anywhere in the UI
- [ ] Every neuron count on screen matches its engine, per §11
- [ ] No massive duplicated upstream code — both engines are adapted, not copied wholesale
- [ ] No broken mobile layout
- [ ] No console errors during normal use
- [ ] No backend of any kind at runtime
- [ ] Loading/progress UI for the connectome data and any other large asset
- [ ] Graceful fallback if WebGL is unavailable
- [ ] Replay is provably deterministic (run it twice, diff the result)
- [ ] Simulation/adapter code is separated from UI code per §7
- [ ] `NOTICE.md` is complete per §14
- [ ] The About/Scientific-limits drawer exists and says what §10 requires

---

## 18. When to stop and ask the human instead of guessing

- Anything in §2 no longer checks out against the live source (repo gone, license changed, API different from documented) — report it, don't silently substitute a different project or invent the missing behavior.
- P0 isn't fully green by the end of Day 1 — report it and re-scope, rather than quietly dropping a scientific-honesty rule (§10) or the determinism requirement (§13) to catch up.
- You're seriously considering the live-backend alternative in §3.4 — flag it before building it; it's a real scope decision, not something to fall into mid-implementation.
- You're unsure whether a proposed brain region or cell-type label is real or invented — check the installed package's own data before shipping it; if you can't confirm it, don't use it, ask instead.
