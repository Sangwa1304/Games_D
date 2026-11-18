import * as THREE from 'three';
import {
  hasLineOfSight,
  resolveHorizontalCollisions,
  supportHeightAt,
} from './physics';
import {
  getSurfaceTypeAt,
  groundHeightAt,
  groundNormalAt,
  WATER_LEVEL,
} from './terrain';
import { ProceduralTexturePack } from './textures';
import {
  CommsCategory,
  MALE_VOICE_PROFILES,
  VOICE_PROFILE_ORDER,
  VoiceProfileId,
} from './comms';
import { getRankDef, TacticalOrderId } from './ranks';
import {
  ColliderBox,
  ColliderCylinder,
  Faction,
  PlayerStance,
  SectorState,
  SmokeCloud,
  SurfaceType,
  WeaponId,
} from './types';
import { isFlameWeapon, isRocketWeapon, isSniperWeapon } from './weapons';

export interface SoldierEntity {
  id: number;
  name: string;
  faction: Faction;
  weaponId: WeaponId;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headMesh: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  armsGroup: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  deathTimer: number;
  fallAngle: number;
  fallAxis: THREE.Vector3;
  aiState: 'advance' | 'combat' | 'cover' | 'flank';
  targetSectorIdx: number;
  routeWaypoints: THREE.Vector3[];
  waypointIdx: number;
  fireCooldown: number;
  burstRemaining: number;
  burstPauseTimer: number;
  decisionTimer: number;
  stridePhase: number;
  stance: PlayerStance;
  isCrouching: boolean;
  flinchTimer: number;
  muzzleFlashTimer: number;
  coverPos: THREE.Vector3 | null;
  diveTimer: number;
  proneTimer: number;
  diveDir: THREE.Vector3;
  diveCooldown: number;
  calloutCooldown: number;
  hadEnemyLastTick: boolean;
  woundPhase: number;
  bleedTimer: number;
  rankLevel: number;
  rankTitle: string;
  tacticalOrder: TacticalOrderId | null;
  orderTarget: THREE.Vector3 | null;
  orderTimer: number;
  commandCooldown: number;
  voiceProfile: VoiceProfileId;
  stepParticleCooldown: number;
  iffSprite: THREE.Sprite;
  iffWarnActive: boolean;
  burnTimer: number;
  burnTickAccum: number;
  burnAttackerName: string;
  burnAttackerFaction: Faction;
  burnWeaponLabel: string;
  burnFxGroup: THREE.Group;
}

const ARMY_SURNAMES = [
  'Kabongo',
  'Mukendi',
  'Ilunga',
  'Kasongo',
  'Tshisekedi',
  'Mbuyi',
  'Kalala',
  'Ngoy',
  'Lukusa',
];

const REBEL_SURNAMES = [
  'Makasi',
  'Bisimwa',
  'Safari',
  'Habimana',
  'Ndayizeye',
  'Bahati',
  'Mugisha',
  'Kambale',
  'Paluku',
];

let _iffNormalTex: THREE.CanvasTexture | null = null;
let _iffWarnTex: THREE.CanvasTexture | null = null;

