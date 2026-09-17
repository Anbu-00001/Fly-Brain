/**
 * LabBrain3D.ts
 *
 * Interactive 3D Connectome View for CONNECTOME LAB ("God Mode"):
 * - 4,200-point instanced connectome cloud with anatomically mapped neuropils
 * - Interactive raycasting: hover highlights & click-to-select biological populations
 * - Camera focus interpolation onto selected circuit nodes
 * - Real-time electrical cascade wavefront animation along axonal tracts
 * - Strict laptop protection: raycasting on 8 bounding proxies, capped pixel ratio,
 *   preallocated math objects.
 */

import * as THREE from 'three';
import { DROSOPHILA_CIRCUIT_NODES, CircuitNode } from '../../engine/shared/CircuitGraph';

export interface LabBrainCallbacks {
  onSelectNode?: (node: CircuitNode) => void;
  onHoverNode?: (node: CircuitNode | null, mouseEvent?: MouseEvent) => void;
}

interface NeuropilProxy {
  nodeId: string;
  sphere: THREE.Sphere;
  highlightMesh: THREE.Mesh;
}

export class LabBrain3D {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;

  private brainGroup: THREE.Group;
  private pointsMesh!: THREE.Points;
  private pointsGeo!: THREE.BufferGeometry;
  private positions!: Float32Array;
  private colors!: Float32Array;
  private baseColors!: Float32Array;
  private clusterIndices: Record<string, { start: number; count: number; baseColor: number[] }> = {};

  // Raycast proxies for fast, zero-lag hover/click detection
  private proxies: NeuropilProxy[] = [];
  private hoveredNodeId: string | null = null;
  private selectedNodeId: string | null = null;

  // Axonal connective tracts
  private tractLines!: THREE.LineSegments;

  // Active cascade wave animation
  private activeCascadePath: THREE.Vector3[] = [];
  private cascadePulseMesh: THREE.Mesh;
  private cascadeProgress: number = 0;
  private isCascadeAnimating: boolean = false;

  // Camera & Orbit State
  private orbit = { isDown: false, startX: 0, startY: 0, theta: 0.8, phi: 1.2, radius: 11.5 };
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private desiredTarget = new THREE.Vector3(0, 0, 0);

  // Pre-allocated math
  private _raycaster = new THREE.Raycaster();
  private _mouseNorm = new THREE.Vector2();
  private _tempVec = new THREE.Vector3();

  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private callbacks: LabBrainCallbacks;

  constructor(parentElement: HTMLElement, callbacks: LabBrainCallbacks = {}) {
    this.callbacks = callbacks;

    this.container = document.createElement('div');
    this.container.id = 'labBrainContainer';
    this.container.className = 'lab-brain-container';
    parentElement.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'labBrainCanvas';
    this.container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04070b, 0.02);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

    this.brainGroup = new THREE.Group();
    this.scene.add(this.brainGroup);

    // Cascade pulse sphere
    const pulseGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.cascadePulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    this.cascadePulseMesh.visible = false;
    this.brainGroup.add(this.cascadePulseMesh);

