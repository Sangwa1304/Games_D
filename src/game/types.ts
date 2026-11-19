import * as THREE from 'three';
import type { CommsLine } from './comms';
import type { TacticalOrderId } from './ranks';

export type Faction = 'army' | 'rebels';

export type WeaponCategory = 'assault' | 'sniper' | 'destruction';
export type WeaponDelivery = 'bullet' | 'rocket' | 'flame';

export type AssaultWeaponId =
  | 'ak47'
  | 'carbine'
  | 'ak74m'
  | 'fnfal'
  | 'scar_l'
  | 'hk416'
  | 'famas'
  | 'aug'
  | 'galil'
  | 'sg552';

export type SniperWeaponId =
  | 'sniper'
  | 'm24'
  | 'awm'
  | 'barrett'
  | 'mk20'
  | 'vss';

export type DestructionWeaponId =
  | 'bazooka'
  | 'at4'
  | 'flamethrower'
  | 'lpo50';

export type WeaponId = AssaultWeaponId | SniperWeaponId | DestructionWeaponId;

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'defeat';

export type SurfaceType = 'mud' | 'grass' | 'wood' | 'water' | 'rock';

export type WeatherType = 'clear' | 'mist' | 'rain' | 'storm';

export type CombatModeId = 'conquest' | 'domination' | 'tdm' | 'assault' | 'cqc' | 'sniper';

export type PlayerStance = 'stand' | 'crouch' | 'prone';

export type StickCurveType = 'linear' | 'dynamic' | 'precision';

export interface GamepadSettings {
  enabled: boolean; // Toggle DualShock controller active state
  lookSensitivity: number; // 0.8 .. 5.2 rad/s max speed
  adsMultiplier: number; // 0.25 .. 1.15
  stickCurve: StickCurveType;
  moveDeadzone: number; // 0.02 .. 0.25
  lookDeadzone: number; // 0.02 .. 0.25
  autoSprint: boolean; // Auto sprint on full left-stick push
  invertY: boolean;
  vibration: boolean;
}

export type GamepadMenuAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'tabPrev'
  | 'tabNext'
  | 'confirm'
  | 'back'
  | 'square'
  | 'triangle'
  | 'options';

export interface GamepadMenuEvent {
  action: GamepadMenuAction;
  isRepeat: boolean;
}

export interface MinimapUnit {
  id: number | string;
  x: number;
  z: number;
  isAlly: boolean;
  isWounded: boolean;
  rankLevel: number;
  isHuman?: boolean;
  marked?: boolean;
}

export interface LanRoomSummary {
  code: string;
  hostName: string;
  playerCount: number;
  armyCount: number;
  rebelCount: number;
  weather: WeatherType;
  combatMode?: CombatModeId;
  hostIp?: string;
  port?: number;
  isRemoteHost?: boolean;
  playerNames?: string[];
}

export interface LanPeerPlayer {
  id: string;
  name: string;
  faction: Faction;
  ip: string;
  status: 'lobby' | 'playing';
  roomCode: string | null;
  hostIp: string;
  port: number;
  isRemoteHost: boolean;
}

export interface NetworkPlayerSnapshot {
  id: string;
  name: string;
  faction: Faction;
  rankLevel: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  weaponId: WeaponId;
  hp: number;
  alive: boolean;
  isCrouching: boolean;
  isProne: boolean;
  isSprinting: boolean;
  isTacSprinting: boolean;
  isSliding: boolean;
  isDiving: boolean;
  kills: number;
  deaths: number;
}

export interface FriendlyFireTarget {
  name: string;
  distance: number;
  isHuman?: boolean;
}

export interface KillcamHudState {
  active: boolean;
  killerName: string;
  killerFaction: Faction;
  weaponLabel: string;
  killerZoneName: string;
  distanceMeters: number;
  remainingSec: number;
  totalSec: number;
  isHeadshot: boolean;
}

