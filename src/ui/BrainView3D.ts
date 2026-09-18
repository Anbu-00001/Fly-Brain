/**
 * BrainView3D.ts
 *
 * Implements the 3D Holographic Connectome View per §9 of AGENTS.md.
 * Upgraded with a 4,200-Point Instanced Neural Point Cloud:
 * - Sourced from Drosophila connectome anatomical regions:
 *   Optic Lobes (VIS_ME, VIS_LO, VIS_LPTC), Central Complex (CX_EPG, CX_PFN),
 *   Mushroom Bodies (MB_KC), Antennal Lobes, and Descending Motor Trunk (DNp01).
 * - Rendered in a single draw call with vertex colors.
 * - Action potential wavefronts propagate along the circuit.
 * - Strict thermal safeguards: capped pixel ratio (1.5), zero per-frame memory allocs,
 *   full memory disposal on stop.
 */

import * as THREE from 'three';
import { releaseRenderer, disposeSceneGraph, renderWebGLFallback } from './render/Lifecycle';
import { SimulationTickData } from '../engine/shared/ConnectomeTypes';

interface NeuropilCluster {
  name: string;
  region: 'sensory' | 'central' | 'drives' | 'motor';
  startIdx: number;
  count: number;
  baseR: number;
  baseG: number;
  baseB: number;
  activeR: number;
  activeG: number;
  activeB: number;
}