    this.initThree();
    this.buildConnectomePoints();
    this.buildAxonalTracts();
    this.buildProxies();
    this.buildHoloGrid();
    this.setupEvents();
    this.resize();
  }

  private initThree(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.setClearColor(0x04070b, 1.0);

      const ambientLight = new THREE.AmbientLight(0x1e293b, 1.6);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
      dirLight.position.set(6, 12, 8);
      this.scene.add(dirLight);

      const rimLight = new THREE.DirectionalLight(0xa855f7, 1.0);
      rimLight.position.set(-6, -8, -6);
      this.scene.add(rimLight);
    } catch (err) {
      console.warn('LabBrain3D WebGL init warning:', err);
    }
  }

  private buildConnectomePoints(): void {
    const TOTAL_NEURONS = 4200;
    this.positions = new Float32Array(TOTAL_NEURONS * 3);
    this.colors = new Float32Array(TOTAL_NEURONS * 3);
    this.baseColors = new Float32Array(TOTAL_NEURONS * 3);

    const nodes = Object.values(DROSOPHILA_CIRCUIT_NODES);
    let currentIdx = 0;

    for (const node of nodes) {
      const start = currentIdx;
      // Proportional points per node (capped between 120 and 1200)
      const pointCount = Math.max(120, Math.min(1200, Math.round(node.neuronCount * 0.05)));

      // Base color by region
      let baseRGB: [number, number, number] = [0.0, 0.94, 1.0]; // cyan default
      if (node.region === 'central') baseRGB = [0.65, 0.35, 0.98]; // purple
      else if (node.region === 'drives') baseRGB = [0.95, 0.65, 0.1]; // amber
      else if (node.region === 'motor') baseRGB = [1.0, 0.2, 0.4]; // crimson

      const [cx, cy, cz] = node.position3D;
      const spread = node.order <= 1 ? 0.9 : 0.55;

      for (let i = 0; i < pointCount && currentIdx < TOTAL_NEURONS; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2 * Math.PI;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random()) * spread;

        const x = cx + r * Math.sin(phi) * Math.cos(theta);
        const y = cy + r * Math.sin(phi) * Math.sin(theta);
        const z = cz + r * Math.cos(phi);

        const pIdx = currentIdx * 3;
        this.positions[pIdx] = x;
        this.positions[pIdx + 1] = y;
        this.positions[pIdx + 2] = z;

        const jitter = (Math.random() - 0.5) * 0.06;
        const cr = Math.max(0, Math.min(1, baseRGB[0] + jitter));
        const cg = Math.max(0, Math.min(1, baseRGB[1] + jitter));
        const cb = Math.max(0, Math.min(1, baseRGB[2] + jitter));

        this.baseColors[pIdx] = cr;
        this.baseColors[pIdx + 1] = cg;
        this.baseColors[pIdx + 2] = cb;

        this.colors[pIdx] = cr;
        this.colors[pIdx + 1] = cg;
        this.colors[pIdx + 2] = cb;

        currentIdx++;
      }

      this.clusterIndices[node.id] = {
        start,
        count: currentIdx - start,
        baseColor: baseRGB,
      };
    }

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });

    this.pointsMesh = new THREE.Points(this.pointsGeo, pMat);
    this.brainGroup.add(this.pointsMesh);
  }

  private buildAxonalTracts(): void {
    const points: THREE.Vector3[] = [];

    // Connect nodes according to biological outputs
    for (const node of Object.values(DROSOPHILA_CIRCUIT_NODES)) {
      const src = new THREE.Vector3(...node.position3D);
      for (const targetId of node.outputs) {
        const target = DROSOPHILA_CIRCUIT_NODES[targetId];
        if (target) {
          const dst = new THREE.Vector3(...target.position3D);
          points.push(src, dst);
        }
      }
    }

    const tractGeo = new THREE.BufferGeometry().setFromPoints(points);
    const tractMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
    });
    this.tractLines = new THREE.LineSegments(tractGeo, tractMat);
    this.brainGroup.add(this.tractLines);
  }

  private buildProxies(): void {
    // Build low-poly bounding spheres for zero-lag raycasting
    for (const node of Object.values(DROSOPHILA_CIRCUIT_NODES)) {
      const [cx, cy, cz] = node.position3D;
      const radius = node.order <= 1 ? 1.1 : 0.75;
      const sphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), radius);

      // Glowing selection ring mesh
      const ringGeo = new THREE.TorusGeometry(radius * 1.1, 0.04, 6, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0,
      });
      const highlightMesh = new THREE.Mesh(ringGeo, ringMat);
      highlightMesh.position.set(cx, cy, cz);
      this.brainGroup.add(highlightMesh);

      this.proxies.push({
        nodeId: node.id,
        sphere,
        highlightMesh,
      });
    }
  }

  private buildHoloGrid(): void {
    const grid = new THREE.GridHelper(16, 16, 0x00f0ff, 0x0c2035);
    grid.position.y = -4.0;
    this.scene.add(grid);

    const cageGeo = new THREE.BoxGeometry(11, 9, 7);
    const cageEdges = new THREE.EdgesGeometry(cageGeo);
    const cageMat = new THREE.LineBasicMaterial({
      color: 0x0c2035,
      transparent: true,
      opacity: 0.4,
    });
    const cage = new THREE.LineSegments(cageEdges, cageMat);
    this.brainGroup.add(cage);
  }

  private setupEvents(): void {
    window.addEventListener('resize', () => this.resize());

    // Orbit mouse controls
    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.orbit.isDown = true;
        this.orbit.startX = e.clientX;
        this.orbit.startY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.orbit.isDown) {
        const dx = e.clientX - this.orbit.startX;
        const dy = e.clientY - this.orbit.startY;
        this.orbit.theta -= dx * 0.008;
        this.orbit.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.orbit.phi - dy * 0.008));
        this.orbit.startX = e.clientX;
        this.orbit.startY = e.clientY;
      }

      // Fast Raycast against Proxies on Hover
      this.handlePointerMove(e);
    });

    window.addEventListener('mouseup', () => {
      this.orbit.isDown = false;
    });

    this.container.addEventListener('wheel', (e) => {
      this.orbit.radius = Math.max(4.5, Math.min(22.0, this.orbit.radius + e.deltaY * 0.01));
    });

    // Click to select
    this.container.addEventListener('click', (e) => {
      this.handlePointerClick(e);
    });
  }

  private handlePointerMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }

    this._mouseNorm.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouseNorm.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouseNorm, this.camera);

    let nearestNodeId: string | null = null;
    let minDistance = Infinity;

    // Fast Sphere Raycast
    for (const proxy of this.proxies) {
      // Transform proxy center to world space
      this._tempVec.copy(proxy.sphere.center).applyMatrix4(this.brainGroup.matrixWorld);
      const worldSphere = new THREE.Sphere(this._tempVec, proxy.sphere.radius);

      if (this._raycaster.ray.intersectsSphere(worldSphere)) {
        const dist = this._raycaster.ray.origin.distanceTo(this._tempVec);
        if (dist < minDistance) {
          minDistance = dist;
          nearestNodeId = proxy.nodeId;
        }
      }
    }

    if (nearestNodeId !== this.hoveredNodeId) {
      this.hoveredNodeId = nearestNodeId;
      this.updateHighlightState();
      const node = nearestNodeId ? DROSOPHILA_CIRCUIT_NODES[nearestNodeId] : null;
      this.callbacks.onHoverNode?.(node, e);
    }
  }

  private handlePointerClick(_e: MouseEvent): void {
    if (this.hoveredNodeId) {
      this.selectNode(this.hoveredNodeId);
    }
  }

  public selectNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.updateHighlightState();

    const node = DROSOPHILA_CIRCUIT_NODES[nodeId];
    if (node) {
      this.callbacks.onSelectNode?.(node);
      // Smoothly pan camera target to node center
      this.desiredTarget.set(...node.position3D);
    }
  }

  private updateHighlightState(): void {
    for (const proxy of this.proxies) {
      const mat = proxy.highlightMesh.material as THREE.MeshBasicMaterial;
      if (proxy.nodeId === this.selectedNodeId) {
        mat.opacity = 0.9;
        mat.color.setHex(0xf59e0b); // amber selected
      } else if (proxy.nodeId === this.hoveredNodeId) {
        mat.opacity = 0.65;
        mat.color.setHex(0x00f0ff); // cyan hover
      } else {
        mat.opacity = 0.0;
      }
    }
  }

  /**
   * Triggers an animated action potential wavefront through a sequence of nodes
   */
  public triggerCascadeAnimation(nodeIds: string[]): void {
    this.activeCascadePath = nodeIds
      .map((id) => DROSOPHILA_CIRCUIT_NODES[id])
      .filter(Boolean)
      .map((node) => new THREE.Vector3(...node.position3D));

    if (this.activeCascadePath.length >= 2) {
      this.isCascadeAnimating = true;
      this.cascadeProgress = 0;
      this.cascadePulseMesh.visible = true;

      // Flash point clusters in the path
      for (const id of nodeIds) {
        this.flashCluster(id, 1.0);
      }
    }
  }

  public flashCluster(nodeId: string, intensity: number = 1.0): void {
    const cluster = this.clusterIndices[nodeId];
    if (!cluster) return;

    for (let i = cluster.start; i < cluster.start + cluster.count; i++) {
      const idx = i * 3;
      this.colors[idx] = Math.min(1.0, this.baseColors[idx] + intensity * 0.6);
      this.colors[idx + 1] = Math.min(1.0, this.baseColors[idx + 1] + intensity * 0.6);
      this.colors[idx + 2] = Math.min(1.0, this.baseColors[idx + 2] + intensity * 0.6);
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

    // Idle brain rotation when not interacting
    if (!this.orbit.isDown) {
      this.brainGroup.rotation.y += 0.0035;
    }

    // Camera target smooth interpolation
    this.cameraTarget.lerp(this.desiredTarget, 0.08);

    // Orbit Camera position update
    const x = this.cameraTarget.x + this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
    const y = this.cameraTarget.y + this.orbit.radius * Math.cos(this.orbit.phi);
    const z = this.cameraTarget.z + this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);

    // Animate Cascade Pulse Wavefront
    if (this.isCascadeAnimating && this.activeCascadePath.length >= 2) {
      this.cascadeProgress += 0.025;
      if (this.cascadeProgress >= 1.0) {
        this.isCascadeAnimating = false;
        this.cascadePulseMesh.visible = false;
      } else {
        const totalSegments = this.activeCascadePath.length - 1;
        const segmentFloat = this.cascadeProgress * totalSegments;
        const segIdx = Math.floor(segmentFloat);
        const segT = segmentFloat - segIdx;

        const p0 = this.activeCascadePath[segIdx];
        const p1 = this.activeCascadePath[Math.min(segIdx + 1, totalSegments)];
        this.cascadePulseMesh.position.lerpVectors(p0, p1, segT);
      }
    }

    // Decay color brightness back to base colors
    let colorsNeedDecay = false;
    for (let i = 0; i < this.colors.length; i++) {
      if (this.colors[i] > this.baseColors[i]) {
        this.colors[i] = Math.max(this.baseColors[i], this.colors[i] - 0.025);
        colorsNeedDecay = true;
      }
    }
    if (colorsNeedDecay) {
      this.pointsGeo.attributes.color.needsUpdate = true;
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
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
