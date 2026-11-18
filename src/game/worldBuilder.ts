import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  groundHeightAt,
  riverCenterZ,
  riverHalfWidth,
  roadCenterX,
  WATER_LEVEL,
} from './terrain';
import { ProceduralTexturePack } from './textures';
import {
  ColliderBox,
  ColliderCylinder,
  ExplosiveBarrel,
  SectorState,
} from './types';

export interface WorldBuildResult {
  boxColliders: ColliderBox[];
  cylinderColliders: ColliderCylinder[];
  barrels: ExplosiveBarrel[];
  sectors: SectorState[];
  coverPoints: THREE.Vector3[];
  updateWorld: (elapsed: number, sectors: SectorState[], windStrength?: number) => void;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function addContactShadow(
  parent: THREE.Object3D,
  tex: THREE.Texture,
  rx: number,
  rz: number,
  yOffset = 0.03
) {
  const geo = new THREE.PlaneGeometry(rx * 2, rz * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = yOffset;
  parent.add(m);
}

function registerOrientedBoxCollider(
  boxes: ColliderBox[],
  id: string,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  minY: number,
  maxY: number,
  rotY: number,
  material: ColliderBox['material'],
  penetrable = false,
  isWalkableTop = false
) {
  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const wx = halfW * cos + halfD * sin;
  const wz = halfW * sin + halfD * cos;
  boxes.push({
    id,
    minX: cx - wx,
    maxX: cx + wx,
    minY,
    maxY,
    minZ: cz - wz,
    maxZ: cz + wz,
    material,
    penetrable,
    isWalkableTop,
  });
}

function buildSandbagWall(
  x: number,
  z: number,
  rotY: number,
  length: number,
  rows: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[],
  idPrefix: string
) {
  const group = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  group.position.set(x, baseY, z);
  group.rotation.y = rotY;

  const bagShape = new THREE.Shape();
  bagShape.moveTo(-0.32, -0.14);
  bagShape.lineTo(0.32, -0.14);
  bagShape.quadraticCurveTo(0.38, 0, 0.3, 0.14);
  bagShape.lineTo(-0.3, 0.14);
  bagShape.quadraticCurveTo(-0.38, 0, -0.32, -0.14);

  const bagGeo = new THREE.ExtrudeGeometry(bagShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  bagGeo.center();

  const bagMat = new THREE.MeshStandardMaterial({
    map: tex.sandbagWeave,
    roughness: 0.94,
    metalness: 0.02,
  });

  const cols = Math.max(2, Math.round(length / 0.72));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bag = new THREE.Mesh(bagGeo, bagMat);
      const stagger = (r % 2) * 0.24 - 0.12;
      const lx = (c - (cols - 1) / 2) * 0.68 + stagger;
      bag.position.set(lx, 0.16 + r * 0.26, ((r + c) % 2) * 0.04);
      bag.rotation.y = (((r * 7 + c * 3) % 5) - 2) * 0.03;
      bag.castShadow = true;
      bag.receiveShadow = true;
      group.add(bag);
    }
  }

  scene.add(group);

  const halfLen = (cols * 0.68) / 2 + 0.2;
  registerOrientedBoxCollider(
    boxes,
    idPrefix,
    x,
    z,
    halfLen,
    0.34,
    baseY - 0.5,
    baseY + rows * 0.27 + 0.1,
    rotY,
    'sandbag',
    false
  );
}

function buildConcreteBarrier(
  x: number,
  z: number,
  rotY: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[],
  id: string
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const mat = new THREE.MeshStandardMaterial({
    map: tex.concretePad,
    roughness: 0.9,
    metalness: 0.05,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 0.72), mat);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.72, 0.34), mat);
  top.position.y = 0.78;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(base, top);

  addContactShadow(g, tex.contactShadow, 1.6, 0.55, 0.02);
  scene.add(g);

  registerOrientedBoxCollider(boxes, id, x, z, 1.4, 0.36, baseY - 0.5, baseY + 1.15, rotY, 'rock', false);
}

function buildMilitaryPickup(
  x: number,
  z: number,
  rotY: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[],
  id = 'army_pickup'
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const paintMat = new THREE.MeshStandardMaterial({
    color: '#465239',
    map: tex.camoArmy,
    bumpMap: tex.tacticalFabric,
    bumpScale: 0.02,
    roughness: 0.58,
    metalness: 0.22,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    color: '#222624',
    roughness: 0.72,
    metalness: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#1b1d1b',
    roughness: 0.9,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#5b6154',
    roughness: 0.38,
    metalness: 0.78,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#6e8c87',
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 0.85,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 4.5), chassisMat);
  chassis.position.set(0, 0.52, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  g.add(chassis);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.54, 1.35), paintMat);
  hood.position.set(0, 0.92, 1.55);
  hood.castShadow = true;
  hood.receiveShadow = true;
  g.add(hood);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.84, 1.05, 1.35), paintMat);
  cab.position.set(0, 1.25, 0.28);
  cab.castShadow = true;
  cab.receiveShadow = true;
  g.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.56, 0.1), glassMat);
  windshield.position.set(0, 1.44, 0.96);
  windshield.rotation.x = -0.22;
  g.add(windshield);

  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 1.85), paintMat);
  bedFloor.position.set(0, 0.92, -1.35);
  bedFloor.castShadow = true;
  bedFloor.receiveShadow = true;
  g.add(bedFloor);

  const rollBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.82, 0.12), chassisMat);
  rollBar.position.set(0, 1.56, -0.58);
  rollBar.castShadow = true;
  g.add(rollBar);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.24, 0.24), chassisMat);
  bumper.position.set(0, 0.58, 2.34);
  bumper.castShadow = true;
  g.add(bumper);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 12);
  rimGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [
    [-0.95, 1.48],
    [0.95, 1.48],
    [-0.95, -1.42],
    [0.95, -1.42],
  ]) {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, 0.42, wz);
    tire.castShadow = true;
    g.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, 0.42, wz);
    g.add(rim);
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 2.2, 6), chassisMat);
  antenna.position.set(-0.78, 2.25, -2.0);
  antenna.rotation.x = -0.1;
  g.add(antenna);

  addContactShadow(g, tex.contactShadow, 1.45, 2.6, 0.04);
  scene.add(g);

  registerOrientedBoxCollider(boxes, id, x, z, 1.05, 2.35, baseY - 0.5, baseY + 1.85, rotY, 'metal', false);
}

function buildWatchtower(
  x: number,
  z: number,
  rotY: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodPlank,
    roughness: 0.88,
    metalness: 0.04,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: tex.corrugatedMetal,
    roughness: 0.55,
    metalness: 0.6,
  });
  const bagMat = new THREE.MeshStandardMaterial({
    map: tex.sandbagWeave,
    roughness: 0.94,
    metalness: 0.02,
  });

  const legGeo = new THREE.CylinderGeometry(0.11, 0.14, 5.8, 8);
  const offsets: [number, number][] = [
    [-1.4, -1.4],
    [1.4, -1.4],
    [-1.4, 1.4],
    [1.4, 1.4],
  ];
  for (const [lx, lz] of offsets) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, 2.75, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    g.add(leg);
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.22, 3.3), woodMat);
  deck.position.set(0, 3.1, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  const railGeo = new THREE.BoxGeometry(3.2, 0.85, 0.14);
  for (const side of [
    [0, 3.65, 1.52, 0],
    [0, 3.65, -1.52, 0],
    [1.52, 3.65, 0, Math.PI / 2],
    [-1.52, 3.65, 0, Math.PI / 2],
  ] as [number, number, number, number][]) {
    const rail = new THREE.Mesh(railGeo, bagMat);
    rail.position.set(side[0], side[1], side[2]);
    rail.rotation.y = side[3];
    rail.castShadow = true;
    g.add(rail);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 3.9), roofMat);
  roof.position.set(0, 5.6, 0);
  roof.rotation.x = 0.12;
  roof.castShadow = true;
  g.add(roof);

  addContactShadow(g, tex.contactShadow, 2.1, 2.1, 0.04);
  scene.add(g);

  for (const [lx, lz] of offsets) {
    const wx = x + lx * Math.cos(rotY) - lz * Math.sin(rotY);
    const wz = z + lx * Math.sin(rotY) + lz * Math.cos(rotY);
    boxes.push({
      id: `tower_leg_${wx.toFixed(1)}_${wz.toFixed(1)}`,
      minX: wx - 0.22,
      maxX: wx + 0.22,
      minY: baseY - 0.5,
      maxY: baseY + 5.6,
      minZ: wz - 0.22,
      maxZ: wz + 0.22,
      material: 'wood',
      penetrable: true,
    });
  }
}

