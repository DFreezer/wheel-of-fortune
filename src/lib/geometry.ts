import type { WheelItem, WheelPointerPosition } from './types';

export interface Sector<T = unknown> {
  item: WheelItem<T>;
  index: number;
  start: number;
  end: number;
  angle: number;
}

export const POINTER_ANGLE = -90;

/** Screen angle at which the pointer touches the wheel. */
export function pointerAngleForPosition(position: WheelPointerPosition = 'top'): number {
  return position === 'right' ? 0 : POINTER_ANGLE;
}

export function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

/**
 * Converts an angle measured from the viewport centre to the wheel's static
 * coordinate system. `visualRotation` is the combined rotor and idle
 * rotation currently visible on screen.
 *
 * The returned value is intentionally normalized to the same -90..270 range
 * used by sectors, which avoids an edge mismatch around the top pointer.
 */
export function screenAngleToWheelAngle(screenAngle: number, visualRotation = 0): number {
  return positiveModulo(screenAngle - visualRotation - POINTER_ANGLE, 360) + POINTER_ANGLE;
}

export function createSectors<T>(items: readonly WheelItem<T>[]): Sector<T>[] {
  const ids = new Set<string>();
  let totalWeight = 0;

  for (const item of items) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(`Wheel item ids must be non-empty and unique (received "${item.id}").`);
    }
    ids.add(item.id);
    if (!Number.isFinite(item.weight) || item.weight < 0) {
      throw new Error(`Weight of "${item.id}" must be a finite non-negative number.`);
    }
    if (!item.disabled) totalWeight += item.weight;
  }

  if (totalWeight <= 0) return [];

  let start = POINTER_ANGLE;
  return items
    .filter((item) => !item.disabled && item.weight > 0)
    .map((item, index) => {
      const angle = (item.weight / totalWeight) * 360;
      const sector = { item, index, start, end: start + angle, angle };
      start += angle;
      return sector;
    });
}

function between(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/**
 * Interpolates sector boundaries for an add/remove transition. Existing
 * sectors animate to their next angles; added sectors begin as a zero-width
 * wedge at their nearest old neighbour, and removed sectors end at their
 * nearest next neighbour. This keeps the wheel contiguous throughout the
 * transition instead of shrinking wedges into its centre.
 */
export function interpolateSectors<T>(
  from: readonly Sector<T>[],
  to: readonly Sector<T>[],
  progress: number,
): Sector<T>[] {
  const amount = Math.min(Math.max(progress, 0), 1);
  const fromById = new Map(from.map((sector) => [sector.item.id, sector]));
  const toById = new Map(to.map((sector) => [sector.item.id, sector]));

  const addedStart = (index: number): number => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const previous = fromById.get(to[cursor].item.id);
      if (previous) return previous.end;
    }
    for (let cursor = index + 1; cursor < to.length; cursor += 1) {
      const next = fromById.get(to[cursor].item.id);
      if (next) return next.start;
    }
    return POINTER_ANGLE;
  };

  const removedEnd = (index: number): number => {
    for (let cursor = index + 1; cursor < from.length; cursor += 1) {
      const next = toById.get(from[cursor].item.id);
      if (next) return next.start;
    }
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const previous = toById.get(from[cursor].item.id);
      if (previous) return previous.end;
    }
    return POINTER_ANGLE + 360;
  };

  const nextSectors = to.map((target, index) => {
    const source = fromById.get(target.item.id);
    if (source) {
      const start = between(source.start, target.start, amount);
      const end = between(source.end, target.end, amount);
      return { ...target, start, end, angle: Math.max(0, end - start) };
    }
    const collapsed = addedStart(index);
    const start = between(collapsed, target.start, amount);
    const end = between(collapsed, target.end, amount);
    return { ...target, start, end, angle: Math.max(0, end - start) };
  });

  const leavingSectors = from.flatMap((source, index) => {
    if (toById.has(source.item.id)) return [];
    const collapsed = removedEnd(index);
    const start = between(source.start, collapsed, amount);
    const end = between(source.end, collapsed, amount);
    return [{ ...source, start, end, angle: Math.max(0, end - start) }];
  });

  return [...nextSectors, ...leavingSectors];
}

export function sectorAtAngle<T>(sectors: readonly Sector<T>[], angle: number): Sector<T> | undefined {
  const local = positiveModulo(angle - POINTER_ANGLE, 360) + POINTER_ANGLE;
  let low = 0;
  let high = sectors.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const sector = sectors[middle];
    if (local < sector.start) high = middle - 1;
    else if (local >= sector.end) low = middle + 1;
    else return sector;
  }
  // Floating point accumulation can place an exact final angle just beyond a
  // calculated end. The final sector remains the correct visually contiguous fallback.
  return sectors.at(-1);
}

export function chooseWeightedSector<T>(sectors: readonly Sector<T>[], random: number): Sector<T> {
  if (!sectors.length) throw new Error('Cannot choose a winner for an empty wheel.');
  const target = Math.min(Math.max(random, 0), 0.999999999999) * 360;
  let cursor = 0;
  for (const sector of sectors) {
    cursor += sector.angle;
    if (target < cursor) return sector;
  }
  return sectors[sectors.length - 1];
}

export function targetAngle<T>(sector: Sector<T>, landing: 'center' | 'random', edgePadding: number, random: number): number {
  if (landing === 'center') return sector.start + sector.angle / 2;
  const padding = Math.min(Math.max(edgePadding, 0), 0.49);
  const offset = padding + (1 - padding * 2) * random;
  return sector.start + sector.angle * offset;
}

export function polar(radius: number, angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(radians), y: 50 + radius * Math.sin(radians) };
}

export function wedgePath(start: number, end: number): string {
  if (end - start >= 359.999) {
    return 'M 50 50 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0';
  }
  const from = polar(50, start);
  const to = polar(50, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M 50 50 L ${from.x} ${from.y} A 50 50 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}
