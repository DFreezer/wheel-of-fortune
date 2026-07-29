/**
 * Formats a normalized chance for a sector label without adding distracting
 * trailing zeroes. The value is clamped so invalid display data stays safe.
 */
export function formatProbability(probability: number): string {
  const normalized = Number.isFinite(probability) ? Math.min(Math.max(probability, 0), 1) : 0;
  const percentage = normalized * 100;
  const fractionDigits = percentage >= 1 ? 1 : 2;
  return `${Number(percentage.toFixed(fractionDigits))}%`;
}