function buildCommandShelter(
  x: number,
  z: number,
  rotY: number,
  faction: 'army' | 'rebels',
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodPlank,
    roughness: 0.85,
  });
  const tarpMat = new THREE.MeshStandardMaterial({
    map: faction === 'army' ? tex.camoArmy : tex.camoRebel,
    roughness: 0.86,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    map: tex.corrugatedMetal,
    roughness: 0.5,
    metalness: 0.65,
  });

  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.7, 7);
  for (const [px, pz] of [
    [-2.4, -1.8],
    [2.4, -1.8],
    [-2.4, 1.8],
    [2.4, 1.8],
  ]) {
    const p = new THREE.Mesh(postGeo, woodMat);
    p.position.set(px, 1.35, pz);
    p.castShadow = true;
    g.add(p);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.12, 4.3), tarpMat);
  roof.position.set(0, 2.7, 0);
  roof.rotation.x = 0.08;
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.8, 0.18), metalMat);
  backWall.position.set(0, 0.9, -1.82);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  g.add(backWall);

  const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 0.9), woodMat);
  table.position.set(-0.9, 0.42, -1.0);
  table.castShadow = true;
  g.add(table);

  if (faction === 'army') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 6.2, 8), metalMat);
    mast.position.set(2.5, 3.1, -1.7);
    mast.castShadow = true;
    g.add(mast);
  }

  addContactShadow(g, tex.contactShadow, 2.9, 2.2, 0.03);
  scene.add(g);

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const bx = x + 1.82 * sin;
  const bz = z - 1.82 * cos;
  registerOrientedBoxCollider(
    boxes,
    `shelter_wall_${faction}_${x.toFixed(0)}_${z.toFixed(0)}`,
    bx,
    bz,
    2.45,
    0.22,
    baseY - 0.5,
    baseY + 2.2,
    rotY,
    'metal',
    false
  );
}

function buildCrateCluster(
  x: number,
  z: number,
  rotY: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[],
  id: string
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodPlank,
    roughness: 0.85,
  });
  const ammoMat = new THREE.MeshStandardMaterial({
    color: '#3c4a32',
    roughness: 0.6,
    metalness: 0.35,
  });

  const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.15), woodMat);
  c1.position.set(0, 0.47, 0);
  c1.castShadow = true;
  c1.receiveShadow = true;
  g.add(c1);

  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 0.85), ammoMat);
  c2.position.set(0.95, 0.36, 0.2);
  c2.rotation.y = 0.3;
  c2.castShadow = true;
  c2.receiveShadow = true;
  g.add(c2);

  const c3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), woodMat);
  c3.position.set(0.05, 1.22, -0.05);
  c3.rotation.y = -0.2;
  c3.castShadow = true;
  g.add(c3);

  addContactShadow(g, tex.contactShadow, 1.4, 1.1, 0.03);
  scene.add(g);

  registerOrientedBoxCollider(boxes, id, x, z, 1.35, 0.88, baseY - 0.5, baseY + 1.5, rotY, 'wood', true);
}

// 3 River Bridges (Central Timber x=0, West Suspension x=-76, East Pontoon x=+78)
function buildCentralTimberBridge(
  bx: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const cz = riverCenterZ(bx);
  const g = new THREE.Group();
  g.position.set(bx, 0, cz);
  const deckY = 1.35;
  const halfLen = 11.4;
  const halfWidth = 2.25;

  const timberMat = new THREE.MeshStandardMaterial({ map: tex.woodPlank, roughness: 0.88, metalness: 0.04 });
  const barkMat = new THREE.MeshStandardMaterial({ map: tex.barkAlbedo, bumpMap: tex.barkBump, bumpScale: 0.08, roughness: 0.92 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#8f7752', roughness: 0.95 });

  const pilingGeo = new THREE.CylinderGeometry(0.19, 0.24, 4.2, 8);
  for (const pz of [-9.5, -4.8, 0, 4.8, 9.5]) {
    for (const px of [-2.05, 2.05]) {
      const piling = new THREE.Mesh(pilingGeo, barkMat);
      piling.position.set(px, deckY - 1.3, pz);
      piling.castShadow = true;
      piling.receiveShadow = true;
      g.add(piling);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.24, 0.26), timberMat);
    beam.position.set(0, deckY - 0.16, pz);
    beam.castShadow = true;
    g.add(beam);
  }

  for (const sx of [-1.75, 0, 1.75]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, halfLen * 2), timberMat);
    stringer.position.set(sx, deckY - 0.12, 0);
    g.add(stringer);
  }

  const plankCount = 32;
  const plankGeo = new THREE.BoxGeometry(4.45, 0.1, 0.62);
  for (let i = 0; i < plankCount; i++) {
    const pz = -halfLen + 0.35 + i * ((halfLen * 2 - 0.7) / (plankCount - 1));
    const plank = new THREE.Mesh(plankGeo, timberMat);
    plank.position.set((((i * 13) % 3) - 1) * 0.03, deckY, pz);
    plank.rotation.y = ((i % 5) - 2) * 0.008;
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }

  const rampGeo = new THREE.BoxGeometry(4.4, 0.18, 3.8);
  const southRamp = new THREE.Mesh(rampGeo, timberMat);
  southRamp.position.set(0, deckY - 0.42, halfLen + 1.6);
  southRamp.rotation.x = 0.25;
  southRamp.receiveShadow = true;
  g.add(southRamp);

  const northRamp = new THREE.Mesh(rampGeo, timberMat);
  northRamp.position.set(0, deckY - 0.42, -halfLen - 1.6);
  northRamp.rotation.x = -0.25;
  northRamp.receiveShadow = true;
  g.add(northRamp);

  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.15, 7);
  for (const sideX of [-2.15, 2.15]) {
    const ropePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const pz = -halfLen + i * ((halfLen * 2) / 6);
      const post = new THREE.Mesh(postGeo, timberMat);
      post.position.set(sideX, deckY + 0.55, pz);
      post.castShadow = true;
      g.add(post);
      ropePts.push(new THREE.Vector3(sideX, deckY + 1.02 - (i % 2 === 1 ? 0.05 : 0), pz));
    }
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts), 26, 0.035, 6, false),
      ropeMat
    );
    rope.castShadow = true;
    g.add(rope);
  }

  scene.add(g);

  boxes.push({
    id: 'bridge_central_deck',
    minX: bx - halfWidth,
    maxX: bx + halfWidth,
    minY: deckY - 0.35,
    maxY: deckY + 0.08,
    minZ: cz - halfLen - 0.5,
    maxZ: cz + halfLen + 0.5,
    material: 'wood',
    isWalkableTop: true,
    penetrable: true,
  });
  boxes.push({
    id: 'bridge_central_rail_w',
    minX: bx - halfWidth - 0.25,
    maxX: bx - halfWidth + 0.12,
    minY: deckY,
    maxY: deckY + 1.15,
    minZ: cz - halfLen,
    maxZ: cz + halfLen,
    material: 'wood',
    penetrable: true,
  });
  boxes.push({
    id: 'bridge_central_rail_e',
    minX: bx + halfWidth - 0.12,
    maxX: bx + halfWidth + 0.25,
    minY: deckY,
    maxY: deckY + 1.15,
    minZ: cz - halfLen,
    maxZ: cz + halfLen,
    material: 'wood',
    penetrable: true,
  });
}

function buildWestSuspensionBridge(
  bx: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const cz = riverCenterZ(bx);
  const g = new THREE.Group();
  g.position.set(bx, 0, cz);
  const deckY = 1.35;
  const halfLen = 11.4;
  const halfWidth = 2.15;

  const woodMat = new THREE.MeshStandardMaterial({ map: tex.woodPlank, roughness: 0.88 });
  const cableMat = new THREE.MeshStandardMaterial({ map: tex.brushedSteel, roughness: 0.42, metalness: 0.78 });

  // End A-frame timber suspension towers
  for (const tz of [-10.8, 10.8]) {
    for (const tx of [-2.0, 2.0]) {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.26, 4.4, 0.26), woodMat);
      mast.position.set(tx, deckY + 1.4, tz);
      mast.castShadow = true;
      g.add(mast);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.24, 0.28), woodMat);
    header.position.set(0, deckY + 3.45, tz);
    header.castShadow = true;
    g.add(header);
  }

  // Plank deck + ramps
  const plankGeo = new THREE.BoxGeometry(4.2, 0.1, 0.65);
  for (let i = 0; i < 30; i++) {
    const pz = -halfLen + 0.35 + i * ((halfLen * 2 - 0.7) / 29);
    const p = new THREE.Mesh(plankGeo, woodMat);
    p.position.set(0, deckY, pz);
    p.castShadow = true;
    p.receiveShadow = true;
    g.add(p);
  }

  const rampGeo = new THREE.BoxGeometry(4.2, 0.16, 3.8);
  const sRamp = new THREE.Mesh(rampGeo, woodMat);
  sRamp.position.set(0, deckY - 0.42, halfLen + 1.6);
  sRamp.rotation.x = 0.25;
  g.add(sRamp);
  const nRamp = new THREE.Mesh(rampGeo, woodMat);
  nRamp.position.set(0, deckY - 0.42, -halfLen - 1.6);
  nRamp.rotation.x = -0.25;
  g.add(nRamp);

  // Main catenary steel suspension cables + vertical hangers
  for (const sx of [-2.0, 2.0]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const pz = THREE.MathUtils.lerp(-10.8, 10.8, t);
      const sag = Math.sin(t * Math.PI) * 1.65;
      const py = deckY + 3.4 - sag;
      pts.push(new THREE.Vector3(sx, py, pz));
      if (i > 0 && i < 12 && i % 2 === 0) {
        const hangerLen = py - deckY;
        const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, hangerLen, 6), cableMat);
        hanger.position.set(sx, deckY + hangerLen * 0.5, pz);
        g.add(hanger);
      }
    }
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.04, 6, false),
      cableMat
    );
    cable.castShadow = true;
    g.add(cable);
  }

  scene.add(g);

  boxes.push({
    id: 'bridge_west_deck',
    minX: bx - halfWidth,
    maxX: bx + halfWidth,
    minY: deckY - 0.35,
    maxY: deckY + 0.08,
    minZ: cz - halfLen - 0.5,
    maxZ: cz + halfLen + 0.5,
    material: 'wood',
    isWalkableTop: true,
    penetrable: true,
  });
  boxes.push({
    id: 'bridge_west_rail_w',
    minX: bx - halfWidth - 0.25,
    maxX: bx - halfWidth + 0.12,
    minY: deckY,
    maxY: deckY + 1.15,
    minZ: cz - halfLen,
    maxZ: cz + halfLen,
    material: 'wood',
    penetrable: true,
  });
  boxes.push({
    id: 'bridge_west_rail_e',
    minX: bx + halfWidth - 0.12,
    maxX: bx + halfWidth + 0.25,
    minY: deckY,
    maxY: deckY + 1.15,
    minZ: cz - halfLen,
    maxZ: cz + halfLen,
    material: 'wood',
    penetrable: true,
  });
}

