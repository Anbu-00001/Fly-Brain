/**
 * ArenaView.ts
 *
 * Implements the primary interactive arena where the simulated connectome fly
 * faces the user-controlled looming predator.
 * 60fps Canvas2D rendering with glowing vector aesthetics, biophysical looming cone,
 * and responsive escape kinematics.
 */

import { LiveEngineAdapter } from '../engine/live/LiveEngineAdapter';
import { LoomingCalculator } from '../engine/live/LoomingCalculator';
import { ReceptiveFieldGradient } from '../engine/shared/ConnectomeTypes';
import { normalizeAngle, euclideanDistance, clamp } from '../engine/shared/Metrics';
import { InputRecorder } from '../state/InputRecorder';
import { SeededRNG } from '../state/SeededRNG';

export interface ArenaViewCallbacks {
  onLoomUpdate?: (gradient: ReceptiveFieldGradient) => void;
  onEncounterEnd?: (result: 'escaped' | 'caught', survivalTimeS: number, latencyMs: number | null) => void;
  onThreatStarted?: () => void;
}

export class ArenaView {
  /**
   * All DOM listeners are registered with this signal so dispose() can remove
   * them in one call. The previous build attached anonymous arrow functions to
   * `window` (resize, mousemove, mouseup) and never removed them: each new view
   * instance added another permanent handler that retained the whole scene graph,
   * so navigating back and forth both leaked GPU memory and multiplied the work
   * done on every mouse move.
   */
  private listenerAbort = new AbortController();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;

  private engine: LiveEngineAdapter;
  private loomingCalc: LoomingCalculator;
  private recorder: InputRecorder;
  private rng: SeededRNG;
  private callbacks: ArenaViewCallbacks;

  // Fly state
  private fly = {
    x: 400,
    y: 300,
    heading: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    isFlying: false,
    flightAltitude: 0,
    wingPhase: 0,
    bodyRadius: 14,
  };

