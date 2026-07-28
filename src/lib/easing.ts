/**
 * Samples the CSS easing forms accepted by the wheel transition API without
 * involving React state. Cubic Beziers are solved against their x-axis first,
 * matching browser timing-function semantics closely enough for Canvas frames.
 */
export function easingProgress(progress: number, easing: string): number {
  const amount = Math.min(Math.max(progress, 0), 1);
  const values = easing.match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i)?.slice(1).map(Number);
  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    if (easing === 'linear') return amount;
    if (easing === 'ease-in') return amount * amount;
    if (easing === 'ease-out') return 1 - (1 - amount) ** 2;
    return amount * amount * (3 - 2 * amount);
  }
  const [x1, y1, x2, y2] = values;
  const sample = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  let low = 0;
  let high = 1;
  let t = amount;
  for (let index = 0; index < 14; index += 1) {
    t = (low + high) / 2;
    if (sample(x1, x2, t) < amount) low = t;
    else high = t;
  }
  return sample(y1, y2, t);
}
