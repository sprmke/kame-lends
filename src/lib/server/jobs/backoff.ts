/** Exponential backoff for integration job retries. */
export function jobBackoffMs(attempts: number): number {
  const base = 30_000;
  const capped = Math.min(attempts, 6);
  return base * 2 ** Math.max(0, capped - 1);
}