  // Predator (mouse) state
  private predator = {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    active: false,
    radius: 42,
  };

  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];

  private isRunning: boolean = false;
  private isReplayMode: boolean = false;
  private animFrameId: number | null = null;
  private startTimeMs: number = 0;
  private threatOnsetMs: number | null = null;
  private escapeOnsetMs: number | null = null;
  private responseWallClockMs: number | null = null;

  // Countdown state
  private countdownValue: number | null = null;

  constructor(
    parentElement: HTMLElement,
    engine: LiveEngineAdapter,
    recorder: InputRecorder,
    callbacks: ArenaViewCallbacks = {}
  ) {
    this.engine = engine;
    this.recorder = recorder;
    this.callbacks = callbacks;
    this.loomingCalc = new LoomingCalculator();
    this.rng = new SeededRNG(Date.now());

    this.container = document.createElement('div');
    this.container.id = 'arenaContainer';
    this.container.className = 'arena-container';
    parentElement.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'arenaCanvas';
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.setupEvents();
    this.resize();
  }

  private setupEvents(): void {
    window.addEventListener('resize', () => this.resize(), { signal: this.listenerAbort.signal });

    // Mouse movement drives the predator
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isReplayMode) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const newX = (e.clientX - rect.left) * scaleX;
      const newY = (e.clientY - rect.top) * scaleY;

      this.predator.vx = newX - this.predator.x;
      this.predator.vy = newY - this.predator.y;
      this.predator.x = newX;
      this.predator.y = newY;
      this.predator.active = true;

      // Check threat onset
      const dist = euclideanDistance(this.fly.x, this.fly.y, this.predator.x, this.predator.y);
      if (dist < 340 && this.threatOnsetMs === null && this.isRunning) {
        this.threatOnsetMs = performance.now();
        this.callbacks.onThreatStarted?.();
      }
    }, { signal: this.listenerAbort.signal });

    this.canvas.addEventListener('mouseleave', () => {
      if (!this.isReplayMode) {
        this.predator.active = false;
      }
    }, { signal: this.listenerAbort.signal });
  }

  public resize(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = Math.round(rect.width);
      this.canvas.height = Math.round(rect.height);
    }
  }

  public resetFly(seed: number = 42): void {
    this.rng.setSeed(seed);
    this.fly.x = this.canvas.width / 2 + this.rng.range(-40, 40);
    this.fly.y = this.canvas.height / 2 + this.rng.range(-40, 40);
    this.fly.heading = this.rng.range(-Math.PI, Math.PI);
    this.fly.vx = 0;
    this.fly.vy = 0;
    this.fly.speed = 0;
    this.fly.isFlying = false;
    this.fly.flightAltitude = 0;
    this.fly.wingPhase = 0;

    this.predator.x = -100;
    this.predator.y = -100;
    this.predator.active = false;

    this.threatOnsetMs = null;
    this.escapeOnsetMs = null;
    this.responseWallClockMs = null;
    this.particles = [];
    this.loomingCalc.reset();
  }

  public startEncounter(seed: number = 42): void {
    this.resetFly(seed);
    this.isReplayMode = false;
    this.isRunning = true;
    this.startTimeMs = performance.now();

    this.recorder.startRecording(seed, this.canvas.width, this.canvas.height, {
      x: this.fly.x,
      y: this.fly.y,
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

  /**
   * Releases everything this view owns. main.ts must call this on screen change:
   * the previous build only ever called stop(), so the canvas and its listeners
   * outlived the screen and accumulated across navigations.
   */
  public dispose(): void {
    this.stop();
    this.listenerAbort.abort();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }

  public setCountdown(val: number | null): void {
    this.countdownValue = val;
  }

  public setFlyPosition(x: number, y: number, heading: number, isFlying: boolean): void {
    this.fly.x = x;
    this.fly.y = y;
    this.fly.heading = heading;
    this.fly.isFlying = isFlying;
  }

  public setPredatorPosition(x: number, y: number, active: boolean): void {
    this.predator.x = x;
    this.predator.y = y;
    this.predator.active = active;
  }

  public enableReplayMode(enabled: boolean): void {
    this.isReplayMode = enabled;
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    this.updateKinematics();
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private updateKinematics(): void {
    const now = performance.now();
    const tSec = (now - this.startTimeMs) / 1000;

    // 1. Calculate Looming Stimulus
    const gradient = this.loomingCalc.compute(
      this.fly.x,
      this.fly.y,
      this.fly.heading,
      this.predator.x,
      this.predator.y,
      tSec
    );

    // Notify listeners for UI & Brain Gradient display
    this.callbacks.onLoomUpdate?.(gradient);

    // Record sample
    if (this.recorder.isRecording() && !this.isReplayMode) {
      this.recorder.recordSample(tSec, this.predator.x, this.predator.y, this.predator.active);
    }

    // 2. Inject into connectome
    this.engine.injectLoomingStimulus(gradient);

    // 3. Evaluate the escape decision.
    //    The model is LPLC2-style angular-size tuning plus LC4-style expansion-
    //    velocity tuning (Ache et al. 2019), gated on measured lobula activity.
    //    See engine/shared/EscapeModel.ts for what this does and does not claim.
    const decision = this.engine.evaluateEscape(gradient.angularLoomRad, gradient.expansionRate);

    if (decision.triggered && !this.fly.isFlying) {
      this.fly.isFlying = true;
      this.fly.flightAltitude = 1.0;
      this.escapeOnsetMs = now;

      if (this.threatOnsetMs !== null && this.responseWallClockMs === null) {
        this.responseWallClockMs = Math.round(this.escapeOnsetMs - this.threatOnsetMs);
      }

      // Explosive takeoff velocity away from predator
      const angleAway = gradient.bearingRad + Math.PI + this.rng.range(-0.3, 0.3);
      const worldEscapeAngle = this.fly.heading + angleAway;
      this.fly.vx = Math.cos(worldEscapeAngle) * 12.0;
      this.fly.vy = Math.sin(worldEscapeAngle) * 12.0;

      // Spawn takeoff particles
      this.spawnTakeoffSparks(this.fly.x, this.fly.y);
    }

    // 4. Update Fly Position
    if (this.fly.isFlying) {
      // High-speed evasive flight
      this.fly.x += this.fly.vx;
      this.fly.y += this.fly.vy;
      this.fly.vx *= 0.96;
      this.fly.vy *= 0.96;
      this.fly.heading = Math.atan2(this.fly.vy, this.fly.vx);
      this.fly.wingPhase += 0.45;

      // Boundary bounce
      if (this.fly.x < 30 || this.fly.x > this.canvas.width - 30) {
        this.fly.vx = -this.fly.vx * 0.8;
      }
      if (this.fly.y < 30 || this.fly.y > this.canvas.height - 30) {
        this.fly.vy = -this.fly.vy * 0.8;
      }
    } else {
      // Ground walking.
      //
      // Heading wander is AUTHORED: it is seeded RNG, not neural. The previous
      // build wrote `turnBias = (acc.walkRight - acc.walkLeft) * 0.08` and called
      // it "driven by connectome", but those two accumulators were computed with
      // identical formulas, so turnBias was identically zero and the wander was
      // always just this RNG. We keep the RNG and drop the false attribution.
      this.fly.heading = normalizeAngle(this.fly.heading + this.rng.range(-0.02, 0.02));

      // Walk speed IS neural: normalised descending-trunk (GNG_DESC) activity.
      const descAct = this.engine.getDescendingActivity();
      const walkSpeed = Math.min(2.5, descAct * 18.0 + 0.3);
      this.fly.x += Math.cos(this.fly.heading) * walkSpeed;
      this.fly.y += Math.sin(this.fly.heading) * walkSpeed;
      this.fly.wingPhase += 0.05;

      // Soft boundary turning
      const margin = 50;
      if (this.fly.x < margin) this.fly.heading = 0;
      else if (this.fly.x > this.canvas.width - margin) this.fly.heading = Math.PI;
      if (this.fly.y < margin) this.fly.heading = Math.PI / 2;
      else if (this.fly.y > this.canvas.height - margin) this.fly.heading = -Math.PI / 2;
    }

    // Clamp inside arena
    this.fly.x = clamp(this.fly.x, 20, this.canvas.width - 20);
    this.fly.y = clamp(this.fly.y, 20, this.canvas.height - 20);

    // 5. Check Catch Condition
    const distToPred = euclideanDistance(this.fly.x, this.fly.y, this.predator.x, this.predator.y);
    if (this.predator.active && distToPred <= this.predator.radius && !this.fly.isFlying) {
      // Fly is caught!
      this.stop();
      this.callbacks.onEncounterEnd?.('caught', tSec, this.responseWallClockMs);
    } else if (this.fly.isFlying && tSec > 6.0 && distToPred > 350) {
      // Successfully escaped threat
      this.stop();
      this.callbacks.onEncounterEnd?.('escaped', tSec, this.responseWallClockMs);
    }

    // 6. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= 0.03;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background: deep obsidian grid
    ctx.fillStyle = '#060a0f';
    ctx.fillRect(0, 0, w, h);

    // Subtle laboratory grid lines
    ctx.strokeStyle = 'rgba(15, 28, 44, 0.7)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Arena border with neon corner brackets
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Draw Optical Looming Cone
    if (this.predator.active) {
      this.drawLoomingCone(ctx);
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw Predator (Cursor / Looming Threat)
    if (this.predator.active) {
      this.drawPredator(ctx);
    }

    // Draw Fly
    this.drawFly(ctx);

    // Countdown overlay
    if (this.countdownValue !== null) {
      this.drawCountdownOverlay(ctx);
    }
  }

  private drawLoomingCone(ctx: CanvasRenderingContext2D): void {
    const fx = this.fly.x;
    const fy = this.fly.y;
    const px = this.predator.x;
    const py = this.predator.y;

    const dist = euclideanDistance(fx, fy, px, py);
    if (dist > 380) return;

    const angle = Math.atan2(py - fy, px - fx);
    const R = this.predator.radius;
    const perpAngle = angle + Math.PI / 2;

    const p1x = px + Math.cos(perpAngle) * R;
    const p1y = py + Math.sin(perpAngle) * R;
    const p2x = px - Math.cos(perpAngle) * R;
    const p2y = py - Math.sin(perpAngle) * R;

    // Semi-transparent looming shadow cone
    const grad = ctx.createLinearGradient(px, py, fx, fy);
    grad.addColorStop(0, 'rgba(255, 51, 102, 0.25)');
    grad.addColorStop(0.7, 'rgba(0, 240, 255, 0.12)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Vector ray
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPredator(ctx: CanvasRenderingContext2D): void {
    const px = this.predator.x;
    const py = this.predator.y;
    const r = this.predator.radius;

    // Reticle rings
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 51, 102, 0.3)';
    ctx.fill();

    // Crosshair ticks
    const tick = 8;
    ctx.beginPath();
    ctx.moveTo(px - r - tick, py); ctx.lineTo(px - r + tick, py);
    ctx.moveTo(px + r - tick, py); ctx.lineTo(px + r + tick, py);
    ctx.moveTo(px, py - r - tick); ctx.lineTo(px, py - r + tick);
    ctx.moveTo(px, py + r - tick); ctx.lineTo(px, py + r + tick);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ff3366';
    ctx.font = '10px monospace';
    ctx.fillText('THREAT [MOUSE]', px + r + 8, py - 6);
  }

  private drawFly(ctx: CanvasRenderingContext2D): void {
    const fx = this.fly.x;
    const fy = this.fly.y;
    const h = this.fly.heading;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(h);

    // Wing flutter if flying
    const wingAngle = this.fly.isFlying
      ? Math.sin(this.fly.wingPhase) * 0.85
      : Math.sin(this.fly.wingPhase) * 0.15;

    // Wings (translucent iridescent)
    ctx.save();
    ctx.fillStyle = 'rgba(160, 240, 255, 0.45)';
    ctx.strokeStyle = 'rgba(200, 255, 255, 0.8)';
    ctx.lineWidth = 1;

    // Left wing
    ctx.save();
    ctx.rotate(-0.4 + wingAngle);
    ctx.beginPath();
    ctx.ellipse(-6, -14, 18, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.rotate(0.4 - wingAngle);
    ctx.beginPath();
    ctx.ellipse(-6, 14, 18, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // Fly Abdomen (striped segments)
    ctx.beginPath();
    ctx.ellipse(-14, 0, 15, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Abdominal stripes
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-16, -6); ctx.lineTo(-16, 6);
    ctx.moveTo(-10, -7); ctx.lineTo(-10, 7);
    ctx.moveTo(-4, -6);  ctx.lineTo(-4, 6);
    ctx.stroke();

    // Thorax
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.ellipse(10, 0, 6, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Large Red/Orange Drosophila Compound Eyes
    ctx.fillStyle = '#f43f5e';
    // Left eye
    ctx.beginPath();
    ctx.arc(11, -5, 3.8, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    ctx.arc(11, 5, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Status ring if flying
    if (this.fly.isFlying) {
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private drawCountdownOverlay(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(6, 10, 15, 0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;

    const text = this.countdownValue === 0 ? 'FLY RELEASED' : String(this.countdownValue);
    ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 0;
  }

  private spawnTakeoffSparks(x: number, y: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: Math.random() > 0.4 ? '#00f0ff' : '#ff3366',
      });
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
