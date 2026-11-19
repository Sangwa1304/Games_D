import * as THREE from 'three';
import {
  BRIDGE_CROSSINGS_X,
  groundHeightAt,
  groundNormalAt,
  PLAYABLE_HALF_EXTENT,
  riverCenterZ,
  WATER_LEVEL,
} from './terrain';
import { ColliderBox, ColliderCylinder } from './types';

export const PLAYER_RADIUS = 0.42;
export const PLAYER_EYE_STAND = 1.65;
export const PLAYER_EYE_CROUCH = 1.04;
export const PLAYER_EYE_PRONE = 0.38;
export const GRAVITY = 23.0;

const _normal = new THREE.Vector3();

export function supportHeightAt(
  x: number,
  currentFootY: number,
  z: number,
  boxes: ColliderBox[]
): number {
  let h = groundHeightAt(x, z);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b.isWalkableTop) continue;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      if (currentFootY >= b.maxY - 0.85) {
        h = Math.max(h, b.maxY);
      }
    }
  }
  // Smooth ramp bridging at all 3 bridge approaches (West -76, Central 0, East +78)
  for (let i = 0; i < BRIDGE_CROSSINGS_X.length; i++) {
    const bx = BRIDGE_CROSSINGS_X[i];
    if (Math.abs(x - bx) <= 2.3) {
      const cz = riverCenterZ(bx);
      const az = Math.abs(z - cz);
      if (az >= 11.0 && az <= 15.0 && currentFootY >= 0.05) {
        const t = 1 - THREE.MathUtils.clamp((az - 11.0) / 4.0, 0, 1);
        const rampY = THREE.MathUtils.lerp(groundHeightAt(x, z), 1.38, t);
        h = Math.max(h, rampY);
      }
    }
  }
  return h;
}

export function resolveHorizontalCollisions(
  pos: THREE.Vector3,
  radius: number,
  height: number,
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[]
) {
  const footY = pos.y;
  const headY = pos.y + height;

  // Box colliders
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.isWalkableTop && footY >= b.maxY - 0.45) continue;
    if (headY <= b.minY || footY >= b.maxY - 0.1) continue;

    const closestX = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
    const closestZ = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        // Inside box: push out along shallowest axis
        const penLeft = Math.abs(pos.x - b.minX);
        const penRight = Math.abs(b.maxX - pos.x);
        const penFront = Math.abs(pos.z - b.minZ);
        const penBack = Math.abs(b.maxZ - pos.z);
        const m = Math.min(penLeft, penRight, penFront, penBack);
        if (m === penLeft) pos.x = b.minX - radius;
        else if (m === penRight) pos.x = b.maxX + radius;
        else if (m === penFront) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
  }

  // Cylinder colliders (trees, rocks, barrels)
  for (let i = 0; i < cylinders.length; i++) {
    const c = cylinders[i];
    if (headY <= c.minY || footY >= c.maxY) continue;
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minDist = radius + c.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = minDist - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }

  // Valley natural perimeter clamp
  pos.x = THREE.MathUtils.clamp(pos.x, -PLAYABLE_HALF_EXTENT, PLAYABLE_HALF_EXTENT);
  pos.z = THREE.MathUtils.clamp(pos.z, -PLAYABLE_HALF_EXTENT, PLAYABLE_HALF_EXTENT);
}