export function getAllyIffTexture(warn: boolean): THREE.CanvasTexture {
  if (warn && _iffWarnTex) return _iffWarnTex;
  if (!warn && _iffNormalTex) return _iffNormalTex;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    if (!warn) {
      // Discreet immersive overhead tactical chevron + micro diamond
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.92)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(36, 54);
      ctx.lineTo(64, 82);
      ctx.lineTo(92, 54);
      ctx.stroke();

      ctx.fillStyle = 'rgba(167, 243, 208, 0.95)';
      ctx.beginPath();
      ctx.moveTo(64, 24);
      ctx.lineTo(75, 38);
      ctx.lineTo(64, 52);
      ctx.lineTo(53, 38);
      ctx.closePath();
      ctx.fill();
    } else {
      // Real-time Friendly Fire active-aim prohibition icon
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(20, 28, 24, 0.78)';
      ctx.beginPath();
      ctx.arc(64, 60, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(64, 60, 38, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(46, 42);
      ctx.lineTo(82, 78);
      ctx.moveTo(82, 42);
      ctx.lineTo(46, 78);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (warn) _iffWarnTex = tex;
  else _iffNormalTex = tex;
  return tex;
}

export function createSoldierMesh(
  faction: Faction,
  tex: ProceduralTexturePack,
  rankLevel = 1,
  weaponId: WeaponId = 'ak47'
): {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headMesh: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  armsGroup: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  burnFxGroup: THREE.Group;
} {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const uniformMat = new THREE.MeshStandardMaterial({
    map: faction === 'army' ? tex.camoArmy : tex.camoRebel,
    bumpMap: tex.tacticalFabric,
    bumpScale: 0.025,
    roughness: 0.84,
    metalness: 0.04,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    bumpMap: tex.tacticalFabric,
    bumpScale: 0.03,
    color: faction === 'army' ? '#2c3624' : '#4a3b2a',
    roughness: 0.76,
    metalness: 0.1,
  });
  const pouchMat = new THREE.MeshStandardMaterial({
    color: faction === 'army' ? '#232b1d' : '#3a2e20',
    roughness: 0.82,
    metalness: 0.08,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#4e3324',
    roughness: 0.68,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#191815',
    roughness: 0.8,
    metalness: 0.14,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    map: tex.brushedSteel,
    color: '#2c3035',
    roughness: 0.34,
    metalness: 0.84,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.walnutWood,
    roughness: 0.62,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: faction === 'army' ? '#2563eb' : '#b91c1c',
    roughness: 0.58,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: '#1b262c',
    roughness: 0.15,
    metalness: 0.35,
    clearcoat: 0.85,
  });

  // Contact shadow at ground pivot
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({
      map: tex.contactShadow,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  root.add(shadowPlane);

  // 1-2. Articulated Tapered Legs + Knee Pads + Cargo Pockets + Combat Boots
  const makeLeg = (xOff: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOff, 0.82, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.42, 10), uniformMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    legPivot.add(thigh);

    // Side cargo pocket / holster on thigh
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.11), pouchMat);
    pocket.position.set(xOff < 0 ? -0.085 : 0.085, -0.24, 0.01);
    legPivot.add(pocket);

    // Armored knee pad
    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.06), bootMat);
    kneePad.position.set(0, -0.41, 0.065);
    legPivot.add(kneePad);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.064, 0.34, 10), uniformMat);
    shin.position.y = -0.57;
    shin.castShadow = true;
    legPivot.add(shin);

    // Boot ankle shaft + toe box + textured sole
    const bootUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.076, 0.14, 10), bootMat);
    bootUpper.position.set(0, -0.71, 0);
    legPivot.add(bootUpper);

    const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.25), bootMat);
    bootFoot.position.set(0, -0.77, 0.045);
    bootFoot.castShadow = true;
    legPivot.add(bootFoot);

    return legPivot;
  };
  const leftLeg = makeLeg(-0.115);
  const rightLeg = makeLeg(0.115);
  bodyPivot.add(leftLeg, rightLeg);

  // 3. Pelvis + Tactical Utility Belt
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.18, 0.16, 12), uniformMat);
  pelvis.scale.set(1.15, 1, 0.72);
  pelvis.position.y = 0.85;
  bodyPivot.add(pelvis);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 12), bootMat);
  belt.scale.set(1.16, 1, 0.76);
  belt.position.y = 0.91;
  bodyPivot.add(belt);

  // 4. Torso + Contoured Plate Carrier + 3D Triple Magazine Pouches + Radio Antenna
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.52, 12), uniformMat);
  torso.scale.set(1.1, 1, 0.68);
  torso.position.y = 1.15;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  const plateCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.27), vestMat);
  plateCarrier.position.y = 1.17;
  plateCarrier.castShadow = true;
  bodyPivot.add(plateCarrier);

  // Triple front chest mag pouches
  for (let m = -1; m <= 1; m++) {
    const mp = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.14, 0.055), pouchMat);
    mp.position.set(m * 0.105, 1.07, 0.155);
    mp.castShadow = true;
    bodyPivot.add(mp);
  }

  // Tactical field backpack + radio unit + whip antenna
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.15), pouchMat);
  pack.position.set(0, 1.17, -0.19);
  pack.castShadow = true;
  bodyPivot.add(pack);

  const radioBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), bootMat);
  radioBox.position.set(-0.12, 1.29, -0.22);
  bodyPivot.add(radioBox);

  const radioAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.42, 6), steelMat);
  radioAntenna.position.set(-0.14, 1.53, -0.22);
  radioAntenna.rotation.x = -0.08;
  bodyPivot.add(radioAntenna);

  // 5. Faction identification armband / scarf + Gold/Silver Rank Chevrons
  const collarScarf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.07, 12), accentMat);
  collarScarf.position.y = 1.41;
  bodyPivot.add(collarScarf);

  const armband = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.065, 0.28), accentMat);
  armband.position.y = 1.32;
  bodyPivot.add(armband);

  const chevronCount = Math.min(4, Math.max(1, rankLevel));
  const chevronMat = new THREE.MeshStandardMaterial({
    color: rankLevel >= 4 ? '#f59e0b' : '#d4d4d8',
    roughness: 0.35,
    metalness: 0.8,
  });
  for (let c = 0; c < chevronCount; c++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.08), chevronMat);
    stripe.position.set(0.22, 1.36 + c * 0.026, 0);
    bodyPivot.add(stripe);
  }

  // 6. Neck + Sculpted Head + Jaw/Nose + Tactical Helmet/Goggles (Army) or Bush Hat/Scarf (Rebels)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, 0.1, 10), skinMat);
  neck.position.set(0, 1.45, 0);
  bodyPivot.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), skinMat);
  cranium.scale.set(0.92, 1.06, 0.96);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.14), skinMat);
  jaw.position.set(0, -0.05, 0.025);
  headGroup.add(jaw);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.04), skinMat);
  nose.position.set(0, -0.01, 0.125);
  headGroup.add(nose);

  if (faction === 'army') {
    const helmetMat = new THREE.MeshStandardMaterial({
      color: '#344128',
      roughness: 0.58,
      metalness: 0.2,
    });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      helmetMat
    );
    helmet.position.y = 0.025;
    helmet.castShadow = true;
    headGroup.add(helmet);

    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.03), steelMat);
    nvgMount.position.set(0, 0.09, 0.14);
    headGroup.add(nvgMount);

    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.046, 0.045), visorMat);
    goggles.position.set(0, 0.025, 0.122);
    headGroup.add(goggles);
  } else {
    const faceWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.128, 0.08, 12), accentMat);
    faceWrap.position.set(0, -0.055, 0.015);
    headGroup.add(faceWrap);

    const bandana = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.055, 14), accentMat);
    bandana.position.y = 0.058;
    headGroup.add(bandana);

    const bushHatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.022, 16), uniformMat);
    bushHatBrim.position.y = 0.095;
    bushHatBrim.rotation.x = -0.1;
    headGroup.add(bushHatBrim);

    const bushHatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.085, 14), uniformMat);
    bushHatCrown.position.y = 0.14;
    headGroup.add(bushHatCrown);
  }
  bodyPivot.add(headGroup);

  // 7-9. Shoulder Pads, Tapered Arms, Gloved Hands & Multi-part Rifle
  const armsGroup = new THREE.Group();
  armsGroup.position.set(0, 1.29, 0.06);

  const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), uniformMat);
  rShoulder.position.set(0.24, 0.01, 0.01);
  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.4, 10), uniformMat);
  rUpperArm.rotation.x = Math.PI / 2 + 0.18;
  rUpperArm.position.set(0.23, -0.05, 0.18);
  rUpperArm.castShadow = true;
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.09), bootMat);
  rGlove.position.set(0.18, -0.07, 0.36);
  armsGroup.add(rShoulder, rUpperArm, rGlove);

  const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), uniformMat);
  lShoulder.position.set(-0.24, 0.01, 0.01);
  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.44, 10), uniformMat);
  lUpperArm.rotation.order = 'YXZ';
  lUpperArm.rotation.y = 0.46;
  lUpperArm.rotation.x = Math.PI / 2 + 0.14;
  lUpperArm.position.set(-0.18, -0.07, 0.24);
  lUpperArm.castShadow = true;
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.09), bootMat);
  lGlove.position.set(0.09, -0.06, 0.44);
  armsGroup.add(lShoulder, lUpperArm, lGlove);

  // Multi-part Realistic Weapon Silhouette matched to WeaponId
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0.14, -0.04, 0.36);

  const isRkt = isRocketWeapon(weaponId);
  const isFlm = isFlameWeapon(weaponId);
  const isSnp = isSniperWeapon(weaponId);
  const isBullpup = weaponId === 'famas' || weaponId === 'aug';
  const isFde = weaponId === 'scar_l' || weaponId === 'mk20';

  const wpnMat = isFde
    ? new THREE.MeshStandardMaterial({ map: tex.weaponFdeTan, roughness: 0.58, metalness: 0.2 })
    : isFlm || isRkt || weaponId === 'aug' || weaponId === 'awm'
    ? new THREE.MeshStandardMaterial({ map: tex.weaponOliveMetal, roughness: 0.6, metalness: 0.25 })
    : steelMat;

  if (isRkt) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.92, 12), wpnMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.08, 0.14);
    gunGroup.add(tube);
    if (weaponId === 'bazooka') {
      const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.24, 10), wpnMat);
      warhead.rotation.x = Math.PI / 2;
      warhead.position.set(0, 0.08, 0.68);
      gunGroup.add(warhead);
    }
  } else if (isFlm) {
    const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, 0.32), steelMat);
    gunGroup.add(manifold);
    const nozzlePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.56, 10), steelMat);
    nozzlePipe.rotation.x = Math.PI / 2;
    nozzlePipe.position.set(0, 0.015, 0.38);
    gunGroup.add(nozzlePipe);
    const fuelTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.38, 12),
      new THREE.MeshStandardMaterial({ map: tex.weaponHazardYellow, roughness: 0.5, metalness: 0.35 })
    );
    fuelTank.position.set(-0.14, 0.12, -0.58);
    bodyPivot.add(fuelTank);
  } else {
    const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.068, 0.34), wpnMat);
    gunReceiver.castShadow = true;
    gunGroup.add(gunReceiver);

    const gunHandguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.052, isSnp ? 0.28 : 0.22),
      isFde ? wpnMat : faction === 'army' ? bootMat : woodMat
    );
    gunHandguard.position.set(0, 0.008, isBullpup ? 0.18 : 0.24);
    gunGroup.add(gunHandguard);

    const barrelLen = weaponId === 'barrett' ? 0.7 : isSnp ? 0.58 : 0.44;
    const gunBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.014, barrelLen, 10),
      steelMat
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.018, 0.2 + barrelLen * 0.45);
    gunGroup.add(gunBarrel);

    if (isSnp) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.24, 12), steelMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.068, 0.04);
      gunGroup.add(scope);
    }

    if (!isBullpup) {
      const gunStock = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.08, 0.22),
        isFde ? wpnMat : faction === 'army' ? bootMat : woodMat
      );
      gunStock.position.set(0, -0.015, -0.25);
      gunGroup.add(gunStock);
    }

    const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.16, 0.058), steelMat);
    gunMag.position.set(0, -0.1, isBullpup ? -0.08 : 0.06);
    gunMag.rotation.x = 0.26;
    gunGroup.add(gunMag);
  }

  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(isFlm ? 0.13 : 0.09, isFlm ? 0.32 : 0.24, 6),
    new THREE.MeshBasicMaterial({
      color: isFlm ? '#ff7b1c' : '#ffca55',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0, 0.018, isSnp ? 0.85 : 0.7);
  muzzleFlash.visible = false;
  gunGroup.add(muzzleFlash);

  armsGroup.add(gunGroup);
  bodyPivot.add(armsGroup);

  // 10. Animated 3D Body Burn Flames Group (activated when struck by flamethrower!)
  const burnFxGroup = new THREE.Group();
  burnFxGroup.visible = false;
  const flameSpriteMat = new THREE.SpriteMaterial({
    map: tex.fireFlameSprite,
    color: '#ffedd5',
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameAnchors: Array<[number, number, number, number]> = [
    [0, 1.15, 0.05, 0.85],
    [-0.16, 1.28, -0.04, 0.65],
    [0.16, 1.05, 0.08, 0.68],
    [0, 1.52, 0.02, 0.6],
  ];
  for (const [fx, fy, fz, fs] of flameAnchors) {
    const sp = new THREE.Sprite(flameSpriteMat.clone());
    sp.position.set(fx, fy, fz);
    sp.scale.set(fs, fs * 1.35, 1);
    burnFxGroup.add(sp);
  }
  bodyPivot.add(burnFxGroup);

  return {
    root,
    bodyPivot,
    headMesh: headGroup,
    leftLeg,
    rightLeg,
    armsGroup,
    muzzleFlash,
    burnFxGroup,
  };
}

const _poseSlopeNormal = new THREE.Vector3();

/**
 * Raccorde proprement la posture du soldat (Debout, Accroupi, Allongé, Glissade, Plongeon)
 * avec la hauteur et la pente locale du terrain pour une mise à couvert réaliste.
 */
export function poseSoldierRig(
  rig: {
    bodyPivot: THREE.Group;
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    armsGroup: THREE.Object3D;
    headMesh?: THREE.Object3D;
  },
  params: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    stance: PlayerStance;
    isSliding?: boolean;
    isDiving?: boolean;
    diveArcProgress?: number; // 0..1 when airborne diving
    isSprinting?: boolean;
    moveSpeed?: number;
    stridePhase?: number;
    aimPitch?: number;
    muzzleKick?: boolean;
    isInjured?: boolean;
    woundPhase?: number;
    flinchFactor?: number;
    flinchSide?: number;
    combatAim?: boolean;
    dt: number;
  }
) {
  const {
    x,
    y,
    z,
    yaw,
    stance,
    isSliding = false,
    isDiving = false,
    diveArcProgress = 0,
    isSprinting = false,
    moveSpeed = 0,
    stridePhase = 0,
    aimPitch = 0,
    muzzleKick = false,
    isInjured = false,
    woundPhase = 0,
    flinchFactor = 0,
    flinchSide = 1,
    combatAim = true,
    dt,
  } = params;

  const lerpFast = Math.min(1, dt * 14);
  const lerpMed = Math.min(1, dt * 11);

  if (isDiving || stance === 'prone') {
    // Terrain slope conformity so stomach, elbows and boots align flush with ground & hills
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const ghC = groundHeightAt(x, z);
    const onTerrainFloor = Math.abs(y - ghC) < 0.45;
    let forwardSlope = 0;
    let sideRoll = 0;
    let contourOffset = 0;

    if (onTerrainFloor) {
      const ghFront = groundHeightAt(x + fwdX * 0.72, z + fwdZ * 0.72);
      const ghBack = groundHeightAt(x - fwdX * 0.72, z - fwdZ * 0.72);
      forwardSlope = THREE.MathUtils.clamp(Math.atan2(ghFront - ghBack, 1.44), -0.52, 0.52);
      groundNormalAt(x, z, _poseSlopeNormal);
      const sideDot = _poseSlopeNormal.x * Math.cos(yaw) - _poseSlopeNormal.z * Math.sin(yaw);
      sideRoll = THREE.MathUtils.clamp(-sideDot * 0.75, -0.35, 0.35);
      contourOffset = THREE.MathUtils.clamp(0.5 * (ghFront + ghBack) - ghC, -0.14, 0.14);
    }

    const arcBoost = isDiving ? Math.sin(THREE.MathUtils.clamp(diveArcProgress, 0, 1) * Math.PI) * 0.38 : 0;
    const crawlAmt = moveSpeed > 0.25 && !isDiving ? Math.sin(stridePhase * 1.15) : 0;

    rig.bodyPivot.position.y = THREE.MathUtils.lerp(
      rig.bodyPivot.position.y,
      0.21 + contourOffset + arcBoost,
      lerpFast
    );
    rig.bodyPivot.position.z = THREE.MathUtils.lerp(rig.bodyPivot.position.z, -0.78, lerpFast);
    rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(
      rig.bodyPivot.rotation.x,
      1.44 - forwardSlope + (flinchFactor > 0 ? -0.1 * flinchFactor : 0),
      lerpFast
    );
    rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(
      rig.bodyPivot.rotation.z,
      sideRoll + crawlAmt * 0.045,
      lerpMed
    );

    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(
      rig.leftLeg.rotation.x,
      0.08 + crawlAmt * 0.22,
      lerpFast
    );
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(
      rig.rightLeg.rotation.x,
      -0.06 - crawlAmt * 0.22,
      lerpFast
    );
    rig.armsGroup.rotation.x = THREE.MathUtils.lerp(
      rig.armsGroup.rotation.x,
      -1.3 + forwardSlope * 0.7 + THREE.MathUtils.clamp(-aimPitch * 0.4, -0.35, 0.35) + (muzzleKick ? -0.09 : 0),
      lerpFast
    );
    rig.armsGroup.rotation.z = THREE.MathUtils.lerp(rig.armsGroup.rotation.z, 0, lerpMed);
    if (rig.headMesh) {
      rig.headMesh.rotation.x = THREE.MathUtils.lerp(rig.headMesh.rotation.x, -0.22, lerpMed);
      rig.headMesh.rotation.z = THREE.MathUtils.lerp(rig.headMesh.rotation.z, 0, lerpMed);
    }
    return;
  }

  if (isSliding) {
    rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, -0.44, lerpFast);
    rig.bodyPivot.position.z = THREE.MathUtils.lerp(rig.bodyPivot.position.z, -0.16, lerpFast);
    rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(rig.bodyPivot.rotation.x, -0.42, lerpFast);
    rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(rig.bodyPivot.rotation.z, -0.09, lerpFast);
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, -1.08, lerpFast);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, -0.82, lerpFast);
    rig.armsGroup.rotation.x = THREE.MathUtils.lerp(
      rig.armsGroup.rotation.x,
      0.34 + THREE.MathUtils.clamp(-aimPitch * 0.45, -0.4, 0.4),
      lerpFast
    );
    rig.armsGroup.rotation.z = THREE.MathUtils.lerp(rig.armsGroup.rotation.z, 0, lerpMed);
    return;
  }

  if (stance === 'crouch') {
    const stepOsc = moveSpeed > 0.2 ? Math.sin(stridePhase) * 0.28 : 0;
    const targetBodyX = 0.18 + (flinchFactor > 0 ? -0.22 * flinchFactor : 0);
    const targetBodyZ = flinchFactor > 0 ? flinchSide * 0.2 * flinchFactor : 0;

    rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, -0.34, lerpMed);
    rig.bodyPivot.position.z = THREE.MathUtils.lerp(rig.bodyPivot.position.z, -0.05, lerpMed);
    rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(rig.bodyPivot.rotation.x, targetBodyX, lerpMed);
    rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(rig.bodyPivot.rotation.z, targetBodyZ, lerpMed);
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, -0.58 + stepOsc, lerpFast);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, 0.42 - stepOsc, lerpFast);
    rig.armsGroup.rotation.x = THREE.MathUtils.lerp(
      rig.armsGroup.rotation.x,
      -0.16 +
        THREE.MathUtils.clamp(-aimPitch * 0.55, -0.5, 0.5) +
        (muzzleKick ? -0.12 : 0) +
        (flinchFactor > 0 ? -0.28 * flinchFactor : 0),
      lerpFast
    );
    rig.armsGroup.rotation.z = THREE.MathUtils.lerp(rig.armsGroup.rotation.z, isInjured ? 0.14 : 0, lerpMed);
    if (rig.headMesh) {
      rig.headMesh.rotation.x = THREE.MathUtils.lerp(rig.headMesh.rotation.x, -0.1, lerpMed);
      rig.headMesh.rotation.z = THREE.MathUtils.lerp(rig.headMesh.rotation.z, 0, lerpMed);
    }
    return;
  }

  // Stand posture (idle, walk, sprint, injury limp)
  const targetBodyX =
    (isSprinting ? 0.14 : 0) +
    (isInjured ? 0.22 : 0) +
    (flinchFactor > 0 ? -0.26 * flinchFactor : 0);
  const targetBodyZ =
    (isInjured
      ? 0.12 + (moveSpeed > 0.2 ? Math.sin(stridePhase) * 0.08 : Math.sin(woundPhase) * 0.03)
      : 0) + (flinchFactor > 0 ? flinchSide * 0.24 * flinchFactor : 0);
  const limpDip = isInjured && moveSpeed > 0.2 ? -Math.abs(Math.sin(stridePhase)) * 0.08 : 0;

  rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, limpDip, lerpMed);
  rig.bodyPivot.position.z = THREE.MathUtils.lerp(rig.bodyPivot.position.z, 0, lerpMed);
  rig.bodyPivot.rotation.x = THREE.MathUtils.lerp(rig.bodyPivot.rotation.x, targetBodyX, lerpMed);
  rig.bodyPivot.rotation.z = THREE.MathUtils.lerp(rig.bodyPivot.rotation.z, targetBodyZ, lerpMed);

  const legAmp = moveSpeed > 0.2 ? (isInjured ? 0.38 : 0.52) : 0;
  if (isInjured && moveSpeed > 0.2) {
    rig.leftLeg.rotation.x = Math.sin(stridePhase) * legAmp * 0.72;
    rig.rightLeg.rotation.x = -Math.sin(stridePhase - 0.55) * legAmp * 1.15;
  } else {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(
      rig.leftLeg.rotation.x,
      Math.sin(stridePhase) * legAmp,
      lerpFast
    );
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(
      rig.rightLeg.rotation.x,
      -Math.sin(stridePhase) * legAmp,
      lerpFast
    );
  }

  const targetArmX =
    (combatAim ? -0.05 : 0.14) +
    THREE.MathUtils.clamp(-aimPitch * 0.55, -0.5, 0.5) +
    (muzzleKick ? -0.14 : 0) +
    (isInjured ? 0.12 : 0) +
    (flinchFactor > 0 ? -0.34 * flinchFactor : 0);
  rig.armsGroup.rotation.x = THREE.MathUtils.lerp(rig.armsGroup.rotation.x, targetArmX, lerpFast);
  rig.armsGroup.rotation.z = THREE.MathUtils.lerp(rig.armsGroup.rotation.z, isInjured ? 0.16 : 0, lerpMed);

  if (rig.headMesh) {
    rig.headMesh.rotation.x = THREE.MathUtils.lerp(
      rig.headMesh.rotation.x,
      flinchFactor > 0 ? -0.35 * flinchFactor : isInjured ? 0.12 : 0,
      lerpFast
    );
    rig.headMesh.rotation.z = THREE.MathUtils.lerp(
      rig.headMesh.rotation.z,
      isInjured ? -0.11 : 0,
      lerpMed
    );
  }
}

