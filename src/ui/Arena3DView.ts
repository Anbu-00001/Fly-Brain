/**
 * Arena3DView.ts
 *
 * High-performance 3D Cyber-Terrarium Arena built with Three.js.
 * Features:
 * - Procedural articulated 3D Drosophila fly (wings, compound eyes, body, neural halo)
 * - Volumetric looming predator threat with dynamic 3D shadow cone
 * - Laboratory micro-chamber with hexagonal floor, obstacles, and sucrose bait node
 * - Multi-perspective dynamic cameras: Overview, Chase Cam, Compound Eye POV
 * - Strict thermal safeguards: single-pass materials, preallocated math objects,
 *   zero GPU readback stalls, capped pixel ratio to protect laptop hardware.
 */

import * as THREE from 'three';
import { releaseRenderer, disposeSceneGraph, renderWebGLFallback } from './render/Lifecycle';
import { LiveEngineAdapter } from '../engine/live/LiveEngineAdapter';
import { LoomingCalculator } from '../engine/live/LoomingCalculator';
import { ReceptiveFieldGradient } from '../engine/shared/ConnectomeTypes';
import { normalizeAngle, euclideanDistance, clamp, isLineOfSightOccluded, calculateEffectiveLoomFlux, Obstacle3D } from '../engine/shared/Metrics';
import { InputRecorder } from '../state/InputRecorder';
import { SeededRNG } from '../state/SeededRNG';

export type CameraMode3D = 'overview' | 'chase' | 'compound_eye';

export interface Arena3DViewCallbacks {
  onLoomUpdate?: (gradient: ReceptiveFieldGradient) => void;
  onEncounterEnd?: (result: 'escaped' | 'caught', survivalTimeS: number, latencyMs: number | null) => void;
  onThreatStarted?: () => void;
  onCameraChange?: (mode: CameraMode3D) => void;
}

export class Arena3DView {
  /**
   * All DOM listeners are registered with this signal so dispose() can remove
   * them in one call. The previous build attached anonymous arrow functions to
   * `window` (resize, mousemove, mouseup) and never removed them: each new view
   * instance added another permanent handler that retained the whole scene graph,
   * so navigating back and forth both leaked GPU memory and multiplied the work
   * done on every mouse move.
   */
  private listenerAbort = new AbortController();
  private container: HTMLElement;
  private canvas3D: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private engine: LiveEngineAdapter;
  private loomingCalc: LoomingCalculator;
  private recorder: InputRecorder;
  private rng: SeededRNG;
  private callbacks: Arena3DViewCallbacks;

  // Camera management
  private cameraMode: CameraMode3D = 'overview';
  private orbitControls = { isDown: false, startX: 0, startY: 0, theta: Math.PI / 4, phi: Math.PI / 3, radius: 110 };

  // Fly 3D Entity
  private flyGroup: THREE.Group;
  private wingLeftMesh!: THREE.Mesh;
  private wingRightMesh!: THREE.Mesh;
  private eyeLeftMat!: THREE.MeshStandardMaterial;
  private eyeRightMat!: THREE.MeshStandardMaterial;
  private neuralHaloMesh!: THREE.Mesh;
  private neuralHaloMat!: THREE.MeshBasicMaterial;

  // Fly physical & kinematic state (arena coordinates: -150 to +150)
  private fly = {
    x: 0,
    z: 0,
    y: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    speed: 0,
    isFlying: false,
    flightAltitude: 0,
    wingPhase: 0,
    bodyRadius: 3.5,
  };

  // Predator 3D Entity
  private predatorGroup: THREE.Group;
  private loomingConeMesh: THREE.Mesh;
  private predatorRingMesh: THREE.Mesh;
  private predatorLight: THREE.PointLight;
  private predatorShadowDecal: THREE.Mesh;

  private predator = {
    x: -80,
    z: -80,
    y: 28,
    vx: 0,
    vz: 0,
    active: false,
    radius: 18,
    strikeProgress: 0,
  };

