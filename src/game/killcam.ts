import * as THREE from 'three';
import { createSoldierMesh, poseSoldierRig } from './entities';
import {
  intersectSegmentEnvironment,
  PLAYER_EYE_CROUCH,
  PLAYER_EYE_PRONE,
  PLAYER_EYE_STAND,
} from './physics';
import { ProceduralTexturePack } from './textures';
import { ColliderBox, ColliderCylinder, Faction, WeaponId } from './types';
import { isSniperWeapon } from './weapons';

export interface RecordedActorPose {
  key: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  faction: Faction;
  rankLevel: number;
  weaponId: WeaponId;
  isCrouching: boolean;
  isProne: boolean;
  isDiving: boolean;
}

export interface RecordedKillcamFrame {
  time: number;
  victimX: number;
  victimY: number;
  victimZ: number;
  victimYaw: number;
  victimPitch: number;
  victimCrouching: boolean;
  victimProne: boolean;
  victimDiving: boolean;
  actors: RecordedActorPose[];
}

export interface KillcamShotMeta {
  killerKey: string | null; // e.g. 'ai:12' | 'remote:abc' | null
  killerName: string;
  killerFaction: Faction;
  weaponLabel: string;
  weaponId: WeaponId;
  fallbackSourcePos: THREE.Vector3;
  isHeadshot: boolean;
  deathTime: number;
  victimFaction: Faction;
  victimRankLevel: number;
}

interface ReplayRigSlot {
  key: string;
  faction: Faction;
  rankLevel: number;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headMesh: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  armsGroup: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

const MAX_FRAMES = 108; // ~3.6s at 30 Hz
const SAMPLE_INTERVAL = 0.033;
export const KILLCAM_DURATION = 3.0;
const REPLAY_WINDOW = 2.85;

const _killerPos = new THREE.Vector3();
const _victimPos = new THREE.Vector3();
const _killerEye = new THREE.Vector3();
const _victimAim = new THREE.Vector3();
const _toVictim = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _desiredCam = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

export class KillcamSystem {
  private frames: RecordedKillcamFrame[] = [];
  private sampleAccum = 0;

  public active = false;
  public elapsed = 0;
  public meta: KillcamShotMeta | null = null;

  private replayStartTime = 0;
  private replayEndTime = 0;
  private replaySpeed = 1;

  private group = new THREE.Group();
  private victimSlot: ReplayRigSlot | null = null;
  private killerSlot: ReplayRigSlot | null = null;
  private extraSlots: ReplayRigSlot[] = [];
  private tracerMesh: THREE.Mesh;
  private impactRing: THREE.Mesh;

  private scene: THREE.Scene;
  private textures: ProceduralTexturePack;

  constructor(scene: THREE.Scene, textures: ProceduralTexturePack) {
    this.scene = scene;
    this.textures = textures;
    this.group.visible = false;

    const tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: '#ffd166',
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
    this.tracerMesh.visible = false;
    this.group.add(this.tracerMesh);

    const ringGeo = new THREE.RingGeometry(0.18, 0.34, 18);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.impactRing = new THREE.Mesh(ringGeo, ringMat);
    this.impactRing.visible = false;
    this.group.add(this.impactRing);

    this.scene.add(this.group);
  }

  public resetBuffer() {
    this.frames.length = 0;
    this.sampleAccum = 0;
  }

  public recordFrame(
    dt: number,
    elapsedTime: number,
    victim: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      isCrouching: boolean;
      isProne: boolean;
      isDiving: boolean;
    },
    actors: RecordedActorPose[]
  ) {
    if (this.active) return;
    this.sampleAccum += dt;
    if (this.sampleAccum < SAMPLE_INTERVAL && this.frames.length > 0) return;
    this.sampleAccum = 0;

    let frame: RecordedKillcamFrame;
    if (this.frames.length >= MAX_FRAMES) {
      frame = this.frames.shift()!;
      frame.actors.length = 0;
    } else {
      frame = {
        time: elapsedTime,
        victimX: victim.x,
        victimY: victim.y,
        victimZ: victim.z,
        victimYaw: victim.yaw,
        victimPitch: victim.pitch,
        victimCrouching: victim.isCrouching,
        victimProne: victim.isProne,
        victimDiving: victim.isDiving,
        actors: [],
      };
    }

    frame.time = elapsedTime;
    frame.victimX = victim.x;
    frame.victimY = victim.y;
    frame.victimZ = victim.z;
    frame.victimYaw = victim.yaw;
    frame.victimPitch = victim.pitch;
    frame.victimCrouching = victim.isCrouching;
    frame.victimProne = victim.isProne;
    frame.victimDiving = victim.isDiving;
    for (let i = 0; i < actors.length; i++) {
      frame.actors.push(actors[i]);
    }
    this.frames.push(frame);
  }

