import * as THREE from 'three';
import { ProceduralTexturePack } from './textures';
import { Faction, WeaponCategory, WeaponId, WeaponSpec } from './types';

export const MAX_LOADOUT_SIZE = 3;

export const DEFAULT_ARMY_LOADOUT: WeaponId[] = ['carbine', 'm24', 'bazooka'];
export const DEFAULT_REBEL_LOADOUT: WeaponId[] = ['ak47', 'sniper', 'flamethrower'];

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  // =========================================================
  // LOT 1 : 10 ARMES D'ASSAUT
  // =========================================================
  ak47: {
    id: 'ak47',
    category: 'assault',
    delivery: 'bullet',
    name: 'AK-47 Type 56',
    shortName: 'AK-47',
    caliber: '7.62×39mm',
    finishLabel: 'Bois Noyer & Acier',
    description: 'Classique robuste à fort pouvoir d’arrêt et chargeur banane en acier.',
    fireMode: 'AUTO',
    damage: 19,
    headshotMult: 6.4,
    rpm: 550,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.85,
    muzzleVelocity: 435,
    airDrag: 0.0017,
    penetration: 0.62,
    baseSpread: 0.0105,
    adsSpread: 0.00042,
    moveSpreadPenalty: 0.014,
    recoilPitch: 0.0165,
    recoilYaw: 0.0062,
    adsFov: 50,
    hipOffset: new THREE.Vector3(0.22, -0.22, -0.44),
    adsOffset: new THREE.Vector3(0.0, -0.078, -0.34),
  },
  carbine: {
    id: 'carbine',
    category: 'assault',
    delivery: 'bullet',
    name: 'Carabine M4A1 Tactique',
    shortName: 'M4A1',
    caliber: '5.56×45mm',
    finishLabel: 'Polymère Noir & Rail',
    description: 'Carabine polyvalente équipée d’un viseur holographique EOTech très stable.',
    fireMode: 'AUTO',
    damage: 15,
    headshotMult: 7.2,
    rpm: 750,
    magSize: 30,
    reserveMax: 210,
    reloadTime: 1.62,
    muzzleVelocity: 485,
    airDrag: 0.0015,
    penetration: 0.48,
    baseSpread: 0.0074,
    adsSpread: 0.00024,
    moveSpreadPenalty: 0.011,
    recoilPitch: 0.011,
    recoilYaw: 0.004,
    adsFov: 48,
    hipOffset: new THREE.Vector3(0.22, -0.21, -0.42),
    adsOffset: new THREE.Vector3(0.0, -0.092, -0.29),
  },
  ak74m: {
    id: 'ak74m',
    category: 'assault',
    delivery: 'bullet',
    name: 'AK-74M Kalachnikov',
    shortName: 'AK-74M',
    caliber: '5.45×39mm',
    finishLabel: 'Polymère & Bakélite',
    description: 'Frein de bouche double chambre réduisant le recul et chargeur bakélite.',
    fireMode: 'AUTO',
    damage: 16,
    headshotMult: 6.8,
    rpm: 635,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.75,
    muzzleVelocity: 475,
    airDrag: 0.0015,
    penetration: 0.54,
    baseSpread: 0.0082,
    adsSpread: 0.0003,
    moveSpreadPenalty: 0.012,
    recoilPitch: 0.0125,
    recoilYaw: 0.0045,
    adsFov: 48,
    hipOffset: new THREE.Vector3(0.22, -0.215, -0.43),
    adsOffset: new THREE.Vector3(0.0, -0.092, -0.3),
  },
  fnfal: {
    id: 'fnfal',
    category: 'assault',
    delivery: 'bullet',
    name: 'FN FAL / SA-58 Para',
    shortName: 'FN FAL',
    caliber: '7.62×51mm NATO',
    finishLabel: 'Acier Foncé & Olive',
    description: 'Fusil de combat lourd perçant les abris en bois à moyenne et longue portée.',
    fireMode: 'AUTO',
    damage: 26,
    headshotMult: 5.5,
    rpm: 420,
    magSize: 20,
    reserveMax: 140,
    reloadTime: 1.95,
    muzzleVelocity: 530,
    airDrag: 0.0012,
    penetration: 0.78,
    baseSpread: 0.0098,
    adsSpread: 0.00022,
    moveSpreadPenalty: 0.015,
    recoilPitch: 0.021,
    recoilYaw: 0.0072,
    adsFov: 46,
    hipOffset: new THREE.Vector3(0.225, -0.22, -0.45),
    adsOffset: new THREE.Vector3(0.0, -0.078, -0.33),
  },
  scar_l: {
    id: 'scar_l',
    category: 'assault',
    delivery: 'bullet',
    name: 'FN SCAR-L CQC',
    shortName: 'SCAR-L',
    caliber: '5.56×45mm',
    finishLabel: 'Alliage FDE Sable',
    description: 'Châssis modulaire sable désert avec point rouge réflexe ultra précis.',
    fireMode: 'AUTO',
    damage: 17,
    headshotMult: 6.9,
    rpm: 590,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.68,
    muzzleVelocity: 505,
    airDrag: 0.00135,
    penetration: 0.52,
    baseSpread: 0.007,
    adsSpread: 0.0002,
    moveSpreadPenalty: 0.0095,
    recoilPitch: 0.0108,
    recoilYaw: 0.0034,
    adsFov: 47,
    hipOffset: new THREE.Vector3(0.22, -0.21, -0.42),
    adsOffset: new THREE.Vector3(0.0, -0.092, -0.29),
  },
  hk416: {
    id: 'hk416',
    category: 'assault',
    delivery: 'bullet',
    name: 'HK416 A5 Forces Spéciales',
    shortName: 'HK416',
    caliber: '5.56×45mm',
    finishLabel: 'Acier Noir & Quad-Rail',
    description: 'Piston à course courte, cadence d’appui rapide (890 c/min) et optique nette.',
    fireMode: 'AUTO',
    damage: 15.5,
    headshotMult: 7.0,
    rpm: 890,
    magSize: 35,
    reserveMax: 245,
    reloadTime: 1.58,
    muzzleVelocity: 510,
    airDrag: 0.0014,
    penetration: 0.5,
    baseSpread: 0.0074,
    adsSpread: 0.00024,
    moveSpreadPenalty: 0.0098,
    recoilPitch: 0.0096,
    recoilYaw: 0.0034,
    adsFov: 44,
    hipOffset: new THREE.Vector3(0.22, -0.21, -0.42),
    adsOffset: new THREE.Vector3(0.0, -0.092, -0.28),
  },
  famas: {
    id: 'famas',
    category: 'assault',
    delivery: 'bullet',
    name: 'FAMAS F1 Suppression CQB',
    shortName: 'FAMAS F1',
    caliber: '5.56×45mm',
    finishLabel: 'Bullpup Polymère',
    description: 'Arme de suppression bullpup à cadence fulgurante (1120 coups/min) en rafales.',
    fireMode: 'AUTO',
    damage: 13.5,
    headshotMult: 7.1,
    rpm: 1120,
    magSize: 30,
    reserveMax: 240,
    reloadTime: 1.72,
    muzzleVelocity: 500,
    airDrag: 0.0015,
    penetration: 0.46,
    baseSpread: 0.0082,
    adsSpread: 0.00028,
    moveSpreadPenalty: 0.0085,
    recoilPitch: 0.0086,
    recoilYaw: 0.0036,
    adsFov: 49,
    hipOffset: new THREE.Vector3(0.21, -0.21, -0.4),
    adsOffset: new THREE.Vector3(0.0, -0.104, -0.29),
  },
  aug: {
    id: 'aug',
    category: 'assault',
    delivery: 'bullet',
    name: 'Steyr AUG A3',
    shortName: 'AUG A3',
    caliber: '5.56×45mm',
    finishLabel: 'Bullpup Olive Militaire',
    description: 'Optique intégrée nette et poignée avant offrant un contrôle remarquable en mouvement.',
    fireMode: 'AUTO',
    damage: 16,
    headshotMult: 6.9,
    rpm: 670,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.78,
    muzzleVelocity: 520,
    airDrag: 0.0013,
    penetration: 0.52,
    baseSpread: 0.0066,
    adsSpread: 0.00018,
    moveSpreadPenalty: 0.008,
    recoilPitch: 0.01,
    recoilYaw: 0.0032,
    adsFov: 42,
    hipOffset: new THREE.Vector3(0.21, -0.21, -0.4),
    adsOffset: new THREE.Vector3(0.0, -0.094, -0.27),
  },
  galil: {
    id: 'galil',
    category: 'assault',
    delivery: 'bullet',
    name: 'IWI Galil ARM Suppression',
    shortName: 'Galil Suppr.',
    caliber: '5.56×45mm',
    finishLabel: 'Tambour 50c & Titane',
    description: 'Arme de suppression soutenue à cadence rapide (980 c/min) et tambour 50 coups.',
    fireMode: 'AUTO',
    damage: 15,
    headshotMult: 6.7,
    rpm: 980,
    magSize: 50,
    reserveMax: 300,
    reloadTime: 2.05,
    muzzleVelocity: 500,
    airDrag: 0.00145,
    penetration: 0.56,
    baseSpread: 0.0078,
    adsSpread: 0.00028,
    moveSpreadPenalty: 0.0105,
    recoilPitch: 0.0085,
    recoilYaw: 0.0036,
    adsFov: 48,
    hipOffset: new THREE.Vector3(0.22, -0.215, -0.43),
    adsOffset: new THREE.Vector3(0.0, -0.092, -0.29),
  },
  sg552: {
    id: 'sg552',
    category: 'assault',
    delivery: 'bullet',
    name: 'SIG SG 552 Commando',
    shortName: 'SG 552',
    caliber: '5.56×45mm',
    finishLabel: 'Gris Titane & Olive',
    description: 'Format commando très maniable à cadence vive (800 c/min) pour assaut rapproché.',
    fireMode: 'AUTO',
    damage: 15,
    headshotMult: 7.1,
    rpm: 800,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.55,
    muzzleVelocity: 485,
    airDrag: 0.0015,
    penetration: 0.47,
    baseSpread: 0.0072,
    adsSpread: 0.00026,
    moveSpreadPenalty: 0.0078,
    recoilPitch: 0.0094,
    recoilYaw: 0.0034,
    adsFov: 49,
    hipOffset: new THREE.Vector3(0.21, -0.205, -0.39),
    adsOffset: new THREE.Vector3(0.0, -0.092, -0.27),
  },

  // =========================================================
  // LOT 2 : 6 ARMES DE PRÉCISION AVEC ZOOM OPTIQUE
  // =========================================================
  sniper: {
    id: 'sniper',
    category: 'sniper',
    delivery: 'bullet',
    name: 'Dragunov SVD',
    shortName: 'SVD',
    caliber: '7.62×54mmR',
    finishLabel: 'Noyer Tigré & PSO-1',
    description: 'Fusil de tireur d’élite semi-auto avec lunette PSO-1 lumineuse (zoom 4× / 6×).',
    fireMode: 'SEMI',
    damage: 48,
    headshotMult: 3.5,
    rpm: 165,
    magSize: 10,
    reserveMax: 50,
    reloadTime: 2.2,
    muzzleVelocity: 650,
    airDrag: 0.00075,
    penetration: 0.88,
    baseSpread: 0.018,
    adsSpread: 0.000018,
    moveSpreadPenalty: 0.024,
    recoilPitch: 0.032,
    recoilYaw: 0.0052,
    adsFov: 21,
    zoomFovs: [21, 14],
    zoomLabels: ['4×', '6×'],
    scopeType: 'pso',
    hipOffset: new THREE.Vector3(0.24, -0.23, -0.46),
    adsOffset: new THREE.Vector3(0.0, -0.094, -0.26),
  },
  m24: {
    id: 'm24',
    category: 'sniper',
    delivery: 'bullet',
    name: 'Remington M24 SWS',
    shortName: 'M24 SWS',
    caliber: '7.62×51mm NATO',
    finishLabel: 'Olive Mat & Verrou Acier',
    description: 'Carabine à verrou d’une précision chirurgicale avec lunette Mil-Dot 6× / 10×.',
    fireMode: 'SEMI',
    damage: 68,
    headshotMult: 3.4,
    rpm: 54,
    magSize: 5,
    reserveMax: 40,
    reloadTime: 2.35,
    muzzleVelocity: 740,
    airDrag: 0.00058,
    penetration: 0.9,
    baseSpread: 0.02,
    adsSpread: 0.00001,
    moveSpreadPenalty: 0.028,
    recoilPitch: 0.042,
    recoilYaw: 0.0058,
    adsFov: 17,
    zoomFovs: [17, 10.5],
    zoomLabels: ['6×', '10×'],
    scopeType: 'mildot',
    hipOffset: new THREE.Vector3(0.24, -0.23, -0.46),
    adsOffset: new THREE.Vector3(0.0, -0.094, -0.26),
  },
  awm: {
    id: 'awm',
    category: 'sniper',
    delivery: 'bullet',
    name: 'AWM L115A3 Magnum',
    shortName: 'AWM .338',
    caliber: '.338 Lapua Mag',
    finishLabel: 'Châssis Olive & Frein 3-Fentes',
    description: 'Châssis britannique à trou de pouce éliminant en un tir au torse (zoom 8× / 12×).',
    fireMode: 'SEMI',
    damage: 86,
    headshotMult: 3.2,
    rpm: 42,
    magSize: 5,
    reserveMax: 35,
    reloadTime: 2.5,
    muzzleVelocity: 820,
    airDrag: 0.00045,
    penetration: 0.94,
    baseSpread: 0.022,
    adsSpread: 0.000008,
    moveSpreadPenalty: 0.03,
    recoilPitch: 0.05,
    recoilYaw: 0.0064,
    adsFov: 14,
    zoomFovs: [14, 9],
    zoomLabels: ['8×', '12×'],
    scopeType: 'mildot',
    hipOffset: new THREE.Vector3(0.24, -0.23, -0.46),
    adsOffset: new THREE.Vector3(0.0, -0.094, -0.26),
  },
  barrett: {
    id: 'barrett',
    category: 'sniper',
    delivery: 'bullet',
    name: 'Barrett M82A1 .50 BMG',
    shortName: 'M82A1 .50',
    caliber: '12.7×99mm (.50)',
    finishLabel: 'Acier Lourd Anti-Matériel',
    description: 'Monstre anti-matériel traversant les couverts épais, optique longue portée 8× / 14×.',
    fireMode: 'SEMI',
    damage: 98,
    headshotMult: 3.0,
    rpm: 74,
    magSize: 10,
    reserveMax: 30,
    reloadTime: 2.85,
    muzzleVelocity: 880,
    airDrag: 0.00038,
    penetration: 0.99,
    baseSpread: 0.026,
    adsSpread: 0.00001,
    moveSpreadPenalty: 0.034,
    recoilPitch: 0.064,
    recoilYaw: 0.0085,
    adsFov: 14,
    zoomFovs: [14, 7.8],
    zoomLabels: ['8×', '14×'],
    scopeType: 'heavy',
    hipOffset: new THREE.Vector3(0.25, -0.24, -0.48),
    adsOffset: new THREE.Vector3(0.0, -0.096, -0.26),
  },
  mk20: {
    id: 'mk20',
    category: 'sniper',
    delivery: 'bullet',
    name: 'FN MK20 SSR Précision',
    shortName: 'MK20 SSR',
    caliber: '7.62×51mm NATO',
    finishLabel: 'Céramique FDE Sable',
    description: 'Fusil d’appui de précision semi-auto rapide à faible recul, lunette 4× / 8×.',
    fireMode: 'SEMI',
    damage: 45,
    headshotMult: 3.6,
    rpm: 235,
    magSize: 20,
    reserveMax: 80,
    reloadTime: 2.05,
    muzzleVelocity: 690,
    airDrag: 0.00068,
    penetration: 0.85,
    baseSpread: 0.015,
    adsSpread: 0.000018,
    moveSpreadPenalty: 0.02,
    recoilPitch: 0.024,
    recoilYaw: 0.0042,
    adsFov: 20,
    zoomFovs: [20, 12],
    zoomLabels: ['4×', '8×'],
    scopeType: 'mildot',
    hipOffset: new THREE.Vector3(0.23, -0.22, -0.45),
    adsOffset: new THREE.Vector3(0.0, -0.094, -0.26),
  },
  vss: {
    id: 'vss',
    category: 'sniper',
    delivery: 'bullet',
    name: 'VSS Vintorez Silencieux',
    shortName: 'VSS Vintorez',
    caliber: '9×39mm Subsonique',
    finishLabel: 'Silencieux Intégral & Bois',
    description: 'Carabine de précision à silencieux intégré, tir automatique rapide 4× / 6×.',
    fireMode: 'AUTO',
    damage: 36,
    headshotMult: 3.9,
    rpm: 560,
    magSize: 20,
    reserveMax: 100,
    reloadTime: 1.95,
    muzzleVelocity: 460,
    airDrag: 0.0011,
    penetration: 0.72,
    baseSpread: 0.011,
    adsSpread: 0.000035,
    moveSpreadPenalty: 0.014,
    recoilPitch: 0.014,
    recoilYaw: 0.0034,
    adsFov: 23,
    zoomFovs: [23, 15],
    zoomLabels: ['4×', '6×'],
    scopeType: 'pso',
    hipOffset: new THREE.Vector3(0.225, -0.22, -0.43),
    adsOffset: new THREE.Vector3(0.0, -0.094, -0.26),
  },

  // =========================================================
  // LOT 3 : ARMES DE DESTRUCTION (LANCE-FUSÉE & LANCE-FLAMME)
  // =========================================================
  bazooka: {
    id: 'bazooka',
    category: 'destruction',
    delivery: 'rocket',
    name: 'Lance-Fusée RPG-7V2',
    shortName: 'RPG-7',
    caliber: '85mm PG-7V',
    finishLabel: 'Tube Acier & Noyer',
    description: 'Lance-roquettes emblématique à ogive explosive PG-7V et viseur optique PGO-7.',
    fireMode: 'SEMI',
    damage: 170,
    headshotMult: 1.0,
    rpm: 38,
    magSize: 1,
    reserveMax: 6,
    reloadTime: 2.45,
    muzzleVelocity: 76,
    airDrag: 0.0003,
    penetration: 0,
    baseSpread: 0.0045,
    adsSpread: 0.0004,
    moveSpreadPenalty: 0.012,
    recoilPitch: 0.052,
    recoilYaw: 0.009,
    adsFov: 50,
    hipOffset: new THREE.Vector3(0.24, -0.18, -0.34),
    adsOffset: new THREE.Vector3(0.048, -0.076, -0.24),
  },
  at4: {
    id: 'at4',
    category: 'destruction',
    delivery: 'rocket',
    name: 'Lance-Fusée M136 AT4',
    shortName: 'M136 AT4',
    caliber: '84mm HEAT',
    finishLabel: 'Composite Olive & Bande Jaune',
    description: 'Lance-fusée haute vélocité à trajectoire tendue et souffle explosif élargi.',
    fireMode: 'SEMI',
    damage: 185,
    headshotMult: 1.0,
    rpm: 44,
    magSize: 1,
    reserveMax: 5,
    reloadTime: 2.3,
    muzzleVelocity: 108,
    airDrag: 0.0002,
    penetration: 0,
    baseSpread: 0.0035,
    adsSpread: 0.00025,
    moveSpreadPenalty: 0.01,
    recoilPitch: 0.048,
    recoilYaw: 0.008,
    adsFov: 48,
    hipOffset: new THREE.Vector3(0.24, -0.18, -0.35),
    adsOffset: new THREE.Vector3(0.045, -0.076, -0.25),
  },
  flamethrower: {
    id: 'flamethrower',
    category: 'destruction',
    delivery: 'flame',
    name: 'Lance-Flamme M2A1-7',
    shortName: 'M2A1 Flamme',
    caliber: 'Gel Napalm',
    finishLabel: 'Réservoir Pressurisé & Laiton',
    description: 'Projette un jet de feu continu embrasant ennemis et barils avec brûlures durables.',
    fireMode: 'AUTO',
    damage: 13,
    headshotMult: 1.0,
    rpm: 940,
    magSize: 90,
    reserveMax: 270,
    reloadTime: 2.4,
    muzzleVelocity: 28,
    airDrag: 0.08,
    penetration: 0,
    baseSpread: 0.052,
    adsSpread: 0.036,
    moveSpreadPenalty: 0.02,
    recoilPitch: 0.003,
    recoilYaw: 0.0025,
    adsFov: 58,
    hipOffset: new THREE.Vector3(0.23, -0.23, -0.4),
    adsOffset: new THREE.Vector3(0.06, -0.15, -0.34),
  },
  lpo50: {
    id: 'lpo50',
    category: 'destruction',
    delivery: 'flame',
    name: 'Lance-Flamme LPO-50 Tactique',
    shortName: 'LPO-50 Feu',
    caliber: 'Mélange Incendiaire',
    finishLabel: 'Acier Olive & Buse Longue',
    description: 'Lance-flamme à longue portée (22m) propulsant des salves de napalm haute température.',
    fireMode: 'AUTO',
    damage: 16,
    headshotMult: 1.0,
    rpm: 840,
    magSize: 75,
    reserveMax: 225,
    reloadTime: 2.55,
    muzzleVelocity: 35,
    airDrag: 0.06,
    penetration: 0,
    baseSpread: 0.036,
    adsSpread: 0.024,
    moveSpreadPenalty: 0.015,
    recoilPitch: 0.0038,
    recoilYaw: 0.0028,
    adsFov: 56,
    hipOffset: new THREE.Vector3(0.23, -0.225, -0.42),
    adsOffset: new THREE.Vector3(0.04, -0.135, -0.35),
  },
};

