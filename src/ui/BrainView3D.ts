/**
 * BrainView3D.ts
 *
 * Implements the 3D Brain View per §9 of AGENTS.md:
 * "A 'BRAIN VIEW' toggle switches to a stylized 3D pulse that visibly travels
 * visual input → sensory → central processing → motor → escape,
 * using only labels the active engine actually provides."
 */

import * as THREE from 'three';
import { SimulationTickData } from '../engine/shared/ConnectomeTypes';

interface NeuropilMesh {
  name: string;
  region: 'sensory' | 'central' | 'drives' | 'motor';
  mesh: THREE.Mesh;
  baseColor: number;
  emissiveColor: number;
  currentActivation: number;
}

export class BrainView3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;

  private neuropils: NeuropilMesh[] = [];
  private pulseCurve: THREE.CatmullRomCurve3 | null = null;
  private pulseMesh: THREE.Mesh | null = null;
  private pulseProgress: number = 0;

  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private mouse = { down: false, x: 0, y: 0 };
  private brainGroup: THREE.Group;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'brainView3D';
    this.container.className = 'brain-view-3d';
    parentElement.appendChild(this.container);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 11);

    this.brainGroup = new THREE.Group();
    this.scene.add(this.brainGroup);

    this.initThree();
    this.buildNeuropils();
    this.buildPathwayPulse();
    this.setupInteractions();
  }

  private initThree(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0x334155, 1.2);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
      dirLight.position.set(5, 10, 7);
      this.scene.add(dirLight);

      this.resize();
    } catch (err) {
      console.warn('Three.js WebGL initialization failed:', err);
    }
  }

  private buildNeuropils(): void {
    // Verified neuropils: Optic Lobes, Antennal, Mushroom Body, Central Complex, SEZ, Descending/VNC
    const defs = [
      // Left Optic Lobe (Sensory - Medulla/Lobula)
      {
        name: 'LEFT OPTIC LOBE (VIS_ME / VIS_LO)',
        region: 'sensory' as const,
        geo: new THREE.SphereGeometry(1.4, 20, 16),
        pos: [-2.9, 0.2, -0.3],
        scale: [1.0, 0.75, 1.1],
        baseColor: 0x0284c7,
        emissiveColor: 0x00f0ff,
      },
      // Right Optic Lobe (Sensory - Medulla/Lobula)
      {
        name: 'RIGHT OPTIC LOBE (VIS_ME / VIS_LO)',
        region: 'sensory' as const,
        geo: new THREE.SphereGeometry(1.4, 20, 16),
        pos: [2.9, 0.2, -0.3],
        scale: [1.0, 0.75, 1.1],
        baseColor: 0x0284c7,
        emissiveColor: 0x00f0ff,
      },
      // Central Complex (Central - CX_EPG / CX_PFN)
      {
        name: 'CENTRAL COMPLEX (CX_EPG / CX_PFN)',
        region: 'central' as const,
        geo: new THREE.CylinderGeometry(0.85, 0.85, 0.35, 20),
        pos: [0, 0.5, 0.1],
        scale: [1.0, 1.0, 1.0],
        baseColor: 0x7c3aed,
        emissiveColor: 0xa855f7,
      },
      // Mushroom Bodies (Central - MB_KC)
      {
        name: 'MUSHROOM BODIES (MB_KC)',
        region: 'central' as const,
        geo: new THREE.SphereGeometry(0.65, 16, 12),
        pos: [-1.2, 1.0, -0.2],
        scale: [1.0, 1.0, 1.0],
        baseColor: 0x6d28d9,
        emissiveColor: 0xc084fc,
      },
      {
        name: 'MUSHROOM BODIES (MB_KC)',
        region: 'central' as const,
        geo: new THREE.SphereGeometry(0.65, 16, 12),
        pos: [1.2, 1.0, -0.2],
        scale: [1.0, 1.0, 1.0],
        baseColor: 0x6d28d9,
        emissiveColor: 0xc084fc,
      },
      // Antennal Lobes (Sensory - OLF_ORN)
      {
        name: 'ANTENNAL LOBES (OLF_ORN / PN)',
        region: 'sensory' as const,
        geo: new THREE.SphereGeometry(0.5, 16, 12),
        pos: [-0.65, -0.7, 1.4],
        scale: [1.0, 1.0, 1.0],
        baseColor: 0x0369a1,
        emissiveColor: 0x38bdf8,
      },
      {
        name: 'ANTENNAL LOBES (OLF_ORN / PN)',
        region: 'sensory' as const,
        geo: new THREE.SphereGeometry(0.5, 16, 12),
        pos: [0.65, -0.7, 1.4],
        scale: [1.0, 1.0, 1.0],
        baseColor: 0x0369a1,
        emissiveColor: 0x38bdf8,
      },
      // Descending & VNC Motor Output (GNG_DESC / DN_STARTLE)
      {
        name: 'DESCENDING MOTOR TRUNK (GNG_DESC / DNp01)',
        region: 'motor' as const,
        geo: new THREE.CylinderGeometry(0.4, 0.25, 2.8, 16),
        pos: [0, -1.6, -1.2],
        scale: [1.0, 1.0, 1.0],
        baseColor: 0xbe123c,
        emissiveColor: 0xff3366,
      },
    ];

    for (const d of defs) {
      const mat = new THREE.MeshStandardMaterial({
        color: d.baseColor,
        emissive: d.emissiveColor,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.72,
        roughness: 0.35,
        metalness: 0.15,
      });

      const mesh = new THREE.Mesh(d.geo, mat);
      mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
      mesh.scale.set(d.scale[0], d.scale[1], d.scale[2]);

      this.brainGroup.add(mesh);

      this.neuropils.push({
        name: d.name,
        region: d.region,
        mesh,
        baseColor: d.baseColor,
        emissiveColor: d.emissiveColor,
        currentActivation: 0,
      });
    }

    // Connective Synaptic Tract Lines (visual input -> central -> motor)
    const tractMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.4,
    });

    const tracts = [
      // Left optic -> Central complex
      new THREE.Vector3(-2.0, 0.2, -0.3),
      new THREE.Vector3(0, 0.5, 0.1),
      // Right optic -> Central complex
      new THREE.Vector3(2.0, 0.2, -0.3),
      new THREE.Vector3(0, 0.5, 0.1),
      // Central complex -> Descending trunk
      new THREE.Vector3(0, 0.5, 0.1),
      new THREE.Vector3(0, -1.2, -1.0),
    ];

    const tractGeo = new THREE.BufferGeometry().setFromPoints(tracts);
    const tractLines = new THREE.LineSegments(tractGeo, tractMat);
    this.brainGroup.add(tractLines);
  }

  private buildPathwayPulse(): void {
    // 3D Pulse path: Visual Input -> Sensory Lobes -> Central Complex -> Motor Escape Trunk
    this.pulseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.0, 0.2, -0.2), // Visual input
      new THREE.Vector3(-1.5, 0.4, 0.0),  // Sensory projection
      new THREE.Vector3(0.0, 0.5, 0.1),   // Central complex
      new THREE.Vector3(0.0, -0.4, -0.5), // Subesophageal relay
      new THREE.Vector3(0.0, -2.4, -1.4), // Descending Giant Fiber motor
    ]);

    const pulseGeo = new THREE.SphereGeometry(0.24, 12, 10);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    this.pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    this.brainGroup.add(this.pulseMesh);
  }

  private setupInteractions(): void {
    const el = this.container;

    el.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.mouse.down) return;
      const dx = e.clientX - this.mouse.x;
      const dy = e.clientY - this.mouse.y;
      this.brainGroup.rotation.y += dx * 0.008;
      this.brainGroup.rotation.x += dy * 0.008;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  public updateTick(data: SimulationTickData): void {
    const rf = data.regionalFired;
    const maxReg = Math.max(1, rf.sensory, rf.central, rf.drives, rf.motor);

    for (const n of this.neuropils) {
      let act = 0;
      if (n.region === 'sensory') act = rf.sensory / maxReg;
      else if (n.region === 'central') act = rf.central / maxReg;
      else if (n.region === 'motor') act = rf.motor / maxReg;
      else act = rf.drives / maxReg;

      n.currentActivation = act;
      const mat = n.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.2 + act * 1.6;
      mat.opacity = 0.65 + act * 0.3;
    }
  }

  public resize(): void {
    if (!this.renderer) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rect.width, rect.height);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    // Gentle idle rotation
    if (!this.mouse.down) {
      this.brainGroup.rotation.y += 0.004;
    }

    // Animate visual -> sensory -> central -> motor signal pulse
    if (this.pulseCurve && this.pulseMesh) {
      this.pulseProgress = (this.pulseProgress + 0.012) % 1.0;
      const pt = this.pulseCurve.getPoint(this.pulseProgress);
      this.pulseMesh.position.copy(pt);

      // Color shift along the circuit
      const mat = this.pulseMesh.material as THREE.MeshBasicMaterial;
      if (this.pulseProgress < 0.4) {
        mat.color.setHex(0x00f0ff); // Cyan (visual sensory)
      } else if (this.pulseProgress < 0.75) {
        mat.color.setHex(0xa855f7); // Purple (central navigation)
      } else {
        mat.color.setHex(0xff3366); // Crimson (motor escape command)
      }
    }

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animFrameId = requestAnimationFrame(this.animate);
  };

  public getElement(): HTMLElement {
    return this.container;
  }
}
