# OFFLINE Python Precompute Tooling

> **IMPORTANT**: You do **not** need Python installed to run the FLY ESCAPE web application!
> The application runtime is 100% static in the browser (`npm install && npm run dev`).
> This directory is dev-time tooling used only to generate the deterministic recorded traces (`public/traces/*.json`) using `ENGINE-RECORDED` (`flybrain` MaleCNS v1.0).

---

## What this does

- `generate_demo_trace.py`: Runs a canonical 25-second predator encounter through the full 166,700-neuron MaleCNS connectome to produce `public/traces/canonical_demo.json`.
- `generate_lesion_traces.py`: Runs the identical predator trajectory across 3 conditions:
  1. **Intact**: Normal Whole-CNS connectome.
  2. **LC4/LPLC2 Lesion**: Silences the lobula columnar visual looming pathway; threat is undetected.
  3. **DNp01 Lesion**: Silences the Giant Fiber descending command neuron; looming is detected in the optic lobes but takeoff command is severed.

## Running

```bash
pip install -r requirements.txt
python generate_demo_trace.py
python generate_lesion_traces.py
```
