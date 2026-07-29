import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapCanvasText, wrapCanvasTextWithEllipsis } from '../src/lib/textLayout.ts';

const measure = (value: string) => Array.from(value).length;

test('wrapCanvasText preserves words when they fit', () => {
  assert.deepEqual(wrapCanvasText('Free shipping today', 13, 2, measure), ['Free shipping', 'today']);
});

test('wrapCanvasText splits an unbroken label instead of letting it overflow', () => {
  assert.deepEqual(wrapCanvasText('JACKPOT', 3, 3, measure), ['JAC', 'KPO', 'T']);
});

test('wrapCanvasText rejects labels that need more lines than allowed', () => {
  assert.equal(wrapCanvasText('Free shipping today', 5, 2, measure), null);
});

test('wrapCanvasTextWithEllipsis truncates an unbroken word instead of shrinking it', () => {
  assert.deepEqual(wrapCanvasTextWithEllipsis('JACKPOT', 3, 3, measure), ['JA…']);
});

test('wrapCanvasTextWithEllipsis marks the final visible line when the line limit is reached', () => {
  assert.deepEqual(wrapCanvasTextWithEllipsis('Free shipping today', 8, 2, measure), ['Free', 'shippin…']);
});
