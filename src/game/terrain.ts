import * as THREE from 'three';
import { ProceduralTexturePack } from './textures';
import { SurfaceType } from './types';

export const WATER_LEVEL = -0.35;
export const PLAYABLE_HALF_EXTENT = 160;
export const TERRAIN_SIZE = 440;
export const TERRAIN_SEGMENTS = 220;
export const BRIDGE_CROSSINGS_X = [-76, 0, 78] as const;

export function riverCenterZ(x: number): number {
  return Math.sin(x * 0.036) * 8.5 + Math.cos(x * 0.082) * 2.6;
}

export function riverHalfWidth(x: number): number {
  return 8.0 + Math.sin(x * 0.065 + 1.2) * 1.4;
}

export function roadCenterX(z: number): number {
  if (Math.abs(z) < 14) {
    return 0;
  }
  if (z >= 14) {
    return -Math.sin((z - 14) * 0.045) * 13.5;
  }
  return Math.sin((-14 - z) * 0.048) * 12.5;
}

function fbm2D(x: number, z: number): number {
  const n1 = Math.sin(x * 0.036) * Math.cos(z * 0.034);
  const n2 = Math.sin((x + z) * 0.078 + 1.7) * 0.48;
  const n3 = Math.cos(x * 0.15 - z * 0.13) * 0.22;
  const n4 = Math.sin(x * 0.29 + z * 0.25) * 0.09;
  return n1 + n2 + n3 + n4;
}

export function groundHeightAt(x: number, z: number): number {
  const rcZ = riverCenterZ(x);
  const rHalf = riverHalfWidth(x);
  const distRiver = Math.abs(z - rcZ);

  // Base undulating Kivu valley terrain
  let h = 1.7 + fbm2D(x, z) * 1.55;

  // Gradual elevation rise on North Rebel hills & South Army plateau
  if (z < -20) {
    h += Math.min(6.4, (-20 - z) * 0.068);
  } else if (z > 22) {
    h += Math.min(4.8, (z - 22) * 0.052);
  }

  // Gentle grading around main strategic bases & zones so structures sit flush
  const flatPads: Array<[number, number, number, number]> = [
    [-10, 108, 18, 4.6], // QG Armée Sud
    [44, 112, 17, 4.4],  // Héliport
    [10, -108, 18, 5.6], // Campement Rebelle Nord
    [-66, -54, 15, 3.8], // Ruines Mission
    [12, 52, 15, 2.8],   // Marché Sud
    [-74, 96, 15, 4.1],  // Dépôt carburant
    [-112, 48, 16, 2.5], // Village pêcheurs
    [80, -80, 16, 4.8],  // Carrière latérite
  ];
  for (let i = 0; i < flatPads.length; i++) {
    const [px, pz, rad, targetH] = flatPads[i];
    const d = Math.hypot(x - px, z - pz);
    if (d < rad) {
      const t = THREE.MathUtils.smoothstep(d, rad * 0.45, rad);
      h = THREE.MathUtils.lerp(targetH, h, t);
    }
  }

  // Main central laterite road grading
  const rx = roadCenterX(z);
  const distRoad = Math.abs(x - rx);
  if (distRoad < 4.8 && distRiver > rHalf * 0.85) {
    const roadBlend = 1 - THREE.MathUtils.smoothstep(distRoad, 1.9, 4.8);
    const roadTarget = Math.max(0.65, h * 0.78 + 0.55);
    h = THREE.MathUtils.lerp(h, roadTarget, roadBlend * 0.65);
  }

  // Carve meandering Kivu river channel & shallow rocky fords
  const bankOuter = rHalf + 9.2;
  if (distRiver < bankOuter) {
    const bankT = THREE.MathUtils.smoothstep(distRiver, rHalf * 0.55, bankOuter);
    const fordWest = Math.exp(-Math.pow((x + 38) / 8.8, 2));
    const fordEast = Math.exp(-Math.pow((x - 38) / 8.8, 2));
    const isletCenter = Math.exp(-Math.pow((x - 22) / 9.0, 2));
    const fordBoost = Math.max(fordWest * 0.68, fordEast * 0.68, isletCenter * 1.15);
    const bedDepth = -1.42 + fordBoost;
    h = THREE.MathUtils.lerp(bedDepth, h, bankT);
  }

  // Natural volcanic mountain perimeter beyond playable bounds
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  if (edgeDist > PLAYABLE_HALF_EXTENT - 4) {
    const rimT = (edgeDist - (PLAYABLE_HALF_EXTENT - 4)) / 56;
    const ridgeNoise = 0.82 + 0.36 * Math.sin(x * 0.065 + z * 0.058);
    h += Math.pow(rimT, 1.55) * 32 * ridgeNoise;
  }

  return h;
}

export function groundNormalAt(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
  const eps = 0.45;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);
  target.set(hL - hR, 2 * eps, hD - hU).normalize();
  return target;
}

export function isOnBridgeDeck(x: number, z: number): boolean {
  for (let i = 0; i < BRIDGE_CROSSINGS_X.length; i++) {
    const bx = BRIDGE_CROSSINGS_X[i];
    const cz = riverCenterZ(bx);
    if (Math.abs(x - bx) <= 2.35 && Math.abs(z - cz) <= 12.6) {
      return true;
    }
  }
  return false;
}

