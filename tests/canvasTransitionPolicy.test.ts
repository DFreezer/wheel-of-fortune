import assert from 'node:assert/strict';
import test from 'node:test';
import { FULL_COLLAPSE_MAX_SECTORS, resolveCanvasCollapsePolicy, SIMPLIFIED_COLLAPSE_MAX_SECTORS } from '../src/lib/canvasTransitionPolicy.ts';

test('uses full Canvas collapse through the small-wheel threshold', () => {
  assert.equal(resolveCanvasCollapsePolicy(1, FULL_COLLAPSE_MAX_SECTORS), 'full');
  assert.equal(resolveCanvasCollapsePolicy(FULL_COLLAPSE_MAX_SECTORS, 1), 'full');
});

test('uses simplified Canvas collapse through the medium-wheel threshold', () => {
  assert.equal(resolveCanvasCollapsePolicy(FULL_COLLAPSE_MAX_SECTORS + 1, SIMPLIFIED_COLLAPSE_MAX_SECTORS), 'simplified');
  assert.equal(resolveCanvasCollapsePolicy(SIMPLIFIED_COLLAPSE_MAX_SECTORS, FULL_COLLAPSE_MAX_SECTORS + 1), 'simplified');
});

test('uses bitmap crossfade above the dense threshold', () => {
  assert.equal(resolveCanvasCollapsePolicy(SIMPLIFIED_COLLAPSE_MAX_SECTORS + 1, 1), 'crossfade');
  assert.equal(resolveCanvasCollapsePolicy(1, SIMPLIFIED_COLLAPSE_MAX_SECTORS + 1), 'crossfade');
});
