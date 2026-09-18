/**
 * Lifecycle.ts
 *
 * Render-loop and GPU-resource lifecycle. This module exists because the previous
 * build reliably overheated and crashed the development laptop, and the cause was
 * not the simulation — it was leaked GPU state.
 *
 * WHAT WAS ACTUALLY WRONG
 * -----------------------
 * main.ts tore screens down with:
 *
 *     this.screenMount.innerHTML = '';
 *
 * after calling stopExperiment(), which called .stop() on each view but .dispose()
 * on none of them. Every visit to the Experiment screen then constructed a fresh
 * Arena3DView and a fresh BrainView3D — two new WebGLRenderers, each with its own
 * WebGL context, scene graph, geometries and textures. Nothing released the old
 * ones. Navigating Experiment -> Lab -> Experiment a handful of times walked
 * straight into the browser's per-page context cap (commonly ~16) while GPU memory
 * thrashed. The Experiment screen also built the 2D and 3D arenas simultaneously
 * and merely hid one, so half the allocated GPU work was never visible.
 *
 * Two further details mattered:
 *
 *   - `renderer.dispose()` does NOT release the WebGL context. It frees Three.js's
 *     own caches. The context is only handed back via forceContextLoss(), and the
 *     canvas must leave the DOM. Both views called dispose() alone.
 *   - Nothing disposed the scene graph, so geometries, materials and textures
 *     stayed resident even after the renderer went away.
 *
 * WHAT THIS MODULE GUARANTEES
 * ---------------------------
 *   - one owner per GPU resource, released deterministically (DisposalBag)
 *   - contexts genuinely returned (releaseRenderer)
 *   - no rendering while the tab is hidden (RenderLoop) — the single largest
 *     thermal win, since a backgrounded tab previously kept animating
 *   - a frame-rate ceiling and a device-pixel-ratio ceiling, so a high-DPI
 *     laptop panel does not quietly ask the GPU for 4x the fragment work
 */

import * as THREE from 'three';

/* ---------- disposal ---------- */

export interface Disposable {
  dispose(): void;
}

/** Collects disposables so a screen can release everything it owns in one call. */
export class DisposalBag implements Disposable {
  private items: Array<Disposable | (() => void)> = [];

  public add<T extends Disposable | (() => void)>(item: T): T {
    this.items.push(item);
    return item;
  }

  public dispose(): void {
    // Release in reverse acquisition order, so dependents go before dependencies.
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      try {
        if (typeof item === 'function') item();
        else item.dispose();
      } catch (err) {
        // A failing teardown must not strand the rest of the bag.
        console.error('DisposalBag: item failed to dispose', err);
      }
    }
    this.items = [];
  }
}

/**
 * Disposes every geometry, material and texture reachable from a scene.
 * Three.js does not do this for you: removing an object from the graph drops the
 * reference but leaves the GPU allocation alive until the resource is disposed.
 */
export function disposeSceneGraph(root: THREE.Object3D): void {
  const seenMaterials = new Set<THREE.Material>();
  const seenTextures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh | THREE.Points | THREE.Line;
    const geom = (mesh as any).geometry as THREE.BufferGeometry | undefined;
    if (geom && typeof geom.dispose === 'function') geom.dispose();

    const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      if (!m || seenMaterials.has(m)) continue;
      seenMaterials.add(m);
      // Textures hang off arbitrary named slots; sweep the material's own keys.
      for (const key of Object.keys(m) as Array<keyof THREE.Material>) {
        const val = (m as any)[key];
        if (val && val.isTexture && !seenTextures.has(val)) {
          seenTextures.add(val);
          val.dispose();
        }
      }
      m.dispose();
    }
  });

  root.clear();
}

/**
 * Genuinely releases a WebGLRenderer: disposes Three.js caches, forces the
 * context to be surrendered, and detaches the canvas. Call this, never
 * `renderer.dispose()` on its own.
 */
export function releaseRenderer(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  try {
    renderer.dispose();
    // forceContextLoss is what actually hands the context back to the browser.
    renderer.forceContextLoss();
  } catch (err) {
    console.error('releaseRenderer: failed to release context', err);
  }
  const canvas = renderer.domElement;
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
}

/* ---------- render budget ---------- */

/**
 * Caps the device pixel ratio. A 2x or 3x panel multiplies fragment work by 4x or
 * 9x for a visual gain that is marginal on a dark, glow-heavy scene, and it is a
 * direct and avoidable cause of sustained GPU load on a laptop.
 */
export const MAX_PIXEL_RATIO = 1.5;

export function clampedPixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

export interface RenderLoopOptions {
  /** Frames per second ceiling. 30 is ample for this content and halves GPU load. */
  fps?: number;
  /** Pause when the tab is hidden. Defaults to true and should stay true. */
  pauseWhenHidden?: boolean;
}

/**
 * A requestAnimationFrame loop that stops when it should.
 *
 * Every animated view in this app owns one of these instead of calling
 * requestAnimationFrame directly, so that "is anything still rendering?" has a
 * single answer rather than eight independent ones.
 */
export class RenderLoop implements Disposable {
  private rafId: number | null = null;
  private running = false;
  private lastFrameMs = 0;
  private readonly minFrameMs: number;
  private readonly pauseWhenHidden: boolean;
  private readonly onFrame: (dtMs: number) => void;
  private readonly visibilityHandler: () => void;

  constructor(onFrame: (dtMs: number) => void, opts: RenderLoopOptions = {}) {
    this.onFrame = onFrame;
    this.minFrameMs = 1000 / (opts.fps ?? 30);
    this.pauseWhenHidden = opts.pauseWhenHidden ?? true;

    this.visibilityHandler = () => {
      if (!this.pauseWhenHidden) return;
      if (document.hidden) this.pause();
      else if (this.running) this.schedule();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameMs = performance.now();
    if (!(this.pauseWhenHidden && document.hidden)) this.schedule();
  }

  public stop(): void {
    this.running = false;
    this.pause();
  }

  public get isRunning(): boolean {
    return this.running;
  }

  private pause(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private schedule(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame((now) => {
      this.rafId = null;
      if (!this.running) return;

      const elapsed = now - this.lastFrameMs;
      if (elapsed >= this.minFrameMs) {
        this.lastFrameMs = now;
        try {
          this.onFrame(elapsed);
        } catch (err) {
          // A throwing frame must not silently kill the loop with no trace.
          console.error('RenderLoop: frame callback threw', err);
        }
      }
      if (this.running) this.schedule();
    });
  }

  public dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }
}

/**
 * Creates a renderer with settings chosen for sustained laptop use rather than
 * for benchmark screenshots: no antialiasing (the bloom-free dark scene hides its
 * absence), low-power GPU preference, and a clamped pixel ratio.
 */
export function createThermalSafeRenderer(canvas?: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'low-power',
    // Avoids an extra full-screen buffer the app never reads back.
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(clampedPixelRatio());
  return renderer;
}
