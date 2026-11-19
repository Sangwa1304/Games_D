import * as THREE from 'three';
import {
  getSurfaceTypeAt,
  groundHeightAt,
  riverCenterZ,
  riverHalfWidth,
  WATER_LEVEL,
} from './terrain';
import { ProceduralTexturePack } from './textures';
import { SmokeCloud } from './types';

interface TacticalSmokePuff {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  maxOpacity: number;
}

interface FallingLeafItem {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  phase: number;
  scale: number;
  settledTimer: number;
}

interface DustWispItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  maxOpacity: number;
  color: THREE.Color;
}

interface WaterDropItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  scale: number;
}

interface WaterRippleItem {
  active: boolean;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  mesh: THREE.Mesh;
}

const LEAF_COUNT = 150;
const DUST_COUNT = 85;
const DROP_COUNT = 110;
const RIPPLE_COUNT = 26;
const SMOKE_PUFF_COUNT = 150;

export class EnvironmentParticleSystem {
  private leaves: FallingLeafItem[] = [];
  private leafInst: THREE.InstancedMesh;

  private dusts: DustWispItem[] = [];
  private dustSprites: THREE.Sprite[] = [];

  private drops: WaterDropItem[] = [];
  private dropSprites: THREE.Sprite[] = [];

  private ripples: WaterRippleItem[] = [];

  private smokePuffs: TacticalSmokePuff[] = [];
  private smokeSprites: THREE.Sprite[] = [];
  private smokeEmitTimer = 0;