function buildEastPontoonBridge(
  bx: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const cz = riverCenterZ(bx);
  const g = new THREE.Group();
  g.position.set(bx, 0, cz);
  const deckY = 1.35;
  const halfLen = 11.4;
  const halfWidth = 2.25;

  const steelMat = new THREE.MeshStandardMaterial({
    map: tex.brushedSteel,
    color: '#525b52',
    roughness: 0.48,
    metalness: 0.72,
  });
  const floatMat = new THREE.MeshStandardMaterial({
    color: '#364535',
    roughness: 0.62,
    metalness: 0.45,
  });

  // Floating cylindrical steel pontoons
  const floatGeo = new THREE.CylinderGeometry(0.55, 0.55, 5.2, 12);
  floatGeo.rotateZ(Math.PI / 2);
  for (const pz of [-8.8, -4.4, 0, 4.4, 8.8]) {
    const fl = new THREE.Mesh(floatGeo, floatMat);
    fl.position.set(0, WATER_LEVEL + 0.18, pz);
    fl.castShadow = true;
    fl.receiveShadow = true;
    g.add(fl);
  }

  // Steel treadway deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.16, halfLen * 2), steelMat);
  deck.position.set(0, deckY - 0.04, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // Approach steel ramps
  const rampGeo = new THREE.BoxGeometry(4.4, 0.16, 3.8);
  const sRamp = new THREE.Mesh(rampGeo, steelMat);
  sRamp.position.set(0, deckY - 0.42, halfLen + 1.6);
  sRamp.rotation.x = 0.25;
  g.add(sRamp);
  const nRamp = new THREE.Mesh(rampGeo, steelMat);
  nRamp.position.set(0, deckY - 0.42, -halfLen - 1.6);
  nRamp.rotation.x = -0.25;
  g.add(nRamp);

  // Side steel guardrails
  for (const sx of [-2.14, 2.14]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, halfLen * 2), steelMat);
    rail.position.set(sx, deckY + 0.42, 0);
    rail.castShadow = true;
    g.add(rail);
  }

  scene.add(g);

  boxes.push({
    id: 'bridge_east_deck',
    minX: bx - halfWidth,
    maxX: bx + halfWidth,
    minY: deckY - 0.35,
    maxY: deckY + 0.08,
    minZ: cz - halfLen - 0.5,
    maxZ: cz + halfLen + 0.5,
    material: 'metal',
    isWalkableTop: true,
    penetrable: false,
  });
  boxes.push({
    id: 'bridge_east_rail_w',
    minX: bx - halfWidth - 0.25,
    maxX: bx - halfWidth + 0.12,
    minY: deckY,
    maxY: deckY + 1.15,
    minZ: cz - halfLen,
    maxZ: cz + halfLen,
    material: 'metal',
    penetrable: false,
  });
  boxes.push({
    id: 'bridge_east_rail_e',
    minX: bx + halfWidth - 0.12,
    maxX: bx + halfWidth + 0.25,
    minY: deckY,
    maxY: deckY + 1.15,
    minZ: cz - halfLen,
    maxZ: cz + halfLen,
    material: 'metal',
    penetrable: false,
  });
}

// Bespoke Landmarks for the 24 Kivu Combat Zones
function buildHelipadAndUtilityChopper(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const concMat = new THREE.MeshStandardMaterial({ map: tex.concretePad, roughness: 0.88 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.8, 0.22, 24), concMat);
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  g.add(pad);

  // Yellow "H" helipad markings
  const markMat = new THREE.MeshBasicMaterial({ color: '#eab308' });
  const hBarL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 4.2), markMat);
  hBarL.position.set(-1.3, 0.2, 0);
  const hBarR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 4.2), markMat);
  hBarR.position.set(1.3, 0.2, 0);
  const hCross = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.02, 0.45), markMat);
  hCross.position.set(0, 0.2, 0);
  g.add(hBarL, hBarR, hCross);

  // Parked Tactical Utility Helicopter frame (evac prop + cover)
  const hullMat = new THREE.MeshStandardMaterial({ map: tex.camoArmy, roughness: 0.48, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e2220', roughness: 0.5, metalness: 0.7 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#58787a', roughness: 0.14, clearcoat: 0.8 });

  const heli = new THREE.Group();
  heli.position.set(-1.2, 0.2, -1.0);
  heli.rotation.y = 0.65;
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 4.6), hullMat);
  fuse.position.set(0, 1.15, 0);
  fuse.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.2), glassMat);
  nose.position.set(0, 1.0, 2.5);
  const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 3.8), hullMat);
  tailBoom.position.set(0, 1.35, -3.9);
  tailBoom.castShadow = true;
  const rotorMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.6, 8), darkMat);
  rotorMast.position.set(0, 2.15, 0.2);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.04, 0.24), darkMat);
  blade1.position.set(0, 2.42, 0.2);
  blade1.rotation.y = 0.4;
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 8.2), darkMat);
  blade2.position.set(0, 2.42, 0.2);
  blade2.rotation.y = 0.4;
  for (const sx of [-0.95, 0.95]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 8), darkMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, 0.18, 0.2);
    heli.add(skid);
  }
  heli.add(fuse, nose, tailBoom, rotorMast, blade1, blade2);
  g.add(heli);
  scene.add(g);

  registerOrientedBoxCollider(boxes, 'heli_hull', x - 1.2, z - 1.0, 1.15, 2.6, baseY, baseY + 2.2, 0.65, 'metal', false);
}

function buildFuelSilosAndDepot(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  cylinders: ColliderCylinder[],
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const tankMat = new THREE.MeshStandardMaterial({
    map: tex.brushedSteel,
    color: '#888c82',
    roughness: 0.42,
    metalness: 0.68,
  });
  const rustBandMat = new THREE.MeshStandardMaterial({
    color: '#9e3b24',
    roughness: 0.6,
    metalness: 0.35,
  });

  const offsets: [number, number][] = [
    [-4.2, -2.5],
    [0.5, -3.2],
    [4.4, 1.8],
  ];
  offsets.forEach(([ox, oz], idx) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 4.4, 16), tankMat);
    tank.position.set(ox, 2.2, oz);
    tank.castShadow = true;
    tank.receiveShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.79, 1.79, 0.45, 16), rustBandMat);
    band.position.set(ox, 3.1, oz);
    g.add(tank, band);

    cylinders.push({
      id: `depot_silo_${idx}`,
      x: x + ox,
      z: z + oz,
      radius: 1.82,
      minY: baseY - 0.5,
      maxY: baseY + 4.5,
      material: 'metal',
      penetrable: false,
    });
  });

  scene.add(g);
  buildCrateCluster(x - 1.5, z + 3.2, 0.3, tex, scene, boxes, 'depot_crates');
}

function buildFishermanStiltVillage(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const woodMat = new THREE.MeshStandardMaterial({ map: tex.woodPlank, roughness: 0.88 });
  const tinMat = new THREE.MeshStandardMaterial({ map: tex.corrugatedMetal, roughness: 0.55, metalness: 0.58 });
  const huts: Array<[number, number, number]> = [
    [-6, -4, 0.25],
    [4, -5, -0.35],
    [-2, 5.5, 0.8],
  ];
  huts.forEach(([ox, oz, rot], idx) => {
    const hx = x + ox;
    const hz = z + oz;
    const hy = groundHeightAt(hx, hz);
    const g = new THREE.Group();
    g.position.set(hx, hy, hz);
    g.rotation.y = rot;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 3.4), woodMat);
    floor.position.y = 0.55;
    floor.castShadow = true;
    floor.receiveShadow = true;
    g.add(floor);

    for (const [px, pz] of [
      [-1.9, -1.5],
      [1.9, -1.5],
      [-1.9, 1.5],
      [1.9, 1.5],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.9, 7), woodMat);
      post.position.set(px, 1.45, pz);
      post.castShadow = true;
      g.add(post);
    }

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.9, 0.14), woodMat);
    wallBack.position.set(0, 1.5, -1.55);
    wallBack.castShadow = true;
    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 3.2), woodMat);
    wallLeft.position.set(-1.95, 1.5, 0);
    wallLeft.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 4.1), tinMat);
    roof.position.set(0, 2.95, 0);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    g.add(wallBack, wallLeft, roof);

    addContactShadow(g, tex.contactShadow, 2.4, 2.0, 0.03);
    scene.add(g);

    registerOrientedBoxCollider(boxes, `hut_${idx}_floor`, hx, hz, 2.1, 1.7, hy, hy + 0.65, rot, 'wood', true, true);
    registerOrientedBoxCollider(
      boxes,
      `hut_${idx}_back`,
      hx + 1.55 * Math.sin(rot),
      hz - 1.55 * Math.cos(rot),
      2.0,
      0.16,
      hy,
      hy + 2.6,
      rot,
      'wood',
      true
    );
  });
}

