/**
 * AboutDrawer.ts
 *
 * Implements the About & Scientific Limits drawer strictly conforming to §10 of AGENTS.md.
 * Clearly separates biological facts, computational models, engineering interfaces, and limitations.
 */

export class AboutDrawer {
  private container: HTMLElement;
  private isOpen: boolean = false;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'aboutDrawer';
    this.container.className = 'about-drawer';
    parentElement.appendChild(this.container);

    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="drawer-overlay" id="drawerOverlay"></div>
      <div class="drawer-content">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <span class="drawer-badge">SCIENTIFIC DISCLOSURE & LIMITATIONS</span>
            <h2>ABOUT THE SIMULATION & CONNECTOME</h2>
          </div>
          <button type="button" class="close-drawer-btn" id="btnCloseDrawer">✕</button>
        </div>

        <div class="drawer-scrollable">
          <!-- Non-negotiable scientific distinctions per §10 -->
          <div class="disclosure-card">
            <h3>1. Published Biological Wiring vs. Computational Model</h3>
            <p>
              <strong>The Connectomes:</strong> The anatomical wiring diagrams used in this project are derived from genuine,
              empirically reconstructed electron microscopy (EM) datasets of the adult fruit fly (<em>Drosophila melanogaster</em>).
            </p>
            <ul>
              <li>
                <strong>ENGINE-LIVE:</strong> Runs the <strong>FlyWire FAFB v783</strong> connectome
                (139,255 neurons, ~2.7M synaptic connections) mapped by the FlyWire Consortium.
                <br /><em>Citation:</em> Dorkenwald, S. et al. "Neuronal wiring diagram of an adult brain." <em>Nature</em> 634, 124–138 (2024).
              </li>
              <li>
                <strong>ENGINE-RECORDED:</strong> Runs the <strong>MaleCNS v1.0</strong> whole central nervous system connectome
                (166,700 neurons, 25.6M synaptic connections) by HHMI Janelia, Cambridge, MRC LMB, and Google Research.
                <br /><em>Citation:</em> Berg, S. et al. "Sexual dimorphism in the complete connectome of the <em>Drosophila</em> male central nervous system." <em>Cell</em> (2026).
              </li>
            </ul>
            <p>
              <strong>The Computational Model:</strong> Biological neurons are complex biochemical entities with continuous
              membrane dynamics, graded potentials, and neuromodulators. The simulation model used here is a
              <strong>Leaky Integrate-and-Fire (LIF)</strong> mathematical abstraction—a simplified spiking model where membrane voltage decays
              exponentially and emits discrete spikes upon crossing threshold. It is not an exact biophysical replica of intracellular dynamics.
            </p>
          </div>

          <div class="disclosure-card">
            <h3>2. What the live engine can and cannot resolve</h3>
            <p>
              This is the most important limitation on this page, and it is the one an
              earlier version of this interface obscured.
            </p>
            <p>
              <strong>ENGINE-LIVE</strong> rolls FlyWire FAFB v783 into 63 neuropil groups.
              That is enough to drive and observe the lobula, but
              <strong>LC4</strong>, <strong>LPLC2</strong> and <strong>DNp01</strong> (the
              giant fiber) are <em>not addressable populations</em> in it. Live encounters
              therefore show <em>real measured lobula activity</em> driving a
              <em>modelled</em> escape decision — not a measurement of the giant fiber.
            </p>
            <p>
              Two further consequences we state rather than hide:
            </p>
            <ul>
              <li>
                <strong>No motor output.</strong> Every descending and leg/wing motor group
                in this dataset contains zero neurons. The live motor population totals 76
                neurons. The fly's rendered movement is our interpretation, not a readout.
              </li>
              <li>
                <strong>No left/right signal.</strong> The groups are not lateralised, so the
                live connectome cannot tell the fly which way to turn. Escape direction is
                computed from stimulus geometry and is labelled <em>AUTHORED</em> throughout.
              </li>
            </ul>
            <p>
              To lesion the actual looming detectors and the actual giant fiber, the
              experiment has to move to <strong>ENGINE-RECORDED</strong> (MaleCNS v1.0),
              which does resolve them. That is exactly what <strong>Brain Surgery</strong>
              does, and why it is recorded rather than live.
            </p>
          </div>