export interface ShotIndicator {
  id: number;
  angleRad: number; // radians relative to player look (0 = ahead, +PI/2 = right, +-PI = behind, -PI/2 = left)
  intensity: number;
  isHit: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  combatMode: CombatModeId;
  combatModeName: string;
  currentZoneName: string;
  totalZonesCount: number;
  armyScore: number;
  rebelScore: number;
  scoreLimit: number;
  matchTimeRemaining: number;
  sfxVolume: number;
  musicVolume: number;
  voiceVolume: number;
  playerFaction: Faction;
  hp: number;
  maxHp: number;
  stamina: number;
  stance: PlayerStance;
  isCrouching: boolean;
  isProne: boolean;
  isSprinting: boolean;
  isTacSprinting: boolean;
  isSliding: boolean;
  isDiving: boolean;
  isInWater: boolean;
  isAds: boolean;
  weaponId: WeaponId;
  weaponCategory: WeaponCategory;
  weaponDelivery: WeaponDelivery;
  weaponName: string;
  weaponCaliber: string;
  fireMode: 'AUTO' | 'SEMI';
  loadout: WeaponId[];
  sniperZoomIdx: 0 | 1;
  sniperZoomLabel: string | null;
  isBurning: boolean;
  burnIntensity: number;
  ammoInMag: number;
  magSize: number;
  ammoReserve: number;
  grenades: number;
  smokeGrenades: number;
  activeSmokeCount: number;
  inSmokeCover: boolean;
  isReloading: boolean;
  reloadProgress: number;
  crosshairSpread: number;
  hitMarkerTimer: number;
  hitMarkerHeadshot: boolean;
  damageFlash: number;
  damageDirectionAngle: number | null; // radians relative to player look
  shotIndicators: ShotIndicator[];
  timeSinceDamage: number;
  isRegenerating: boolean;
  aimingAtAlly: FriendlyFireTarget | null;
  aimingAtEnemy: boolean;
  aimingEnemyDist: number | null;
  aimingEnemyName: string | null;
  activeEliminateTargetName: string | null;
  scopeRangeMeters: number | null;
  scopeDropSvgUnits: number;
  scopeDropTicks: Array<{ dist: number; ySvg: number }>;
  friendlyFireWarnTimer: number;
  killcam: KillcamHudState | null;
  armyTickets: number;
  rebelTickets: number;
  maxTickets: number;
  sectors: Array<{
    id: string;
    name: string;
    x: number;
    z: number;
    owner: Faction | 'neutral';
    progress: number;
    active: boolean;
  }>;
  playerKills: number;
  playerDeaths: number;
  radioBanner: string | null;
  killFeed: KillFeedItem[];
  commsFeed: CommsLine[];
  pointerLocked: boolean;
  respawnTimer: number;
  aliveAllies: number;
  aliveEnemies: number;
  compassHeadingDeg: number;
  weather: WeatherType;
  weatherLabel: string;
  gamepadConnected: boolean;
  gamepadName: string | null;
  gamepadSettings: GamepadSettings;
  gamepadSticks: { lx: number; ly: number; rx: number; ry: number };
  isMobileDevice: boolean;
  isPortrait: boolean;
  isFullscreen: boolean;
  isWounded: boolean;
  rankLevel: number;
  rankTitle: string;
  rankAbbr: string;
  rankXp: number;
  nextRankXp: number | null;
  selectedOrder: TacticalOrderId;
  activeOrder: TacticalOrderId | null;
  activeOrderTimer: number;
  subordinatesCount: number;
  totalAlliesCount: number;
  statusPanelOpen: boolean;
  commandPanelOpen: boolean;
  playerPosX: number;
  playerPosZ: number;
  playerYaw: number;
  orderMarkerPos: { x: number; z: number } | null;
  minimapUnits: MinimapUnit[];
  minimapEnemyRange: number;
  droneActive: boolean;
  droneBattery: number; // 0..100
  droneRangeMeters: number;
  droneMaxRange: number;
  droneAltitudeMeters: number;
  droneMarkedCount: number;
  droneAimingEnemy: boolean;
  droneAimingEnemyName: string | null;
  droneAimingEnemyDist: number | null;
  lanConnected: boolean;
  lanRoomCode: string | null;
  lanPlayerName: string;
  lanPlayerCount: number;
  lanIps: string[];
  lanPort: number;
  lanRooms: LanRoomSummary[];
  lanPeers: LanPeerPlayer[];
  lanUdpActive: boolean;
  lanUdpPort: number;
}

export interface WeaponSpec {
  id: WeaponId;
  category: WeaponCategory;
  delivery: WeaponDelivery;
  name: string;
  shortName: string;
  caliber: string;
  finishLabel: string;
  description: string;
  fireMode: 'AUTO' | 'SEMI';
  damage: number;
  headshotMult: number;
  rpm: number;
  magSize: number;
  reserveMax: number;
  reloadTime: number;
  muzzleVelocity: number; // m/s
  airDrag: number;
  penetration: number; // 0..1 wood penetration power
  baseSpread: number; // radians
  adsSpread: number;
  moveSpreadPenalty: number;
  recoilPitch: number;
  recoilYaw: number;
  adsFov: number;
  zoomFovs?: [number, number];
  zoomLabels?: [string, string];
  scopeType?: 'pso' | 'mildot' | 'heavy';
  adsOffset: THREE.Vector3;
  hipOffset: THREE.Vector3;
}

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  material: 'wood' | 'rock' | 'metal' | 'sandbag';
  isWalkableTop?: boolean;
  penetrable?: boolean;
  mesh?: THREE.Object3D;
}

export interface ColliderCylinder {
  id: string;
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
  material: 'wood' | 'rock' | 'metal';
  penetrable?: boolean;
}

export interface ExplosiveBarrel {
  id: string;
  position: THREE.Vector3;
  radius: number;
  height: number;
  hp: number;
  exploded: boolean;
  mesh: THREE.Group;
  collider: ColliderCylinder;
}

export interface SectorState {
  id: string;
  name: string;
  position: THREE.Vector3;
  radius: number;
  owner: Faction | 'neutral';
  progress: number; // -100 (rebels) to +100 (army)
  active: boolean;
  flagMesh?: THREE.Mesh;
  poleGroup?: THREE.Group;
  lightRing?: THREE.Mesh;
}

export interface KillFeedItem {
  id: number;
  killerName: string;
  killerFaction: Faction;
  victimName: string;
  victimFaction: Faction;
  weaponLabel: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface SmokeCloud {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  remaining: number;
  maxDuration: number;
}

export interface CoverNode {
  id: string;
  x: number;
  y: number;
  z: number;
  faceX: number;
  faceZ: number;
  kind: 'sandbag' | 'barrier' | 'crate' | 'wall';
  recommendedStance: 'crouch' | 'prone';
}