export function stepPlayerPhysics(
  footPos: THREE.Vector3,
  vel: THREE.Vector3,
  wishDir: THREE.Vector3,
  speedTarget: number,
  isGroundedRef: {
    grounded: boolean;
    coyoteTimer: number;
    jumpBuffer: number;
    inWater: boolean;
    waterDepth: number;
    landingImpact?: number;
  },
  jumpPressed: boolean,
  dt: number,
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[],
  playerHeight = 1.75
) {
  isGroundedRef.landingImpact = 0;

  if (jumpPressed) {
    isGroundedRef.jumpBuffer = 0.14;
  } else {
    isGroundedRef.jumpBuffer = Math.max(0, isGroundedRef.jumpBuffer - dt);
  }

  const gh = groundHeightAt(footPos.x, footPos.z);
  const waterDepth = Math.max(0, WATER_LEVEL - gh);
  const inWater = footPos.y <= WATER_LEVEL + 0.05 && waterDepth > 0.08;
  isGroundedRef.inWater = inWater;
  isGroundedRef.waterDepth = waterDepth;

  // Water drag slows movement realistically in deeper river pools
  const waterSpeedMult = inWater
    ? THREE.MathUtils.clamp(1.0 - waterDepth * 0.4, 0.58, 0.94)
    : 1.0;

  const targetVx = wishDir.x * speedTarget * waterSpeedMult;
  const targetVz = wishDir.z * speedTarget * waterSpeedMult;

  // Fluid directional responsiveness: crisp acceleration & snappy counter-strafe reversal
  const hasInput = wishDir.lengthSq() > 0.02;
  const curDot = vel.x * wishDir.x + vel.z * wishDir.z;
  const accel = !isGroundedRef.grounded
    ? 6.4
    : !hasInput
    ? 13.5
    : curDot < -0.2
    ? 22.5
    : 18.2;

  const blend = 1 - Math.exp(-accel * dt);
  vel.x = THREE.MathUtils.lerp(vel.x, targetVx, blend);
  vel.z = THREE.MathUtils.lerp(vel.z, targetVz, blend);

  // Slope sliding only on very steep embankments
  if (isGroundedRef.grounded) {
    groundNormalAt(footPos.x, footPos.z, _normal);
    if (_normal.y < 0.68) {
      vel.x += _normal.x * 9.5 * dt;
      vel.z += _normal.z * 9.5 * dt;
    }
  }

  // Coyote time + Jump execution
  if (isGroundedRef.grounded) {
    isGroundedRef.coyoteTimer = 0.13;
  } else {
    isGroundedRef.coyoteTimer = Math.max(0, isGroundedRef.coyoteTimer - dt);
  }

  if (isGroundedRef.jumpBuffer > 0 && isGroundedRef.coyoteTimer > 0) {
    vel.y = inWater ? 6.6 : 8.05;
    isGroundedRef.grounded = false;
    isGroundedRef.coyoteTimer = 0;
    isGroundedRef.jumpBuffer = 0;
  }

  vel.y -= GRAVITY * dt;

  // Integrate horizontally and resolve collisions
  const wasGrounded = isGroundedRef.grounded;
  footPos.x += vel.x * dt;
  footPos.z += vel.z * dt;
  resolveHorizontalCollisions(footPos, PLAYER_RADIUS, playerHeight, boxes, cylinders);

  footPos.y += vel.y * dt;
  const newSupportY = supportHeightAt(footPos.x, footPos.y, footPos.z, boxes);

  if (footPos.y <= newSupportY) {
    if (!wasGrounded && vel.y < -3.5) {
      isGroundedRef.landingImpact = THREE.MathUtils.clamp((-vel.y - 3.5) / 10, 0, 1);
    }
    footPos.y = newSupportY;
    if (vel.y < 0) vel.y = 0;
    isGroundedRef.grounded = true;
  } else if (footPos.y - newSupportY < 0.14 && vel.y <= 0 && wasGrounded) {
    // Hug downhill terrain & bridge ramps smoothly without airborne stutter
    footPos.y = newSupportY;
    vel.y = 0;
    isGroundedRef.grounded = true;
  } else {
    isGroundedRef.grounded = false;
  }
}

export interface SegmentHitResult {
  t: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  material: 'terrain' | 'water' | 'wood' | 'rock' | 'metal' | 'sandbag';
  penetrable: boolean;
}

const _segDir = new THREE.Vector3();
const _hitNormalTmp = new THREE.Vector3();