function buildMarketStalls(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const woodMat = new THREE.MeshStandardMaterial({ map: tex.woodPlank, roughness: 0.88 });
  const tarpColors = ['#b45309', '#1d4ed8', '#15803d', '#991b1b'];
  const stalls: Array<[number, number, number]> = [
    [-5.5, -2.5, 0.12],
    [3.5, -3.5, -0.2],
    [-4.2, 4.2, 0.4],
    [5.0, 3.6, -0.45],
  ];
  stalls.forEach(([ox, oz, rot], idx) => {
    const sx = x + ox;
    const sz = z + oz;
    const sy = groundHeightAt(sx, sz);
    const g = new THREE.Group();
    g.position.set(sx, sy, sz);
    g.rotation.y = rot;

    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.92, 1.05), woodMat);
    counter.position.set(0, 0.46, 0);
    counter.castShadow = true;
    counter.receiveShadow = true;
    g.add(counter);

    for (const px of [-1.45, 1.45]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), woodMat);
      post.position.set(px, 1.2, -0.45);
      g.add(post);
    }

    const tarpMat = new THREE.MeshStandardMaterial({
      color: tarpColors[idx % tarpColors.length],
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 2.1), tarpMat);
    awning.position.set(0, 2.35, 0.25);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    g.add(awning);

    addContactShadow(g, tex.contactShadow, 1.8, 0.9, 0.03);
    scene.add(g);

    registerOrientedBoxCollider(boxes, `market_stall_${idx}`, sx, sz, 1.65, 0.55, sy - 0.5, sy + 1.0, rot, 'wood', true);
  });
}

function buildMissionRuins(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const brickMat = new THREE.MeshStandardMaterial({ map: tex.brickWall, roughness: 0.92 });
  const concMat = new THREE.MeshStandardMaterial({ map: tex.concretePad, roughness: 0.9 });

  const wallSegments: Array<[number, number, number, number, number]> = [
    [-5.5, 0, 0.55, 3.6, 10.5],
    [5.5, -1.5, 0.55, 2.4, 7.5],
    [0, -5.2, 11.2, 3.8, 0.55],
    [-3.2, 5.0, 4.4, 1.8, 0.55],
    [3.6, 5.0, 3.6, 2.1, 0.55],
  ];
  wallSegments.forEach(([wx, wz, sx, sy, sz], idx) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), brickMat);
    w.position.set(wx, sy * 0.5, wz);
    w.castShadow = true;
    w.receiveShadow = true;
    g.add(w);
    boxes.push({
      id: `mission_wall_${idx}`,
      minX: x + wx - sx * 0.5,
      maxX: x + wx + sx * 0.5,
      minY: baseY - 0.5,
      maxY: baseY + sy,
      minZ: z + wz - sz * 0.5,
      maxZ: z + wz + sz * 0.5,
      material: 'rock',
      penetrable: false,
    });
  });

  // Ruined bell tower corner
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.2, 2.6), brickMat);
  tower.position.set(-5.2, 3.1, -4.8);
  tower.castShadow = true;
  tower.receiveShadow = true;
  const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.16, 10.6), concMat);
  floorSlab.position.set(0, 0.06, 0);
  floorSlab.receiveShadow = true;
  g.add(tower, floorSlab);

  boxes.push({
    id: 'mission_tower',
    minX: x - 6.5,
    maxX: x - 3.9,
    minY: baseY - 0.5,
    maxY: baseY + 6.2,
    minZ: z - 6.1,
    maxZ: z - 3.5,
    material: 'rock',
    penetrable: false,
  });

  scene.add(g);
}

function buildWarehouse(
  x: number,
  z: number,
  rotY: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[],
  idPrefix: string
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const concMat = new THREE.MeshStandardMaterial({ map: tex.concretePad, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ map: tex.corrugatedMetal, roughness: 0.58, metalness: 0.55 });
  const steelMat = new THREE.MeshStandardMaterial({ map: tex.brushedSteel, roughness: 0.45, metalness: 0.7 });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.22, 8.2), concMat);
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  g.add(pad);

  const backW = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3.8, 0.24), wallMat);
  backW.position.set(0, 1.9, -3.85);
  backW.castShadow = true;
  backW.receiveShadow = true;
  const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.8, 7.8), wallMat);
  leftW.position.set(-5.0, 1.9, 0);
  leftW.castShadow = true;
  const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.8, 7.8), wallMat);
  rightW.position.set(5.0, 1.9, 0);
  rightW.castShadow = true;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.16, 8.6), steelMat);
  roof.position.set(0, 4.0, 0);
  roof.rotation.x = 0.06;
  roof.castShadow = true;
  g.add(backW, leftW, rightW, roof);

  scene.add(g);

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  registerOrientedBoxCollider(
    boxes,
    `${idPrefix}_back`,
    x + 3.85 * sin,
    z - 3.85 * cos,
    5.1,
    0.2,
    baseY,
    baseY + 3.8,
    rotY,
    'metal',
    false
  );
  registerOrientedBoxCollider(
    boxes,
    `${idPrefix}_left`,
    x - 5.0 * cos,
    z - 5.0 * sin,
    0.2,
    3.9,
    baseY,
    baseY + 3.8,
    rotY,
    'metal',
    false
  );
  registerOrientedBoxCollider(
    boxes,
    `${idPrefix}_right`,
    x + 5.0 * cos,
    z + 5.0 * sin,
    0.2,
    3.9,
    baseY,
    baseY + 3.8,
    rotY,
    'metal',
    false
  );
}

function buildRadioRelayMast(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const steelMat = new THREE.MeshStandardMaterial({ map: tex.brushedSteel, roughness: 0.4, metalness: 0.78 });
  const redWhiteMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.55 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });

  for (const [lx, lz] of [
    [-1.1, -1.1],
    [1.1, -1.1],
    [-1.1, 1.1],
    [1.1, 1.1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 15.0, 6), steelMat);
    leg.position.set(lx * 0.65, 7.5, lz * 0.65);
    leg.rotation.z = lx * 0.038;
    leg.rotation.x = -lz * 0.038;
    leg.castShadow = true;
    g.add(leg);
  }
  for (let h = 2.5; h <= 13; h += 2.6) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.4), h > 9 ? redWhiteMat : steelMat);
    ring.position.y = h;
    g.add(ring);
  }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.25, 0.45, 14), steelMat);
  dish.rotation.x = Math.PI / 2.6;
  dish.position.set(0, 11.5, 0.65);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), beaconMat);
  beacon.position.y = 15.2;
  g.add(dish, beacon);

  // Generator bunker beside mast
  const bunker = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2.2, 2.8),
    new THREE.MeshStandardMaterial({ map: tex.concretePad, roughness: 0.9 })
  );
  bunker.position.set(3.5, 1.1, 0);
  bunker.castShadow = true;
  bunker.receiveShadow = true;
  g.add(bunker);

  scene.add(g);
  boxes.push({
    id: 'radio_bunker',
    minX: x + 1.8,
    maxX: x + 5.2,
    minY: baseY - 0.5,
    maxY: baseY + 2.2,
    minZ: z - 1.4,
    maxZ: z + 1.4,
    material: 'rock',
    penetrable: false,
  });
}

function buildPumpStationAndPipes(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const brickMat = new THREE.MeshStandardMaterial({ map: tex.brickWall, roughness: 0.9 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: '#3b525e', roughness: 0.42, metalness: 0.72 });

  const house = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.0, 4.4), brickMat);
  house.position.set(0, 1.5, 0);
  house.castShadow = true;
  house.receiveShadow = true;
  g.add(house);

  for (const px of [-1.4, 1.4]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 8.5, 10), pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(px, 0.65, 4.8);
    pipe.castShadow = true;
    g.add(pipe);
  }

  scene.add(g);
  boxes.push({
    id: 'pump_house',
    minX: x - 2.8,
    maxX: x + 2.8,
    minY: baseY - 0.5,
    maxY: baseY + 3.0,
    minZ: z - 2.2,
    maxZ: z + 2.2,
    material: 'rock',
    penetrable: false,
  });
}