  private ambientDustTimer = 0;
  private rainRippleTimer = 0;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, textures: ProceduralTexturePack) {
    // 1. Curved 3D Jungle Leaves (InstancedMesh for high performance)
    const leafGeo = new THREE.PlaneGeometry(0.19, 0.25, 2, 2);
    const posAttr = leafGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      // Natural curved leaf camber & fold
      posAttr.setZ(i, -Math.abs(lx) * 0.25 - (ly * ly) * 1.4);
    }
    leafGeo.computeVertexNormals();

    const leafMat = new THREE.MeshStandardMaterial({
      map: textures.fallingLeaf,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
    });
    this.leafInst = new THREE.InstancedMesh(leafGeo, leafMat, LEAF_COUNT);
    this.leafInst.frustumCulled = false;
    this.leafInst.castShadow = false;
    this.leafInst.receiveShadow = false;
    scene.add(this.leafInst);

    const leafColors = ['#8ab84e', '#6f9c3e', '#a9b84a', '#b8943e', '#78a346'];
    const cTmp = new THREE.Color();
    for (let i = 0; i < LEAF_COUNT; i++) {
      const lx = (Math.random() - 0.5) * 52;
      const lz = (Math.random() - 0.5) * 52;
      const gy = groundHeightAt(lx, lz);
      this.leaves.push({
        x: lx,
        y: gy + 2 + Math.random() * 9.5,
        z: lz,
        vx: 0,
        vy: -(0.55 + Math.random() * 0.55),
        vz: 0,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        spinX: (Math.random() - 0.5) * 3.2,
        spinY: (Math.random() - 0.5) * 3.8,
        spinZ: (Math.random() - 0.5) * 2.8,
        phase: Math.random() * Math.PI * 2,
        scale: 0.75 + Math.random() * 0.7,
        settledTimer: 0,
      });
      cTmp.set(leafColors[i % leafColors.length]);
      this.leafInst.setColorAt(i, cTmp);
    }
    if (this.leafInst.instanceColor) this.leafInst.instanceColor.needsUpdate = true;

    // 2. Ground Dust Wisps Pool (footsteps, wind drifts, dry dirt)
    for (let i = 0; i < DUST_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.dustMote,
        color: '#a87d56',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.dustSprites.push(sp);
      this.dusts.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 1.0,
        startScale: 0.4,
        endScale: 1.4,
        maxOpacity: 0.45,
        color: new THREE.Color('#a87d56'),
      });
    }

    // 3. Ballistic Water Splash Droplets Pool
    for (let i = 0; i < DROP_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.waterDroplet,
        color: '#e6f7f4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.dropSprites.push(sp);
      this.drops.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.6,
        scale: 0.25,
      });
    }

    // 4. Water Surface Ripple Rings
    const ringGeo = new THREE.RingGeometry(0.18, 0.27, 22);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: '#dff6f0',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, rMat);
      mesh.visible = false;
      scene.add(mesh);
      this.ripples.push({
        active: false,
        age: 0,
        maxAge: 0.85,
        startScale: 0.5,
        endScale: 3.2,
        mesh,
      });
    }

    // 5. Tactical Smoke Grenade Billowing Cloud Pool
    const smokeColors = ['#ced4c9', '#b8bfb4', '#dde2d8', '#adb4a9'];
    for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
      const sMat = new THREE.SpriteMaterial({
        map: textures.smokePuff,
        color: smokeColors[i % smokeColors.length],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(sMat);
      sp.visible = false;
      scene.add(sp);
      this.smokeSprites.push(sp);
      this.smokePuffs.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 3.2,
        startScale: 2.2,
        endScale: 6.2,
        maxOpacity: 0.72,
      });
    }
  }

  public spawnGroundDust(
    x: number,
    y: number,
    z: number,
    vx = 0,
    vy = 0.45,
    vz = 0,
    count = 3,
    scale = 0.55,
    colorHex = '#9e7450'
  ) {
    let spawned = 0;
    for (let i = 0; i < this.dusts.length && spawned < count; i++) {
      const d = this.dusts[i];
      if (d.active) continue;
      d.active = true;
      d.x = x + (Math.random() - 0.5) * 0.45;
      d.y = y + 0.08 + Math.random() * 0.14;
      d.z = z + (Math.random() - 0.5) * 0.45;
      d.vx = vx + (Math.random() - 0.5) * 1.1;
      d.vy = vy + Math.random() * 0.65;
      d.vz = vz + (Math.random() - 0.5) * 1.1;
      d.age = 0;
      d.maxAge = 0.55 + Math.random() * 0.55;
      d.startScale = scale * (0.7 + Math.random() * 0.4);
      d.endScale = scale * (2.2 + Math.random() * 0.9);
      d.maxOpacity = 0.42;
      d.color.set(colorHex);
      const sp = this.dustSprites[i];
      (sp.material as THREE.SpriteMaterial).color.copy(d.color);
      sp.position.set(d.x, d.y, d.z);
      sp.scale.setScalar(d.startScale);
      sp.visible = true;
      spawned++;
    }
  }

  public spawnWaterSplash(x: number, y: number, z: number, strength = 1.0) {
    const dropCount = Math.min(20, Math.max(4, Math.round(9 * strength)));
    let spawned = 0;
    for (let i = 0; i < this.drops.length && spawned < dropCount; i++) {
      const dr = this.drops[i];
      if (dr.active) continue;
      dr.active = true;
      const ang = Math.random() * Math.PI * 2;
      const radial = (0.7 + Math.random() * 2.4) * Math.min(2.2, strength);
      dr.x = x + (Math.random() - 0.5) * 0.25;
      dr.y = Math.max(WATER_LEVEL + 0.05, y);
      dr.z = z + (Math.random() - 0.5) * 0.25;
      dr.vx = Math.cos(ang) * radial;
      dr.vy = (2.1 + Math.random() * 3.1) * Math.min(1.85, 0.75 + strength * 0.45);
      dr.vz = Math.sin(ang) * radial;
      dr.age = 0;
      dr.maxAge = 0.42 + Math.random() * 0.34;
      dr.scale = (0.14 + Math.random() * 0.18) * Math.min(1.6, 0.7 + strength * 0.35);

      const sp = this.dropSprites[i];
      sp.position.set(dr.x, dr.y, dr.z);
      sp.scale.setScalar(dr.scale);
      (sp.material as THREE.SpriteMaterial).opacity = 0.85;
      sp.visible = true;
      spawned++;
    }

    this.spawnWaterRipple(x, z, 0.65 * strength, (2.6 + strength * 1.4));
  }

  public spawnWaterRipple(x: number, z: number, startScale = 0.5, endScale = 2.6) {
    for (let i = 0; i < this.ripples.length; i++) {
      const r = this.ripples[i];
      if (r.active) continue;
      r.active = true;
      r.age = 0;
      r.maxAge = 0.7 + Math.random() * 0.35;
      r.startScale = startScale;
      r.endScale = endScale;
      r.mesh.position.set(x, WATER_LEVEL + 0.035, z);
      r.mesh.scale.setScalar(startScale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.62;
      r.mesh.visible = true;
      break;
    }
  }

  public spawnLeafBurst(center: THREE.Vector3, count = 10) {
    let reallocated = 0;
    for (let i = 0; i < this.leaves.length && reallocated < count; i++) {
      const lf = this.leaves[i];
      if (lf.settledTimer > 0 || lf.y < groundHeightAt(lf.x, lf.z) + 1.8) {
        lf.x = center.x + (Math.random() - 0.5) * 3.5;
        lf.y = center.y + 1.5 + Math.random() * 3.5;
        lf.z = center.z + (Math.random() - 0.5) * 3.5;
        lf.vx = (Math.random() - 0.5) * 4.5;
        lf.vy = 1.2 + Math.random() * 2.5;
        lf.vz = (Math.random() - 0.5) * 4.5;
        lf.settledTimer = 0;
        reallocated++;
      }
    }
  }

  private respawnLeafAround(lf: FallingLeafItem, focusPos: THREE.Vector3, wind: THREE.Vector3) {
    // Prefer wooded banks outside open river channel
    let lx = focusPos.x + (Math.random() - 0.5) * 46 - wind.x * 1.6;
    let lz = focusPos.z + (Math.random() - 0.5) * 46 - wind.z * 1.6;
    const rcZ = riverCenterZ(lx);
    const rHalf = riverHalfWidth(lx);
    if (Math.abs(lz - rcZ) < rHalf + 2.5) {
      lz = rcZ + (lz >= rcZ ? 1 : -1) * (rHalf + 4.5 + Math.random() * 8);
    }
    const gy = groundHeightAt(lx, lz);
    lf.x = lx;
    lf.y = Math.max(WATER_LEVEL + 4.5, gy + 5.8 + Math.random() * 5.2);
    lf.z = lz;
    lf.vx = (Math.random() - 0.5) * 0.4;
    lf.vy = -(0.52 + Math.random() * 0.52);
    lf.vz = (Math.random() - 0.5) * 0.4;
    lf.settledTimer = 0;
  }

  public update(
    dt: number,
    elapsed: number,
    focusPos: THREE.Vector3,
    wind: THREE.Vector3,
    rainIntensity: number
  ) {
    // 1. Update Falling Jungle Leaves
    for (let i = 0; i < this.leaves.length; i++) {
      const lf = this.leaves[i];
      const dx = lf.x - focusPos.x;
      const dz = lf.z - focusPos.z;
      if (dx * dx + dz * dz > 34 * 34) {
        this.respawnLeafAround(lf, focusPos, wind);
      }

      if (lf.settledTimer > 0) {
        lf.settledTimer -= dt;
        if (lf.settledTimer <= 0) {
          this.respawnLeafAround(lf, focusPos, wind);
        } else {
          continue;
        }
      } else {
        const gy = groundHeightAt(lf.x, lf.z);
        const floorY = Math.max(gy, WATER_LEVEL) + 0.05;
        const flutter = Math.sin(elapsed * 2.8 + lf.phase) * 0.85;
        const flutterZ = Math.cos(elapsed * 2.3 + lf.phase * 1.3) * 0.72;
        lf.vx = THREE.MathUtils.lerp(lf.vx, wind.x * 0.48 + flutter, dt * 1.6);
        lf.vz = THREE.MathUtils.lerp(lf.vz, wind.z * 0.48 + flutterZ, dt * 1.6);
        lf.vy = THREE.MathUtils.lerp(lf.vy, -(0.62 + Math.sin(elapsed * 3.1 + lf.phase) * 0.2), dt * 2.2);

        lf.x += lf.vx * dt;
        lf.y += lf.vy * dt;
        lf.z += lf.vz * dt;
        lf.rx += lf.spinX * dt;
        lf.ry += lf.spinY * dt;
        lf.rz += lf.spinZ * dt;

        if (lf.y <= floorY) {
          lf.y = floorY;
          lf.settledTimer = 1.6 + Math.random() * 1.8;
        }
      }

      this.dummy.position.set(lf.x, lf.y, lf.z);
      this.dummy.rotation.set(lf.rx, lf.ry, lf.rz);
      this.dummy.scale.setScalar(lf.scale);
      this.dummy.updateMatrix();
      this.leafInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.leafInst.instanceMatrix.needsUpdate = true;

    // 2. Ambient Wind-Swept Ground Dust around battle zones (dry / light rain)
    const windSpd = Math.hypot(wind.x, wind.z);
    if (rainIntensity < 0.45) {
      this.ambientDustTimer -= dt * (0.7 + windSpd * 0.35);
      if (this.ambientDustTimer <= 0) {
        this.ambientDustTimer = 0.095;
        const px = focusPos.x + (Math.random() - 0.5) * 32;
        const pz = focusPos.z + (Math.random() - 0.5) * 32;
        const gy = groundHeightAt(px, pz);
        if (gy > WATER_LEVEL + 0.2) {
          const surf = getSurfaceTypeAt(px, gy, pz);
          const color = surf === 'mud' ? '#9e6b47' : surf === 'rock' ? '#8c8a82' : '#8e7d58';
          this.spawnAmbientDustWisp(px, gy + 0.14, pz, wind.x * 0.72, wind.z * 0.72, color);
        }
      }
    }

    for (let i = 0; i < this.dusts.length; i++) {
      const d = this.dusts[i];
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.maxAge) {
        d.active = false;
        this.dustSprites[i].visible = false;
        continue;
      }
      d.vx += (wind.x * 0.35 - d.vx) * dt * 0.8;
      d.vz += (wind.z * 0.35 - d.vz) * dt * 0.8;
      d.vy -= 0.65 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      const gy = groundHeightAt(d.x, d.z);
      if (d.y < gy + 0.08) {
        d.y = gy + 0.08;
        d.vy = Math.max(0.05, d.vy * 0.2);
      }

      const t = d.age / d.maxAge;
      const alpha = Math.sin(t * Math.PI) * d.maxOpacity;
      const sp = this.dustSprites[i];
      sp.position.set(d.x, d.y, d.z);
      sp.scale.setScalar(THREE.MathUtils.lerp(d.startScale, d.endScale, t));
      (sp.material as THREE.SpriteMaterial).opacity = Math.max(0, alpha);
    }

    // 3. Ambient Raindrop Splashes & Ripples on River Surface
    if (rainIntensity > 0.15) {
      this.rainRippleTimer -= dt * (0.5 + rainIntensity * 2.2);
      if (this.rainRippleTimer <= 0) {
        this.rainRippleTimer = 0.06;
        const rx = focusPos.x + (Math.random() - 0.5) * 26;
        const rcZ = riverCenterZ(rx);
        const rHalf = riverHalfWidth(rx);
        const rz = rcZ + (Math.random() - 0.5) * rHalf * 1.75;
        if (groundHeightAt(rx, rz) < WATER_LEVEL - 0.15) {
          this.spawnWaterRipple(rx, rz, 0.25, 1.35);
          if (Math.random() < 0.35) {
            this.spawnWaterSplash(rx, WATER_LEVEL + 0.03, rz, 0.32);
          }
        }
      }
    }

    // 4. Update Ballistic Water Droplets
    for (let i = 0; i < this.drops.length; i++) {
      const dr = this.drops[i];
      if (!dr.active) continue;
      dr.age += dt;
      if (dr.age >= dr.maxAge) {
        dr.active = false;
        this.dropSprites[i].visible = false;
        continue;
      }
      dr.vy -= 13.5 * dt;
      dr.x += dr.vx * dt;
      dr.y += dr.vy * dt;
      dr.z += dr.vz * dt;
      if (dr.y <= WATER_LEVEL && dr.vy < 0) {
        dr.active = false;
        this.dropSprites[i].visible = false;
        continue;
      }
      const t = dr.age / dr.maxAge;
      const sp = this.dropSprites[i];
      sp.position.set(dr.x, dr.y, dr.z);
      sp.scale.setScalar(dr.scale * (1 + t * 0.65));
      (sp.material as THREE.SpriteMaterial).opacity = (1 - t) * 0.85;
    }

    // 5. Update Water Surface Ripple Rings
    for (let i = 0; i < this.ripples.length; i++) {
      const r = this.ripples[i];
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.age / r.maxAge;
      r.mesh.scale.setScalar(THREE.MathUtils.lerp(r.startScale, r.endScale, t));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.58;
    }
  }

  public spawnSmokeBurst(x: number, y: number, z: number, radius = 8.0) {
    let spawned = 0;
    for (let i = 0; i < this.smokePuffs.length && spawned < 34; i++) {
      const p = this.smokePuffs[i];
      if (p.active) continue;
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.52;
      p.active = true;
      p.x = x + Math.cos(ang) * r;
      p.y = y + 0.65 + Math.random() * 1.9;
      p.z = z + Math.sin(ang) * r;
      p.vx = Math.cos(ang) * (1.2 + Math.random() * 1.6);
      p.vy = 0.55 + Math.random() * 0.85;
      p.vz = Math.sin(ang) * (1.2 + Math.random() * 1.6);
      p.age = 0;
      p.maxAge = 3.2 + Math.random() * 1.6;
      p.startScale = 2.6 + Math.random() * 1.2;
      p.endScale = 6.2 + Math.random() * 2.2;
      p.maxOpacity = 0.72;

      const sp = this.smokeSprites[i];
      sp.position.set(p.x, p.y, p.z);
      sp.scale.setScalar(p.startScale);
      (sp.material as THREE.SpriteMaterial).opacity = 0.1;
      sp.visible = true;
      spawned++;
    }
  }

  public updateSmokeClouds(clouds: SmokeCloud[], dt: number, wind: THREE.Vector3) {
    // Emit fresh billowing puffs while canister is active
    this.smokeEmitTimer -= dt;
    if (this.smokeEmitTimer <= 0 && clouds.length > 0) {
      this.smokeEmitTimer = 0.085;
      for (let c = 0; c < clouds.length; c++) {
        const cl = clouds[c];
        if (cl.remaining <= 1.8) continue;
        const lifeRatio = 1 - cl.remaining / cl.maxDuration;
        const spreadR = cl.radius * (lifeRatio < 0.12 ? 0.35 : 0.68);
        const puffsPerTick = cl.remaining > cl.maxDuration - 2.5 ? 3 : 2;
        let emitted = 0;
        for (let i = 0; i < this.smokePuffs.length && emitted < puffsPerTick; i++) {
          const p = this.smokePuffs[i];
          if (p.active) continue;
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * spreadR;
          p.active = true;
          p.x = cl.x + Math.cos(ang) * r;
          p.y = cl.y + 0.45 + Math.random() * 1.6;
          p.z = cl.z + Math.sin(ang) * r;
          p.vx = Math.cos(ang) * 0.45 + wind.x * 0.18;
          p.vy = 0.32 + Math.random() * 0.48;
          p.vz = Math.sin(ang) * 0.45 + wind.z * 0.18;
          p.age = 0;
          p.maxAge = 2.6 + Math.random() * 1.4;
          p.startScale = 2.8 + Math.random() * 1.0;
          p.endScale = 5.8 + Math.random() * 1.8;
          p.maxOpacity = 0.68 * Math.min(1, cl.remaining / 3.0);

          const sp = this.smokeSprites[i];
          sp.position.set(p.x, p.y, p.z);
          sp.scale.setScalar(p.startScale);
          (sp.material as THREE.SpriteMaterial).opacity = 0.08;
          sp.visible = true;
          emitted++;
        }
      }
    }

    for (let i = 0; i < this.smokePuffs.length; i++) {
      const p = this.smokePuffs[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        this.smokeSprites[i].visible = false;
        continue;
      }
      p.vx = THREE.MathUtils.lerp(p.vx, wind.x * 0.22, dt * 0.9);
      p.vz = THREE.MathUtils.lerp(p.vz, wind.z * 0.22, dt * 0.9);
      p.vy *= Math.exp(-0.55 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = p.age / p.maxAge;
      // Fast rise in opacity during first 15%, thick plateau, smooth fade last 35%
      const envAlpha =
        t < 0.15
          ? t / 0.15
          : t > 0.65
          ? (1 - t) / 0.35
          : 1.0;
      const sp = this.smokeSprites[i];
      sp.position.set(p.x, p.y, p.z);
      sp.scale.setScalar(THREE.MathUtils.lerp(p.startScale, p.endScale, Math.sqrt(t)));
      (sp.material as THREE.SpriteMaterial).opacity = Math.max(0, envAlpha * p.maxOpacity);
    }
  }

  private spawnAmbientDustWisp(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    colorHex: string
  ) {
    for (let i = 0; i < this.dusts.length; i++) {
      const d = this.dusts[i];
      if (d.active) continue;
      d.active = true;
      d.x = x;
      d.y = y;
      d.z = z;
      d.vx = vx * (0.7 + Math.random() * 0.6);
      d.vy = 0.14 + Math.random() * 0.24;
      d.vz = vz * (0.7 + Math.random() * 0.6);
      d.age = 0;
      d.maxAge = 1.6 + Math.random() * 1.4;
      d.startScale = 0.85 + Math.random() * 0.65;
      d.endScale = 2.4 + Math.random() * 1.2;
      d.maxOpacity = 0.24;
      d.color.set(colorHex);
      const sp = this.dustSprites[i];
      (sp.material as THREE.SpriteMaterial).color.copy(d.color);
      sp.position.set(x, y, z);
      sp.scale.setScalar(d.startScale);
      sp.visible = true;
      break;
    }
  }
}