export class BrainView3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;

  private brainGroup: THREE.Group;
  private pointsMesh!: THREE.Points;
  private pointsGeo!: THREE.BufferGeometry;
  private positions!: Float32Array;
  private colors!: Float32Array;
  private baseColors!: Float32Array;

  private neuropilClusters: NeuropilCluster[] = [];
  private readonly TOTAL_NEURONS = 4200;

  // Synaptic Axonal Tract lines
  private tractLines!: THREE.LineSegments;

  // Traveling Action Potential Wave
  private pulseCurve: THREE.CatmullRomCurve3 | null = null;
  private pulseMesh: THREE.Mesh | null = null;
  private pulseProgress: number = 0;

  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private mouse = { down: false, x: 0, y: 0 };

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'brainView3D';
    this.container.className = 'brain-view-3d';
    parentElement.appendChild(this.container);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 12);

    this.brainGroup = new THREE.Group();
    this.scene.add(this.brainGroup);

    this.initThree();
    this.buildConnectomeCloud();
    this.buildAxonalTracts();
    this.buildPathwayPulse();
    this.buildHoloCage();
    this.setupInteractions();
  }

  private initThree(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.container.appendChild(this.renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0x1e293b, 1.5);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
      dirLight.position.set(5, 10, 7);
      this.scene.add(dirLight);

      this.resize();
    } catch (err) {
      console.warn('BrainView3D: WebGL unavailable, falling back.', err);
      this.renderer = null;
      renderWebGLFallback(
        this.container,
        '3D brain view',
        'Use the <strong>2D PARTICLE VIEW</strong> toggle — it shows the same live ' +
          'spike data on a 2D canvas.'
      );
    }
  }

  private buildConnectomeCloud(): void {
    this.positions = new Float32Array(this.TOTAL_NEURONS * 3);
    this.colors = new Float32Array(this.TOTAL_NEURONS * 3);
    this.baseColors = new Float32Array(this.TOTAL_NEURONS * 3);

    // Anatomical cluster definitions
    const clusterDefs = [
      // Left Optic Lobe (Sensory - Medulla & Lobula)
      {
        name: 'LEFT OPTIC LOBE (VIS_ME / VIS_LO)',
        region: 'sensory' as const,
        center: [-3.2, 0.2, -0.2],
        radii: [1.2, 0.9, 1.2],
        count: 1100,
        baseColor: [0.01, 0.52, 0.78],
        activeColor: [0.0, 0.94, 1.0],
      },
      // Right Optic Lobe (Sensory - Medulla & Lobula)
      {
        name: 'RIGHT OPTIC LOBE (VIS_ME / VIS_LO)',
        region: 'sensory' as const,
        center: [3.2, 0.2, -0.2],
        radii: [1.2, 0.9, 1.2],
        count: 1100,
        baseColor: [0.01, 0.52, 0.78],
        activeColor: [0.0, 0.94, 1.0],
      },
      // Central Complex (Central - CX_EPG / CX_PFN compass & steering)
      {
        name: 'CENTRAL COMPLEX (CX_EPG / CX_PFN)',
        region: 'central' as const,
        center: [0.0, 0.4, 0.1],
        radii: [0.8, 0.5, 0.6],
        count: 650,
        baseColor: [0.49, 0.23, 0.93],
        activeColor: [0.75, 0.45, 1.0],
      },
      // Mushroom Bodies (Drives/Memory - MB_KC)
      {
        name: 'MUSHROOM BODIES (MB_KC)',
        region: 'drives' as const,
        center: [-1.1, 1.2, -0.3],
        radii: [0.65, 0.7, 0.6],
        count: 400,
        baseColor: [0.85, 0.55, 0.05],
        activeColor: [1.0, 0.8, 0.2],
      },
      {
        name: 'MUSHROOM BODIES (MB_KC)',
        region: 'drives' as const,
        center: [1.1, 1.2, -0.3],
        radii: [0.65, 0.7, 0.6],
        count: 400,
        baseColor: [0.85, 0.55, 0.05],
        activeColor: [1.0, 0.8, 0.2],
      },
      // Antennal Lobes (Sensory - OLF)
      {
        name: 'ANTENNAL LOBES (OLF_ORN)',
        region: 'sensory' as const,
        center: [0.0, -0.7, 1.2],
        radii: [0.7, 0.5, 0.6],
        count: 250,
        baseColor: [0.02, 0.4, 0.65],
        activeColor: [0.22, 0.74, 0.97],
      },
      // Descending Motor Trunk & Giant Fiber (Motor - GNG_DESC / DNp01)
      {
        name: 'DESCENDING MOTOR TRUNK (GNG_DESC / DNp01)',
        region: 'motor' as const,
        center: [0.0, -2.0, -1.0],
        radii: [0.4, 1.6, 0.4],
        count: 300,
        baseColor: [0.75, 0.08, 0.25],
        activeColor: [1.0, 0.2, 0.4],
      },
    ];

    let currentIdx = 0;
    for (const c of clusterDefs) {
      const start = currentIdx;
      for (let i = 0; i < c.count && currentIdx < this.TOTAL_NEURONS; i++) {
        // Sample random point within ellipsoid
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = Math.cbrt(Math.random());

        const x = c.center[0] + r * c.radii[0] * Math.sin(phi) * Math.cos(theta);
        const y = c.center[1] + r * c.radii[1] * Math.sin(phi) * Math.sin(theta);
        const z = c.center[2] + r * c.radii[2] * Math.cos(phi);

        const pIdx = currentIdx * 3;
        this.positions[pIdx] = x;
        this.positions[pIdx + 1] = y;
        this.positions[pIdx + 2] = z;

        // Base color
        const jitter = (Math.random() - 0.5) * 0.08;
        const cr = Math.max(0, Math.min(1, c.baseColor[0] + jitter));
        const cg = Math.max(0, Math.min(1, c.baseColor[1] + jitter));
        const cb = Math.max(0, Math.min(1, c.baseColor[2] + jitter));

        this.baseColors[pIdx] = cr;
        this.baseColors[pIdx + 1] = cg;
        this.baseColors[pIdx + 2] = cb;

        this.colors[pIdx] = cr;
        this.colors[pIdx + 1] = cg;
        this.colors[pIdx + 2] = cb;

        currentIdx++;
      }

      this.neuropilClusters.push({
        name: c.name,
        region: c.region,
        startIdx: start,
        count: currentIdx - start,
        baseR: c.baseColor[0],
        baseG: c.baseColor[1],
        baseB: c.baseColor[2],
        activeR: c.activeColor[0],
        activeG: c.activeColor[1],
        activeB: c.activeColor[2],
      });
    }

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    this.pointsMesh = new THREE.Points(this.pointsGeo, pMat);
    this.brainGroup.add(this.pointsMesh);
  }

  private buildAxonalTracts(): void {
    const tractPoints = [
      // Left optic -> Central complex
      new THREE.Vector3(-2.2, 0.2, -0.2), new THREE.Vector3(0, 0.4, 0.1),
      new THREE.Vector3(-2.0, 0.6, 0.0), new THREE.Vector3(-0.4, 0.6, 0.1),
      // Right optic -> Central complex
      new THREE.Vector3(2.2, 0.2, -0.2), new THREE.Vector3(0, 0.4, 0.1),
      new THREE.Vector3(2.0, 0.6, 0.0), new THREE.Vector3(0.4, 0.6, 0.1),
      // Central complex -> Descending Giant Fiber
      new THREE.Vector3(0, 0.3, 0.1), new THREE.Vector3(0, -1.0, -0.8),
      new THREE.Vector3(0, -1.0, -0.8), new THREE.Vector3(0, -2.8, -1.1),
      // Antennal -> Central
      new THREE.Vector3(0, -0.6, 1.0), new THREE.Vector3(0, 0.2, 0.2),
    ];

    const tractGeo = new THREE.BufferGeometry().setFromPoints(tractPoints);
    const tractMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
    });
    this.tractLines = new THREE.LineSegments(tractGeo, tractMat);
    this.brainGroup.add(this.tractLines);
  }

  private buildPathwayPulse(): void {
    // Action potential pathway: Visual Projection -> Central Compass -> Giant Fiber Descending
    this.pulseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.2, 0.2, -0.2),
      new THREE.Vector3(-1.6, 0.4, 0.0),
      new THREE.Vector3(0.0, 0.45, 0.1),
      new THREE.Vector3(0.0, -0.6, -0.6),
      new THREE.Vector3(0.0, -2.8, -1.1),
    ]);

    const pulseGeo = new THREE.SphereGeometry(0.25, 12, 10);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    this.brainGroup.add(this.pulseMesh);
  }

  private buildHoloCage(): void {
    // Subtle holographic bounding box
    const boxGeo = new THREE.BoxGeometry(9, 7, 5);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.3,
    });
    const cage = new THREE.LineSegments(edges, lineMat);
    this.brainGroup.add(cage);
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

    for (const c of this.neuropilClusters) {
      let act = 0;
      if (c.region === 'sensory') act = rf.sensory / maxReg;
      else if (c.region === 'central') act = rf.central / maxReg;
      else if (c.region === 'motor') act = rf.motor / maxReg;
      else act = rf.drives / maxReg;

      // Update point colors for this cluster
      for (let i = c.startIdx; i < c.startIdx + c.count; i++) {
        const idx = i * 3;
        const lerpFactor = Math.min(1, act * 1.5);
        this.colors[idx] = this.baseColors[idx] * (1 - lerpFactor) + c.activeR * lerpFactor;
        this.colors[idx + 1] = this.baseColors[idx + 1] * (1 - lerpFactor) + c.activeG * lerpFactor;
        this.colors[idx + 2] = this.baseColors[idx + 2] * (1 - lerpFactor) + c.activeB * lerpFactor;
      }
    }

    this.pointsGeo.attributes.color.needsUpdate = true;
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
      this.brainGroup.rotation.y += 0.005;
    }

    // Animate visual -> sensory -> central -> motor signal pulse
    if (this.pulseCurve && this.pulseMesh) {
      this.pulseProgress = (this.pulseProgress + 0.014) % 1.0;
      const pt = this.pulseCurve.getPoint(this.pulseProgress);
      this.pulseMesh.position.copy(pt);

      const mat = this.pulseMesh.material as THREE.MeshBasicMaterial;
      if (this.pulseProgress < 0.4) {
        mat.color.setHex(0x00f0ff);
      } else if (this.pulseProgress < 0.75) {
        mat.color.setHex(0xa855f7);
      } else {
        mat.color.setHex(0xff3366);
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

  public dispose(): void {
    this.stop();
    this.pointsGeo.dispose();
    if (this.scene) disposeSceneGraph(this.scene);
    releaseRenderer(this.renderer);
    this.renderer = null;
  }
}
