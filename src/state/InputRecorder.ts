/**
 * InputRecorder.ts
 *
 * Records and plays back encounters deterministically.
 * Conforms strictly to §13 of AGENTS.md.
 */

import { InputLogSample, ReplayLog } from '../engine/shared/ConnectomeTypes';

export class InputRecorder {
  private samples: InputLogSample[] = [];
  private seed: number = 42;
  private arenaWidth: number = 800;
  private arenaHeight: number = 600;
  private initialFly = { x: 400, y: 300, heading: 0 };
  private recording: boolean = false;

  public startRecording(
    seed: number,
    arenaW: number,
    arenaH: number,
    initialFly: { x: number; y: number; heading: number }
  ): void {
    this.seed = seed;
    this.arenaWidth = arenaW;
    this.arenaHeight = arenaH;
    this.initialFly = { ...initialFly };
    this.samples = [];
    this.recording = true;
  }

  public recordSample(t: number, mouseX: number, mouseY: number, threatActive: boolean): void {
    if (!this.recording) return;
    this.samples.push({
      t: Math.round(t * 1000) / 1000,
      mouseX: Math.round(mouseX * 10) / 10,
      mouseY: Math.round(mouseY * 10) / 10,
      threatActive,
    });
  }

  public stopRecording(summary?: ReplayLog['summary']): ReplayLog {
    this.recording = false;
    return {
      version: 1,
      engine: 'LIVE',
      dataset: 'FlyWire FAFB v783',
      neuronCount: 139255,
      seed: this.seed,
      arenaWidth: this.arenaWidth,
      arenaHeight: this.arenaHeight,
      initialFly: this.initialFly,
      samples: [...this.samples],
      summary,
    };
  }

  public getSamples(): InputLogSample[] {
    return this.samples;
  }

  public isRecording(): boolean {
    return this.recording;
  }

  /**
   * Sample linear interpolation for replay playback at arbitrary time t
   */
  public static sampleAt(samples: InputLogSample[], t: number): InputLogSample | null {
    if (samples.length === 0) return null;
    if (t <= samples[0].t) return samples[0];
    if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];

    // Binary search for segment
    let low = 0;
    let high = samples.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (samples[mid].t === t) return samples[mid];
      if (samples[mid].t < t) low = mid + 1;
      else high = mid - 1;
    }

    const idx0 = Math.max(0, high);
    const idx1 = Math.min(samples.length - 1, low);
    const s0 = samples[idx0];
    const s1 = samples[idx1];
    const dt = s1.t - s0.t;
    if (dt <= 0.0001) return s0;

    const alpha = (t - s0.t) / dt;
    return {
      t,
      mouseX: s0.mouseX + (s1.mouseX - s0.mouseX) * alpha,
      mouseY: s0.mouseY + (s1.mouseY - s0.mouseY) * alpha,
      threatActive: alpha < 0.5 ? s0.threatActive : s1.threatActive,
    };
  }
}