          <div class="disclosure-card">
            <h3>3. How to read every number in this interface</h3>
            <p>
              Each value carries a mark saying where it came from. The mark is a shape
              first and a colour second, so it survives greyscale and colour-blind vision.
            </p>
            <ul>
              <li><strong>&#9679; MEASURED</strong> — read directly from the engine producing what is on screen.</li>
              <li><strong>&#9680; DERIVED</strong> — computed from measured values; the formula is shown.</li>
              <li><strong>&#9670; PUBLISHED</strong> — a real literature measurement, <em>not</em> produced by this simulation.</li>
              <li><strong>&#9671; MODELLED</strong> — a modelling choice made by this project, informed by the literature.</li>
              <li><strong>&#9675; AUTHORED</strong> — invented here. The arena, the predator and the rendered body are not biology.</li>
            </ul>
            <p>
              The escape decision follows the published LC4/LPLC2 decomposition: LC4 encodes
              angular <em>velocity</em> roughly linearly, LPLC2 encodes angular <em>size</em> as a
              Gaussian peaked near 42&deg;, and giant-fiber-mediated takeoff becomes likely
              around a 39&deg; angular size.
              <br /><em>Citations:</em> von Reyn, C.R. et al. "A spike-timing mechanism for
              action selection." <em>Nature Neuroscience</em> 17, 962&ndash;970 (2014).
              Ache, J.M. et al. "Neural Basis for Looming Size and Velocity Encoding in the
              Drosophila Giant Fiber Escape Pathway." <em>Current Biology</em> 29, 1073&ndash;1081 (2019).
            </p>
          </div>

          <div class="disclosure-card">
            <h3>4. What is Biological vs. What is Engineered</h3>
            <ul>
              <li>
                <strong>Biological:</strong> The synaptic adjacency matrix (who connects to whom), synapse counts, cell-type classifications
                (e.g., LC4, LPLC2, DNp01), and polarity (excitatory vs. inhibitory).
              </li>
              <li>
                <strong>Engineered:</strong> The 2D visual arena, the mouse-controlled predator entity, the distance-to-looming
                intensity mapping function, and the kinematics translation from descending motor spikes to screen velocity.
              </li>
              <li>
                <strong>Behavioral Interpretation:</strong> While real fruit flies use LC4/LPLC2 visual projection neurons to activate
                Giant Fiber DNp01 for jump takeoff, the exact flight trajectory and banking movements shown on screen are an engineering
                interpretation of motor activation, not independently validated biomechanical flight recordings.
              </li>
            </ul>
          </div>

          <div class="disclosure-card">
            <h3>5. Scientific Honesty &amp; Non-Sentience Guarantee</h3>
            <p>
              Neither engine trains any weights or learns anything. There is <strong>no machine learning, artificial intelligence,
              or consciousness</strong> in this system. Behavior emerges strictly from signal propagation across real, fixed biological wiring.
              The fly does not "think" or "learn"—it is an electrophysiological circuit model responding to sensory current injection.
            </p>
          </div>

          <div class="disclosure-card">
            <h3>6. Open Source Attribution &amp; Upstream Licenses</h3>
            <ul>
              <li>
                <strong>ENGINE-LIVE:</strong> Forked from <code>snedea/flybrain</code> (MIT License), created by Seth Miller based on
                work by Zach Rispoli and the GoPiGo Connectome project.
              </li>
              <li>
                <strong>ENGINE-RECORDED:</strong> PyPI package <code>flybrain</code> (MIT License for code, CC BY 4.0 for MaleCNS v1.0 data),
                created by Alex Titonis (<code>alextitonis/fly.ai</code>). Neuron model based on "Fly64" by Jessica Paquette.
              </li>
            </ul>
            <p>
              See complete verbatim license texts in <a href="NOTICE.md" target="_blank">NOTICE.md</a>.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const btnClose = this.container.querySelector('#btnCloseDrawer');
    const overlay = this.container.querySelector('#drawerOverlay');

    btnClose?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => this.close());
  }

  public open(): void {
    this.isOpen = true;
    this.container.classList.add('open');
  }

  public close(): void {
    this.isOpen = false;
    this.container.classList.remove('open');
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
