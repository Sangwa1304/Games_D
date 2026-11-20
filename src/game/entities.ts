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
  CoverNode,
  Faction,
  PlayerStance,
  SectorState,
  SmokeCloud,
  SurfaceType,
  WeaponId,
} from './types';
import { WEAPON_SPECS, isFlameWeapon, isRocketWeapon, isSniperWeapon } from './weapons';
import { getClassWeapon, getSoldierClass, SoldierClassId } from './soldierClasses';

export interface RemoteCombatTarget {
  key: string;
  position: THREE.Vector3;
  faction: Faction;
  alive: boolean;
  stance: PlayerStance;
}

export interface SoldierEntity {
  id: number;
  name: string;
  faction: Faction;
  weaponId: WeaponId;
  primaryWeaponId: WeaponId;
  flameBackupId: WeaponId | null;
  primaryGunGroup: THREE.Group;
  flameGunGroup: THREE.Group | null;
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
  aiState: 'advance' | 'combat' | 'cover' | 'flank' | 'defend';
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
  underFireTimer: number;
  muzzleFlashTimer: number;
  coverPos: THREE.Vector3 | null;
  assignedCoverIdx: number;
  coverStance: 'crouch' | 'prone';
  tacticalRole: 'rifleman' | 'defender' | 'flanker';
  soldierClass: SoldierClassId;
  medicCooldown: number;
  flankSign: 1 | -1;
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
  targetEnemyKey: string | null;
  orderTimer: number;
  commandCooldown: number;
  voiceProfile: VoiceProfileId;
  stepParticleCooldown: number;
  iffSprite: THREE.Sprite;
  iffWarnActive: boolean;
  reconMarkSprite: THREE.Sprite;
  droneMarkedTimer: number;
  losScanTimer: number;
  cachedEnemyKey: string | null;
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
let _reconMarkTex: THREE.CanvasTexture | null = null;

export function getReconMarkTexture(): THREE.CanvasTexture {
  if (_reconMarkTex) return _reconMarkTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;

    // Outer orange-red diamond frame (visible through bushes/thickets)
    ctx.strokeStyle = '#ff5722';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(64, 18);
    ctx.lineTo(106, 60);
    ctx.lineTo(64, 102);
    ctx.lineTo(22, 60);
    ctx.closePath();
    ctx.stroke();

    // Inner glowing core diamond
    ctx.fillStyle = 'rgba(239, 68, 68, 0.88)';
    ctx.beginPath();
    ctx.moveTo(64, 38);
    ctx.lineTo(84, 60);
    ctx.lineTo(64, 82);
    ctx.lineTo(44, 60);
    ctx.closePath();
    ctx.fill();

    // Downward pointer tick
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(64, 106);
    ctx.lineTo(64, 120);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _reconMarkTex = tex;
  return tex;
}

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
  weaponId: WeaponId = 'ak47',
  flameBackupId: WeaponId | null = null
): {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headMesh: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  armsGroup: THREE.Object3D;
  primaryGunGroup: THREE.Group;
  flameGunGroup: THREE.Group | null;
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

  const buildExternalGunGroup = (wId: WeaponId, includeBackTank: boolean): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(0.14, -0.04, 0.36);

    const isRkt = isRocketWeapon(wId);
    const isFlm = isFlameWeapon(wId);
    const isSnp = isSniperWeapon(wId);
    const isBullpup = wId === 'famas' || wId === 'aug';
    const isFde = wId === 'scar_l' || wId === 'mk20';

    const wpnMat = isFde
      ? new THREE.MeshStandardMaterial({ map: tex.weaponFdeTan, roughness: 0.58, metalness: 0.2 })
      : isFlm || isRkt || wId === 'aug' || wId === 'awm'
      ? new THREE.MeshStandardMaterial({ map: tex.weaponOliveMetal, roughness: 0.6, metalness: 0.25 })
      : steelMat;

    if (isRkt) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.92, 12), wpnMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.08, 0.14);
      g.add(tube);
      if (wId === 'bazooka') {
        const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.24, 10), wpnMat);
        warhead.rotation.x = Math.PI / 2;
        warhead.position.set(0, 0.08, 0.68);
        g.add(warhead);
      }
    } else if (isFlm) {
      const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, 0.32), steelMat);
      g.add(manifold);
      const nozzlePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.56, 10), steelMat);
      nozzlePipe.rotation.x = Math.PI / 2;
      nozzlePipe.position.set(0, 0.015, 0.38);
      g.add(nozzlePipe);
      if (includeBackTank) {
        const fuelTank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.38, 12),
          new THREE.MeshStandardMaterial({ map: tex.weaponHazardYellow, roughness: 0.5, metalness: 0.35 })
        );
        fuelTank.position.set(-0.14, 0.12, -0.58);
        bodyPivot.add(fuelTank);
      }
    } else {
      const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.068, 0.34), wpnMat);
      gunReceiver.castShadow = true;
      g.add(gunReceiver);

      const gunHandguard = new THREE.Mesh(
        new THREE.BoxGeometry(0.048, 0.052, isSnp ? 0.28 : 0.22),
        isFde ? wpnMat : faction === 'army' ? bootMat : woodMat
      );
      gunHandguard.position.set(0, 0.008, isBullpup ? 0.18 : 0.24);
      g.add(gunHandguard);

      const barrelLen = wId === 'barrett' ? 0.7 : isSnp ? 0.58 : 0.44;
      const gunBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.014, barrelLen, 10),
        steelMat
      );
      gunBarrel.rotation.x = Math.PI / 2;
      gunBarrel.position.set(0, 0.018, 0.2 + barrelLen * 0.45);
      g.add(gunBarrel);

      if (isSnp) {
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.24, 12), steelMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.068, 0.04);
        g.add(scope);
      }

      if (!isBullpup) {
        const gunStock = new THREE.Mesh(
          new THREE.BoxGeometry(0.042, 0.08, 0.22),
          isFde ? wpnMat : faction === 'army' ? bootMat : woodMat
        );
        gunStock.position.set(0, -0.015, -0.25);
        g.add(gunStock);
      }

      const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.16, 0.058), steelMat);
      gunMag.position.set(0, -0.1, isBullpup ? -0.08 : 0.06);
      gunMag.rotation.x = 0.26;
      g.add(gunMag);
    }
    return g;
  };

  // Multi-part Realistic Weapon Silhouette matched to WeaponId (+ concealed close-quarters flamethrower if any)
  const primaryGunGroup = buildExternalGunGroup(weaponId, true);
  armsGroup.add(primaryGunGroup);

  let flameGunGroup: THREE.Group | null = null;
  if (flameBackupId && isFlameWeapon(flameBackupId)) {
    flameGunGroup = buildExternalGunGroup(flameBackupId, !isFlameWeapon(weaponId));
    flameGunGroup.visible = false;
    armsGroup.add(flameGunGroup);
  }

  const isFlmPrimary = isFlameWeapon(weaponId);
  const isSnpPrimary = isSniperWeapon(weaponId);
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(isFlmPrimary ? 0.13 : 0.09, isFlmPrimary ? 0.32 : 0.24, 6),
    new THREE.MeshBasicMaterial({
      color: isFlmPrimary ? '#ff7b1c' : '#ffca55',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0.14, -0.022, isSnpPrimary ? 1.21 : 1.06);
  muzzleFlash.visible = false;
  armsGroup.add(muzzleFlash);

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
    primaryGunGroup,
    flameGunGroup,
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
  const classSpec = getSoldierClass(id);
  const primaryWeaponId = getClassWeapon(id, faction);
  // Soldiers carrying a flamethrower reserve hold their rifle normally and draw the flamethrower ONLY near an enemy
  const flameBackupId: WeaponId | null =
    id % 4 === 1 ? (faction === 'army' ? 'flamethrower' : 'lpo50') : null;
  const parts = createSoldierMesh(faction, tex, rankLevel, primaryWeaponId, flameBackupId);
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

  const reconMat = new THREE.SpriteMaterial({
    map: getReconMarkTexture(),
    transparent: true,
    opacity: 0.94,
    depthTest: false,
    depthWrite: false,
  });
  const reconMarkSprite = new THREE.Sprite(reconMat);
  reconMarkSprite.position.set(0, 2.18, 0);
  reconMarkSprite.scale.set(0.48, 0.48, 1);
  reconMarkSprite.renderOrder = 10;
  reconMarkSprite.visible = false;
  parts.root.add(reconMarkSprite);

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
    weaponId: primaryWeaponId,
    primaryWeaponId,
    flameBackupId,
    primaryGunGroup: parts.primaryGunGroup,
    flameGunGroup: parts.flameGunGroup,
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
    hp: classSpec.maxHp,
    maxHp: classSpec.maxHp,
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
    underFireTimer: 0,
    muzzleFlashTimer: 0,
    coverPos: null,
    assignedCoverIdx: -1,
    coverStance: 'crouch',
    tacticalRole: classSpec.tacticalRole,
    soldierClass: classSpec.id,
    medicCooldown: 2 + (id % 3),
    flankSign: id % 2 === 0 ? 1 : -1,
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
    targetEnemyKey: null,
    orderTimer: 0,
    commandCooldown: 4 + Math.random() * 5,
    voiceProfile,
    stepParticleCooldown: Math.random() * 0.3,
    iffSprite,
    iffWarnActive: false,
    reconMarkSprite,
    droneMarkedTimer: 0,
    losScanTimer: (id % 5) * 0.036,
    cachedEnemyKey: null,
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
const _aiThreat = new THREE.Vector3();
const _aiFlankDir = new THREE.Vector3();
const _aiFlankAnchor = new THREE.Vector3();
const _aiMuzzle = new THREE.Vector3();
const _aiAimDir = new THREE.Vector3();
const _aiBestEnemy = new THREE.Vector3();
const _elimTargetPos = new THREE.Vector3();

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

function findBestCoverNode(
  s: SoldierEntity,
  allSoldiers: SoldierEntity[],
  coverNodes: CoverNode[],
  threatPos: THREE.Vector3 | null,
  anchorPos: THREE.Vector3 | null,
  maxRadius: number
): { idx: number; node: CoverNode } | null {
  if (coverNodes.length === 0) return null;
  let bestIdx = -1;
  let bestScore = -1e9;
  const maxRadSq = maxRadius * maxRadius;

  for (let i = 0; i < coverNodes.length; i++) {
    const cn = coverNodes[i];
    const dx = cn.x - s.position.x;
    const dz = cn.z - s.position.z;
    const dSq = dx * dx + dz * dz;
    if (dSq > maxRadSq) continue;

    if (cn.y < WATER_LEVEL - 0.1) continue;

    let score = cn.kind === 'sandbag' ? 30 : cn.kind === 'barrier' ? 18 : 10;

    if (threatPos) {
      const tx = threatPos.x - cn.x;
      const tz = threatPos.z - cn.z;
      const tLenSq = tx * tx + tz * tz;
      if (tLenSq < 4.0 * 4.0) continue; // Too close to threat
      const tLen = Math.sqrt(tLenSq);
      const facingDot = (tx / tLen) * cn.faceX + (tz / tLen) * cn.faceZ;
      if (facingDot < 0.22) continue; // Exposed side of cover
      score += facingDot * 38;
    }

    // Penalize cover already occupied by a living squadmate (anti-stacking)
    let occupied = false;
    for (let j = 0; j < allSoldiers.length; j++) {
      const other = allSoldiers[j];
      if (other !== s && other.alive && other.faction === s.faction) {
        if (other.assignedCoverIdx === i) {
          occupied = true;
          break;
        }
        const odx = other.position.x - cn.x;
        const odz = other.position.z - cn.z;
        if (odx * odx + odz * odz < 1.35 * 1.35) {
          occupied = true;
          break;
        }
      }
    }
    if (occupied) score -= 140;

    // Slight hysteresis bonus to keep current assigned sandbag when still valid
    if (s.assignedCoverIdx === i) score += 10;

    score -= Math.sqrt(dSq) * 1.05;
    if (anchorPos) {
      const ax = cn.x - anchorPos.x;
      const az = cn.z - anchorPos.z;
      score -= Math.sqrt(ax * ax + az * az) * 0.85;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx >= 0 ? { idx: bestIdx, node: coverNodes[bestIdx] } : null;
}

function resolveEliminateTarget(
  targetKey: string,
  allSoldiers: SoldierEntity[],
  playerPos: THREE.Vector3,
  playerAlive: boolean,
  playerFaction: Faction,
  shooterFaction: Faction,
  remoteTargets: RemoteCombatTarget[],
  outPos: THREE.Vector3
): boolean {
  if (targetKey === 'player') {
    if (!playerAlive || shooterFaction === playerFaction) return false;
    outPos.set(playerPos.x, playerPos.y + 1.25, playerPos.z);
    return true;
  }
  if (targetKey.startsWith('ai:')) {
    const id = Number(targetKey.slice(3));
    for (let i = 0; i < allSoldiers.length; i++) {
      const t = allSoldiers[i];
      if (t.id === id) {
        if (!t.alive || t.faction === shooterFaction) return false;
        const aimY = t.stance === 'prone' ? 0.36 : t.stance === 'crouch' ? 0.88 : 1.32;
        outPos.set(t.position.x, t.position.y + aimY, t.position.z);
        return true;
      }
    }
    return false;
  }
  if (targetKey.startsWith('remote:')) {
    for (let i = 0; i < remoteTargets.length; i++) {
      const rp = remoteTargets[i];
      if (rp.key === targetKey) {
        if (!rp.alive || rp.faction === shooterFaction) return false;
        const aimY = rp.stance === 'prone' ? 0.36 : rp.stance === 'crouch' ? 0.88 : 1.32;
        outPos.set(rp.position.x, rp.position.y + aimY, rp.position.z);
        return true;
      }
    }
    return false;
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
  coverNodes: CoverNode[],
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[],
  activeSmokes: SmokeCloud[],
  dt: number,
  onAiFire: (soldier: SoldierEntity, muzzlePos: THREE.Vector3, aimDir: THREE.Vector3) => void,
  onCallout?: (soldier: SoldierEntity, category: CommsCategory, urgent: boolean) => void,
  onAiOrderIssued?: (commander: SoldierEntity, order: TacticalOrderId) => void,
  onSoldierStep?: (soldier: SoldierEntity, surface: SurfaceType) => void,
  remoteTargets: RemoteCombatTarget[] = []
) {
  if (!s.alive) {
    s.tacticalOrder = null;
    s.targetEnemyKey = null;
    s.cachedEnemyKey = null;
    s.droneMarkedTimer = 0;
    s.reconMarkSprite.visible = false;
    s.assignedCoverIdx = -1;
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
  if (s.flinchTimer > 0) {
    if (s.flinchTimer > 0.12) {
      s.underFireTimer = 4.5;
    }
    s.flinchTimer -= dt;
  }
  if (s.underFireTimer > 0) s.underFireTimer = Math.max(0, s.underFireTimer - dt);
  if (s.fireCooldown > 0) s.fireCooldown -= dt;
  if (s.burstPauseTimer > 0) s.burstPauseTimer -= dt;
  if (s.diveCooldown > 0) s.diveCooldown -= dt;
  if (s.calloutCooldown > 0) s.calloutCooldown -= dt;
  if (s.commandCooldown > 0) s.commandCooldown -= dt;
  if (s.orderTimer > 0) {
    s.orderTimer -= dt;
    if (s.orderTimer <= 0 && s.tacticalOrder !== 'eliminate') {
      s.tacticalOrder = null;
      s.orderTarget = null;
      s.targetEnemyKey = null;
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

  // Slightly elevated eye when crouching behind cover and ready to peek-fire cleanly over sandbags
  const peekClearance =
    !isProne && s.assignedCoverIdx >= 0 && s.burstPauseTimer <= 0 ? 1.12 : isProne ? 0.44 : s.stance === 'crouch' ? 0.98 : 1.5;
  _aiEye.set(s.position.x, s.position.y + peekClearance, s.position.z);

  // If executing Tom Clancy single-subordinate ELIMINATE order, verify whether locked target is still alive
  let lockedTargetAlive = false;
  let lockedTargetHasLos = false;
  if (s.tacticalOrder === 'eliminate' && s.targetEnemyKey) {
    lockedTargetAlive = resolveEliminateTarget(
      s.targetEnemyKey,
      allSoldiers,
      playerPos,
      playerAlive,
      playerFaction,
      s.faction,
      remoteTargets,
      _elimTargetPos
    );
    if (!lockedTargetAlive) {
      // Target is dead! Mission accomplished — exit eliminate order immediately
      s.tacticalOrder = null;
      s.targetEnemyKey = null;
      s.orderTarget = null;
      s.orderTimer = 0;
    } else {
      // Keep order alive until target dies
      s.orderTimer = Math.max(s.orderTimer, 2.5);
      lockedTargetHasLos = hasLineOfSight(_aiEye, _elimTargetPos, boxes, cylinders);
    }
  }

  if (s.droneMarkedTimer > 0) {
    s.droneMarkedTimer = Math.max(0, s.droneMarkedTimer - dt);
  }
  s.losScanTimer -= dt;

  // Find nearest visible enemy using staggered LOS scan (~6 Hz full scan + cached target tracking every frame)
  // Drone-marked enemies are spotted through bushes, reeds & smoke up to 108m by player's allies!
  let hasBestEnemy = false;
  let bestEnemyIsMarked = false;
  let bestDistSq = 82 * 82;

  if (s.losScanTimer <= 0) {
    s.losScanTimer = 0.16 + (s.id % 4) * 0.015;
    s.cachedEnemyKey = null;
    let bestScoreDistSq = 1e9;

    if (playerAlive && s.faction !== playerFaction) {
      const dSq = s.position.distanceToSquared(playerPos);
      if (dSq < 82 * 82) {
        _enemyEye.set(playerPos.x, playerPos.y + 1.4, playerPos.z);
        if (
          !isSegmentBlockedBySmoke(_aiEye, _enemyEye, activeSmokes) &&
          hasLineOfSight(_aiEye, _enemyEye, boxes, cylinders)
        ) {
          bestDistSq = dSq;
          bestScoreDistSq = dSq;
          _aiBestEnemy.copy(_enemyEye);
          hasBestEnemy = true;
          s.cachedEnemyKey = 'player';
        }
      }
    }

    for (let i = 0; i < allSoldiers.length; i++) {
      const other = allSoldiers[i];
      if (!other.alive || other.faction === s.faction) continue;
      const isMarked = other.droneMarkedTimer > 0 && s.faction === playerFaction;
      const maxRangeSq = isMarked ? 108 * 108 : 82 * 82;
      const dSq = s.position.distanceToSquared(other.position);
      if (dSq >= maxRangeSq) continue;
      // Marked enemies get a strong detection score priority for subordinates
      const effectiveScore = isMarked ? dSq * 0.42 : dSq;
      if (effectiveScore >= bestScoreDistSq) continue;

      _enemyEye.set(other.position.x, other.position.y + (other.stance === 'prone' ? 0.38 : 1.32), other.position.z);
      if (
        (isMarked || !isSegmentBlockedBySmoke(_aiEye, _enemyEye, activeSmokes)) &&
        hasLineOfSight(_aiEye, _enemyEye, boxes, cylinders)
      ) {
        bestDistSq = dSq;
        bestScoreDistSq = effectiveScore;
        bestEnemyIsMarked = isMarked;
        _aiBestEnemy.copy(_enemyEye);
        hasBestEnemy = true;
        s.cachedEnemyKey = `ai:${other.id}`;
      }
    }

    for (let i = 0; i < remoteTargets.length; i++) {
      const rp = remoteTargets[i];
      if (!rp.alive || rp.faction === s.faction) continue;
      const dSq = s.position.distanceToSquared(rp.position);
      if (dSq >= 82 * 82 || dSq >= bestScoreDistSq) continue;
      const aimY = rp.stance === 'prone' ? 0.36 : rp.stance === 'crouch' ? 0.88 : 1.32;
      _enemyEye.set(rp.position.x, rp.position.y + aimY, rp.position.z);
      if (
        !isSegmentBlockedBySmoke(_aiEye, _enemyEye, activeSmokes) &&
        hasLineOfSight(_aiEye, _enemyEye, boxes, cylinders)
      ) {
        bestDistSq = dSq;
        bestScoreDistSq = dSq;
        _aiBestEnemy.copy(_enemyEye);
        hasBestEnemy = true;
        s.cachedEnemyKey = rp.key;
      }
    }
  } else if (s.cachedEnemyKey) {
    if (
      resolveEliminateTarget(
        s.cachedEnemyKey,
        allSoldiers,
        playerPos,
        playerAlive,
        playerFaction,
        s.faction,
        remoteTargets,
        _enemyEye
      )
    ) {
      const dSq = s.position.distanceToSquared(_enemyEye);
      let isMarked = false;
      if (s.cachedEnemyKey.startsWith('ai:') && s.faction === playerFaction) {
        const cid = Number(s.cachedEnemyKey.slice(3));
        for (let i = 0; i < allSoldiers.length; i++) {
          if (allSoldiers[i].id === cid) {
            isMarked = allSoldiers[i].droneMarkedTimer > 0;
            break;
          }
        }
      }
      const maxRangeSq = isMarked ? 108 * 108 : 82 * 82;
      if (dSq < maxRangeSq) {
        bestDistSq = dSq;
        bestEnemyIsMarked = isMarked;
        _aiBestEnemy.copy(_enemyEye);
        hasBestEnemy = true;
      } else {
        s.cachedEnemyKey = null;
      }
    } else {
      s.cachedEnemyKey = null;
    }
  }

  // Override aim target cleanly for ELIMINATE order
  if (lockedTargetAlive && lockedTargetHasLos) {
    _aiBestEnemy.copy(_elimTargetPos);
    bestDistSq = s.position.distanceToSquared(_elimTargetPos);
    hasBestEnemy = true;
  }

  const bestEnemyPos: THREE.Vector3 | null = hasBestEnemy ? _aiBestEnemy : null;
  void bestEnemyIsMarked;

  // Draw flamethrower ONLY when close to an enemy (<= 16.5m); stow back to primary rifle when far (> 21m)
  if (s.flameBackupId && s.flameGunGroup) {
    if (bestEnemyPos && bestDistSq <= 16.5 * 16.5) {
      if (s.weaponId !== s.flameBackupId) {
        s.weaponId = s.flameBackupId;
        s.primaryGunGroup.visible = false;
        s.flameGunGroup.visible = true;
        s.burstRemaining = 0;
        s.fireCooldown = Math.min(s.fireCooldown, 0.14);
      }
    } else if (!bestEnemyPos || bestDistSq > 21.0 * 21.0) {
      if (s.weaponId !== s.primaryWeaponId) {
        s.weaponId = s.primaryWeaponId;
        s.primaryGunGroup.visible = true;
        s.flameGunGroup.visible = false;
        s.burstRemaining = 0;
      }
    }
  }

  // Immediate Under-Fire Defensive Reaction: snap to sandbag cover or dive when shot in open ground
  if (s.underFireTimer > 3.9 && s.tacticalOrder !== 'eliminate' && s.tacticalOrder !== 'assault') {
    const coverDistSq = s.coverPos ? s.position.distanceToSquared(s.coverPos) : 9999;
    if (coverDistSq > 3.0 * 3.0) {
      const threat =
        bestEnemyPos ||
        s.orderTarget ||
        _aiThreat.set(0, 0, s.faction === 'army' ? -45 : 45);
      const emergencyCover = findBestCoverNode(s, allSoldiers, coverNodes, threat, s.position, 22);
      if (emergencyCover) {
        s.assignedCoverIdx = emergencyCover.idx;
        if (!s.coverPos) s.coverPos = new THREE.Vector3();
        s.coverPos.set(emergencyCover.node.x, emergencyCover.node.y, emergencyCover.node.z);
        s.coverStance = emergencyCover.node.recommendedStance;
        s.aiState = 'cover';
      } else if (s.hp < 62 && s.diveCooldown <= 0 && bestEnemyPos) {
        triggerSoldierDive(s, bestEnemyPos);
      }
    }
  }

  // Periodic Smarter Tactical & Defensive Decision
  s.decisionTimer -= dt;
  if (s.decisionTimer <= 0) {
    s.decisionTimer = 1.2 + Math.random() * 1.1;

    if (s.tacticalOrder === 'cover') {
      const anchor = s.orderTarget || s.position;
      const threat =
        bestEnemyPos ||
        _aiThreat.set(anchor.x, anchor.y, anchor.z + (s.faction === 'army' ? -35 : 35));
      const found = findBestCoverNode(s, allSoldiers, coverNodes, threat, anchor, 32);
      if (found) {
        s.assignedCoverIdx = found.idx;
        if (!s.coverPos) s.coverPos = new THREE.Vector3();
        s.coverPos.set(found.node.x, found.node.y, found.node.z);
        s.coverStance = found.node.recommendedStance;
      }
      s.aiState = 'cover';
    } else if (!bestEnemyPos && s.underFireTimer <= 0 && !s.tacticalOrder) {
      // Pick an unowned/contested sector, or defend an owned frontline sector behind sandbags!
      const contestedOrEnemy = sectors
        .map((sec, idx) => ({ sec, idx }))
        .filter(({ sec }) => sec.active && sec.owner !== s.faction);
      const friendlySectors = sectors
        .map((sec, idx) => ({ sec, idx }))
        .filter(({ sec }) => sec.active && sec.owner === s.faction);

      const defendFriendly =
        friendlySectors.length > 0 &&
        (s.tacticalRole === 'defender' || contestedOrEnemy.length === 0 || Math.random() < 0.34);

      if (defendFriendly) {
        const chosenSec = friendlySectors[s.id % friendlySectors.length];
        s.targetSectorIdx = chosenSec.idx;
        const secPos = sectors[chosenSec.idx].position;
        _aiThreat.set(
          secPos.x,
          secPos.y,
          secPos.z + (s.faction === 'army' ? -42 : 42)
        );
        const defCover = findBestCoverNode(s, allSoldiers, coverNodes, _aiThreat, secPos, 30);
        if (defCover) {
          s.assignedCoverIdx = defCover.idx;
          if (!s.coverPos) s.coverPos = new THREE.Vector3();
          s.coverPos.set(defCover.node.x, defCover.node.y, defCover.node.z);
          s.coverStance = defCover.node.recommendedStance;
          s.aiState = 'defend';
        } else {
          s.assignedCoverIdx = -1;
          s.coverPos = null;
          s.aiState = 'advance';
        }
      } else {
        const activeList = contestedOrEnemy.length > 0 ? contestedOrEnemy : sectors.map((sec, idx) => ({ sec, idx })).filter(({ sec }) => sec.active);
        const chosen = activeList.length > 0 ? activeList[Math.floor(Math.random() * activeList.length)].idx : 0;
        if (chosen !== s.targetSectorIdx || s.waypointIdx >= s.routeWaypoints.length) {
          s.targetSectorIdx = chosen;
          _aiThreat.copy(sectors[chosen].position);
          _aiThreat.x += (Math.random() - 0.5) * 10;
          _aiThreat.z += (Math.random() - 0.5) * 10;
          s.routeWaypoints = pickRouteToTarget(s.position, _aiThreat);
          s.waypointIdx = 0;
        }
        s.assignedCoverIdx = -1;
        s.coverPos = null;
        s.stance = 'stand';
        s.isCrouching = false;
        s.aiState = 'advance';
      }
    } else if (bestEnemyPos && !s.tacticalOrder) {
      // Cover-First Combat Intelligence: soldiers always prefer sandbag cover over standing in open terrain!
      const eDistSq = bestEnemyPos.distanceToSquared(s.position);
      const canFlank =
        s.tacticalRole === 'flanker' &&
        s.hp >= 65 &&
        eDistSq > 14 * 14 &&
        eDistSq < 56 * 56 &&
        !isSniperWeapon(s.weaponId);

      // Check if an ally is already suppressing nearby so flankers can peel off cleanly
      let allyNearby = false;
      if (canFlank) {
        for (let i = 0; i < allSoldiers.length; i++) {
          const a = allSoldiers[i];
          if (a !== s && a.alive && a.faction === s.faction && a.position.distanceToSquared(s.position) < 22 * 22) {
            allyNearby = true;
            break;
          }
        }
      }

      if (canFlank && allyNearby && Math.random() < 0.35) {
        _aiFlankDir.subVectors(bestEnemyPos, s.position);
        _aiFlankDir.y = 0;
        _aiFlankDir.normalize();
        _aiFlankAnchor
          .copy(s.position)
          .addScaledVector(_aiFlankDir, 10);
        _aiFlankAnchor.x += -_aiFlankDir.z * 14 * s.flankSign;
        _aiFlankAnchor.z += _aiFlankDir.x * 14 * s.flankSign;
        const flankCover = findBestCoverNode(s, allSoldiers, coverNodes, bestEnemyPos, _aiFlankAnchor, 22);
        if (flankCover) {
          s.assignedCoverIdx = flankCover.idx;
          if (!s.coverPos) s.coverPos = new THREE.Vector3();
          s.coverPos.set(flankCover.node.x, flankCover.node.y, flankCover.node.z);
          s.coverStance = flankCover.node.recommendedStance;
          s.aiState = 'flank';
        } else {
          s.aiState = 'cover';
        }
      } else {
        const bestCover = findBestCoverNode(s, allSoldiers, coverNodes, bestEnemyPos, s.position, 26);
        if (bestCover) {
          s.assignedCoverIdx = bestCover.idx;
          if (!s.coverPos) s.coverPos = new THREE.Vector3();
          s.coverPos.set(bestCover.node.x, bestCover.node.y, bestCover.node.z);
          s.coverStance = bestCover.node.recommendedStance;
          s.aiState = 'cover';
        } else {
          s.assignedCoverIdx = -1;
          s.coverPos = null;
          s.aiState = 'combat';
          if (s.hp < 52 || (isSniperWeapon(s.weaponId) && eDistSq > 26 * 26)) {
            s.stance = 'prone';
            s.proneTimer = Math.max(s.proneTimer, 2.2);
          } else {
            s.stance = 'crouch';
          }
          s.isCrouching = s.stance === 'crouch';
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

  // Senior AI Commander autonomous orders to lower-ranked squadmates (Tom Clancy tactical AI)
  if (s.rankLevel >= 4 && s.commandCooldown <= 0 && !s.tacticalOrder) {
    let commandedAny = false;
    const autoOrder: TacticalOrderId = bestEnemyPos
      ? s.underFireTimer > 1.2 || Math.random() < 0.52
        ? 'cover'
        : 'assault'
      : Math.random() < 0.4
      ? 'move'
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
        sub.position.distanceToSquared(s.position) < 24 * 24
      ) {
        const spreadAngle = (sub.id % 6) * (Math.PI / 3);
        const subDest = baseDest.clone();
        subDest.x += Math.cos(spreadAngle) * 4.5;
        subDest.z += Math.sin(spreadAngle) * 4.5;
        sub.tacticalOrder = autoOrder;
        sub.orderTarget = subDest;
        sub.orderTimer = 9.0;
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

  // Movement, Tom Clancy Orders & Cover-First Posture
  let moveSpeed = 0;
  let desiredYaw = s.yaw;

  if (s.tacticalOrder === 'eliminate' && lockedTargetAlive) {
    // Dedicated Single-Subordinate Target Elimination until target dies!
    _aiAim.subVectors(_elimTargetPos, _aiEye);
    desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
    if (lockedTargetHasLos) {
      // Snap to nearby sandbag cover if one is right next to soldier, otherwise lock in crouch firing stance
      if (s.coverPos && s.position.distanceToSquared(s.coverPos) > 1.4 * 1.4 && s.position.distanceToSquared(s.coverPos) < 5.0 * 5.0) {
        _aiToTarget.subVectors(s.coverPos, s.position);
        _aiToTarget.y = 0;
        _aiToTarget.normalize();
        moveSpeed = 4.6;
        s.stance = 'crouch';
        s.isCrouching = true;
      } else {
        moveSpeed = 0;
        s.stance = isSniperWeapon(s.weaponId) && s.position.distanceToSquared(_elimTargetPos) > 26 * 26 ? 'prone' : 'crouch';
        s.isCrouching = s.stance === 'crouch';
      }
    } else {
      // Maneuver laterally / forward to obtain clear LOS onto marked target
      _aiToTarget.subVectors(_elimTargetPos, s.position);
      _aiToTarget.y = 0;
      const tDist = _aiToTarget.length();
      if (tDist > 1.5) {
        _aiToTarget.divideScalar(tDist);
        const side = s.flankSign * 0.48;
        const rx = -_aiToTarget.z;
        const rz = _aiToTarget.x;
        _aiToTarget.x += rx * side;
        _aiToTarget.z += rz * side;
        _aiToTarget.normalize();
        desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
        moveSpeed = 5.1;
        s.stance = 'stand';
        s.isCrouching = false;
      }
    }
  } else if (s.tacticalOrder === 'follow' && playerAlive && s.faction === playerFaction && !isProne) {
    // Follow / Escort player in spaced tactical formation
    const slotAngle = ((s.id % 5) - 2) * 0.65;
    const formX = playerPos.x + Math.sin(slotAngle) * 4.6;
    const formZ = playerPos.z + Math.cos(slotAngle) * 4.6;
    _aiToTarget.set(formX - s.position.x, 0, formZ - s.position.z);
    const fDist = _aiToTarget.length();
    const dPlayerSq = s.position.distanceToSquared(playerPos);
    if (fDist > 1.8 && dPlayerSq > 3.2 * 3.2) {
      _aiToTarget.divideScalar(fDist);
      desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
      moveSpeed = fDist > 7 ? 5.2 : 4.2;
      s.stance = 'stand';
      s.isCrouching = false;
    } else if (bestEnemyPos) {
      _aiAim.subVectors(bestEnemyPos, _aiEye);
      desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      s.stance = 'crouch';
      s.isCrouching = true;
    } else {
      s.stance = 'crouch';
      s.isCrouching = true;
    }
  } else if (s.tacticalOrder === 'cover' && !isProne) {
    // À Couvert: rush into assigned sandbag cover facing threat and defend
    if (!s.coverPos) {
      const anchor = s.orderTarget || s.position;
      const threat = bestEnemyPos || _aiThreat.set(anchor.x, anchor.y, anchor.z + (s.faction === 'army' ? -35 : 35));
      const found = findBestCoverNode(s, allSoldiers, coverNodes, threat, anchor, 32);
      if (found) {
        s.assignedCoverIdx = found.idx;
        s.coverPos = new THREE.Vector3(found.node.x, found.node.y, found.node.z);
        s.coverStance = found.node.recommendedStance;
      }
    }
    const dest = s.coverPos || s.orderTarget;
    if (dest && s.position.distanceToSquared(dest) > 1.45 * 1.45) {
      _aiToTarget.subVectors(dest, s.position);
      _aiToTarget.y = 0;
      _aiToTarget.normalize();
      desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
      moveSpeed = 5.25;
      s.stance = 'stand';
      s.isCrouching = false;
    } else {
      moveSpeed = 0;
      if (s.hp < 45 || s.coverStance === 'prone') {
        s.stance = 'prone';
        s.isCrouching = false;
      } else {
        s.stance = 'crouch';
        s.isCrouching = true;
      }
      if (bestEnemyPos) {
        _aiAim.subVectors(bestEnemyPos, _aiEye);
        desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      } else if (s.assignedCoverIdx >= 0 && coverNodes[s.assignedCoverIdx]) {
        const cn = coverNodes[s.assignedCoverIdx];
        desiredYaw = Math.atan2(cn.faceX, cn.faceZ);
      }
    }
  } else if (s.tacticalOrder === 'move' && s.orderTarget && !isProne) {
    // Déplacement tactique: advance to target, then immediately claim nearest sandbag cover!
    const distToOrderSq = s.position.distanceToSquared(s.orderTarget);
    if (distToOrderSq > 3.6 * 3.6) {
      if (s.waypointIdx < s.routeWaypoints.length) {
        const wp = s.routeWaypoints[s.waypointIdx];
        _aiToTarget.subVectors(wp, s.position);
        _aiToTarget.y = 0;
        const wpDist = _aiToTarget.length();
        if (wpDist < 2.1) {
          s.waypointIdx++;
        } else {
          _aiToTarget.divideScalar(wpDist);
          desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
          moveSpeed = bestEnemyPos && bestDistSq < 15 * 15 ? 3.5 : 4.95;
          s.stance = 'stand';
          s.isCrouching = false;
        }
      }
    } else {
      if (!s.coverPos) {
        const threat = bestEnemyPos || _aiThreat.set(s.orderTarget.x, s.orderTarget.y, s.orderTarget.z + (s.faction === 'army' ? -30 : 30));
        const arriveCover = findBestCoverNode(s, allSoldiers, coverNodes, threat, s.orderTarget, 14);
        if (arriveCover) {
          s.assignedCoverIdx = arriveCover.idx;
          s.coverPos = new THREE.Vector3(arriveCover.node.x, arriveCover.node.y, arriveCover.node.z);
          s.coverStance = arriveCover.node.recommendedStance;
        }
      }
      if (s.coverPos && s.position.distanceToSquared(s.coverPos) > 1.4 * 1.4) {
        _aiToTarget.subVectors(s.coverPos, s.position);
        _aiToTarget.y = 0;
        _aiToTarget.normalize();
        desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
        moveSpeed = 4.6;
        s.stance = 'crouch';
        s.isCrouching = true;
      } else {
        moveSpeed = 0;
        s.stance = 'crouch';
        s.isCrouching = true;
        if (bestEnemyPos) {
          _aiAim.subVectors(bestEnemyPos, _aiEye);
          desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
        }
      }
    }
  } else if (s.tacticalOrder === 'assault' && s.orderTarget && !isProne && s.waypointIdx < s.routeWaypoints.length) {
    // Aggressive bounding assault toward commanded sector/position
    if (bestEnemyPos && bestDistSq < 12 * 12) {
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
        moveSpeed = 5.35;
        s.stance = 'stand';
        s.isCrouching = false;
      }
    }
  } else if (s.coverPos && (s.aiState === 'cover' || s.aiState === 'defend' || s.aiState === 'flank') && !isProne) {
    // Autonomous Cover-First & Sector Defense Logic
    const dCoverSq = s.position.distanceToSquared(s.coverPos);
    if (dCoverSq > 1.45 * 1.45) {
      _aiToTarget.subVectors(s.coverPos, s.position);
      _aiToTarget.y = 0;
      _aiToTarget.normalize();
      desiredYaw = Math.atan2(_aiToTarget.x, _aiToTarget.z);
      moveSpeed = s.underFireTimer > 0 ? 5.25 : 4.65;
      s.stance = 'stand';
      s.isCrouching = false;
    } else {
      // Positioned cleanly behind sandbag cover — stay anchored in crouch/prone!
      moveSpeed = 0;
      if (s.hp < 46 || s.coverStance === 'prone') {
        s.stance = 'prone';
        s.isCrouching = false;
      } else {
        s.stance = 'crouch';
        s.isCrouching = true;
      }
      if (bestEnemyPos) {
        _aiAim.subVectors(bestEnemyPos, _aiEye);
        desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
      } else if (s.assignedCoverIdx >= 0 && coverNodes[s.assignedCoverIdx]) {
        const cn = coverNodes[s.assignedCoverIdx];
        desiredYaw = Math.atan2(cn.faceX, cn.faceZ);
      }
    }
  } else if (bestEnemyPos) {
    _aiAim.subVectors(bestEnemyPos, _aiEye);
    desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);

    const dist = Math.sqrt(bestDistSq);
    if (!isProne) {
      if (dist > 30 && !s.isCrouching) {
        _aiToTarget.subVectors(bestEnemyPos, s.position);
        _aiToTarget.y = 0;
        _aiToTarget.normalize();
        moveSpeed = 2.8;
      } else if (dist < 8.5) {
        const side = s.flankSign;
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
      moveSpeed = 4.55;
    }
  }

  // Standard & Order Combat Firing (Peek-fire cleanly from sandbags; relentless bursts during ELIMINATE)
  if (bestEnemyPos) {
    const dist = Math.sqrt(bestDistSq);
    if (moveSpeed < 0.5) {
      _aiAim.subVectors(bestEnemyPos, _aiEye);
      desiredYaw = Math.atan2(_aiAim.x, _aiAim.z);
    }
    const isElimOrder = s.tacticalOrder === 'eliminate' && lockedTargetAlive;
    const isRkt = isRocketWeapon(s.weaponId);
    const isFlm = isFlameWeapon(s.weaponId);
    const isSnp = isSniperWeapon(s.weaponId);
    const canFireWeapon =
      (!isRkt || dist > 11) && (!isFlm || dist < 19.5);
    if (canFireWeapon && s.burstPauseTimer <= 0 && s.fireCooldown <= 0) {
      const wSpec = WEAPON_SPECS[s.weaponId];
      const rpm = wSpec?.rpm ?? 650;
      const isSuppressWeapon = !isFlm && rpm >= 880;
      if (s.burstRemaining <= 0) {
        s.burstRemaining =
          isSnp || isRkt
            ? 1
            : isFlm
            ? 10
            : isElimOrder
            ? isSuppressWeapon
              ? 8
              : 6
            : isSuppressWeapon
            ? 5 + Math.floor(Math.random() * 4)
            : 3 + Math.floor(Math.random() * 3);
      }
      _aiMuzzle.set(0, 0.02, 0.72);
      s.armsGroup.localToWorld(_aiMuzzle);
      // Raise muzzle slightly above sandbag lip when crouched in cover so shots clear friendly sandbags cleanly
      if (s.assignedCoverIdx >= 0 && !isProne) {
        _aiMuzzle.y = Math.max(_aiMuzzle.y, s.position.y + 1.06);
      }
      _aiAimDir.subVectors(bestEnemyPos, _aiMuzzle).normalize();
      const baseSpread = isSnp ? 0.018 : isRkt ? 0.036 : isFlm ? 0.072 : 0.048;
      const spread = isElimOrder ? baseSpread * 0.62 : baseSpread;
      _aiAimDir.x += (Math.random() - 0.5) * spread;
      _aiAimDir.y += (Math.random() - 0.5) * spread * 0.68 + (isRkt ? 0.035 : 0);
      _aiAimDir.z += (Math.random() - 0.5) * spread;
      _aiAimDir.normalize();

      onAiFire(s, _aiMuzzle, _aiAimDir);
      s.muzzleFlash.visible = true;
      s.muzzleFlashTimer = 0.05;
      s.burstRemaining--;
      s.fireCooldown = isRkt
        ? 4.2 + Math.random() * 1.4
        : isSnp
        ? Math.max(0.4, (60 / rpm) * 1.1)
        : isFlm
        ? 0.072
        : isSuppressWeapon
        ? Math.max(0.058, (60 / rpm) * 1.05)
        : Math.max(0.105, (60 / rpm) * 1.3) + Math.random() * 0.03;
      if (s.burstRemaining <= 0) {
        s.burstPauseTimer = isElimOrder
          ? isFlm
            ? 0.28
            : 0.34
          : isFlm
          ? 0.42
          : isSuppressWeapon
          ? 0.45 + Math.random() * 0.5
          : 0.62 + Math.random() * 0.78;
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