export function getSurfaceTypeAt(x: number, y: number, z: number): SurfaceType {
  if (isOnBridgeDeck(x, z) && y >= 0.95) {
    return 'wood';
  }
  const gh = groundHeightAt(x, z);
  if (gh < WATER_LEVEL - 0.04) {
    return 'water';
  }
  const rx = roadCenterX(z);
  const distRoad = Math.abs(x - rx);
  const distRiver = Math.abs(z - riverCenterZ(x));
  if (distRoad < 2.8 || distRiver < riverHalfWidth(x) + 3.4) {
    return 'mud';
  }
  if (Math.hypot(x - 44, z - 112) < 12 || Math.hypot(x - 80, z + 80) < 12) {
    return 'rock';
  }
  return 'grass';
}

export interface TerrainVisuals {
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  updateWater: (elapsedTime: number) => void;
}

export function createTerrainAndRiver(
  scene: THREE.Scene,
  textures: ProceduralTexturePack
): TerrainVisuals {
  const geo = new THREE.PlaneGeometry(
    TERRAIN_SIZE,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
    TERRAIN_SEGMENTS
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLaterite = new THREE.Color('#7f4128');
  const cWetMud = new THREE.Color('#3b2c20');
  const cJungleGrass = new THREE.Color('#324b24');
  const cMossRidge = new THREE.Color('#243b1f');
  const cTeaPlantation = new THREE.Color('#476b2a');
  const cBasalt = new THREE.Color('#464c44');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    const rcZ = riverCenterZ(x);
    const rHalf = riverHalfWidth(x);
    const distRiver = Math.abs(z - rcZ);
    const rx = roadCenterX(z);
    const distRoad = Math.abs(x - rx);

    const dhx = Math.abs(groundHeightAt(x + 0.9, z) - y);
    const dhz = Math.abs(groundHeightAt(x, z + 0.9) - y);
    const slope = Math.hypot(dhx, dhz) / 0.9;

    tmpColor.copy(cJungleGrass);
    const patch = Math.sin(x * 0.095) * Math.cos(z * 0.115) * 0.5 + 0.5;
    tmpColor.lerp(cMossRidge, patch * 0.55);

    // Lush emerald tint on Tea Plantation
    if (Math.hypot(x - 68, z - 66) < 22) {
      tmpColor.lerp(cTeaPlantation, 0.55);
    }

    // Exposed red laterite on Quarry & main trails
    const distQuarry = Math.hypot(x - 80, z + 80);
    if (distQuarry < 19) {
      const qt = 1 - THREE.MathUtils.smoothstep(distQuarry, 9, 19);
      tmpColor.lerp(cLaterite, qt * 0.9);
    }
    if (distRoad < 3.8 && distRiver > rHalf * 0.75) {
      const roadT = 1 - THREE.MathUtils.smoothstep(distRoad, 1.5, 3.8);
      tmpColor.lerp(cLaterite, roadT * 0.88);
    }

    // Lateral approach tracks to West (-76) & East (+78) bridges
    if ((Math.abs(x + 76) < 3.2 || Math.abs(x - 78) < 3.2) && Math.abs(z) < 62 && distRiver > rHalf * 0.85) {
      tmpColor.lerp(cLaterite, 0.55);
    }

    // Riverbank wet mud & silt
    if (distRiver < rHalf + 3.6) {
      const mudT = 1 - THREE.MathUtils.smoothstep(distRiver, rHalf * 0.5, rHalf + 3.6);
      tmpColor.lerp(cWetMud, mudT * 0.92);
    }

    // Steep rocky slopes / mountain rim
    if (slope > 0.52 || y > 11) {
      const rockT = THREE.MathUtils.clamp((slope - 0.48) * 1.45 + Math.max(0, y - 11) * 0.07, 0, 1);
      tmpColor.lerp(cBasalt, rockT);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.terrainDetail,
    bumpMap: textures.terrainBump,
    bumpScale: 0.2,
    roughness: 0.9,
    metalness: 0.02,
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  scene.add(terrainMesh);

  // Flowing Kivu River Surface across full 440m width
  const waterGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, 40, 160, 22);
  waterGeo.rotateX(-Math.PI / 2);
  const wPos = waterGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const x = wPos.getX(i);
    const localZ = wPos.getZ(i);
    wPos.setZ(i, localZ + riverCenterZ(x));
  }
  waterGeo.computeVertexNormals();

  const waterUniforms = {
    uTime: { value: 0 },
  };

  const waterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2f4f44'),
    roughness: 0.14,
    metalness: 0.24,
    transparent: true,
    opacity: 0.85,
    envMapIntensity: 1.4,
  });

  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\nvarying vec3 vWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float wave1 = sin(transformed.x * 0.9 - uTime * 2.4 + transformed.z * 0.5) * 0.035;
        float wave2 = cos(transformed.x * 1.7 - uTime * 3.1 - transformed.z * 1.1) * 0.022;
        transformed.y += wave1 + wave2;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader =
      `uniform float uTime;\nvarying vec3 vWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float flow = sin(vWorldPos.x * 1.4 - uTime * 2.8 + sin(vWorldPos.z * 2.2) * 1.5);
        float ripple = cos(vWorldPos.z * 3.8 + vWorldPos.x * 0.7 - uTime * 3.4);
        float foam = smoothstep(0.76, 0.98, flow * 0.5 + ripple * 0.5);
        vec3 deepWater = vec3(0.13, 0.24, 0.20);
        vec3 siltCurrent = vec3(0.24, 0.31, 0.24);
        diffuseColor.rgb = mix(deepWater, siltCurrent, 0.45 + 0.35 * flow);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.74, 0.69), foam * 0.26);`
      );
  };

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  return {
    terrainMesh,
    waterMesh,
    updateWater: (elapsedTime: number) => {
      waterUniforms.uTime.value = elapsedTime;
    },
  };
}
