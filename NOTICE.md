# NOTICE

This project, FLY ESCAPE, incorporates and builds upon existing open-source connectome simulation software and datasets under their respective open-source licenses.

---

## 1. This Project (FLY ESCAPE)

Copyright (c) 2026 FLY ESCAPE Contributors.
The custom application code, UI, adapters, and visualizations created for this project are licensed under the MIT License (see `LICENSE`).

---

## 2. ENGINE-LIVE (`snedea/flybrain`)

- Source: https://github.com/snedea/flybrain
- Hosted: https://flybrain.app
- Connectome Dataset: FlyWire FAFB v783 (139,255 neurons, ~2.7M connections)
- Primary Scientific Citation:
  Dorkenwald, S., Matsliah, A., Sterling, A.R. *et al.* "Neuronal wiring diagram of an adult brain." *Nature* 634, 124–138 (2024). https://doi.org/10.1038/s41586-024-07558-y
- Dataset Source: FlyWire Codex public dataset (codex.flywire.ai)
- Lineage & Attribution Chain:
  - The FlyWire Consortium (mapping and proofreading the whole adult fly brain)
  - Timothy Busbice, Gabriel Garrett, Geoffrey Churchill and the GoPiGo Connectome project (original connectome-driven robot concept)
  - Zach Rispoli (ported the *C. elegans* connectome to JavaScript)
  - Seth Miller / `heyseth/worm-sim` (the 302-neuron browser simulation scaled up to the Drosophila brain)

### Verbatim License Text (MIT License):
```
MIT License

Copyright (c) [2017] [Seth Miller]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. ENGINE-RECORDED (`flybrain` / `alextitonis/fly.ai`)

- PyPI: https://pypi.org/project/flybrain/ (v0.1.0)
- Source: https://github.com/alextitonis/fly.ai
- Homepage: https://flyaiworld.com
- Connectome Dataset: MaleCNS v1.0 (complete central nervous system: brain + optic lobes + ventral nerve cord; 166,700 neurons, 25.6M synaptic connections)
- Primary Scientific Citation:
  Berg, S. *et al.* (2026). "Sexual dimorphism in the complete connectome of the *Drosophila* male central nervous system." *Cell.* DOI: 10.1016/j.cell.2026.08.015 (preprint DOI: 10.1101/2025.10.09.680999).
- Project Page: https://male-cns.janelia.org
- Connectome Data License: Creative Commons Attribution 4.0 International (CC BY 4.0).
  Data provided by FlyEM/HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology, and Google Research.
- Neuron Model Attribution: The LIF simulation model follows "Fly64" by Jessica Paquette (https://github.com/ornata/fly).

### Verbatim License Text for Code (MIT License):
```
MIT License

Copyright (c) 2025-2026 Alex Titonis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Data Attribution Notice (CC BY 4.0):
```
MaleCNS v1.0 connectome data by FlyEM/HHMI Janelia, University of Cambridge,
MRC Laboratory of Molecular Biology, and Google Research (https://male-cns.janelia.org).
Licensed under Creative Commons Attribution 4.0 International License (CC BY 4.0).
https://creativecommons.org/licenses/by/4.0/
```