export function intersectSegmentEnvironment(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[],
  ignoreIds?: Set<string>
): SegmentHitResult | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dz = p1.z - p0.z;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq < 1e-12) return null;

  const segMinX = Math.min(p0.x, p1.x);
  const segMaxX = Math.max(p0.x, p1.x);
  const segMinY = Math.min(p0.y, p1.y);
  const segMaxY = Math.max(p0.y, p1.y);
  const segMinZ = Math.min(p0.z, p1.z);
  const segMaxZ = Math.max(p0.z, p1.z);

  let bestT = 1.01;
  let hitFound = false;
  let bestX = 0;
  let bestY = 0;
  let bestZ = 0;
  let bestNx = 0;
  let bestNy = 1;
  let bestNz = 0;
  let bestMaterial: SegmentHitResult['material'] = 'terrain';
  let bestPenetrable = false;

  // 1. Check water surface crossing
  if ((p0.y > WATER_LEVEL && p1.y <= WATER_LEVEL) || (p0.y < WATER_LEVEL && p1.y >= WATER_LEVEL)) {
    const tW = (WATER_LEVEL - p0.y) / dy;
    if (tW >= 0 && tW <= 1) {
      const wx = p0.x + dx * tW;
      const wz = p0.z + dz * tW;
      if (groundHeightAt(wx, wz) < WATER_LEVEL - 0.04 && tW < bestT) {
        bestT = tW;
        hitFound = true;
        bestX = wx;
        bestY = WATER_LEVEL;
        bestZ = wz;
        bestNx = 0;
        bestNy = 1;
        bestNz = 0;
        bestMaterial = 'water';
        bestPenetrable = true;
      }
    }
  }

  // 2. Sample terrain height along segment (4 steps)
  const steps = 4;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (t >= bestT) break;
    const sx = p0.x + dx * t;
    const sy = p0.y + dy * t;
    const sz = p0.z + dz * t;
    const gh = groundHeightAt(sx, sz);
    if (sy <= gh) {
      let lo = (s - 1) / steps;
      let hi = t;
      for (let k = 0; k < 4; k++) {
        const mid = (lo + hi) * 0.5;
        const mx = p0.x + dx * mid;
        const my = p0.y + dy * mid;
        const mz = p0.z + dz * mid;
        if (my <= groundHeightAt(mx, mz)) hi = mid;
        else lo = mid;
      }
      bestT = hi;
      hitFound = true;
      bestX = p0.x + dx * hi;
      bestZ = p0.z + dz * hi;
      bestY = groundHeightAt(bestX, bestZ);
      groundNormalAt(bestX, bestZ, _hitNormalTmp);
      bestNx = _hitNormalTmp.x;
      bestNy = _hitNormalTmp.y;
      bestNz = _hitNormalTmp.z;
      bestMaterial = 'terrain';
      bestPenetrable = false;
      break;
    }
  }

  // 3. AABB ray slab intersection with broadphase rejection
  const invX = Math.abs(dx) > 1e-8 ? 1 / dx : 1e8;
  const invY = Math.abs(dy) > 1e-8 ? 1 / dy : 1e8;
  const invZ = Math.abs(dz) > 1e-8 ? 1 / dz : 1e8;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (ignoreIds && ignoreIds.has(b.id)) continue;
    if (
      b.maxX < segMinX ||
      b.minX > segMaxX ||
      b.maxY < segMinY ||
      b.minY > segMaxY ||
      b.maxZ < segMinZ ||
      b.minZ > segMaxZ
    ) {
      continue;
    }

    const tx1 = (b.minX - p0.x) * invX;
    const tx2 = (b.maxX - p0.x) * invX;
    let tmin = Math.min(tx1, tx2);
    let tmax = Math.max(tx1, tx2);

    const ty1 = (b.minY - p0.y) * invY;
    const ty2 = (b.maxY - p0.y) * invY;
    tmin = Math.max(tmin, Math.min(ty1, ty2));
    tmax = Math.min(tmax, Math.max(ty1, ty2));

    const tz1 = (b.minZ - p0.z) * invZ;
    const tz2 = (b.maxZ - p0.z) * invZ;
    tmin = Math.max(tmin, Math.min(tz1, tz2));
    tmax = Math.min(tmax, Math.max(tz1, tz2));

    if (tmax >= Math.max(0, tmin) && tmin >= 0 && tmin < bestT && tmin <= 1) {
      bestT = tmin;
      hitFound = true;
      bestX = p0.x + dx * tmin;
      bestY = p0.y + dy * tmin;
      bestZ = p0.z + dz * tmin;
      const eps = 0.02;
      if (Math.abs(bestX - b.minX) < eps) {
        bestNx = -1; bestNy = 0; bestNz = 0;
      } else if (Math.abs(bestX - b.maxX) < eps) {
        bestNx = 1; bestNy = 0; bestNz = 0;
      } else if (Math.abs(bestZ - b.minZ) < eps) {
        bestNx = 0; bestNy = 0; bestNz = -1;
      } else if (Math.abs(bestZ - b.maxZ) < eps) {
        bestNx = 0; bestNy = 0; bestNz = 1;
      } else if (Math.abs(bestY - b.minY) < eps) {
        bestNx = 0; bestNy = -1; bestNz = 0;
      } else {
        bestNx = 0; bestNy = 1; bestNz = 0;
      }
      bestMaterial = b.material;
      bestPenetrable = Boolean(b.penetrable);
    }
  }

  // 4. Cylinder ray intersection (XZ quadratic with AABB broadphase)
  const a = dx * dx + dz * dz;
  if (a > 1e-8) {
    const inv2a = 0.5 / a;
    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i];
      if (ignoreIds && ignoreIds.has(c.id)) continue;
      if (
        c.x + c.radius < segMinX ||
        c.x - c.radius > segMaxX ||
        c.z + c.radius < segMinZ ||
        c.z - c.radius > segMaxZ ||
        c.maxY < segMinY ||
        c.minY > segMaxY
      ) {
        continue;
      }
      const fx = p0.x - c.x;
      const fz = p0.z - c.z;
      const b = 2 * (fx * dx + fz * dz);
      const cc = fx * fx + fz * fz - c.radius * c.radius;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) * inv2a;
      if (t >= 0 && t <= 1 && t < bestT) {
        const hy = p0.y + dy * t;
        if (hy >= c.minY && hy <= c.maxY) {
          bestT = t;
          hitFound = true;
          bestX = p0.x + dx * t;
          bestY = hy;
          bestZ = p0.z + dz * t;
          const nx = bestX - c.x;
          const nz = bestZ - c.z;
          const invLen = 1 / Math.max(1e-6, Math.hypot(nx, nz));
          bestNx = nx * invLen;
          bestNy = 0;
          bestNz = nz * invLen;
          bestMaterial = c.material;
          bestPenetrable = Boolean(c.penetrable);
        }
      }
    }
  }

  if (!hitFound) return null;
  _segDir.set(bestX, bestY, bestZ);
  return {
    t: bestT,
    point: new THREE.Vector3(bestX, bestY, bestZ),
    normal: new THREE.Vector3(bestNx, bestNy, bestNz),
    material: bestMaterial,
    penetrable: bestPenetrable,
  };
}

