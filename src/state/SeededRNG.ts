/**
 * SeededRNG.ts
 *
 * Deterministic Mulberry32 pseudorandom number generator.
 * Guarantees identical sequence of random numbers across different platforms and runs.
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public getSeed(): number {
    return this.state;
  }

  /**
   * Generates a float in [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a float in [min, max)
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generates an integer in [min, max]
   */
  public integer(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}