  // Laboratory Obstacles & Environment
  private obstacles: Obstacle3D[] = [
    { x: -45, z: -25, radius: 10, height: 26 },
    { x: 45, z: 25, radius: 10, height: 26 },
    { x: -30, z: 50, radius: 8, height: 22 },
  ];
  private sucroseNode = { x: 50, z: -45, radius: 6 };
  private sucroseMesh!: THREE.Mesh;

  // Particles
  private particlesGroup: THREE.Points;
  private particleGeo: THREE.BufferGeometry;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleLifes: Float32Array;
  private readonly MAX_PARTICLES = 64;

  // Lifecycle
  private isRunning: boolean = false;
  private isReplayMode: boolean = false;
  private animFrameId: number | null = null;
  private startTimeMs: number = 0;
  private threatOnsetMs: number | null = null;
  private escapeOnsetMs: number | null = null;
  private responseWallClockMs: number | null = null;
  private countdownValue: number | null = null;

  // Pre-allocated math objects to avoid garbage collection & thermal throttling
  private _vTemp = new THREE.Vector3();
  private _vPred = new THREE.Vector3();
  private _vFly = new THREE.Vector3();
  private _raycaster = new THREE.Raycaster();
  private _mouseNorm = new THREE.Vector2();
  private _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Overlay HUD
  private hudOverlay: HTMLElement;

