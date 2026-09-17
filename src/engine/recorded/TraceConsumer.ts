/**
 * TraceConsumer.ts
 *
 * Reads and streams precomputed ENGINE-RECORDED (MaleCNS v1.0, 166,700 neurons) traces.
 * 100% static JSON reader, zero Python required at runtime.
 */

import { RECORDED_ENGINE_METADATA } from '../shared/ConnectomeTypes';

export interface RecordedTraceSample {
  step: number;
  t: number;
  mouseX: number;
  mouseY: number;
  flyX: number;
  flyY: number;
  flyHeading: number;
  isFlying: boolean;
  threatActive?: boolean;
  caught?: boolean;
  dist: number;
  theta?: number;
  firedCount: number;
  giantFiberFired: boolean;
}

export interface RecordedTraceData {
  version: number;
  engine: 'RECORDED';
  dataset: string;
  neuronCount: number;
  totalEdges: number;
  citation: string;
  durationS: number;
  dtS: number;
  lesionType?: string;
  lesionedNeuronCount?: number;
  summary: {
    escaped: boolean;
    caught: boolean;
    caughtTimeS?: number | null;
    firstJumpLatencyMs: number | null;
    totalSpikes: number;
  };
  samples: RecordedTraceSample[];
}

export class TraceConsumer {
  private data: RecordedTraceData | null = null;
  private currentStep: number = 0;

  public async loadTrace(urlOrPath: string): Promise<RecordedTraceData> {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching trace from ${urlOrPath}`);
    this.data = await res.json();
    this.currentStep = 0;
    return this.data!;
  }

  public setTraceData(data: RecordedTraceData): void {
    this.data = data;
    this.currentStep = 0;
  }

  public getData(): RecordedTraceData | null {
    return this.data;
  }

  public getNeuronCount(): number {
    return this.data ? this.data.neuronCount : RECORDED_ENGINE_METADATA.totalNeurons;
  }

  public getDurationS(): number {
    return this.data ? this.data.durationS : 0;
  }

  public getDtS(): number {
    return this.data ? this.data.dtS : 0.02;
  }

  public getCurrentSample(): RecordedTraceSample | null {
    if (!this.data || this.data.samples.length === 0) return null;
    return this.data.samples[this.currentStep] || null;
  }

  public getSampleAtTime(t: number): RecordedTraceSample | null {
    if (!this.data || this.data.samples.length === 0) return null;
    const idx = Math.min(
      this.data.samples.length - 1,
      Math.max(0, Math.floor(t / this.data.dtS))
    );
    return this.data.samples[idx];
  }

  public seek(stepIndex: number): RecordedTraceSample | null {
    if (!this.data) return null;
    this.currentStep = Math.max(0, Math.min(this.data.samples.length - 1, stepIndex));
    return this.data.samples[this.currentStep];
  }

  public seekTime(timeS: number): RecordedTraceSample | null {
    if (!this.data) return null;
    const step = Math.floor(timeS / this.data.dtS);
    return this.seek(step);
  }

  public nextStep(): RecordedTraceSample | null {
    if (!this.data) return null;
    if (this.currentStep < this.data.samples.length - 1) {
      this.currentStep++;
      return this.data.samples[this.currentStep];
    }
    return null;
  }

  public hasFinished(): boolean {
    if (!this.data) return true;
    return this.currentStep >= this.data.samples.length - 1;
  }

  public reset(): void {
    this.currentStep = 0;
  }
}
