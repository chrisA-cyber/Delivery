const UINT32_MAX_PLUS_ONE = 4_294_967_296;

/** Small deterministic hash suitable for content selection (not security). */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG with enough quality for non-cryptographic content rotation. */
export function createSeededRandom(seed: string | number): () => number {
  let state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  };
}

export function pickDeterministic<T>(
  values: readonly T[],
  seed: string | number,
): T | undefined {
  if (values.length === 0) return undefined;
  const random = createSeededRandom(seed);
  return values[Math.floor(random() * values.length)];
}

export function shuffleDeterministic<T>(
  values: readonly T[],
  seed: string | number,
): T[] {
  const result = [...values];
  const random = createSeededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index]!;
    result[index] = result[swapIndex]!;
    result[swapIndex] = current;
  }
  return result;
}

export function toUtcDateKey(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date supplied to content rotation");
  }
  return date.toISOString().slice(0, 10);
}
