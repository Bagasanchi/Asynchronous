/**
 * Seeded Random Number Generator for deterministic gameplay
 * Uses a Linear Congruential Generator (LCG) for fast, reproducible randomness
 */

export class SeededRandom {
  private seed: number;
  private state: number;

  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;
    this.state = this.seed;
  }

  /**
   * Create a new SeededRandom from a seed string
   */
  static fromSeed(seed: string): SeededRandom {
    return new SeededRandom(seed);
  }

  /**
   * Create a new SeededRandom with a random seed
   */
  static random(): SeededRandom {
    return new SeededRandom(Date.now() + Math.random() * 1000000);
  }

  /**
   * Hash a string to a number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) || 1;
  }

  /**
   * Get the next random number (0 to 1)
   */
  next(): number {
    // LCG parameters (from Numerical Recipes)
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  /**
   * Get next integer in range [min, max]
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Get next boolean with probability p
   */
  nextBoolean(p: number = 0.5): boolean {
    return this.next() < p;
  }

  /**
   * Get next item from array
   */
  nextChoice<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot choose from empty array');
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle array in place
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Sample n items without replacement
   */
  sample<T>(array: T[], n: number): T[] {
    const shuffled = [...array];
    this.shuffle(shuffled);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  /**
   * Weighted random selection
   */
  weightedChoice<T>(items: Array<{ item: T; weight: number }>): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = this.next() * totalWeight;

    for (const { item, weight } of items) {
      random -= weight;
      if (random <= 0) return item;
    }

    return items[items.length - 1].item;
  }

  /**
   * Get next float in range [min, max]
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Get next Gaussian/normal distribution (Box-Muller transform)
   */
  nextGaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Get current state for serialization
   */
  getState(): string {
    return this.state.toString(36);
  }

  /**
   * Set state from serialized string
   */
  setState(state: string): void {
    this.state = parseInt(state, 36);
  }

  /**
   * Reset to initial seed
   */
  reset(): void {
    this.state = this.seed;
  }

  /**
   * Clone the RNG with same state
   */
  clone(): SeededRandom {
    const cloned = new SeededRandom(0);
    cloned.seed = this.seed;
    cloned.state = this.state;
    return cloned;
  }

  /**
   * Create a child RNG (for branching randomness)
   */
  fork(): SeededRandom {
    return new SeededRandom(this.nextInt(0, 0x7fffffff));
  }
}

/**
 * Global RNG instance for non-deterministic operations
 */
export const globalRNG = SeededRandom.random();

/**
 * Deterministic shuffle using a seed
 */
export function seededShuffle<T>(array: T[], seed: string | number): T[] {
  const rng = new SeededRandom(seed);
  return rng.shuffle([...array]);
}

/**
 * Deterministic sample using a seed
 */
export function seededSample<T>(array: T[], n: number, seed: string | number): T[] {
  const rng = new SeededRandom(seed);
  return rng.sample(array, n);
}

/**
 * Deterministic choice using a seed
 */
export function seededChoice<T>(array: T[], seed: string | number): T {
  const rng = new SeededRandom(seed);
  return rng.nextChoice(array);
}

/**
 * Generate a deterministic ID from a seed and counter
 */
export function generateDeterministicId(seed: string, counter: number): string {
  const rng = new SeededRandom(seed + ':' + counter);
  return rng.nextInt(10000000, 99999999).toString(36);
}