export function pickRouteToTarget(
  from: THREE.Vector3,
  to: THREE.Vector3
): THREE.Vector3[] {
  // Check if crossing the river is needed (opposite signs of Z across river zone)
  const crossesRiver = (from.z > 12 && to.z < -12) || (from.z < -12 && to.z > 12);
  if (!crossesRiver) {
    return [to.clone()];
  }

  // Pick nearest of the 5 tactical crossings: West Bridge (-76), West Ford (-38), Central Bridge (0), East Ford (+38), East Pontoon (+78)
  const crossings = [-76, -38, 0, 38, 78];
  let bestX = 0;
  let bestCost = Infinity;
  for (const cx of crossings) {
    const isBridge = cx === -76 || cx === 0 || cx === 78;
    const cost = Math.abs(from.x - cx) + Math.abs(to.x - cx) + (isBridge ? -5 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      bestX = cx;
    }
  }

  const isBridge = bestX === -76 || bestX === 0 || bestX === 78;
  const riverZ = Math.sin(bestX * 0.036) * 8.5 + Math.cos(bestX * 0.082) * 2.6;
  const southEntry = new THREE.Vector3(bestX, groundHeightAt(bestX, riverZ + 16), riverZ + 16);
  const midCross = new THREE.Vector3(bestX, isBridge ? 1.42 : groundHeightAt(bestX, riverZ), riverZ);
  const northEntry = new THREE.Vector3(bestX, groundHeightAt(bestX, riverZ - 16), riverZ - 16);

  if (from.z > 0) {
    return [southEntry, midCross, northEntry, to.clone()];
  }
  return [northEntry, midCross, southEntry, to.clone()];
}

