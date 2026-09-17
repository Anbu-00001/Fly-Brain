/**
 * LiveEngineAdapter.ts
 *
 * Wraps ENGINE-LIVE's Web Worker (sim-worker.js) and maps real Drosophila connectome
 * activations to motor and behavioral responses.
 *
 * Implements the NEW Looming Stimulus Channel into the 139,255-neuron LIF simulation:
 * - Reads ReceptiveFieldGradient (left/right compound eye intensities, angular expansion)
 * - Directly stimulates FlyWire lobula & medulla visual groups (VIS_ME, VIS_LO, VIS_LPTC, VIS_R1R6)
 * - Reads descending motor commands (GNG_DESC, VNC_CPG) and computes escape takeoff / turn
 */

import { ReceptiveFieldGradient, SimulationTickData, LIVE_ENGINE_METADATA } from '../shared/ConnectomeTypes';

export interface LiveEngineCallbacks {
  onReady?: (neuronCount: number, edgeCount: number) => void;
  onTick?: (data: SimulationTickData) => void;
  onStats?: (stats: { avgTickMs: number; firedPct: number; activePct: number }) => void;
  onError?: (err: string) => void;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  onBreakpointHit?: (bpId: string, tick: number, spikes: Record<string, number>) => void;
}

export class LiveEngineAdapter {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private isRunning: boolean = false;

  private neuronCount: number = 0;
  private edgeCount: number = 0;
  private groupCount: number = 0;
  private groupNameToId: Record<string, number> = {};
  private groupIdToName: string[] = [];
  private groupIndices: Uint32Array[] = [];
  private regionTypeArr: Uint8Array | null = null;
  private groupIdArr: Uint16Array | null = null;

  // Real-time behavioral motor outputs computed from connectome spikes
  private accumWalkLeft: number = 0;
  private accumWalkRight: number = 0;
  private accumFlight: number = 0;
  private accumStartle: number = 0;
  private escapeTriggeredThisTick: boolean = false;

  // Dynamic milestone extraction: records first tick each critical circuit fires
  private dynamicMilestones: Record<string, number> = {};

  private callbacks: LiveEngineCallbacks = {};