  constructor(
    parentElement: HTMLElement,
    engine: LiveEngineAdapter,
    recorder: InputRecorder,
    callbacks: Arena3DViewCallbacks = {}
  ) {
    this.engine = engine;
    this.recorder = recorder;
    this.callbacks = callbacks;
    this.loomingCalc = new LoomingCalculator();
    this.rng = new SeededRNG(Date.now());

    this.container = document.createElement('div');
    this.container.id = 'arena3DContainer';
    this.container.className = 'arena-3d-container';
    parentElement.appendChild(this.container);

    this.canvas3D = document.createElement('canvas');
    this.canvas3D.id = 'arena3DCanvas';
    this.container.appendChild(this.canvas3D);

    // Compound Eye HUD overlay for first person view
    this.hudOverlay = document.createElement('div');
    this.hudOverlay.className = 'compound-eye-overlay';
    this.container.appendChild(this.hudOverlay);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04070b, 0.0035);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 500);

    this.flyGroup = new THREE.Group();
    this.scene.add(this.flyGroup);

    this.predatorGroup = new THREE.Group();
    this.scene.add(this.predatorGroup);

    // Initialize particles
    this.particlePositions = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleVelocities = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleLifes = new Float32Array(this.MAX_PARTICLES);
    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 1.8,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    this.particlesGroup = new THREE.Points(this.particleGeo, pMat);
    this.scene.add(this.particlesGroup);

    // Volumetric looming cone
    const coneGeo = new THREE.ConeGeometry(this.predator.radius, 1, 16, 1, true);
    coneGeo.translate(0, 0.5, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      wireframe: true,
    });
    this.loomingConeMesh = new THREE.Mesh(coneGeo, coneMat);
    this.scene.add(this.loomingConeMesh);

    // Predator reticle ring
    const ringGeo = new THREE.TorusGeometry(this.predator.radius, 0.6, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3366 });
    this.predatorRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.predatorRingMesh.rotation.x = Math.PI / 2;
    this.predatorGroup.add(this.predatorRingMesh);

    // Predator point light
    this.predatorLight = new THREE.PointLight(0xff3366, 2.5, 80);
    this.predatorGroup.add(this.predatorLight);

    // Ground shadow decal
    const shadowGeo = new THREE.RingGeometry(this.predator.radius * 0.7, this.predator.radius, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.predatorShadowDecal = new THREE.Mesh(shadowGeo, shadowMat);
    this.predatorShadowDecal.rotation.x = Math.PI / 2;
    this.predatorShadowDecal.position.y = 0.2;
    this.scene.add(this.predatorShadowDecal);

    this.initThree();
    this.buildMicroChamber();
    this.buildFlyModel();
    this.setupEvents();
    this.resize();
  }

  private initThree(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas3D,
        antialias: true,
        alpha: false,
        powerPreference: 'low-power',
      });
      // Cap pixel ratio to 1.5 to protect laptop GPU from thermal throttling
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.setClearColor(0x04070b, 1.0);

      const ambientLight = new THREE.AmbientLight(0x0f1c2c, 1.8);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
      dirLight.position.set(40, 80, 50);
      this.scene.add(dirLight);

      const rimLight = new THREE.DirectionalLight(0xa855f7, 0.8);
      rimLight.position.set(-40, 30, -50);
      this.scene.add(rimLight);
    } catch (err) {
      console.warn('Arena3DView: WebGL unavailable, falling back.', err);
      this.renderer = null;
      renderWebGLFallback(
        this.container,
        '3D chamber',
        'Switch to <strong>2D VECTOR</strong> in the toolbar — the encounter and the ' +
          'connectome simulation run identically there.'
      );
    }
  }

  private buildMicroChamber(): void {
    // 1. Hexagonal Petri Floor with Grid
    const floorGeo = new THREE.CylinderGeometry(110, 110, 2, 6);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x060c14,
      roughness: 0.45,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -1;
    this.scene.add(floor);

    // Floor grid texture line segments
    const gridHelper = new THREE.GridHelper(180, 24, 0x00f0ff, 0x0c2035);
    gridHelper.position.y = 0.05;
    this.scene.add(gridHelper);

    // 2. Neon Laser Containment Boundary
    const ringGeo = new THREE.TorusGeometry(105, 0.8, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6,
    });
    const boundaryRing = new THREE.Mesh(ringGeo, ringMat);
    boundaryRing.rotation.x = Math.PI / 2;
    boundaryRing.position.y = 1.0;
    this.scene.add(boundaryRing);

    // 3. Laboratory Micro-Obstacle Pillars
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x111e2e,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.5,
    });
    const pillarCoreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    for (const obs of this.obstacles) {
      const pGeo = new THREE.CylinderGeometry(obs.radius, obs.radius * 1.1, obs.height, 18);
      const pillar = new THREE.Mesh(pGeo, pillarMat);
      pillar.position.set(obs.x, obs.height / 2, obs.z);
      this.scene.add(pillar);

      // Energy core ring
      const coreGeo = new THREE.TorusGeometry(obs.radius * 1.05, 0.4, 6, 24);
      const coreMesh = new THREE.Mesh(coreGeo, pillarCoreMat);
      coreMesh.rotation.x = Math.PI / 2;
      coreMesh.position.set(obs.x, obs.height * 0.75, obs.z);
      this.scene.add(coreMesh);
    }

    // 4. Sucrose Bait Node ("Infinite Sugar" from research report)
    const sucroseGeo = new THREE.DodecahedronGeometry(this.sucroseNode.radius, 1);
    const sucroseMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    this.sucroseMesh = new THREE.Mesh(sucroseGeo, sucroseMat);
    this.sucroseMesh.position.set(this.sucroseNode.x, 3.5, this.sucroseNode.z);
    this.scene.add(this.sucroseMesh);
  }

  private buildFlyModel(): void {
    // 1. Thorax (central body)
    const thoraxGeo = new THREE.SphereGeometry(3.2, 14, 10);
    thoraxGeo.scale(1.0, 0.85, 1.25);
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.3,
    });
    const thorax = new THREE.Mesh(thoraxGeo, chitinMat);
    thorax.position.set(0, 3.2, 0);
    this.flyGroup.add(thorax);

    // 2. Striped Abdomen
    const abdomenGeo = new THREE.SphereGeometry(3.6, 14, 12);
    abdomenGeo.scale(0.9, 0.8, 1.7);
    const abdomenMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0284c7,
      emissiveIntensity: 0.15,
      roughness: 0.5,
      metalness: 0.2,
    });
    const abdomen = new THREE.Mesh(abdomenGeo, abdomenMat);
    abdomen.position.set(0, 3.0, -4.5);
    this.flyGroup.add(abdomen);

    // 3. Head
    const headGeo = new THREE.SphereGeometry(2.4, 12, 10);
    headGeo.scale(1.1, 0.9, 0.9);
    const head = new THREE.Mesh(headGeo, chitinMat);
    head.position.set(0, 3.4, 3.6);
    this.flyGroup.add(head);

    // 4. Large Red Drosophila Compound Eyes
    this.eyeLeftMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.1,
    });
    this.eyeRightMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.1,
    });

    const eyeGeo = new THREE.SphereGeometry(1.4, 10, 8);
    eyeGeo.scale(0.9, 1.1, 1.1);

    const eyeLeft = new THREE.Mesh(eyeGeo, this.eyeLeftMat);
    eyeLeft.position.set(-1.8, 3.8, 4.0);
    this.flyGroup.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeo, this.eyeRightMat);
    eyeRight.position.set(1.8, 3.8, 4.0);
    this.flyGroup.add(eyeRight);

    // 5. Translucent Iridescent Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(-2.5, 4, -4.0, 9, -2.0, 13);
    wingShape.bezierCurveTo(0, 15, 2.0, 14, 2.5, 9);
    wingShape.bezierCurveTo(2.0, 4, 1.0, 1, 0, 0);

    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xc8f0ff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.65,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.wingLeftMesh = new THREE.Mesh(wingGeo, wingMat);
    this.wingLeftMesh.position.set(-1.0, 4.4, -0.5);
    this.wingLeftMesh.rotation.x = Math.PI / 2;
    this.flyGroup.add(this.wingLeftMesh);

    this.wingRightMesh = new THREE.Mesh(wingGeo, wingMat);
    this.wingRightMesh.position.set(1.0, 4.4, -0.5);
    this.wingRightMesh.rotation.x = Math.PI / 2;
    this.flyGroup.add(this.wingRightMesh);

    // 6. Neural Activation Halo (pulses with connectome action potentials)
    const haloGeo = new THREE.TorusGeometry(2.0, 0.15, 6, 20);
    this.neuralHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.2,
    });
    this.neuralHaloMesh = new THREE.Mesh(haloGeo, this.neuralHaloMat);
    this.neuralHaloMesh.rotation.x = Math.PI / 2;
    this.neuralHaloMesh.position.set(0, 5.8, 3.4);
    this.flyGroup.add(this.neuralHaloMesh);
  }

  private setupEvents(): void {
    window.addEventListener('resize', () => this.resize(), { signal: this.listenerAbort.signal });

    // Mouse Tracking in 3D: Raycast against ground plane
    this.container.addEventListener('mousemove', (e) => {
      if (this.isReplayMode) return;
      const rect = this.canvas3D.getBoundingClientRect();
      this._mouseNorm.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouseNorm.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this._raycaster.setFromCamera(this._mouseNorm, this.camera);
      const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._vTemp);

      if (hit) {
        const targetX = clamp(hit.x, -100, 100);
        const targetZ = clamp(hit.z, -100, 100);

        this.predator.vx = targetX - this.predator.x;
        this.predator.vz = targetZ - this.predator.z;
        this.predator.x = targetX;
        this.predator.z = targetZ;
        this.predator.active = true;

        const dist = euclideanDistance(this.fly.x, this.fly.z, this.predator.x, this.predator.z);
        if (dist < 80 && this.threatOnsetMs === null && this.isRunning) {
          this.threatOnsetMs = performance.now();
          this.callbacks.onThreatStarted?.();
        }
      }
    }, { signal: this.listenerAbort.signal });

    this.container.addEventListener('mouseleave', () => {
      if (!this.isReplayMode) {
        this.predator.active = false;
      }
    }, { signal: this.listenerAbort.signal });

    // Orbit Camera Drag Controls
    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 0 && (e.shiftKey || e.altKey || this.cameraMode === 'overview')) {
        this.orbitControls.isDown = true;
        this.orbitControls.startX = e.clientX;
        this.orbitControls.startY = e.clientY;
      }
    }, { signal: this.listenerAbort.signal });

    window.addEventListener('mousemove', (e) => {
      if (!this.orbitControls.isDown) return;
      const dx = e.clientX - this.orbitControls.startX;
      const dy = e.clientY - this.orbitControls.startY;
      this.orbitControls.theta -= dx * 0.008;
      this.orbitControls.phi = clamp(this.orbitControls.phi - dy * 0.008, 0.15, Math.PI / 2 - 0.05);
      this.orbitControls.startX = e.clientX;
      this.orbitControls.startY = e.clientY;
    }, { signal: this.listenerAbort.signal });

    window.addEventListener('mouseup', () => {
      this.orbitControls.isDown = false;
    }, { signal: this.listenerAbort.signal });

    this.container.addEventListener('wheel', (e) => {
      this.orbitControls.radius = clamp(this.orbitControls.radius + e.deltaY * 0.08, 40, 160);
    }, { signal: this.listenerAbort.signal });
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

  public setCameraMode(mode: CameraMode3D): void {
    this.cameraMode = mode;
    this.callbacks.onCameraChange?.(mode);

    if (mode === 'compound_eye') {
      this.hudOverlay.style.display = 'block';
    } else {
      this.hudOverlay.style.display = 'none';
    }
  }

  public getCameraMode(): CameraMode3D {
    return this.cameraMode;
  }

  public resetFly(seed: number = 42): void {
    this.rng.setSeed(seed);
    this.fly.x = this.rng.range(-15, 15);
    this.fly.z = this.rng.range(-15, 15);
    this.fly.y = 0;
    this.fly.heading = this.rng.range(-Math.PI, Math.PI);
    this.fly.vx = 0;
    this.fly.vz = 0;
    this.fly.vy = 0;
    this.fly.isFlying = false;
    this.fly.flightAltitude = 0;
    this.fly.wingPhase = 0;

    this.predator.x = -80;
    this.predator.z = -80;
    this.predator.active = false;

    this.threatOnsetMs = null;
    this.escapeOnsetMs = null;
    this.responseWallClockMs = null;
    this.loomingCalc.reset();
  }

  public startEncounter(seed: number = 42): void {
    this.resetFly(seed);
    this.isReplayMode = false;
    this.isRunning = true;
    this.startTimeMs = performance.now();

    this.recorder.startRecording(seed, 300, 300, {
      x: this.fly.x,
      y: this.fly.z,
      heading: this.fly.heading,
    });

    this.engine.reset();
    this.engine.start();

    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.engine.stop();
  }

  public setCountdown(val: number | null): void {
    this.countdownValue = val;
    if (this.countdownValue !== null) {
      this.hudOverlay.style.display = 'flex';
      const text = this.countdownValue === 0 ? 'FLY RELEASED' : String(this.countdownValue);
      this.hudOverlay.innerHTML = `<div class="hud-countdown-text">${text}</div>`;
    } else {
      if (this.cameraMode !== 'compound_eye') {
        this.hudOverlay.style.display = 'none';
      }
      this.hudOverlay.innerHTML = '';
    }
  }

  public setFlyPosition(x: number, z: number, heading: number, isFlying: boolean): void {
    this.fly.x = x;
    this.fly.z = z;
    this.fly.heading = heading;
    this.fly.isFlying = isFlying;
  }

  public setPredatorPosition(x: number, z: number, active: boolean): void {
    this.predator.x = x;
    this.predator.z = z;
    this.predator.active = active;
  }

  public enableReplayMode(enabled: boolean): void {
    this.isReplayMode = enabled;
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    this.updateKinematics();
    this.updateCamera();
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private updateKinematics(): void {
    const now = performance.now();
    const tSec = (now - this.startTimeMs) / 1000;

    // Check Obstacle Line-Of-Sight Occlusion
    let occluded = false;
    for (const obs of this.obstacles) {
      if (isLineOfSightOccluded(this.fly.x, this.fly.z, this.predator.x, this.predator.z, obs)) {
        occluded = true;
        break;
      }
    }

    // 1. Calculate Looming Stimulus
    const rawGradient = this.loomingCalc.compute(
      this.fly.x,
      this.fly.z,
      this.fly.heading,
      this.predator.x,
      this.predator.z,
      tSec
    );

    // Apply obstacle occlusion attenuation
    const effectiveLoom = calculateEffectiveLoomFlux(rawGradient.angularLoomRad, occluded, 0.15);
    const gradient: ReceptiveFieldGradient = {
      ...rawGradient,
      angularLoomRad: effectiveLoom,
      leftEyeIntensity: calculateEffectiveLoomFlux(rawGradient.leftEyeIntensity, occluded, 0.2),
      rightEyeIntensity: calculateEffectiveLoomFlux(rawGradient.rightEyeIntensity, occluded, 0.2),
    };

    this.callbacks.onLoomUpdate?.(gradient);

    // Record sample
    if (this.recorder.isRecording() && !this.isReplayMode) {
      this.recorder.recordSample(tSec, this.predator.x, this.predator.z, this.predator.active);
    }

    // 2. Inject into connectome
    this.engine.injectLoomingStimulus(gradient);

    // 3. Evaluate the escape decision (see engine/shared/EscapeModel.ts).
    //    This is a MODELLED readout, not a measurement of DNp01: ENGINE-LIVE's
    //    dataset does not resolve the giant fiber as an addressable population.
    const decision = this.engine.evaluateEscape(gradient.angularLoomRad, gradient.expansionRate);

    if (decision.triggered && !this.fly.isFlying) {
      this.fly.isFlying = true;
      this.fly.flightAltitude = 12.0;
      this.escapeOnsetMs = now;

      if (this.threatOnsetMs !== null && this.responseWallClockMs === null) {
        this.responseWallClockMs = Math.round(this.escapeOnsetMs - this.threatOnsetMs);
      }

      // Takeoff trajectory away from threat
      const angleAway = gradient.bearingRad + Math.PI + this.rng.range(-0.25, 0.25);
      const worldEscapeAngle = this.fly.heading + angleAway;
      this.fly.vx = Math.sin(worldEscapeAngle) * 4.2;
      this.fly.vz = Math.cos(worldEscapeAngle) * 4.2;
      this.fly.vy = 3.5;

      this.spawnSparks(this.fly.x, this.fly.y + 3.0, this.fly.z);
    }

    // 4. Update Fly Locomotion
    if (this.fly.isFlying) {
      // Evasive flight physics
      this.fly.x += this.fly.vx;
      this.fly.z += this.fly.vz;
      this.fly.y += this.fly.vy;

      this.fly.vx *= 0.97;
      this.fly.vz *= 0.97;
      this.fly.vy = Math.max(2.0, this.fly.vy * 0.95);

      this.fly.heading = Math.atan2(this.fly.vx, this.fly.vz);
      this.fly.wingPhase += 0.65; // high frequency flight buzz

      // Wall bounce
      const maxDist = 95;
      const d = Math.hypot(this.fly.x, this.fly.z);
      if (d > maxDist) {
        this.fly.vx = -this.fly.vx * 0.7;
        this.fly.vz = -this.fly.vz * 0.7;
      }
    } else {
      // Ground walking & exploratory foraging toward sucrose.
      // Heading wander is AUTHORED (seeded RNG), not neural — see ArenaView for
      // why the previous connectome-derived turn bias was identically zero.
      this.fly.heading = normalizeAngle(this.fly.heading + this.rng.range(-0.02, 0.02));

      // Attraction vector to sucrose node
      const toSugarX = this.sucroseNode.x - this.fly.x;
      const toSugarZ = this.sucroseNode.z - this.fly.z;
      const sugarDist = Math.hypot(toSugarX, toSugarZ);
      const sugarAngle = Math.atan2(toSugarX, toSugarZ);

      // Walk speed IS neural: normalised descending-trunk (GNG_DESC) activity.
      let walkSpeed = Math.min(0.9, this.engine.getDescendingActivity() * 14.0 + 0.18);
      if (sugarDist > 8 && !this.predator.active) {
        // Gently steer toward sucrose when calm
        const diff = normalizeAngle(sugarAngle - this.fly.heading);
        this.fly.heading += diff * 0.03;
      }

      this.fly.x += Math.sin(this.fly.heading) * walkSpeed;
      this.fly.z += Math.cos(this.fly.heading) * walkSpeed;
      this.fly.y = 0;
      this.fly.wingPhase += 0.08;

      // Containment margin
      const d = Math.hypot(this.fly.x, this.fly.z);
      if (d > 95) {
        this.fly.heading = Math.atan2(-this.fly.x, -this.fly.z);
      }
    }

    // 5. Update Fly Visual Meshes
    this.flyGroup.position.set(this.fly.x, this.fly.y, this.fly.z);
    this.flyGroup.rotation.y = this.fly.heading;

    // Wing flapping kinematics
    if (this.fly.isFlying) {
      const flap = Math.sin(this.fly.wingPhase) * 0.85;
      this.wingLeftMesh.rotation.z = flap;
      this.wingRightMesh.rotation.z = -flap;
      this.wingLeftMesh.rotation.y = 0.35;
      this.wingRightMesh.rotation.y = -0.35;
    } else {
      // Folded back
      this.wingLeftMesh.rotation.z = 0.05;
      this.wingRightMesh.rotation.z = -0.05;
      this.wingLeftMesh.rotation.y = 0.05;
      this.wingRightMesh.rotation.y = -0.05;
    }

    // Retinotopic eye glow based on predator bearing
    const leftGlow = 0.3 + gradient.leftEyeIntensity * 1.8;
    const rightGlow = 0.3 + gradient.rightEyeIntensity * 1.8;
    this.eyeLeftMat.emissiveIntensity = leftGlow;
    this.eyeRightMat.emissiveIntensity = rightGlow;

    // Neural halo pulse
    // Halo brightness tracks measured lobula activity plus the modelled escape
    // drive, so what glows corresponds to something the engine actually reported.
    const esc = this.engine.getEscapeState();
    this.neuralHaloMat.opacity =
      0.15 + Math.min(0.85, esc.lobulaActivity * 6.0 + (esc.decision?.drive ?? 0) * 0.5);

    // 6. Update 3D Predator & Looming Cone
    this.predatorGroup.position.set(this.predator.x, this.predator.y, this.predator.z);
    this.predatorShadowDecal.position.set(this.predator.x, 0.2, this.predator.z);

    if (this.predator.active) {
      this.loomingConeMesh.visible = true;
      this._vPred.set(this.predator.x, this.predator.y, this.predator.z);
      this._vFly.set(this.fly.x, this.fly.y + 3.0, this.fly.z);

      const coneDist = this._vPred.distanceTo(this._vFly);
      this.loomingConeMesh.position.copy(this._vFly);
      this.loomingConeMesh.scale.set(1, coneDist, 1);
      this.loomingConeMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        this._vPred.clone().sub(this._vFly).normalize()
      );
    } else {
      this.loomingConeMesh.visible = false;
    }

    // Sucrose idle bobbing
    if (this.sucroseMesh) {
      this.sucroseMesh.rotation.y += 0.015;
      this.sucroseMesh.position.y = 3.5 + Math.sin(tSec * 2.5) * 0.6;
    }

    // 7. Check Encounter Outcomes
    const distToPred = euclideanDistance(this.fly.x, this.fly.z, this.predator.x, this.predator.z);
    if (this.predator.active && distToPred <= this.predator.radius && !this.fly.isFlying) {
      this.stop();
      this.callbacks.onEncounterEnd?.('caught', tSec, this.responseWallClockMs);
    } else if (this.fly.isFlying && tSec > 6.0 && distToPred > 90) {
      this.stop();
      this.callbacks.onEncounterEnd?.('escaped', tSec, this.responseWallClockMs);
    }

    // 8. Update Particles
    this.updateParticles();
  }

  private updateCamera(): void {
    if (this.cameraMode === 'overview') {
      // Spherical orbit around chamber center
      const x = this.orbitControls.radius * Math.sin(this.orbitControls.phi) * Math.sin(this.orbitControls.theta);
      const y = this.orbitControls.radius * Math.cos(this.orbitControls.phi);
      const z = this.orbitControls.radius * Math.sin(this.orbitControls.phi) * Math.cos(this.orbitControls.theta);
      this.camera.position.set(x, y, z);
      this.camera.lookAt(0, 0, 0);
    } else if (this.cameraMode === 'chase') {
      // Dynamic cinematic chase cam trailing the fly
      const trailDist = 28.0;
      const trailHeight = 14.0;
      const cx = this.fly.x - Math.sin(this.fly.heading) * trailDist;
      const cz = this.fly.z - Math.cos(this.fly.heading) * trailDist;
      const cy = this.fly.y + trailHeight;

      this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.12);
      this.camera.lookAt(this.fly.x, this.fly.y + 4.0, this.fly.z);
    } else if (this.cameraMode === 'compound_eye') {
      // First-person fly cockpit view looking outward
      this.camera.position.set(this.fly.x, this.fly.y + 4.0, this.fly.z);
      const lookX = this.fly.x + Math.sin(this.fly.heading) * 40;
      const lookZ = this.fly.z + Math.cos(this.fly.heading) * 40;
      this.camera.lookAt(lookX, this.fly.y + 4.0, lookZ);
    }
  }

  private updateParticles(): void {
    let activeCount = 0;
    const pos = this.particlePositions;
    const vel = this.particleVelocities;
    const life = this.particleLifes;

    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      if (life[i] > 0) {
        life[i] -= 0.025;
        const idx = i * 3;
        pos[idx] += vel[idx];
        pos[idx + 1] += vel[idx + 1];
        pos[idx + 2] += vel[idx + 2];
        vel[idx] *= 0.94;
        vel[idx + 1] *= 0.94;
        vel[idx + 2] *= 0.94;
        activeCount++;
      }
    }

    if (activeCount > 0) {
      this.particleGeo.attributes.position.needsUpdate = true;
    }
  }

  private spawnSparks(x: number, y: number, z: number): void {
    const pos = this.particlePositions;
    const vel = this.particleVelocities;
    const life = this.particleLifes;

    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.8 + 0.5;
      const idx = i * 3;

      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;

      vel[idx] = Math.sin(angle) * speed;
      vel[idx + 1] = Math.random() * 1.5 + 0.4;
      vel[idx + 2] = Math.cos(angle) * speed;

      life[i] = 1.0;
    }
    this.particleGeo.attributes.position.needsUpdate = true;
  }

  public render(): void {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public dispose(): void {
    this.stop();
    this.listenerAbort.abort();
    // renderer.dispose() alone leaves the WebGL context allocated; releaseRenderer
    // forces the context loss and detaches the canvas. See ui/render/Lifecycle.ts.
    if (this.scene) disposeSceneGraph(this.scene);
    releaseRenderer(this.renderer);
    this.renderer = null;
  }
}
