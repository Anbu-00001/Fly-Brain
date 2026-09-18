/**
 * LiveEngineAdapter.ts
 *
 * Wraps ENGINE-LIVE's Web Worker (sim-worker.js): a leaky integrate-and-fire
 * simulation over FlyWire FAFB v783, 139,255 neurons / 2,698,236 edges, rolled
 * into 63 neuropil groups.
 *
 * This adapter adds the looming-predator stimulus channel, which the upstream
 * engine does not have, and reads activity back out. It does not modify the
 * engine's neuroscience.
 *
 * THREE CORRECTIONS FROM THE PREVIOUS BUILD — each was a real defect:
 *
 * 1. REGIONS WERE GUESSED FROM NAME PREFIXES, AND THE GUESS WAS WRONG.
 *    The old classifier tested `name.startsWith('VIS_')` and friends, with a
 *    catch-all `else -> motor`. GENERIC_CENTRAL (21,955 neurons) has no matching
 *    prefix, so it fell into motor, and the interface reported ~22,031 "motor"
 *    neurons. neuron_meta.json states GENERIC_CENTRAL's region is `central`.
 *    The true motor population in this dataset is 76 neurons. We now read the
 *    `region` field the metadata already provides, so the number is measured
 *    rather than inferred.
 *
 * 2. LEFT AND RIGHT MOTOR DRIVE WERE COMPUTED WITH IDENTICAL FORMULAS.
 *        accumWalkLeft  += descSpikes * 0.05 + opticFlowSpikes * 0.04;
 *        accumWalkRight += descSpikes * 0.05 + opticFlowSpikes * 0.04;
 *    They could never differ, so the connectome contributed exactly zero
 *    directional information while the interface implied the brain steered the
 *    fly. This dataset's groups are not lateralised and cannot supply a turn
 *    signal. We no longer pretend otherwise — see EscapeModel.ts.
 *
 * 3. TICKS WERE REPORTED AS MILLISECONDS.
 *        result[k] = v * 100; // 100ms per tick
 *    The 100 comes from TARGET_TICK_RATE = 10, which is the worker's wall-clock
 *    render cadence. The LIF model here is dimensionless — threshold 1.0, no dt,
 *    no membrane time constant, no conduction delays — so it has no biological
 *    time to convert. We report ticks as ticks.
 */

import { ReceptiveFieldGradient, SimulationTickData, LIVE_ENGINE_METADATA } from '../shared/ConnectomeTypes';
import { computeEscapeDecision, EscapeDecision } from '../shared/EscapeModel';

export type BrainRegion = 'sensory' | 'central' | 'drives' | 'motor';

export interface LiveEngineCallbacks {
  onReady?: (neuronCount: number, edgeCount: number) => void;
  onTick?: (data: SimulationTickData) => void;
  onStats?: (stats: { avgTickMs: number; firedPct: number; activePct: number }) => void;
  onError?: (err: string) => void;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
}

/** Visual groups that ENGINE-LIVE genuinely resolves, used to gate the escape model. */
const LOBULA_GROUPS = ['VIS_LO', 'VIS_LPTC'] as const;

export class LiveEngineAdapter {
  private worker: Worker | null = null;
  private isReady = false;
  private isRunning = false;

  private neuronCount = 0;
  private edgeCount = 0;
  private groupCount = 0;
  private groupNameToId: Record<string, number> = {};
  private groupIdToName: string[] = [];
  private groupIndices: Uint32Array[] = [];
  private regionTypeArr: Uint8Array | null = null;
  private groupIdArr: Uint16Array | null = null;

  /** Authoritative per-group region and size, straight from neuron_meta.json. */
  private groupRegion: BrainRegion[] = [];
  private groupSize: number[] = [];
  private regionTotals: Record<BrainRegion, number> = { sensory: 0, central: 0, drives: 0, motor: 0 };

  /** Latest escape decision, and the tick it first triggered on (ticks, not ms). */
  private lastDecision: EscapeDecision | null = null;
  private escapeTriggerTick: number | null = null;
  private lastLobulaActivity = 0;
  private lastDescendingActivity = 0;
  private currentTick = 0;

  /** First tick each group fired, in ticks. Deliberately never converted to ms. */
  private firstSpikeTick: Record<string, number> = {};

  private callbacks: LiveEngineCallbacks = {};