export const WEAPON_LIST: WeaponSpec[] = Object.values(WEAPON_SPECS);
export const ALL_WEAPON_IDS: WeaponId[] = WEAPON_LIST.map((w) => w.id);

export function getWeaponsByCategory(cat: WeaponCategory): WeaponSpec[] {
  return WEAPON_LIST.filter((w) => w.category === cat);
}

export function isSniperWeapon(id: WeaponId): boolean {
  return WEAPON_SPECS[id]?.category === 'sniper';
}

export function isRocketWeapon(id: WeaponId): boolean {
  return WEAPON_SPECS[id]?.delivery === 'rocket';
}

export function isFlameWeapon(id: WeaponId): boolean {
  return WEAPON_SPECS[id]?.delivery === 'flame';
}

export function sanitizeWeaponId(raw: unknown, fallback: WeaponId = 'carbine'): WeaponId {
  if (typeof raw === 'string' && raw in WEAPON_SPECS) {
    return raw as WeaponId;
  }
  return fallback;
}

export function sanitizeLoadout(raw: unknown, faction: Faction): WeaponId[] {
  const defaults = faction === 'army' ? DEFAULT_ARMY_LOADOUT : DEFAULT_REBEL_LOADOUT;
  if (!Array.isArray(raw)) return [...defaults];
  const unique: WeaponId[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item in WEAPON_SPECS && !unique.includes(item as WeaponId)) {
      unique.push(item as WeaponId);
      if (unique.length >= MAX_LOADOUT_SIZE) break;
    }
  }
  return unique.length > 0 ? unique : [...defaults];
}