export function spawnSoldier(
  id: number,
  faction: Faction,
  spawnPos: THREE.Vector3,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  sectors: SectorState[]
): SoldierEntity {
  const rankCycle = [1, 2, 1, 3, 2, 4, 1, 2, 5];
  const rankLevel = rankCycle[id % rankCycle.length];
  const rankDef = getRankDef(faction, rankLevel);

  const surnames = faction === 'army' ? ARMY_SURNAMES : REBEL_SURNAMES;
  const weaponChoices: WeaponId[] =
    faction === 'army'
      ? ['carbine', 'hk416', 'scar_l', 'famas', 'aug', 'm24', 'awm', 'at4', 'flamethrower', 'bazooka']
      : ['ak47', 'ak74m', 'fnfal', 'galil', 'sg552', 'sniper', 'vss', 'barrett', 'bazooka', 'lpo50'];
  const weaponId = weaponChoices[id % weaponChoices.length];
  const parts = createSoldierMesh(faction, tex, rankLevel, weaponId);
  const iffMat = new THREE.SpriteMaterial({
    map: getAllyIffTexture(false),
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const iffSprite = new THREE.Sprite(iffMat);
  iffSprite.position.set(0, 2.02, 0);
  iffSprite.scale.set(0.36, 0.36, 1);
  iffSprite.visible = false;
  parts.root.add(iffSprite);
  parts.root.position.copy(spawnPos);
  scene.add(parts.root);

  const targetIdx = faction === 'army' ? 1 : 1; // Contest central bridge by default
  const targetPos = sectors[targetIdx].position.clone();
  targetPos.x += (Math.random() - 0.5) * 9;
  targetPos.z += (Math.random() - 0.5) * 9;

  const armyVoices: VoiceProfileId[] = ['mokonzi', 'sapologie', 'tonnerre', 'fufu'];
  const rebelVoices: VoiceProfileId[] = ['simba', 'boma', 'tonnerre', 'fufu'];
  const voicePool = faction === 'army' ? armyVoices : rebelVoices;
  const voiceProfile: VoiceProfileId =
    rankLevel >= 4
      ? faction === 'army'
        ? 'mokonzi'
        : 'simba'
      : voicePool[id % voicePool.length] || VOICE_PROFILE_ORDER[id % VOICE_PROFILE_ORDER.length];
  void MALE_VOICE_PROFILES[voiceProfile];

  return {
    id,
    name: `${rankDef.abbr} ${surnames[id % surnames.length]}`,
    faction,
    weaponId,
    root: parts.root,
    bodyPivot: parts.bodyPivot,
    headMesh: parts.headMesh,
    leftLeg: parts.leftLeg,
    rightLeg: parts.rightLeg,
    armsGroup: parts.armsGroup,
    muzzleFlash: parts.muzzleFlash,
    position: spawnPos.clone(),
    velocity: new THREE.Vector3(),
    yaw: faction === 'army' ? Math.PI : 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    deathTimer: 0,
    fallAngle: 0,
    fallAxis: new THREE.Vector3(1, 0, 0),
    aiState: 'advance',
    targetSectorIdx: targetIdx,
    routeWaypoints: pickRouteToTarget(spawnPos, targetPos),
    waypointIdx: 0,
    fireCooldown: 0.4 + Math.random() * 0.8,
    burstRemaining: 0,
    burstPauseTimer: 0,
    decisionTimer: Math.random() * 1.2,
    stridePhase: Math.random() * Math.PI * 2,
    stance: 'stand',
    isCrouching: false,
    flinchTimer: 0,
    muzzleFlashTimer: 0,
    coverPos: null,
    diveTimer: 0,
    proneTimer: 0,
    diveDir: new THREE.Vector3(0, 0, 1),
    diveCooldown: 0,
    calloutCooldown: 1.5 + Math.random() * 4.0,
    hadEnemyLastTick: false,
    woundPhase: Math.random() * Math.PI * 2,
    bleedTimer: 0.4,
    rankLevel,
    rankTitle: rankDef.title,
    tacticalOrder: null,
    orderTarget: null,
    orderTimer: 0,
    commandCooldown: 4 + Math.random() * 5,
    voiceProfile,
    stepParticleCooldown: Math.random() * 0.3,
    iffSprite,
    iffWarnActive: false,
    burnTimer: 0,
    burnTickAccum: 0,
    burnAttackerName: 'Lance-Flamme',
    burnAttackerFaction: faction === 'army' ? 'rebels' : 'army',
    burnWeaponLabel: 'M2A1 Flamme',
    burnFxGroup: parts.burnFxGroup,
  };
}

export function igniteSoldier(
  s: SoldierEntity,
  duration: number,
  attackerName: string,
  attackerFaction: Faction,
  weaponLabel: string
) {
  if (!s.alive) return;
  s.burnTimer = Math.max(s.burnTimer, duration);
  s.burnAttackerName = attackerName;
  s.burnAttackerFaction = attackerFaction;
  s.burnWeaponLabel = weaponLabel;
  s.burnFxGroup.visible = true;
}

export function triggerSoldierDive(
  s: SoldierEntity,
  threatPos: THREE.Vector3
): boolean {
  if (!s.alive || s.diveTimer > 0 || s.diveCooldown > 0) return false;

  s.diveTimer = 0.48;
  s.proneTimer = 2.4 + Math.random() * 1.4;
  s.diveCooldown = 5.2;
  s.stance = 'prone';
  s.isCrouching = false;

  // Dive away from the grenade / threat with slight lateral spread
  s.diveDir.subVectors(s.position, threatPos);
  s.diveDir.y = 0;
  if (s.diveDir.lengthSq() < 0.05) {
    s.diveDir.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
  } else {
    s.diveDir.normalize();
  }
  const lateralJitter = (Math.random() - 0.5) * 0.7;
  const rx = -s.diveDir.z;
  const rz = s.diveDir.x;
  s.diveDir.x += rx * lateralJitter;
  s.diveDir.z += rz * lateralJitter;
  s.diveDir.normalize();
  return true;
}

const _aiToTarget = new THREE.Vector3();
const _aiAim = new THREE.Vector3();
const _aiEye = new THREE.Vector3();
const _enemyEye = new THREE.Vector3();

function isSegmentBlockedBySmoke(
  a: THREE.Vector3,
  b: THREE.Vector3,
  smokes: SmokeCloud[]
): boolean {
  if (smokes.length === 0) return false;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const lenSq = abx * abx + aby * aby + abz * abz;

  for (let i = 0; i < smokes.length; i++) {
    const sm = smokes[i];
    const age = sm.maxDuration - sm.remaining;
    const buildFactor = age < 0.8 ? age / 0.8 : 1.0;
    const fadeFactor = sm.remaining < 2.2 ? sm.remaining / 2.2 : 1.0;
    const effR = sm.radius * Math.min(buildFactor, fadeFactor);
    if (effR < 1.8) continue;

    const sx = sm.x;
    const sy = sm.y + 1.5;
    const sz = sm.z;
    let t = 0;
    if (lenSq > 1e-6) {
      t = ((sx - a.x) * abx + (sy - a.y) * aby + (sz - a.z) * abz) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const cz = a.z + abz * t;
    const dx = sx - cx;
    const dy = (sy - cy) * 0.65;
    const dz = sz - cz;
    if (dx * dx + dy * dy + dz * dz < effR * effR) {
      return true;
    }
  }
  return false;
}

export function updateSoldierAI(
  s: SoldierEntity,
  allSoldiers: SoldierEntity[],
  playerPos: THREE.Vector3,
  playerAlive: boolean,
  playerFaction: Faction,
  sectors: SectorState[],
  coverPoints: THREE.Vector3[],
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[],
  activeSmokes: SmokeCloud[],
  dt: number,
  onAiFire: (soldier: SoldierEntity, muzzlePos: THREE.Vector3, aimDir: THREE.Vector3) => void,
  onCallout?: (soldier: SoldierEntity, category: CommsCategory, urgent: boolean) => void,
  onAiOrderIssued?: (commander: SoldierEntity, order: TacticalOrderId) => void,
  onSoldierStep?: (soldier: SoldierEntity, surface: SurfaceType) => void
) {
  if (!s.alive) {
    s.tacticalOrder = null;
    s.deathTimer += dt;
    s.fallAngle = Math.min(Math.PI / 2, s.fallAngle + dt * 6.5);
    s.bodyPivot.rotation.set(s.fallAxis.x * s.fallAngle, 0, s.fallAxis.z * s.fallAngle);
    s.bodyPivot.position.y = Math.max(-0.25, -Math.sin(s.fallAngle) * 0.25);
    s.muzzleFlash.visible = false;
    if (s.burnTimer > 0) {
      s.burnTimer = Math.max(0, s.burnTimer - dt * 1.3);
      s.burnFxGroup.visible = s.burnTimer > 0.05;
      if (s.burnFxGroup.visible) {
        for (let i = 0; i < s.burnFxGroup.children.length; i++) {
          const sp = s.burnFxGroup.children[i] as THREE.Sprite;
          const flick = 0.6 + Math.sin(performance.now() * 0.02 + i * 1.9) * 0.28;
          sp.scale.setScalar(flick * Math.min(1, s.burnTimer));
        }
      }
    } else {
      s.burnFxGroup.visible = false;
    }
    return;
  }

  // Active 3D burn flame flicker animation on living burning soldier
  if (s.burnTimer > 0) {
    s.burnFxGroup.visible = true;
    const nowT = performance.now() * 0.022;
    for (let i = 0; i < s.burnFxGroup.children.length; i++) {
      const sp = s.burnFxGroup.children[i] as THREE.Sprite;
      const baseScale = i === 0 ? 0.92 : 0.68;
      const flick = baseScale * (0.82 + Math.sin(nowT + i * 2.1) * 0.26);
      sp.scale.set(flick, flick * 1.45, 1);
      sp.material.opacity = Math.min(0.95, 0.45 + s.burnTimer * 0.25);
    }
  } else {
    s.burnFxGroup.visible = false;
  }

  if (s.muzzleFlashTimer > 0) {
    s.muzzleFlashTimer -= dt;
    if (s.muzzleFlashTimer <= 0) s.muzzleFlash.visible = false;
  }
  if (s.flinchTimer > 0) s.flinchTimer -= dt;
  if (s.fireCooldown > 0) s.fireCooldown -= dt;
  if (s.burstPauseTimer > 0) s.burstPauseTimer -= dt;
  if (s.diveCooldown > 0) s.diveCooldown -= dt;
  if (s.calloutCooldown > 0) s.calloutCooldown -= dt;
  if (s.commandCooldown > 0) s.commandCooldown -= dt;
  if (s.orderTimer > 0) {
    s.orderTimer -= dt;
    if (s.orderTimer <= 0) {
      s.tacticalOrder = null;
      s.orderTarget = null;
    }
  }

  // Handle athletic dive-to-cover lunge
  if (s.diveTimer > 0) {
    s.diveTimer = Math.max(0, s.diveTimer - dt);
    const diveSpeed = 7.6;
    s.position.x += s.diveDir.x * diveSpeed * dt;
    s.position.z += s.diveDir.z * diveSpeed * dt;
    resolveHorizontalCollisions(s.position, 0.42, 0.75, boxes, cylinders);

    const targetY = supportHeightAt(s.position.x, s.position.y, s.position.z, boxes);
    s.position.y = THREE.MathUtils.lerp(s.position.y, targetY, Math.min(1, dt * 16));
    s.root.position.copy(s.position);

    const diveYaw = Math.atan2(s.diveDir.x, s.diveDir.z);
    let dYaw = diveYaw - s.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    s.yaw += dYaw * Math.min(1, dt * 16);
    s.root.rotation.y = s.yaw;

    const p = 1 - s.diveTimer / 0.48;
    poseSoldierRig(s, {
      x: s.position.x,
      y: s.position.y,
      z: s.position.z,
      yaw: s.yaw,
      stance: 'prone',
      isDiving: true,
      diveArcProgress: p,
      dt,
    });
    s.iffSprite.position.y = THREE.MathUtils.lerp(s.iffSprite.position.y, 0.95, Math.min(1, dt * 12));
    return;
  }

  if (s.proneTimer > 0) {
    s.proneTimer = Math.max(0, s.proneTimer - dt);
    if (s.proneTimer <= 0 && s.stance === 'prone' && s.aiState === 'advance') {
      s.stance = 'stand';
    }
  }
  const isProne = s.stance === 'prone' || s.proneTimer > 0;
  s.isCrouching = s.stance === 'crouch';

  _aiEye.set(
    s.position.x,
    s.position.y + (isProne ? 0.4 : s.stance === 'crouch' ? 0.98 : 1.5),
    s.position.z
  );

  // Find nearest visible enemy (either AI or Player)
  let bestEnemyPos: THREE.Vector3 | null = null;
  let bestDistSq = 72 * 72;

  if (playerAlive && s.faction !== playerFaction) {
    const dSq = s.position.distanceToSquared(playerPos);
    if (dSq < bestDistSq) {
      _enemyEye.set(playerPos.x, playerPos.y + 1.45, playerPos.z);
      if (
        !isSegmentBlockedBySmoke(_aiEye, _enemyEye, activeSmokes) &&
        hasLineOfSight(_aiEye, _enemyEye, boxes, cylinders)
      ) {
        bestDistSq = dSq;
        bestEnemyPos = _enemyEye.clone();
      }
    }
  }

  for (let i = 0; i < allSoldiers.length; i++) {
    const other = allSoldiers[i];
    if (!other.alive || other.faction === s.faction) continue;
    const dSq = s.position.distanceToSquared(other.position);
    if (dSq < bestDistSq) {
      _enemyEye.set(other.position.x, other.position.y + 1.4, other.position.z);
      if (
        !isSegmentBlockedBySmoke(_aiEye, _enemyEye, activeSmokes) &&
        hasLineOfSight(_aiEye, _enemyEye, boxes, cylinders)
      ) {
        bestDistSq = dSq;
        bestEnemyPos = _enemyEye.clone();
      }
    }
  }

  // Periodic tactical decision
  s.decisionTimer -= dt;
  if (s.decisionTimer <= 0) {
    s.decisionTimer = 1.6 + Math.random() * 1.4;

    if (!bestEnemyPos) {
      // Pick an unowned or contested sector to push
      const candidates = sectors
        .map((sec, idx) => ({ sec, idx }))
        .filter(({ sec }) => sec.owner !== s.faction);
      const chosen =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)].idx
          : 1;
      if (chosen !== s.targetSectorIdx || s.waypointIdx >= s.routeWaypoints.length) {
        s.targetSectorIdx = chosen;
        const dest = sectors[chosen].position.clone();
        dest.x += (Math.random() - 0.5) * 11;
        dest.z += (Math.random() - 0.5) * 11;
        s.routeWaypoints = pickRouteToTarget(s.position, dest);
        s.waypointIdx = 0;
      }
      s.stance = 'stand';
      s.isCrouching = false;
      s.aiState = 'advance';
    } else {
      // In combat: separate Debout, Accroupi, and Allongé for cover!
      s.aiState = 'combat';
      const eDistSq = bestEnemyPos.distanceToSquared(s.position);
      const roll = Math.random();
      if (s.hp < 52 || (isSniperWeapon(s.weaponId) && eDistSq > 26 * 26 && roll < 0.65)) {
        s.stance = roll < 0.65 ? 'prone' : 'crouch';
        if (s.stance === 'prone') s.proneTimer = Math.max(s.proneTimer, 2.2);
      } else if (eDistSq > 16 * 16 && roll < 0.22) {
        s.stance = 'prone';
        s.proneTimer = Math.max(s.proneTimer, 1.8);
      } else if (roll < 0.58) {
        s.stance = 'crouch';
      } else {
        s.stance = 'stand';
      }
      s.isCrouching = s.stance === 'crouch';

      if (s.hp < 55) {
        let nearestCover: THREE.Vector3 | null = null;
        let cDist = 18 * 18;
        for (const cp of coverPoints) {
          const d = s.position.distanceToSquared(cp);
          if (d < cDist) {
            cDist = d;
            nearestCover = cp;
          }
        }
        if (nearestCover) {
          s.coverPos = nearestCover;
          s.aiState = 'cover';
        }
      }
    }
  }

  // Contextual soldier conversations & war cries (Lingala / Swahili)
  const hasEnemy = bestEnemyPos !== null;
  if (onCallout && s.calloutCooldown <= 0) {
    if (hasEnemy && !s.hadEnemyLastTick) {
      onCallout(s, 'contact', false);
      s.calloutCooldown = 6.5 + Math.random() * 6.0;
    } else if (hasEnemy && (s.flinchTimer > 0 || s.hp < 55) && Math.random() < 0.45) {
      onCallout(s, 'underFire', false);
      s.calloutCooldown = 7.0 + Math.random() * 6.5;
    } else if (!hasEnemy) {
      let hasFriendlyNearby = false;
      for (let i = 0; i < allSoldiers.length; i++) {
        const other = allSoldiers[i];
        if (other !== s && other.alive && other.faction === s.faction && s.position.distanceToSquared(other.position) < 19 * 19) {
          hasFriendlyNearby = true;
          break;
        }
      }
      if (hasFriendlyNearby && Math.random() < 0.55) {
        onCallout(s, Math.random() < 0.52 ? 'chat' : 'advance', false);
      } else {
        onCallout(s, 'advance', false);
      }
      s.calloutCooldown = 7.5 + Math.random() * 7.5;
    }
  }
  s.hadEnemyLastTick = hasEnemy;

  // Senior AI Commander autonomous orders to lower-ranked squadmates
  if (s.rankLevel >= 4 && s.commandCooldown <= 0 && !s.tacticalOrder) {
    let commandedAny = false;
    const autoOrder: TacticalOrderId = bestEnemyPos
      ? Math.random() < 0.55
        ? 'suppress'
        : 'assault'
      : 'assault';
    const baseDest = bestEnemyPos
      ? bestEnemyPos.clone()
      : sectors[s.targetSectorIdx].position.clone();
    for (let i = 0; i < allSoldiers.length; i++) {
      const sub = allSoldiers[i];
      if (
        sub !== s &&
        sub.alive &&
        sub.faction === s.faction &&
        sub.rankLevel < s.rankLevel &&
        !sub.tacticalOrder &&
        sub.position.distanceToSquared(s.position) < 22 * 22
      ) {
        const spreadAngle = (sub.id % 6) * (Math.PI / 3);
        const subDest = baseDest.clone();
        subDest.x += Math.cos(spreadAngle) * 4.5;
        subDest.z += Math.sin(spreadAngle) * 4.5;
        sub.tacticalOrder = autoOrder;
        sub.orderTarget = subDest;
        sub.orderTimer = 8.5;
        sub.routeWaypoints = pickRouteToTarget(sub.position, subDest);
        sub.waypointIdx = 0;
        commandedAny = true;
      }
    }
    if (commandedAny) {
      s.commandCooldown = 14 + Math.random() * 8;
      onAiOrderIssued?.(s, autoOrder);
    } else {
      s.commandCooldown = 5;
    }
  }

  // Movement, Tom Clancy Orders & Rotation
  let moveSpeed = 0;
  let desiredYaw = s.yaw;

  if (s.tacticalOrder === 'follow' && playerAlive && s.faction === playerFaction && !isProne) {
    // Follow / Escort player in spaced tactical formation
    const slotAngle = ((s.id % 5) - 2) * 0.65;
    const formX = playerPos.x + Math.sin(slotAngle) * 4.6;
    const formZ = playerPos.z + Math.cos(slotAngle) * 4.6;
    _aiToTarget.set(formX - s.position.x, 0, formZ - s.position.z);
    const fDist = _aiToTarget.length();
    const dPlayerSq = s.position.distanceToSquared(playerPos);
    if (fDist > 1.6 && dPlayerSq > 3.0 * 3.0) {
      _aiToTarget.divideScalar(fDist);
      desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
      moveSpeed = fDist > 7 ? 5.1 : 4.1;
      s.stance = 'stand';
      s.isCrouching = false;
    } else if (bestEnemyPos) {
      _aiAim.subVectors(bestEnemyPos, _aiEye);
      desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      s.stance = 'crouch';
      s.isCrouching = true;
    } else {
      s.stance = 'stand';
      s.isCrouching = false;
    }
  } else if (s.tacticalOrder === 'hold' && !isProne) {
    // Hold position at target point (or current cover) and defend
    if (s.orderTarget && s.position.distanceToSquared(s.orderTarget) > 4.2 * 4.2) {
      if (s.waypointIdx < s.routeWaypoints.length) {
        const wp = s.routeWaypoints[s.waypointIdx];
        _aiToTarget.subVectors(wp, s.position);
        _aiToTarget.y = 0;
        const wpDist = _aiToTarget.length();
        if (wpDist < 2.0) s.waypointIdx++;
        else {
          _aiToTarget.divideScalar(wpDist);
          desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
          moveSpeed = 4.6;
          s.stance = 'stand';
          s.isCrouching = false;
        }
      }
    } else {
      if (s.weaponId === 'sniper' || s.hp < 55) {
        s.stance = 'prone';
        s.isCrouching = false;
      } else {
        s.stance = 'crouch';
        s.isCrouching = true;
      }
      moveSpeed = 0;
      if (bestEnemyPos) {
        _aiAim.subVectors(bestEnemyPos, _aiEye);
        desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      }
    }
  } else if (s.tacticalOrder === 'suppress' && s.orderTarget) {
    // Suppressive fire onto aimed point or visible enemy
    if (s.stance === 'stand') s.stance = 'crouch';
    s.isCrouching = s.stance === 'crouch';
    const suppressAim = bestEnemyPos || s.orderTarget;
    _aiAim.subVectors(suppressAim, _aiEye);
    desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);

    if (s.burstPauseTimer <= 0 && s.fireCooldown <= 0) {
      if (s.burstRemaining <= 0) {
        s.burstRemaining =
          isSniperWeapon(s.weaponId) || isRocketWeapon(s.weaponId)
            ? 1
            : isFlameWeapon(s.weaponId)
            ? 12
            : 5;
      }
      const muzzleWorld = new THREE.Vector3(0, 0.02, 0.72);
      s.armsGroup.localToWorld(muzzleWorld);
      const aimDir = new THREE.Vector3().subVectors(suppressAim, muzzleWorld).normalize();
      const spread = 0.065;
      aimDir.x += (Math.random() - 0.5) * spread;
      aimDir.y += (Math.random() - 0.5) * spread * 0.65;
      aimDir.z += (Math.random() - 0.5) * spread;
      aimDir.normalize();
      onAiFire(s, muzzleWorld, aimDir);
      s.muzzleFlash.visible = true;
      s.muzzleFlashTimer = 0.05;
      s.burstRemaining--;
      s.fireCooldown = isRocketWeapon(s.weaponId)
        ? 4.2
        : isSniperWeapon(s.weaponId)
        ? 0.95
        : isFlameWeapon(s.weaponId)
        ? 0.075
        : 0.11;
      if (s.burstRemaining <= 0) s.burstPauseTimer = 0.45;
    }
  } else if (s.tacticalOrder === 'assault' && s.orderTarget && !isProne && s.waypointIdx < s.routeWaypoints.length) {
    // Aggressive assault push toward commanded point (engage if close to enemy)
    if (bestEnemyPos && bestDistSq < 13 * 13) {
      _aiAim.subVectors(bestEnemyPos, _aiEye);
      desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      moveSpeed = 0;
      s.stance = 'crouch';
      s.isCrouching = true;
    } else {
      const wp = s.routeWaypoints[s.waypointIdx];
      _aiToTarget.subVectors(wp, s.position);
      _aiToTarget.y = 0;
      const wpDist = _aiToTarget.length();
      if (wpDist < 2.3) {
        s.waypointIdx++;
      } else {
        _aiToTarget.divideScalar(wpDist);
        desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
        moveSpeed = 5.2;
        s.stance = 'stand';
        s.isCrouching = false;
      }
    }
  } else if (bestEnemyPos) {
    _aiAim.subVectors(bestEnemyPos, _aiEye);
    desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);

    const dist = Math.sqrt(bestDistSq);
    if (!isProne) {
      if (s.aiState === 'cover' && s.coverPos && s.position.distanceToSquared(s.coverPos) > 2.2) {
        _aiToTarget.subVectors(s.coverPos, s.position);
        _aiToTarget.y = 0;
        _aiToTarget.normalize();
        moveSpeed = 4.2;
      } else if (dist > 26 && !s.isCrouching) {
        // Close distance slightly while engaging
        _aiToTarget.subVectors(bestEnemyPos, s.position);
        _aiToTarget.y = 0;
        _aiToTarget.normalize();
        moveSpeed = 2.6;
      } else if (dist < 10) {
        // Strafe laterally in close quarters
        const side = s.id % 2 === 0 ? 1 : -1;
        _aiToTarget.set(Math.cos(desiredYaw) * side, 0, -Math.sin(desiredYaw) * side);
        moveSpeed = 2.4;
      }
    }
  } else if (!isProne && s.waypointIdx < s.routeWaypoints.length) {
    const wp = s.routeWaypoints[s.waypointIdx];
    _aiToTarget.subVectors(wp, s.position);
    _aiToTarget.y = 0;
    const wpDist = _aiToTarget.length();
    if (wpDist < 2.2) {
      s.waypointIdx++;
    } else {
      _aiToTarget.divideScalar(wpDist);
      desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
      moveSpeed = 4.45;
    }
  }

  // Standard combat firing whenever an enemy is visible (even during follow/hold/assault!)
  if (bestEnemyPos && s.tacticalOrder !== 'suppress') {
    const dist = Math.sqrt(bestDistSq);
    if (s.tacticalOrder === 'assault' || s.tacticalOrder === 'follow' || s.tacticalOrder === 'hold') {
      _aiAim.subVectors(bestEnemyPos, _aiEye);
      if (moveSpeed < 0.5) {
        desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      }
    }
    const isRkt = isRocketWeapon(s.weaponId);
    const isFlm = isFlameWeapon(s.weaponId);
    const isSnp = isSniperWeapon(s.weaponId);
    const canFireWeapon =
      (!isRkt || dist > 11) && (!isFlm || dist < 19.5);
    if (canFireWeapon && s.burstPauseTimer <= 0 && s.fireCooldown <= 0) {
      if (s.burstRemaining <= 0) {
        s.burstRemaining =
          isSnp || isRkt ? 1 : isFlm ? 10 : 2 + Math.floor(Math.random() * 4);
      }
      const muzzleWorld = new THREE.Vector3(0, 0.02, 0.72);
      s.armsGroup.localToWorld(muzzleWorld);
      const aimDir = new THREE.Vector3().subVectors(bestEnemyPos, muzzleWorld).normalize();
      const spread = isSnp ? 0.026 : isRkt ? 0.038 : isFlm ? 0.075 : 0.055;
      aimDir.x += (Math.random() - 0.5) * spread;
      aimDir.y += (Math.random() - 0.5) * spread * 0.75 + (isRkt ? 0.035 : 0);
      aimDir.z += (Math.random() - 0.5) * spread;
      aimDir.normalize();

      onAiFire(s, muzzleWorld, aimDir);
      s.muzzleFlash.visible = true;
      s.muzzleFlashTimer = 0.05;
      s.burstRemaining--;
      s.fireCooldown = isRkt
        ? 4.4 + Math.random() * 1.6
        : isSnp
        ? 1.15
        : isFlm
        ? 0.08
        : 0.13 + Math.random() * 0.06;
      if (s.burstRemaining <= 0) {
        s.burstPauseTimer = isFlm ? 0.45 : 0.65 + Math.random() * 0.9;
        if (onCallout && s.calloutCooldown <= 0 && Math.random() < 0.25) {
          onCallout(s, 'reload', false);
          s.calloutCooldown = 7.0;
        }
      }
    }
  }

  // Smooth yaw rotation
  let dYaw = desiredYaw - s.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  s.yaw += dYaw * Math.min(1, dt * (isProne ? 4.2 : 8.5));
  s.root.rotation.y = s.yaw;

  // Injury speed reduction (limping soldier moves slower)
  const isInjured = s.hp < 55;
  if (isInjured) {
    moveSpeed *= 0.68;
    s.woundPhase += dt * (moveSpeed > 0.2 ? 6.5 : 3.2);
  }

  // Water wading speed penalty for AI too
  const gh = groundHeightAt(s.position.x, s.position.z);
  const waterDepth = Math.max(0, WATER_LEVEL - gh);
  if (s.position.y <= WATER_LEVEL + 0.05 && waterDepth > 0.1) {
    moveSpeed *= THREE.MathUtils.clamp(1 - waterDepth * 0.35, 0.58, 0.9);
  }

  if (moveSpeed > 0.1) {
    s.position.x += _aiToTarget.x * moveSpeed * dt;
    s.position.z += _aiToTarget.z * moveSpeed * dt;
    s.stridePhase += dt * moveSpeed * 2.4;
    if (onSoldierStep) {
      s.stepParticleCooldown -= dt;
      if (s.stepParticleCooldown <= 0) {
        s.stepParticleCooldown = moveSpeed > 4.4 ? 0.28 : 0.42;
        const surf = getSurfaceTypeAt(s.position.x, s.position.y, s.position.z);
        onSoldierStep(s, surf);
      }
    }
  } else {
    s.stridePhase = THREE.MathUtils.lerp(s.stridePhase, 0, dt * 6);
  }

  // Personal-space separation between soldiers & player (prevents units stacking together)
  for (let i = 0; i < allSoldiers.length; i++) {
    const other = allSoldiers[i];
    if (other === s || !other.alive) continue;
    const dx = s.position.x - other.position.x;
    const dz = s.position.z - other.position.z;
    const dSq = dx * dx + dz * dz;
    const minSep = 1.25;
    if (dSq > 1e-5 && dSq < minSep * minSep) {
      const d = Math.sqrt(dSq);
      const push = (minSep - d) * 0.5;
      s.position.x += (dx / d) * push;
      s.position.z += (dz / d) * push;
    }
  }
  if (playerAlive) {
    const dx = s.position.x - playerPos.x;
    const dz = s.position.z - playerPos.z;
    const dSq = dx * dx + dz * dz;
    const minPlayerSep = 1.55;
    if (dSq > 1e-5 && dSq < minPlayerSep * minPlayerSep) {
      const d = Math.sqrt(dSq);
      const push = minPlayerSep - d;
      s.position.x += (dx / d) * push;
      s.position.z += (dz / d) * push;
    }
  }

  const effectiveStance: PlayerStance = isProne ? 'prone' : s.isCrouching ? 'crouch' : 'stand';
  s.stance = effectiveStance;
  const colHeight = effectiveStance === 'prone' ? 0.58 : effectiveStance === 'crouch' ? 1.18 : 1.75;
  resolveHorizontalCollisions(s.position, 0.42, colHeight, boxes, cylinders);

  // Grounding & bridge deck height
  const targetY = supportHeightAt(s.position.x, s.position.y, s.position.z, boxes);
  s.position.y = THREE.MathUtils.lerp(s.position.y, targetY, Math.min(1, dt * 16));
  s.root.position.copy(s.position);

  // Articulated procedural animation with ground-normal aligned prone cover
  poseSoldierRig(s, {
    x: s.position.x,
    y: s.position.y,
    z: s.position.z,
    yaw: s.yaw,
    stance: effectiveStance,
    isDiving: false,
    isSprinting: moveSpeed > 4.6,
    moveSpeed,
    stridePhase: s.stridePhase,
    muzzleKick: s.muzzleFlashTimer > 0,
    isInjured,
    woundPhase: s.woundPhase,
    flinchFactor: s.flinchTimer > 0 ? s.flinchTimer / 0.18 : 0,
    flinchSide: s.id % 2 === 0 ? 1 : -1,
    combatAim: Boolean(bestEnemyPos),
    dt,
  });

  const targetIffY = effectiveStance === 'prone' ? 0.94 : effectiveStance === 'crouch' ? 1.56 : 2.04;
  s.iffSprite.position.y = THREE.MathUtils.lerp(s.iffSprite.position.y, targetIffY, Math.min(1, dt * 12));
}