function buildSawmillLogStacks(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const barkMat = new THREE.MeshStandardMaterial({ map: tex.barkAlbedo, bumpMap: tex.barkBump, bumpScale: 0.08, roughness: 0.92 });
  const tinMat = new THREE.MeshStandardMaterial({ map: tex.corrugatedMetal, roughness: 0.56, metalness: 0.55 });
  const logGeo = new THREE.CylinderGeometry(0.32, 0.34, 4.6, 10);
  logGeo.rotateZ(Math.PI / 2);

  for (const stackOffset of [
    [-3.5, -2.5],
    [3.8, 2.2],
  ]) {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3 - r; c++) {
        const log = new THREE.Mesh(logGeo, barkMat);
        log.position.set(stackOffset[0], 0.32 + r * 0.55, stackOffset[1] + (c - (2 - r) * 0.5) * 0.66);
        log.castShadow = true;
        log.receiveShadow = true;
        g.add(log);
      }
    }
    boxes.push({
      id: `sawmill_logs_${stackOffset[0]}`,
      minX: x + stackOffset[0] - 2.3,
      maxX: x + stackOffset[0] + 2.3,
      minY: baseY - 0.5,
      maxY: baseY + 1.25,
      minZ: z + stackOffset[1] - 1.1,
      maxZ: z + stackOffset[1] + 1.1,
      material: 'wood',
      penetrable: true,
    });
  }

  // Sawmill open shed
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.12, 4.5), tinMat);
  roof.position.set(0, 3.1, -5.5);
  roof.castShadow = true;
  g.add(roof);
  for (const [px, pz] of [
    [-2.8, -7.4],
    [2.8, -7.4],
    [-2.8, -3.6],
    [2.8, -3.6],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.1, 7), barkMat);
    post.position.set(px, 1.55, pz);
    g.add(post);
  }

  scene.add(g);
}

function buildTeaPlantationHedges(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const hedgeMat = new THREE.MeshStandardMaterial({
    color: '#3f6a27',
    map: tex.grassBlade,
    roughness: 0.88,
  });
  for (let row = -2; row <= 2; row++) {
    const hx = x + row * 4.2;
    const hz = z;
    const hy = groundHeightAt(hx, hz);
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 13.5), hedgeMat);
    hedge.position.set(hx, hy + 0.52, hz);
    hedge.castShadow = true;
    hedge.receiveShadow = true;
    scene.add(hedge);
    if (row % 2 === 0) {
      boxes.push({
        id: `tea_row_${row}`,
        minX: hx - 0.7,
        maxX: hx + 0.7,
        minY: hy - 0.5,
        maxY: hy + 1.05,
        minZ: hz - 6.75,
        maxZ: hz + 6.75,
        material: 'wood',
        penetrable: true,
      });
    }
  }
}

function buildArtilleryBattery(
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  boxes: ColliderBox[]
) {
  const steelMat = new THREE.MeshStandardMaterial({ map: tex.brushedSteel, roughness: 0.45, metalness: 0.7 });
  const offsets: [number, number][] = [
    [-5.5, 0],
    [5.5, 1.5],
  ];
  offsets.forEach(([ox, oz], idx) => {
    const gx = x + ox;
    const gz = z + oz;
    const gy = groundHeightAt(gx, gz);
    const g = new THREE.Group();
    g.position.set(gx, gy, gz);
    g.rotation.y = Math.PI + (idx === 0 ? 0.12 : -0.15);

    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 2.2), steelMat);
    carriage.position.y = 0.52;
    carriage.castShadow = true;
    const shield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.35, 0.14), steelMat);
    shield.position.set(0, 1.0, 0.85);
    shield.castShadow = true;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.8, 12), steelMat);
    barrel.rotation.x = Math.PI / 2 - 0.24;
    barrel.position.set(0, 1.45, 2.0);
    barrel.castShadow = true;
    g.add(carriage, shield, barrel);
    scene.add(g);

    buildSandbagWall(gx, gz - 2.6, 0, 4.4, 3, tex, scene, boxes, `artillery_sb_${idx}`);
    boxes.push({
      id: `artillery_gun_${idx}`,
      minX: gx - 1.1,
      maxX: gx + 1.1,
      minY: gy - 0.5,
      maxY: gy + 1.6,
      minZ: gz - 1.2,
      maxZ: gz + 1.2,
      material: 'metal',
      penetrable: false,
    });
  });
}

function buildExplosiveBarrel(
  id: string,
  x: number,
  z: number,
  tex: ProceduralTexturePack,
  scene: THREE.Scene,
  cylinders: ColliderCylinder[]
): ExplosiveBarrel {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z);
  g.position.set(x, baseY, z);

  const redDrumMat = new THREE.MeshStandardMaterial({
    color: '#9e261f',
    roughness: 0.45,
    metalness: 0.55,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: '#d49a2a',
    roughness: 0.5,
    metalness: 0.4,
  });

  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.36, 0),
    new THREE.Vector2(0.36, 0.32),
    new THREE.Vector2(0.39, 0.35),
    new THREE.Vector2(0.36, 0.38),
    new THREE.Vector2(0.36, 0.72),
    new THREE.Vector2(0.39, 0.75),
    new THREE.Vector2(0.36, 0.78),
    new THREE.Vector2(0.36, 1.08),
    new THREE.Vector2(0, 1.08),
  ];
  const drum = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), redDrumMat);
  drum.castShadow = true;
  drum.receiveShadow = true;
  g.add(drum);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.372, 0.372, 0.16, 18), bandMat);
  stripe.position.y = 0.55;
  g.add(stripe);

  addContactShadow(g, tex.contactShadow, 0.55, 0.55, 0.02);
  scene.add(g);

  const collider: ColliderCylinder = {
    id,
    x,
    z,
    radius: 0.44,
    minY: baseY - 0.3,
    maxY: baseY + 1.15,
    material: 'metal',
    penetrable: false,
  };
  cylinders.push(collider);

  return {
    id,
    position: new THREE.Vector3(x, baseY + 0.54, z),
    radius: 0.44,
    height: 1.1,
    hp: 45,
    exploded: false,
    mesh: g,
    collider,
  };
}

function buildSectorFlagpole(
  id: string,
  name: string,
  x: number,
  z: number,
  initialOwner: 'army' | 'rebels' | 'neutral',
  initialProgress: number,
  scene: THREE.Scene,
  yOverride?: number
): SectorState {
  const y = yOverride ?? groundHeightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const poleMat = new THREE.MeshStandardMaterial({
    color: '#6b706c',
    roughness: 0.4,
    metalness: 0.75,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: '#3c403c',
    roughness: 0.85,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.25, 10), baseMat);
  base.position.y = 0.12;
  g.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 6.2, 8), poleMat);
  pole.position.y = 3.1;
  pole.castShadow = true;
  g.add(pole);

  const flagMat = new THREE.MeshStandardMaterial({
    color: initialOwner === 'army' ? '#3b82f6' : initialOwner === 'rebels' ? '#ef4444' : '#d6d3d1',
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.0, 6, 2), flagMat);
  flag.position.set(0.9, 5.4, 0);
  g.add(flag);

  const ringMat = new THREE.MeshBasicMaterial({
    color: initialOwner === 'army' ? '#3b82f6' : initialOwner === 'rebels' ? '#ef4444' : '#eab308',
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 36), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);

  scene.add(g);

  return {
    id,
    name,
    position: new THREE.Vector3(x, y, z),
    radius: 11.0,
    owner: initialOwner,
    progress: initialProgress,
    active: true,
    flagMesh: flag,
    poleGroup: g,
    lightRing: ring,
  };
}

// Clean Multi-Part Tree Geometries (Trunk + 3 Forked Branches, Alpha-Tested Leaf Cards)
function createCleanTreeTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunkPts = [
    new THREE.Vector2(0.58, 0),
    new THREE.Vector2(0.36, 1.0),
    new THREE.Vector2(0.28, 3.4),
    new THREE.Vector2(0.21, 5.6),
    new THREE.Vector2(0.11, 7.2),
  ];
  parts.push(new THREE.LatheGeometry(trunkPts, 8));

  const branchAngles = [0.2, 2.25, 4.35];
  branchAngles.forEach((ang, idx) => {
    const len = 2.8 + idx * 0.25;
    const bGeo = new THREE.CylinderGeometry(0.06, 0.15, len, 6);
    bGeo.translate(0, len * 0.5, 0);
    bGeo.rotateZ(0.68);
    bGeo.rotateY(ang);
    bGeo.translate(0, 4.9 + idx * 0.35, 0);
    parts.push(bGeo);
  });

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged || new THREE.CylinderGeometry(0.15, 0.45, 7.2, 8);
}

function createCleanCanopyClusterGeometry(): THREE.BufferGeometry {
  const cards: THREE.BufferGeometry[] = [];
  const specs: Array<[number, number, number, number, number, number, number]> = [
    // [x, y, z, rx, ry, rz, size]
    [0, 0, 0, 0.15, 0.2, 0.1, 3.6],
    [0, 0.2, 0, -0.18, 1.75, -0.08, 3.5],
    [1.45, -0.35, 0.85, 0.32, 0.8, 0.15, 2.8],
    [-1.4, -0.3, 0.9, 0.28, -0.7, -0.18, 2.8],
    [0.15, -0.4, -1.55, -0.34, 0.2, 0.12, 2.8],
    [0.1, 0.85, 0.05, 1.28, 0.4, 0.0, 2.9],
  ];
  for (const [cx, cy, cz, rx, ry, rz, sz] of specs) {
    const p1 = new THREE.PlaneGeometry(sz, sz * 0.85);
    p1.rotateX(rx);
    p1.rotateY(ry);
    p1.rotateZ(rz);
    p1.translate(cx, cy, cz);
    cards.push(p1);
  }
  const merged = mergeGeometries(cards, false);
  cards.forEach((c) => c.dispose());
  return merged || new THREE.PlaneGeometry(3.2, 3.2);
}

