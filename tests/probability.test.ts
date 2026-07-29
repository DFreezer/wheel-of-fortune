import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProbability } from '../src/lib/probability.ts';

test('formats normalized sector chances without trailing zeroes', () => {
  assert.equal(formatProbability(0.18), '18%');
  assert.equal(formatProbability(1 / 3), '33.3%');
  assert.equal(formatProbability(0.00125), '0.13%');
});

test('keeps chance labels safe when a value is outside the normalized range', () => {
  assert.equal(formatProbability(-1), '0%');
  assert.equal(formatProbability(2), '100%');
  assert.equal(formatProbability(Number.NaN), '0%');
});
