import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseWeightedSector, createSectors, interpolateSectors, pointerAngleForPosition, POINTER_ANGLE, screenAngleToWheelAngle, sectorAtAngle, targetAngle } from '../src/lib/geometry.ts';

const items = [
  { id: 'a', label: 'A', weight: 1 },
  { id: 'b', label: 'B', weight: 2 },
  { id: 'c', label: 'C', weight: 3 },
];

test('creates contiguous sectors from enabled positive weights only', () => {
  const sectors = createSectors([...items, { id: 'skip', label: 'Skip', weight: 9, disabled: true }, { id: 'zero', label: 'Zero', weight: 0 }]);

  assert.equal(sectors.length, 3);
  assert.equal(sectors[0].start, POINTER_ANGLE);
  assert.equal(sectors[0].angle, 60);
  assert.equal(sectors[1].start, -30);
  assert.equal(sectors[1].angle, 120);
  assert.equal(sectors[2].end, 270);
});

test('finds the right sector at boundaries and after full rotations', () => {
  const sectors = createSectors(items);

  assert.equal(sectorAtAngle(sectors, -90)?.item.id, 'a');
  assert.equal(sectorAtAngle(sectors, -30)?.item.id, 'b');
  assert.equal(sectorAtAngle(sectors, 90)?.item.id, 'c');
  assert.equal(sectorAtAngle(sectors, 270)?.item.id, 'a');
  assert.equal(sectorAtAngle(sectors, -90 + 360 * 1000)?.item.id, 'a');
});

test('maps a pointer position to the visually rotated sector', () => {
  const sectors = createSectors(items);

  // A 90° clockwise rotor rotation moves the first sector from the top to
  // the right. Combined idle and rotor rotation must use the same mapping.
  assert.equal(sectorAtAngle(sectors, screenAngleToWheelAngle(0, 90))?.item.id, 'a');
  assert.equal(sectorAtAngle(sectors, screenAngleToWheelAngle(-90, 90))?.item.id, 'c');
  assert.equal(sectorAtAngle(sectors, screenAngleToWheelAngle(0, 90.75))?.item.id, 'c');
});

test('lands a winner at either supported pointer edge', () => {
  const sectors = createSectors(items);
  const winner = sectors[1];
  const winnerAngle = targetAngle(winner, 'center', 0.14, 0);

  for (const position of ['top', 'right'] as const) {
    const pointerAngle = pointerAngleForPosition(position);
    const rotation = pointerAngle - winnerAngle;
    assert.equal(sectorAtAngle(sectors, pointerAngle - rotation)?.item.id, winner.item.id);
  }
});

test('uses normalized weighted selection at deterministic extremes', () => {
  const sectors = createSectors(items);

  assert.equal(chooseWeightedSector(sectors, 0).item.id, 'a');
  assert.equal(chooseWeightedSector(sectors, 1 / 6).item.id, 'b');
  assert.equal(chooseWeightedSector(sectors, 0.99999999).item.id, 'c');
  assert.equal(chooseWeightedSector(sectors, 9).item.id, 'c');
});

test('keeps random landing points inside the requested safe band', () => {
  const sector = createSectors(items)[1];
  const nearStart = targetAngle(sector, 'random', 0.2, 0);
  const nearEnd = targetAngle(sector, 'random', 0.2, 1);

  assert.equal(targetAngle(sector, 'center', 0.2, 0.1), 30);
  assert.equal(nearStart, -6);
  assert.equal(nearEnd, 66);
});

test('rejects invalid ids and weights before drawing', () => {
  assert.throws(() => createSectors([{ id: '', label: 'Empty', weight: 1 }]), /non-empty and unique/);
  assert.throws(() => createSectors([{ id: 'a', label: 'A', weight: -1 }]), /finite non-negative/);
  assert.throws(() => createSectors([{ id: 'a', label: 'A', weight: 1 }, { id: 'a', label: 'Again', weight: 1 }]), /non-empty and unique/);
});

test('joins neighbouring sector edges while a sector is removed', () => {
  const from = createSectors([
    { id: 'a', label: 'A', weight: 1 },
    { id: 'b', label: 'B', weight: 1 },
    { id: 'c', label: 'C', weight: 1 },
  ]);
  const to = createSectors([
    { id: 'a', label: 'A', weight: 1 },
    { id: 'c', label: 'C', weight: 1 },
  ]);
  const sectors = interpolateSectors(from, to, 0.5);
  const a = sectors.find((sector) => sector.item.id === 'a')!;
  const b = sectors.find((sector) => sector.item.id === 'b')!;
  const c = sectors.find((sector) => sector.item.id === 'c')!;

  assert.equal(a.end, b.start);
  assert.equal(b.end, c.start);
  assert.equal(b.angle, 60);
});

test('opens a new sector from its neighbours without a gap', () => {
  const from = createSectors([
    { id: 'a', label: 'A', weight: 1 },
    { id: 'c', label: 'C', weight: 1 },
  ]);
  const to = createSectors([
    { id: 'a', label: 'A', weight: 1 },
    { id: 'b', label: 'B', weight: 1 },
    { id: 'c', label: 'C', weight: 1 },
  ]);
  const sectors = interpolateSectors(from, to, 0.5);
  const a = sectors.find((sector) => sector.item.id === 'a')!;
  const b = sectors.find((sector) => sector.item.id === 'b')!;
  const c = sectors.find((sector) => sector.item.id === 'c')!;

  assert.equal(a.end, b.start);
  assert.equal(b.end, c.start);
  assert.equal(b.angle, 60);
});