export interface WeaponViewmodel {
  root: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  boltMesh: THREE.Mesh;
  warheadMesh?: THREE.Group;
  pilotFlameMesh?: THREE.Mesh;
}

function makeCurvedAkMagazine(mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-0.028, 0);
  s.lineTo(0.032, 0);
  s.quadraticCurveTo(0.036, -0.09, 0.005, -0.175);
  s.lineTo(-0.048, -0.165);
  s.quadraticCurveTo(-0.022, -0.085, -0.028, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.014);
  geo.rotateY(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

function makeBeveledReceiver(length: number, height: number, width: number, mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  const hl = length * 0.5;
  const hh = height * 0.5;
  s.moveTo(-hl, -hh + 0.006);
  s.lineTo(hl, -hh + 0.006);
  s.lineTo(hl, hh - 0.004);
  s.lineTo(hl - 0.014, hh);
  s.lineTo(-hl + 0.012, hh);
  s.lineTo(-hl, hh - 0.008);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

function makeLathedBarrel(
  length: number,
  brakeStyle: 'standard' | 'barrett' | 'awm' | 'none',
  mat: THREE.Material,
  radiusScale = 1
): THREE.Mesh {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.015 * radiusScale, 0),
    new THREE.Vector2(0.014 * radiusScale, length * 0.35),
    new THREE.Vector2(0.012 * radiusScale, length * 0.38),
    new THREE.Vector2(0.011 * radiusScale, length * 0.88),
  ];
  if (brakeStyle === 'barrett') {
    pts.push(
      new THREE.Vector2(0.024, length * 0.89),
      new THREE.Vector2(0.026, length * 0.95),
      new THREE.Vector2(0.022, length),
      new THREE.Vector2(0.011, length)
    );
  } else if (brakeStyle === 'awm') {
    pts.push(
      new THREE.Vector2(0.018, length * 0.89),
      new THREE.Vector2(0.018, length * 0.98),
      new THREE.Vector2(0.01, length)
    );
  } else if (brakeStyle === 'standard') {
    pts.push(
      new THREE.Vector2(0.015 * radiusScale, length * 0.9),
      new THREE.Vector2(0.015 * radiusScale, length * 0.96),
      new THREE.Vector2(0.013 * radiusScale, length),
      new THREE.Vector2(0.008 * radiusScale, length)
    );
  } else {
    pts.push(new THREE.Vector2(0.0095 * radiusScale, length));
  }
  const geo = new THREE.LatheGeometry(pts, 14);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

function addHoloReflexSight(
  root: THREE.Group,
  darkMetalMat: THREE.Material,
  yCenter = 0.092,
  reticleColor = '#ef4444',
  ringStyle: 'eotech' | 'dot' | 'acog' = 'eotech'
) {
  const holoBase = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.011, 0.068), darkMetalMat);
  holoBase.position.set(0, yCenter - 0.024, -0.02);
  root.add(holoBase);

  if (ringStyle === 'acog') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.016, 0.11, 14, 1, true),
      darkMetalMat
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, yCenter, -0.02);
    root.add(tube);

    const fiber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.065, 8),
      new THREE.MeshBasicMaterial({ color: reticleColor })
    );
    fiber.rotation.x = Math.PI / 2;
    fiber.position.set(0, yCenter + 0.02, -0.025);
    root.add(fiber);
  } else {
    const holoLeft = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.036, 0.052), darkMetalMat);
    holoLeft.position.set(-0.021, yCenter - 0.001, -0.02);
    const holoRight = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.036, 0.052), darkMetalMat);
    holoRight.position.set(0.021, yCenter - 0.001, -0.02);
    const holoTop = new THREE.Mesh(new THREE.BoxGeometry(0.0465, 0.0045, 0.052), darkMetalMat);
    holoTop.position.set(0, yCenter + 0.017, -0.02);
    root.add(holoLeft, holoRight, holoTop);
  }

  const holoGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.034, 0.032),
    new THREE.MeshBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    })
  );
  holoGlass.position.set(0, yCenter, -0.02);
  root.add(holoGlass);

  const retMat = new THREE.MeshBasicMaterial({
    color: reticleColor,
    transparent: true,
    opacity: 0.95,
  });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 12), retMat);
  dot.position.set(0, yCenter, -0.014);
  root.add(dot);

  if (ringStyle === 'eotech') {
    const holoRing = new THREE.Mesh(new THREE.RingGeometry(0.0068, 0.0079, 24), retMat);
    holoRing.position.set(0, yCenter, -0.014);
    root.add(holoRing);
  }
}