// Real-Shaped 7-Blade Curved Grass Tuft BufferGeometry (tapered arched blades with vertex colors)
function createRealGrassTuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const bladeCount = 7;

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2 + (b % 2) * 0.22;
    const height = 0.36 + (b % 3) * 0.14;
    const width = 0.065;
    const lean = 0.16 + (b % 2) * 0.11;
    const radialOffset = 0.06 + (b % 3) * 0.04;

    const segs = 3;
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpX = -sinA;
    const perpZ = cosA;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = height * t;
      const w = width * (1 - t * 0.92);
      const arch = t * t * lean;
      const cx = cosA * (radialOffset + arch);
      const cz = sinA * (radialOffset + arch);

      // Dark root -> vibrant tip vertex color gradient
      const rCol = THREE.MathUtils.lerp(0.45, 1.0, t);
      const gCol = THREE.MathUtils.lerp(0.52, 1.0, t);
      const bCol = THREE.MathUtils.lerp(0.42, 0.9, t);

      positions.push(cx - perpX * w, y, cz - perpZ * w);
      positions.push(cx + perpX * w, y, cz + perpZ * w);
      uvs.push(0, t, 1, t);
      colors.push(rCol, gCol, bCol, rCol, gCol, bCol);

      if (s < segs) {
        const i0 = s * 2;
        indices.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    blades.push(g);
  }

  const merged = mergeGeometries(blades, false);
  blades.forEach((g) => g.dispose());
  return merged || new THREE.PlaneGeometry(0.2, 0.4);
}

// Tall Curved Riverside Reed Cluster BufferGeometry
function createRiverReedTuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const stalkCount = 6;
  for (let b = 0; b < stalkCount; b++) {
    const angle = (b / stalkCount) * Math.PI * 2;
    const height = 1.05 + (b % 3) * 0.25;
    const width = 0.048;
    const lean = 0.26 + (b % 2) * 0.14;
    const segs = 4;

    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpX = -sinA;
    const perpZ = cosA;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = height * t;
      const w = width * (1 - t * 0.88);
      const arch = t * t * lean;
      const cx = cosA * (0.08 + arch);
      const cz = sinA * (0.08 + arch);

      const shade = THREE.MathUtils.lerp(0.4, 1.0, t);
      positions.push(cx - perpX * w, y, cz - perpZ * w);
      positions.push(cx + perpX * w, y, cz + perpZ * w);
      uvs.push(0, t, 1, t);
      colors.push(shade * 0.88, shade, shade * 0.72, shade * 0.88, shade, shade * 0.72);

      if (s < segs) {
        const i0 = s * 2;
        indices.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    blades.push(g);
  }
  const merged = mergeGeometries(blades, false);
  blades.forEach((g) => g.dispose());
  return merged || new THREE.PlaneGeometry(0.15, 1.0);
}

// Curved Tropical River Palm Geometry (curved trunk + arched fronds)
function createPalmFrondCrownGeometry(): THREE.BufferGeometry {
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const segs = 4;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const px = -sinA;
    const pz = cosA;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const r = t * 2.55;
      const y = Math.sin(t * Math.PI * 0.65) * 0.55 - t * t * 0.85;
      const w = Math.sin(Math.max(0.08, t) * Math.PI) * 0.42;
      positions.push(cosA * r - px * w, y, sinA * r - pz * w);
      positions.push(cosA * r + px * w, y, sinA * r + pz * w);
      uvs.push(0, t, 1, t);
      if (s < segs) {
        const i0 = s * 2;
        indices.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fg.setIndex(indices);
    fg.computeVertexNormals();
    fronds.push(fg);
  }
  const merged = mergeGeometries(fronds, false);
  fronds.forEach((f) => f.dispose());
  return merged || new THREE.PlaneGeometry(2.5, 2.5);
}

