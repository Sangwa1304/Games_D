import assert from 'node:assert/strict';
import test from 'node:test';
import { getNearMissSuppression, getPlayerSuppressionIntensity } from './suppression';

test('near misses produce a defensive reaction window', () => {
  assert.ok(getNearMissSuppression(0) > 4.9);
  assert.ok(getNearMissSuppression(2) > 3.9);
});

test('suppression falls to zero outside the near-miss radius', () => {
  assert.equal(getNearMissSuppression(4.5), 0);
  assert.equal(getNearMissSuppression(8), 0);
});

test('invalid distances and radii never create suppression', () => {
  assert.equal(getNearMissSuppression(Number.NaN), 0);
  assert.equal(getNearMissSuppression(-1), 0);
  assert.equal(getNearMissSuppression(1, 0), 0);
});


test('player near-miss feedback scales with proximity without affecting damage', () => {
  assert.equal(getPlayerSuppressionIntensity(0), 1);
  assert.ok(getPlayerSuppressionIntensity(2.25) > 0.49);
  assert.equal(getPlayerSuppressionIntensity(4.5), 0);
});

test('player suppression rejects invalid distances and radii', () => {
  assert.equal(getPlayerSuppressionIntensity(Number.NaN), 0);
  assert.equal(getPlayerSuppressionIntensity(-0.1), 0);
  assert.equal(getPlayerSuppressionIntensity(1, 0), 0);
});