/**
 * Zero-allocation early-exit Line-Of-Sight test for AI & reticle checks.
 */
export function hasLineOfSight(
  from: THREE.Vector3,
  to: THREE.Vector3,
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[]
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq < 1e-8) return true;

  // Terrain occlusion check (4 samples)
  for (let s = 1; s <= 4; s++) {
    const t = s * 0.25;
    if (t > 0.98) break;
    const sx = from.x + dx * t;
    const sy = from.y + dy * t;
    const sz = from.z + dz * t;
    if (sy <= groundHeightAt(sx, sz)) {
      return false;
    }
  }

  const segMinX = Math.min(from.x, to.x);
  const segMaxX = Math.max(from.x, to.x);
  const segMinY = Math.min(from.y, to.y);
  const segMaxY = Math.max(from.y, to.y);
  const segMinZ = Math.min(from.z, to.z);
  const segMaxZ = Math.max(from.z, to.z);

  const invX = Math.abs(dx) > 1e-8 ? 1 / dx : 1e8;
  const invY = Math.abs(dy) > 1e-8 ? 1 / dy : 1e8;
  const invZ = Math.abs(dz) > 1e-8 ? 1 / dz : 1e8;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (
      b.maxX < segMinX ||
      b.minX > segMaxX ||
      b.maxY < segMinY ||
      b.minY > segMaxY ||
      b.maxZ < segMinZ ||
      b.minZ > segMaxZ
    ) {
      continue;
    }
    const tx1 = (b.minX - from.x) * invX;
    const tx2 = (b.maxX - from.x) * invX;
    let tmin = Math.min(tx1, tx2);
    let tmax = Math.max(tx1, tx2);

    const ty1 = (b.minY - from.y) * invY;
    const ty2 = (b.maxY - from.y) * invY;
    tmin = Math.max(tmin, Math.min(ty1, ty2));
    tmax = Math.min(tmax, Math.max(ty1, ty2));

    const tz1 = (b.minZ - from.z) * invZ;
    const tz2 = (b.maxZ - from.z) * invZ;
    tmin = Math.max(tmin, Math.min(tz1, tz2));
    tmax = Math.min(tmax, Math.max(tz1, tz2));

    if (tmax >= Math.max(0, tmin) && tmin >= 0 && tmin <= 0.98) {
      return false;
    }
  }

  const a = dx * dx + dz * dz;
  if (a > 1e-8) {
    const inv2a = 0.5 / a;
    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i];
      if (
        c.x + c.radius < segMinX ||
        c.x - c.radius > segMaxX ||
        c.z + c.radius < segMinZ ||
        c.z - c.radius > segMaxZ ||
        c.maxY < segMinY ||
        c.minY > segMaxY
      ) {
        continue;
      }
      const fx = from.x - c.x;
      const fz = from.z - c.z;
      const b = 2 * (fx * dx + fz * dz);
      const cc = fx * fx + fz * fz - c.radius * c.radius;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) * inv2a;
      if (t >= 0 && t <= 0.98) {
        const hy = from.y + dy * t;
        if (hy >= c.minY && hy <= c.maxY) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Drone EO/IR optical line-of-sight: pierces foliage, bushes, reeds & wooden screens,
 * blocked only by terrain hills and heavy solid concrete/rock structures.
 */
export function hasDroneOpticLos(
  from: THREE.Vector3,
  to: THREE.Vector3,
  boxes: ColliderBox[]
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  if (dx * dx + dy * dy + dz * dz < 1e-8) return true;

  for (let s = 1; s <= 4; s++) {
    const t = s * 0.25;
    if (t > 0.98) break;
    if (from.y + dy * t <= groundHeightAt(from.x + dx * t, from.z + dz * t) - 0.15) {
      return false;
    }
  }

  const segMinX = Math.min(from.x, to.x);
  const segMaxX = Math.max(from.x, to.x);
  const segMinY = Math.min(from.y, to.y);
  const segMaxY = Math.max(from.y, to.y);
  const segMinZ = Math.min(from.z, to.z);
  const segMaxZ = Math.max(from.z, to.z);
  const invX = Math.abs(dx) > 1e-8 ? 1 / dx : 1e8;
  const invY = Math.abs(dy) > 1e-8 ? 1 / dy : 1e8;
  const invZ = Math.abs(dz) > 1e-8 ? 1 / dz : 1e8;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.penetrable || b.material === 'wood' || b.material === 'sandbag') continue;
    if (
      b.maxX < segMinX ||
      b.minX > segMaxX ||
      b.maxY < segMinY ||
      b.minY > segMaxY ||
      b.maxZ < segMinZ ||
      b.minZ > segMaxZ
    ) {
      continue;
    }
    const tx1 = (b.minX - from.x) * invX;
    const tx2 = (b.maxX - from.x) * invX;
    let tmin = Math.min(tx1, tx2);
    let tmax = Math.max(tx1, tx2);

    const ty1 = (b.minY - from.y) * invY;
    const ty2 = (b.maxY - from.y) * invY;
    tmin = Math.max(tmin, Math.min(ty1, ty2));
    tmax = Math.min(tmax, Math.max(ty1, ty2));

    const tz1 = (b.minZ - from.z) * invZ;
    const tz2 = (b.maxZ - from.z) * invZ;
    tmin = Math.max(tmin, Math.min(tz1, tz2));
    tmax = Math.min(tmax, Math.max(tz1, tz2));

    if (tmax >= Math.max(0, tmin) && tmin >= 0 && tmin <= 0.98) {
      return false;
    }
  }
  return true;
}
