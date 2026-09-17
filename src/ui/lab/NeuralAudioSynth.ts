/**
 * NeuralAudioSynth.ts
 *
 * Web Audio Polyphonic Neural Synthesizer:
 * Generates real-time ambient sonic textures and musical harmonies from neural action potentials.
 * - Sensory/Optic: Ethereal high harmonic tones (700 - 1100 Hz)
 * - Central Complex: Warm melodic chords (350 - 550 Hz)
 * - Drives/Kenyon Cells: Resonant filter sweeps (180 - 280 Hz)
 * - Giant Fiber Escape: Deep sub-bass impact (60 - 90 Hz)
 *
 * 100% native Web Audio API. Zero external dependencies. Zero CPU overhead.
 */

export class NeuralAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled: boolean = false;
  private volume: number = 0.4;
  private lastSpikeTime: Record<string, number> = {};

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (err) {
      console.warn('Web Audio API not supported:', err);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled && !this.ctx) {
      this.initContext();
    }
    if (this.ctx && this.ctx.state === 'suspended' && enabled) {
      this.ctx.resume();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Triggers a musical neural event mapped to circuit activity
   */
  public triggerNeuralVoice(
    region: 'sensory' | 'central' | 'drives' | 'motor',
    intensity: number = 0.5,
    customFreq?: number
  ): void {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    // Throttle per region to avoid acoustic clutter (min 30ms between triggers)
    if (this.lastSpikeTime[region] && now - this.lastSpikeTime[region] < 0.035) {
      return;
    }
    this.lastSpikeTime[region] = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    let freq = customFreq || 440;
    let type: OscillatorType = 'sine';
    let duration = 0.12;

    switch (region) {
      case 'sensory':
        // High crystalline harmonic
        freq = customFreq || 660 + Math.random() * 330;
        type = 'sine';
        duration = 0.08;
        break;
      case 'central':
        // Melodic mid tone (Pentatonic C minor scale note)
        const scale = [261.63, 293.66, 311.13, 392.0, 466.16, 523.25];
        freq = customFreq || scale[Math.floor(Math.random() * scale.length)];
        type = 'triangle';
        duration = 0.15;
        break;
      case 'drives':
        // Warm resonant tone
        freq = customFreq || 220 + Math.random() * 60;
        type = 'sawtooth';
        duration = 0.18;
        break;
      case 'motor':
        // Deep sub-bass Giant Fiber strike
        freq = customFreq || 65.4; // C2
        type = 'sine';
        duration = 0.35;
        // Pitch envelope drop
        osc.frequency.setValueAtTime(freq * 1.8, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + duration);
        break;
    }

    if (region !== 'motor') {
      osc.frequency.setValueAtTime(freq, now);
    }
    osc.type = type;

    // Amplitude envelope
    const peakGain = Math.min(0.35, intensity * 0.4);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