  private createSlot(key: string, faction: Faction, rankLevel: number): ReplayRigSlot {
    const rig = createSoldierMesh(faction, this.textures, rankLevel);
    this.group.add(rig.root);
    return {
      key,
      faction,
      rankLevel,
      root: rig.root,
      bodyPivot: rig.bodyPivot,
      headMesh: rig.headMesh,
      leftLeg: rig.leftLeg,
      rightLeg: rig.rightLeg,
      armsGroup: rig.armsGroup,
      muzzleFlash: rig.muzzleFlash,
    };
  }

  private ensureVictimRig(faction: Faction, rankLevel: number): ReplayRigSlot {
    if (!this.victimSlot || this.victimSlot.faction !== faction) {
      if (this.victimSlot) this.group.remove(this.victimSlot.root);
      this.victimSlot = this.createSlot('victim', faction, rankLevel);
    }
    return this.victimSlot;
  }

  private ensureKillerRig(faction: Faction, rankLevel: number): ReplayRigSlot {
    if (!this.killerSlot || this.killerSlot.faction !== faction) {
      if (this.killerSlot) this.group.remove(this.killerSlot.root);
      this.killerSlot = this.createSlot('killer', faction, rankLevel);
    }
    return this.killerSlot;
  }

  public startReplay(meta: KillcamShotMeta) {
    this.meta = meta;
    this.active = true;
    this.elapsed = 0;

    if (this.frames.length > 0) {
      this.replayEndTime = this.frames[this.frames.length - 1].time;
      const earliest = this.frames[0].time;
      this.replayStartTime = Math.max(earliest, this.replayEndTime - REPLAY_WINDOW);
      const span = Math.max(0.4, this.replayEndTime - this.replayStartTime);
      // Play history across 2.65s + 0.35s fatal-hit slow-motion linger = 3.0s total
      this.replaySpeed = span / 2.65;
    } else {
      this.replayStartTime = meta.deathTime;
      this.replayEndTime = meta.deathTime;
      this.replaySpeed = 1;
    }

    this.ensureVictimRig(meta.victimFaction, meta.victimRankLevel);
    this.ensureKillerRig(meta.killerFaction, 3);
    this.tracerMesh.visible = false;
    this.impactRing.visible = false;
    this.group.visible = true;
  }

  public stopReplay(camera: THREE.PerspectiveCamera) {
    if (!this.active) return;
    this.active = false;
    this.meta = null;
    this.group.visible = false;
    this.tracerMesh.visible = false;
    this.impactRing.visible = false;
    if (Math.abs(camera.fov - 72) > 0.1) {
      camera.fov = 72;
      camera.updateProjectionMatrix();
    }
  }

