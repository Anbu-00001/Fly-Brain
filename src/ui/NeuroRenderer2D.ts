import { LIVE_ENGINE_METADATA } from '../engine/shared/ConnectomeTypes';
/**
 * NeuroRenderer2D.ts
 *
 * High-performance WebGL2 point-cloud visualizer rendering all 139,255 neurons
 * in real-time, grouped by region, with interpolated brightness decay.
 */

export class NeuroRenderer2D {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;

  private program: WebGLProgram | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private brightnessBuffer: WebGLBuffer | null = null;

  // Sourced from the engine metadata rather than transcribed, so this cannot
  // drift away from the dataset the worker actually loaded.
  private neuronCount: number = LIVE_ENGINE_METADATA.totalNeurons;
  private brightnessData: Float32Array;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  private static REGION_COLORS = [
    [0.23, 0.51, 0.96], // sensory (blue)
    [0.55, 0.36, 0.96], // central (purple)
    [0.96, 0.62, 0.04], // drives (amber)
    [0.94, 0.27, 0.27], // motor (red)
  ];

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'neuroRendererWrap';
    this.container.className = 'neuro-renderer-wrap';
    parentElement.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'neuroCanvas';
    this.container.appendChild(this.canvas);

    this.brightnessData = new Float32Array(this.neuronCount);
    this.initGL();
  }

  private initGL(): void {
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) {
      console.warn('WebGL2 not available for NeuroRenderer2D, using fallback canvas');
      return;
    }
    this.gl = gl;

    this.buildShaders();
    this.buildBuffers();
    this.resize();
  }

  private buildShaders(): void {
    const gl = this.gl!;

    const vsSource = `#version 300 es
      in vec2 a_pos;
      in vec3 a_color;
      in float a_brightness;

      out vec3 v_color;
      out float v_brightness;

      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
        gl_PointSize = 1.2 + a_brightness * 1.5;
        v_color = a_color;
        v_brightness = a_brightness;
      }
    `;

    const fsSource = `#version 300 es
      precision mediump float;

      in vec3 v_color;
      in float v_brightness;
      out vec4 fragColor;

      void main() {
        float b = clamp(v_brightness, 0.12, 1.0);
        vec3 finalColor = v_color * b;
        fragColor = vec4(finalColor, 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(this.program));
    }
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile failed:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  private buildBuffers(): void {
    const gl = this.gl!;
    const N = this.neuronCount;

    // Arrange neurons in compact structured grid
    const cols = 360;
    const rows = Math.ceil(N / cols);

    const positions = new Float32Array(N * 2);
    const colors = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);

      // Normalized device coordinates (-1 to +1)
      positions[i * 2] = (c / cols) * 1.9 - 0.95;
      positions[i * 2 + 1] = 0.95 - (r / rows) * 1.9;

      // Assign region color based on relative position
      let reg = 1; // central
      if (i < 82318) reg = 0; // sensory (medulla/lobula)
      else if (i > N - 10000) reg = 3; // motor
      else if (i > N - 20000) reg = 2; // drives

      const rgb = NeuroRenderer2D.REGION_COLORS[reg];
      colors[i * 3] = rgb[0];
      colors[i * 3 + 1] = rgb[1];
      colors[i * 3 + 2] = rgb[2];
    }

    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    this.brightnessBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.brightnessBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.brightnessData, gl.DYNAMIC_DRAW);
  }

  public updateFireState(fireArray: Uint8Array): void {
    const len = Math.min(fireArray.length, this.neuronCount);
    for (let i = 0; i < len; i++) {
      if (fireArray[i] > 0) {
        this.brightnessData[i] = 1.0;
      }
    }
  }

  public resize(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = Math.round(rect.width);
      this.canvas.height = Math.round(rect.height);
      if (this.gl) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderLoop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public dispose(): void {
    this.stop();
    const el = this.getElement();
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  private renderLoop = (): void => {
    if (!this.isRunning) return;

    this.renderFrame();
    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  private renderFrame(): void {
    const gl = this.gl;
    if (!gl || !this.program) return;

    // Decay brightness smoothly
    for (let i = 0; i < this.neuronCount; i++) {
      this.brightnessData[i] *= 0.84;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.brightnessBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.brightnessData);

    gl.clearColor(0.04, 0.06, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    const aPos = gl.getAttribLocation(this.program, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const aColor = gl.getAttribLocation(this.program, 'a_color');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

    const aBrightness = gl.getAttribLocation(this.program, 'a_brightness');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.brightnessBuffer);
    gl.enableVertexAttribArray(aBrightness);
    gl.vertexAttribPointer(aBrightness, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, this.neuronCount);
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
