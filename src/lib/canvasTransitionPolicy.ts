export const FULL_COLLAPSE_MAX_SECTORS = 50;
export const SIMPLIFIED_COLLAPSE_MAX_SECTORS = 150;

export type CanvasCollapsePolicy = 'full' | 'simplified' | 'crossfade';

/**
 * Chooses a visual level of detail without changing item weights, geometry, or
 * winner selection. The limits intentionally refer to the larger endpoint.
 */
export function resolveCanvasCollapsePolicy(fromCount: number, toCount: number): CanvasCollapsePolicy {
  const count = Math.max(0, fromCount, toCount);
  if (count <= FULL_COLLAPSE_MAX_SECTORS) return 'full';
  if (count <= SIMPLIFIED_COLLAPSE_MAX_SECTORS) return 'simplified';
  return 'crossfade';
}
