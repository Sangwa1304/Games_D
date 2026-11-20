import test from 'node:test';
import assert from 'node:assert/strict';
import { getClassWeapon, getSoldierClass, SOLDIER_CLASSES } from './soldierClasses';

test('soldier classes cover all five specializations deterministically', () => {
  const ids = Array.from({ length: 5 }, (_, id) => getSoldierClass(id).id);
  assert.equal(new Set(ids).size, 5);
  assert.deepEqual(ids, ['assault', 'support', 'marksman', 'antiArmor', 'medic']);
});

test('class weapons always belong to the selected faction pool', () => {
  for (let id = 0; id < 30; id++) {
    const spec = getSoldierClass(id);
    assert.ok(spec.weaponPool.army.includes(getClassWeapon(id, 'army')));
    assert.ok(spec.weaponPool.rebels.includes(getClassWeapon(id, 'rebels')));
  }
});

test('class combat stats stay within sensible bounds', () => {
  for (const spec of Object.values(SOLDIER_CLASSES)) {
    assert.ok(spec.maxHp >= 80 && spec.maxHp <= 130);
    assert.ok(spec.movementMultiplier >= 0.8 && spec.movementMultiplier <= 1.2);
    assert.ok(spec.description.length > 20);
  }
});

test('invalid class indexes resolve safely to a known class', () => {
  assert.equal(getSoldierClass(Number.NaN).id, 'assault');
  assert.equal(getSoldierClass(-1).id, 'medic');
});