  constructor(callbacks: LiveEngineCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /* ---------- introspection ---------- */

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

  public getGroupIdForName(name: string): number | undefined {
    return this.groupNameToId[name];
  }

  /** Neuron count per region, measured from metadata — not prefix-guessed. */
  public getRegionTotals(): Readonly<Record<BrainRegion, number>> {
    return this.regionTotals;
  }

  public getGroupSize(name: string): number {
    const id = this.groupNameToId[name];
    return id === undefined ? 0 : this.groupSize[id] || 0;
  }

  /**
   * Current escape state. Replaces the old getAccumulators(), which exposed a
   * left/right split that did not exist. `direction` is absent on purpose:
   * this engine cannot supply one.
   */
  public getEscapeState(): {
    decision: EscapeDecision | null;
    lobulaActivity: number;
    triggered: boolean;
    triggerTick: number | null;
    ticksSinceTrigger: number | null;
  } {
    return {
      decision: this.lastDecision,
      lobulaActivity: this.lastLobulaActivity,
      triggered: this.lastDecision?.triggered ?? false,
      triggerTick: this.escapeTriggerTick,
      ticksSinceTrigger:
        this.escapeTriggerTick === null ? null : this.currentTick - this.escapeTriggerTick,
    };
  }

  /**
   * Normalised GNG_DESC activity (spikes / group size) this tick. This IS a real
   * measured signal — descending-trunk output is genuinely what modulates the
   * fly's locomotor speed on screen. It carries no left/right component, because
   * the dataset has none to give.
   */
  public getDescendingActivity(): number {
    return this.lastDescendingActivity;
  }

  /** First tick each group fired. Units are TICKS. There is no ms conversion. */
  public getFirstSpikeTicks(): Readonly<Record<string, number>> {
    return this.firstSpikeTick;
  }

  /* ---------- lifecycle ---------- */

  public async init(): Promise<void> {
    try {
      const metaRes = await fetch('data/neuron_meta.json');
      if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} fetching neuron_meta.json`);
      const meta = await metaRes.json();

      this.groupCount = meta.group_count;
      this.regionTotals = { sensory: 0, central: 0, drives: 0, motor: 0 };

      for (const g of meta.groups) {
        this.groupNameToId[g.name] = g.id;
        this.groupIdToName[g.id] = g.name;
        this.groupRegion[g.id] = g.region as BrainRegion;
        this.groupSize[g.id] = g.neuron_count;
        this.regionTotals[g.region as BrainRegion] += g.neuron_count;
      }

      const buffer = await this.fetchWithProgress('data/connectome.bin.gz');

      this.worker = new Worker('sim-worker.js');
      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.onerror = (err) => {
        const msg = err.message || 'Worker error';
        console.error('sim-worker error:', err);
        this.callbacks.onError?.(msg);
      };

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
    this.lastDecision = null;
    this.escapeTriggerTick = null;
    this.lastLobulaActivity = 0;
    this.lastDescendingActivity = 0;
    this.currentTick = 0;
    this.firstSpikeTick = {};
    this.worker.postMessage({ type: 'reset' });
  }

  /** Releases the worker. Must be called on teardown or the thread leaks. */
  public dispose(): void {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
  }

  /* ---------- stimulus ---------- */

  /**
   * Injects the looming stimulus into the visual groups ENGINE-LIVE actually has.
   *
   * Note the honest limitation: we drive VIS_ME / VIS_LO / VIS_LPTC / VIS_R1R6,
   * which are real groups in this dataset. We do NOT drive LC4 or LPLC2, because
   * FlyWire FAFB v783 as packaged here does not resolve them. The UI must not
   * claim otherwise.
   */
  public injectLoomingStimulus(gradient: ReceptiveFieldGradient): void {
    if (!this.worker || !this.isReady) return;

    const baseIntensity = 0.22;
    const segments: Array<{ name: string; intensity: number }> = [];

    if (gradient.angularLoomRad > 0.05 || gradient.expansionRate > 0.05) {
      const loomPower = gradient.angularLoomRad * 0.4 + gradient.expansionRate * 1.5;
      segments.push({
        name: 'VIS_ME',
        intensity: baseIntensity * (gradient.leftEyeIntensity + gradient.rightEyeIntensity) * 0.6,
      });
      segments.push({ name: 'VIS_LO', intensity: baseIntensity * loomPower * 1.4 });
      segments.push({ name: 'VIS_LPTC', intensity: baseIntensity * gradient.expansionRate * 0.8 });
    }

    const avgVisual = (gradient.leftEyeIntensity + gradient.rightEyeIntensity) * 0.5;
    if (avgVisual > 0.02) {
      segments.push({ name: 'VIS_R1R6', intensity: baseIntensity * avgVisual * 0.5 });
    }

    // Low tonic drive to the central complex keeps the network out of silence.
    segments.push({ name: 'CX_FC', intensity: 0.04 });
    segments.push({ name: 'CX_EPG', intensity: 0.04 });
    segments.push({ name: 'CX_PFN', intensity: 0.04 });

    let totalIndices = 0;
    const prepared: Array<{ idxs: Uint32Array; intensity: number }> = [];
    for (const seg of segments) {
      const gid = this.groupNameToId[seg.name];
      if (gid === undefined) continue;
      const idxs = this.groupIndices[gid];
      if (!idxs || idxs.length === 0) continue;
      prepared.push({ idxs, intensity: seg.intensity });
      totalIndices += idxs.length;
    }
    if (totalIndices === 0) return;

    const allIndices = new Uint32Array(totalIndices);
    const allIntensities = new Float32Array(totalIndices);
    let offset = 0;
    for (const p of prepared) {
      allIndices.set(p.idxs, offset);
      allIntensities.fill(p.intensity, offset, offset + p.idxs.length);
      offset += p.idxs.length;
    }

    this.worker.postMessage({
      type: 'setStimulusState',
      indices: allIndices,
      intensities: allIntensities,
    });
  }

  /** One-shot excitation of a named group, for the interactive inspector. */
  public flashBrainRegion(regionGroupName: string, intensity = 0.8): void {
    if (!this.worker || !this.isReady) return;
    const gid = this.groupNameToId[regionGroupName];
    if (gid === undefined) return;
    const idxs = this.groupIndices[gid];
    if (!idxs || idxs.length === 0) return;

    const intensities = new Float32Array(idxs.length);
    intensities.fill(intensity);
    this.worker.postMessage({ type: 'stimulate', indices: idxs, intensities });
  }

  /**
   * Live lesioning: clamps a group hyperpolarised so it cannot spike. This is the
   * one genuinely valuable capability the removed "God Mode" surface had, and it
   * maps directly onto Brain Surgery's recorded lesions.
   */
  public applyInterventions(
    interventions: Array<{ type: 'silence' | 'restore'; groupName: string }>
  ): void {
    if (!this.worker || !this.isReady) return;
    const mapped = interventions
      .map((inv) => ({ type: inv.type, groupId: this.groupNameToId[inv.groupName] }))
      .filter((inv) => inv.groupId !== undefined);
    this.worker.postMessage({ type: 'setInterventions', interventions: mapped });
  }

  /* ---------- readback ---------- */

  private handleMessage(e: MessageEvent): void {
    const data = e.data;
    switch (data.type) {
      case 'ready':
        this.neuronCount = data.neuronCount;
        this.edgeCount = data.edgeCount;
        this.groupIdArr = new Uint16Array(data.groupId.buffer ? data.groupId.buffer : data.groupId);
        this.regionTypeArr = new Uint8Array(
          data.regionType.buffer ? data.regionType.buffer : data.regionType
        );
        this.buildGroupIndices();
        this.isReady = true;
        this.callbacks.onReady?.(this.neuronCount, this.edgeCount);
        break;

      case 'tick':
        this.processWorkerTick(data);
        break;

      case 'stats':
        if (this.callbacks.onStats) {
          this.callbacks.onStats({
            avgTickMs: data.avgTickMs,
            firedPct: Math.round(((data.firedNeurons || 0) / (data.totalNeurons || 1)) * 100),
            activePct: Math.round(((data.activeNeurons || 0) / (data.totalNeurons || 1)) * 100),
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
    this.currentTick = tickCount;

    const groupSpikes: Record<string, number> = {};
    const regionalFired: Record<BrainRegion, number> = {
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

        // Authoritative region from metadata. No prefix guessing, no catch-all.
        const region = this.groupRegion[g];
        if (region) regionalFired[region] += count;

        if (count > 0 && this.firstSpikeTick[name] === undefined) {
          this.firstSpikeTick[name] = tickCount;
        }
      }
    }

    // Lobula activity as a spike fraction of the groups' own size, so it is a
    // genuine normalised rate rather than a raw count scaled by a magic gain.
    let lobulaSpikes = 0;
    let lobulaNeurons = 0;
    for (const name of LOBULA_GROUPS) {
      lobulaSpikes += groupSpikes[name] || 0;
      lobulaNeurons += this.getGroupSize(name);
    }
    this.lastLobulaActivity = lobulaNeurons > 0 ? lobulaSpikes / lobulaNeurons : 0;

    const descSize = this.getGroupSize('GNG_DESC');
    this.lastDescendingActivity = descSize > 0 ? (groupSpikes['GNG_DESC'] || 0) / descSize : 0;

    const tickPayload: SimulationTickData = {
      tickCount,
      firedCount,
      activeNeurons: firedCount,
      regionalFired,
      groupSpikes,
      escapeCommandFired: this.lastDecision?.triggered ?? false,
    };

    this.callbacks.onTick?.(tickPayload);
  }

  /**
   * Evaluates the escape model against the current stimulus geometry and the
   * measured lobula activity. Called by the arena, which owns the geometry.
   */
  public evaluateEscape(thetaRad: number, expansionRateRadPerS: number): EscapeDecision {
    const decision = computeEscapeDecision({
      thetaRad,
      expansionRateRadPerS,
      lobulaActivity: this.lastLobulaActivity,
    });
    this.lastDecision = decision;
    if (decision.triggered && this.escapeTriggerTick === null) {
      this.escapeTriggerTick = this.currentTick;
    }
    return decision;
  }

  private buildGroupIndices(): void {
    if (!this.groupIdArr) return;
    const counts = new Uint32Array(this.groupCount);
    for (let i = 0; i < this.neuronCount; i++) counts[this.groupIdArr[i]]++;

    this.groupIndices = new Array(this.groupCount);
    for (let g = 0; g < this.groupCount; g++) {
      this.groupIndices[g] = new Uint32Array(counts[g]);
      counts[g] = 0;
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
      xhr.onprogress = (e) => this.callbacks.onProgress?.(e.loaded, e.total || 12600000);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error(`HTTP ${xhr.status} fetching ${url}`));
      };
      xhr.onerror = () => reject(new Error(`Network error fetching ${url}`));
      xhr.send();
    });
  }
}
