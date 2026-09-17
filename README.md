# FLY ESCAPE: Can You Catch a 166,000-Neuron Brain?

> A browser-native computational neuroscience experiment where a simulated fruit fly (*Drosophila melanogaster*), driven by genuine connectome-based neural simulations, reacts in real time to a mouse-steered looming predator.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Connectome: FlyWire FAFB v783](https://img.shields.io/badge/Connectome-FlyWire%20FAFB%20v783-cyan.svg)](https://codex.flywire.ai)
[![Connectome: MaleCNS v1.0](https://img.shields.io/badge/Connectome-MaleCNS%20v1.0-emerald.svg)](https://male-cns.janelia.org)
[![Runtime: 100% Static Browser](https://img.shields.io/badge/Runtime-Static%20Browser%20(Vite%2BTS)-purple.svg)](#quickstart)

---

## 1. Why This Exists

Over the past few years, the neuroscience community achieved historic milestones: the complete electron-microscopy reconstruction of the adult *Drosophila melanogaster* brain (FlyWire Consortium, 2024) and the whole male central nervous system (FlyEM/HHMI Janelia, 2026).

**FLY ESCAPE** brings these datasets to life in an interactive, accessible browser application. Rather than treating connectomes as static graphs or offline databases, FLY ESCAPE places the simulated fly into a closed-loop behavioral encounter against the user's cursor. The objective is simple: **steer a looming predator and try to catch the fly before its visual looming circuit triggers escape.**

---

## 2. Architecture: The LIVE vs. RECORDED Engine Split

To balance real-time, zero-backend browser interactivity with whole-CNS biophysical fidelity, FLY ESCAPE employs an explicit two-engine architecture:

```
+-----------------------------------------------------------------------------+
|                                 FLY ESCAPE                                  |
+-----------------------------------------------------------------------------+
               │                                             │
               ▼                                             ▼
  ┌─────────────────────────┐                   ┌─────────────────────────┐
  │       ENGINE-LIVE       │                   │     ENGINE-RECORDED     │
  │    (FlyWire FAFB v783)  │                   │     (MaleCNS v1.0)      │
  │     139,255 neurons     │                   │     166,700 neurons     │
  │     ~2.7M synapses      │                   │     25.6M synapses      │
  └────────────┬────────────┘                   └────────────┬────────────┘
               │                                             │
      Browser Web Worker                            Offline Python Tooling
      (Real-time LIF simulation)                    (High-fidelity whole CNS)
               │                                             │
               ▼                                             ▼
  ┌─────────────────────────┐                   ┌─────────────────────────┐
  │   Interactive Chase     │                   │   Deterministic Traces  │
  │ • Mouse predator input  │                   │ • Canonical 25s Demo    │
  │ • Dynamic light gradients│                  │ • Brain Surgery Lesions │
  │ • Real-time 2D/3D spikes│                   │ • LC4/LPLC2 vs DNp01    │
  └─────────────────────────┘                   └─────────────────────────┘
```

### 2.1 Runtime (`ENGINE-LIVE`: `snedea/flybrain`)
- **100% Static Browser Execution**: Runs inside a dedicated Web Worker using Leaky Integrate-and-Fire (LIF) dynamics. Zero backend, zero Python, zero server latency.
- **Dataset**: FlyWire FAFB v783 public connectome (139,255 neurons, ~2.7 million connections).
- **Looming Stimulus Channel**: Measures predator distance $D(t)$ and visual looming angle $\theta(t) = 2 \arctan(R / D(t))$ and expansion rate $d\theta/dt$. Translates motion into retinotopic ommatidia activation across compound eye hemispheres and injects current into optic lobe and central neurons.
- **Visual Light Gradient Inspector**: Directly simulates how directional light gradients across the compound eye stimulate distinct brain neuropils (Optic Lobes, Medulla, Lobula, Central Complex, Descending Motor Command).

### 2.2 Dev-Time Precompute (`ENGINE-RECORDED`: `flybrain` MaleCNS v1.0)
- **High-Fidelity Whole CNS**: 166,700 neurons and 25.6 million synapses encompassing the brain, optic lobes, and ventral nerve cord (VNC).
- **Deterministic Trace Engine**: The offline `precompute/` scripts execute identical predator trajectories through the exact connectome to generate byte-for-byte reproducible JSON traces.
- **Powers**:
  1. **Canonical Replay**: Guaranteed 25-second reproducible encounter showing Giant Fiber (`DNp01`) escape threshold.
  2. **Brain Surgery**: In-silico comparative lesion experiments (Intact vs. Silenced Lobula Columnar `LC4/LPLC2` vs. Silenced Giant Fiber `DNp01`).

---

## 3. Retinotopic Receptive Field & Neuropil Light Gradients

As requested, FLY ESCAPE features an interactive **Compound Eye Receptive Field & Neuropil Gradient Inspector**:

1. **Ommatidia Array Visualization**: Renders both compound eyes (left and right hemispheres) containing 40 visual ommatidia facets mapped across a 270° field of view.
2. **Dynamic Light Gradients**: As the user moves the predator, azimuth ($\phi$) and looming intensity modulate the photon flux gradient illuminating the eye.
3. **Neuropil Reaction Readout**: Real-time spectral meters display the downstream signal propagation across five key Drosophila brain neuropils:
   - **Optic Lobes (Lamina / Medulla)**: Primary visual motion detection ($R1-R6$, $L1-L4$).
   - **Lobula / Lobula Plate**: Looming-selective feature extraction (`LC4`, `LPLC2`).
   - **Central Complex**: Spatial orientation and flight heading modulation (Protocerebral Bridge, Ellipsoid Body).
   - **Descending Command**: High-velocity escape command triggering (`DNp01` Giant Fiber).

---

## 4. What is Biological vs. Engineered

To maintain strict scientific honesty, FLY ESCAPE explicitly documents the boundary between biological ground truth and computational modeling:

| Domain | Biological Ground Truth | Computational Approximation / Engineering |
| :--- | :--- | :--- |
| **Circuit Topology** | Complete synaptic connectivity from electron microscopy (FlyWire FAFB & MaleCNS v1.0). | Thresholded edge weights and fixed excitatory/inhibitory sign assignments. |
| **Neuron Dynamics** | Biological neurons exhibit graded potentials, complex dendritic integration, and ion channel kinetics. | Point-neuron Leaky Integrate-and-Fire (LIF) model with fixed membrane time constants. |
| **Visual Stimulus** | Natural compound eyes with ~800 ommatidia per eye, motion-sensitive T4/T5 circuits. | Continuous optical looming equations $\theta(t) = 2 \arctan(R / D(t))$ mapped onto synthetic ommatidia. |
| **Locomotion** | Complex aerodynamic wing biomechanics and thoracic muscle actuation. | Simplified 2D kinematic simulation (turn rate and thrust driven by motor neuron populations). |
| **Plasticity** | Real brains exhibit neuromodulation, habituation, and synaptic plasticity. | **Static connectome with zero learning or training.** The fly does not learn; its escape is an innate reflex circuit. |

---

## 5. Brain Surgery: Comparative In-Silico Lesions

The **Brain Surgery** laboratory allows users to perform targeted genetic ablations and observe the resulting behavioral failure modes under an identical recorded predator trajectory:

1. **Control (Intact Whole-CNS)**:
   - Looming stimulus is detected by Lobula Columnar neurons (`LC4`, `LPLC2`).
   - Excitation propagates to the Giant Fiber (`DNp01`) escape command neuron.
   - `DNp01` reaches threshold at $t = 40\text{ ms}$; the fly executes an evasive takeoff jump and **escapes**.
2. **Sensory Ablation (`LC4` & `LPLC2` Silenced — 311 visual neurons)**:
   - The visual looming pathway is blocked; downstream Giant Fiber never fires.
   - The fly remains stationary and is **caught**.
3. **Motor Command Ablation (`DNp01` Silenced — 2 Giant Fiber neurons)**:
   - Looming threat is successfully detected in the optic lobes, but the descending command pathway to thoracic motor neurons is severed.
   - Takeoff reflex fails; the fly is **caught**.

---

## 6. Quickstart

Running FLY ESCAPE requires **no Python, no database, and no server configuration**:

```bash
# 1. Clone the repository
git clone https://github.com/anbu/fly-escape.git
cd fly-escape

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in any modern browser supporting WebGL (Chrome, Firefox, Safari, Edge).

### Running Unit Tests & Production Build

```bash
# Run deterministic test suite (Vitest)
npm test

# Build production bundle
npm run build
```

---

## 7. Optional: Regenerating Recorded Traces (`precompute/`)

Precomputed deterministic traces (`public/traces/*.json`) are already committed to the repository. If you wish to regenerate them using `ENGINE-RECORDED` (`flybrain` Python package):

```bash
cd precompute
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run whole-CNS connectome simulations
python generate_demo_trace.py
python generate_lesion_traces.py
```

*Note: Precompute downloads ~260 MB of prebuilt MaleCNS v1.0 connectome data on first run.*

---

## 8. Attribution & Scientific Citations

Detailed copyright notices and verbatim license files are documented in [NOTICE.md](NOTICE.md).

### Upstream Software & Connectome Lineage

- **ENGINE-LIVE (`snedea/flybrain`)**:
  - Source: [https://github.com/snedea/flybrain](https://github.com/snedea/flybrain) (MIT License)
  - Citations: Dorkenwald, S., Matsliah, A., Sterling, A.R. *et al.* "Neuronal wiring diagram of an adult brain." *Nature* 634, 124–138 (2024). [doi:10.1038/s41586-024-07558-y](https://doi.org/10.1038/s41586-024-07558-y)
  - Connectome Data: FlyWire Codex public dataset ([codex.flywire.ai](https://codex.flywire.ai))
  - Attribution: FlyWire Consortium, Timothy Busbice, Gabriel Garrett, Geoffrey Churchill (GoPiGo Connectome), Zach Rispoli, Seth Miller (`worm-sim`).

- **ENGINE-RECORDED (`flybrain` / `alextitonis/fly.ai`)**:
  - PyPI: [https://pypi.org/project/flybrain/](https://pypi.org/project/flybrain/) | Source: [https://github.com/alextitonis/fly.ai](https://github.com/alextitonis/fly.ai) (MIT License)
  - Connectome Data: MaleCNS v1.0 licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
  - Citation: Berg, S. *et al.* (2026). "Sexual dimorphism in the complete connectome of the *Drosophila* male central nervous system." *Cell.* [doi:10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015)
  - Data Providers: FlyEM/HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology, Google Research ([male-cns.janelia.org](https://male-cns.janelia.org)).
  - Neuron Model: Jessica Paquette ("Fly64", [github.com/ornata/fly](https://github.com/ornata/fly)).

---

## 9. License

- FLY ESCAPE application source code: **MIT License** (see [LICENSE](LICENSE)).
- Connectome datasets: FlyWire FAFB data (FlyWire terms) and MaleCNS v1.0 data (**CC BY 4.0**). See [NOTICE.md](NOTICE.md) for full notices.
