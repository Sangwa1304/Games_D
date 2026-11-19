import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TacticalAudioEngine } from './audio';
import {
  CommsCategory,
  CommsLine,
  MALE_VOICE_PROFILES,
  pickCommsPhrase,
  SpeechCalloutSynthesizer,
  VOICE_PROFILE_ORDER,
  VoiceProfileId,
} from './comms';
import {
  createSoldierMesh,
  getAllyIffTexture,
  igniteSoldier,
  pickRouteToTarget,
  poseSoldierRig,
  RemoteCombatTarget,
  SoldierEntity,
  spawnSoldier,
  triggerSoldierDive,
  updateSoldierAI,
} from './entities';
import { KILLCAM_DURATION, KillcamShotMeta, KillcamSystem, RecordedActorPose } from './killcam';
import {
  getNextRankThreshold,
  getRankFromXp,
  pickOrderVoice,
  pickSeniorRefusalVoice,
  TACTICAL_ORDERS,
  TacticalOrderId,
} from './ranks';
import {
  DEFAULT_GAMEPAD_SETTINGS,
  DualShockController,
  DualShockState,
} from './gamepad';
import { LanMultiplayerClient } from './network';
import { getCombatModeSpec } from './modes';
import { EnvironmentParticleSystem } from './particles';
import {
  hasDroneOpticLos,
  hasLineOfSight,
  intersectSegmentEnvironment,
  PLAYER_EYE_CROUCH,
  PLAYER_EYE_PRONE,
  PLAYER_EYE_STAND,
  stepPlayerPhysics,
  supportHeightAt,
} from './physics';
import {
  createTerrainAndRiver,
  getSurfaceTypeAt,
  groundHeightAt,
  groundNormalAt,
  PLAYABLE_HALF_EXTENT,
  riverCenterZ,
  WATER_LEVEL,
} from './terrain';
import { createProceduralTexturePack, ProceduralTexturePack } from './textures';
import {
  ColliderBox,
  ColliderCylinder,
  CombatModeId,
  ExplosiveBarrel,
  Faction,
  FriendlyFireTarget,
  GamepadMenuEvent,
  GamepadSettings,
  GamePhase,
  HudSnapshot,
  KillcamHudState,
  KillFeedItem,
  LanPeerPlayer,
  LanRoomSummary,
  MinimapUnit,
  NetworkPlayerSnapshot,
  PlayerStance,
  SectorState,
  ShotIndicator,
  SmokeCloud,
  WeaponId,
} from './types';
import {
  ALL_WEAPON_IDS,
  buildWeaponViewmodel,
  DEFAULT_ARMY_LOADOUT,
  DEFAULT_REBEL_LOADOUT,
  isFlameWeapon,
  isRocketWeapon,
  isSniperWeapon,
  MAX_LOADOUT_SIZE,
  sanitizeLoadout,
  sanitizeWeaponId,
  WEAPON_LIST,
  WEAPON_SPECS,
  WeaponViewmodel,
} from './weapons';
import { WEATHER_PRESETS, WeatherController } from './weather';
import { buildWorldEnvironment, WorldBuildResult } from './worldBuilder';
import { findZoneAt, KIVU_COMBAT_ZONES } from './zones';

interface RemotePlayerEntity {
  id: string;
  name: string;
  faction: Faction;
  rankLevel: number;
  weaponId: WeaponId;
  hp: number;
  alive: boolean;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headMesh: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  armsGroup: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  burnFxGroup: THREE.Group;
  burnTimer: number;
  nameSprite: THREE.Sprite;
  iffSprite: THREE.Sprite;
  iffWarnActive: boolean;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  pitch: number;
  vx: number;
  vz: number;
  isCrouching: boolean;
  isProne: boolean;
  isSprinting: boolean;
  isTacSprinting: boolean;
  isSliding: boolean;
  isDiving: boolean;
  stridePhase: number;
  muzzleFlashTimer: number;
}

interface BulletProjectile {
  active: boolean;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  shooterOrigin: THREE.Vector3;
  whizTriggered: boolean;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  damage: number;
  headshotMult: number;
  airDrag: number;
  penetration: number;
  faction: Faction;
  fromPlayer: boolean;
  weaponId: WeaponId;
  shooterKey: string | null;
  shooterName: string;
  ignoreIds: Set<string>;
  mesh: THREE.Mesh;
}

interface GrenadeEntity {
  active: boolean;
  kind: 'frag' | 'smoke';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  fromPlayer: boolean;
  faction: Faction;
  shooterKey: string | null;
  shooterName: string;
  mesh: THREE.Mesh;
  smokeMesh: THREE.Mesh;
}

interface RocketProjectile {
  active: boolean;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  trailTimer: number;
  fromPlayer: boolean;
  faction: Faction;
  shooterKey: string | null;
  shooterName: string;
  mesh: THREE.Group;
}

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  gravity: number;
  sprite: THREE.Sprite;
}

interface ShellCasing {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  mesh: THREE.Mesh;
}

interface FlameJetParticle {
  active: boolean;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  damage: number;
  fromPlayer: boolean;
  faction: Faction;
  shooterKey: string | null;
  shooterName: string;
  weaponId: WeaponId;
  weaponLabel: string;
  hitSoldiers: Set<number>;
  hitRemotes: Set<string>;
  hitPlayer: boolean;
  sprite: THREE.Sprite;
}

// Pre-allocated scratch math helpers (Zero GC inside tick)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _aimTarget = new THREE.Vector3();
const _fireDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _tmpVec = new THREE.Vector3();
const _tmpVec2 = new THREE.Vector3();

const SETTINGS_STORAGE_KEY = 'kivu_settings_v1';
const LOADOUT_STORAGE_KEY = 'kivu_loadout_v1';
const INITIAL_TICKETS = 160;
const MAX_SOLDIERS_PER_SIDE = 7;