  constructor(callbacks: LiveEngineCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public getReady(): boolean {
    return this.isReady;
  }

  public getNeuronCount(): number {
    return this.neuronCount || LIVE_ENGINE_METADATA.totalNeurons;
  }

  public getEdgeCount(): number {
    return this.edgeCount || LIVE_ENGINE_METADATA.totalEdges;
  }

  public getRegionTypeArray(): Uint8Array | null {
    return this.regionTypeArr;
  }

  public getGroupIdArray(): Uint16Array | null {
    return this.groupIdArr;
  }

  public getGroupIdToName(): string[] {
    return this.groupIdToName;
  }

  public getAccumulators() {
    return {
      walkLeft: this.accumWalkLeft,
      walkRight: this.accumWalkRight,
      flight: this.accumFlight,
      startle: this.accumStartle,
      escapeTriggered: this.escapeTriggeredThisTick,
    };
  }

  /**
   * Initializes the connectome worker and loads the binary dataset
   */
  public async init(): Promise<void> {
    try {
      // 1. Fetch metadata
      const metaRes = await fetch('data/neuron_meta.json');
      if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} fetching neuron_meta.json`);
      const meta = await metaRes.json();

      this.groupCount = meta.group_count;
      for (const g of meta.groups) {
        this.groupNameToId[g.name] = g.id;
        this.groupIdToName[g.id] = g.name;
      }

      // 2. Fetch binary connectome with progress reporting
      const buffer = await this.fetchWithProgress('data/connectome.bin.gz');

      // 3. Spawn worker
      this.worker = new Worker('sim-worker.js');
      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.onerror = (err) => {
        const msg = err.message || 'Worker error';
        console.error('sim-worker error:', err);
        this.callbacks.onError?.(msg);
      };

      // 4. Send init buffer to worker
      this.worker.postMessage({ type: 'init', buffer }, [buffer]);
    } catch (err: any) {
      console.error('LiveEngineAdapter initialization failed:', err);
      this.callbacks.onError?.(err.message || String(err));
      throw err;
    }
  }

  public start(): void {
    if (!this.worker || !this.isReady || this.isRunning) return;
    this.isRunning = true;
    this.worker.postMessage({ type: 'start' });
  }

  public stop(): void {
    if (!this.worker || !this.isRunning) return;
    this.isRunning = false;
    this.worker.postMessage({ type: 'stop' });
  }

  public reset(): void {
    if (!this.worker) return;
    this.accumWalkLeft = 0;
    this.accumWalkRight = 0;
    this.accumFlight = 0;
    this.accumStartle = 0;
    this.escapeTriggeredThisTick = false;
    this.dynamicMilestones = {};
    this.worker.postMessage({ type: 'reset' });
  }

  /**
   * Continuous Looming Stimulus Injection:
   * Translates receptive field gradient into direct neural excitation in lobula & medulla.
   */
  public injectLoomingStimulus(gradient: ReceptiveFieldGradient): void {
    if (!this.worker || !this.isReady) return;

    // Base sensory intensity scale
    const baseIntensity = 0.22;
    const segments: Array<{ name: string; intensity: number }> = [];

    // Looming threat elevates lobula (VIS_LO) and medulla (VIS_ME)
    if (gradient.angularLoomRad > 0.05 || gradient.expansionRate > 0.05) {
      const loomPower = gradient.angularLoomRad * 0.4 + gradient.expansionRate * 1.5;

      // Medulla (visual processing layer)
      segments.push({
        name: 'VIS_ME',
        intensity: baseIntensity * (gradient.leftEyeIntensity + gradient.rightEyeIntensity) * 0.6,
      });

      // Lobula (looming collision detector layer)
      segments.push({
        name: 'VIS_LO',
        intensity: baseIntensity * loomPower * 1.4,
      });

      // Lobula plate (motion / optic flow)
      segments.push({
        name: 'VIS_LPTC',
        intensity: baseIntensity * gradient.expansionRate * 0.8,
      });
    }

    // General photoreceptors (light / visual novelty)
    const avgVisual = (gradient.leftEyeIntensity + gradient.rightEyeIntensity) * 0.5;
    if (avgVisual > 0.02) {
      segments.push({
        name: 'VIS_R1R6',
        intensity: baseIntensity * avgVisual * 0.5,
      });
    }

    // Tonic compass navigation background
    segments.push({ name: 'CX_FC', intensity: 0.04 });
    segments.push({ name: 'CX_EPG', intensity: 0.04 });
    segments.push({ name: 'CX_PFN', intensity: 0.04 });

    // Collect all neuron indices and intensities
    let totalIndices = 0;
    const preparedSegs: Array<{ idxs: Uint32Array; intensity: number }> = [];

    for (const seg of segments) {
      const gid = this.groupNameToId[seg.name];
      if (gid === undefined) continue;
      const idxs = this.groupIndices[gid];
      if (!idxs || idxs.length === 0) continue;
      preparedSegs.push({ idxs, intensity: seg.intensity });
      totalIndices += idxs.length;
    }

    if (totalIndices === 0) return;

    const allIndices = new Uint32Array(totalIndices);
    const allIntensities = new Float32Array(totalIndices);
    let offset = 0;

    for (const p of preparedSegs) {
      allIndices.set(p.idxs, offset);
      allIntensities.fill(p.intensity, offset, offset + p.idxs.length);
      offset += p.idxs.length;
    }

    // Apply sustained stimulation for this tick
    this.worker.postMessage({
      type: 'setStimulusState',
      indices: allIndices,
      intensities: allIntensities,
    });
  }

  /**
   * One-shot optical flash into a specific brain region (User requested interactive tool)
   */
  public flashBrainRegion(regionGroupName: string, intensity: number = 0.8): void {
    if (!this.worker || !this.isReady) return;
    const gid = this.groupNameToId[regionGroupName];
    if (gid === undefined) return;
    const idxs = this.groupIndices[gid];
    if (!idxs || idxs.length === 0) return;

    const intensities = new Float32Array(idxs.length);
    intensities.fill(intensity);

    this.worker.postMessage({
      type: 'stimulate',
      indices: idxs,
      intensities: intensities,
    });
  }

  /**
   * Genuine biophysical interventions: SILENCE, INVERT, AMPLIFY, RESTORE
   */
  public applyInterventions(
    interventions: Array<{
      type: 'silence' | 'stimulate' | 'invert' | 'amplify' | 'restore';
      groupName: string;
      factor?: number;
    }>
  ): void {
    if (!this.worker || !this.isReady) return;
    const workerInterventions = interventions
      .map((inv) => ({
        type: inv.type,
        groupId: this.groupNameToId[inv.groupName],
        factor: inv.factor,
      }))
      .filter((inv) => inv.groupId !== undefined);

    this.worker.postMessage({
      type: 'setInterventions',
      interventions: workerInterventions,
    });
  }

  /**
   * Single-step execution for GDB debugger
   */
  public step(count: number = 1): void {
    if (!this.worker || !this.isReady) return;
    this.worker.postMessage({ type: 'step', count });
  }

  /**
   * Sets breakpoint rules for GDB-style simulation halting
   */
  public setBreakpoints(
    breakpoints: Array<{
      id: string;
      type: 'spike' | 'step' | 'descending';
      groupName?: string;
      threshold?: number;
      step?: number;
    }>
  ): void {
    if (!this.worker || !this.isReady) return;
    const workerBps = breakpoints.map((bp) => ({
      id: bp.id,
      type: bp.type,
      groupId: bp.groupName ? this.groupNameToId[bp.groupName] : undefined,
      threshold: bp.threshold,
      step: bp.step,
    }));

    this.worker.postMessage({
      type: 'setBreakpoints',
      breakpoints: workerBps,
    });
  }

  /**
   * Returns dynamically measured milestone firing latencies in milliseconds
   */
  public getDynamicTimeline(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.dynamicMilestones)) {
      result[k] = v * 100; // 100ms per tick
    }
    return result;
  }

  private handleMessage(e: MessageEvent): void {
    const data = e.data;
    switch (data.type) {
      case 'ready':
        this.neuronCount = data.neuronCount;
        this.edgeCount = data.edgeCount;
        this.groupIdArr = new Uint16Array(data.groupId.buffer ? data.groupId.buffer : data.groupId);
        this.regionTypeArr = new Uint8Array(data.regionType.buffer ? data.regionType.buffer : data.regionType);
        this.buildGroupIndices();
        this.isReady = true;
        this.callbacks.onReady?.(this.neuronCount, this.edgeCount);
        break;

      case 'tick':
        this.processWorkerTick(data);
        break;

      case 'breakpointHit':
        this.isRunning = false;
        const bpGroupSpikes: Record<string, number> = {};
        if (data.groupSpikeCounts) {
          for (let g = 0; g < this.groupCount; g++) {
            bpGroupSpikes[this.groupIdToName[g]] = data.groupSpikeCounts[g] || 0;
          }
        }
        this.callbacks.onBreakpointHit?.(data.breakpointId, data.tickCount, bpGroupSpikes);
        break;

      case 'stats':
        if (this.callbacks.onStats) {
          const firedPct = Math.round(((data.firedNeurons || 0) / (data.totalNeurons || 1)) * 100);
          const activePct = Math.round(((data.activeNeurons || 0) / (data.totalNeurons || 1)) * 100);
          this.callbacks.onStats({
            avgTickMs: data.avgTickMs,
            firedPct,
            activePct,
          });
        }
        break;

      case 'error':
        console.error('sim-worker error:', data.message);
        this.callbacks.onError?.(data.message);
        break;
    }
  }

  private processWorkerTick(data: any): void {
    const groupSpikeCounts: Uint16Array = data.groupSpikeCounts;
    const firedCount: number = data.firedNeurons || 0;
    const tickCount: number = data.tickCount || 0;

    const groupSpikes: Record<string, number> = {};
    const regionalFired = {
      sensory: 0,
      central: 0,
      drives: 0,
      motor: 0,
    };

    if (groupSpikeCounts && this.groupIdToName.length > 0) {
      for (let g = 0; g < this.groupCount; g++) {
        const name = this.groupIdToName[g];
        const count = groupSpikeCounts[g] || 0;
        groupSpikes[name] = count;

        // Categorize into regions
        if (name.startsWith('VIS_') || name.startsWith('OLF_') || name.startsWith('MECH_') || name.startsWith('THERMO_')) {
          regionalFired.sensory += count;
        } else if (name.startsWith('MB_') || name.startsWith('CX_') || name.startsWith('LH_') || name.startsWith('SEZ_') || name.startsWith('GUS_') || name.startsWith('GNG_DESC')) {
          regionalFired.central += count;
        } else if (name.startsWith('DRIVE_')) {
          regionalFired.drives += count;
        } else {
          regionalFired.motor += count;
        }

        // Dynamically record first spike time per critical circuit
        if (count > 0 && this.dynamicMilestones[name] === undefined) {
          this.dynamicMilestones[name] = tickCount;
        }
      }
    }

    // Motor and Startle accumulation
    // In FlyWire FAFB: GNG_DESC are the descending neurons from the brain to the VNC
    const descSpikes = groupSpikes['GNG_DESC'] || 0;
    const lobulaSpikes = groupSpikes['VIS_LO'] || 0;
    const opticFlowSpikes = groupSpikes['VIS_LPTC'] || 0;

    // Decay accumulators
    this.accumWalkLeft *= 0.85;
    this.accumWalkRight *= 0.85;
    this.accumFlight *= 0.85;
    this.accumStartle *= 0.82;

    // Add descending drive
    this.accumWalkLeft += descSpikes * 0.05 + opticFlowSpikes * 0.04;
    this.accumWalkRight += descSpikes * 0.05 + opticFlowSpikes * 0.04;
    this.accumFlight += lobulaSpikes * 0.12 + descSpikes * 0.08;
    this.accumStartle += lobulaSpikes * 0.25;

    // Check escape trigger threshold
    this.escapeTriggeredThisTick = this.accumStartle > 25 || this.accumFlight > 18;

    const tickPayload: SimulationTickData = {
      tickCount,
      firedCount,
      activeNeurons: firedCount,
      regionalFired,
      groupSpikes,
      dtMs: 100, // 10 ticks per second
      escapeCommandFired: this.escapeTriggeredThisTick,
    };

    this.callbacks.onTick?.(tickPayload);
  }

  private buildGroupIndices(): void {
    if (!this.groupIdArr) return;
    const counts = new Uint32Array(this.groupCount);
    for (let i = 0; i < this.neuronCount; i++) {
      counts[this.groupIdArr[i]]++;
    }

    this.groupIndices = new Array(this.groupCount);
    for (let g = 0; g < this.groupCount; g++) {
      this.groupIndices[g] = new Uint32Array(counts[g]);
      counts[g] = 0; // reset for write offset
    }

    for (let i = 0; i < this.neuronCount; i++) {
      const gid = this.groupIdArr[i];
      this.groupIndices[gid][counts[gid]++] = i;
    }
  }

  private fetchWithProgress(url: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = (e) => {
        this.callbacks.onProgress?.(e.loaded, e.total || 12600000);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject(new Error(`HTTP ${xhr.status} fetching ${url}`));
        }
      };
      xhr.onerror = () => reject(new Error(`Network error fetching ${url}`));
      xhr.send();
    });
  }
}
