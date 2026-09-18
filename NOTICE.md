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

---

## 4. React Bits (UI motion effects)

**This is NOT a plain MIT dependency. Read the condition below before reusing
`src/ui/design/effects.ts`.**

React Bits is licensed **MIT + Commons Clause License Condition v1.0** (GitHub
reports its SPDX identifier as `NOASSERTION`, i.e. not a standard OSI license).
Verified against the upstream `LICENSE.md` on 2026-09-18.

The interface's motion primitives — `CountUp`, `DecryptedText`, `DotGrid`,
`ClickSpark` and `AnimatedContent` — were **hand-ported from React to plain
TypeScript** for this project. No React Bits source is vendored; the code in
`src/ui/design/effects.ts` is original TypeScript written against the behaviour
of the originals. The designs are theirs.

**How the Commons Clause applies here.** The licence permits distributing the
Software "as part of an application, website, or product", which is what this
project does. It forbids selling, sublicensing or redistributing "the components
themselves — whether alone, in a bundle, **or as a ported version**". So:

- Using these effects inside FLY ESCAPE: permitted.
- Lifting `src/ui/design/effects.ts` out and republishing it as a component
  library, ported or otherwise: **not permitted** by the upstream condition.

That restriction travels with the effects module even though this project's own
code is MIT, and `src/ui/design/effects.ts` therefore is not covered by this
project's MIT grant to the extent it embodies React Bits' designs.

- Project: React Bits — <https://reactbits.dev>
- Source: <https://github.com/DavidHDev/react-bits>

### Verbatim License Text (MIT + Commons Clause License Condition v1.0):

```
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 5. Escape physiology — literature cited in the interface

The escape model in `src/engine/shared/EscapeModel.ts` implements published
findings. These are citations, not code dependencies; no text or figures are
reproduced.

- von Reyn, C.R. *et al.* "A spike-timing mechanism for action selection."
  *Nature Neuroscience* **17**, 962–970 (2014). doi:10.1038/nn.3741
- Ache, J.M. *et al.* "Neural Basis for Looming Size and Velocity Encoding in the
  *Drosophila* Giant Fiber Escape Pathway." *Current Biology* **29**,
  1073–1081 (2019). doi:10.1016/j.cub.2019.01.079
- Klapoetke, N.C. *et al.* "Ultra-selective looming detection from radial motion
  opponency." *Nature* **551**, 237–241 (2017). doi:10.1038/nature24626
