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

export function intersectSegmentEnvironment(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[],
  ignoreIds?: Set<string>
): SegmentHitResult | null {
  _segDir.subVectors(p1, p0);
  const segLen = _segDir.length();
  if (segLen < 1e-6) return null;

  let bestT = 1.01;
  let bestHit: SegmentHitResult | null = null;

  // 1. Check water surface crossing
  if ((p0.y > WATER_LEVEL && p1.y <= WATER_LEVEL) || (p0.y < WATER_LEVEL && p1.y >= WATER_LEVEL)) {
    const tW = (WATER_LEVEL - p0.y) / (p1.y - p0.y);
    if (tW >= 0 && tW <= 1) {
      const wx = p0.x + _segDir.x * tW;
      const wz = p0.z + _segDir.z * tW;
      if (groundHeightAt(wx, wz) < WATER_LEVEL - 0.04 && tW < bestT) {
        bestT = tW;
        bestHit = {
          t: tW,
          point: new THREE.Vector3(wx, WATER_LEVEL, wz),
          normal: new THREE.Vector3(0, 1, 0),
          material: 'water',
          penetrable: true,
        };
      }
    }
  }

  // 2. Sample terrain height along segment (4 steps)
  const steps = 4;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (t >= bestT) break;
    const sx = p0.x + _segDir.x * t;
    const sy = p0.y + _segDir.y * t;
    const sz = p0.z + _segDir.z * t;
    const gh = groundHeightAt(sx, sz);
    if (sy <= gh) {
      // Refine binary search
      let lo = (s - 1) / steps;
      let hi = t;
      for (let k = 0; k < 4; k++) {
        const mid = (lo + hi) * 0.5;
        const mx = p0.x + _segDir.x * mid;
        const my = p0.y + _segDir.y * mid;
        const mz = p0.z + _segDir.z * mid;
        if (my <= groundHeightAt(mx, mz)) hi = mid;
        else lo = mid;
      }
      const hitPt = new THREE.Vector3(
        p0.x + _segDir.x * hi,
        groundHeightAt(p0.x + _segDir.x * hi, p0.z + _segDir.z * hi),
        p0.z + _segDir.z * hi
      );
      bestT = hi;
      bestHit = {
        t: hi,
        point: hitPt,
        normal: groundNormalAt(hitPt.x, hitPt.z, new THREE.Vector3()),
        material: 'terrain',
        penetrable: false,
      };
      break;
    }
  }

  // 3. AABB ray slab intersection
  const invX = Math.abs(_segDir.x) > 1e-8 ? 1 / _segDir.x : 1e8;
  const invY = Math.abs(_segDir.y) > 1e-8 ? 1 / _segDir.y : 1e8;
  const invZ = Math.abs(_segDir.z) > 1e-8 ? 1 / _segDir.z : 1e8;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (ignoreIds && ignoreIds.has(b.id)) continue;

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
      const hitPt = p0.clone().addScaledVector(_segDir, tmin);
      const n = new THREE.Vector3(0, 1, 0);
      const eps = 0.02;
      if (Math.abs(hitPt.x - b.minX) < eps) n.set(-1, 0, 0);
      else if (Math.abs(hitPt.x - b.maxX) < eps) n.set(1, 0, 0);
      else if (Math.abs(hitPt.z - b.minZ) < eps) n.set(0, 0, -1);
      else if (Math.abs(hitPt.z - b.maxZ) < eps) n.set(0, 0, 1);
      else if (Math.abs(hitPt.y - b.minY) < eps) n.set(0, -1, 0);

      bestHit = {
        t: tmin,
        point: hitPt,
        normal: n,
        material: b.material,
        penetrable: Boolean(b.penetrable),
      };
    }
  }

  // 4. Cylinder ray intersection (XZ quadratic)
  const dx = _segDir.x;
  const dz = _segDir.z;
  const a = dx * dx + dz * dz;
  if (a > 1e-8) {
    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i];
      if (ignoreIds && ignoreIds.has(c.id)) continue;
      const fx = p0.x - c.x;
      const fz = p0.z - c.z;
      const b = 2 * (fx * dx + fz * dz);
      const cc = fx * fx + fz * fz - c.radius * c.radius;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const sqrtD = Math.sqrt(disc);
      const t = (-b - sqrtD) / (2 * a);
      if (t >= 0 && t <= 1 && t < bestT) {
        const hy = p0.y + _segDir.y * t;
        if (hy >= c.minY && hy <= c.maxY) {
          bestT = t;
          const hitPt = p0.clone().addScaledVector(_segDir, t);
          const n = new THREE.Vector3(hitPt.x - c.x, 0, hitPt.z - c.z).normalize();
          bestHit = {
            t,
            point: hitPt,
            normal: n,
            material: c.material,
            penetrable: Boolean(c.penetrable),
          };
        }
      }
    }
  }

  return bestHit;
}

export function hasLineOfSight(
  from: THREE.Vector3,
  to: THREE.Vector3,
  boxes: ColliderBox[],
  cylinders: ColliderCylinder[]
): boolean {
  const hit = intersectSegmentEnvironment(from, to, boxes, cylinders);
  return hit === null || hit.t > 0.98;
}
