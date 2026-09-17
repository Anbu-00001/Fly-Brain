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
            <h3>2. What is Biological vs. What is Engineered</h3>
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
            <h3>3. Scientific Honesty & Non-Sentience Guarantee</h3>
            <p>
              Neither engine trains any weights or learns anything. There is <strong>no machine learning, artificial intelligence,
              or consciousness</strong> in this system. Behavior emerges strictly from signal propagation across real, fixed biological wiring.
              The fly does not "think" or "learn"—it is an electrophysiological circuit model responding to sensory current injection.
            </p>
          </div>

          <div class="disclosure-card">
            <h3>4. Open Source Attribution & Upstream Licenses</h3>
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
