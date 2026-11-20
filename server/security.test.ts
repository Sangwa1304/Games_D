import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distance3,
  isFiniteNumber,
  isValidDirection,
  isValidPlayerState,
  isVector3,
} from './security';

function validPlayerState() {
  return {
    x: 12,
    y: 5.5,
    z: -42,
    yaw: 0.2,
    pitch: -0.1,
    vx: 2,
    vz: -1,
    rankLevel: 3,
    weaponId: 'carbine',
    isCrouching: false,
    isProne: false,
    isSprinting: true,
    isTacSprinting: false,
    isSliding: false,
    isDiving: false,
  };
}

test('finite number validation rejects NaN and infinities', () => {
  assert.equal(isFiniteNumber(12), true);
  assert.equal(isFiniteNumber(Number.NaN), false);
  assert.equal(isFiniteNumber(Number.POSITIVE_INFINITY), false);
});

test('vector validation requires finite coordinates inside the world envelope', () => {
  assert.equal(isVector3({ x: 1, y: 2, z: 3 }), true);
  assert.equal(isVector3({ x: 1, y: Number.NaN, z: 3 }), false);
  assert.equal(isVector3({ x: 10001, y: 0, z: 0 }), false);
  assert.equal(isVector3(null), false);
  assert.equal(isVector3([1, 2, 3]), false);
});

test('direction validation accepts normalized vectors only', () => {
  assert.equal(isValidDirection({ x: 0, y: 0, z: 1 }), true);
  assert.equal(isValidDirection({ x: 0, y: 0, z: 0 }), false);
  assert.equal(isValidDirection({ x: 0, y: 0, z: 4 }), false);
});

test('distance helper computes 3D Euclidean distance', () => {
  assert.equal(distance3({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5);
});

test('player snapshots accept the expected typed client state', () => {
  assert.equal(isValidPlayerState(validPlayerState()), true);
});

test('player snapshots reject invalid posture types and rank values', () => {
  const invalidFlag = { ...validPlayerState(), isProne: 'false' };
  const invalidRank = { ...validPlayerState(), rankLevel: 99 };
  const fractionalRank = { ...validPlayerState(), rankLevel: 3.5 };
  assert.equal(isValidPlayerState(invalidFlag), false);
  assert.equal(isValidPlayerState(invalidRank), false);
  assert.equal(isValidPlayerState(fractionalRank), false);
});

test('player snapshots reject unknown weapon identifiers and non-finite motion', () => {
  const unknownWeapon = { ...validPlayerState(), weaponId: 'admin_gun' };
  const invalidMotion = { ...validPlayerState(), vx: Number.POSITIVE_INFINITY };
  assert.equal(isValidPlayerState(unknownWeapon), false);
  assert.equal(isValidPlayerState(invalidMotion), false);
});