export function buildWorldEnvironment(
  scene: THREE.Scene,
  textures: ProceduralTexturePack
): WorldBuildResult {
  const boxColliders: ColliderBox[] = [];
  const cylinderColliders: ColliderCylinder[] = [];
  const barrels: ExplosiveBarrel[] = [];
  const coverPoints: THREE.Vector3[] = [];
  const rand = seededRand(20261117);

  // 1. All 3 Tactical Bridges spanning the Kivu River (-76, 0, +78)
  buildWestSuspensionBridge(-76, textures, scene, boxColliders);
  buildCentralTimberBridge(0, textures, scene, boxColliders);
  buildEastPontoonBridge(78, textures, scene, boxColliders);

  // 2. Build Landmarks & Tactical Cover across all 24 Zones!
  // South Bank Zones (10)
  buildCommandShelter(-10, 108, 0.15, 'army', textures, scene, boxColliders); // Z1 QG Armée Sud
  buildMilitaryPickup(-2, 102, 0.42, textures, scene, boxColliders, 'qg_pickup');
  buildSandbagWall(-10, 96, 0.05, 5.2, 3, textures, scene, boxColliders, 'sb_qg_front');

  buildHelipadAndUtilityChopper(44, 112, textures, scene, boxColliders); // Z2 Héliport du Kivu
  buildFuelSilosAndDepot(-74, 96, textures, scene, cylinderColliders, boxColliders); // Z3 Dépôt Carburant Sud
  buildSandbagWall(-116, 84, 0.35, 4.4, 3, textures, scene, boxColliders, 'sb_ravin_o'); // Z4 Ravin Basaltique Ouest
  buildArtilleryBattery(96, 94, textures, scene, boxColliders); // Z5 Batterie d'Artillerie Est

  buildFishermanStiltVillage(-112, 48, textures, scene, boxColliders); // Z6 Village de Pêcheurs
  buildSandbagWall(-50, 44, 0.25, 5.0, 3, textures, scene, boxColliders, 'sb_tranchee_1'); // Z7 Tranchées SO
  buildSandbagWall(-46, 52, -0.25, 4.6, 3, textures, scene, boxColliders, 'sb_tranchee_2');
  buildMarketStalls(12, 52, textures, scene, boxColliders); // Z8 Marché du Carrefour
  buildTeaPlantationHedges(68, 66, textures, scene, boxColliders); // Z9 Plantation de Thé
  buildSawmillLogStacks(118, 42, textures, scene, boxColliders); // Z10 Scierie Forestière

  // River Line Approach Defenses (7 Zones)
  buildSandbagWall(-4.2, 22.5, 0.15, 4.4, 3, textures, scene, boxColliders, 'sb_army_bridge_w');
  buildSandbagWall(5.2, 21.8, -0.2, 4.0, 3, textures, scene, boxColliders, 'sb_army_bridge_e');
  buildSandbagWall(-76, riverCenterZ(-76) + 16.5, 0.12, 4.0, 3, textures, scene, boxColliders, 'sb_west_bridge_s');
  buildSandbagWall(-76, riverCenterZ(-76) - 16.5, -0.12, 4.0, 3, textures, scene, boxColliders, 'sb_west_bridge_n');
  buildSandbagWall(78, riverCenterZ(78) + 16.5, -0.12, 4.0, 3, textures, scene, boxColliders, 'sb_east_bridge_s');
  buildSandbagWall(78, riverCenterZ(78) - 16.5, 0.12, 4.0, 3, textures, scene, boxColliders, 'sb_east_bridge_n');
  buildSandbagWall(-37.0, 16.5, 0.1, 3.5, 3, textures, scene, boxColliders, 'sb_ford_w_s');
  buildSandbagWall(-39.5, -18.0, -0.15, 3.5, 3, textures, scene, boxColliders, 'sb_ford_w_n');
  buildSandbagWall(37.5, 16.0, -0.1, 3.5, 3, textures, scene, boxColliders, 'sb_ford_e_s');
  buildSandbagWall(39.0, -17.5, 0.15, 3.5, 3, textures, scene, boxColliders, 'sb_ford_e_n');
  buildCrateCluster(22, 2, 0.4, textures, scene, boxColliders, 'crates_river_islet'); // Z14 Îlot Fluvial
  buildPumpStationAndPipes(118, -8, textures, scene, boxColliders); // Z17 Station de Pompage

  // North Bank Zones (7)
  buildMissionRuins(-66, -54, textures, scene, boxColliders); // Z18 Ruines de la Mission
  buildConcreteBarrier(-114, -66, 0.15, textures, scene, boxColliders, 'douane_bar_1'); // Z19 Poste Douanier NO
  buildConcreteBarrier(-118, -70, -0.2, textures, scene, boxColliders, 'douane_bar_2');
  buildWatchtower(-112, -72, 0.3, textures, scene, boxColliders);
  buildWatchtower(42, -48, -0.35, textures, scene, boxColliders); // Z20 Mirador de la Crête
  buildSandbagWall(40, -41, 0.2, 4.4, 3, textures, scene, boxColliders, 'sb_mirador');
  buildWarehouse(-16, -74, 0.1, textures, scene, boxColliders, 'ammo_wh'); // Z21 Entrepôt de Munitions
  buildCrateCluster(-16, -72, 0.35, textures, scene, boxColliders, 'ammo_crates_in');
  buildCrateCluster(80, -80, 0.6, textures, scene, boxColliders, 'quarry_crates'); // Z22 Carrière de Latérite
  buildConcreteBarrier(77, -76, 0.4, textures, scene, boxColliders, 'quarry_bar');
  buildCommandShelter(10, -108, Math.PI - 0.15, 'rebels', textures, scene, boxColliders); // Z23 Campement Rebelle Nord
  buildWatchtower(19, -104, Math.PI, textures, scene, boxColliders);
  buildRadioRelayMast(118, -110, textures, scene, boxColliders); // Z24 Relais Radio Colline Nord

  // Forward Bridgehead Crates & Cover
  buildSandbagWall(-5.2, -21.5, -0.18, 4.2, 3, textures, scene, boxColliders, 'sb_rebel_bridge_w');
  buildSandbagWall(4.8, -22.2, 0.22, 4.2, 3, textures, scene, boxColliders, 'sb_rebel_bridge_e');
  buildCrateCluster(-6.0, 34.0, 0.5, textures, scene, boxColliders, 'crates_army_1');
  buildCrateCluster(-11.0, -36.0, 0.2, textures, scene, boxColliders, 'crates_rebel_1');

  // Register AI Tactical Cover Points across the expanded valley
  const tacticalCoverCoords: [number, number][] = [
    [-4.2, 24.5],
    [5.2, 23.8],
    [-10, 98],
    [42, 108],
    [-72, 92],
    [-114, 82],
    [94, 90],
    [-110, 46],
    [-48, 47],
    [12, 50],
    [66, 62],
    [116, 40],
    [-76, 18],
    [78, 18],
    [-37.0, 18.5],
    [37.5, 18.0],
    [-5.2, -23.5],
    [4.8, -24.2],
    [-66, -50],
    [-114, -64],
    [42, -43],
    [-16, -70],
    [80, -76],
    [10, -102],
    [116, -106],
  ];
  for (const [cx, cz] of tacticalCoverCoords) {
    coverPoints.push(new THREE.Vector3(cx, groundHeightAt(cx, cz), cz));
  }

  // 3. Explosive Fuel Drums across industrial & crossing zones
  const barrelCoords: [number, number][] = [
    [3.8, 19.6],
    [-4.6, -19.4],
    [-35.0, 15.2],
    [35.5, -16.2],
    [-73.5, 92.5],
    [-76.5, 98.5],
    [47.0, 108.5],
    [94.0, 91.0],
    [114.5, -6.5],
    [-13.5, -72.0],
    [-18.5, -75.0],
    [77.0, -82.0],
    [-74.0, 15.0],
    [76.0, -15.5],
  ];
  barrelCoords.forEach(([bx, bz], idx) => {
    barrels.push(buildExplosiveBarrel(`barrel_${idx}`, bx, bz, textures, scene, cylinderColliders));
  });

  // 4. Five Tactical Capture Sectors (Mode-activated dynamically by GameEngine)
  const sectors: SectorState[] = [
    buildSectorFlagpole('A', 'Marché du Carrefour', 12.0, 52.0, 'army', 100, scene),
    buildSectorFlagpole('B', 'Pont Suspendu Ouest', -76.0, riverCenterZ(-76), 'neutral', 0, scene, 1.38),
    buildSectorFlagpole('C', 'Pont Central en Bois', 0.0, riverCenterZ(0), 'neutral', 0, scene, 1.38),
    buildSectorFlagpole('D', 'Ponton Tactique Est', 78.0, riverCenterZ(78), 'neutral', 0, scene, 1.38),
    buildSectorFlagpole('E', 'Entrepôt de Munitions', -16.0, -74.0, 'rebels', -100, scene),
  ];

  // 5. Clean Multi-Part Rainforest Trees (Root-Flared Trunk + Forked Branches + Alpha-Tested Leaf Cards)
  const treePositions: Array<{ x: number; z: number; scale: number; rotY: number }> = [];
  const exclusionZones: Array<[number, number, number]> = [
    [-10, 108, 14],
    [44, 112, 16],
    [-74, 96, 12],
    [96, 94, 12],
    [-112, 48, 14],
    [12, 52, 13],
    [68, 66, 13],
    [118, 42, 13],
    [118, -8, 12],
    [-66, -54, 14],
    [-116, -68, 13],
    [42, -48, 11],
    [-16, -74, 14],
    [80, -80, 14],
    [10, -108, 14],
    [118, -110, 13],
  ];

  for (let i = 0; i < 1200 && treePositions.length < 305; i++) {
    const x = (rand() - 0.5) * 355;
    const z = (rand() - 0.5) * 355;
    const rcZ = riverCenterZ(x);
    const rHalf = riverHalfWidth(x);
    const rx = roadCenterX(z);

    if (Math.abs(z - rcZ) < rHalf + 4.0) continue;
    if (Math.abs(x - rx) < 5.2 && Math.abs(z) < 115) continue;
    if (Math.abs(x + 76) < 4.5 && Math.abs(z - riverCenterZ(-76)) < 19) continue;
    if (Math.abs(x) < 5.0 && Math.abs(z - riverCenterZ(0)) < 19) continue;
    if (Math.abs(x - 78) < 4.5 && Math.abs(z - riverCenterZ(78)) < 19) continue;

    let blocked = false;
    for (let e = 0; e < exclusionZones.length; e++) {
      const [ex, ez, er] = exclusionZones[e];
      if (Math.hypot(x - ex, z - ez) < er) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (let t = 0; t < treePositions.length; t++) {
      if (Math.hypot(treePositions[t].x - x, treePositions[t].z - z) < 6.2) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    treePositions.push({
      x,
      z,
      scale: 0.85 + rand() * 0.48,
      rotY: rand() * Math.PI * 2,
    });
  }

  const trunkGeo = createCleanTreeTrunkGeometry();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.barkAlbedo,
    bumpMap: textures.barkBump,
    bumpScale: 0.14,
    roughness: 0.94,
    metalness: 0.02,
  });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  const canopyGeo = createCleanCanopyClusterGeometry();
  const canopyMat = new THREE.MeshStandardMaterial({
    map: textures.foliageLeaf,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.82,
    metalness: 0.02,
  });
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length * 2);
  canopyInst.castShadow = true;
  canopyInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const canopyPalette = ['#b8d8a2', '#cde4b0', '#9ec989', '#d9eab8', '#a8cf91'];

  treePositions.forEach((tp, idx) => {
    const gy = groundHeightAt(tp.x, tp.z);
    dummy.position.set(tp.x, gy - 0.15, tp.z);
    dummy.rotation.set(0, tp.rotY, 0);
    dummy.scale.setScalar(tp.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    // Lower & Upper organically offset foliage leaf-card clusters
    dummy.position.set(
      tp.x + Math.sin(tp.rotY) * 0.4,
      gy + 6.75 * tp.scale,
      tp.z + Math.cos(tp.rotY) * 0.4
    );
    dummy.rotation.set(0.05, tp.rotY + 0.4, -0.05);
    dummy.scale.setScalar(tp.scale * 1.15);
    dummy.updateMatrix();
    canopyInst.setMatrixAt(idx * 2, dummy.matrix);

    dummy.position.set(
      tp.x - Math.sin(tp.rotY) * 0.35,
      gy + 8.35 * tp.scale,
      tp.z - Math.cos(tp.rotY) * 0.35
    );
    dummy.rotation.set(-0.04, tp.rotY + 1.9, 0.05);
    dummy.scale.setScalar(tp.scale * 0.92);
    dummy.updateMatrix();
    canopyInst.setMatrixAt(idx * 2 + 1, dummy.matrix);

    cTmp.set(canopyPalette[idx % canopyPalette.length]);
    cTmp.offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.06);
    canopyInst.setColorAt(idx * 2, cTmp);
    cTmp.offsetHSL(0, 0, 0.04);
    canopyInst.setColorAt(idx * 2 + 1, cTmp);

    if (Math.abs(tp.x) < 152 && Math.abs(tp.z) < 152) {
      cylinderColliders.push({
        id: `tree_${idx}`,
        x: tp.x,
        z: tp.z,
        radius: 0.4 * tp.scale,
        minY: gy - 0.5,
        maxY: gy + 7.2 * tp.scale,
        material: 'wood',
        penetrable: true,
      });
    }
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  scene.add(trunkInst, canopyInst);

  // 5b. Curved Riverbank Palm Trees (TubeGeometry curved trunk + arched palm fronds)
  const palmPositions: Array<{ x: number; z: number; rotY: number; scale: number }> = [];
  for (let i = 0; i < 64 && palmPositions.length < 28; i++) {
    const px = -140 + rand() * 280;
    const side = i % 2 === 0 ? 1 : -1;
    const pz = riverCenterZ(px) + side * (riverHalfWidth(px) + 2.4 + rand() * 4.5);
    if (Math.abs(px + 76) < 7 || Math.abs(px) < 7 || Math.abs(px - 78) < 7) continue;
    palmPositions.push({ x: px, z: pz, rotY: rand() * Math.PI * 2, scale: 0.85 + rand() * 0.35 });
  }
  const palmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.45, 2.2, 0.15),
    new THREE.Vector3(1.15, 4.4, 0.3),
    new THREE.Vector3(1.5, 6.2, 0.25),
  ]);
  const palmTrunkGeo = new THREE.TubeGeometry(palmCurve, 10, 0.19, 7, false);
  const palmFrondGeo = createPalmFrondCrownGeometry();
  const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, trunkMat, palmPositions.length);
  const palmFrondInst = new THREE.InstancedMesh(
    palmFrondGeo,
    new THREE.MeshStandardMaterial({
      map: textures.grassBlade,
      color: '#6ca344',
      roughness: 0.78,
      side: THREE.DoubleSide,
    }),
    palmPositions.length
  );
  palmTrunkInst.castShadow = true;
  palmFrondInst.castShadow = true;

  palmPositions.forEach((pp, idx) => {
    const gy = groundHeightAt(pp.x, pp.z);
    dummy.position.set(pp.x, gy - 0.1, pp.z);
    dummy.rotation.set(0, pp.rotY, 0);
    dummy.scale.setScalar(pp.scale);
    dummy.updateMatrix();
    palmTrunkInst.setMatrixAt(idx, dummy.matrix);

    const tip = new THREE.Vector3(1.5 * pp.scale, 6.15 * pp.scale, 0.25 * pp.scale).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      pp.rotY
    );
    dummy.position.set(pp.x + tip.x, gy + tip.y, pp.z + tip.z);
    dummy.rotation.set(0, pp.rotY + idx, 0);
    dummy.scale.setScalar(pp.scale);
    dummy.updateMatrix();
    palmFrondInst.setMatrixAt(idx, dummy.matrix);
  });
  palmTrunkInst.instanceMatrix.needsUpdate = true;
  palmFrondInst.instanceMatrix.needsUpdate = true;
  scene.add(palmTrunkInst, palmFrondInst);

  // 6. Instanced Volcanic Basalt Rocks & Ravin Boulders
  const rockPositions: Array<{ x: number; z: number; sx: number; sy: number; sz: number; rotY: number }> = [];
  for (let i = 0; i < 185; i++) {
    const isBasaltRavine = i < 24;
    const x = isBasaltRavine ? -120 + (rand() - 0.5) * 34 : (rand() - 0.5) * 305;
    const z = isBasaltRavine ? 86 + (rand() - 0.5) * 32 : (rand() - 0.5) * 305;
    if (Math.abs(x) < 6 && Math.abs(z) < 16) continue;
    const rcZ = riverCenterZ(x);
    if (Math.abs(z - rcZ) < 2.2) continue;
    const s = (isBasaltRavine ? 1.1 : 0.7) + rand() * 1.45;
    rockPositions.push({
      x,
      z,
      sx: s * (0.85 + rand() * 0.5),
      sy: s * (0.6 + rand() * 0.55),
      sz: s * (0.85 + rand() * 0.5),
      rotY: rand() * Math.PI * 2,
    });
  }

  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rockSurface,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  rockPositions.forEach((rp, idx) => {
    const gy = groundHeightAt(rp.x, rp.z);
    if (gy < WATER_LEVEL - 0.45) {
      dummy.scale.set(0, 0, 0);
    } else {
      dummy.position.set(rp.x, gy + rp.sy * 0.35, rp.z);
      dummy.rotation.set(rand() * 0.3, rp.rotY, rand() * 0.3);
      dummy.scale.set(rp.sx, rp.sy, rp.sz);
      if (Math.abs(rp.x) < 145 && Math.abs(rp.z) < 145 && rp.sy > 0.65) {
        cylinderColliders.push({
          id: `rock_${idx}`,
          x: rp.x,
          z: rp.z,
          radius: Math.max(rp.sx, rp.sz) * 0.76,
          minY: gy - 0.5,
          maxY: gy + rp.sy * 1.25,
          material: 'rock',
          penetrable: false,
        });
      }
    }
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
    cTmp.setHex(0x6b7068).offsetHSL(0, 0, (rand() - 0.5) * 0.14);
    rockInst.setColorAt(idx, cTmp);
  });
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);

  // 7. Real-Shaped 3D Tapered Grass Tufts + Tall Riverside Reeds with Wind-Sway Vertex Shader
  const grassUniforms = {
    uTime: { value: 0 },
    uWind: { value: 1.0 },
  };
  const applyGrassWindShader = (mat: THREE.MeshStandardMaterial) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = grassUniforms.uTime;
      shader.uniforms.uWind = grassUniforms.uWind;
      shader.vertexShader =
        `uniform float uTime;\nuniform float uWind;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float swayAmt = clamp(position.y * 1.8, 0.0, 1.4);
          vec4 instWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float phase = instWorld.x * 0.38 + instWorld.z * 0.31;
          float breeze = sin(uTime * 2.2 + phase) * 0.11 + cos(uTime * 3.7 + phase * 1.7) * 0.04;
          transformed.x += breeze * swayAmt * uWind;
          transformed.z += breeze * 0.55 * swayAmt * uWind;`
        );
    };
  };

  const grassCount = 1480;
  const grassGeo = createRealGrassTuftGeometry();
  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grassBlade,
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  applyGrassWindShader(grassMat);
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassInst.receiveShadow = true;

  for (let i = 0; i < grassCount; i++) {
    const x = (rand() - 0.5) * 310;
    const z = (rand() - 0.5) * 310;
    const gy = groundHeightAt(x, z);
    const rx = roadCenterX(z);
    if (
      gy < WATER_LEVEL + 0.12 ||
      (Math.abs(x - rx) < 3.4 && Math.abs(z) < 110) ||
      Math.hypot(x - 44, z - 112) < 10.5
    ) {
      dummy.scale.set(0, 0, 0);
    } else {
      const gs = 0.78 + rand() * 0.72;
      dummy.position.set(x, gy - 0.04, z);
      dummy.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12);
      dummy.scale.set(gs, gs * (0.85 + rand() * 0.45), gs);
    }
    dummy.updateMatrix();
    grassInst.setMatrixAt(i, dummy.matrix);
    cTmp.set(i % 3 === 0 ? '#7cb048' : i % 3 === 1 ? '#5e9138' : '#96be56').offsetHSL(
      (rand() - 0.5) * 0.03,
      (rand() - 0.5) * 0.08,
      (rand() - 0.5) * 0.06
    );
    grassInst.setColorAt(i, cTmp);
  }
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  scene.add(grassInst);

  // Tall Riverside Reeds along banks & Gué des Roseaux
  const reedCount = 320;
  const reedGeo = createRiverReedTuftGeometry();
  const reedMat = new THREE.MeshStandardMaterial({
    map: textures.grassBlade,
    vertexColors: true,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  applyGrassWindShader(reedMat);
  const reedInst = new THREE.InstancedMesh(reedGeo, reedMat, reedCount);
  for (let i = 0; i < reedCount; i++) {
    const x = -148 + rand() * 296;
    const side = i % 2 === 0 ? 1 : -1;
    const z = riverCenterZ(x) + side * (riverHalfWidth(x) - 0.6 + rand() * 3.8);
    const gy = groundHeightAt(x, z);
    if (Math.abs(x + 76) < 4 || Math.abs(x) < 4 || Math.abs(x - 78) < 4) {
      dummy.scale.set(0, 0, 0);
    } else {
      const rs = 0.85 + rand() * 0.65;
      dummy.position.set(x, gy - 0.05, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(rs, rs, rs);
    }
    dummy.updateMatrix();
    reedInst.setMatrixAt(i, dummy.matrix);
    cTmp.set('#84a456').offsetHSL(0, 0, (rand() - 0.5) * 0.1);
    reedInst.setColorAt(i, cTmp);
  }
  reedInst.instanceMatrix.needsUpdate = true;
  if (reedInst.instanceColor) reedInst.instanceColor.needsUpdate = true;
  reedInst.computeBoundingSphere();
  scene.add(reedInst);

  return {
    boxColliders,
    cylinderColliders,
    barrels,
    sectors,
    coverPoints,
    updateWorld: (elapsed: number, activeSectors: SectorState[], windStrength = 1.0) => {
      grassUniforms.uTime.value = elapsed;
      grassUniforms.uWind.value = THREE.MathUtils.clamp(0.75 + windStrength * 0.28, 0.7, 2.2);

      for (const s of activeSectors) {
        if (s.poleGroup) {
          s.poleGroup.visible = s.active;
        }
        if (!s.active) continue;
        if (s.flagMesh) {
          s.flagMesh.rotation.y = Math.sin(elapsed * 3.4 + s.position.x) * 0.16;
          const absP = Math.abs(s.progress) / 100;
          s.flagMesh.position.y = THREE.MathUtils.lerp(2.4, 5.45, absP);
          const mat = s.flagMesh.material as THREE.MeshStandardMaterial;
          if (s.owner === 'army') mat.color.set('#3b82f6');
          else if (s.owner === 'rebels') mat.color.set('#ef4444');
          else mat.color.set('#d6d3d1');
        }
        if (s.lightRing) {
          const rMat = s.lightRing.material as THREE.MeshBasicMaterial;
          if (s.owner === 'army') rMat.color.set('#3b82f6');
          else if (s.owner === 'rebels') rMat.color.set('#ef4444');
          else rMat.color.set('#eab308');
        }
      }
    },
  };
}
