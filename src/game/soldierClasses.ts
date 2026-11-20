import type { Faction, WeaponId } from './types';

export type SoldierClassId = 'assault' | 'support' | 'marksman' | 'antiArmor' | 'medic';

export interface SoldierClassSpec {
  id: SoldierClassId;
  label: string;
  maxHp: number;
  movementMultiplier: number;
  weaponPool: Record<Faction, readonly WeaponId[]>;
  tacticalRole: 'rifleman' | 'defender' | 'flanker';
  description: string;
}

export const SOLDIER_CLASSES: Record<SoldierClassId, SoldierClassSpec> = {
  assault: {
    id: 'assault',
    label: 'Assaut',
    maxHp: 100,
    movementMultiplier: 1.08,
    weaponPool: { army: ['hk416', 'carbine', 'famas'], rebels: ['ak74m', 'ak47', 'galil'] },
    tacticalRole: 'flanker',
    description: 'Mobilité accrue et progression agressive vers les objectifs.',
  },
  support: {
    id: 'support',
    label: 'Soutien',
    maxHp: 125,
    movementMultiplier: 0.88,
    weaponPool: { army: ['scar_l', 'aug'], rebels: ['sg552', 'fnfal'] },
    tacticalRole: 'defender',
    description: 'Résistance supérieure et maintien des positions sous pression.',
  },
  marksman: {
    id: 'marksman',
    label: 'Tireur de précision',
    maxHp: 90,
    movementMultiplier: 0.92,
    weaponPool: { army: ['m24', 'awm'], rebels: ['sniper', 'vss', 'barrett'] },
    tacticalRole: 'defender',
    description: 'Privilégie les lignes de tir et les positions couvertes.',
  },
  antiArmor: {
    id: 'antiArmor',
    label: 'Antichar',
    maxHp: 105,
    movementMultiplier: 0.9,
    weaponPool: { army: ['at4', 'bazooka'], rebels: ['bazooka'] },
    tacticalRole: 'rifleman',
    description: 'Porte un lance-roquettes et progresse avec une mobilité réduite.',
  },
  medic: {
    id: 'medic',
    label: 'Infirmier de combat',
    maxHp: 110,
    movementMultiplier: 1,
    weaponPool: { army: ['carbine', 'hk416'], rebels: ['ak47', 'ak74m'] },
    tacticalRole: 'rifleman',
    description: 'Soigne périodiquement les alliés blessés à proximité.',
  },
};

const CLASS_ORDER: SoldierClassId[] = ['assault', 'support', 'marksman', 'antiArmor', 'medic'];

export function getSoldierClass(id: number): SoldierClassSpec {
  const safeId = Number.isFinite(id) ? Math.abs(Math.trunc(id)) : 0;
  return SOLDIER_CLASSES[CLASS_ORDER[safeId % CLASS_ORDER.length]];
}

export function getClassWeapon(id: number, faction: Faction): WeaponId {
  const spec = getSoldierClass(id);
  const pool = spec.weaponPool[faction];
  return pool[Math.floor(Math.abs(id)) % pool.length];
}