function addPrecisionScopeMesh(
  root: THREE.Group,
  bodyMat: THREE.Material,
  accentMat: THREE.Material,
  yCenter = 0.094,
  scale = 1.0,
  lensTint = '#1b3530'
) {
  const scopePts = [
    new THREE.Vector2(0.023 * scale, 0.11 * scale),
    new THREE.Vector2(0.017 * scale, 0.065 * scale),
    new THREE.Vector2(0.017 * scale, -0.095 * scale),
    new THREE.Vector2(0.029 * scale, -0.145 * scale),
    new THREE.Vector2(0.029 * scale, -0.2 * scale),
  ];
  const scopeGeo = new THREE.LatheGeometry(scopePts, 16);
  scopeGeo.rotateX(Math.PI / 2);
  const scopeMesh = new THREE.Mesh(scopeGeo, bodyMat);
  scopeMesh.position.set(0, yCenter, -0.01);
  root.add(scopeMesh);

  [-0.05, 0.03].forEach((rz) => {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.018), accentMat);
    ring.position.set(0, yCenter - 0.024, rz);
    root.add(ring);
  });

  const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.022, 10), accentMat);
  turretTop.position.set(0, yCenter + 0.022 * scale, -0.02);
  root.add(turretTop);

  const turretSide = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.018, 10), accentMat);
  turretSide.rotation.z = Math.PI / 2;
  turretSide.position.set(0.02 * scale, yCenter, -0.02);
  root.add(turretSide);

  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.02 * scale, 16),
    new THREE.MeshBasicMaterial({ color: lensTint })
  );
  lens.position.set(0, yCenter, 0.1 * scale);
  root.add(lens);
}