  private findFramesAt(simTime: number): { a: RecordedKillcamFrame; b: RecordedKillcamFrame; t: number } | null {
    if (this.frames.length === 0) return null;
    if (this.frames.length === 1 || simTime <= this.frames[0].time) {
      return { a: this.frames[0], b: this.frames[0], t: 0 };
    }
    const last = this.frames[this.frames.length - 1];
    if (simTime >= last.time) {
      return { a: last, b: last, t: 0 };
    }
    for (let i = 0; i < this.frames.length - 1; i++) {
      const fa = this.frames[i];
      const fb = this.frames[i + 1];
      if (simTime >= fa.time && simTime <= fb.time) {
        const denom = Math.max(0.0001, fb.time - fa.time);
        return { a: fa, b: fb, t: THREE.MathUtils.clamp((simTime - fa.time) / denom, 0, 1) };
      }
    }
    return { a: last, b: last, t: 0 };
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  private poseRig(
    slot: ReplayRigSlot,
    x: number,
    y: number,
    z: number,
    yaw: number,
    aimPitch: number,
    isCrouching: boolean,
    isProne: boolean,
    isDiving: boolean,
    walkSpeedApprox: number,
    phaseTime: number
  ) {
    slot.root.visible = true;
    slot.root.position.set(x, y, z);
    slot.root.rotation.set(0, yaw, 0);

    poseSoldierRig(slot, {
      x,
      y,
      z,
      yaw,
      stance: isProne || isDiving ? 'prone' : isCrouching ? 'crouch' : 'stand',
      isDiving,
      moveSpeed: walkSpeedApprox,
      stridePhase: phaseTime * 9.5,
      aimPitch,
      combatAim: true,
      dt: 0.16,
    });
  }

  public updateReplay(
    dt: number,
    camera: THREE.PerspectiveCamera,
    boxes: ColliderBox[],
    cylinders: ColliderCylinder[]
  ): boolean {
    if (!this.active || !this.meta) return false;
    this.elapsed += dt;
    if (this.elapsed >= KILLCAM_DURATION) {
      this.stopReplay(camera);
      return false;
    }

    const activeReplayTime = Math.min(2.65, this.elapsed);
    const simTime = Math.min(
      this.replayEndTime,
      this.replayStartTime + activeReplayTime * this.replaySpeed
    );
    const sample = this.findFramesAt(simTime);
    const hitLinger = this.elapsed >= 2.52;

    if (sample) {
      const { a, b, t } = sample;
      const vx = THREE.MathUtils.lerp(a.victimX, b.victimX, t);
      const vy = THREE.MathUtils.lerp(a.victimY, b.victimY, t);
      const vz = THREE.MathUtils.lerp(a.victimZ, b.victimZ, t);
      const vYaw = this.lerpAngle(a.victimYaw, b.victimYaw, t) + Math.PI;
      const vSpeed = Math.hypot(b.victimX - a.victimX, b.victimZ - a.victimZ) / SAMPLE_INTERVAL;
      _victimPos.set(vx, vy, vz);

      const vSlot = this.ensureVictimRig(this.meta.victimFaction, this.meta.victimRankLevel);
      this.poseRig(
        vSlot,
        vx,
        vy,
        vz,
        vYaw,
        b.victimPitch,
        b.victimCrouching,
        b.victimProne,
        b.victimDiving,
        vSpeed,
        this.elapsed
      );
      if (hitLinger) {
        const collapseT = THREE.MathUtils.clamp((this.elapsed - 2.52) / 0.38, 0, 1);
        vSlot.root.rotation.x = -collapseT * (b.victimProne || b.victimDiving ? 0.35 : 1.38);
      } else {
        vSlot.root.rotation.x = 0;
      }

      // Resolve killer actor pose at simTime (or fallback to recorded shooter position)
      let foundKillerA: RecordedActorPose | undefined;
      let foundKillerB: RecordedActorPose | undefined;
      if (this.meta.killerKey) {
        foundKillerA = a.actors.find((act) => act.key === this.meta!.killerKey);
        foundKillerB = b.actors.find((act) => act.key === this.meta!.killerKey);
      }

      const killerPose = foundKillerB || foundKillerA;
      const kSlot = this.ensureKillerRig(this.meta.killerFaction, killerPose?.rankLevel ?? 3);

      if (killerPose) {
        const ka = foundKillerA || killerPose;
        const kb = foundKillerB || killerPose;
        const kx = THREE.MathUtils.lerp(ka.x, kb.x, t);
        const ky = THREE.MathUtils.lerp(ka.y, kb.y, t);
        const kz = THREE.MathUtils.lerp(ka.z, kb.z, t);
        const kYaw =
          this.lerpAngle(ka.yaw, kb.yaw, t) +
          (this.meta.killerKey?.startsWith('remote:') ? Math.PI : 0);
        const kSpeed = Math.hypot(kb.x - ka.x, kb.z - ka.z) / SAMPLE_INTERVAL;
        _killerPos.set(kx, ky, kz);
        this.poseRig(
          kSlot,
          kx,
          ky,
          kz,
          kYaw,
          kb.pitch,
          kb.isCrouching,
          kb.isProne,
          kb.isDiving,
          kSpeed,
          this.elapsed
        );
        kSlot.muzzleFlash.visible = this.elapsed >= 2.48 && this.elapsed <= 2.68;
      } else {
        _killerPos.copy(this.meta.fallbackSourcePos);
        const aimAngle = Math.atan2(_victimPos.x - _killerPos.x, _victimPos.z - _killerPos.z);
        this.poseRig(
          kSlot,
          _killerPos.x,
          _killerPos.y,
          _killerPos.z,
          aimAngle,
          0,
          false,
          false,
          false,
          0,
          this.elapsed
        );
        kSlot.muzzleFlash.visible = this.elapsed >= 2.48 && this.elapsed <= 2.68;
      }

      // Render up to 6 nearby secondary actors for rich tactical battlefield context
      for (let i = 0; i < this.extraSlots.length; i++) {
        this.extraSlots[i].root.visible = false;
      }
      let extraIdx = 0;
      for (let i = 0; i < b.actors.length && extraIdx < 6; i++) {
        const actB = b.actors[i];
        if (!actB.alive || actB.key === this.meta.killerKey) continue;
        const distVictimSq =
          (actB.x - vx) * (actB.x - vx) + (actB.z - vz) * (actB.z - vz);
        if (distVictimSq > 48 * 48) continue;

        const actA = a.actors.find((o) => o.key === actB.key) || actB;
        let slot = this.extraSlots[extraIdx];
        if (!slot || slot.faction !== actB.faction) {
          if (slot) this.group.remove(slot.root);
          slot = this.createSlot(actB.key, actB.faction, actB.rankLevel);
          this.extraSlots[extraIdx] = slot;
        }
        const ex = THREE.MathUtils.lerp(actA.x, actB.x, t);
        const ey = THREE.MathUtils.lerp(actA.y, actB.y, t);
        const ez = THREE.MathUtils.lerp(actA.z, actB.z, t);
        const eYaw =
          this.lerpAngle(actA.yaw, actB.yaw, t) +
          (actB.key.startsWith('remote:') ? Math.PI : 0);
        const eSpd = Math.hypot(actB.x - actA.x, actB.z - actA.z) / SAMPLE_INTERVAL;
        this.poseRig(
          slot,
          ex,
          ey,
          ez,
          eYaw,
          actB.pitch,
          actB.isCrouching,
          actB.isProne,
          actB.isDiving,
          eSpd,
          this.elapsed
        );
        extraIdx++;
      }

      // Camera placement: Killer's tactical over-the-shoulder perspective looking toward victim
      const killerEyeOffset =
        killerPose?.isProne || killerPose?.isDiving
          ? 0.45
          : killerPose?.isCrouching
          ? 1.05
          : 1.56;
      const victimEyeOffset =
        b.victimProne || b.victimDiving
          ? PLAYER_EYE_PRONE
          : b.victimCrouching
          ? PLAYER_EYE_CROUCH * 0.85
          : PLAYER_EYE_STAND * (this.meta.isHeadshot ? 0.96 : 0.72);

      _killerEye.set(_killerPos.x, _killerPos.y + killerEyeOffset, _killerPos.z);
      _victimAim.set(_victimPos.x, _victimPos.y + victimEyeOffset, _victimPos.z);

      _toVictim.subVectors(_victimAim, _killerEye);
      const dist = _toVictim.length();
      if (dist > 0.1) _toVictim.divideScalar(dist);
      else _toVictim.set(0, 0, 1);

      _camRight.crossVectors(_toVictim, _upVec).normalize();
      if (_camRight.lengthSq() < 0.01) _camRight.set(1, 0, 0);

      _desiredCam
        .copy(_killerEye)
        .addScaledVector(_toVictim, -0.72)
        .addScaledVector(_camRight, 0.28);
      _desiredCam.y += 0.14;

      const clipHit = intersectSegmentEnvironment(_killerEye, _desiredCam, boxes, cylinders);
      if (clipHit) {
        camera.position.lerpVectors(_killerEye, clipHit.point, 0.8);
      } else {
        camera.position.copy(_desiredCam);
      }

      camera.lookAt(_victimAim);

      // Subtle ADS zoom-in tightening over the 3 seconds as fatal shot connects
      const zoomBlend = THREE.MathUtils.smoothstep(this.elapsed, 0.6, 2.55);
      const targetFov = isSniperWeapon(this.meta.weaponId)
        ? THREE.MathUtils.lerp(64, 34, zoomBlend)
        : THREE.MathUtils.lerp(68, 48, zoomBlend);
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      // Highlight fatal tracer trajectory & victim impact beacon near the fatal frame
      if (this.elapsed >= 2.25) {
        const tracerLen = Math.max(0.5, _killerEye.distanceTo(_victimAim));
        this.tracerMesh.position.lerpVectors(_killerEye, _victimAim, 0.5);
        this.tracerMesh.lookAt(_victimAim);
        this.tracerMesh.scale.set(1, 1, tracerLen);
        (this.tracerMesh.material as THREE.MeshBasicMaterial).opacity =
          this.elapsed < 2.65 ? 0.72 : Math.max(0.18, 1 - (this.elapsed - 2.65) * 2.1);
        this.tracerMesh.visible = true;

        this.impactRing.position.copy(_victimAim);
        this.impactRing.lookAt(camera.position);
        const pulse = 1 + Math.sin(this.elapsed * 18) * 0.16;
        this.impactRing.scale.setScalar(pulse);
        this.impactRing.visible = true;
      } else {
        this.tracerMesh.visible = false;
        this.impactRing.visible = false;
      }
    }

    return true;
  }
}