export class GameEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: HudSnapshot) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private textures!: ProceduralTexturePack;
  private terrainVis!: ReturnType<typeof createTerrainAndRiver>;
  private world!: WorldBuildResult;
  private envParticles!: EnvironmentParticleSystem;
  private weather!: WeatherController;
  private audio = new TacticalAudioEngine();
  private speech = new SpeechCalloutSynthesizer();
  private dualShock = new DualShockController();
  private padState!: DualShockState;
  private armoryOpen = false;
  private menuNavListeners = new Set<(ev: GamepadMenuEvent) => void>();
  private voiceTestCursor = 0;

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private hudSyncTimer = 0;

  // Audio & Control Settings (persisted)
  private sfxVolume = 0.8;
  private musicVolume = 0.45;
  private voiceVolume = 0.9;
  private audioMuted = false;
  private gamepadSettings: GamepadSettings = { ...DEFAULT_GAMEPAD_SETTINGS };

  // Game state
  private phase: GamePhase = 'title';
  private combatMode: CombatModeId = 'conquest';
  private playerFaction: Faction = 'army';
  private armyTickets = INITIAL_TICKETS;
  private rebelTickets = INITIAL_TICKETS;
  private armyScore = 0;
  private rebelScore = 0;
  private matchTimeRemaining = 600;
  private nextSoldierId = 1;
  private nextKillId = 1;
  private soldiers: SoldierEntity[] = [];
  private respawnQueueArmy = 0;
  private respawnQueueRebel = 0;
  private waveTimer = 0;
  private ticketBleedTimer = 0;
  private ambientSkirmishTimer = 1.2;
  private recentCombatIntensity = 0;

  // Player state
  private playerPos = new THREE.Vector3(-4, 3.5, 44);
  private playerVel = new THREE.Vector3();
  private playerGroundState: {
    grounded: boolean;
    coyoteTimer: number;
    jumpBuffer: number;
    inWater: boolean;
    waterDepth: number;
    landingImpact?: number;
  } = {
    grounded: true,
    coyoteTimer: 0,
    jumpBuffer: 0,
    inWater: false,
    waterDepth: 0,
    landingImpact: 0,
  };
  private playerYaw = 0;
  private playerPitch = 0;
  private playerEyeHeight = PLAYER_EYE_STAND;
  private playerHp = 100;
  private playerMaxHp = 100;
  private woundRoll = 0;
  private woundLimpPhase = 0;
  private landingDip = 0;
  private strafeRoll = 0;
  private timeSinceDamage = 10;
  private isRegenerating = false;
  private heartbeatTimer = 0;
  private playerStamina = 100;
  private playerKills = 0;
  private playerDeaths = 0;
  private playerRespawnTimer = 0;
  private mouseSensitivity = 0.0021;
  private pointerLocked = false;

  // Input & separated posture states ('stand' | 'crouch' | 'prone')
  private keys: Record<string, boolean> = {};
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private adsToggle = false;
  private jumpJustPressed = false;
  private playerStance: PlayerStance = 'stand';
  private isSprinting = false;
  private isTacSprinting = false;
  private lastShiftTapTime = 0;
  private kbTacSprintLatched = false;
  private sprintMomentumTimer = 0;
  private playerSlideTimer = 0;
  private playerSlideCooldown = 0;
  private playerSlideDir = new THREE.Vector3();
  private slideDustTimer = 0;
  private sprintBlend = 0;
  private tacSprintBlend = 0;
  private slideBlend = 0;
  private playerDiveTimer = 0;
  private playerDiveCooldown = 0;
  private playerDiveDir = new THREE.Vector3();

  // Android / Mobile Touch & Viewport State
  private isMobileDevice = false;
  private isPortrait = false;
  private isFullscreen = false;
  private userExitedFullscreen = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private touchFireHeld = false;
  private touchAdsHeld = false;

  // Weapons, 3-slot loadout & viewmodel
  private weaponAnchor = new THREE.Group();
  private viewmodels: Partial<Record<WeaponId, WeaponViewmodel>> = {};
  private playerLoadout: WeaponId[] = [...DEFAULT_ARMY_LOADOUT];
  private hasCustomLoadout = false;
  private currentWeaponId: WeaponId = 'carbine';
  private sniperZoomIdx: 0 | 1 = 0;
  private weaponInventory: Record<WeaponId, { mag: number; reserve: number }> =
    this.createFreshWeaponInventory();
  private grenades = 3;
  private smokeGrenades = 2;
  private activeSmokes: SmokeCloud[] = [];
  private nextSmokeId = 1;
  private fireCooldown = 0;
  private semiShotLocked = false;
  private isReloading = false;
  private reloadTimer = 0;
  private muzzleFlashTimer = 0;
  private adsAlpha = 0;
  private weaponBobPhase = 0;
  private footstepTimer = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private recoilKickZ = 0;
  private cameraShake = 0;
  private spreadBloom = 0;
  private playerBurnTimer = 0;
  private playerBurnTickAccum = 0;
  private playerBurnMeta: {
    killerName: string;
    killerFaction: Faction;
    weaponLabel: string;
    weaponId: WeaponId;
    sourcePos: THREE.Vector3;
    killerKey: string | null;
  } | null = null;
  private flameAudioCooldown = 0;

  // Feedback, IFF & Killcam state
  private hitMarkerTimer = 0;
  private hitMarkerHeadshot = false;
  private damageFlash = 0;
  private damageSourceWorld: THREE.Vector3 | null = null;
  private shotIndicators: Array<{
    id: number;
    key: string | null;
    sourcePos: THREE.Vector3;
    intensity: number;
    isHit: boolean;
  }> = [];
  private nextShotIndicatorId = 1;
  private aimingAtAlly: FriendlyFireTarget | null = null;
  private aimingAtEnemy = false;
  private aimingEnemyDist: number | null = null;
  private aimedEnemyRef: { key: string; pos: THREE.Vector3; name: string } | null = null;
  private activeEliminateSubId: number | null = null;
  private activeEliminateTargetKey: string | null = null;
  private activeEliminateTargetName: string | null = null;
  private scopeRangeMeters: number | null = null;
  private scopeDropSvgUnits = 0;
  private scopeDropTicks: Array<{ dist: number; ySvg: number }> = [];
  private friendlyFireWarnTimer = 0;
  private friendlyFireAudioCooldown = 0;
  private killcam!: KillcamSystem;
  private killcamDelayTimer = 0;
  private pendingKillcamMeta: KillcamShotMeta | null = null;
  private killcamHudInfo: KillcamHudState | null = null;
  private radioBanner: string | null = null;
  private radioBannerTimer = 0;
  private killFeed: KillFeedItem[] = [];
  private commsFeed: CommsLine[] = [];
  private nextCommsId = 1;
  private globalCommsTimer = 0;

  // Military Rank & Tom Clancy Cross-Com state
  private playerRankXp = 120;
  private playerRankLevel = 3;
  private selectedOrder: TacticalOrderId = 'assault';
  private activeOrder: TacticalOrderId | null = null;
  private activeOrderTimer = 0;
  private orderAckTimer = 0;
  private pendingAckOrder: TacticalOrderId | null = null;
  private orderAckSpeakerPos = new THREE.Vector3();
  private orderMarkerGroup!: THREE.Group;
  private orderMarkerTimer = 0;
  private orderXpCooldown = 0;
  private statusPanelOpen = false;
  private commandPanelOpen = false;

  // Short-Range Tactical Recon Drone (Tom Clancy thicket spotter)
  private droneActive = false;
  private droneBattery = 100;
  private readonly droneMaxRange = 95;
  private dronePos = new THREE.Vector3();
  private droneVel = new THREE.Vector3();
  private droneYaw = 0;
  private dronePitch = -0.35;
  private droneGroup!: THREE.Group;
  private droneRotors: THREE.Mesh[] = [];
  private droneAimingEnemy = false;
  private droneAimingEnemyName: string | null = null;
  private droneAimingEnemyDist: number | null = null;
  private droneClimbBurstTimer = 0;
  private droneDescendBurstTimer = 0;
  private droneScanAudioCooldown = 0;

  // LAN Wi-Fi Multiplayer & UDP Auto-Discovery
  private lan!: LanMultiplayerClient;
  private remotePlayers = new Map<string, RemotePlayerEntity>();
  private lanRoomCode: string | null = null;
  private lanPlayerName = 'Soldat-Kivu';
  private lanIps: string[] = [];
  private lanPort = 3000;
  private lanRooms: LanRoomSummary[] = [];
  private lanPeers: LanPeerPlayer[] = [];
  private lanUdpActive = false;
  private lanUdpPort = 41234;
  private lanSyncTimer = 0;

  // Pools
  private bullets: BulletProjectile[] = [];
  private grenadePool: GrenadeEntity[] = [];
  private rockets: RocketProjectile[] = [];
  private particles: Particle[] = [];
  private flameParticles: FlameJetParticle[] = [];
  private flameLight!: THREE.PointLight;
  private flameLightIntensity = 0;
  private casings: ShellCasing[] = [];
  private mistSprites: THREE.Sprite[] = [];

  constructor(container: HTMLElement, onHudUpdate: (hud: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.speech.setTimbreCallback((style, formantFreq, dist) => {
      this.audio.playVoiceTimbre(style, formantFreq, dist);
    });
    this.loadSettings();
    this.initThree();
    this.initPools();
    this.initLanMultiplayer();
    this.bindEvents();
    this.configureSectorsForMode(this.combatMode);
    this.populateInitialBattlefield();
    this.syncHud();
    this.startLoop();
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          sfxVolume: number;
          musicVolume: number;
          voiceVolume: number;
          sensitivity: number;
          muted: boolean;
          manualSprintV2: boolean;
          gamepadSettings: Partial<GamepadSettings>;
        }>;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = THREE.MathUtils.clamp(parsed.sfxVolume, 0, 1);
        if (typeof parsed.musicVolume === 'number') this.musicVolume = THREE.MathUtils.clamp(parsed.musicVolume, 0, 1);
        if (typeof parsed.voiceVolume === 'number') this.voiceVolume = THREE.MathUtils.clamp(parsed.voiceVolume, 0, 1);
        if (typeof parsed.sensitivity === 'number') {
          this.mouseSensitivity = THREE.MathUtils.clamp(parsed.sensitivity, 0.0008, 0.0045);
        }
        if (typeof parsed.muted === 'boolean') this.audioMuted = parsed.muted;
        if (parsed.gamepadSettings && typeof parsed.gamepadSettings === 'object') {
          const g = parsed.gamepadSettings;
          this.gamepadSettings = {
            enabled:
              typeof g.enabled === 'boolean' ? g.enabled : DEFAULT_GAMEPAD_SETTINGS.enabled,
            lookSensitivity:
              typeof g.lookSensitivity === 'number'
                ? THREE.MathUtils.clamp(g.lookSensitivity, 0.8, 5.2)
                : DEFAULT_GAMEPAD_SETTINGS.lookSensitivity,
            adsMultiplier:
              typeof g.adsMultiplier === 'number'
                ? THREE.MathUtils.clamp(g.adsMultiplier, 0.25, 1.15)
                : DEFAULT_GAMEPAD_SETTINGS.adsMultiplier,
            stickCurve:
              g.stickCurve === 'linear' || g.stickCurve === 'dynamic' || g.stickCurve === 'precision'
                ? g.stickCurve
                : DEFAULT_GAMEPAD_SETTINGS.stickCurve,
            moveDeadzone:
              typeof g.moveDeadzone === 'number'
                ? THREE.MathUtils.clamp(g.moveDeadzone, 0.02, 0.25)
                : DEFAULT_GAMEPAD_SETTINGS.moveDeadzone,
            lookDeadzone:
              typeof g.lookDeadzone === 'number'
                ? THREE.MathUtils.clamp(g.lookDeadzone, 0.02, 0.25)
                : DEFAULT_GAMEPAD_SETTINGS.lookDeadzone,
            autoSprint:
              parsed.manualSprintV2 && typeof g.autoSprint === 'boolean'
                ? g.autoSprint
                : DEFAULT_GAMEPAD_SETTINGS.autoSprint,
            invertY:
              typeof g.invertY === 'boolean' ? g.invertY : DEFAULT_GAMEPAD_SETTINGS.invertY,
            vibration:
              typeof g.vibration === 'boolean' ? g.vibration : DEFAULT_GAMEPAD_SETTINGS.vibration,
          };
        }
      }
      const rawLoadout = localStorage.getItem(LOADOUT_STORAGE_KEY);
      if (rawLoadout) {
        const parsedLoadout = JSON.parse(rawLoadout);
        if (Array.isArray(parsedLoadout) && parsedLoadout.length > 0) {
          this.playerLoadout = sanitizeLoadout(parsedLoadout, this.playerFaction);
          this.hasCustomLoadout = true;
          this.currentWeaponId = this.playerLoadout[0];
        }
      }
    } catch {
      // Ignore storage restrictions
    }
    this.dualShock.setSettings(this.gamepadSettings);
    this.audio.setSfxVolume(this.sfxVolume);
    this.audio.setMusicVolume(this.musicVolume);
    this.audio.setVoiceVolume(this.voiceVolume);
    this.speech.setVolume(this.voiceVolume);
    this.audio.setMuted(this.audioMuted);
    this.speech.setMuted(this.audioMuted);
    this.isMobileDevice = this.detectMobileDevice();
    this.isPortrait = window.innerHeight > window.innerWidth;
    this.isFullscreen = Boolean(document.fullscreenElement);
    if (this.isMobileDevice) {
      this.tryLockLandscape();
    }
  }

  private detectMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const smallScreen = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 950;
    return hasTouch && coarse && smallScreen;
  }

  private createFreshWeaponInventory(): Record<WeaponId, { mag: number; reserve: number }> {
    const inv = {} as Record<WeaponId, { mag: number; reserve: number }>;
    for (let i = 0; i < ALL_WEAPON_IDS.length; i++) {
      const id = ALL_WEAPON_IDS[i];
      const spec = WEAPON_SPECS[id];
      inv[id] = { mag: spec.magSize, reserve: spec.reserveMax };
    }
    return inv;
  }

  private getViewmodel(id: WeaponId): WeaponViewmodel {
    let vm = this.viewmodels[id];
    if (!vm) {
      vm = buildWeaponViewmodel(id, this.textures);
      vm.root.visible = id === this.currentWeaponId;
      this.weaponAnchor.add(vm.root);
      this.viewmodels[id] = vm;
    }
    return vm;
  }

  private saveLoadout() {
    try {
      localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(this.playerLoadout));
    } catch {
      // Ignore storage restrictions
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          sfxVolume: this.sfxVolume,
          musicVolume: this.musicVolume,
          voiceVolume: this.voiceVolume,
          sensitivity: this.mouseSensitivity,
          muted: this.audioMuted,
          manualSprintV2: true,
          gamepadSettings: this.gamepadSettings,
        })
      );
    } catch {
      // Ignore storage restrictions
    }
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private initThree() {
    this.isSoftwareGl = this.detectSoftwareWebGL();
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, this.isMobileDevice ? 1.25 : 1.5)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color('#708478');
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2('#708478', 0.0088);

    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.08, 520);
    this.scene.add(this.camera);

    // Mandatory studio/outdoor environment reflection via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Warm/cool 3-point outdoor lighting rig
    this.hemiLight = new THREE.HemisphereLight('#b8d2d8', '#3e3b28', 0.72);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#ffecd2', 1.85);
    this.sunLight.position.set(42, 62, 34);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 165;
    const d = 56;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight('#8bb8c9', 0.48);
    rimLight.position.set(-45, 28, -50);
    this.scene.add(rimLight);

    // Subtle Rebel Campfire Light at Campement Rebelle Nord
    const fireLight = new THREE.PointLight('#ff8438', 4.5, 18, 1.8);
    fireLight.position.set(10.0, groundHeightAt(10.0, -108) + 0.8, -108);
    this.scene.add(fireLight);

    this.textures = createProceduralTexturePack(this.renderer);
    this.terrainVis = createTerrainAndRiver(this.scene, this.textures);
    this.world = buildWorldEnvironment(this.scene, this.textures);
    this.envParticles = new EnvironmentParticleSystem(this.scene, this.textures);
    this.killcam = new KillcamSystem(this.scene, this.textures);
    this.weather = new WeatherController(this.scene);
    this.padState = this.dualShock.poll();

    // Build initial loadout Viewmodels lazily attached to camera
    this.camera.add(this.weaponAnchor);
    this.currentWeaponId = this.playerLoadout[0] ?? 'carbine';
    for (let i = 0; i < this.playerLoadout.length; i++) {
      this.getViewmodel(this.playerLoadout[i]);
    }
    this.weaponAnchor.visible = false; // Hidden on title camera pan
    this.initReconDrone();

    // Drifting morning river mist wisps
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.smokePuff,
        color: '#c8d6cc',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const mx = (i - 8.5) * 11;
      const mz = riverCenterZ(mx) + (Math.random() - 0.5) * 14;
      sp.position.set(mx, WATER_LEVEL + 1.4 + Math.random() * 1.2, mz);
      sp.scale.set(16 + Math.random() * 10, 4.5 + Math.random() * 2.5, 1);
      sp.userData.baseX = mx;
      sp.userData.phase = Math.random() * Math.PI * 2;
      this.scene.add(sp);
      this.mistSprites.push(sp);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initPools() {
    // Tracer bullets
    const bGeo = new THREE.BoxGeometry(0.035, 0.035, 0.95);
    const bMat = new THREE.MeshBasicMaterial({ color: '#ffd97d' });
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(bGeo, bMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.bullets.push({
        active: false,
        pos: new THREE.Vector3(),
        prevPos: new THREE.Vector3(),
        shooterOrigin: new THREE.Vector3(),
        whizTriggered: false,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 2.2,
        damage: 30,
        headshotMult: 2,
        airDrag: 0.002,
        penetration: 0.5,
        faction: 'army',
        fromPlayer: false,
        weaponId: 'ak47',
        shooterKey: null,
        shooterName: 'Soldat',
        ignoreIds: new Set(),
        mesh,
      });
    }

    // Frag & Tactical Smoke Grenades
    const gGeo = new THREE.SphereGeometry(0.085, 10, 8);
    const gMat = new THREE.MeshStandardMaterial({
      color: '#344229',
      roughness: 0.5,
      metalness: 0.45,
    });
    const sGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.19, 10);
    const sMat = new THREE.MeshStandardMaterial({
      color: '#6b7280',
      roughness: 0.48,
      metalness: 0.52,
    });
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(gGeo, gMat);
      mesh.visible = false;
      mesh.castShadow = true;
      this.scene.add(mesh);
      const smokeMesh = new THREE.Mesh(sGeo, sMat);
      smokeMesh.visible = false;
      smokeMesh.castShadow = true;
      this.scene.add(smokeMesh);
      this.grenadePool.push({
        active: false,
        kind: 'frag',
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        fuse: 0,
        fromPlayer: true,
        faction: 'army',
        shooterKey: null,
        shooterName: 'Grenade',
        mesh,
        smokeMesh,
      });
    }

    // RPG-7 Rocket projectiles
    const rBodyMat = new THREE.MeshStandardMaterial({
      color: '#3e4c2e',
      roughness: 0.55,
      metalness: 0.35,
    });
    const rTailMat = new THREE.MeshStandardMaterial({
      color: '#2c3035',
      roughness: 0.4,
      metalness: 0.8,
    });
    const rFlameMat = new THREE.MeshBasicMaterial({
      color: '#ff9b38',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rHeadGeo = new THREE.ConeGeometry(0.06, 0.24, 10);
    rHeadGeo.rotateX(Math.PI / 2);
    const rShaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8);
    rShaftGeo.rotateX(Math.PI / 2);
    const rFlameGeo = new THREE.ConeGeometry(0.055, 0.28, 8);
    rFlameGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 8; i++) {
      const rGroup = new THREE.Group();
      const head = new THREE.Mesh(rHeadGeo, rBodyMat);
      head.position.z = 0.22;
      rGroup.add(head);

      const shaft = new THREE.Mesh(rShaftGeo, rTailMat);
      shaft.position.z = -0.02;
      rGroup.add(shaft);

      const flame = new THREE.Mesh(rFlameGeo, rFlameMat);
      flame.position.z = -0.3;
      rGroup.add(flame);

      rGroup.visible = false;
      this.scene.add(rGroup);
      this.rockets.push({
        active: false,
        pos: new THREE.Vector3(),
        prevPos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 3.6,
        trailTimer: 0,
        fromPlayer: true,
        faction: 'army',
        shooterKey: null,
        shooterName: 'Lance-Roquettes',
        mesh: rGroup,
      });
    }

    // Particle pool (dust, water splash, smoke, sparks, blood)
    for (let i = 0; i < 120; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.smokePuff,
        color: '#ffffff',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.6,
        startScale: 0.3,
        endScale: 1.2,
        gravity: 3,
        sprite,
      });
    }

    // Volumetric Flamethrower Flame-Jet Pool + Dynamic Orange Fire Light
    this.flameLight = new THREE.PointLight('#ff7b1c', 0, 16, 1.8);
    this.scene.add(this.flameLight);
    for (let i = 0; i < 96; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.fireFlameSprite,
        color: '#ffe08a',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.flameParticles.push({
        active: false,
        pos: new THREE.Vector3(),
        prevPos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.65,
        startScale: 0.32,
        endScale: 2.1,
        damage: 14,
        fromPlayer: true,
        faction: 'army',
        shooterKey: null,
        shooterName: 'Lance-Flamme',
        weaponId: 'flamethrower',
        weaponLabel: 'M2A1 Flamme',
        hitSoldiers: new Set(),
        hitRemotes: new Set(),
        hitPlayer: false,
        sprite,
      });
    }

    // Brass shell casings
    const cGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.036, 6);
    cGeo.rotateZ(Math.PI / 2);
    const cMat = new THREE.MeshStandardMaterial({
      color: '#d4a64a',
      roughness: 0.25,
      metalness: 0.9,
    });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(cGeo, cMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.casings.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        mesh,
      });
    }

    // 3D Tom Clancy Cross-Com Tactical Waypoint Beacon
    this.orderMarkerGroup = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.88, 24), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.08;
    const chevMesh = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 4), ringMat);
    chevMesh.rotation.x = Math.PI;
    chevMesh.position.y = 1.15;
    this.orderMarkerGroup.add(ringMesh, chevMesh);
    this.orderMarkerGroup.visible = false;
    this.scene.add(this.orderMarkerGroup);
  }

  private configureSectorsForMode(mode: CombatModeId) {
    // 5 sectors from worldBuilder: A (index 0), B (1), C (2), D (3), E (4)
    const activeMap: Record<CombatModeId, string[]> = {
      conquest: ['A', 'B', 'C', 'D', 'E'],
      domination: ['B', 'C', 'D'],
      tdm: [],
      assault: ['A', 'C', 'E'],
      cqc: ['A', 'C', 'E'],
      sniper: ['B', 'C', 'D'],
    };
    const enabled = new Set(activeMap[mode]);
    for (const sec of this.world.sectors) {
      sec.active = enabled.has(sec.id);
      if (sec.id === 'A') {
        sec.owner = 'army';
        sec.progress = 100;
      } else if (sec.id === 'E') {
        sec.owner = 'rebels';
        sec.progress = -100;
      } else {
        sec.owner = 'neutral';
        sec.progress = 0;
      }
      if (sec.poleGroup) {
        sec.poleGroup.visible = sec.active;
      }
    }
  }

  private populateInitialBattlefield() {
    this.clearSoldiers();
    const spec = getCombatModeSpec(this.combatMode);
    this.armyTickets = spec.maxTickets;
    this.rebelTickets = spec.maxTickets;
    this.armyScore = 0;
    this.rebelScore = 0;
    this.matchTimeRemaining = spec.matchDurationSec;
    this.killFeed = [];

    for (let i = 0; i < spec.maxSoldiersPerSide; i++) {
      this.spawnFactionSoldier('army', i);
      this.spawnFactionSoldier('rebels', i);
    }
  }

  private clearSoldiers() {
    for (const s of this.soldiers) {
      this.scene.remove(s.root);
    }
    this.soldiers = [];
  }

  private getSpawnPoint(faction: Faction, slot = 0): THREE.Vector3 {
    const activeOwned = this.world.sectors.filter((s) => s.active && s.owner === faction);
    let baseX = faction === 'army' ? -10 : 10;
    let baseZ =
      this.combatMode === 'cqc'
        ? faction === 'army'
          ? 36
          : -36
        : this.combatMode === 'domination'
        ? faction === 'army'
          ? 56
          : -56
        : faction === 'army'
        ? 102
        : -102;

    if (activeOwned.length > 0 && Math.random() < 0.45) {
      const sec = activeOwned[Math.floor(Math.random() * activeOwned.length)];
      baseX = sec.position.x;
      baseZ = sec.position.z + (faction === 'army' ? 8 : -8);
    }
    const maxLim = PLAYABLE_HALF_EXTENT - 10;
    const sx = THREE.MathUtils.clamp(baseX + ((slot % 3) - 1) * 6 + (Math.random() - 0.5) * 6, -maxLim, maxLim);
    const sz = THREE.MathUtils.clamp(baseZ + (Math.random() - 0.5) * 7, -maxLim, maxLim);
    return new THREE.Vector3(sx, groundHeightAt(sx, sz), sz);
  }

  private initLanMultiplayer() {
    this.lan = new LanMultiplayerClient({
      onJoined: (data) => {
        this.lanRoomCode = data.roomCode;
        this.lanIps = data.lanIps;
        this.lanPort = data.port;
        if (data.combatMode && data.combatMode !== this.combatMode) {
          this.combatMode = data.combatMode;
          this.configureSectorsForMode(this.combatMode);
        }
        this.armyTickets = data.armyTickets;
        this.rebelTickets = data.rebelTickets;
        this.weather.applyServerWeather(data.weather);
        this.clearRemotePlayers();
        for (const p of data.players) {
          if (p.id !== data.playerId) {
            this.upsertRemotePlayer(p);
          }
        }
        const mSpec = getCombatModeSpec(this.combatMode);
        this.pushRadioBanner(`WI-FI LAN [${data.roomCode}] · ${mSpec.shortName} · ${data.players.length} J.`);
        this.syncHud();
      },
      onPlayerJoined: (player) => {
        if (player.id === this.lan.selfId) return;
        this.upsertRemotePlayer(player);
        this.pushRadioBanner(
          `${player.name} a rejoint (${player.faction === 'army' ? 'Armée' : 'Rebelles'})`
        );
        this.syncHud();
      },
      onPlayerLeft: (id) => {
        const rp = this.remotePlayers.get(id);
        if (rp) {
          this.pushRadioBanner(`${rp.name} a quitté le salon`);
          this.removeRemotePlayer(id);
          this.syncHud();
        }
      },
      onPlayerRespawned: (id, faction) => {
        const rp = this.remotePlayers.get(id);
        if (rp) {
          rp.alive = true;
          rp.hp = 100;
          rp.faction = faction;
          rp.root.visible = true;
        }
      },
      onSnapshot: (data) => {
        if (!this.lanRoomCode) return;
        this.armyTickets = data.armyTickets;
        this.rebelTickets = data.rebelTickets;
        const seen = new Set<string>();
        for (const p of data.players) {
          if (p.id === this.lan.selfId) continue;
          seen.add(p.id);
          this.upsertRemotePlayer(p);
        }
        for (const existingId of Array.from(this.remotePlayers.keys())) {
          if (!seen.has(existingId)) {
            this.removeRemotePlayer(existingId);
          }
        }
      },
      onRemoteShoot: (data) => {
        if (data.id === this.lan.selfId) return;
        const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
        const dir = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z).normalize();
        const rp = this.remotePlayers.get(data.id);
        const wId = sanitizeWeaponId(data.weaponId, rp?.weaponId || 'ak47');
        if (rp) {
          rp.muzzleFlash.visible = true;
          rp.muzzleFlashTimer = 0.055;
        }
        const shooterKey = `remote:${data.id}`;
        const shooterName = rp ? rp.name : data.faction === 'army' ? 'Soldat Armée' : 'Combattant Rebelle';
        if (isRocketWeapon(wId)) {
          this.spawnRocket(origin, dir, data.faction, false, shooterKey, shooterName, wId);
          this.audio.playGunshot(wId, origin.distanceTo(this.camera.position));
        } else if (isFlameWeapon(wId)) {
          this.spawnFlameJet(origin, dir, wId, data.faction, false, shooterKey, shooterName);
          this.audio.playFlamethrowerBurst(origin.distanceTo(this.camera.position));
        } else {
          this.spawnBullet(origin, dir, wId, data.faction, false, shooterKey, shooterName);
          this.audio.playGunshot(wId, origin.distanceTo(this.camera.position));
        }
      },
      onRemoteGrenade: (data) => {
        if (data.id === this.lan.selfId) return;
        const slot = this.grenadePool.find((g) => !g.active);
        if (!slot) return;
        const rp = this.remotePlayers.get(data.id);
        const kind = data.kind === 'smoke' ? 'smoke' : 'frag';
        slot.active = true;
        slot.kind = kind;
        slot.pos.set(data.pos.x, data.pos.y, data.pos.z);
        slot.vel.set(data.vel.x, data.vel.y, data.vel.z);
        slot.fuse = kind === 'smoke' ? 1.15 : 2.2;
        slot.fromPlayer = false;
        slot.faction = data.faction;
        slot.shooterKey = `remote:${data.id}`;
        slot.shooterName = rp ? rp.name : data.faction === 'army' ? 'Soldat Armée' : 'Combattant Rebelle';
        slot.mesh.position.copy(slot.pos);
        slot.smokeMesh.position.copy(slot.pos);
        slot.mesh.visible = kind === 'frag';
        slot.smokeMesh.visible = kind === 'smoke';
      },
      onDamaged: (data) => {
        const src = new THREE.Vector3(data.sourcePos.x, data.sourcePos.y, data.sourcePos.z);
        const matched = WEAPON_LIST.find(
          (w) => data.weaponLabel.includes(w.shortName) || data.weaponLabel.includes(w.name)
        );
        const weaponId: WeaponId = matched ? matched.id : 'ak47';
        if (isFlameWeapon(weaponId) || data.weaponLabel.toLowerCase().includes('flamme') || data.weaponLabel.toLowerCase().includes('lpo')) {
          this.ignitePlayer(3.2, data.attackerName, data.attackerFaction, data.weaponLabel, weaponId, src, `remote:${data.attackerId}`);
        }
        this.damagePlayer(
          data.damage,
          src,
          data.attackerName,
          data.attackerFaction,
          data.weaponLabel,
          true,
          `remote:${data.attackerId}`,
          weaponId,
          data.isHeadshot
        );
      },
      onKilled: (data) => {
        this.armyTickets = data.armyTickets;
        this.rebelTickets = data.rebelTickets;
        const isSelfKiller = data.killerId === this.lan.selfId;
        const isSelfVictim = data.victimId === this.lan.selfId;
        if (isSelfKiller) {
          this.playerKills++;
          this.awardRankXp(data.isHeadshot ? 80 : 50);
        }
        if (data.killerFaction === 'army') this.armyScore++;
        else this.rebelScore++;
        this.addKillFeed(
          isSelfKiller ? `${data.killerName} (Vous)` : data.killerName,
          data.killerFaction,
          isSelfVictim ? `${data.victimName} (Vous)` : data.victimName,
          data.victimFaction,
          data.weaponLabel,
          data.isHeadshot
        );
      },
      onWeatherChange: (weather) => {
        this.weather.applyServerWeather(weather);
        this.syncHud();
      },
      onRemoteOrder: (data) => {
        if (data.faction === this.playerFaction && this.phase === 'playing') {
          this.audio.playCommandChirp('ack');
          const voice = pickOrderVoice(data.faction, data.order as TacticalOrderId, 'issue');
          this.speech.speak(voice, data.faction, true, 12);
          this.pushRadioBanner(`${data.name} → ORDRE ${data.order.toUpperCase()}`);
        }
      },
      onDiscoveryUpdate: (data) => {
        this.lanIps = data.ips;
        this.lanPort = data.port;
        this.lanUdpActive = data.udpActive;
        this.lanUdpPort = data.udpPort;
        this.lanRooms = data.rooms;
        this.lanPeers = data.peers;
        this.syncHud();
      },
      onDisconnect: () => {
        this.lanRoomCode = null;
        this.clearRemotePlayers();
        this.syncHud();
      },
    });
    this.lan.connect();
  }

  private createRemoteNameSprite(label: string, faction: Faction): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 52;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = faction === 'army' ? 'rgba(12, 34, 52, 0.85)' : 'rgba(52, 16, 16, 0.85)';
      ctx.fillRect(4, 6, 248, 40);
      ctx.strokeStyle = faction === 'army' ? '#38bdf8' : '#f87171';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 6, 248, 40);
      ctx.fillStyle = '#f5f5f4';
      ctx.font = 'bold 21px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.slice(0, 18), 128, 27);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.position.set(0, 2.15, 0);
    sp.scale.set(1.35, 0.28, 1);
    return sp;
  }

  private upsertRemotePlayer(p: NetworkPlayerSnapshot) {
    let rp = this.remotePlayers.get(p.id);
    const cleanWeapon = sanitizeWeaponId(p.weaponId, p.faction === 'army' ? 'carbine' : 'ak47');
    if (!rp || rp.faction !== p.faction || rp.weaponId !== cleanWeapon) {
      if (rp) this.removeRemotePlayer(p.id);
      const rig = createSoldierMesh(p.faction, this.textures, p.rankLevel, cleanWeapon);
      const nameSprite = this.createRemoteNameSprite(p.name, p.faction);
      nameSprite.visible = p.faction === this.playerFaction;
      rig.root.add(nameSprite);

      const iffSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getAllyIffTexture(false),
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      );
      iffSprite.position.set(0, 2.48, 0);
      iffSprite.scale.set(0.38, 0.38, 1);
      iffSprite.visible = p.faction === this.playerFaction && p.alive;
      rig.root.add(iffSprite);

      rig.root.position.set(p.x, p.y, p.z);
      this.scene.add(rig.root);
      rp = {
        id: p.id,
        name: p.name,
        faction: p.faction,
        rankLevel: p.rankLevel,
        weaponId: cleanWeapon,
        hp: p.hp,
        alive: p.alive,
        root: rig.root,
        bodyPivot: rig.bodyPivot,
        headMesh: rig.headMesh,
        leftLeg: rig.leftLeg,
        rightLeg: rig.rightLeg,
        armsGroup: rig.armsGroup,
        muzzleFlash: rig.muzzleFlash,
        burnFxGroup: rig.burnFxGroup,
        burnTimer: 0,
        nameSprite,
        iffSprite,
        iffWarnActive: false,
        pos: new THREE.Vector3(p.x, p.y, p.z),
        targetPos: new THREE.Vector3(p.x, p.y, p.z),
        yaw: p.yaw,
        targetYaw: p.yaw,
        pitch: p.pitch,
        vx: p.vx,
        vz: p.vz,
        isCrouching: p.isCrouching,
        isProne: Boolean(p.isProne),
        isSprinting: p.isSprinting,
        isTacSprinting: p.isTacSprinting,
        isSliding: p.isSliding,
        isDiving: p.isDiving,
        stridePhase: 0,
        muzzleFlashTimer: 0,
      };
      this.remotePlayers.set(p.id, rp);
    } else {
      rp.name = p.name;
      rp.rankLevel = p.rankLevel;
      rp.weaponId = cleanWeapon;
      rp.hp = p.hp;
      rp.alive = p.alive;
      rp.targetPos.set(p.x, p.y, p.z);
      rp.targetYaw = p.yaw;
      rp.pitch = p.pitch;
      rp.vx = p.vx;
      rp.vz = p.vz;
      rp.isCrouching = p.isCrouching;
      rp.isProne = Boolean(p.isProne);
      rp.isSprinting = p.isSprinting;
      rp.isTacSprinting = p.isTacSprinting;
      rp.isSliding = p.isSliding;
      rp.isDiving = p.isDiving;
      rp.nameSprite.visible = !this.killcam.active && p.faction === this.playerFaction && p.alive;
      rp.iffSprite.visible = !this.killcam.active && p.faction === this.playerFaction && p.alive;
    }
    rp.root.visible = !this.killcam.active && rp.alive;
  }

  private removeRemotePlayer(id: string) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    this.scene.remove(rp.root);
    const mat = rp.nameSprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
    (rp.iffSprite.material as THREE.SpriteMaterial).dispose();
    this.remotePlayers.delete(id);
  }

  private clearRemotePlayers() {
    for (const id of Array.from(this.remotePlayers.keys())) {
      this.removeRemotePlayer(id);
    }
  }

  private updateRemotePlayers(dt: number) {
    for (const rp of this.remotePlayers.values()) {
      rp.nameSprite.visible = !this.killcam.active && rp.alive && rp.faction === this.playerFaction;
      rp.iffSprite.visible = !this.killcam.active && rp.alive && rp.faction === this.playerFaction;
      if (!rp.alive) {
        rp.root.visible = false;
        continue;
      }
      rp.root.visible = !this.killcam.active;
      rp.pos.lerp(rp.targetPos, 1 - Math.exp(-15 * dt));
      rp.root.position.copy(rp.pos);

      let diff = rp.targetYaw - rp.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rp.yaw += diff * (1 - Math.exp(-16 * dt));
      const visualYaw = rp.yaw + Math.PI;
      rp.root.rotation.y = visualYaw;

      const speed = Math.hypot(rp.vx, rp.vz);
      if (speed > 0.35 && !rp.isDiving && !rp.isSliding) {
        rp.stridePhase += dt * speed * 2.2;
      }
      const stance: PlayerStance = rp.isProne || rp.isDiving ? 'prone' : rp.isCrouching ? 'crouch' : 'stand';
      poseSoldierRig(rp, {
        x: rp.pos.x,
        y: rp.pos.y,
        z: rp.pos.z,
        yaw: visualYaw,
        stance,
        isSliding: rp.isSliding,
        isDiving: rp.isDiving,
        isSprinting: rp.isSprinting,
        moveSpeed: speed,
        stridePhase: rp.stridePhase,
        aimPitch: rp.pitch,
        combatAim: true,
        dt,
      });

      const markerOffset = stance === 'prone' ? 0.94 : stance === 'crouch' ? 1.56 : 2.15;
      rp.nameSprite.position.y = markerOffset;
      rp.iffSprite.position.y = markerOffset + 0.34;

      if (rp.burnTimer > 0) {
        rp.burnTimer = Math.max(0, rp.burnTimer - dt);
        rp.burnFxGroup.visible = rp.burnTimer > 0;
        rp.burnFxGroup.children.forEach((child, idx) => {
          const sp = child as THREE.Sprite;
          const flick = 0.8 + 0.35 * Math.sin(this.elapsed * 22 + idx * 1.9);
          sp.scale.set(0.55 * flick, (0.72 + idx * 0.08) * flick, 1);
          (sp.material as THREE.SpriteMaterial).opacity = Math.min(0.95, rp.burnTimer * 0.55 + 0.3);
        });
      } else {
        rp.burnFxGroup.visible = false;
      }

      if (rp.muzzleFlashTimer > 0) {
        rp.muzzleFlashTimer -= dt;
        if (rp.muzzleFlashTimer <= 0) rp.muzzleFlash.visible = false;
      }
    }
  }

  private spawnFactionSoldier(faction: Faction, slot = 0) {
    const pos = this.getSpawnPoint(faction, slot);
    const activeList = this.world.sectors.filter((sec) => sec.active);
    const s = spawnSoldier(
      this.nextSoldierId++,
      faction,
      pos,
      this.textures,
      this.scene,
      activeList.length > 0 ? activeList : this.world.sectors
    );
    s.root.visible = !this.killcam?.active;
    this.soldiers.push(s);
  }

  // Public Controls called by React UI
  public startGame(faction: Faction, mode?: CombatModeId) {
    this.audio.unlock();
    this.playerFaction = faction;
    if (mode) this.combatMode = mode;
    this.resetMatch(faction);
    this.phase = 'playing';
    this.weaponAnchor.visible = true;
    if (this.isMobileDevice) {
      this.requestFullscreenImmersive();
    } else {
      this.requestPointerLock();
    }
    const spec = getCombatModeSpec(this.combatMode);
    this.pushRadioBanner(`${spec.name.toUpperCase()} · ${spec.objectiveLabel}`);
    this.syncHud();
  }

  public joinLanMatch(
    roomCode: string,
    playerName: string,
    faction: Faction,
    mode?: CombatModeId,
    targetHost?: { ip: string; port: number } | null
  ) {
    this.audio.unlock();
    this.playerFaction = faction;
    if (mode) this.combatMode = mode;
    this.lanPlayerName = playerName.trim() || 'Soldat-Kivu';
    this.lan.joinRoom(roomCode, this.lanPlayerName, faction, this.combatMode, targetHost);
    this.resetMatch(faction);
    this.phase = 'playing';
    this.weaponAnchor.visible = true;
    if (this.isMobileDevice) {
      this.requestFullscreenImmersive();
    } else {
      this.requestPointerLock();
    }
    this.syncHud();
  }

  public updateLanPresence(playerName: string, faction: Faction) {
    this.lanPlayerName = playerName.trim() || 'Soldat-Kivu';
    this.playerFaction = faction;
    this.lan.updatePresence(this.lanPlayerName, faction);
  }

  public leaveLanMatch() {
    this.lan.leaveRoom();
    this.lanRoomCode = null;
    this.clearRemotePlayers();
    this.returnToTitle();
  }

  public refreshLanRooms() {
    this.lan.requestRooms();
  }

  public resumeGame() {
    this.audio.unlock();
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.weaponAnchor.visible =
        this.playerHp > 0 && !(isSniperWeapon(this.currentWeaponId) && this.adsAlpha > 0.78);
      if (this.isMobileDevice) {
        this.requestFullscreenImmersive();
      } else {
        this.requestPointerLock();
      }
      this.syncHud();
    }
  }

  public setArmoryOpen(open: boolean) {
    this.armoryOpen = open;
  }

  public isGamepadActive(): boolean {
    return Boolean(this.padState?.connected && this.gamepadSettings.enabled);
  }

  public onGamepadMenuEvent(cb: (ev: GamepadMenuEvent) => void): () => void {
    this.menuNavListeners.add(cb);
    return () => {
      this.menuNavListeners.delete(cb);
    };
  }

  public rumbleMenu(strong = false) {
    if (!this.isGamepadActive()) return;
    if (strong) {
      this.dualShock.rumble(0.18, 0.08, 40);
    } else {
      this.dualShock.rumble(0.08, 0.03, 22);
    }
  }

  public pauseForArmory() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.exitPointerLock();
      this.syncHud();
    }
  }

  public getPlayerLoadout(): WeaponId[] {
    return [...this.playerLoadout];
  }

  public setPlayerLoadout(next: WeaponId[]) {
    const clean = sanitizeLoadout(next, this.playerFaction).slice(0, MAX_LOADOUT_SIZE);
    this.playerLoadout = clean;
    this.hasCustomLoadout = true;
    this.saveLoadout();
    for (let i = 0; i < this.playerLoadout.length; i++) {
      this.getViewmodel(this.playerLoadout[i]);
    }
    if (!this.playerLoadout.includes(this.currentWeaponId)) {
      this.switchWeapon(this.playerLoadout[0]);
    }
    this.audio.playCommandChirp('ack');
    this.syncHud();
  }

  public switchLoadoutSlot(slotIdx: number) {
    if (slotIdx >= 0 && slotIdx < this.playerLoadout.length) {
      this.switchWeapon(this.playerLoadout[slotIdx]);
      this.syncHud();
    }
  }

  public returnToTitle() {
    if (this.lanRoomCode) {
      this.lan.leaveRoom();
      this.lanRoomCode = null;
      this.clearRemotePlayers();
    }
    this.stopAndCleanupKillcam();
    this.killcam.resetBuffer();
    this.exitPointerLock();
    this.phase = 'title';
    this.weaponAnchor.visible = false;
    this.resetMatch(this.playerFaction);
    this.lan.requestRooms();
    this.syncHud();
  }

  public setMuted(m: boolean) {
    this.audioMuted = m;
    this.audio.setMuted(m);
    this.speech.setMuted(m);
    this.saveSettings();
    this.syncHud();
  }

  public setSfxVolume(v: number) {
    this.sfxVolume = THREE.MathUtils.clamp(v, 0, 1);
    this.audio.setSfxVolume(this.sfxVolume);
    this.saveSettings();
    this.syncHud();
  }

  public setMusicVolume(v: number) {
    this.musicVolume = THREE.MathUtils.clamp(v, 0, 1);
    this.audio.setMusicVolume(this.musicVolume);
    this.saveSettings();
    this.syncHud();
  }

  public setVoiceVolume(v: number) {
    this.voiceVolume = THREE.MathUtils.clamp(v, 0, 1);
    this.audio.setVoiceVolume(this.voiceVolume);
    this.speech.setVolume(this.voiceVolume);
    this.saveSettings();
    this.syncHud();
  }

  public playTestVoiceVolume() {
    this.audio.unlock();
    const profileId = VOICE_PROFILE_ORDER[this.voiceTestCursor % VOICE_PROFILE_ORDER.length];
    this.voiceTestCursor++;
    const spec = MALE_VOICE_PROFILES[profileId];
    this.audio.playCommandChirp('issue');
    const phrase = pickCommsPhrase(this.playerFaction, spec.style === 'funny' ? 'contact' : 'advance', profileId);
    this.speech.speak(phrase.text, this.playerFaction, true, 0, profileId);
    this.pushRadioBanner(`${spec.label} (${spec.regionLabel}) : « ${phrase.text} »`);
  }

  public setCombatMode(mode: CombatModeId) {
    this.combatMode = mode;
    this.resetMatch(this.playerFaction);
    this.syncHud();
  }

  public setPlayerFaction(faction: Faction) {
    this.playerFaction = faction;
    if (!this.hasCustomLoadout) {
      this.playerLoadout = faction === 'army' ? [...DEFAULT_ARMY_LOADOUT] : [...DEFAULT_REBEL_LOADOUT];
      this.currentWeaponId = this.playerLoadout[0];
      for (let i = 0; i < this.playerLoadout.length; i++) {
        this.getViewmodel(this.playerLoadout[i]);
      }
      this.syncHud();
    }
  }

  public setSensitivity(val: number) {
    this.mouseSensitivity = val;
    this.saveSettings();
  }

  public setGamepadSettings(partial: Partial<GamepadSettings>) {
    this.gamepadSettings = {
      ...this.gamepadSettings,
      ...partial,
      lookSensitivity:
        partial.lookSensitivity !== undefined
          ? THREE.MathUtils.clamp(partial.lookSensitivity, 0.8, 5.2)
          : this.gamepadSettings.lookSensitivity,
      adsMultiplier:
        partial.adsMultiplier !== undefined
          ? THREE.MathUtils.clamp(partial.adsMultiplier, 0.25, 1.15)
          : this.gamepadSettings.adsMultiplier,
      moveDeadzone:
        partial.moveDeadzone !== undefined
          ? THREE.MathUtils.clamp(partial.moveDeadzone, 0.02, 0.25)
          : this.gamepadSettings.moveDeadzone,
      lookDeadzone:
        partial.lookDeadzone !== undefined
          ? THREE.MathUtils.clamp(partial.lookDeadzone, 0.02, 0.25)
          : this.gamepadSettings.lookDeadzone,
    };
    this.dualShock.setSettings(this.gamepadSettings);
    this.saveSettings();
    this.syncHud();
  }

  public resetGamepadSettings() {
    this.gamepadSettings = { ...DEFAULT_GAMEPAD_SETTINGS };
    this.dualShock.setSettings(this.gamepadSettings);
    this.saveSettings();
    this.syncHud();
  }

  public toggleStatusPanel() {
    this.statusPanelOpen = !this.statusPanelOpen;
    this.audio.playCommandChirp('ack');
    this.syncHud();
  }

  public toggleCommandPanel() {
    this.commandPanelOpen = !this.commandPanelOpen;
    this.audio.playCommandChirp('ack');
    this.syncHud();
  }

  public requestPointerLock() {
    if (this.isMobileDevice) {
      this.requestFullscreenImmersive();
      return;
    }
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore if blocked by browser gesture rules
    }
  }

  private tryLockLandscape() {
    try {
      const orient = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      orient?.lock?.('landscape').catch(() => {});
    } catch {
      // Orientation lock may require fullscreen or Android browser context
    }
  }

  public requestFullscreenImmersive() {
    this.userExitedFullscreen = false;
    try {
      const rootEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (rootEl.requestFullscreen) {
          rootEl
            .requestFullscreen({ navigationUI: 'hide' })
            .then(() => this.tryLockLandscape())
            .catch(() => this.tryLockLandscape());
        } else if (rootEl.webkitRequestFullscreen) {
          Promise.resolve(rootEl.webkitRequestFullscreen())
            .then(() => this.tryLockLandscape())
            .catch(() => this.tryLockLandscape());
        } else {
          this.tryLockLandscape();
        }
      } else {
        this.tryLockLandscape();
      }
      window.scrollTo(0, 1);
    } catch {
      // Fullscreen may require direct gesture on strict mobile browsers
    }
  }

  public toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        this.userExitedFullscreen = true;
        document.exitFullscreen?.().catch(() => {});
      } else {
        this.requestFullscreenImmersive();
      }
    } catch {
      // Ignore
    }
  }

  public setTouchMove(x: number, y: number, sprint = false) {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
    this.touchSprint = sprint;
  }

  public addTouchLookDelta(dx: number, dy: number) {
    if (this.phase !== 'playing' || this.playerHp <= 0) return;
    this.audio.unlock();
    if (this.droneActive) {
      const droneSens = this.mouseSensitivity * 1.15;
      this.droneYaw -= dx * droneSens;
      this.dronePitch = THREE.MathUtils.clamp(this.dronePitch - dy * droneSens, -1.28, 0.28);
      return;
    }
    const spec = WEAPON_SPECS[this.currentWeaponId];
    const sniperAdsScale =
      isSniperWeapon(this.currentWeaponId)
        ? THREE.MathUtils.clamp(((spec.zoomFovs?.[this.sniperZoomIdx] ?? spec.adsFov) / 72) * 1.4, 0.16, 0.75)
        : 1.0;
    const adsScale = this.adsAlpha > 0.5 ? (isSniperWeapon(this.currentWeaponId) ? sniperAdsScale : 0.58) : 1.0;
    const sens = this.mouseSensitivity * 1.35 * adsScale;
    this.playerYaw -= dx * sens;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * sens, -1.42, 1.42);
  }

  public setTouchFire(held: boolean) {
    if (held) this.audio.unlock();
    if (this.droneActive) {
      if (held) this.markEnemiesWithDrone();
      return;
    }
    this.touchFireHeld = held;
    if (!held) this.semiShotLocked = false;
  }

  public setTouchAds(active: boolean) {
    this.audio.unlock();
    this.touchAdsHeld = active;
    this.syncHud();
  }

  public triggerTouchAction(
    action:
      | 'jump'
      | 'crouch'
      | 'prone'
      | 'reload'
      | 'nextWeapon'
      | 'frag'
      | 'smoke'
      | 'zoom'
      | 'pause'
      | 'orderNext'
      | 'orderIssue'
      | 'drone'
      | 'droneAscend'
      | 'droneDescend'
      | 'droneMark'
  ) {
    this.audio.unlock();
    if (action === 'pause') {
      if (this.phase === 'playing') {
        if (this.droneActive) this.recallReconDrone(false);
        this.phase = 'paused';
        this.touchFireHeld = false;
        this.touchAdsHeld = false;
        this.touchMoveX = 0;
        this.touchMoveY = 0;
        this.exitPointerLock();
        this.syncHud();
      }
      return;
    }
    if (this.phase !== 'playing' || this.playerHp <= 0) return;

    switch (action) {
      case 'drone':
        this.toggleReconDrone();
        break;
      case 'droneAscend':
        if (this.droneActive) this.droneClimbBurstTimer = 0.34;
        break;
      case 'droneDescend':
        if (this.droneActive) this.droneDescendBurstTimer = 0.34;
        break;
      case 'droneMark':
        if (this.droneActive) this.markEnemiesWithDrone();
        break;
      case 'jump':
        if (this.droneActive) {
          this.droneClimbBurstTimer = 0.34;
          break;
        }
        if (this.playerSlideTimer > 0) {
          this.playerSlideTimer = 0;
          this.playerStance = 'stand';
          this.jumpJustPressed = true;
        } else if (this.playerStance !== 'stand') {
          this.playerStance = 'stand';
        } else {
          this.jumpJustPressed = true;
        }
        break;
      case 'crouch':
        if (this.droneActive) {
          this.droneDescendBurstTimer = 0.34;
          break;
        }
        this.handleCrouchAction();
        break;
      case 'prone':
        this.handleProneAction(true);
        break;
      case 'reload':
        this.startReload();
        break;
      case 'nextWeapon':
        if (this.playerLoadout.length > 1) {
          const curIdx = Math.max(0, this.playerLoadout.indexOf(this.currentWeaponId));
          this.switchWeapon(this.playerLoadout[(curIdx + 1) % this.playerLoadout.length]);
        }
        break;
      case 'frag':
        this.throwGrenade('frag');
        break;
      case 'smoke':
        this.throwGrenade('smoke');
        break;
      case 'zoom':
        if (isSniperWeapon(this.currentWeaponId)) {
          this.sniperZoomIdx = this.sniperZoomIdx === 0 ? 1 : 0;
          this.audio.playCommandChirp('ack');
          this.syncHud();
        }
        break;
      case 'orderNext':
        this.cycleTacticalOrder();
        break;
      case 'orderIssue':
        this.issueTacticalOrder(this.selectedOrder);
        break;
    }
  }

  private exitPointerLock() {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  private resetMatch(faction: Faction) {
    this.configureSectorsForMode(this.combatMode);

    // Reset barrels & active smokes
    for (const b of this.world.barrels) {
      b.exploded = false;
      b.hp = 45;
      b.mesh.visible = true;
      b.collider.maxY = b.position.y + 0.6;
    }
    this.activeSmokes = [];

    // Reset pools
    this.bullets.forEach((b) => {
      b.active = false;
      b.mesh.visible = false;
    });
    this.grenadePool.forEach((g) => {
      g.active = false;
      g.mesh.visible = false;
      g.smokeMesh.visible = false;
    });
    this.rockets.forEach((r) => {
      r.active = false;
      r.mesh.visible = false;
    });

    this.playerKills = 0;
    this.playerDeaths = 0;
    this.playerRankXp = 120;
    this.playerRankLevel = 3;
    this.selectedOrder = 'assault';
    this.activeOrder = null;
    this.activeOrderTimer = 0;
    this.orderAckTimer = 0;
    this.pendingAckOrder = null;
    this.activeEliminateSubId = null;
    this.activeEliminateTargetKey = null;
    this.activeEliminateTargetName = null;
    this.orderMarkerTimer = 0;
    this.statusPanelOpen = false;
    this.commandPanelOpen = false;
    this.droneActive = false;
    this.droneBattery = 100;
    this.droneAimingEnemy = false;
    this.droneAimingEnemyName = null;
    this.droneAimingEnemyDist = null;
    this.droneClimbBurstTimer = 0;
    this.droneDescendBurstTimer = 0;
    if (this.droneGroup) this.droneGroup.visible = false;
    if (this.orderMarkerGroup) this.orderMarkerGroup.visible = false;
    this.commsFeed = [];
    this.globalCommsTimer = 0;
    this.shotIndicators = [];
    this.populateInitialBattlefield();
    this.respawnPlayer(faction);
  }

  private stopAndCleanupKillcam() {
    if (this.killcam?.active) {
      this.killcam.stopReplay(this.camera);
    }
    this.pendingKillcamMeta = null;
    this.killcamDelayTimer = 0;
    this.killcamHudInfo = null;
    for (let i = 0; i < this.soldiers.length; i++) {
      this.soldiers[i].root.visible = true;
    }
    for (const rp of this.remotePlayers.values()) {
      rp.root.visible = rp.alive;
    }
  }

  public skipKillcam() {
    if (this.phase !== 'playing' || this.playerHp > 0) return;
    if (this.killcam.active && this.killcam.elapsed >= 0.45) {
      this.audio.playKillcamSting(false);
      this.stopAndCleanupKillcam();
      this.respawnPlayer(this.playerFaction);
      this.syncHud();
    }
  }

  private respawnPlayer(faction: Faction) {
    this.stopAndCleanupKillcam();
    this.killcam.resetBuffer();
    const spawn = this.getSpawnPoint(faction, 1);
    this.playerPos.copy(spawn);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = faction === 'army' ? 0 : Math.PI;
    this.playerPitch = 0;
    this.playerHp = this.playerMaxHp;
    this.woundRoll = 0;
    this.woundLimpPhase = 0;
    this.timeSinceDamage = 10;
    this.isRegenerating = false;
    this.heartbeatTimer = 0;
    this.playerStamina = 100;
    this.playerRespawnTimer = 0;
    this.playerStance = 'stand';
    this.playerEyeHeight = PLAYER_EYE_STAND;
    this.landingDip = 0;
    this.strafeRoll = 0;
    this.isSprinting = false;
    this.isTacSprinting = false;
    this.kbTacSprintLatched = false;
    this.sprintMomentumTimer = 0;
    this.playerSlideTimer = 0;
    this.playerSlideCooldown = 0;
    this.sprintBlend = 0;
    this.tacSprintBlend = 0;
    this.slideBlend = 0;
    this.playerDiveTimer = 0;
    this.playerDiveCooldown = 0;
    this.damageFlash = 0;
    this.playerBurnTimer = 0;
    this.playerBurnTickAccum = 0;
    this.playerBurnMeta = null;
    this.damageSourceWorld = null;
    this.shotIndicators = [];
    this.aimingAtAlly = null;
    this.aimingAtEnemy = false;
    this.aimingEnemyDist = null;
    this.aimedEnemyRef = null;
    this.droneActive = false;
    this.droneAimingEnemy = false;
    this.droneAimingEnemyName = null;
    this.droneAimingEnemyDist = null;
    this.droneClimbBurstTimer = 0;
    this.droneDescendBurstTimer = 0;
    if (this.droneGroup) this.droneGroup.visible = false;
    this.scopeRangeMeters = null;
    this.scopeDropSvgUnits = 0;
    this.scopeDropTicks = [];
    this.friendlyFireWarnTimer = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.grenades = 3;
    this.smokeGrenades = 2;
    this.weaponInventory = this.createFreshWeaponInventory();
    if (!this.hasCustomLoadout) {
      this.playerLoadout =
        faction === 'army' ? [...DEFAULT_ARMY_LOADOUT] : [...DEFAULT_REBEL_LOADOUT];
    }
    const defaultWep: WeaponId = this.playerLoadout[0] ?? (faction === 'army' ? 'carbine' : 'ak47');
    this.switchWeapon(defaultWep);
    this.weaponAnchor.visible = this.phase === 'playing';
    if (this.lanRoomCode) {
      this.lan.sendRespawn(faction);
    }
  }

  private switchWeapon(id: WeaponId) {
    const cleanId = sanitizeWeaponId(id, this.playerLoadout[0] ?? 'carbine');
    const vm = this.getViewmodel(cleanId);
    if (this.currentWeaponId === cleanId && vm.root.visible) return;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.sniperZoomIdx = 0;
    this.currentWeaponId = cleanId;
    (Object.keys(this.viewmodels) as WeaponId[]).forEach((wid) => {
      const m = this.viewmodels[wid];
      if (m) m.root.visible = wid === cleanId;
    });
  }

  private pushRadioBanner(text: string) {
    this.radioBanner = text;
    this.radioBannerTimer = 4.2;
    this.audio.playRadioSquelch();
  }

  private addKillFeed(
    killerName: string,
    killerFaction: Faction,
    victimName: string,
    victimFaction: Faction,
    weaponLabel: string,
    isHeadshot: boolean
  ) {
    this.killFeed.unshift({
      id: this.nextKillId++,
      killerName,
      killerFaction,
      victimName,
      victimFaction,
      weaponLabel,
      isHeadshot,
      timestamp: this.elapsed,
    });
    if (this.killFeed.length > 4) {
      this.killFeed.length = 4;
    }
  }

  private emitSoldierComms(
    speaker: string,
    faction: Faction,
    pos: THREE.Vector3,
    category: CommsCategory,
    urgent = false,
    voiceProfile?: VoiceProfileId
  ) {
    if (
      urgent &&
      this.commsFeed.length > 0 &&
      this.commsFeed[0].category === category &&
      this.commsFeed[0].faction === faction &&
      this.elapsed - this.commsFeed[0].timestamp < 1.1
    ) {
      return;
    }
    if (!urgent && this.globalCommsTimer > 0) return;

    const dist = pos.distanceTo(this.camera.position);
    if (dist > 78) return;

    const chosenProfile = voiceProfile || (faction === 'army' ? 'tonnerre' : 'simba');
    const profileSpec = MALE_VOICE_PROFILES[chosenProfile];
    const phrase = pickCommsPhrase(faction, category, chosenProfile);
    this.commsFeed.unshift({
      id: this.nextCommsId++,
      speaker,
      faction,
      language: phrase.language,
      voiceStyle: profileSpec.style,
      voiceLabel: profileSpec.regionLabel,
      text: phrase.text,
      translation: phrase.translation,
      category,
      timestamp: this.elapsed,
    });
    if (this.commsFeed.length > 4) {
      this.commsFeed.length = 4;
    }

    if (!urgent) {
      this.globalCommsTimer = 2.6 + Math.random() * 1.8;
    }

    if (this.phase === 'playing') {
      this.speech.speak(phrase.text, faction, urgent, dist, chosenProfile);
      if (urgent || (faction === this.playerFaction && Math.random() < 0.4)) {
        this.audio.playRadioSquelch();
      }
    }
  }

  private triggerPlayerDive() {
    if (
      this.playerHp <= 0 ||
      !this.playerGroundState.grounded ||
      this.playerDiveTimer > 0 ||
      this.playerDiveCooldown > 0 ||
      this.playerStamina < 16
    ) {
      return false;
    }
    this.playerDiveTimer = 0.44;
    this.playerDiveCooldown = 1.35;
    this.playerStance = 'prone';
    this.playerSlideTimer = 0;
    this.playerStamina = Math.max(0, this.playerStamina - 16);
    this.adsToggle = false;

    const kbFwd =
      (this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const kbStrafe =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['KeyQ'] || this.keys['ArrowLeft'] ? 1 : 0);
    const padMoveY = this.isGamepadActive() ? this.padState.moveY : 0;
    const padMoveX = this.isGamepadActive() ? this.padState.moveX : 0;
    const moveFwd = THREE.MathUtils.clamp(kbFwd - padMoveY, -1, 1);
    const moveStrafe = THREE.MathUtils.clamp(kbStrafe + padMoveX, -1, 1);

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));
    this.playerDiveDir
      .set(0, 0, 0)
      .addScaledVector(_forward, moveFwd)
      .addScaledVector(_right, moveStrafe);
    if (this.playerDiveDir.lengthSq() < 0.05) {
      this.playerDiveDir.copy(_forward);
    } else {
      this.playerDiveDir.normalize();
    }

    this.playerVel.x = this.playerDiveDir.x * 8.8;
    this.playerVel.z = this.playerDiveDir.z * 8.8;
    this.playerVel.y = 2.55;
    this.playerGroundState.grounded = false;
    this.audio.playDiveThud(0);
    this.dualShock.rumble(0.35, 0.55, 130);
    return true;
  }

  private triggerPlayerSlide(): boolean {
    if (
      this.playerHp <= 0 ||
      !this.playerGroundState.grounded ||
      this.playerSlideTimer > 0 ||
      this.playerSlideCooldown > 0 ||
      this.playerDiveTimer > 0 ||
      (!this.isSprinting && !this.isTacSprinting && this.sprintMomentumTimer <= 0) ||
      this.playerStamina < 10
    ) {
      return false;
    }

    this.playerSlideTimer = 0.66;
    this.playerSlideCooldown = 0.42;
    this.playerStamina = Math.max(0, this.playerStamina - 10);
    this.playerStance = 'stand';
    this.kbTacSprintLatched = false;

    const kbFwd =
      (this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const kbStrafe =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['KeyQ'] || this.keys['ArrowLeft'] ? 1 : 0);
    const padMoveY = this.isGamepadActive() ? this.padState.moveY : 0;
    const padMoveX = this.isGamepadActive() ? this.padState.moveX : 0;
    const moveFwd = THREE.MathUtils.clamp(kbFwd - padMoveY, -1, 1);
    const moveStrafe = THREE.MathUtils.clamp(kbStrafe + padMoveX, -1, 1);

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));
    this.playerSlideDir
      .set(0, 0, 0)
      .addScaledVector(_forward, moveFwd)
      .addScaledVector(_right, moveStrafe);
    if (this.playerSlideDir.lengthSq() < 0.05) {
      this.playerSlideDir.copy(_forward);
    } else {
      this.playerSlideDir.normalize();
    }

    const boostSpeed = this.isTacSprinting ? 12.6 : 11.5;
    this.playerVel.x = this.playerSlideDir.x * boostSpeed;
    this.playerVel.z = this.playerSlideDir.z * boostSpeed;
    this.slideDustTimer = 0;

    const surf = getSurfaceTypeAt(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.audio.playSlide(surf);
    this.dualShock.rumble(0.28, 0.42, 180);
    return true;
  }

  private handleCrouchAction() {
    if (this.playerSlideTimer > 0 && this.playerSlideTimer < 0.52) {
      // Slide-cancel smoothly back to standing
      this.playerSlideTimer = 0;
      this.playerStance = 'stand';
      return;
    }
    this.dualShock.clearSprintLatch();
    this.touchSprint = false;
    this.kbTacSprintLatched = false;
    if (this.triggerPlayerSlide()) {
      return;
    }
    this.playerDiveTimer = 0;
    this.playerStance = this.playerStance === 'crouch' ? 'stand' : 'crouch';
  }

  private handleProneAction(allowDive: boolean) {
    if (this.playerStance === 'prone') {
      this.playerStance = 'stand';
      this.playerDiveTimer = 0;
      return;
    }
    const wasSprinting = this.isSprinting || this.isTacSprinting || this.sprintMomentumTimer > 0;
    this.dualShock.clearSprintLatch();
    this.touchSprint = false;
    this.kbTacSprintLatched = false;
    if (allowDive && wasSprinting && this.triggerPlayerDive()) {
      return;
    }
    this.playerSlideTimer = 0;
    this.playerStance = 'prone';
    this.audio.playDiveThud(0);
    this.dualShock.rumble(0.18, 0.3, 90);
  }

  private onMobileFirstGesture = () => {
    if (!this.isMobileDevice || this.userExitedFullscreen) return;
    if (!document.fullscreenElement || this.isPortrait) {
      this.requestFullscreenImmersive();
    }
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    window.addEventListener('pointerdown', this.onMobileFirstGesture, { capture: true, passive: true });
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onFullscreenChange = () => {
    this.isFullscreen = Boolean(document.fullscreenElement);
    if (this.isFullscreen && this.isMobileDevice) {
      this.tryLockLandscape();
    }
    this.onResize();
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.isPortrait = h > w;
    this.isMobileDevice = this.detectMobileDevice();
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, this.isMobileDevice ? 1.25 : 1.5)
    );
    this.syncHud();
  };

  private onWindowBlur = () => {
    this.keys = {};
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.touchFireHeld = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchSprint = false;
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked && this.phase === 'playing') {
      this.keys = {};
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
    }
    this.syncHud();
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.phase === 'playing') e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;

    const inSettingsOrArmory =
      this.phase === 'paused' || this.phase === 'victory' || this.phase === 'defeat' || this.armoryOpen;
    if (inSettingsOrArmory && this.isGamepadActive()) {
      const blockedCodes = [
        'Escape',
        'Tab',
        'Enter',
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'KeyB',
      ];
      if (blockedCodes.includes(e.code)) {
        e.preventDefault();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (this.phase === 'playing') {
        this.phase = 'paused';
        this.exitPointerLock();
        this.syncHud();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    if ((e.code === 'KeyH' || e.code === 'Digit4') && !e.repeat) {
      this.toggleReconDrone();
      return;
    }
    if (this.droneActive && (e.code === 'KeyM' || e.code === 'KeyE') && !e.repeat) {
      this.markEnemiesWithDrone();
      return;
    }

    if (e.code === 'Space' && !e.repeat) {
      if (this.droneActive) return;
      if (this.playerHp <= 0 && this.killcam.active) {
        this.skipKillcam();
        return;
      }
      if (this.playerSlideTimer > 0) {
        this.playerSlideTimer = 0;
        this.playerStance = 'stand';
        this.jumpJustPressed = true;
        return;
      }
      // Rising from Crouch or Prone cleanly separates stance recovery from jump
      if (this.playerStance !== 'stand') {
        this.playerStance = 'stand';
        return;
      }
      this.jumpJustPressed = true;
    }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      if (this.droneActive) return;
      if (this.adsAlpha > 0.5 && isSniperWeapon(this.currentWeaponId)) {
        this.sniperZoomIdx = this.sniperZoomIdx === 0 ? 1 : 0;
        this.audio.playCommandChirp('ack');
        this.syncHud();
        return;
      }
      if (this.playerStance !== 'stand') {
        this.playerStance = 'stand';
      }
      const now = performance.now();
      if (now - this.lastShiftTapTime < 340) {
        this.kbTacSprintLatched = true;
      } else {
        this.kbTacSprintLatched = false;
      }
      this.lastShiftTapTime = now;
    }
    if (!this.droneActive) {
      if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !e.repeat) {
        this.handleCrouchAction();
      }
      if ((e.code === 'KeyX' || e.code === 'AltLeft') && !e.repeat) {
        this.handleProneAction(true);
      }
      if (e.code === 'KeyV') {
        this.adsToggle = !this.adsToggle;
      }
      if (e.code === 'Digit1') this.switchLoadoutSlot(0);
      if (e.code === 'Digit2') this.switchLoadoutSlot(1);
      if (e.code === 'Digit3') this.switchLoadoutSlot(2);
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'KeyG' && !e.repeat) this.throwGrenade('frag');
      if (e.code === 'KeyE' && !e.repeat) this.throwGrenade('smoke');
    }
    if (e.code === 'KeyI' && !e.repeat) this.toggleStatusPanel();
    if (e.code === 'Tab' && !e.repeat) {
      e.preventDefault();
      this.toggleCommandPanel();
    }
    if (e.code === 'KeyT') this.cycleTacticalOrder();
    if (e.code === 'KeyF') this.issueTacticalOrder(this.selectedOrder);
    if (e.code === 'F1') {
      e.preventDefault();
      this.issueTacticalOrder('assault');
    }
    if (e.code === 'F2') {
      e.preventDefault();
      this.issueTacticalOrder('eliminate');
    }
    if (e.code === 'F3') {
      e.preventDefault();
      this.issueTacticalOrder('cover');
    }
    if (e.code === 'F4') {
      e.preventDefault();
      this.issueTacticalOrder('move');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || !this.pointerLocked || this.playerHp <= 0) return;
    if (this.droneActive) {
      const droneSens = this.mouseSensitivity * 0.85;
      this.droneYaw -= e.movementX * droneSens;
      this.dronePitch -= e.movementY * droneSens;
      this.dronePitch = THREE.MathUtils.clamp(this.dronePitch, -1.28, 0.28);
      return;
    }
    const spec = WEAPON_SPECS[this.currentWeaponId];
    let adsZoomScale = 1.0;
    if (this.adsAlpha > 0.5) {
      if (isSniperWeapon(this.currentWeaponId)) {
        const activeFov = spec.zoomFovs?.[this.sniperZoomIdx] ?? spec.adsFov;
        adsZoomScale = THREE.MathUtils.clamp((activeFov / 72) * 0.92, 0.08, 0.52);
      } else {
        adsZoomScale = 0.72;
      }
    }
    this.playerYaw -= e.movementX * this.mouseSensitivity * adsZoomScale;
    this.playerPitch -= e.movementY * this.mouseSensitivity * adsZoomScale;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch, -1.42, 1.42);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    if (!this.pointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (this.droneActive) {
      if (e.button === 0) {
        this.markEnemiesWithDrone();
      } else if (e.button === 2) {
        this.recallReconDrone(false);
      }
      return;
    }
    if (e.button === 0) {
      this.mouseDownLeft = true;
    } else if (e.button === 2) {
      this.mouseDownRight = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDownLeft = false;
      this.semiShotLocked = false;
    } else if (e.button === 2) {
      this.mouseDownRight = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing') return;
    if (this.adsAlpha > 0.5 && isSniperWeapon(this.currentWeaponId)) {
      const nextZoom: 0 | 1 = e.deltaY < 0 ? 1 : 0;
      if (this.sniperZoomIdx !== nextZoom) {
        this.sniperZoomIdx = nextZoom;
        this.audio.playCommandChirp('ack');
        this.syncHud();
      }
      return;
    }
    const order = this.playerLoadout;
    if (order.length <= 1) return;
    const idx = Math.max(0, order.indexOf(this.currentWeaponId));
    const next = (idx + (e.deltaY > 0 ? 1 : -1) + order.length) % order.length;
    this.switchWeapon(order[next]);
  };

  private startReload() {
    if (this.isReloading || this.playerHp <= 0) return;
    const inv = this.weaponInventory[this.currentWeaponId];
    const spec = WEAPON_SPECS[this.currentWeaponId];
    if (inv.mag >= spec.magSize || inv.reserve <= 0) return;
    this.isReloading = true;
    this.reloadTimer = spec.reloadTime;
    this.adsToggle = false;
    this.audio.playReload();
  }

  private throwGrenade(kind: 'frag' | 'smoke' = 'frag') {
    if (this.playerHp <= 0) return;
    if (kind === 'frag' && this.grenades <= 0) return;
    if (kind === 'smoke' && this.smokeGrenades <= 0) return;

    const slot = this.grenadePool.find((g) => !g.active);
    if (!slot) return;
    if (kind === 'smoke') this.smokeGrenades--;
    else this.grenades--;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    slot.active = true;
    slot.kind = kind;
    slot.pos.copy(this.camera.position).addScaledVector(dir, 0.65);
    slot.pos.y -= 0.12;
    slot.vel.copy(dir).multiplyScalar(kind === 'smoke' ? 18.5 : 17.5).add(this.playerVel);
    slot.vel.y += 4.2;
    slot.fuse = kind === 'smoke' ? 1.15 : 2.25;
    slot.fromPlayer = true;
    slot.faction = this.playerFaction;
    slot.shooterKey = null;
    slot.shooterName = 'Vous';
    slot.mesh.position.copy(slot.pos);
    slot.smokeMesh.position.copy(slot.pos);
    slot.mesh.visible = kind === 'frag';
    slot.smokeMesh.visible = kind === 'smoke';
    if (this.lanRoomCode) {
      this.lan.sendGrenade(
        { x: slot.pos.x, y: slot.pos.y, z: slot.pos.z },
        { x: slot.vel.x, y: slot.vel.y, z: slot.vel.z },
        kind
      );
    }
  }

  private deploySmokeScreen(center: THREE.Vector3, fromPlayer: boolean, faction: Faction) {
    const gy = supportHeightAt(center.x, center.y, center.z, this.world.boxColliders);
    const smokeY = Math.max(WATER_LEVEL + 0.05, gy);
    if (this.activeSmokes.length >= 4) {
      this.activeSmokes.shift();
    }
    const radius = 8.2;
    const maxDuration = 15.0;
    this.activeSmokes.push({
      id: this.nextSmokeId++,
      x: center.x,
      y: smokeY,
      z: center.z,
      radius,
      remaining: maxDuration,
      maxDuration,
    });

    this.envParticles.spawnSmokeBurst(center.x, smokeY, center.z, radius);
    const distToPlayer = center.distanceTo(this.playerPos);
    this.audio.playSmokeDeploy(distToPlayer);

    if (fromPlayer) {
      this.dualShock.rumble(0.14, 0.22, 100);
      this.awardRankXp(10);
      this.pushRadioBanner('FUMIGÈNE TACTIQUE DÉPLOYÉ — COUVERTURE ACTIVE');
    }

    // Nearby friendly squadmate announces tactical smoke cover in Lingala / Swahili
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (s.alive && s.faction === faction && s.position.distanceTo(center) < 34) {
        this.emitSoldierComms(s.name, s.faction, s.position, 'smoke', true, s.voiceProfile);
        break;
      }
    }
  }

  private isPlayerInSmokeCover(): boolean {
    for (let i = 0; i < this.activeSmokes.length; i++) {
      const sm = this.activeSmokes[i];
      const dx = this.playerPos.x - sm.x;
      const dz = this.playerPos.z - sm.z;
      if (dx * dx + dz * dz <= sm.radius * sm.radius) {
        return true;
      }
    }
    return false;
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: string,
    startScale: number,
    endScale: number,
    maxAge: number,
    gravity = 4
  ) {
    const p = this.particles.find((pt) => !pt.active);
    if (!p) return;
    p.active = true;
    p.pos.set(x, y, z);
    p.vel.set(vx, vy, vz);
    p.age = 0;
    p.maxAge = maxAge;
    p.startScale = startScale;
    p.endScale = endScale;
    p.gravity = gravity;
    (p.sprite.material as THREE.SpriteMaterial).color.set(colorHex);
    (p.sprite.material as THREE.SpriteMaterial).opacity = 0.85;
    p.sprite.position.copy(p.pos);
    p.sprite.scale.setScalar(startScale);
    p.sprite.visible = true;
  }

  private spawnImpactBurst(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    kind: 'terrain' | 'water' | 'wood' | 'rock' | 'metal' | 'sandbag' | 'blood'
  ) {
    if (kind === 'water') {
      this.envParticles.spawnWaterSplash(point.x, point.y, point.z, 1.25);
    } else if (kind === 'terrain' || kind === 'sandbag') {
      this.envParticles.spawnGroundDust(
        point.x,
        point.y,
        point.z,
        normal.x * 1.4,
        0.55,
        normal.z * 1.4,
        4,
        0.52,
        '#8c623d'
      );
    } else if (kind === 'wood' && point.y > groundHeightAt(point.x, point.z) + 1.4) {
      this.envParticles.spawnLeafBurst(point, 5);
    }

    const count = kind === 'water' ? 6 : kind === 'blood' ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const speed = kind === 'water' ? 3.5 + Math.random() * 3.5 : 2.2 + Math.random() * 3.2;
      const vx = normal.x * speed + (Math.random() - 0.5) * 3.2;
      const vy = Math.max(0.8, normal.y * speed) + Math.random() * 2.5;
      const vz = normal.z * speed + (Math.random() - 0.5) * 3.2;
      const color =
        kind === 'water'
          ? '#d8ede6'
          : kind === 'blood'
          ? '#8b1d1d'
          : kind === 'metal' || kind === 'rock'
          ? '#ffd166'
          : kind === 'wood'
          ? '#a87d4f'
          : '#7d4d35';
      this.spawnParticle(
        point.x,
        point.y,
        point.z,
        vx,
        vy,
        vz,
        color,
        kind === 'metal' ? 0.14 : 0.25,
        kind === 'water' ? 0.9 : 0.75,
        kind === 'metal' ? 0.22 : 0.45,
        kind === 'water' ? 8 : 6
      );
    }
  }

  private spawnBullet(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    weaponId: WeaponId,
    faction: Faction,
    fromPlayer: boolean,
    shooterKey: string | null = null,
    shooterName?: string
  ) {
    const b = this.bullets.find((item) => !item.active);
    if (!b) return;
    const spec = WEAPON_SPECS[weaponId];
    const modeSpec = getCombatModeSpec(this.combatMode);
    b.active = true;
    b.pos.copy(origin);
    b.prevPos.copy(origin);
    b.shooterOrigin.copy(origin);
    b.whizTriggered = false;
    b.vel.copy(dir).multiplyScalar(spec.muzzleVelocity);
    b.age = 0;
    b.maxAge = 2.0;
    b.damage = (fromPlayer ? spec.damage : spec.damage * 0.42) * modeSpec.damageMultiplier;
    b.headshotMult = spec.headshotMult;
    b.airDrag = spec.airDrag;
    b.penetration = spec.penetration;
    b.faction = faction;
    b.fromPlayer = fromPlayer;
    b.weaponId = weaponId;
    b.shooterKey = shooterKey;
    b.shooterName =
      shooterName || (faction === 'army' ? 'Soldat Armée' : 'Combattant Rebelle');
    b.ignoreIds.clear();
    b.mesh.position.copy(origin);
    b.mesh.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
    b.mesh.visible = true;
  }

  private triggerExplosion(
    center: THREE.Vector3,
    radius: number,
    maxDamage: number,
    fromPlayer: boolean,
    faction: Faction,
    shooterKey: string | null = null,
    shooterName = 'Explosion'
  ) {
    const distToPlayer = center.distanceTo(this.playerPos);
    this.audio.playExplosion(distToPlayer);
    const shakeAmt = Math.max(0, 1 - distToPlayer / 32);
    this.cameraShake = Math.max(this.cameraShake, shakeAmt * 0.45);
    if (shakeAmt > 0.1) {
      this.dualShock.rumble(shakeAmt * 0.5, shakeAmt * 0.95, 320);
    }

    // Shockwave dust cloud, flying jungle leaves & river water plume
    this.envParticles.spawnGroundDust(center.x, center.y, center.z, 0, 1.4, 0, 14, 1.15, '#7c5638');
    this.envParticles.spawnLeafBurst(center, 18);
    if (center.y <= WATER_LEVEL + 1.4 && groundHeightAt(center.x, center.z) < WATER_LEVEL - 0.1) {
      this.envParticles.spawnWaterSplash(center.x, WATER_LEVEL + 0.06, center.z, 2.3);
    }

    // Explosion fireball + smoke plumes
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 8.5;
      const isFire = i < 9;
      this.spawnParticle(
        center.x,
        center.y + 0.3,
        center.z,
        Math.cos(ang) * spd,
        3.5 + Math.random() * 7.5,
        Math.sin(ang) * spd,
        isFire ? '#ff9233' : '#3a3a37',
        isFire ? 0.9 : 1.1,
        isFire ? 2.6 : 4.2,
        isFire ? 0.45 : 1.35,
        isFire ? 1.5 : -1.2
      );
    }

    // Damage soldiers in blast radius (diving/prone reduces shrapnel exposure!)
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = s.position.distanceTo(center);
      if (d < radius) {
        const proneMult = s.diveTimer > 0 || s.proneTimer > 0 ? 0.52 : 1.0;
        const dmg = maxDamage * (1 - d / radius) * proneMult;
        this.damageSoldier(s, dmg, false, fromPlayer ? (this.playerFaction === 'army' ? 'Soldat (Vous)' : 'Maquisard (Vous)') : 'Explosion', faction, 'Grenade / Baril');
      }
    }

    // Damage remote enemy humans when explosion was triggered by local player
    if (fromPlayer && this.lanRoomCode) {
      for (const rp of this.remotePlayers.values()) {
        if (!rp.alive || rp.faction === this.playerFaction) continue;
        const rd = rp.pos.distanceTo(center);
        if (rd < radius) {
          const proneMult = rp.isProne || rp.isDiving ? 0.52 : 1.0;
          const dmg = maxDamage * (1 - rd / radius) * proneMult;
          this.lan.sendHit(rp.id, dmg, false, 'Explosion');
        }
      }
    }

    // Damage player in blast radius (prone/diving cuts shrapnel damage)
    if (this.playerHp > 0 && distToPlayer < radius) {
      const playerProneMult = this.playerStance === 'prone' || this.playerDiveTimer > 0 ? 0.52 : 1.0;
      const dmg = maxDamage * 0.58 * (1 - distToPlayer / radius) * playerProneMult;
      this.damagePlayer(
        dmg,
        center,
        shooterName,
        faction,
        'Grenade / Baril',
        false,
        shooterKey,
        'bazooka',
        false
      );
      // Blast impulse knockback
      _tmpVec.subVectors(this.playerPos, center).normalize();
      this.playerVel.addScaledVector(_tmpVec, 7.5 * (1 - distToPlayer / radius));
      this.playerVel.y += 4.5 * (1 - distToPlayer / radius);
    }

    // Chain-detonate nearby explosive barrels
    for (const bar of this.world.barrels) {
      if (!bar.exploded && bar.position.distanceTo(center) < radius * 0.75) {
        bar.hp = 0;
        bar.exploded = true;
        bar.mesh.visible = false;
        bar.collider.maxY = bar.collider.minY;
        this.triggerExplosion(bar.position.clone(), 8.5, 115, fromPlayer, faction, shooterKey, shooterName);
      }
    }
  }

  private damageSoldier(
    s: SoldierEntity,
    dmg: number,
    isHeadshot: boolean,
    killerName: string,
    killerFaction: Faction,
    weaponLabel: string
  ) {
    if (!s.alive) return;
    s.hp -= dmg;
    s.flinchTimer = 0.18;

    if (s.hp <= 0) {
      s.alive = false;
      s.hp = 0;
      s.deathTimer = 0;
      s.fallAxis.set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2).normalize();
      if (s.fallAxis.lengthSq() < 0.1) s.fallAxis.set(1, 0, 0);

      if (s.faction === 'army') {
        this.armyTickets = Math.max(0, this.armyTickets - 1);
        this.rebelScore++;
        this.respawnQueueArmy++;
      } else {
        this.rebelTickets = Math.max(0, this.rebelTickets - 1);
        this.armyScore++;
        this.respawnQueueRebel++;
      }
      this.recentCombatIntensity = Math.min(1, this.recentCombatIntensity + 0.35);

      if (killerName.includes('(Vous)')) {
        this.playerKills++;
        this.awardRankXp(isHeadshot ? 65 : 40);
      }
      this.addKillFeed(killerName, killerFaction, s.name, s.faction, weaponLabel, isHeadshot);

      // Nearby squadmate reacts in Lingala or Swahili
      for (const ally of this.soldiers) {
        if (ally !== s && ally.alive && ally.faction === s.faction && ally.position.distanceTo(s.position) < 26) {
          this.emitSoldierComms(ally.name, ally.faction, ally.position, 'allyDown', false);
          break;
        }
      }
    } else if (Math.random() < 0.34) {
      if (triggerSoldierDive(s, this.playerPos)) {
        this.audio.playDiveThud(s.position.distanceTo(this.camera.position));
        this.emitSoldierComms(s.name, s.faction, s.position, 'dive', false);
      }
    }
  }

  private pushShotIndicator(
    sourcePos: THREE.Vector3,
    isHit: boolean,
    shooterKey: string | null = null
  ) {
    if (this.phase !== 'playing' || this.playerHp <= 0) return;
    const dx = sourcePos.x - this.playerPos.x;
    const dz = sourcePos.z - this.playerPos.z;
    if (dx * dx + dz * dz < 0.04) return;

    const newAngle = Math.atan2(dx, -dz);
    const boostIntensity = isHit ? 1.0 : 0.82;

    let match = shooterKey
      ? this.shotIndicators.find((ind) => ind.key === shooterKey)
      : undefined;

    if (!match) {
      for (let i = 0; i < this.shotIndicators.length; i++) {
        const ind = this.shotIndicators[i];
        const idx = ind.sourcePos.x - this.playerPos.x;
        const idz = ind.sourcePos.z - this.playerPos.z;
        const existingAngle = Math.atan2(idx, -idz);
        let diff = Math.abs(newAngle - existingAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.34 || ind.sourcePos.distanceToSquared(sourcePos) < 12) {
          match = ind;
          break;
        }
      }
    }

    if (match) {
      match.sourcePos.copy(sourcePos);
      if (shooterKey) match.key = shooterKey;
      match.intensity = Math.max(match.intensity, boostIntensity);
      match.isHit = match.isHit || isHit;
      return;
    }

    if (this.shotIndicators.length >= 6) {
      let lowestIdx = 0;
      for (let i = 1; i < this.shotIndicators.length; i++) {
        if (this.shotIndicators[i].intensity < this.shotIndicators[lowestIdx].intensity) {
          lowestIdx = i;
        }
      }
      this.shotIndicators.splice(lowestIdx, 1);
    }

    this.shotIndicators.push({
      id: this.nextShotIndicatorId++,
      key: shooterKey,
      sourcePos: sourcePos.clone(),
      intensity: boostIntensity,
      isHit,
    });
  }

  private damagePlayer(
    dmg: number,
    sourcePos: THREE.Vector3,
    killerName: string,
    killerFaction: Faction,
    weaponLabel: string,
    fromLanServer = false,
    killerKey: string | null = null,
    weaponId: WeaponId = 'ak47',
    isHeadshot = false
  ) {
    if (this.playerHp <= 0 || this.phase !== 'playing') return;
    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.timeSinceDamage = 0;
    this.damageFlash = 0.68;
    this.damageSourceWorld = sourcePos.clone();
    this.pushShotIndicator(sourcePos, true, killerKey);
    this.woundRoll = (Math.random() < 0.5 ? 1 : -1) * 0.16;
    this.recoilPitch -= 0.045;
    this.cameraShake = Math.max(this.cameraShake, 0.2);
    this.recentCombatIntensity = Math.min(1, this.recentCombatIntensity + 0.4);
    this.audio.playWoundGrunt();
    this.dualShock.rumble(0.45, 0.65, 140);
    if (this.droneActive) {
      this.recallReconDrone(false);
    }

    if (this.playerHp <= 0) {
      this.playerDeaths++;
      this.playerRespawnTimer = Math.max(
        KILLCAM_DURATION + 0.38,
        getCombatModeSpec(this.combatMode).respawnDelay
      );
      this.adsToggle = false;
      this.mouseDownRight = false;
      this.weaponAnchor.visible = false;

      // Prepare 3-second Killcam replay from enemy perspective
      const killerZone = findZoneAt(sourcePos.x, sourcePos.z)?.name || 'Vallée du Kivu';
      const distMeters = Math.max(1, Math.round(sourcePos.distanceTo(this.playerPos)));
      this.pendingKillcamMeta = {
        killerKey,
        killerName,
        killerFaction,
        weaponLabel,
        weaponId,
        fallbackSourcePos: sourcePos.clone(),
        isHeadshot,
        deathTime: this.elapsed,
        victimFaction: this.playerFaction,
        victimRankLevel: this.playerRankLevel,
      };
      this.killcamDelayTimer = 0.35;
      this.killcamHudInfo = {
        active: false,
        killerName,
        killerFaction,
        weaponLabel,
        killerZoneName: killerZone,
        distanceMeters: distMeters,
        remainingSec: KILLCAM_DURATION,
        totalSec: KILLCAM_DURATION,
        isHeadshot,
      };

      if (!fromLanServer) {
        if (this.playerFaction === 'army') {
          this.armyTickets = Math.max(0, this.armyTickets - 1);
          this.rebelScore++;
        } else {
          this.rebelTickets = Math.max(0, this.rebelTickets - 1);
          this.armyScore++;
        }
        this.addKillFeed(killerName, killerFaction, 'Vous', this.playerFaction, weaponLabel, isHeadshot);
      }
    }
  }

  private firePlayerWeapon() {
    if (this.isReloading || this.fireCooldown > 0 || this.playerHp <= 0) return;
    const spec = WEAPON_SPECS[this.currentWeaponId];
    const inv = this.weaponInventory[this.currentWeaponId];
    if (inv.mag <= 0) {
      this.startReload();
      return;
    }

    inv.mag--;
    this.fireCooldown = 60 / spec.rpm;
    if (spec.fireMode === 'SEMI') this.semiShotLocked = true;

    const vm = this.getViewmodel(this.currentWeaponId);
    vm.muzzleFlash.visible = true;
    vm.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleFlashTimer = 0.045;
    this.recoilKickZ = isFlameWeapon(this.currentWeaponId) ? 0.024 : 0.065;

    const isRocket = isRocketWeapon(this.currentWeaponId);
    const isFlame = isFlameWeapon(this.currentWeaponId);
    const isSniper = isSniperWeapon(this.currentWeaponId);

    // Eject brass shell casing (skip for rockets & flamethrowers)
    if (!isRocket && !isFlame) {
      const casing = this.casings.find((c) => !c.active);
      if (casing) {
        casing.active = true;
        casing.age = 0;
        _tmpVec.set(0.06, 0.02, -0.05).applyMatrix4(vm.root.matrixWorld);
        casing.pos.copy(_tmpVec);
        _right.set(1, 0.6, 0.2).applyQuaternion(this.camera.quaternion).normalize();
        casing.vel.copy(_right).multiplyScalar(2.4 + Math.random() * 0.9);
        casing.mesh.position.copy(casing.pos);
        casing.mesh.visible = true;
      }
    } else if (vm.warheadMesh && inv.mag <= 0) {
      vm.warheadMesh.visible = false;
    }

    // Zero-parallax camera convergence aiming & stance-stabilized ballistic precision
    const isMoving = Math.hypot(this.playerVel.x, this.playerVel.z) > 0.6;
    const stanceSpreadMult =
      this.playerStance === 'prone' ? 0.44 : this.playerStance === 'crouch' ? 0.68 : 1.0;
    const adsPrecisionMode = this.adsAlpha > 0.65;
    const movePenaltyScale = 1 - this.adsAlpha * (isSniper ? 0.96 : 0.92);
    const bloomMult = adsPrecisionMode ? (isSniper ? 0.14 : 0.35) : 1.0;
    const spread =
      (THREE.MathUtils.lerp(spec.baseSpread, spec.adsSpread, this.adsAlpha) +
        (isMoving ? spec.moveSpreadPenalty * movePenaltyScale : 0) +
        this.spreadBloom * bloomMult) *
      stanceSpreadMult;

    _fireDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    let convergeDist = isFlame ? 18 : 240;
    const camRayEnd = _tmpVec.copy(this.camera.position).addScaledVector(_fireDir, convergeDist);
    const camEnvHit = intersectSegmentEnvironment(
      this.camera.position,
      camRayEnd,
      this.world.boxColliders,
      this.world.cylinderColliders
    );
    if (camEnvHit) {
      convergeDist = Math.max(2.0, camEnvHit.point.distanceTo(this.camera.position));
    }
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive || s.faction === this.playerFaction) continue;
      const aimOffset = s.stance === 'prone' ? 0.34 : s.stance === 'crouch' ? 0.85 : 1.28;
      _tmpVec2.set(s.position.x, s.position.y + aimOffset, s.position.z);
      const d = _tmpVec2.distanceTo(this.camera.position);
      if (d < convergeDist && this.pointToSegmentDist(_tmpVec2, this.camera.position, camRayEnd) < 0.56) {
        convergeDist = Math.max(1.5, d);
      }
    }

    _aimTarget.copy(this.camera.position).addScaledVector(_fireDir, convergeDist);
    if (adsPrecisionMode && !isRocket && !isFlame) {
      // Exact optical-axis spawn in ADS so reticle dot matches point of impact at every distance
      _muzzleWorld.copy(this.camera.position).addScaledVector(_fireDir, 0.55);
      _fireDir.subVectors(_aimTarget, _muzzleWorld).normalize();
    } else {
      vm.muzzleAnchor.getWorldPosition(_muzzleWorld);
      _fireDir.subVectors(_aimTarget, _muzzleWorld).normalize();
    }

    const horizSpread = adsPrecisionMode && isSniper ? spread * 0.2 : spread;
    _fireDir.x += (Math.random() - 0.5) * horizSpread;
    _fireDir.y += (Math.random() - 0.5) * spread * (adsPrecisionMode && isSniper ? 0.45 : 1.0);
    _fireDir.z += (Math.random() - 0.5) * horizSpread;
    _fireDir.normalize();

    if (this.aimingAtAlly) {
      this.friendlyFireWarnTimer = Math.max(this.friendlyFireWarnTimer, 0.85);
      if (this.friendlyFireAudioCooldown <= 0) {
        this.audio.playFriendlyFireWarn();
        this.friendlyFireAudioCooldown = 0.75;
      }
    }

    if (isRocket) {
      this.spawnRocket(
        _muzzleWorld,
        _fireDir,
        this.playerFaction,
        true,
        'player',
        'Vous',
        this.currentWeaponId
      );
      this.audio.playGunshot(this.currentWeaponId, 0);
    } else if (isFlame) {
      this.spawnFlameJet(
        _muzzleWorld,
        _fireDir,
        this.currentWeaponId,
        this.playerFaction,
        true,
        'player',
        'Vous'
      );
      if (this.flameAudioCooldown <= 0) {
        this.audio.playFlamethrowerBurst(0);
        this.flameAudioCooldown = 0.14;
      }
    } else {
      this.spawnBullet(_muzzleWorld, _fireDir, this.currentWeaponId, this.playerFaction, true, 'player', 'Vous');
      this.audio.playGunshot(this.currentWeaponId, 0);
    }

    if (this.lanRoomCode) {
      this.lan.sendShoot(
        { x: _muzzleWorld.x, y: _muzzleWorld.y, z: _muzzleWorld.z },
        { x: _fireDir.x, y: _fireDir.y, z: _fireDir.z },
        this.currentWeaponId
      );
    }
    this.dualShock.rumble(
      isRocket ? 0.72 : isSniper ? 0.55 : isFlame ? 0.18 : 0.25,
      isRocket ? 0.95 : isSniper ? 0.8 : isFlame ? 0.28 : 0.35,
      isRocket ? 190 : isSniper ? 130 : isFlame ? 50 : 65
    );

    // Apply stance-stabilized physical recoil
    const stanceRecMult =
      this.playerStance === 'prone' ? 0.58 : this.playerStance === 'crouch' ? 0.72 : 1.0;
    const adsRecMult = adsPrecisionMode ? 0.74 : 1.0;
    this.recoilPitch += spec.recoilPitch * stanceRecMult * adsRecMult;
    this.recoilYaw += (Math.random() - 0.5) * spec.recoilYaw * stanceRecMult * adsRecMult;
    this.spreadBloom = Math.min(0.03, this.spreadBloom + (adsPrecisionMode ? 0.0028 : 0.0055));
    this.cameraShake = Math.max(
      this.cameraShake,
      (isRocket ? 0.22 : isSniper ? 0.11 : isFlame ? 0.025 : 0.036) * (adsPrecisionMode ? 0.45 : 1.0)
    );
  }

  private ignitePlayer(
    duration: number,
    killerName: string,
    killerFaction: Faction,
    weaponLabel: string,
    weaponId: WeaponId,
    sourcePos: THREE.Vector3,
    killerKey: string | null = null
  ) {
    if (this.playerHp <= 0 || this.phase !== 'playing' || this.playerGroundState.inWater) return;
    this.playerBurnTimer = Math.max(this.playerBurnTimer, duration);
    this.playerBurnMeta = {
      killerName,
      killerFaction,
      weaponLabel,
      weaponId,
      sourcePos: sourcePos.clone(),
      killerKey,
    };
  }

  private spawnFlameJet(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    weaponId: WeaponId,
    faction: Faction,
    fromPlayer: boolean,
    shooterKey: string | null = null,
    shooterName = 'Lance-Flamme'
  ) {
    const spec = WEAPON_SPECS[weaponId];
    const modeSpec = getCombatModeSpec(this.combatMode);
    const speed = spec.muzzleVelocity;
    const count = 2;

    this.flameLight.position.copy(origin).addScaledVector(dir, 2.2);
    this.flameLightIntensity = Math.max(this.flameLightIntensity, 4.8);

    for (let k = 0; k < count; k++) {
      const fp = this.flameParticles.find((item) => !item.active);
      if (!fp) break;
      fp.active = true;
      fp.pos.copy(origin).addScaledVector(dir, 0.2 + k * 0.25);
      fp.prevPos.copy(origin);
      const jx = (Math.random() - 0.5) * 0.14;
      const jy = (Math.random() - 0.5) * 0.11;
      const jz = (Math.random() - 0.5) * 0.14;
      fp.vel
        .set(dir.x + jx, dir.y + jy, dir.z + jz)
        .normalize()
        .multiplyScalar(speed * (0.9 + Math.random() * 0.22));
      fp.age = 0;
      fp.maxAge = weaponId === 'lpo50' ? 0.72 : 0.6;
      fp.startScale = 0.34;
      fp.endScale = weaponId === 'lpo50' ? 2.35 : 2.05;
      fp.damage = (fromPlayer ? spec.damage : spec.damage * 0.45) * modeSpec.damageMultiplier;
      fp.fromPlayer = fromPlayer;
      fp.faction = faction;
      fp.shooterKey = shooterKey;
      fp.shooterName =
        shooterName || (faction === 'army' ? 'Sapeur Armée' : 'Pyromane Rebelle');
      fp.weaponId = weaponId;
      fp.weaponLabel = spec.shortName;
      fp.hitSoldiers.clear();
      fp.hitRemotes.clear();
      fp.hitPlayer = false;
      (fp.sprite.material as THREE.SpriteMaterial).color.set('#fef08a');
      (fp.sprite.material as THREE.SpriteMaterial).opacity = 0.92;
      fp.sprite.position.copy(fp.pos);
      fp.sprite.scale.setScalar(fp.startScale);
      fp.sprite.visible = true;
    }
  }

  private updateFlameJets(dt: number) {
    if (this.flameLightIntensity > 0) {
      this.flameLightIntensity = Math.max(0, this.flameLightIntensity - dt * 16);
      this.flameLight.intensity = this.flameLightIntensity;
    }

    for (let i = 0; i < this.flameParticles.length; i++) {
      const fp = this.flameParticles[i];
      if (!fp.active) continue;

      fp.age += dt;
      if (fp.age >= fp.maxAge) {
        fp.active = false;
        fp.sprite.visible = false;
        continue;
      }

      fp.prevPos.copy(fp.pos);
      // Aerodynamic drag + upward thermal buoyancy so fire curls naturally
      fp.vel.multiplyScalar(Math.exp(-2.8 * dt));
      fp.vel.y += 2.8 * dt;
      fp.pos.addScaledVector(fp.vel, dt);

      const t = fp.age / fp.maxAge;
      const sc = THREE.MathUtils.lerp(fp.startScale, fp.endScale, Math.pow(t, 0.72));
      const mat = fp.sprite.material as THREE.SpriteMaterial;
      if (t < 0.25) {
        mat.color.set('#fef08a');
      } else if (t < 0.62) {
        mat.color.set('#f97316');
      } else {
        mat.color.set('#b91c1c');
      }
      mat.opacity = Math.max(0, (1 - t) * 0.92);
      fp.sprite.position.copy(fp.pos);
      fp.sprite.scale.setScalar(sc);

      // Stop against solid cover & water
      const gh = groundHeightAt(fp.pos.x, fp.pos.z);
      if (fp.pos.y <= WATER_LEVEL + 0.05 && gh < WATER_LEVEL - 0.1) {
        fp.active = false;
        fp.sprite.visible = false;
        continue;
      }
      if (fp.pos.y <= gh + 0.12) {
        fp.pos.y = gh + 0.12;
        fp.vel.y = Math.max(0.8, Math.abs(fp.vel.y) * 0.35);
      }

      const envHit = intersectSegmentEnvironment(
        fp.prevPos,
        fp.pos,
        this.world.boxColliders,
        this.world.cylinderColliders
      );
      if (envHit) {
        fp.pos.copy(envHit.point).addScaledVector(envHit.normal, 0.15);
        fp.vel.multiplyScalar(0.25);
        fp.vel.y += 1.8;
      }

      const hitRadius = 0.65 + t * 0.65;

      // Burn & damage enemy soldiers
      for (let j = 0; j < this.soldiers.length; j++) {
        const s = this.soldiers[j];
        if (!s.alive || s.faction === fp.faction || fp.hitSoldiers.has(s.id)) continue;
        _tmpVec.set(s.position.x, s.position.y + (s.stance === 'prone' ? 0.3 : 0.9), s.position.z);
        if (this.pointToSegmentDist(_tmpVec, fp.prevPos, fp.pos) <= hitRadius) {
          fp.hitSoldiers.add(s.id);
          const killerLabel = fp.fromPlayer
            ? this.playerFaction === 'army'
              ? 'Soldat (Vous)'
              : 'Maquisard (Vous)'
            : fp.shooterName;
          igniteSoldier(s, 3.8, killerLabel, fp.faction, fp.weaponLabel);
          this.damageSoldier(s, fp.damage, false, killerLabel, fp.faction, fp.weaponLabel);
          if (fp.fromPlayer) {
            this.hitMarkerTimer = 0.14;
            this.hitMarkerHeadshot = false;
            this.audio.playHitmarker(false);
          }
        }
      }

      // Burn & damage remote LAN players
      if (fp.fromPlayer && this.lanRoomCode) {
        for (const rp of this.remotePlayers.values()) {
          if (!rp.alive || rp.faction === this.playerFaction || fp.hitRemotes.has(rp.id)) continue;
          _tmpVec.set(rp.pos.x, rp.pos.y + 0.9, rp.pos.z);
          if (this.pointToSegmentDist(_tmpVec, fp.prevPos, fp.pos) <= hitRadius) {
            fp.hitRemotes.add(rp.id);
            rp.burnTimer = Math.max(rp.burnTimer, 3.4);
            this.lan.sendHit(rp.id, fp.damage, false, fp.weaponLabel);
            this.hitMarkerTimer = 0.14;
            this.hitMarkerHeadshot = false;
            this.audio.playHitmarker(false);
          }
        }
      }

      // Burn & damage local player
      if (!fp.fromPlayer && !fp.hitPlayer && this.playerHp > 0 && this.phase === 'playing') {
        _tmpVec.set(this.playerPos.x, this.playerPos.y + this.playerEyeHeight * 0.65, this.playerPos.z);
        if (this.pointToSegmentDist(_tmpVec, fp.prevPos, fp.pos) <= hitRadius) {
          fp.hitPlayer = true;
          this.ignitePlayer(
            3.5,
            fp.shooterName,
            fp.faction,
            fp.weaponLabel,
            fp.weaponId,
            fp.prevPos,
            fp.shooterKey
          );
          this.damagePlayer(
            fp.damage,
            fp.prevPos,
            fp.shooterName,
            fp.faction,
            fp.weaponLabel,
            false,
            fp.shooterKey,
            fp.weaponId,
            false
          );
        }
      }

      // Ignite / detonate barrels fast
      for (const bar of this.world.barrels) {
        if (bar.exploded) continue;
        if (this.pointToSegmentDist(bar.position, fp.prevPos, fp.pos) <= hitRadius) {
          bar.hp -= fp.damage * 1.6;
          if (bar.hp <= 0) {
            bar.exploded = true;
            bar.mesh.visible = false;
            bar.collider.maxY = bar.collider.minY;
            this.triggerExplosion(
              bar.position.clone(),
              9.0,
              120,
              fp.fromPlayer,
              fp.faction,
              fp.shooterKey,
              fp.shooterName
            );
          }
        }
      }
    }
  }

  private spawnRocket(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    faction: Faction,
    fromPlayer: boolean,
    shooterKey: string | null = null,
    shooterName = 'Lance-Roquettes',
    weaponId: WeaponId = 'bazooka'
  ) {
    const r = this.rockets.find((item) => !item.active);
    if (!r) return;
    const speed = WEAPON_SPECS[weaponId]?.muzzleVelocity ?? WEAPON_SPECS.bazooka.muzzleVelocity;
    r.active = true;
    r.pos.copy(origin);
    r.prevPos.copy(origin);
    r.vel.copy(dir).multiplyScalar(speed);
    r.age = 0;
    r.maxAge = 3.6;
    r.trailTimer = 0;
    r.faction = faction;
    r.fromPlayer = fromPlayer;
    r.shooterKey = shooterKey;
    r.shooterName = shooterName;
    r.mesh.position.copy(origin);
    r.mesh.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
    r.mesh.visible = true;

    // Backblast smoke puff
    for (let i = 0; i < 6; i++) {
      this.spawnParticle(
        origin.x,
        origin.y,
        origin.z,
        (Math.random() - 0.5) * 3.5,
        0.5 + Math.random() * 2.2,
        (Math.random() - 0.5) * 3.5,
        i < 2 ? '#ffaa44' : '#cbd5e1',
        0.35,
        1.4,
        0.45,
        -0.8
      );
    }
  }

  private updateBullets(dt: number) {
    const wind = this.weather.windVector;
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;

      b.age += dt;
      if (b.age >= b.maxAge) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }

      b.prevPos.copy(b.pos);

      // Realistic gravity drop + crosswind drift (stabilized on heavy/precision rounds) + aerodynamic drag
      const windDriftFactor = isSniperWeapon(b.weaponId) ? 0.1 : 0.42;
      b.vel.y -= 9.81 * dt;
      b.vel.x += wind.x * windDriftFactor * dt;
      b.vel.z += wind.z * windDriftFactor * dt;
      const spd = b.vel.length();
      b.vel.multiplyScalar(Math.exp(-b.airDrag * spd * dt));
      b.pos.addScaledVector(b.vel, dt);

      // Update tracer mesh orientation
      b.mesh.position.copy(b.pos);
      b.mesh.lookAt(b.pos.x + b.vel.x, b.pos.y + b.vel.y, b.pos.z + b.vel.z);

      // Bullet whiz flyby sound & incoming-fire directional arrow near player
      if (!b.fromPlayer && b.faction !== this.playerFaction && this.playerHp > 0 && this.phase === 'playing') {
        const dSegPlayer = this.pointToSegmentDist(this.camera.position, b.prevPos, b.pos);
        if (!b.whizTriggered && dSegPlayer < 4.5) {
          b.whizTriggered = true;
          this.pushShotIndicator(b.shooterOrigin, false, b.shooterKey);
          if (dSegPlayer < 2.8) {
            this.audio.playBulletWhiz();
          }
        }
      }

      // 1. Check soldier hits along [prevPos, pos]
      let hitUnit = false;
      for (let j = 0; j < this.soldiers.length; j++) {
        const s = this.soldiers[j];
        if (!s.alive || s.faction === b.faction) continue;

        const isProne = s.stance === 'prone' || s.diveTimer > 0 || s.proneTimer > 0;
        const headY = s.position.y + (isProne ? 0.36 : s.isCrouching ? 1.1 : 1.56);
        _tmpVec.set(s.position.x, headY, s.position.z);
        const headDist = this.pointToSegmentDist(_tmpVec, b.prevPos, b.pos);
        const bodyCenterY = s.position.y + (isProne ? 0.24 : s.isCrouching ? 0.62 : 0.92);
        _tmpVec2.set(s.position.x, bodyCenterY, s.position.z);
        const bodyDist = this.pointToSegmentDist(_tmpVec2, b.prevPos, b.pos);

        const headRadius = isProne ? 0.22 : 0.28;
        const bodyRadius = isProne ? 0.34 : 0.42;

        if (headDist < headRadius || bodyDist < bodyRadius) {
          const isHead = headDist < headRadius;
          const finalDmg = b.damage * (isHead ? b.headshotMult : 1.0);
          const killerLabel = b.fromPlayer
            ? this.playerFaction === 'army'
              ? 'Soldat (Vous)'
              : 'Maquisard (Vous)'
            : b.faction === 'army'
            ? 'Escouade Armée'
            : 'Tireur Rebelle';

          this.damageSoldier(
            s,
            finalDmg,
            isHead,
            killerLabel,
            b.faction,
            WEAPON_SPECS[b.weaponId].shortName
          );
          this.spawnImpactBurst(b.pos, new THREE.Vector3(0, 1, 0), 'blood');

          if (b.fromPlayer) {
            this.hitMarkerTimer = 0.16;
            this.hitMarkerHeadshot = isHead;
            this.audio.playHitmarker(isHead);
          }

          b.active = false;
          b.mesh.visible = false;
          hitUnit = true;
          break;
        } else if (!isProne && s.diveCooldown <= 0 && bodyDist < 1.55 && Math.random() < 0.1) {
          // Near-miss bullets can make soldiers dive to the ground for cover
          if (triggerSoldierDive(s, b.prevPos)) {
            this.audio.playDiveThud(s.position.distanceTo(this.camera.position));
            this.emitSoldierComms(s.name, s.faction, s.position, 'dive', false);
          }
        }
      }
      if (hitUnit) continue;

      // 1a. Detect player near-miss / friendly-fire risk on living allies
      if (b.fromPlayer && this.phase === 'playing') {
        let warned = false;
        for (let j = 0; j < this.soldiers.length; j++) {
          const s = this.soldiers[j];
          if (!s.alive || s.faction !== this.playerFaction) continue;
          const allyProne = s.stance === 'prone' || s.diveTimer > 0 || s.proneTimer > 0;
          _tmpVec.set(s.position.x, s.position.y + (allyProne ? 0.34 : s.isCrouching ? 0.75 : 1.05), s.position.z);
          if (this.pointToSegmentDist(_tmpVec, b.prevPos, b.pos) < 0.54) {
            warned = true;
            break;
          }
        }
        if (!warned) {
          for (const rp of this.remotePlayers.values()) {
            if (!rp.alive || rp.faction !== this.playerFaction) continue;
            const rpProne = rp.isProne || rp.isDiving;
            _tmpVec.set(rp.pos.x, rp.pos.y + (rpProne ? 0.34 : rp.isCrouching ? 0.75 : 1.05), rp.pos.z);
            if (this.pointToSegmentDist(_tmpVec, b.prevPos, b.pos) < 0.54) {
              warned = true;
              break;
            }
          }
        }
        if (warned) {
          this.friendlyFireWarnTimer = Math.max(this.friendlyFireWarnTimer, 0.85);
          if (this.friendlyFireAudioCooldown <= 0) {
            this.audio.playFriendlyFireWarn();
            this.friendlyFireAudioCooldown = 0.75;
          }
        }
      }

      // 1b. Check remote human players in LAN mode when fired by local player
      if (b.fromPlayer && this.lanRoomCode) {
        let hitRemote = false;
        for (const rp of this.remotePlayers.values()) {
          if (!rp.alive || rp.faction === this.playerFaction) continue;
          const rpProne = rp.isProne || rp.isDiving;
          const headY = rp.pos.y + (rpProne ? 0.36 : rp.isCrouching ? 1.1 : 1.56);
          _tmpVec.set(rp.pos.x, headY, rp.pos.z);
          const headDist = this.pointToSegmentDist(_tmpVec, b.prevPos, b.pos);
          const bodyY = rp.pos.y + (rpProne ? 0.24 : rp.isCrouching ? 0.62 : 0.92);
          _tmpVec2.set(rp.pos.x, bodyY, rp.pos.z);
          const bodyDist = this.pointToSegmentDist(_tmpVec2, b.prevPos, b.pos);
          if (headDist < (rpProne ? 0.22 : 0.28) || bodyDist < (rpProne ? 0.34 : 0.44)) {
            const isHead = headDist < (rpProne ? 0.22 : 0.28);
            const finalDmg = b.damage * (isHead ? b.headshotMult : 1.0);
            this.lan.sendHit(rp.id, finalDmg, isHead, WEAPON_SPECS[b.weaponId].shortName);
            this.spawnImpactBurst(b.pos, new THREE.Vector3(0, 1, 0), 'blood');
            this.hitMarkerTimer = 0.16;
            this.hitMarkerHeadshot = isHead;
            this.audio.playHitmarker(isHead);
            b.active = false;
            b.mesh.visible = false;
            hitRemote = true;
            break;
          }
        }
        if (hitRemote) continue;
      }

      // 2. Check enemy bullets hitting player
      if (!b.fromPlayer && this.playerHp > 0 && this.phase === 'playing') {
        _tmpVec.set(this.playerPos.x, this.playerPos.y + this.playerEyeHeight * 0.96, this.playerPos.z);
        const headDist = this.pointToSegmentDist(_tmpVec, b.prevPos, b.pos);
        _tmpVec2.set(this.playerPos.x, this.playerPos.y + this.playerEyeHeight * 0.58, this.playerPos.z);
        const bodyDist = this.pointToSegmentDist(_tmpVec2, b.prevPos, b.pos);
        if (headDist < 0.27 || bodyDist < 0.46) {
          const isHead = headDist < 0.27;
          this.damagePlayer(
            isHead ? b.damage * 1.45 : b.damage,
            b.shooterOrigin,
            b.shooterName,
            b.faction,
            WEAPON_SPECS[b.weaponId].shortName,
            false,
            b.shooterKey,
            b.weaponId,
            isHead
          );
          b.active = false;
          b.mesh.visible = false;
          continue;
        }
      }

      // 3. Check explosive barrels
      let hitBarrel = false;
      for (const bar of this.world.barrels) {
        if (bar.exploded) continue;
        if (this.pointToSegmentDist(bar.position, b.prevPos, b.pos) < 0.56) {
          bar.hp -= b.damage;
          this.spawnImpactBurst(b.pos, new THREE.Vector3(0, 1, 0), 'metal');
          if (bar.hp <= 0) {
            bar.exploded = true;
            bar.mesh.visible = false;
            bar.collider.maxY = bar.collider.minY;
            this.triggerExplosion(
              bar.position.clone(),
              9.0,
              120,
              b.fromPlayer,
              b.faction,
              b.shooterKey,
              b.shooterName
            );
          }
          b.active = false;
          b.mesh.visible = false;
          hitBarrel = true;
          break;
        }
      }
      if (hitBarrel) continue;

      // 4. Environment / cover collision
      const envHit = intersectSegmentEnvironment(
        b.prevPos,
        b.pos,
        this.world.boxColliders,
        this.world.cylinderColliders,
        b.ignoreIds
      );
      if (envHit) {
        this.spawnImpactBurst(envHit.point, envHit.normal, envHit.material);

        // Penetration through wood/water!
        if (envHit.material === 'water') {
          b.vel.multiplyScalar(0.68);
          b.damage *= 0.72;
          b.pos.copy(envHit.point).addScaledVector(b.vel.clone().normalize(), 0.25);
        } else if (envHit.penetrable && b.penetration > 0.35) {
          b.penetration -= 0.4;
          b.damage *= 0.65;
          b.vel.multiplyScalar(0.74);
          b.pos.copy(envHit.point).addScaledVector(b.vel.clone().normalize(), 0.35);
        } else {
          // Ricochet off rock/metal at shallow grazing angles
          const dirN = b.vel.clone().normalize();
          const grazing = Math.abs(dirN.dot(envHit.normal));
          if ((envHit.material === 'rock' || envHit.material === 'metal') && grazing < 0.32 && b.age < 1.2) {
            b.vel.reflect(envHit.normal).multiplyScalar(0.55);
            b.pos.copy(envHit.point).addScaledVector(envHit.normal, 0.08);
            b.damage *= 0.5;
          } else {
            b.active = false;
            b.mesh.visible = false;
          }
        }
      }
    }
  }

  private pointToSegmentDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const lenSq = abx * abx + aby * aby + abz * abz;
    if (lenSq < 1e-8) return p.distanceTo(a);
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lenSq;
    t = THREE.MathUtils.clamp(t, 0, 1);
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const cz = a.z + abz * t;
    return Math.hypot(p.x - cx, p.y - cy, p.z - cz);
  }

  private updateGrenades(dt: number) {
    for (const g of this.grenadePool) {
      if (!g.active) continue;
      g.fuse -= dt;
      if (g.fuse <= 0) {
        g.active = false;
        g.mesh.visible = false;
        g.smokeMesh.visible = false;
        if (g.kind === 'smoke') {
          this.deploySmokeScreen(g.pos.clone(), g.fromPlayer, g.faction);
        } else {
          this.triggerExplosion(
            g.pos.clone(),
            9.5,
            130,
            g.fromPlayer,
            g.faction,
            g.shooterKey,
            g.shooterName
          );
        }
        continue;
      }

      const prev = g.pos.clone();
      g.vel.y -= 16.5 * dt;
      g.pos.addScaledVector(g.vel, dt);

      if (g.kind === 'frag') {
        // Soldiers shout "La bombe !" (Lingala/Swahili) and dive to the ground when a frag approaches
        for (let i = 0; i < this.soldiers.length; i++) {
          const s = this.soldiers[i];
          if (!s.alive) continue;
          if (s.position.distanceTo(g.pos) < 11.5) {
            if (triggerSoldierDive(s, g.pos)) {
              this.audio.playDiveThud(s.position.distanceTo(this.camera.position));
              this.emitSoldierComms(s.name, s.faction, s.position, 'grenade', true, s.voiceProfile);
            }
          }
        }
        // If frag lands near the player, let a nearby ally warn them if none shouted yet
        if (this.playerHp > 0 && g.pos.distanceTo(this.playerPos) < 10.5) {
          let nearestAlly: SoldierEntity | null = null;
          let bestD = 32;
          for (const s of this.soldiers) {
            if (s.alive && s.faction === this.playerFaction) {
              const d = s.position.distanceTo(this.playerPos);
              if (d < bestD) {
                bestD = d;
                nearestAlly = s;
              }
            }
          }
          if (nearestAlly) {
            this.emitSoldierComms(
              nearestAlly.name,
              nearestAlly.faction,
              nearestAlly.position,
              'grenade',
              true,
              nearestAlly.voiceProfile
            );
          }
        }
      }

      // Water entry splash & drag
      const gh = groundHeightAt(g.pos.x, g.pos.z);
      if (prev.y > WATER_LEVEL && g.pos.y <= WATER_LEVEL && gh < WATER_LEVEL - 0.1) {
        this.spawnImpactBurst(new THREE.Vector3(g.pos.x, WATER_LEVEL, g.pos.z), new THREE.Vector3(0, 1, 0), 'water');
        g.vel.multiplyScalar(0.45);
      }

      // Bounce off walkable surfaces / terrain
      const floorY = supportHeightAt(g.pos.x, g.pos.y, g.pos.z, this.world.boxColliders);
      if (g.pos.y <= floorY + 0.085) {
        g.pos.y = floorY + 0.085;
        if (g.vel.y < -1.2) {
          g.vel.y = -g.vel.y * 0.42;
          g.vel.x *= 0.72;
          g.vel.z *= 0.72;
        } else {
          g.vel.y = 0;
          g.vel.x *= Math.exp(-5 * dt);
          g.vel.z *= Math.exp(-5 * dt);
        }
      }

      // Bounce off cover boxes
      for (const b of this.world.boxColliders) {
        if (b.isWalkableTop) continue;
        if (
          g.pos.x >= b.minX - 0.1 &&
          g.pos.x <= b.maxX + 0.1 &&
          g.pos.z >= b.minZ - 0.1 &&
          g.pos.z <= b.maxZ + 0.1 &&
          g.pos.y >= b.minY &&
          g.pos.y <= b.maxY
        ) {
          g.pos.copy(prev);
          g.vel.x = -g.vel.x * 0.45;
          g.vel.z = -g.vel.z * 0.45;
          break;
        }
      }

      const activeMesh = g.kind === 'smoke' ? g.smokeMesh : g.mesh;
      activeMesh.position.copy(g.pos);
      activeMesh.rotation.x += dt * 7;
      activeMesh.rotation.z += dt * 5;
    }
  }

  private updateRockets(dt: number) {
    const wind = this.weather.windVector;
    for (let i = 0; i < this.rockets.length; i++) {
      const r = this.rockets[i];
      if (!r.active) continue;

      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }

      r.prevPos.copy(r.pos);
      r.vel.y -= 3.2 * dt;
      r.vel.x += wind.x * 0.25 * dt;
      r.vel.z += wind.z * 0.25 * dt;
      r.pos.addScaledVector(r.vel, dt);

      r.mesh.position.copy(r.pos);
      r.mesh.lookAt(r.pos.x + r.vel.x, r.pos.y + r.vel.y, r.pos.z + r.vel.z);

      // Thick rocket smoke & spark trail
      r.trailTimer -= dt;
      if (r.trailTimer <= 0) {
        r.trailTimer = 0.022;
        this.spawnParticle(
          r.pos.x,
          r.pos.y,
          r.pos.z,
          (Math.random() - 0.5) * 0.8,
          0.35 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.8,
          r.age < 0.25 ? '#ffaa44' : '#d6d3d1',
          0.32,
          1.65,
          0.65,
          -0.6
        );
      }

      // Soldiers near rocket flight path shout "La bombe !" and dive for cover
      for (let j = 0; j < this.soldiers.length; j++) {
        const s = this.soldiers[j];
        if (!s.alive) continue;
        if (s.position.distanceTo(r.pos) < 10.5) {
          if (triggerSoldierDive(s, r.pos)) {
            this.audio.playDiveThud(s.position.distanceTo(this.camera.position));
            this.emitSoldierComms(s.name, s.faction, s.position, 'grenade', true);
          }
        }
      }

      let detonatePos: THREE.Vector3 | null = null;

      // 1. Direct soldier hit
      for (let j = 0; j < this.soldiers.length; j++) {
        const s = this.soldiers[j];
        if (!s.alive || s.faction === r.faction) continue;
        _tmpVec.set(s.position.x, s.position.y + 0.85, s.position.z);
        if (this.pointToSegmentDist(_tmpVec, r.prevPos, r.pos) < 0.72) {
          detonatePos = r.pos.clone();
          break;
        }
      }

      // 2. Player hit check for enemy rockets
      if (!detonatePos && !r.fromPlayer && this.playerHp > 0 && this.phase === 'playing') {
        _tmpVec.set(this.playerPos.x, this.playerPos.y + 0.9, this.playerPos.z);
        if (this.pointToSegmentDist(_tmpVec, r.prevPos, r.pos) < 0.72) {
          detonatePos = r.pos.clone();
        }
      }

      // 3. Explosive barrel hit
      if (!detonatePos) {
        for (const bar of this.world.barrels) {
          if (bar.exploded) continue;
          if (this.pointToSegmentDist(bar.position, r.prevPos, r.pos) < 0.85) {
            detonatePos = bar.position.clone();
            break;
          }
        }
      }

      // 4. Environment / cover / terrain / water hit
      if (!detonatePos) {
        const envHit = intersectSegmentEnvironment(
          r.prevPos,
          r.pos,
          this.world.boxColliders,
          this.world.cylinderColliders
        );
        if (envHit) {
          detonatePos = envHit.point.clone();
        } else {
          const gh = groundHeightAt(r.pos.x, r.pos.z);
          if (r.pos.y <= gh + 0.08) {
            detonatePos = new THREE.Vector3(r.pos.x, gh + 0.1, r.pos.z);
          }
        }
      }

      if (detonatePos) {
        r.active = false;
        r.mesh.visible = false;
        this.triggerExplosion(
          detonatePos,
          10.5,
          155,
          r.fromPlayer,
          r.faction,
          r.shooterKey,
          r.shooterName
        );
      }
    }
  }

  private updateParticlesAndCasings(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.sprite.position.copy(p.pos);
      const t = p.age / p.maxAge;
      const sc = THREE.MathUtils.lerp(p.startScale, p.endScale, t);
      p.sprite.scale.setScalar(sc);
      (p.sprite.material as THREE.SpriteMaterial).opacity = (1 - t) * 0.8;
    }

    for (const c of this.casings) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age > 1.1) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      c.vel.y -= 18 * dt;
      c.pos.addScaledVector(c.vel, dt);
      const gh = groundHeightAt(c.pos.x, c.pos.z);
      if (c.pos.y < gh + 0.02) {
        c.pos.y = gh + 0.02;
        c.vel.y = Math.abs(c.vel.y) * 0.35;
        c.vel.x *= 0.6;
        c.vel.z *= 0.6;
      }
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.x += dt * 16;
      c.mesh.rotation.y += dt * 12;
    }
  }

  private updateSectorsAndTickets(dt: number) {
    const modeSpec = getCombatModeSpec(this.combatMode);

    if (this.phase === 'playing') {
      this.matchTimeRemaining = Math.max(0, this.matchTimeRemaining - dt);
    }

    if (modeSpec.usesSectors) {
      for (const sec of this.world.sectors) {
        if (!sec.active) continue;
        let armyIn = 0;
        let rebelIn = 0;

        if (this.phase === 'playing' && this.playerHp > 0) {
          if (this.playerPos.distanceTo(sec.position) <= sec.radius) {
            if (this.playerFaction === 'army') armyIn += 1.5;
            else rebelIn += 1.5;
          }
        }

        for (const s of this.soldiers) {
          if (!s.alive) continue;
          if (s.position.distanceTo(sec.position) <= sec.radius) {
            if (s.faction === 'army') armyIn++;
            else rebelIn++;
          }
        }

        const delta = armyIn - rebelIn;
        if (Math.abs(delta) > 0.1) {
          const prevOwner = sec.owner;
          sec.progress = THREE.MathUtils.clamp(
            sec.progress + delta * 11 * modeSpec.captureSpeedMult * dt,
            -100,
            100
          );
          if (sec.progress >= 100) sec.owner = 'army';
          else if (sec.progress <= -100) sec.owner = 'rebels';
          else if (Math.abs(sec.progress) < 25) sec.owner = 'neutral';

          if (prevOwner !== sec.owner && sec.owner !== 'neutral' && this.phase === 'playing') {
            if (sec.owner === this.playerFaction && this.playerPos.distanceTo(sec.position) <= sec.radius + 8) {
              this.awardRankXp(60);
            }
            this.pushRadioBanner(
              `${sec.id} (${sec.name}) capturé par ${
                sec.owner === 'army' ? "l'Armée Régulière" : 'les Forces Rebelles'
              }`
            );
          }
        }
      }

      const activeSectors = this.world.sectors.filter((s) => s.active);
      const armyOwned = activeSectors.filter((s) => s.owner === 'army').length;
      const rebelOwned = activeSectors.filter((s) => s.owner === 'rebels').length;
      this.ticketBleedTimer += dt;
      if (this.ticketBleedTimer >= 1.5) {
        this.ticketBleedTimer = 0;
        if (armyOwned > rebelOwned) {
          this.rebelTickets = Math.max(0, this.rebelTickets - (armyOwned - rebelOwned));
        } else if (rebelOwned > armyOwned) {
          this.armyTickets = Math.max(0, this.armyTickets - (rebelOwned - armyOwned));
        }
      }
    }

    if (this.phase === 'playing') {
      let matchEnded = false;
      let armyWon = false;

      if (this.combatMode === 'tdm') {
        if (this.armyScore >= modeSpec.scoreLimit || this.rebelScore >= modeSpec.scoreLimit) {
          matchEnded = true;
          armyWon = this.armyScore >= modeSpec.scoreLimit;
        }
      } else if (this.armyTickets <= 0 || this.rebelTickets <= 0) {
        matchEnded = true;
        armyWon = this.rebelTickets <= 0;
      }

      if (!matchEnded && this.matchTimeRemaining <= 0) {
        matchEnded = true;
        armyWon =
          this.combatMode === 'tdm'
            ? this.armyScore >= this.rebelScore
            : this.armyTickets >= this.rebelTickets;
      }

      if (matchEnded) {
        const playerWon =
          (this.playerFaction === 'army' && armyWon) ||
          (this.playerFaction === 'rebels' && !armyWon);
        this.phase = playerWon ? 'victory' : 'defeat';
        this.exitPointerLock();
        this.syncHud();
      }
    }
  }

  private updatePlayer(dt: number) {
    if (this.friendlyFireWarnTimer > 0) {
      this.friendlyFireWarnTimer = Math.max(0, this.friendlyFireWarnTimer - dt);
    }
    if (this.friendlyFireAudioCooldown > 0) {
      this.friendlyFireAudioCooldown = Math.max(0, this.friendlyFireAudioCooldown - dt);
    }

    if (this.playerHp <= 0) {
      this.isRegenerating = false;
      this.aimingAtAlly = null;
      this.aimingAtEnemy = false;
      this.aimingEnemyDist = null;
      this.aimedEnemyRef = null;
      this.scopeRangeMeters = null;
      this.scopeDropSvgUnits = 0;
      if (this.isGamepadActive() && this.padState.confirmJustPressed) {
        this.skipKillcam();
        return;
      }
      this.playerRespawnTimer -= dt;
      if (this.playerRespawnTimer <= 0 && !this.killcam.active && this.pendingKillcamMeta === null) {
        this.respawnPlayer(this.playerFaction);
      }
      return;
    }

    this.timeSinceDamage += dt;
    if (this.flameAudioCooldown > 0) this.flameAudioCooldown = Math.max(0, this.flameAudioCooldown - dt);

    // Local Player Burn DoT (extinguished immediately in river water)
    if (this.playerBurnTimer > 0) {
      if (this.playerGroundState.inWater) {
        this.playerBurnTimer = 0;
        this.envParticles.spawnWaterSplash(this.playerPos.x, WATER_LEVEL + 0.05, this.playerPos.z, 1.1);
      } else {
        this.playerBurnTimer = Math.max(0, this.playerBurnTimer - dt);
        this.timeSinceDamage = 0;
        this.playerBurnTickAccum += dt;
        if (this.playerBurnTickAccum >= 0.25) {
          this.playerBurnTickAccum = 0;
          const meta = this.playerBurnMeta;
          const burnDmg = 2.4;
          if (this.playerHp - burnDmg <= 0 && meta) {
            this.damagePlayer(
              burnDmg + 1,
              meta.sourcePos,
              meta.killerName,
              meta.killerFaction,
              `${meta.weaponLabel} (Brûlure)`,
              false,
              meta.killerKey,
              meta.weaponId,
              false
            );
          } else {
            this.playerHp = Math.max(1, this.playerHp - burnDmg);
            this.damageFlash = Math.max(this.damageFlash, 0.28);
          }
        }
      }
    }

    this.updateHealthRegenAndOrders(dt);

    // Reload tick
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const spec = WEAPON_SPECS[this.currentWeaponId];
        const inv = this.weaponInventory[this.currentWeaponId];
        const needed = spec.magSize - inv.mag;
        const load = Math.min(needed, inv.reserve);
        inv.mag += load;
        inv.reserve -= load;
        this.isReloading = false;
      }
    }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.getViewmodel(this.currentWeaponId).muzzleFlash.visible = false;
      }
    }

    if (this.playerSlideTimer > 0) this.playerSlideTimer = Math.max(0, this.playerSlideTimer - dt);
    if (this.playerSlideCooldown > 0) this.playerSlideCooldown = Math.max(0, this.playerSlideCooldown - dt);
    if (this.sprintMomentumTimer > 0) this.sprintMomentumTimer = Math.max(0, this.sprintMomentumTimer - dt);
    if (this.playerDiveTimer > 0) this.playerDiveTimer = Math.max(0, this.playerDiveTimer - dt);
    if (this.playerDiveCooldown > 0) this.playerDiveCooldown = Math.max(0, this.playerDiveCooldown - dt);

    if (this.droneClimbBurstTimer > 0) this.droneClimbBurstTimer = Math.max(0, this.droneClimbBurstTimer - dt);
    if (this.droneDescendBurstTimer > 0) this.droneDescendBurstTimer = Math.max(0, this.droneDescendBurstTimer - dt);
    if (this.droneScanAudioCooldown > 0) this.droneScanAudioCooldown = Math.max(0, this.droneScanAudioCooldown - dt);

    const padActive = this.isGamepadActive();

    if (padActive && this.padState.droneToggleJustPressed) {
      this.toggleReconDrone();
    }

    if (this.droneActive) {
      this.updateReconDrone(dt, padActive);
      return;
    } else {
      this.droneBattery = Math.min(100, this.droneBattery + dt * 9.5);
    }

    // DualShock full all-button actions
    if (padActive) {
      if (
        this.padState.l3JustPressed &&
        this.padState.adsHeld &&
        isSniperWeapon(this.currentWeaponId)
      ) {
        this.sniperZoomIdx = this.sniperZoomIdx === 0 ? 1 : 0;
        this.audio.playCommandChirp('ack');
        this.syncHud();
      }
      if (this.padState.jumpJustPressed) {
        if (this.playerSlideTimer > 0) {
          this.playerSlideTimer = 0;
          this.playerStance = 'stand';
          this.jumpJustPressed = true;
        } else if (this.playerStance !== 'stand') {
          // ✕ Croix relieves crouch or prone back to stand cleanly
          this.playerStance = 'stand';
        } else {
          this.jumpJustPressed = true;
        }
      }
      if (this.padState.crouchJustPressed) {
        // ○ Rond court -> Accroupi / Glissade en sprint
        this.handleCrouchAction();
      }
      if (this.padState.proneJustPressed) {
        // ○ Rond maintenu -> Allongé / Plongeon en sprint
        this.handleProneAction(true);
      }
      if (this.padState.diveOrProneJustPressed) {
        // R3 -> Allongé immédiat / Plongeon tactique en sprint
        this.handleProneAction(true);
      }
      if (this.padState.reloadJustPressed) this.startReload(); // □ Carré
      if (this.padState.grenadeJustPressed) this.throwGrenade('frag'); // R1
      if (this.padState.smokeJustPressed) this.throwGrenade('smoke'); // L1
      if (this.padState.toggleStatusPanelJustPressed) this.toggleStatusPanel(); // Share
      if (this.padState.toggleCommandPanelJustPressed) this.toggleCommandPanel(); // Pavé Tactile
      if (this.padState.quickOrderJustPressed) this.issueTacticalOrder('follow'); // D-Pad Haut
      if (this.padState.cycleOrderJustPressed) this.cycleTacticalOrder(); // D-Pad Gauche
      if (this.padState.issueOrderJustPressed) this.issueTacticalOrder(this.selectedOrder); // D-Pad Droite
      if (this.padState.nextWeaponJustPressed || this.padState.prevWeaponJustPressed) {
        // △ Arme suivante / D-Pad Bas Arme précédente (strictly across 3-weapon loadout)
        const order = this.playerLoadout;
        if (order.length > 1) {
          const idx = Math.max(0, order.indexOf(this.currentWeaponId));
          const dir = this.padState.nextWeaponJustPressed ? 1 : -1;
          this.switchWeapon(order[(idx + dir + order.length) % order.length]);
        }
      }

      // Right stick fast responsive camera look + subtle enemy aim-assist friction
      if (Math.abs(this.padState.lookX) > 0.001 || Math.abs(this.padState.lookY) > 0.001) {
        this.audio.unlock();
        const wSpec = WEAPON_SPECS[this.currentWeaponId];
        const sniperAdsScale =
          isSniperWeapon(this.currentWeaponId)
            ? THREE.MathUtils.clamp(((wSpec.zoomFovs?.[this.sniperZoomIdx] ?? wSpec.adsFov) / 72) * 1.4, 0.16, 0.72)
            : 1.0;
        const adsLookScale =
          this.adsAlpha > 0.5 && isSniperWeapon(this.currentWeaponId)
            ? this.gamepadSettings.adsMultiplier * sniperAdsScale
            : this.adsAlpha > 0.5
            ? this.gamepadSettings.adsMultiplier
            : 1.0;

        let assistFriction = 1.0;
        const lookVec = _tmpVec.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
        for (let i = 0; i < this.soldiers.length; i++) {
          const s = this.soldiers[i];
          if (!s.alive || s.faction === this.playerFaction) continue;
          const aimY = s.stance === 'prone' ? 0.35 : s.stance === 'crouch' ? 0.85 : 1.25;
          _tmpVec2.set(s.position.x, s.position.y + aimY, s.position.z).sub(this.camera.position);
          const dist = _tmpVec2.length();
          if (dist < 65 && dist > 0.5) {
            _tmpVec2.divideScalar(dist);
            if (_tmpVec2.dot(lookVec) > 0.992) {
              assistFriction = 0.62;
              break;
            }
          }
        }
        const padSens = this.gamepadSettings.lookSensitivity * adsLookScale * assistFriction;
        this.playerYaw -= this.padState.lookX * padSens * dt;
        this.playerPitch -= this.padState.lookY * padSens * 0.82 * dt;
        this.playerPitch = THREE.MathUtils.clamp(this.playerPitch, -1.42, 1.42);
      }
    }

    // Firing check (Mouse OR DualShock R2 OR Mobile Touch Fire!)
    const spec = WEAPON_SPECS[this.currentWeaponId];
    const mouseWantsFire = this.mouseDownLeft && this.pointerLocked;
    const padWantsFire = padActive && this.padState.fireHeld;
    const touchWantsFire = this.isMobileDevice && !padActive && this.touchFireHeld;
    if (mouseWantsFire || padWantsFire || touchWantsFire) {
      if (spec.fireMode === 'AUTO' || !this.semiShotLocked || (padActive && this.padState.fireJustPressed)) {
        this.firePlayerWeapon();
      }
    }

    // Movement input (supports WASD, AZERTY ZQSD, DualShock Left Stick, AND Mobile Virtual Stick!)
    const kbFwd =
      (this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const kbStrafe =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['KeyQ'] || this.keys['ArrowLeft'] ? 1 : 0);

    const tMoveFwd = this.isMobileDevice && !padActive ? -this.touchMoveY : 0;
    const tMoveStrafe = this.isMobileDevice && !padActive ? this.touchMoveX : 0;
    const moveFwd = THREE.MathUtils.clamp(kbFwd - (padActive ? this.padState.moveY : 0) + tMoveFwd, -1, 1);
    const moveStrafe = THREE.MathUtils.clamp(kbStrafe + (padActive ? this.padState.moveX : 0) + tMoveStrafe, -1, 1);

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));
    _wishDir.set(0, 0, 0).addScaledVector(_forward, moveFwd).addScaledVector(_right, moveStrafe);
    if (_wishDir.lengthSq() > 1) _wishDir.normalize();

    const wantsAdsInput =
      this.mouseDownRight ||
      this.adsToggle ||
      (padActive && this.padState.adsHeld) ||
      (this.isMobileDevice && !padActive && this.touchAdsHeld);
    const isSliding = this.playerSlideTimer > 0;
    const shiftHeld = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const padSprint = padActive && this.padState.sprintHeld;
    const mobileSprint = this.isMobileDevice && !padActive && this.touchSprint;
    const padTacSprint = padActive && this.padState.tacSprintHeld;
    const canEngageSprint =
      (shiftHeld || padSprint || mobileSprint) &&
      moveFwd > 0.22 &&
      !wantsAdsInput &&
      !isSliding &&
      this.playerDiveTimer <= 0 &&
      this.playerStamina > 5;

    // Directly stand up from crouch or prone whenever the player engages sprint
    if (canEngageSprint && this.playerStance !== 'stand') {
      this.playerStance = 'stand';
    }

    const isCrouched = this.playerStance === 'crouch';
    const isProne = this.playerStance === 'prone';
    const wantsSprint = canEngageSprint && this.playerStance === 'stand';

    if (!shiftHeld && !padSprint) {
      this.kbTacSprintLatched = false;
    }

    const wantsTacSprint =
      wantsSprint &&
      (this.kbTacSprintLatched || padTacSprint) &&
      this.playerStamina > 16;

    this.isSprinting = wantsSprint && _wishDir.lengthSq() > 0.1;
    this.isTacSprinting = wantsTacSprint && _wishDir.lengthSq() > 0.1;

    if (this.isSprinting) {
      this.sprintMomentumTimer = 0.24;
      this.playerStamina = Math.max(0, this.playerStamina - (this.isTacSprinting ? 26 : 17) * dt);
      if (this.playerStamina <= 16) this.kbTacSprintLatched = false;
    } else if (!isSliding) {
      this.playerStamina = Math.min(100, this.playerStamina + 20 * dt);
    }

    // Heavy rain/storm mud makes sprinting slightly heavier; wounded state slows movement slightly
    const mudRainPenalty = this.weather.currentRainIntensity > 0.5 ? 0.94 : 1.0;
    const isWounded = this.playerHp > 0 && this.playerHp <= 45;
    const woundSpeedPenalty = isWounded ? 0.86 : 1.0;

    const isDiving = this.playerDiveTimer > 0;
    let slideSpeed = 0;
    if (isSliding) {
      const slideProgress = 1 - this.playerSlideTimer / 0.66;
      slideSpeed = THREE.MathUtils.lerp(11.8, 4.4, slideProgress * slideProgress);
      groundNormalAt(this.playerPos.x, this.playerPos.z, _tmpVec2);
      const slopeDot = _tmpVec2.x * this.playerSlideDir.x + _tmpVec2.z * this.playerSlideDir.z;
      if (slopeDot > 0.05) {
        slideSpeed += slopeDot * 4.8;
      }
      _wishDir.copy(this.playerSlideDir).addScaledVector(_right, moveStrafe * 0.25).normalize();

      this.slideDustTimer -= dt;
      if (this.slideDustTimer <= 0 && this.playerGroundState.grounded) {
        this.slideDustTimer = 0.048;
        const surf = getSurfaceTypeAt(this.playerPos.x, this.playerPos.y, this.playerPos.z);
        if (surf === 'water') {
          this.envParticles.spawnWaterSplash(
            this.playerPos.x - this.playerSlideDir.x * 0.3,
            WATER_LEVEL + 0.04,
            this.playerPos.z - this.playerSlideDir.z * 0.3,
            1.35
          );
        } else {
          this.envParticles.spawnGroundDust(
            this.playerPos.x - this.playerSlideDir.x * 0.35,
            this.playerPos.y,
            this.playerPos.z - this.playerSlideDir.z * 0.35,
            -this.playerSlideDir.x * 1.5,
            0.75,
            -this.playerSlideDir.z * 1.5,
            3,
            0.7,
            surf === 'wood' ? '#9c7a4c' : '#855a3c'
          );
        }
      }
    } else if (isDiving) {
      _wishDir.copy(this.playerDiveDir);
    }

    // Fast, fluid movement speeds across all 3 separated stances
    const speedTarget = (isSliding
      ? slideSpeed
      : isDiving
      ? 8.2
      : isProne
      ? 1.85
      : isCrouched
      ? 3.15
      : this.isTacSprinting
      ? 9.5
      : this.isSprinting
      ? 7.9
      : wantsAdsInput
      ? 3.65
      : 5.25) * mudRainPenalty * woundSpeedPenalty;

    const colliderHeight = isProne || isDiving ? 0.58 : isCrouched || isSliding ? 1.18 : 1.75;

    stepPlayerPhysics(
      this.playerPos,
      this.playerVel,
      _wishDir,
      speedTarget,
      this.playerGroundState,
      this.jumpJustPressed && !isDiving && this.playerStance === 'stand',
      dt,
      this.world.boxColliders,
      this.world.cylinderColliders,
      colliderHeight
    );
    this.jumpJustPressed = false;

    if ((this.playerGroundState.landingImpact ?? 0) > 0) {
      const imp = this.playerGroundState.landingImpact!;
      this.landingDip = Math.max(this.landingDip, imp * 0.14);
      const surf = getSurfaceTypeAt(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.audio.playFootstep(surf, true);
      if (surf === 'water') {
        this.envParticles.spawnWaterSplash(this.playerPos.x, WATER_LEVEL + 0.04, this.playerPos.z, 1.15);
      } else {
        this.envParticles.spawnGroundDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0, 0.45, 0, 3, 0.55, '#857859');
      }
    }
    this.landingDip = THREE.MathUtils.lerp(this.landingDip, 0, 1 - Math.exp(-13 * dt));

    // Eye height damping + subtle uphill slope clearance when prone so ground cover never clips terrain
    let proneSlopeClearance = 0;
    if (isProne || isDiving) {
      const ghHere = groundHeightAt(this.playerPos.x, this.playerPos.z);
      const ghAhead = groundHeightAt(
        this.playerPos.x - Math.sin(this.playerYaw) * 0.55,
        this.playerPos.z - Math.cos(this.playerYaw) * 0.55
      );
      proneSlopeClearance = THREE.MathUtils.clamp((ghAhead - ghHere) * 0.45, 0, 0.14);
    }

    const targetEye =
      isProne || isDiving
        ? PLAYER_EYE_PRONE + proneSlopeClearance
        : isSliding
        ? 0.78
        : isCrouched
        ? PLAYER_EYE_CROUCH
        : PLAYER_EYE_STAND;
    this.playerEyeHeight = THREE.MathUtils.lerp(
      this.playerEyeHeight,
      targetEye,
      1 - Math.exp(-(isSliding ? 18 : 15) * dt)
    );

    // Recoil recovery & spread decay (rapid, crisp reset for ADS & prone stability)
    const recSpeed = (this.adsAlpha > 0.5 ? 14.2 : 11.2) * (isProne ? 1.25 : 1.0);
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, 1 - Math.exp(-recSpeed * dt));
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, 1 - Math.exp(-recSpeed * dt));
    this.recoilKickZ = THREE.MathUtils.lerp(this.recoilKickZ, 0, 1 - Math.exp(-19 * dt));
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 0.08);

    // ADS transition & CoD dynamic FOV (Sprint / Tac-Sprint / Slide / ADS)
    const wantsAds = wantsAdsInput && !this.isReloading && !this.isSprinting;
    this.adsAlpha = THREE.MathUtils.lerp(
      this.adsAlpha,
      wantsAds ? 1 : 0,
      1 - Math.exp(-18 * dt)
    );
    this.sprintBlend = THREE.MathUtils.lerp(
      this.sprintBlend,
      this.isSprinting && !this.isTacSprinting && !this.isReloading ? 1 : 0,
      1 - Math.exp(-13 * dt)
    );
    this.tacSprintBlend = THREE.MathUtils.lerp(
      this.tacSprintBlend,
      this.isTacSprinting && !this.isReloading ? 1 : 0,
      1 - Math.exp(-13 * dt)
    );
    this.slideBlend = THREE.MathUtils.lerp(
      this.slideBlend,
      isSliding ? 1 : 0,
      1 - Math.exp(-16 * dt)
    );
    this.strafeRoll = THREE.MathUtils.lerp(
      this.strafeRoll,
      -moveStrafe * 0.017 * (1 - this.adsAlpha * 0.85),
      1 - Math.exp(-10 * dt)
    );

    const slideFovBoost = isSliding ? (this.playerSlideTimer / 0.66) * 7.5 : 0;
    const portraitFovBoost =
      this.camera.aspect < 0.95
        ? THREE.MathUtils.clamp(1.0 + (0.95 - this.camera.aspect) * 0.44, 1.0, 1.24)
        : 1.0;
    const baseMoveFov = (72 + this.sprintBlend * 4.5 + this.tacSprintBlend * 8.5 + slideFovBoost) * portraitFovBoost;
    const targetAdsFov =
      isSniperWeapon(this.currentWeaponId) && spec.zoomFovs
        ? spec.zoomFovs[this.sniperZoomIdx]
        : spec.adsFov * (this.camera.aspect < 0.95 ? 1.12 : 1.0);
    const targetFov = THREE.MathUtils.lerp(baseMoveFov, targetAdsFov, this.adsAlpha);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Footstep cadence, audio & ground dust / river water splashes
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.playerGroundState.grounded && horizSpeed > 0.6 && !isSliding) {
      this.weaponBobPhase += dt * horizSpeed * (isProne ? 1.45 : 1.9);
      this.footstepTimer -= dt * (horizSpeed / 4.5);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.isTacSprinting ? 0.32 : isProne ? 0.48 : 0.4;
        const surf = getSurfaceTypeAt(this.playerPos.x, this.playerPos.y, this.playerPos.z);
        this.audio.playFootstep(surf, this.isSprinting);
        if (surf === 'water') {
          this.envParticles.spawnWaterSplash(
            this.playerPos.x,
            WATER_LEVEL + 0.04,
            this.playerPos.z,
            this.isSprinting ? 1.25 : 0.75
          );
        } else if (surf === 'mud' || surf === 'grass' || surf === 'rock') {
          this.envParticles.spawnGroundDust(
            this.playerPos.x,
            this.playerPos.y,
            this.playerPos.z,
            -this.playerVel.x * 0.16,
            0.35,
            -this.playerVel.z * 0.16,
            this.isSprinting ? 3 : 1,
            this.isSprinting ? 0.58 : 0.36,
            surf === 'mud' ? '#926341' : '#857859'
          );
        }
      }
    } else {
      this.weaponBobPhase = THREE.MathUtils.lerp(this.weaponBobPhase, 0, dt * 7);
    }

    // Camera position + head bob + wound limping tilt + CoD slide tilt + landing dip + strafe fluidity
    this.woundRoll = THREE.MathUtils.lerp(this.woundRoll, 0, 1 - Math.exp(-8 * dt));
    if (isWounded && horizSpeed > 0.4 && !isSliding) {
      this.woundLimpPhase += dt * horizSpeed * 1.45;
    }
    const limpRoll = isWounded && !isSliding
      ? Math.sin(this.woundLimpPhase) * (horizSpeed > 0.4 ? 0.045 : 0.012) * (1 - this.adsAlpha * 0.72)
      : 0;
    const slideCameraRoll = -0.115 * this.slideBlend;
    const slideCameraPitch = -0.028 * this.slideBlend;
    const breathPitch = isWounded ? Math.sin(this.elapsed * 3.8) * 0.012 * (1 - this.adsAlpha * 0.75) : 0;
    const limpBobY =
      isWounded && horizSpeed > 0.4 && !isSliding
        ? -Math.abs(Math.sin(this.woundLimpPhase)) * 0.045 * (1 - this.adsAlpha * 0.82)
        : 0;

    const bobAmp =
      this.playerGroundState.grounded && !isSliding
        ? Math.min(0.06, horizSpeed * (isProne ? 0.005 : 0.008)) * (1 - this.adsAlpha * 0.94)
        : 0;
    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.14;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.14;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.4);

    this.camera.position.set(
      this.playerPos.x + shakeX,
      this.playerPos.y +
        this.playerEyeHeight -
        this.landingDip +
        Math.sin(this.weaponBobPhase * 2) * bobAmp +
        limpBobY +
        shakeY,
      this.playerPos.z
    );

    _euler.set(
      THREE.MathUtils.clamp(
        this.playerPitch + this.recoilPitch + breathPitch + slideCameraPitch,
        -1.45,
        1.45
      ),
      this.playerYaw + this.recoilYaw,
      this.woundRoll + limpRoll + slideCameraRoll + this.strafeRoll,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(_euler);

    // Position 3D weapon viewmodel smoothly (Ultra-stable sight picture in ADS, clean sniper scope transition)
    const vm = this.getViewmodel(this.currentWeaponId);
    this.weaponAnchor.visible =
      this.phase === 'playing' && !(isSniperWeapon(this.currentWeaponId) && this.adsAlpha > 0.78);
    const reloadDip = this.isReloading ? Math.sin((this.reloadTimer / spec.reloadTime) * Math.PI) * 0.18 : 0;
    const swayMult = (1 - this.adsAlpha * 0.94) * (1 + this.tacSprintBlend * 0.75 + this.sprintBlend * 0.35);
    const swayX = Math.cos(this.weaponBobPhase) * 0.014 * swayMult;
    const swayY = Math.abs(Math.sin(this.weaponBobPhase)) * -0.014 * swayMult;

    this.weaponAnchor.position.lerpVectors(spec.hipOffset, spec.adsOffset, this.adsAlpha);
    if (this.camera.aspect < 0.85) {
      // Pull hipfire viewmodel cleanly inward and slightly compact on vertical Android screens
      this.weaponAnchor.position.x *= THREE.MathUtils.lerp(0.68, 1.0, this.adsAlpha);
      this.weaponAnchor.scale.setScalar(THREE.MathUtils.lerp(0.84, 1.0, this.adsAlpha));
    } else {
      this.weaponAnchor.scale.setScalar(1);
    }
    this.weaponAnchor.position.x +=
      swayX -
      this.sprintBlend * 0.032 -
      this.tacSprintBlend * 0.048 -
      this.slideBlend * 0.028 * (1 - this.adsAlpha * 0.88);
    this.weaponAnchor.position.y +=
      swayY -
      reloadDip -
      this.landingDip * 0.24 -
      (isWounded ? 0.012 * (1 - this.adsAlpha * 0.85) : 0) -
      this.sprintBlend * 0.026 +
      this.tacSprintBlend * 0.045 -
      this.slideBlend * 0.022 * (1 - this.adsAlpha * 0.88);
    this.weaponAnchor.position.z +=
      this.recoilKickZ * (1 - this.adsAlpha * 0.35) +
      this.sprintBlend * 0.025 +
      this.tacSprintBlend * 0.035;

    this.weaponAnchor.rotation.x =
      this.recoilKickZ * (1.15 - this.adsAlpha * 0.7) -
      reloadDip * 1.5 -
      this.sprintBlend * 0.12 +
      this.tacSprintBlend * 0.46;
    this.weaponAnchor.rotation.y =
      this.sprintBlend * 0.36 + this.tacSprintBlend * 0.42;
    this.weaponAnchor.rotation.z =
      (this.woundRoll * 0.8 + limpRoll * 1.3 + this.strafeRoll * 1.2) * (1 - this.adsAlpha * 0.85) -
      this.sprintBlend * 0.18 +
      this.tacSprintBlend * 0.28 +
      this.slideBlend * 0.48 * (1 - this.adsAlpha * 0.88);
    vm.boltMesh.position.z = -0.03 + this.recoilKickZ * 0.9;
    if (vm.warheadMesh) {
      vm.warheadMesh.visible =
        this.weaponInventory[this.currentWeaponId].mag > 0 && !this.isReloading;
    }
    if (vm.pilotFlameMesh) {
      const flamePulse = 0.82 + 0.35 * Math.sin(this.elapsed * 28);
      vm.pilotFlameMesh.scale.set(flamePulse, flamePulse * 1.15, flamePulse);
      vm.pilotFlameMesh.visible = !this.isReloading;
    }

    // Keep shadow frustum centered near player for crisp local shadows
    this.sunLight.position.set(this.playerPos.x + 42, 62, this.playerPos.z + 34);
    this.sunLight.target.position.set(this.playerPos.x, 0, this.playerPos.z);

    // Update river & weather ambience volume
    const distRiver = Math.abs(this.playerPos.z - riverCenterZ(this.playerPos.x));
    this.audio.updateAmbience(
      distRiver,
      this.weather.currentRainIntensity,
      this.weather.windVector.length()
    );

    // Broadcast local state at 20Hz when in a Wi-Fi LAN match
    if (this.lanRoomCode) {
      this.lanSyncTimer += dt;
      if (this.lanSyncTimer >= 0.05) {
        this.lanSyncTimer = 0;
        this.lan.sendState({
          x: this.playerPos.x,
          y: this.playerPos.y,
          z: this.playerPos.z,
          yaw: this.playerYaw,
          pitch: this.playerPitch,
          vx: this.playerVel.x,
          vz: this.playerVel.z,
          weaponId: this.currentWeaponId,
          faction: this.playerFaction,
          rankLevel: this.playerRankLevel,
          hp: Math.ceil(this.playerHp),
          isCrouching: isCrouched,
          isProne,
          isSprinting: this.isSprinting,
          isTacSprinting: this.isTacSprinting,
          isSliding,
          isDiving,
        });
      }
    }

    this.updateFriendlyIff();
  }

  private initReconDrone() {
    this.droneGroup = new THREE.Group();
    this.droneRotors = [];

    const frameMat = new THREE.MeshStandardMaterial({
      color: '#1b2420',
      roughness: 0.45,
      metalness: 0.65,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    const rotorMat = new THREE.MeshBasicMaterial({
      color: '#cbd5e1',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.38), frameMat);
    this.droneGroup.add(core);

    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), accentMat);
    gimbal.position.set(0, -0.06, -0.11);
    this.droneGroup.add(gimbal);

    const armCoords: Array<[number, number]> = [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ];
    for (const [ax, az] of armCoords) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.32), frameMat);
      arm.position.set(ax * 0.52, 0.01, az * 0.52);
      arm.rotation.y = Math.atan2(ax, az);
      this.droneGroup.add(arm);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 8), frameMat);
      pod.position.set(ax, 0.03, az);
      this.droneGroup.add(pod);

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.024), rotorMat);
      rotor.position.set(ax, 0.062, az);
      this.droneGroup.add(rotor);
      this.droneRotors.push(rotor);
    }

    this.droneGroup.visible = false;
    this.scene.add(this.droneGroup);
  }

  private toggleReconDrone() {
    if (this.phase !== 'playing' || this.playerHp <= 0 || this.killcam.active) return;
    if (this.droneActive) {
      this.recallReconDrone(false);
      return;
    }
    if (this.droneBattery < 18) {
      this.pushRadioBanner(`BATTERIE DRONE FAIBLE (${Math.round(this.droneBattery)}%)`);
      this.audio.playCommandChirp('ack');
      return;
    }
    this.droneActive = true;
    this.adsToggle = false;
    this.mouseDownRight = false;
    this.touchAdsHeld = false;
    this.touchFireHeld = false;
    this.isReloading = false;
    if (this.playerStance === 'stand') {
      this.playerStance = 'crouch';
    }
    this.droneYaw = this.playerYaw;
    this.dronePitch = -0.34;
    const fx = -Math.sin(this.playerYaw);
    const fz = -Math.cos(this.playerYaw);
    const sx = THREE.MathUtils.clamp(this.playerPos.x + fx * 1.8, -PLAYABLE_HALF_EXTENT + 4, PLAYABLE_HALF_EXTENT - 4);
    const sz = THREE.MathUtils.clamp(this.playerPos.z + fz * 1.8, -PLAYABLE_HALF_EXTENT + 4, PLAYABLE_HALF_EXTENT - 4);
    const sy = groundHeightAt(sx, sz) + 4.4;
    this.dronePos.set(sx, sy, sz);
    this.droneVel.set(0, 0, 0);
    this.droneGroup.position.copy(this.dronePos);
    this.droneGroup.visible = true;
    this.weaponAnchor.visible = false;
    this.audio.playDroneEvent('deploy');
    this.pushRadioBanner('DRONE RECON DÉPLOYÉ · VISEZ UN FOURRÉ & MARQUEZ [CLIC / M / R2]');
    this.syncHud();
  }

  private recallReconDrone(lowBattery = false) {
    if (!this.droneActive) return;
    this.droneActive = false;
    this.droneAimingEnemy = false;
    this.droneAimingEnemyName = null;
    this.droneAimingEnemyDist = null;
    this.droneClimbBurstTimer = 0;
    this.droneDescendBurstTimer = 0;
    if (this.droneGroup) this.droneGroup.visible = false;
    this.weaponAnchor.visible = this.phase === 'playing';
    this.audio.playDroneEvent('recall');
    if (lowBattery) {
      this.pushRadioBanner('DRONE RECON RAPPELÉ — BATTERIE ÉPUISÉE');
    } else {
      this.pushRadioBanner('DRONE RECON RAPPELÉ');
    }
    this.syncHud();
  }

  private markEnemiesWithDrone() {
    if (!this.droneActive || this.phase !== 'playing' || this.playerHp <= 0) return;

    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    let newlyMarked = 0;
    let firstMarkedName: string | null = null;

    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive || s.faction === this.playerFaction) continue;
      const aimY = s.stance === 'prone' ? 0.35 : s.isCrouching ? 0.85 : 1.25;
      _tmpVec.set(s.position.x, s.position.y + aimY, s.position.z);
      _tmpVec2.subVectors(_tmpVec, this.dronePos);
      const dist = _tmpVec2.length();
      if (dist > 105 || dist < 1.0) continue;
      _tmpVec2.divideScalar(dist);
      if (_tmpVec2.dot(_forward) < 0.962) continue; // ~15.8° optic cone

      if (!hasDroneOpticLos(this.dronePos, _tmpVec, this.world.boxColliders)) continue;

      const wasMarked = s.droneMarkedTimer > 1.5;
      s.droneMarkedTimer = 18.0;
      if (!wasMarked) {
        newlyMarked++;
        if (!firstMarkedName) firstMarkedName = `${s.rankTitle} ${s.name}`;
      }
    }

    if (newlyMarked > 0) {
      this.audio.playDroneEvent('mark');
      this.dualShock.rumble(0.18, 0.25, 95);
      this.awardRankXp(newlyMarked * 8);
      this.pushRadioBanner(
        newlyMarked === 1 && firstMarkedName
          ? `ENNEMI MARQUÉ DANS LES FOURRÉS : ${firstMarkedName} (18s)`
          : `${newlyMarked} ENNEMIS MARQUÉS POUR VOS SUBORDONNÉS (18s)`
      );
      this.syncHud();
    } else if (this.droneScanAudioCooldown <= 0) {
      this.droneScanAudioCooldown = 0.55;
      this.audio.playDroneEvent('scan');
    }
  }

  private updateReconDrone(dt: number, padActive: boolean) {
    this.droneBattery = Math.max(0, this.droneBattery - dt * 3.4);
    if (this.droneBattery <= 0) {
      this.recallReconDrone(true);
      return;
    }

    if (padActive) {
      if (this.padState.nextWeaponJustPressed) {
        this.recallReconDrone(false);
        return;
      }
      if (this.padState.fireJustPressed || this.padState.reloadJustPressed) {
        this.markEnemiesWithDrone();
      }
      if (this.padState.quickOrderJustPressed) this.issueTacticalOrder('follow');
      if (this.padState.cycleOrderJustPressed) this.cycleTacticalOrder();
      if (this.padState.issueOrderJustPressed) this.issueTacticalOrder(this.selectedOrder);

      if (Math.abs(this.padState.lookX) > 0.001 || Math.abs(this.padState.lookY) > 0.001) {
        const padSens = this.gamepadSettings.lookSensitivity * 0.85;
        this.droneYaw -= this.padState.lookX * padSens * dt;
        this.dronePitch = THREE.MathUtils.clamp(
          this.dronePitch - this.padState.lookY * padSens * 0.78 * dt,
          -1.28,
          0.28
        );
      }
    }

    const kbFwd =
      (this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const kbStrafe =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['KeyQ'] || this.keys['ArrowLeft'] ? 1 : 0);
    const kbUp =
      (this.keys['Space'] || this.droneClimbBurstTimer > 0 ? 1 : 0) -
      (this.keys['KeyC'] || this.keys['ControlLeft'] || this.droneDescendBurstTimer > 0 ? 1 : 0);

    const tMoveFwd = this.isMobileDevice && !padActive ? -this.touchMoveY : 0;
    const tMoveStrafe = this.isMobileDevice && !padActive ? this.touchMoveX : 0;
    const moveFwd = THREE.MathUtils.clamp(kbFwd - (padActive ? this.padState.moveY : 0) + tMoveFwd, -1, 1);
    const moveStrafe = THREE.MathUtils.clamp(kbStrafe + (padActive ? this.padState.moveX : 0) + tMoveStrafe, -1, 1);
    const padVert = padActive
      ? (this.padState.jumpHeld ? 1 : 0) - (this.padState.crouchHeld ? 1 : 0)
      : 0;
    const moveVert = THREE.MathUtils.clamp(kbUp + padVert, -1, 1);

    const boost =
      this.keys['ShiftLeft'] ||
      this.keys['ShiftRight'] ||
      (padActive && this.padState.sprintHeld) ||
      (this.isMobileDevice && !padActive && this.touchSprint);
    const horizSpeed = boost ? 16.0 : 11.5;

    _forward.set(-Math.sin(this.droneYaw), 0, -Math.cos(this.droneYaw));
    _right.set(Math.cos(this.droneYaw), 0, -Math.sin(this.droneYaw));
    _wishDir
      .set(0, 0, 0)
      .addScaledVector(_forward, moveFwd)
      .addScaledVector(_right, moveStrafe);
    if (_wishDir.lengthSq() > 1) _wishDir.normalize();

    const targetVx = _wishDir.x * horizSpeed;
    const targetVz = _wishDir.z * horizSpeed;
    const targetVy = moveVert * 7.8;

    const damp = 1 - Math.exp(-8.5 * dt);
    this.droneVel.x = THREE.MathUtils.lerp(this.droneVel.x, targetVx, damp);
    this.droneVel.y = THREE.MathUtils.lerp(this.droneVel.y, targetVy, damp);
    this.droneVel.z = THREE.MathUtils.lerp(this.droneVel.z, targetVz, damp);

    this.dronePos.addScaledVector(this.droneVel, dt);
    this.dronePos.x = THREE.MathUtils.clamp(this.dronePos.x, -PLAYABLE_HALF_EXTENT + 2, PLAYABLE_HALF_EXTENT - 2);
    this.dronePos.z = THREE.MathUtils.clamp(this.dronePos.z, -PLAYABLE_HALF_EXTENT + 2, PLAYABLE_HALF_EXTENT - 2);

    // Enforce short-range horizontal radio tether around operator
    const dx = this.dronePos.x - this.playerPos.x;
    const dz = this.dronePos.z - this.playerPos.z;
    const hDist = Math.hypot(dx, dz);
    if (hDist > this.droneMaxRange) {
      const k = this.droneMaxRange / hDist;
      this.dronePos.x = this.playerPos.x + dx * k;
      this.dronePos.z = this.playerPos.z + dz * k;
    }

    const groundFloor = groundHeightAt(this.dronePos.x, this.dronePos.z);
    const minAlt = groundFloor + 1.45;
    const maxAlt = groundFloor + 42.0;
    this.dronePos.y = THREE.MathUtils.clamp(this.dronePos.y, minAlt, maxAlt);

    const hoverY = Math.sin(this.elapsed * 4.5) * 0.04;
    this.droneGroup.position.set(this.dronePos.x, this.dronePos.y + hoverY, this.dronePos.z);
    this.droneGroup.rotation.y = this.droneYaw;
    this.droneGroup.rotation.x = THREE.MathUtils.clamp(-moveFwd * 0.14, -0.2, 0.2);
    this.droneGroup.rotation.z = THREE.MathUtils.clamp(-moveStrafe * 0.14, -0.2, 0.2);
    for (let r = 0; r < this.droneRotors.length; r++) {
      this.droneRotors[r].rotation.y += dt * (r % 2 === 0 ? 44 : -44);
    }

    // Attach camera to stabilized gimbal underneath drone
    this.camera.position.set(this.dronePos.x, this.dronePos.y + hoverY - 0.12, this.dronePos.z);
    _euler.set(this.dronePitch, this.droneYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
    if (Math.abs(this.camera.fov - 66) > 0.1) {
      this.camera.fov = 66;
      this.camera.updateProjectionMatrix();
    }

    this.weaponAnchor.visible = false;
    this.sunLight.position.set(this.dronePos.x + 42, 62, this.dronePos.z + 34);
    this.sunLight.target.position.set(this.dronePos.x, 0, this.dronePos.z);

    const distRiver = Math.abs(this.dronePos.z - riverCenterZ(this.dronePos.x));
    this.audio.updateAmbience(
      distRiver,
      this.weather.currentRainIntensity,
      this.weather.windVector.length()
    );

    // Optical target acquisition through bushes/thickets + refresh IFF/recon sprites
    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    let bestEnemyDist = 115;
    let bestEnemyRef: { key: string; pos: THREE.Vector3; name: string } | null = null;
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive) {
        s.iffSprite.visible = false;
        s.reconMarkSprite.visible = false;
        continue;
      }
      if (s.faction === this.playerFaction) {
        const d = s.position.distanceTo(this.camera.position);
        s.iffSprite.visible = d > 1.2 && d < 120;
        const sc = THREE.MathUtils.clamp(0.32 + d * 0.0085, 0.32, 0.85);
        s.iffSprite.scale.set(sc, sc, 1);
        s.reconMarkSprite.visible = false;
      } else {
        s.iffSprite.visible = false;
        this.updateSoldierReconSprite(s);
        const aimY = s.stance === 'prone' ? 0.34 : s.isCrouching ? 0.84 : 1.18;
        _tmpVec.set(s.position.x, s.position.y + aimY, s.position.z);
        _tmpVec2.subVectors(_tmpVec, this.camera.position);
        const distChest = _tmpVec2.length();
        if (distChest > 0.8 && distChest < bestEnemyDist) {
          const proj = _tmpVec2.dot(_forward);
          if (proj > 0) {
            const perpSq = Math.max(0, distChest * distChest - proj * proj);
            if (perpSq < 1.15 * 1.15 && hasDroneOpticLos(this.camera.position, _tmpVec, this.world.boxColliders)) {
              bestEnemyDist = distChest;
              bestEnemyRef = {
                key: `ai:${s.id}`,
                pos: s.position.clone(),
                name: `${s.rankTitle} ${s.name}`,
              };
            }
          }
        }
      }
    }

    this.aimingAtAlly = null;
    this.aimingAtEnemy = bestEnemyRef !== null;
    this.aimingEnemyDist = bestEnemyRef ? Math.round(bestEnemyDist) : null;
    this.aimedEnemyRef = bestEnemyRef;
    this.droneAimingEnemy = bestEnemyRef !== null;
    this.droneAimingEnemyName = bestEnemyRef?.name ?? null;
    this.droneAimingEnemyDist = this.aimingEnemyDist;
  }

  private updateSoldierReconSprite(s: SoldierEntity) {
    if (!s.alive || s.droneMarkedTimer <= 0 || this.killcam.active) {
      s.reconMarkSprite.visible = false;
      return;
    }
    const d = s.position.distanceTo(this.camera.position);
    if (d > 145) {
      s.reconMarkSprite.visible = false;
      return;
    }
    s.reconMarkSprite.visible = true;
    const isProne = s.stance === 'prone' || s.diveTimer > 0 || s.proneTimer > 0;
    s.reconMarkSprite.position.y = isProne ? 1.18 : s.isCrouching ? 1.72 : 2.18;
    const pulse = 1.0 + Math.sin(this.elapsed * 7.5 + s.id) * 0.1;
    const sc = THREE.MathUtils.clamp(0.42 + d * 0.011, 0.42, 1.35) * pulse;
    s.reconMarkSprite.scale.set(sc, sc, 1);
  }

  private computeBulletDropSvgUnits(distMeters: number, muzzleVel: number, airDrag: number): number {
    if (distMeters <= 2 || muzzleVel <= 1) return 0;
    const tFlight =
      airDrag > 0.00005
        ? (Math.exp(airDrag * distMeters) - 1) / (airDrag * muzzleVel)
        : distMeters / muzzleVel;
    const dropMeters = 0.5 * 9.81 * tFlight * tFlight;
    const dropRatio = dropMeters / distMeters;
    const halfFovRad = THREE.MathUtils.degToRad(Math.max(4, this.camera.fov) * 0.5);
    const normScreenY = dropRatio / Math.tan(halfFovRad);
    const vw = Math.max(1, this.container.clientWidth || window.innerWidth);
    const vh = Math.max(1, this.container.clientHeight || window.innerHeight);
    const scopeHalfRatio = (0.57 * Math.min(vw, vh)) / vh;
    const svgUnits = (normScreenY / Math.max(0.15, scopeHalfRatio)) * 100;
    return THREE.MathUtils.clamp(Number(svgUnits.toFixed(2)), 0, 86);
  }

  private updateFriendlyIff() {
    if (this.phase !== 'playing' || this.playerHp <= 0 || this.killcam.active) {
      this.aimingAtAlly = null;
      this.aimingAtEnemy = false;
      this.aimingEnemyDist = null;
      this.aimedEnemyRef = null;
      this.scopeRangeMeters = null;
      this.scopeDropSvgUnits = 0;
      this.scopeDropTicks = [];
      for (let i = 0; i < this.soldiers.length; i++) {
        this.soldiers[i].iffSprite.visible = false;
      }
      for (const rp of this.remotePlayers.values()) {
        rp.iffSprite.visible = false;
      }
      return;
    }

    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    let bestTarget: FriendlyFireTarget | null = null;
    let bestKey: string | null = null;
    let bestDist = 78;

    const isSniper = isSniperWeapon(this.currentWeaponId);
    const enemyDetectMax = isSniper && this.adsAlpha > 0.4 ? 235 : 165;
    let bestEnemyDist = enemyDetectMax;
    let enemySpotted = false;
    let bestEnemyRef: { key: string; pos: THREE.Vector3; name: string } | null = null;

    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive) {
        s.iffSprite.visible = false;
        s.reconMarkSprite.visible = false;
        continue;
      }

      const isAlly = s.faction === this.playerFaction;
      const isProne = s.stance === 'prone' || s.diveTimer > 0 || s.proneTimer > 0;

      if (isAlly) {
        s.reconMarkSprite.visible = false;
        const d = s.position.distanceTo(this.camera.position);
        const showMarker = d > 1.2 && d < 92;
        s.iffSprite.visible = showMarker;
        if (!showMarker) continue;

        const baseScale = THREE.MathUtils.clamp(0.28 + d * 0.0082, 0.28, 0.72);
        s.iffSprite.scale.set(baseScale, baseScale, 1);

        _tmpVec.set(s.position.x, s.position.y + (isProne ? 0.36 : s.isCrouching ? 0.86 : 1.22), s.position.z);
        _tmpVec2.subVectors(_tmpVec, this.camera.position);
        const distChest = _tmpVec2.length();
        if (distChest > 0.5 && distChest < bestDist) {
          const proj = _tmpVec2.dot(_forward);
          if (proj > 0) {
            const perpSq = Math.max(0, distChest * distChest - proj * proj);
            const hitRadius = isProne ? 0.42 : 0.54;
            if (perpSq < hitRadius * hitRadius) {
              const wallHit = intersectSegmentEnvironment(
                this.camera.position,
                _tmpVec,
                this.world.boxColliders,
                this.world.cylinderColliders
              );
              if (!wallHit) {
                bestDist = distChest;
                bestKey = `ai:${s.id}`;
                bestTarget = {
                  name: `${s.rankTitle} ${s.name}`,
                  distance: Math.round(distChest),
                  isHuman: false,
                };
              }
            }
          }
        }
      } else {
        s.iffSprite.visible = false;
        this.updateSoldierReconSprite(s);
        // Enemy reticle hover detection (ignores fog, smoke & grass; blocked only by solid walls/rock)
        _tmpVec.set(s.position.x, s.position.y + (isProne ? 0.34 : s.isCrouching ? 0.84 : 1.18), s.position.z);
        _tmpVec2.subVectors(_tmpVec, this.camera.position);
        const distChest = _tmpVec2.length();
        if (distChest > 0.6 && distChest < bestEnemyDist) {
          const proj = _tmpVec2.dot(_forward);
          if (proj > 0) {
            const perpSq = Math.max(0, distChest * distChest - proj * proj);
            const hitRadius = isProne ? 0.48 : 0.64;
            if (perpSq < hitRadius * hitRadius) {
              const wallHit = intersectSegmentEnvironment(
                this.camera.position,
                _tmpVec,
                this.world.boxColliders,
                this.world.cylinderColliders
              );
              if (!wallHit) {
                bestEnemyDist = distChest;
                enemySpotted = true;
                bestEnemyRef = {
                  key: `ai:${s.id}`,
                  pos: s.position.clone(),
                  name: `${s.rankTitle} ${s.name}`,
                };
              }
            }
          }
        }
      }
    }

    for (const rp of this.remotePlayers.values()) {
      if (!rp.alive) {
        rp.iffSprite.visible = false;
        continue;
      }
      const isAlly = rp.faction === this.playerFaction;
      const rpProne = rp.isProne || rp.isDiving;

      if (isAlly) {
        const d = rp.pos.distanceTo(this.camera.position);
        const showMarker = d > 1.2 && d < 110;
        rp.iffSprite.visible = showMarker;
        if (!showMarker) continue;

        const baseScale = THREE.MathUtils.clamp(0.3 + d * 0.0085, 0.3, 0.76);
        rp.iffSprite.scale.set(baseScale, baseScale, 1);

        _tmpVec.set(rp.pos.x, rp.pos.y + (rpProne ? 0.36 : rp.isCrouching ? 0.86 : 1.22), rp.pos.z);
        _tmpVec2.subVectors(_tmpVec, this.camera.position);
        const distChest = _tmpVec2.length();
        if (distChest > 0.5 && distChest < bestDist) {
          const proj = _tmpVec2.dot(_forward);
          if (proj > 0) {
            const perpSq = Math.max(0, distChest * distChest - proj * proj);
            if (perpSq < 0.56 * 0.56) {
              const wallHit = intersectSegmentEnvironment(
                this.camera.position,
                _tmpVec,
                this.world.boxColliders,
                this.world.cylinderColliders
              );
              if (!wallHit) {
                bestDist = distChest;
                bestKey = `remote:${rp.id}`;
                bestTarget = {
                  name: rp.name,
                  distance: Math.round(distChest),
                  isHuman: true,
                };
              }
            }
          }
        }
      } else {
        rp.iffSprite.visible = false;
        _tmpVec.set(rp.pos.x, rp.pos.y + (rpProne ? 0.34 : rp.isCrouching ? 0.84 : 1.18), rp.pos.z);
        _tmpVec2.subVectors(_tmpVec, this.camera.position);
        const distChest = _tmpVec2.length();
        if (distChest > 0.6 && distChest < bestEnemyDist) {
          const proj = _tmpVec2.dot(_forward);
          if (proj > 0) {
            const perpSq = Math.max(0, distChest * distChest - proj * proj);
            const hitRadius = rpProne ? 0.48 : 0.64;
            if (perpSq < hitRadius * hitRadius) {
              const wallHit = intersectSegmentEnvironment(
                this.camera.position,
                _tmpVec,
                this.world.boxColliders,
                this.world.cylinderColliders
              );
              if (!wallHit) {
                bestEnemyDist = distChest;
                enemySpotted = true;
                bestEnemyRef = {
                  key: `remote:${rp.id}`,
                  pos: rp.pos.clone(),
                  name: rp.name,
                };
              }
            }
          }
        }
      }
    }

    this.aimingAtAlly = bestTarget;
    this.aimingAtEnemy = !bestTarget && enemySpotted;
    this.aimingEnemyDist = this.aimingAtEnemy ? Math.round(bestEnemyDist) : null;
    this.aimedEnemyRef = this.aimingAtEnemy ? bestEnemyRef : null;

    // Laser rangefinder + calibrated vertical ballistic drop ticks when scoping a sniper rifle
    if (isSniper && this.adsAlpha > 0.45) {
      const spec = WEAPON_SPECS[this.currentWeaponId];
      let rangeM = this.aimingAtEnemy ? bestEnemyDist : 240;
      const rayEnd = _tmpVec.copy(this.camera.position).addScaledVector(_forward, rangeM);
      const envHit = intersectSegmentEnvironment(
        this.camera.position,
        rayEnd,
        this.world.boxColliders,
        this.world.cylinderColliders
      );
      if (envHit) {
        rangeM = Math.min(rangeM, envHit.point.distanceTo(this.camera.position));
      } else if (!this.aimingAtEnemy) {
        // March along center ray to sample ground elevation distance for hills/ridges
        for (let stepD = 12; stepD <= 230; stepD += 8) {
          const rx = this.camera.position.x + _forward.x * stepD;
          const ry = this.camera.position.y + _forward.y * stepD;
          const rz = this.camera.position.z + _forward.z * stepD;
          if (ry <= groundHeightAt(rx, rz)) {
            rangeM = stepD;
            break;
          }
        }
      }
      this.scopeRangeMeters = Math.round(rangeM);
      this.scopeDropSvgUnits = this.computeBulletDropSvgUnits(
        rangeM,
        spec.muzzleVelocity,
        spec.airDrag
      );
      this.scopeDropTicks = [75, 125, 175, 225].map((dist) => ({
        dist,
        ySvg: Number(
          (
            100 +
            this.computeBulletDropSvgUnits(dist, spec.muzzleVelocity, spec.airDrag)
          ).toFixed(2)
        ),
      }));
    } else {
      this.scopeRangeMeters = null;
      this.scopeDropSvgUnits = 0;
      this.scopeDropTicks = [];
    }

    // Highlight targeted ally IFF sprite in amber/red when under player's crosshair
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.iffSprite.visible) continue;
      const warn = bestKey === `ai:${s.id}`;
      if (s.iffWarnActive !== warn) {
        s.iffWarnActive = warn;
        const mat = s.iffSprite.material as THREE.SpriteMaterial;
        mat.map = getAllyIffTexture(warn);
        mat.opacity = warn ? 0.96 : 0.72;
        mat.needsUpdate = true;
      }
      if (warn) {
        s.iffSprite.scale.multiplyScalar(1.3);
      }
    }

    for (const rp of this.remotePlayers.values()) {
      if (!rp.iffSprite.visible) continue;
      const warn = bestKey === `remote:${rp.id}`;
      if (rp.iffWarnActive !== warn) {
        rp.iffWarnActive = warn;
        const mat = rp.iffSprite.material as THREE.SpriteMaterial;
        mat.map = getAllyIffTexture(warn);
        mat.opacity = warn ? 0.96 : 0.72;
        mat.needsUpdate = true;
      }
      if (warn) {
        rp.iffSprite.scale.multiplyScalar(1.3);
      }
    }
  }

  private recordKillcamFrame(dt: number) {
    const actors: RecordedActorPose[] = [];
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive) continue;
      actors.push({
        key: `ai:${s.id}`,
        alive: true,
        x: s.position.x,
        y: s.position.y,
        z: s.position.z,
        yaw: s.yaw,
        pitch: 0,
        faction: s.faction,
        rankLevel: s.rankLevel,
        weaponId: s.weaponId,
        isCrouching: s.stance === 'crouch' || s.isCrouching,
        isProne: s.stance === 'prone' || s.proneTimer > 0,
        isDiving: s.diveTimer > 0,
      });
    }
    for (const rp of this.remotePlayers.values()) {
      if (!rp.alive) continue;
      actors.push({
        key: `remote:${rp.id}`,
        alive: true,
        x: rp.pos.x,
        y: rp.pos.y,
        z: rp.pos.z,
        yaw: rp.yaw,
        pitch: rp.pitch,
        faction: rp.faction,
        rankLevel: rp.rankLevel,
        weaponId: rp.weaponId,
        isCrouching: rp.isCrouching,
        isProne: rp.isProne,
        isDiving: rp.isDiving,
      });
    }

    this.killcam.recordFrame(
      dt,
      this.elapsed,
      {
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.playerYaw,
        pitch: this.playerPitch,
        isCrouching: this.playerStance === 'crouch',
        isProne: this.playerStance === 'prone',
        isDiving: this.playerDiveTimer > 0,
      },
      actors
    );
  }

  private updateHealthRegenAndOrders(dt: number) {
    // 1. CoD MW4-inspired auto-regeneration (quicker recovery behind low cover / prone / smoke screen)
    const isCrouchingOrProne =
      this.playerStance === 'crouch' ||
      this.playerStance === 'prone' ||
      this.playerDiveTimer > 0;
    const inCoverOrSmoke = isCrouchingOrProne || this.isPlayerInSmokeCover();
    const regenDelay = inCoverOrSmoke ? 3.2 : 4.4;

    if (this.playerHp > 0 && this.playerHp < this.playerMaxHp) {
      if (this.timeSinceDamage >= regenDelay) {
        if (!this.isRegenerating) {
          this.isRegenerating = true;
          this.audio.playRegenRecover();
        }
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 24 * dt);
        if (this.playerHp >= this.playerMaxHp) {
          this.playerHp = this.playerMaxHp;
          this.isRegenerating = false;
        }
      } else {
        this.isRegenerating = false;
      }

      // Heavy cardiac heartbeat thump when wounded & waiting for cover regeneration
      if (this.playerHp <= 48 && !this.isRegenerating) {
        const severity = THREE.MathUtils.clamp((50 - this.playerHp) / 42, 0.25, 1);
        this.heartbeatTimer -= dt;
        if (this.heartbeatTimer <= 0) {
          this.heartbeatTimer = THREE.MathUtils.lerp(0.95, 0.48, severity);
          this.audio.playHeartbeatPulse(severity);
        }
      } else {
        this.heartbeatTimer = 0.2;
      }
    } else {
      this.isRegenerating = false;
      this.heartbeatTimer = 0;
    }

    // 2. Tom Clancy Command timers & 3D Cross-Com beacon animation
    if (this.orderXpCooldown > 0) this.orderXpCooldown = Math.max(0, this.orderXpCooldown - dt);
    if (this.activeOrderTimer > 0) {
      this.activeOrderTimer = Math.max(0, this.activeOrderTimer - dt);
      if (this.activeOrderTimer <= 0) this.activeOrder = null;
    }
    if (this.orderAckTimer > 0) {
      this.orderAckTimer -= dt;
      if (this.orderAckTimer <= 0 && this.pendingAckOrder) {
        const ackOrder = this.pendingAckOrder;
        this.pendingAckOrder = null;
        this.audio.playCommandChirp('ack');
        const ackLine = pickOrderVoice(this.playerFaction, ackOrder, 'ack');
        const dist = this.orderAckSpeakerPos.distanceTo(this.camera.position);
        this.speech.speak(ackLine, this.playerFaction, true, dist);
      }
    }

    // Track active single-subordinate ELIMINATE lock onto living enemy target
    if (this.activeEliminateSubId !== null) {
      const assignedSub = this.soldiers.find((s) => s.id === this.activeEliminateSubId);
      if (!assignedSub || !assignedSub.alive || assignedSub.tacticalOrder !== 'eliminate') {
        if (this.activeEliminateTargetName) {
          this.pushRadioBanner(`CIBLE NEUTRALISÉE : ${this.activeEliminateTargetName}`);
        }
        this.activeEliminateSubId = null;
        this.activeEliminateTargetKey = null;
        this.activeEliminateTargetName = null;
        this.orderMarkerTimer = 0;
        this.orderMarkerGroup.visible = false;
      } else if (this.activeEliminateTargetKey) {
        let tx = 0;
        let ty = 0;
        let tz = 0;
        let foundTarget = false;
        if (this.activeEliminateTargetKey.startsWith('ai:')) {
          const tid = Number(this.activeEliminateTargetKey.slice(3));
          const ts = this.soldiers.find((s) => s.id === tid && s.alive);
          if (ts) {
            tx = ts.position.x;
            ty = ts.position.y;
            tz = ts.position.z;
            foundTarget = true;
          }
        } else if (this.activeEliminateTargetKey.startsWith('remote:')) {
          const rid = this.activeEliminateTargetKey.slice(7);
          const rp = this.remotePlayers.get(rid);
          if (rp && rp.alive) {
            tx = rp.pos.x;
            ty = rp.pos.y;
            tz = rp.pos.z;
            foundTarget = true;
          }
        }
        if (foundTarget) {
          this.orderMarkerGroup.position.set(tx, ty + 0.06, tz);
          this.orderMarkerGroup.visible = true;
          this.orderMarkerTimer = Math.max(this.orderMarkerTimer, 0.25);
        }
      }
    }

    if (this.orderMarkerTimer > 0) {
      this.orderMarkerTimer = Math.max(0, this.orderMarkerTimer - dt);
      this.orderMarkerGroup.rotation.y += dt * 2.4;
      const chev = this.orderMarkerGroup.children[1];
      if (chev) chev.position.y = 1.15 + Math.sin(this.elapsed * 5.2) * 0.16;
      if (this.orderMarkerTimer <= 0) {
        this.orderMarkerGroup.visible = false;
      }
    }
  }

  private awardRankXp(amount: number) {
    this.playerRankXp += amount;
    const newRank = getRankFromXp(this.playerFaction, this.playerRankXp);
    if (newRank.level > this.playerRankLevel) {
      this.playerRankLevel = newRank.level;
      this.audio.playCommandChirp('promote');
      this.dualShock.rumble(0.25, 0.45, 220);
      this.pushRadioBanner(`PROMOTION : ${newRank.title.toUpperCase()} (GRADE ${newRank.level})`);
    }
  }

  private cycleTacticalOrder() {
    const idx = TACTICAL_ORDERS.findIndex((o) => o.id === this.selectedOrder);
    const next = TACTICAL_ORDERS[(idx + 1) % TACTICAL_ORDERS.length];
    this.selectedOrder = next.id;
    this.audio.playCommandChirp('ack');
  }

  private getAimedWorldPoint(maxDist = 65): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const end = this.camera.position.clone().addScaledVector(dir, maxDist);
    const hit = intersectSegmentEnvironment(
      this.camera.position,
      end,
      this.world.boxColliders,
      this.world.cylinderColliders
    );
    if (hit) {
      return hit.point.clone();
    }
    const horiz = new THREE.Vector3(dir.x, 0, dir.z);
    if (horiz.lengthSq() < 1e-4) {
      horiz.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    } else {
      horiz.normalize();
    }
    const fallback = this.playerPos.clone().addScaledVector(horiz, 22);
    fallback.y = groundHeightAt(fallback.x, fallback.z);
    return fallback;
  }

  private findNearestEnemyToPoint(pt: THREE.Vector3, maxRadius: number): { key: string; pos: THREE.Vector3; name: string } | null {
    let bestDistSq = maxRadius * maxRadius;
    let best: { key: string; pos: THREE.Vector3; name: string } | null = null;
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive || s.faction === this.playerFaction) continue;
      const dSq = s.position.distanceToSquared(pt);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = { key: `ai:${s.id}`, pos: s.position.clone(), name: `${s.rankTitle} ${s.name}` };
      }
    }
    for (const rp of this.remotePlayers.values()) {
      if (!rp.alive || rp.faction === this.playerFaction) continue;
      const dSq = rp.pos.distanceToSquared(pt);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = { key: `remote:${rp.id}`, pos: rp.pos.clone(), name: rp.name };
      }
    }
    return best;
  }

  private issueTacticalOrder(order: TacticalOrderId) {
    if (this.playerHp <= 0 || this.phase !== 'playing') return;

    const targetPt = order === 'follow' ? this.playerPos.clone() : this.getAimedWorldPoint(95);

    // Tom Clancy Cross-Com rule:
    // If aiming directly at an enemy and ordering target/location (or explicitly choosing ELIMINATE),
    // dispatch STRICTLY ONE subordinate to track & fire continuously until that enemy dies!
    const triggerSingleEliminate =
      order === 'eliminate' ||
      (this.aimedEnemyRef !== null && (order === 'move' || order === 'assault'));

    const effectiveOrder: TacticalOrderId = triggerSingleEliminate ? 'eliminate' : order;
    this.selectedOrder = effectiveOrder;
    this.audio.playCommandChirp('issue');

    const eligibleSubs: SoldierEntity[] = [];
    let seniorOfficer: SoldierEntity | null = null;
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive || s.faction !== this.playerFaction) continue;
      if (s.rankLevel < this.playerRankLevel) {
        eligibleSubs.push(s);
      } else if (s.rankLevel > this.playerRankLevel && !seniorOfficer) {
        seniorOfficer = s;
      }
    }

    if (eligibleSubs.length === 0) {
      if (seniorOfficer) {
        this.pendingAckOrder = null;
        this.orderAckTimer = 0;
        this.speech.speak(pickSeniorRefusalVoice(this.playerFaction), this.playerFaction, true, 12);
        this.pushRadioBanner(
          `GRADE INSUFFISANT — ${seniorOfficer.name} (${seniorOfficer.rankTitle}) EST SUPÉRIEUR`
        );
      } else {
        if (this.lanRoomCode) {
          this.lan.sendOrder(effectiveOrder, { x: targetPt.x, y: targetPt.y, z: targetPt.z });
        }
        this.pushRadioBanner('AUCUN SUBORDONNÉ DE GRADE INFÉRIEUR EN VIE');
      }
      return;
    }

    if (effectiveOrder === 'eliminate') {
      const lockedEnemy = this.aimedEnemyRef ?? this.findNearestEnemyToPoint(targetPt, 22);
      if (!lockedEnemy) {
        this.pushRadioBanner('AUCUN ENNEMI VERROUILLÉ SOUS LE VISEUR');
        return;
      }

      // Pick STRICTLY ONE subordinate (prefer free subordinate with best LOS/proximity to target)
      let chosenSub: SoldierEntity = eligibleSubs[0];
      let bestScore = -1e9;
      for (const sub of eligibleSubs) {
        let score = 0;
        if (sub.tacticalOrder !== 'eliminate') score += 100;
        const distToEnemy = sub.position.distanceTo(lockedEnemy.pos);
        score -= distToEnemy * 0.85;
        const fromEye = new THREE.Vector3(sub.position.x, sub.position.y + 1.25, sub.position.z);
        const toEye = new THREE.Vector3(lockedEnemy.pos.x, lockedEnemy.pos.y + 1.2, lockedEnemy.pos.z);
        if (hasLineOfSight(fromEye, toEye, this.world.boxColliders, this.world.cylinderColliders)) {
          score += 55;
        }
        if (score > bestScore) {
          bestScore = score;
          chosenSub = sub;
        }
      }

      chosenSub.tacticalOrder = 'eliminate';
      chosenSub.targetEnemyKey = lockedEnemy.key;
      chosenSub.orderTarget = lockedEnemy.pos.clone();
      chosenSub.orderTimer = 45.0;

      this.activeEliminateSubId = chosenSub.id;
      this.activeEliminateTargetKey = lockedEnemy.key;
      this.activeEliminateTargetName = lockedEnemy.name;

      const issueLine = pickOrderVoice(this.playerFaction, 'eliminate', 'issue');
      this.speech.speak(issueLine, this.playerFaction, true, 0);

      this.activeOrder = 'eliminate';
      this.activeOrderTimer = 14.0;
      this.pendingAckOrder = 'eliminate';
      this.orderAckTimer = 0.85;
      this.orderAckSpeakerPos.copy(chosenSub.position);

      this.orderMarkerGroup.children.forEach((ch) => {
        ((ch as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set('#ef4444');
      });
      this.orderMarkerGroup.position.set(lockedEnemy.pos.x, lockedEnemy.pos.y + 0.06, lockedEnemy.pos.z);
      this.orderMarkerGroup.visible = true;
      this.orderMarkerTimer = 6.0;

      if (this.orderXpCooldown <= 0) {
        this.awardRankXp(12);
        this.orderXpCooldown = 3.5;
      }
      this.dualShock.rumble(0.18, 0.34, 110);
      this.pushRadioBanner(
        `ORDRE [ÉLIMINER] → ${chosenSub.rankTitle} ${chosenSub.name} (1 SUBORDONNÉ → ${lockedEnemy.name})`
      );
      if (this.lanRoomCode) {
        this.lan.sendOrder('eliminate', { x: lockedEnemy.pos.x, y: lockedEnemy.pos.y, z: lockedEnemy.pos.z });
      }
      return;
    }

    // Squad Tactical Orders: ASSAUT / À COUVERT / DÉPLACEMENT / SUIVRE
    let subCount = 0;
    let firstSubPos: THREE.Vector3 | null = null;
    for (const s of eligibleSubs) {
      s.tacticalOrder = effectiveOrder;
      s.targetEnemyKey = null;
      s.orderTarget = targetPt.clone();
      s.orderTimer = effectiveOrder === 'cover' ? 16.0 : 12.0;
      s.coverPos = null;
      s.assignedCoverIdx = -1;
      if (effectiveOrder === 'assault' || effectiveOrder === 'move' || effectiveOrder === 'cover') {
        const ringAngle = subCount * 1.45;
        const ringRadius = effectiveOrder === 'cover' ? 3.2 + (subCount % 2) * 2.2 : 2.6 + (subCount % 2) * 1.8;
        const offsetPt = targetPt.clone();
        offsetPt.x += Math.cos(ringAngle) * ringRadius;
        offsetPt.z += Math.sin(ringAngle) * ringRadius;
        offsetPt.y = groundHeightAt(offsetPt.x, offsetPt.z);
        s.orderTarget = offsetPt;
        s.routeWaypoints = pickRouteToTarget(s.position, offsetPt);
        s.waypointIdx = 0;
      }
      subCount++;
      if (!firstSubPos) firstSubPos = s.position.clone();
    }

    const issueLine = pickOrderVoice(this.playerFaction, effectiveOrder, 'issue');
    this.speech.speak(issueLine, this.playerFaction, true, 0);

    const spec = TACTICAL_ORDERS.find((o) => o.id === effectiveOrder);
    const shortLabel = spec?.shortLabel ?? 'ESCORTE';
    this.activeOrder = effectiveOrder;
    this.activeOrderTimer = 12.0;
    this.pendingAckOrder = effectiveOrder;
    this.orderAckTimer = 1.0;
    if (firstSubPos) this.orderAckSpeakerPos.copy(firstSubPos);

    if (effectiveOrder !== 'follow') {
      const ringColor =
        effectiveOrder === 'cover'
          ? '#10b981'
          : this.playerFaction === 'army'
          ? '#38bdf8'
          : '#f59e0b';
      this.orderMarkerGroup.children.forEach((ch) => {
        ((ch as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(ringColor);
      });
      this.orderMarkerGroup.position.set(targetPt.x, targetPt.y + 0.04, targetPt.z);
      this.orderMarkerGroup.visible = true;
      this.orderMarkerTimer = 4.0;
    }

    if (this.orderXpCooldown <= 0) {
      this.awardRankXp(10);
      this.orderXpCooldown = 4.0;
    }
    this.dualShock.rumble(0.15, 0.28, 90);
    this.pushRadioBanner(
      `ORDRE [${shortLabel}] → ${subCount} SUBORDONNÉ${subCount > 1 ? 'S' : ''}`
    );
    if (this.lanRoomCode) {
      this.lan.sendOrder(effectiveOrder, { x: targetPt.x, y: targetPt.y, z: targetPt.z });
    }
  }

  private updateTitleCamera(dt: number) {
    // Scenic slow sweep over the misty river bridge while AI skirmishes below
    const angle = this.elapsed * 0.085;
    const cx = Math.sin(angle) * 34;
    const cz = Math.cos(angle) * 26;
    const cy = Math.max(groundHeightAt(cx, cz) + 7.5, 9.5);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 2.2, 0);
    if (this.camera.fov !== 64) {
      this.camera.fov = 64;
      this.camera.updateProjectionMatrix();
    }

    // Periodic distant battle audio ambiance on title/playing
    this.ambientSkirmishTimer -= dt;
    if (this.ambientSkirmishTimer <= 0) {
      this.ambientSkirmishTimer = 1.4 + Math.random() * 2.2;
    }
  }

  private updateAIAndRespawns(dt: number) {
    // Cleanup fallen soldiers after 6s
    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i];
      if (!s.alive && s.deathTimer > 6.5) {
        this.scene.remove(s.root);
        this.soldiers.splice(i, 1);
      }
    }

    const modeSpec = getCombatModeSpec(this.combatMode);
    const maxPerSide = this.lanRoomCode ? Math.min(4, modeSpec.maxSoldiersPerSide) : modeSpec.maxSoldiersPerSide;
    this.waveTimer += dt;
    if (this.waveTimer >= 2.2) {
      this.waveTimer = 0;
      const armyAlive = this.soldiers.filter((s) => s.alive && s.faction === 'army').length;
      const rebelAlive = this.soldiers.filter((s) => s.alive && s.faction === 'rebels').length;
      if (armyAlive < maxPerSide && this.armyTickets > armyAlive) {
        this.spawnFactionSoldier('army', this.nextSoldierId);
        this.respawnQueueArmy = Math.max(0, this.respawnQueueArmy - 1);
      }
      if (rebelAlive < maxPerSide && this.rebelTickets > rebelAlive) {
        this.spawnFactionSoldier('rebels', this.nextSoldierId);
        this.respawnQueueRebel = Math.max(0, this.respawnQueueRebel - 1);
      }
    }

    const activeSectors = this.world.sectors.filter((sec) => sec.active);

    const remoteTargets: RemoteCombatTarget[] = [];
    for (const rp of this.remotePlayers.values()) {
      remoteTargets.push({
        key: `remote:${rp.id}`,
        position: rp.pos,
        faction: rp.faction,
        alive: rp.alive,
        stance: rp.isProne || rp.isDiving ? 'prone' : rp.isCrouching ? 'crouch' : 'stand',
      });
    }

    for (let i = 0; i < this.soldiers.length; i++) {
      const soldier = this.soldiers[i];
      // Soldier burning DoT + volumetric ember/smoke trail (extinguished in river water)
      if (soldier.alive && soldier.burnTimer > 0) {
        const surf = getSurfaceTypeAt(soldier.position.x, soldier.position.y, soldier.position.z);
        if (surf === 'water') {
          soldier.burnTimer = 0;
          soldier.burnFxGroup.visible = false;
        } else {
          soldier.burnTimer = Math.max(0, soldier.burnTimer - dt);
          soldier.burnTickAccum += dt;
          if (soldier.burnTickAccum >= 0.11) {
            soldier.burnTickAccum = 0;
            this.spawnParticle(
              soldier.position.x + (Math.random() - 0.5) * 0.35,
              soldier.position.y + 0.95 + Math.random() * 0.35,
              soldier.position.z + (Math.random() - 0.5) * 0.35,
              (Math.random() - 0.5) * 0.7,
              1.6 + Math.random() * 1.2,
              (Math.random() - 0.5) * 0.7,
              Math.random() < 0.65 ? '#f97316' : '#3f3f46',
              0.32,
              0.92,
              0.42,
              -1.2
            );
          }
          const dps = 18 * dt;
          if (soldier.hp - dps <= 0) {
            this.damageSoldier(
              soldier,
              dps + 5,
              false,
              soldier.burnAttackerName,
              soldier.burnAttackerFaction,
              `${soldier.burnWeaponLabel} (Brûlure)`
            );
          } else {
            soldier.hp -= dps;
          }
        }
      }

      if (soldier.alive && soldier.hp < 55) {
        soldier.bleedTimer -= dt;
        if (soldier.bleedTimer <= 0) {
          soldier.bleedTimer = 0.42 + Math.random() * 0.25;
          this.spawnParticle(
            soldier.position.x + (Math.random() - 0.5) * 0.18,
            soldier.position.y + 1.05,
            soldier.position.z + (Math.random() - 0.5) * 0.18,
            (Math.random() - 0.5) * 0.4,
            0.2,
            (Math.random() - 0.5) * 0.4,
            '#8b1d1d',
            0.12,
            0.05,
            0.35,
            7
          );
        }
      }
      updateSoldierAI(
        soldier,
        this.soldiers,
        this.playerPos,
        this.phase === 'playing' && this.playerHp > 0,
        this.playerFaction,
        activeSectors,
        this.world.coverNodes,
        this.world.boxColliders,
        this.world.cylinderColliders,
        this.activeSmokes,
        dt,
        (s, muzzlePos, aimDir) => {
          const shooterKey = `ai:${s.id}`;
          const shooterName = `${s.rankTitle} ${s.name}`;
          const dist = muzzlePos.distanceTo(this.camera.position);
          if (isRocketWeapon(s.weaponId)) {
            this.spawnRocket(muzzlePos, aimDir, s.faction, false, shooterKey, shooterName, s.weaponId);
            if (this.phase === 'playing') this.audio.playGunshot(s.weaponId, dist);
          } else if (isFlameWeapon(s.weaponId)) {
            this.spawnFlameJet(muzzlePos, aimDir, s.weaponId, s.faction, false, shooterKey, shooterName);
            if (this.phase === 'playing') this.audio.playFlamethrowerBurst(dist);
          } else {
            this.spawnBullet(muzzlePos, aimDir, s.weaponId, s.faction, false, shooterKey, shooterName);
            if (this.phase === 'playing') this.audio.playGunshot(s.weaponId, dist);
          }
          this.recentCombatIntensity = Math.min(1, this.recentCombatIntensity + 0.08);
        },
        (s, category, urgent) => {
          this.emitSoldierComms(s.name, s.faction, s.position, category, urgent, s.voiceProfile);
        },
        (commander, order) => {
          if (this.phase === 'playing') {
            const dist = commander.position.distanceTo(this.camera.position);
            if (dist < 48) {
              const pSpec = MALE_VOICE_PROFILES[commander.voiceProfile];
              const voice = pickOrderVoice(commander.faction, order, 'issue', pSpec.style);
              this.speech.speak(voice, commander.faction, false, dist, commander.voiceProfile);
            }
          }
        },
        (s, surface) => {
          if (s.position.distanceToSquared(this.camera.position) > 58 * 58) return;
          if (surface === 'water') {
            this.envParticles.spawnWaterSplash(s.position.x, WATER_LEVEL + 0.03, s.position.z, 0.72);
          } else if (surface === 'mud' || surface === 'grass' || surface === 'rock') {
            this.envParticles.spawnGroundDust(
              s.position.x,
              s.position.y,
              s.position.z,
              0,
              0.28,
              0,
              1,
              0.4,
              surface === 'mud' ? '#926341' : '#857859'
            );
          }
        },
        remoteTargets
      );
    }
  }

  private syncHud() {
    const spec = WEAPON_SPECS[this.currentWeaponId];
    const modeSpec = getCombatModeSpec(this.combatMode);
    const inv = this.weaponInventory[this.currentWeaponId];
    const isMoving = Math.hypot(this.playerVel.x, this.playerVel.z) > 0.6;
    const spreadRad =
      THREE.MathUtils.lerp(spec.baseSpread, spec.adsSpread, this.adsAlpha) +
      (isMoving ? spec.moveSpreadPenalty * (1 - this.adsAlpha * 0.88) : 0) +
      this.spreadBloom * (this.adsAlpha > 0.65 ? 0.55 : 1.0);

    let dmgAngle: number | null = null;
    if (this.damageFlash > 0.05 && this.damageSourceWorld) {
      const dx = this.damageSourceWorld.x - this.playerPos.x;
      const dz = this.damageSourceWorld.z - this.playerPos.z;
      const worldAngle = Math.atan2(dx, -dz);
      dmgAngle = worldAngle + this.playerYaw;
    }

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);
    const rightX = Math.cos(this.playerYaw);
    const rightZ = -Math.sin(this.playerYaw);
    const shotIndicators: ShotIndicator[] = this.shotIndicators.map((item) => {
      if (item.key?.startsWith('ai:')) {
        const aiId = Number(item.key.slice(3));
        const shooter = this.soldiers.find((s) => s.id === aiId && s.alive);
        if (shooter) item.sourcePos.copy(shooter.position);
      } else if (item.key?.startsWith('remote:')) {
        const rid = item.key.slice(7);
        const rp = this.remotePlayers.get(rid);
        if (rp && rp.alive) item.sourcePos.copy(rp.pos);
      }
      const dx = item.sourcePos.x - this.playerPos.x;
      const dz = item.sourcePos.z - this.playerPos.z;
      const forwardDot = dx * fwdX + dz * fwdZ;
      const rightDot = dx * rightX + dz * rightZ;
      return {
        id: item.id,
        angleRad: Math.atan2(rightDot, forwardDot),
        intensity: Number(item.intensity.toFixed(2)),
        isHit: item.isHit,
      };
    });

    const deg = (((-this.playerYaw * 180) / Math.PI) % 360 + 360) % 360;

    // Minimap units: allies permanently visible, enemies within radar OR marked by Recon Drone
    const radarRange = modeSpec.enemyRadarRange;
    const ENEMY_PROXIMITY_SQ = radarRange * radarRange;
    const minimapUnits: MinimapUnit[] = [];
    let aiAllies = 0;
    let aiEnemies = 0;
    let subordinatesCount = 0;
    let droneMarkedCount = 0;
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive) continue;
      const isAlly = s.faction === this.playerFaction;
      if (isAlly) {
        aiAllies++;
        if (s.rankLevel < this.playerRankLevel) subordinatesCount++;
        minimapUnits.push({
          id: s.id,
          x: s.position.x,
          z: s.position.z,
          isAlly: true,
          isWounded: s.hp < 55,
          rankLevel: s.rankLevel,
        });
      } else {
        aiEnemies++;
        const isMarked = s.droneMarkedTimer > 0;
        if (isMarked) droneMarkedCount++;
        const dx = s.position.x - this.playerPos.x;
        const dz = s.position.z - this.playerPos.z;
        if (isMarked || dx * dx + dz * dz <= ENEMY_PROXIMITY_SQ) {
          minimapUnits.push({
            id: s.id,
            x: s.position.x,
            z: s.position.z,
            isAlly: false,
            isWounded: false,
            rankLevel: s.rankLevel,
            marked: isMarked,
          });
        }
      }
    }

    let rIdx = 9000;
    let remoteAllies = 0;
    let remoteEnemies = 0;
    for (const rp of this.remotePlayers.values()) {
      rIdx++;
      if (!rp.alive) continue;
      const isAlly = rp.faction === this.playerFaction;
      if (isAlly) remoteAllies++;
      else remoteEnemies++;
      const dx = rp.pos.x - this.playerPos.x;
      const dz = rp.pos.z - this.playerPos.z;
      if (isAlly || dx * dx + dz * dz <= ENEMY_PROXIMITY_SQ) {
        minimapUnits.push({
          id: rIdx,
          x: rp.pos.x,
          z: rp.pos.z,
          isAlly,
          isWounded: rp.hp < 45,
          rankLevel: rp.rankLevel,
          isHuman: true,
        });
      }
    }

    const currentZone = findZoneAt(this.playerPos.x, this.playerPos.z);
    const activeHeadingDeg = this.droneActive
      ? Math.round(((((-this.droneYaw * 180) / Math.PI) % 360) + 360) % 360)
      : Math.round(deg);
    const droneHorizDist = this.droneActive
      ? Math.round(Math.hypot(this.dronePos.x - this.playerPos.x, this.dronePos.z - this.playerPos.z))
      : 0;
    const droneAlt = this.droneActive
      ? Math.max(1, Math.round(this.dronePos.y - groundHeightAt(this.dronePos.x, this.dronePos.z)))
      : 0;

    this.onHudUpdate({
      phase: this.phase,
      combatMode: this.combatMode,
      combatModeName: modeSpec.name,
      currentZoneName: currentZone ? currentZone.name : 'Vallée du Kivu',
      totalZonesCount: KIVU_COMBAT_ZONES.length,
      armyScore: this.armyScore,
      rebelScore: this.rebelScore,
      scoreLimit: modeSpec.scoreLimit,
      matchTimeRemaining: Math.ceil(this.matchTimeRemaining),
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      voiceVolume: this.voiceVolume,
      playerFaction: this.playerFaction,
      hp: Math.ceil(this.playerHp),
      maxHp: this.playerMaxHp,
      stamina: Math.round(this.playerStamina),
      stance: this.playerStance,
      isCrouching: this.playerStance === 'crouch',
      isProne: this.playerStance === 'prone' || this.playerDiveTimer > 0,
      isSprinting: this.isSprinting,
      isTacSprinting: this.isTacSprinting,
      isSliding: this.playerSlideTimer > 0,
      isDiving: this.playerDiveTimer > 0,
      isInWater: this.playerGroundState.inWater,
      isAds: this.adsAlpha > 0.5,
      weaponId: this.currentWeaponId,
      weaponCategory: spec.category,
      weaponDelivery: spec.delivery,
      weaponName: spec.name,
      weaponCaliber: spec.caliber,
      fireMode: spec.fireMode,
      loadout: [...this.playerLoadout],
      sniperZoomIdx: this.sniperZoomIdx,
      sniperZoomLabel:
        isSniperWeapon(this.currentWeaponId) && spec.zoomLabels
          ? spec.zoomLabels[this.sniperZoomIdx]
          : null,
      isBurning: this.playerBurnTimer > 0 && this.playerHp > 0,
      burnIntensity: Math.min(1, this.playerBurnTimer / 2.2),
      ammoInMag: inv.mag,
      magSize: spec.magSize,
      ammoReserve: inv.reserve,
      grenades: this.grenades,
      smokeGrenades: this.smokeGrenades,
      activeSmokeCount: this.activeSmokes.length,
      inSmokeCover: this.isPlayerInSmokeCover(),
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / spec.reloadTime : 0,
      crosshairSpread: Math.round(spreadRad * 1400),
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerHeadshot: this.hitMarkerHeadshot,
      damageFlash: this.damageFlash,
      damageDirectionAngle: dmgAngle,
      shotIndicators,
      timeSinceDamage: this.timeSinceDamage,
      isRegenerating: this.isRegenerating,
      armyTickets: this.armyTickets,
      rebelTickets: this.rebelTickets,
      maxTickets: modeSpec.maxTickets,
      sectors: this.world.sectors.map((s) => ({
        id: s.id,
        name: s.name,
        x: s.position.x,
        z: s.position.z,
        owner: s.owner,
        progress: s.progress,
        active: s.active,
      })),
      playerKills: this.playerKills,
      playerDeaths: this.playerDeaths,
      radioBanner: this.radioBanner,
      killFeed: [...this.killFeed],
      commsFeed: [...this.commsFeed],
      pointerLocked: this.pointerLocked,
      respawnTimer: Math.max(0, this.playerRespawnTimer),
      aliveAllies: aiAllies + remoteAllies,
      aliveEnemies: aiEnemies + remoteEnemies,
      compassHeadingDeg: activeHeadingDeg,
      weather: this.weather.currentWeather,
      weatherLabel: WEATHER_PRESETS[this.weather.currentWeather].label,
      gamepadConnected: this.padState?.connected ?? false,
      gamepadName: this.padState?.name ?? null,
      gamepadSettings: { ...this.gamepadSettings },
      gamepadSticks: this.padState?.rawAxes ? { ...this.padState.rawAxes } : { lx: 0, ly: 0, rx: 0, ry: 0 },
      isMobileDevice: this.isMobileDevice,
      isPortrait: this.isPortrait,
      isFullscreen: this.isFullscreen,
      isWounded: this.playerHp > 0 && this.playerHp <= 45,
      rankLevel: this.playerRankLevel,
      rankTitle: getRankFromXp(this.playerFaction, this.playerRankXp).title,
      rankAbbr: getRankFromXp(this.playerFaction, this.playerRankXp).abbr,
      rankXp: this.playerRankXp,
      nextRankXp: getNextRankThreshold(this.playerFaction, this.playerRankLevel),
      selectedOrder: this.selectedOrder,
      activeOrder: this.activeOrder,
      activeOrderTimer: this.activeOrderTimer,
      subordinatesCount,
      totalAlliesCount: aiAllies + remoteAllies,
      statusPanelOpen: this.statusPanelOpen,
      commandPanelOpen: this.commandPanelOpen,
      droneActive: this.droneActive,
      droneBattery: Math.round(this.droneBattery),
      droneRangeMeters: droneHorizDist,
      droneMaxRange: this.droneMaxRange,
      droneAltitudeMeters: droneAlt,
      droneMarkedCount,
      droneAimingEnemy: this.droneAimingEnemy,
      droneAimingEnemyName: this.droneAimingEnemyName,
      droneAimingEnemyDist: this.droneAimingEnemyDist,
      playerPosX: this.droneActive ? this.dronePos.x : this.playerPos.x,
      playerPosZ: this.droneActive ? this.dronePos.z : this.playerPos.z,
      playerYaw: this.droneActive ? this.droneYaw : this.playerYaw,
      orderMarkerPos: this.orderMarkerGroup?.visible
        ? { x: this.orderMarkerGroup.position.x, z: this.orderMarkerGroup.position.z }
        : null,
      minimapUnits,
      minimapEnemyRange: radarRange,
      lanConnected: this.lan.connected,
      lanRoomCode: this.lanRoomCode,
      lanPlayerName: this.lanPlayerName,
      lanPlayerCount: this.lanRoomCode ? this.remotePlayers.size + 1 : 0,
      lanIps: this.lanIps,
      lanPort: this.lanPort,
      lanRooms: this.lanRooms,
      lanPeers: this.lanPeers,
      lanUdpActive: this.lanUdpActive,
      lanUdpPort: this.lanUdpPort,
      aimingAtAlly: this.aimingAtAlly,
      aimingAtEnemy: this.aimingAtEnemy,
      aimingEnemyDist: this.aimingEnemyDist,
      aimingEnemyName: this.aimedEnemyRef?.name ?? null,
      activeEliminateTargetName: this.activeEliminateTargetName,
      scopeRangeMeters: this.scopeRangeMeters,
      scopeDropSvgUnits: this.scopeDropSvgUnits,
      scopeDropTicks: this.scopeDropTicks,
      friendlyFireWarnTimer: this.friendlyFireWarnTimer,
      killcam: this.killcamHudInfo ? { ...this.killcamHudInfo } : null,
    });
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      this.elapsed += dt;

      // Poll DualShock controller every frame (works in menus & gameplay!)
      this.padState = this.dualShock.poll();
      if (this.isGamepadActive()) {
        if (this.armoryOpen) {
          if (this.padState.menuEvents.length > 0) {
            for (const ev of this.padState.menuEvents) {
              this.menuNavListeners.forEach((cb) => cb(ev));
            }
          }
        } else if (this.phase === 'playing') {
          if (this.padState.pauseJustPressed) {
            this.phase = 'paused';
            this.exitPointerLock();
            this.syncHud();
          }
        } else if (this.phase === 'paused' || this.phase === 'victory' || this.phase === 'defeat') {
          if (this.phase === 'paused' && this.padState.pauseJustPressed) {
            this.resumeGame();
          } else if (this.padState.menuEvents.length > 0) {
            for (const ev of this.padState.menuEvents) {
              this.menuNavListeners.forEach((cb) => cb(ev));
            }
          }
        } else if (this.phase === 'title') {
          if (this.padState.switchCampJustPressed) {
            this.playerFaction = this.playerFaction === 'army' ? 'rebels' : 'army';
            this.syncHud();
          }
          if (this.padState.confirmJustPressed) {
            this.startGame(this.playerFaction);
          }
        }
      }

      if (this.phase !== 'paused') {
        this.terrainVis.updateWater(this.elapsed);
        this.world.updateWorld(this.elapsed, this.world.sectors, this.weather.windVector.length());
        for (let i = this.activeSmokes.length - 1; i >= 0; i--) {
          this.activeSmokes[i].remaining -= dt;
          if (this.activeSmokes[i].remaining <= 0) {
            this.activeSmokes.splice(i, 1);
          }
        }
        this.envParticles.updateSmokeClouds(this.activeSmokes, dt, this.weather.windVector);
        this.envParticles.update(
          dt,
          this.elapsed,
          this.camera.position,
          this.weather.windVector,
          this.weather.currentRainIntensity
        );
        this.weather.update(
          dt,
          this.camera.position,
          this.scene,
          this.renderer,
          this.sunLight,
          this.hemiLight,
          (intensity) => {
            this.audio.playThunder(intensity);
            this.dualShock.rumble(0.25, 0.65 * intensity, 260);
          },
          undefined,
          Boolean(this.lanRoomCode)
        );

        this.recentCombatIntensity = Math.max(0, this.recentCombatIntensity - dt * 0.14);
        this.audio.updateMusic(dt, this.recentCombatIntensity, this.phase === 'playing');

        // Animate drifting morning river mist
        for (const sp of this.mistSprites) {
          const bx = sp.userData.baseX as number;
          const ph = sp.userData.phase as number;
          sp.position.x = bx + Math.sin(this.elapsed * 0.14 + ph) * 8;
        }

        if (this.phase === 'title') {
          this.updateTitleCamera(dt);
          this.updateAIAndRespawns(dt);
          this.updateRemotePlayers(dt);
          this.updateBullets(dt);
          this.updateRockets(dt);
          this.updateFlameJets(dt);
          this.updateParticlesAndCasings(dt);
          this.updateSectorsAndTickets(dt);
        } else if (this.phase === 'playing') {
          this.updatePlayer(dt);
          this.updateAIAndRespawns(dt);
          this.updateRemotePlayers(dt);
          this.updateBullets(dt);
          this.updateRockets(dt);
          this.updateFlameJets(dt);
          this.updateGrenades(dt);
          this.updateParticlesAndCasings(dt);
          this.updateSectorsAndTickets(dt);

          if (this.playerHp > 0 && !this.killcam.active) {
            this.recordKillcamFrame(dt);
          } else if (this.playerHp <= 0) {
            if (this.pendingKillcamMeta !== null) {
              this.killcamDelayTimer -= dt;
              const floorY = groundHeightAt(this.playerPos.x, this.playerPos.z);
              this.camera.position.y = Math.max(floorY + 0.35, this.camera.position.y - dt * 1.45);
              this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, 0.28, dt * 6);
              if (this.killcamDelayTimer <= 0) {
                const meta = this.pendingKillcamMeta;
                this.pendingKillcamMeta = null;
                for (let i = 0; i < this.soldiers.length; i++) {
                  this.soldiers[i].root.visible = false;
                  this.soldiers[i].iffSprite.visible = false;
                  this.soldiers[i].reconMarkSprite.visible = false;
                }
                for (const rp of this.remotePlayers.values()) {
                  rp.root.visible = false;
                  rp.iffSprite.visible = false;
                }
                this.killcam.startReplay(meta);
                this.audio.playKillcamSting(true);
                if (this.killcamHudInfo) {
                  this.killcamHudInfo.active = true;
                  this.killcamHudInfo.remainingSec = KILLCAM_DURATION;
                }
              }
            } else if (this.killcam.active) {
              const running = this.killcam.updateReplay(
                dt,
                this.camera,
                this.world.boxColliders,
                this.world.cylinderColliders
              );
              if (running) {
                if (this.killcamHudInfo) {
                  this.killcamHudInfo.active = true;
                  this.killcamHudInfo.remainingSec = Math.max(0, KILLCAM_DURATION - this.killcam.elapsed);
                }
              } else {
                this.audio.playKillcamSting(false);
                this.stopAndCleanupKillcam();
                this.respawnPlayer(this.playerFaction);
              }
            }
          }
        } else {
          // Victory / defeat slow drift
          this.updateRemotePlayers(dt);
          this.updateParticlesAndCasings(dt);
        }

        if (this.hitMarkerTimer > 0) this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
        if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 1.4);
        if (this.shotIndicators.length > 0) {
          for (let i = this.shotIndicators.length - 1; i >= 0; i--) {
            const ind = this.shotIndicators[i];
            ind.intensity -= dt * (ind.isHit ? 0.68 : 1.05);
            if (ind.intensity <= 0) {
              this.shotIndicators.splice(i, 1);
            }
          }
        }
        if (this.globalCommsTimer > 0) this.globalCommsTimer = Math.max(0, this.globalCommsTimer - dt);
        if (this.commsFeed.length > 0) {
          this.commsFeed = this.commsFeed.filter((c) => this.elapsed - c.timestamp < 6.5);
        }
        if (this.radioBannerTimer > 0) {
          this.radioBannerTimer -= dt;
          if (this.radioBannerTimer <= 0) this.radioBanner = null;
        }
      }

      this.renderer.render(this.scene, this.camera);

      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.085) {
        this.hudSyncTimer = 0;
        this.syncHud();
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointerdown', this.onMobileFirstGesture, { capture: true });
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);

    this.exitPointerLock();
    this.stopAndCleanupKillcam();
    this.lan.dispose();
    this.clearRemotePlayers();
    this.speech.dispose();
    this.dualShock.dispose();
    this.audio.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
