import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/state/SeededRNG';
import { InputRecorder } from '../src/state/InputRecorder';

describe('Replay Determinism & InputRecorder', () => {
  it('SeededRNG produces identical pseudo-random sequences for the same seed', () => {
    const rng1 = new SeededRNG(1337);
    const rng2 = new SeededRNG(1337);

    const seq1 = Array.from({ length: 50 }, () => rng1.next());
    const seq2 = Array.from({ length: 50 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('InputRecorder accurately records and linearly interpolates trajectory samples', () => {
    const recorder = new InputRecorder();
    recorder.startRecording(42, 800, 600, { x: 400, y: 300, heading: 0 });

    recorder.recordSample(0.0, 100, 200, true);
    recorder.recordSample(1.0, 200, 400, true);
    recorder.recordSample(2.0, 300, 500, false);

    const log = recorder.stopRecording();
    expect(log.samples.length).toBe(3);

    // Exact sample
    const sampleAt0 = InputRecorder.sampleAt(log.samples, 0.0);
    expect(sampleAt0?.mouseX).toBe(100);
    expect(sampleAt0?.mouseY).toBe(200);

    // Interpolated midpoint (t = 0.5)
    const mid = InputRecorder.sampleAt(log.samples, 0.5);
    expect(mid?.mouseX).toBeCloseTo(150, 2);
    expect(mid?.mouseY).toBeCloseTo(300, 2);
    expect(mid?.threatActive).toBe(true);

    // Interpolated second segment (t = 1.5)
    const mid2 = InputRecorder.sampleAt(log.samples, 1.5);
    expect(mid2?.mouseX).toBeCloseTo(250, 2);
    expect(mid2?.mouseY).toBeCloseTo(450, 2);
  });
});