export function buildWeaponViewmodel(
  id: WeaponId,
  tex: ProceduralTexturePack
): WeaponViewmodel {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    map: tex.brushedSteel,
    color: '#434952',
    roughness: 0.3,
    metalness: 0.88,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    map: tex.brushedSteel,
    color: '#1f2328',
    roughness: 0.42,
    metalness: 0.8,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    map: tex.brushedSteel,
    color: '#6b7280',
    roughness: 0.34,
    metalness: 0.82,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.walnutWood,
    roughness: 0.56,
    metalness: 0.05,
  });
  const tigerWoodMat = new THREE.MeshStandardMaterial({
    map: tex.weaponTigerWood,
    roughness: 0.52,
    metalness: 0.06,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    map: tex.weaponPolymerBlack,
    bumpMap: tex.tacticalFabric,
    bumpScale: 0.018,
    color: '#26292d',
    roughness: 0.78,
    metalness: 0.08,
  });
  const fdeMat = new THREE.MeshStandardMaterial({
    map: tex.weaponFdeTan,
    roughness: 0.58,
    metalness: 0.22,
  });
  const oliveMat = new THREE.MeshStandardMaterial({
    map: tex.weaponOliveMetal,
    roughness: 0.6,
    metalness: 0.25,
  });
  const bakeliteMat = new THREE.MeshStandardMaterial({
    map: tex.weaponBakelite,
    roughness: 0.44,
    metalness: 0.06,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: tex.weaponHazardYellow,
    roughness: 0.52,
    metalness: 0.34,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: '#c47b38',
    roughness: 0.28,
    metalness: 0.88,
  });
  const tankRedMat = new THREE.MeshStandardMaterial({
    map: tex.weaponOliveMetal,
    color: '#8f2d22',
    roughness: 0.48,
    metalness: 0.42,
  });
  const translucentMagMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    transparent: true,
    opacity: 0.48,
    roughness: 0.28,
    metalness: 0.1,
  });
  const sightGlowMat = new THREE.MeshBasicMaterial({
    color: '#a3e635',
  });

  // =========================================================
  // 1. LANCE-FUSÉE RPG-7V2 & M136 AT4
  // =========================================================
  if (id === 'bazooka' || id === 'at4') {
    const isAt4 = id === 'at4';
    const tubePts = isAt4
      ? [
          new THREE.Vector2(0.064, 0.54),
          new THREE.Vector2(0.044, 0.42),
          new THREE.Vector2(0.044, -0.52),
          new THREE.Vector2(0.052, -0.56),
          new THREE.Vector2(0.046, -0.58),
        ]
      : [
          new THREE.Vector2(0.058, 0.56),
          new THREE.Vector2(0.036, 0.42),
          new THREE.Vector2(0.036, -0.44),
          new THREE.Vector2(0.042, -0.46),
          new THREE.Vector2(0.042, -0.5),
          new THREE.Vector2(0.034, -0.5),
        ];
    const tubeGeo = new THREE.LatheGeometry(tubePts, 18);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, isAt4 ? hazardMat : darkMetalMat);
    tube.position.set(0, 0.02, 0.04);
    root.add(tube);

    if (isAt4) {
      // Heavy olive composite shoulder rest & warning bands
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.34, 16),
        oliveMat
      );
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.set(0, 0.02, -0.1);
      root.add(sleeve);

      const frontRubber = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.049, 0.06, 16),
        polymerMat
      );
      frontRubber.rotation.x = Math.PI / 2;
      frontRubber.position.set(0, 0.02, -0.54);
      root.add(frontRubber);
    } else {
      const heatshield = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.36, 16),
        woodMat
      );
      heatshield.rotation.x = Math.PI / 2;
      heatshield.position.set(0, 0.02, 0.04);
      root.add(heatshield);

      [-0.12, 0.2].forEach((bz) => {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(0.044, 0.044, 0.018, 16),
          steelMat
        );
        band.rotation.x = Math.PI / 2;
        band.position.set(0, 0.02, bz);
        root.add(band);
      });
    }

    const frontGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.115, 0.042), polymerMat);
    frontGrip.position.set(0, -0.055, -0.24);
    frontGrip.rotation.x = 0.28;
    root.add(frontGrip);

    const rearGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.1, 0.04), polymerMat);
    rearGrip.position.set(0, -0.05, -0.04);
    rearGrip.rotation.x = 0.22;
    root.add(rearGrip);

    // Side optical sight aligned to adsOffset
    const sideX = isAt4 ? -0.045 : -0.048;
    const sightMount = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.034, 0.08), darkMetalMat);
    sightMount.position.set(sideX * 0.75, 0.052, -0.14);
    root.add(sightMount);

    const sightScope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.017, 0.16, 16, 1, true),
      oliveMat
    );
    sightScope.rotation.x = Math.PI / 2;
    sightScope.position.set(sideX, 0.076, -0.14);
    root.add(sightScope);

    const eyeCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.018, 0.036, 16, 1, true),
      polymerMat
    );
    eyeCup.rotation.x = Math.PI / 2;
    eyeCup.position.set(sideX, 0.076, -0.045);
    root.add(eyeCup);

    const pgoDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.0017, 10),
      new THREE.MeshBasicMaterial({ color: isAt4 ? '#f97316' : '#facc15' })
    );
    pgoDot.position.set(sideX, 0.076, -0.125);
    root.add(pgoDot);

    const pgoCrossH = new THREE.Mesh(
      new THREE.PlaneGeometry(0.016, 0.0009),
      new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.78 })
    );
    pgoCrossH.position.set(sideX, 0.076, -0.125);
    const pgoCrossV = new THREE.Mesh(
      new THREE.PlaneGeometry(0.0009, 0.016),
      new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.78 })
    );
    pgoCrossV.position.set(sideX, 0.076, -0.125);
    root.add(pgoCrossH, pgoCrossV);

    let warheadMesh: THREE.Group | undefined;
    if (!isAt4) {
      warheadMesh = new THREE.Group();
      warheadMesh.position.set(0, 0.02, -0.52);

      const pgPts = [
        new THREE.Vector2(0.005, -0.27),
        new THREE.Vector2(0.012, -0.23),
        new THREE.Vector2(0.052, -0.1),
        new THREE.Vector2(0.052, -0.05),
        new THREE.Vector2(0.02, 0.01),
        new THREE.Vector2(0.018, 0.08),
      ];
      const pgGeo = new THREE.LatheGeometry(pgPts, 16);
      pgGeo.rotateX(Math.PI / 2);
      warheadMesh.add(new THREE.Mesh(pgGeo, oliveMat));

      const fuseTip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.012, 0.045, 12),
        copperMat
      );
      fuseTip.rotation.x = Math.PI / 2;
      fuseTip.position.z = -0.27;
      warheadMesh.add(fuseTip);

      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.036, 0.06), steelMat);
        fin.rotation.z = (f * Math.PI) / 2;
        fin.position.z = 0.04;
        warheadMesh.add(fin);
      }
      root.add(warheadMesh);
    }

    const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.02), steelMat);
    boltMesh.position.set(0.038, 0.02, -0.1);
    root.add(boltMesh);

    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.02, -0.68);
    root.add(muzzleAnchor);

    const flashGeo = new THREE.ConeGeometry(0.14, 0.34, 8);
    flashGeo.rotateX(-Math.PI / 2);
    const muzzleFlash = new THREE.Mesh(
      flashGeo,
      new THREE.MeshBasicMaterial({
        color: '#ff9d3b',
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    muzzleFlash.position.set(0, 0.02, -0.54);
    muzzleFlash.visible = false;
    root.add(muzzleFlash);

    return { root, muzzleAnchor, muzzleFlash, boltMesh, warheadMesh };
  }

  // =========================================================
  // 2. LANCE-FLAMMES M2A1-7 & LPO-50
  // =========================================================
  if (id === 'flamethrower' || id === 'lpo50') {
    const isLpo = id === 'lpo50';
    const bodyMat = isLpo ? oliveMat : hazardMat;
    const tankMat = isLpo ? oliveMat : tankRedMat;

    // Main wand frame / manifold
    const manifold = makeBeveledReceiver(0.28, 0.064, 0.056, darkMetalMat);
    manifold.position.set(0, 0.01, 0);
    root.add(manifold);

    // Side/underslung pressurized fuel canisters + gauge
    const tankCount = isLpo ? 2 : 1;
    for (let t = 0; t < tankCount; t++) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.25, 14),
        tankMat
      );
      tank.rotation.x = Math.PI / 2;
      tank.position.set(t === 0 ? -0.052 : 0.052, -0.045, -0.05);
      root.add(tank);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 12, 8),
        copperMat
      );
      cap.position.set(t === 0 ? -0.052 : 0.052, -0.045, -0.175);
      root.add(cap);
    }

    // Pressure gauge dial
    const gauge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.014, 14),
      copperMat
    );
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0.036, 0.052, -0.03);
    root.add(gauge);

    const gaugeFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.014, 12),
      new THREE.MeshBasicMaterial({ color: '#fef08a' })
    );
    gaugeFace.position.set(0.036, 0.052, -0.022);
    root.add(gaugeFace);

    // Armored fuel hose & long insulated flame nozzle barrel
    const barrelLen = isLpo ? 0.56 : 0.44;
    const flamePipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.019, barrelLen, 14),
      steelMat
    );
    flamePipe.rotation.x = Math.PI / 2;
    flamePipe.position.set(0, 0.022, -0.14 - barrelLen * 0.5);
    root.add(flamePipe);

    const heatShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.027, barrelLen * 0.6, 14),
      bodyMat
    );
    heatShroud.rotation.x = Math.PI / 2;
    heatShroud.position.set(0, 0.022, -0.14 - barrelLen * 0.34);
    root.add(heatShroud);

    // Flared brass ignition cup + active blue/amber pilot flame!
    const nozzleZ = -0.14 - barrelLen;
    const nozzleCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.018, 0.075, 14),
      copperMat
    );
    nozzleCup.rotation.x = Math.PI / 2;
    nozzleCup.position.set(0, 0.022, nozzleZ - 0.02);
    root.add(nozzleCup);

    const pilotGeo = new THREE.ConeGeometry(0.018, 0.068, 8);
    pilotGeo.rotateX(-Math.PI / 2);
    const pilotFlameMesh = new THREE.Mesh(
      pilotGeo,
      new THREE.MeshBasicMaterial({
        color: '#fb923c',
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pilotFlameMesh.position.set(0, 0.028, nozzleZ - 0.055);
    root.add(pilotFlameMesh);

    // Grips & stock brace
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.112, 0.046), polymerMat);
    grip.position.set(0, -0.068, 0.08);
    grip.rotation.x = 0.34;
    root.add(grip);

    const foreGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.105, 0.038), polymerMat);
    foreGrip.position.set(0, -0.06, -0.26);
    root.add(foreGrip);

    const stockBrace = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.065, 0.2), darkMetalMat);
    stockBrace.position.set(0, -0.01, 0.22);
    root.add(stockBrace);

    const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.045), copperMat);
    boltMesh.position.set(0.032, 0.028, -0.03);
    root.add(boltMesh);

    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.022, nozzleZ - 0.06);
    root.add(muzzleAnchor);

    const flashGeo = new THREE.ConeGeometry(0.11, 0.28, 8);
    flashGeo.rotateX(-Math.PI / 2);
    const muzzleFlash = new THREE.Mesh(
      flashGeo,
      new THREE.MeshBasicMaterial({
        color: '#ff7b1c',
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    muzzleFlash.position.copy(muzzleAnchor.position);
    muzzleFlash.visible = false;
    root.add(muzzleFlash);

    return { root, muzzleAnchor, muzzleFlash, boltMesh, pilotFlameMesh };
  }

  // =========================================================
  // 3. ARCHITECTURES D'ASSAUT & DE PRÉCISION (16 ARMES)
  // =========================================================
  const isBullpup = id === 'famas' || id === 'aug';
  const isSniper = WEAPON_SPECS[id].category === 'sniper';
  const isBarrett = id === 'barrett';
  const isVss = id === 'vss';
  const isFde = id === 'scar_l' || id === 'mk20';
  const isOlive = id === 'aug' || id === 'awm';
  const isTitanium = id === 'galil' || id === 'sg552';
  const isWood = id === 'ak47' || id === 'sniper' || id === 'vss';

  const receiverMat = isFde
    ? fdeMat
    : isOlive
    ? oliveMat
    : isTitanium
    ? titaniumMat
    : steelMat;
  const furnitureMat = isFde
    ? fdeMat
    : isOlive
    ? oliveMat
    : isWood
    ? id === 'ak47'
      ? woodMat
      : tigerWoodMat
    : polymerMat;

  // 1. Receiver
  const recLen = isBarrett ? 0.39 : isBullpup ? 0.27 : 0.31;
  const recH = isBarrett ? 0.088 : 0.068;
  const receiver = makeBeveledReceiver(recLen, recH, isBarrett ? 0.062 : 0.048, receiverMat);
  receiver.position.set(0, 0.01, isBullpup ? 0.04 : 0);
  root.add(receiver);

  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.024, 0.056), darkMetalMat);
  triggerGuard.position.set(0, -0.034, isBullpup ? -0.045 : 0.025);
  root.add(triggerGuard);

  // 2. Top Cover / Picatinny Rail / Carry Handle
  const topCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.022, isBarrett ? 0.35 : 0.27),
    isFde ? fdeMat : darkMetalMat
  );
  topCover.position.set(0, isBarrett ? 0.062 : 0.051, -0.01);
  root.add(topCover);

  if (id === 'famas') {
    // Signature FAMAS carry handle arch
    const handleTop = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.018, 0.25), polymerMat);
    handleTop.position.set(0, 0.084, -0.01);
    const pillarF = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.025), polymerMat);
    pillarF.position.set(0, 0.068, -0.12);
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.025), polymerMat);
    pillarR.position.set(0, 0.068, 0.1);
    root.add(handleTop, pillarF, pillarR);
  } else if (id === 'carbine' || id === 'hk416' || id === 'scar_l' || id === 'mk20' || id === 'barrett') {
    const railCount = isBarrett ? 13 : 10;
    for (let r = 0; r < railCount; r++) {
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.012), steelMat);
      notch.position.set(0, (isBarrett ? 0.075 : 0.064), -0.14 + r * 0.025);
      root.add(notch);
    }
  }

  // 3. Barrel / Suppressor / Muzzle Brake
  const barrelLen = isBarrett
    ? 0.68
    : id === 'awm' || id === 'm24'
    ? 0.6
    : id === 'sniper' || id === 'mk20'
    ? 0.56
    : id === 'fnfal'
    ? 0.48
    : isVss
    ? 0.42
    : id === 'ak47' || id === 'ak74m' || id === 'galil'
    ? 0.42
    : id === 'sg552'
    ? 0.31
    : 0.36;

  if (isVss) {
    // Thick integral suppressor with vent rings
    const suppressor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, barrelLen, 16),
      polymerMat
    );
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.026, -0.15 - barrelLen * 0.5);
    root.add(suppressor);

    for (let r = 0; r < 5; r++) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0275, 0.0275, 0.008, 14),
        steelMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.026, -0.22 - r * 0.068);
      root.add(ring);
    }
  } else {
    const brakeType = isBarrett ? 'barrett' : id === 'awm' ? 'awm' : 'standard';
    const barrel = makeLathedBarrel(
      barrelLen,
      brakeType,
      isBarrett ? steelMat : darkMetalMat,
      isBarrett ? 1.38 : isSniper ? 1.12 : 1.0
    );
    barrel.position.set(0, 0.026, -0.155);
    root.add(barrel);

    const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.042, 0.036), steelMat);
    gasBlock.position.set(0, 0.036, -0.155 - barrelLen * 0.6);
    root.add(gasBlock);

    const gasTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0085, 0.0085, barrelLen * 0.6, 10),
      steelMat
    );
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.047, -0.155 - (barrelLen * 0.6) / 2);
    root.add(gasTube);
  }

  // 4. Handguard + Vents / Bipod / Vertical Foregrip
  const hgLen = isSniper ? 0.29 : isBullpup ? 0.16 : 0.22;
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(isBarrett ? 0.058 : 0.048, isBarrett ? 0.066 : 0.054, hgLen),
    furnitureMat
  );
  handguard.position.set(0, 0.018, isBullpup ? -0.18 : -0.25);
  root.add(handguard);

  if (!isVss) {
    for (let v = 0; v < 4; v++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.02), darkMetalMat);
      slot.position.set(0, 0.024, -0.18 - v * 0.038);
      root.add(slot);
    }
  }

  if (id === 'aug') {
    const augGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.095, 10), oliveMat);
    augGrip.position.set(0, -0.058, -0.22);
    augGrip.rotation.x = -0.15;
    root.add(augGrip);
  }

  if (id === 'barrett' || id === 'awm' || id === 'm24' || id === 'mk20') {
    // Folded bipod legs beneath handguard
    [-0.026, 0.026].forEach((bx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 8), darkMetalMat);
      leg.rotation.x = Math.PI / 2;
      leg.position.set(bx, -0.024, -0.32);
      root.add(leg);
    });
  }

  // 5. Stock (Skeleton, Folding, Bullpup Rear, Thumbhole AWM, Heavy Barrett)
  if (isBullpup) {
    const bullpad = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.115, 0.065), furnitureMat);
    bullpad.position.set(0, -0.012, 0.22);
    root.add(bullpad);
  } else if (id === 'sg552' || id === 'galil' || id === 'fnfal') {
    // Skeletonized folding stock
    const topStrut = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.23), titaniumMat);
    topStrut.position.set(0, 0.015, 0.25);
    const botStrut = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.23), titaniumMat);
    botStrut.position.set(0, -0.045, 0.25);
    botStrut.rotation.x = 0.12;
    const butt = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.092, 0.024), polymerMat);
    butt.position.set(0, -0.018, 0.365);
    root.add(topStrut, botStrut, butt);
  } else if (id === 'sniper' || id === 'vss' || id === 'awm') {
    // Thumbhole skeleton sniper stock
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.026, 0.24), furnitureMat);
    topRail.position.set(0, 0.008, 0.25);
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.024, 0.24), furnitureMat);
    botRail.position.set(0, -0.052, 0.25);
    botRail.rotation.x = 0.09;
    const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.096, 0.028), polymerMat);
    buttpad.position.set(0, -0.022, 0.372);
    root.add(topRail, botRail, buttpad);
  } else {
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, isBarrett ? 0.1 : 0.088, 0.24),
      furnitureMat
    );
    stock.position.set(0, -0.012, 0.26);
    stock.rotation.x = 0.07;
    root.add(stock);

    const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.094, 0.022), polymerMat);
    buttpad.position.set(0, -0.02, 0.378);
    buttpad.rotation.x = 0.07;
    root.add(buttpad);
  }

  // 6. Pistol Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.112, 0.046), furnitureMat);
  grip.position.set(0, -0.07, isBullpup ? -0.01 : 0.082);
  grip.rotation.x = 0.34;
  root.add(grip);

  // 7. Distinct Magazines (Curved AK, Bakelite, Translucent AUG/SG, Heavy Barrett Box, Bullpup Rear)
  const magZ = isBullpup ? 0.11 : -0.065;
  if (id === 'ak47' || id === 'ak74m' || id === 'galil' || id === 'vss') {
    const magMat = id === 'ak74m' ? bakeliteMat : id === 'vss' ? polymerMat : steelMat;
    const akMag = makeCurvedAkMagazine(magMat);
    akMag.position.set(0, -0.018, magZ - 0.005);
    root.add(akMag);
  } else if (id === 'aug' || id === 'sg552') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.165, 0.062), translucentMagMat);
    mag.position.set(0, -0.092, magZ);
    mag.rotation.x = isBullpup ? -0.14 : -0.08;
    root.add(mag);
  } else if (isBarrett) {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.145, 0.105), darkMetalMat);
    mag.position.set(0, -0.095, -0.065);
    mag.rotation.x = -0.06;
    root.add(mag);
  } else {
    const magH = id === 'm24' || id === 'awm' ? 0.075 : isSniper ? 0.11 : 0.165;
    const magMat = isFde ? fdeMat : darkMetalMat;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.034, magH, 0.064), magMat);
    mag.position.set(0, -0.04 - magH * 0.4, magZ);
    mag.rotation.x = isBullpup ? -0.12 : -0.08;
    root.add(mag);
  }

  // 8. Reciprocating Charging Handle / Bolt
  const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.015, 0.052), steelMat);
  boltMesh.position.set(0.032, 0.028, -0.03);
  root.add(boltMesh);

  // 9. Calibrated Front Sight + Optic / Scope aligned cleanly with adsOffset
  const frontPostZ = -0.155 - barrelLen * 0.85;
  if (!isSniper) {
    const frontWingL = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.024, 0.012), darkMetalMat);
    frontWingL.position.set(-0.009, 0.071, frontPostZ);
    const frontWingR = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.024, 0.012), darkMetalMat);
    frontWingR.position.set(0.009, 0.071, frontPostZ);
    const frontBase = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.016, 0.014), darkMetalMat);
    frontBase.position.set(0, 0.054, frontPostZ);
    const frontPin = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.012, 0.006), darkMetalMat);
    frontPin.position.set(0, 0.068, frontPostZ);
    const frontTip = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.004, 0.006), sightGlowMat);
    frontTip.position.set(0, 0.078, frontPostZ);
    root.add(frontBase, frontWingL, frontWingR, frontPin, frontTip);
  }

  if (isSniper) {
    const scopeBodyMat = isFde ? fdeMat : isOlive ? oliveMat : darkMetalMat;
    const scopeScale = isBarrett ? 1.18 : id === 'awm' || id === 'm24' ? 1.08 : 1.0;
    const scopeY = isBarrett ? 0.096 : 0.094;
    addPrecisionScopeMesh(root, scopeBodyMat, steelMat, scopeY, scopeScale);
  } else if (id === 'carbine' || id === 'scar_l') {
    addHoloReflexSight(root, darkMetalMat, 0.092, '#ef4444', 'eotech');
  } else if (id === 'hk416' || id === 'aug') {
    addHoloReflexSight(root, isOlive ? oliveMat : darkMetalMat, id === 'aug' ? 0.094 : 0.092, '#84cc16', 'acog');
  } else if (id === 'ak74m' || id === 'galil' || id === 'sg552') {
    addHoloReflexSight(root, darkMetalMat, 0.092, '#f97316', 'dot');
  } else if (id === 'famas') {
    addHoloReflexSight(root, polymerMat, 0.104, '#ef4444', 'dot');
  } else {
    // Precision U-Notch Tritium Iron Sights (AK-47, FN FAL) at y = 0.078
    const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.011, 0.022), darkMetalMat);
    rearBlock.position.set(0, 0.066, -0.085);
    const rearL = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.013, 0.016), darkMetalMat);
    rearL.position.set(-0.0092, 0.076, -0.085);
    const rearR = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.013, 0.016), darkMetalMat);
    rearR.position.set(0.0092, 0.076, -0.085);
    const rearDotMat = new THREE.MeshBasicMaterial({ color: '#84cc16' });
    const rearDotL = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 8), rearDotMat);
    rearDotL.position.set(-0.0068, 0.078, -0.076);
    const rearDotR = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 8), rearDotMat);
    rearDotR.position.set(0.0068, 0.078, -0.076);
    root.add(rearBlock, rearL, rearR, rearDotL, rearDotR);
  }

  // 10. Muzzle Anchor & Muzzle Flash
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.026, -0.165 - barrelLen);
  root.add(muzzleAnchor);

  const flashGeo = new THREE.ConeGeometry(isVss ? 0.024 : isBarrett ? 0.11 : 0.065, isVss ? 0.07 : isBarrett ? 0.26 : 0.19, 6);
  flashGeo.rotateX(-Math.PI / 2);
  const muzzleFlash = new THREE.Mesh(
    flashGeo,
    new THREE.MeshBasicMaterial({
      color: isVss ? '#fde68a' : '#ffcf66',
      transparent: true,
      opacity: isVss ? 0.35 : 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  muzzleFlash.position.copy(muzzleAnchor.position);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  return { root, muzzleAnchor, muzzleFlash, boltMesh };
}
