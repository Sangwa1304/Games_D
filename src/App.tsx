/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, RotateCw } from 'lucide-react';
import { ArmoryModal } from './components/ArmoryModal';
import { PauseEndModal } from './components/PauseEndModal';
import { TacticalHud } from './components/TacticalHud';
import { TitleScreen } from './components/TitleScreen';
import { GameEngine } from './game/GameEngine';
import { DEFAULT_GAMEPAD_SETTINGS } from './game/gamepad';
import { CombatModeId, Faction, GamepadMenuEvent, HudSnapshot } from './game/types';
import { DEFAULT_ARMY_LOADOUT } from './game/weapons';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  combatMode: 'conquest',
  combatModeName: 'Conquête Totale',
  currentZoneName: 'QG Armée Sud',
  totalZonesCount: 24,
  armyScore: 0,
  rebelScore: 0,
  scoreLimit: 160,
  matchTimeRemaining: 600,
  sfxVolume: 0.8,
  musicVolume: 0.45,
  voiceVolume: 0.9,
  playerFaction: 'army',
  hp: 100,
  maxHp: 100,
  stamina: 100,
  stance: 'stand',
  isCrouching: false,
  isProne: false,
  isSprinting: false,
  isTacSprinting: false,
  isSliding: false,
  isDiving: false,
  isInWater: false,
  isAds: false,
  weaponId: 'carbine',
  weaponCategory: 'assault',
  weaponDelivery: 'bullet',
  weaponName: 'Carabine M4A1 Tactique',
  weaponCaliber: '5.56×45mm',
  fireMode: 'AUTO',
  loadout: [...DEFAULT_ARMY_LOADOUT],
  sniperZoomIdx: 0,
  sniperZoomLabel: null,
  isBurning: false,
  burnIntensity: 0,
  ammoInMag: 30,
  magSize: 30,
  ammoReserve: 180,
  grenades: 3,
  smokeGrenades: 2,
  activeSmokeCount: 0,
  inSmokeCover: false,
  isReloading: false,
  reloadProgress: 0,
  crosshairSpread: 14,
  hitMarkerTimer: 0,
  hitMarkerHeadshot: false,
  damageFlash: 0,
  damageDirectionAngle: null,
  shotIndicators: [],
  timeSinceDamage: 10,
  isRegenerating: false,
  aimingAtAlly: null,
  aimingAtEnemy: false,
  aimingEnemyDist: null,
  aimingEnemyName: null,
  activeEliminateTargetName: null,
  scopeRangeMeters: null,
  scopeDropSvgUnits: 0,
  scopeDropTicks: [],
  friendlyFireWarnTimer: 0,
  killcam: null,
  armyTickets: 160,
  rebelTickets: 160,
  maxTickets: 160,
  sectors: [
    { id: 'A', name: 'Marché du Carrefour', x: 12, z: 52, owner: 'army', progress: 100, active: true },
    { id: 'B', name: 'Pont Suspendu Ouest', x: -76, z: 0, owner: 'neutral', progress: 0, active: true },
    { id: 'C', name: 'Pont Central en Bois', x: 0, z: 0, owner: 'neutral', progress: 0, active: true },
    { id: 'D', name: 'Ponton Tactique Est', x: 78, z: 0, owner: 'neutral', progress: 0, active: true },
    { id: 'E', name: 'Entrepôt de Munitions', x: -16, z: -74, owner: 'rebels', progress: -100, active: true },
  ],
  playerKills: 0,
  playerDeaths: 0,
  radioBanner: null,
  killFeed: [],
  commsFeed: [],
  pointerLocked: false,
  respawnTimer: 0,
  aliveAllies: 7,
  aliveEnemies: 7,
  compassHeadingDeg: 0,
  weather: 'mist',
  weatherLabel: 'Brume du Kivu',
  gamepadConnected: false,
  gamepadName: null,
  gamepadSettings: { ...DEFAULT_GAMEPAD_SETTINGS },
  gamepadSticks: { lx: 0, ly: 0, rx: 0, ry: 0 },
  isWounded: false,
  rankLevel: 3,
  rankTitle: 'Sergent',
  rankAbbr: 'Sgt.',
  rankXp: 120,
  nextRankXp: 220,
  selectedOrder: 'assault',
  activeOrder: null,
  activeOrderTimer: 0,
  subordinatesCount: 4,
  totalAlliesCount: 7,
  statusPanelOpen: false,
  commandPanelOpen: false,
  playerPosX: -10,
  playerPosZ: 102,
  playerYaw: 0,
  orderMarkerPos: null,
  minimapUnits: [],
  minimapEnemyRange: 32,
  droneActive: false,
  droneBattery: 100,
  droneRangeMeters: 0,
  droneMaxRange: 95,
  droneAltitudeMeters: 0,
  droneMarkedCount: 0,
  droneAimingEnemy: false,
  droneAimingEnemyName: null,
  droneAimingEnemyDist: null,
  lanConnected: false,
  lanRoomCode: null,
  lanPlayerName: 'Soldat-Kivu',
  lanPlayerCount: 0,
  lanIps: [],
  lanPort: 3000,
  lanRooms: [],
  lanPeers: [],
  lanUdpActive: false,
  lanUdpPort: 41234,
  isMobileDevice: false,
  isPortrait: typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  isFullscreen: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedFaction, setSelectedFaction] = useState<Faction>('army');
  const [selectedMode, setSelectedMode] = useState<CombatModeId>('conquest');
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('kivu_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { muted?: boolean };
        if (typeof parsed.muted === 'boolean') return parsed.muted;
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [sensitivity, setSensitivity] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('kivu_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { sensitivity?: number };
        if (typeof parsed.sensitivity === 'number') {
          return Math.min(0.0045, Math.max(0.0008, parsed.sensitivity));
        }
      }
    } catch {
      // ignore
    }
    return 0.0021;
  });
  const [armoryOpen, setArmoryOpen] = useState<boolean>(false);

  const [initialRoomCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
    return r || 'KIVU-LAN';
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new GameEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    setSelectedFaction(hud.playerFaction);
  }, [hud.playerFaction]);

  useEffect(() => {
    setSelectedMode(hud.combatMode);
  }, [hud.combatMode]);

  const gamepadNavActive = hud.gamepadConnected && hud.gamepadSettings.enabled;

  const subscribeGamepadNav = useCallback((cb: (ev: GamepadMenuEvent) => void) => {
    if (!engineRef.current) return () => {};
    return engineRef.current.onGamepadMenuEvent(cb);
  }, []);

  useEffect(() => {
    engineRef.current?.setArmoryOpen(armoryOpen);
  }, [armoryOpen]);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const inSettingsOrArmory =
        armoryOpen || hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'defeat';
      if (inSettingsOrArmory && gamepadNavActive) {
        return;
      }

      if (e.code === 'Enter' && hud.phase === 'title' && !armoryOpen) {
        engineRef.current?.startGame(selectedFaction, selectedMode);
      } else if (e.code === 'KeyB' && !e.repeat) {
        if (armoryOpen) {
          setArmoryOpen(false);
        } else {
          if (hud.phase === 'playing') {
            engineRef.current?.pauseForArmory();
          }
          setArmoryOpen(true);
        }
      } else if (e.code === 'Escape' && armoryOpen) {
        setArmoryOpen(false);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [hud.phase, selectedFaction, selectedMode, armoryOpen, gamepadNavActive]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  const handleSensitivity = (val: number) => {
    setSensitivity(val);
    engineRef.current?.setSensitivity(val);
  };

  return (
    <div className="relative w-[100dvw] h-[100dvh] overflow-hidden bg-[#0d1310]">
      {/* Dedicated isolated WebGL canvas mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {hud.phase === 'title' && (
        <TitleScreen
          selectedFaction={selectedFaction}
          onSelectFaction={(f) => {
            setSelectedFaction(f);
            engineRef.current?.setPlayerFaction(f);
            engineRef.current?.updateLanPresence(hud.lanPlayerName, f);
          }}
          selectedMode={selectedMode}
          onSelectMode={(m) => {
            setSelectedMode(m);
            engineRef.current?.setCombatMode(m);
          }}
          loadout={hud.loadout}
          onOpenArmory={() => setArmoryOpen(true)}
          totalZonesCount={hud.totalZonesCount}
          gamepadConnected={hud.gamepadConnected}
          isMobileDevice={hud.isMobileDevice}
          isFullscreen={hud.isFullscreen}
          onToggleFullscreen={() => engineRef.current?.toggleFullscreen()}
          lanConnected={hud.lanConnected}
          lanIps={hud.lanIps}
          lanPort={hud.lanPort}
          lanRooms={hud.lanRooms}
          lanPeers={hud.lanPeers}
          lanUdpActive={hud.lanUdpActive}
          lanUdpPort={hud.lanUdpPort}
          initialRoomCode={initialRoomCode}
          onPresenceChange={(name) => {
            engineRef.current?.updateLanPresence(name, selectedFaction);
          }}
          onRefreshRooms={() => engineRef.current?.refreshLanRooms()}
          onStartSolo={() => engineRef.current?.startGame(selectedFaction, selectedMode)}
          onJoinLan={(roomCode, playerName, targetHost) =>
            engineRef.current?.joinLanMatch(
              roomCode,
              playerName,
              selectedFaction,
              selectedMode,
              targetHost
            )
          }
        />
      )}

      {hud.phase === 'playing' && (
        <TacticalHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onRequestLock={() => engineRef.current?.requestPointerLock()}
          onToggleFullscreen={() => engineRef.current?.toggleFullscreen()}
          onSkipKillcam={() => engineRef.current?.skipKillcam()}
          onTouchMove={(x, y, sprint) => engineRef.current?.setTouchMove(x, y, sprint)}
          onTouchLookDelta={(dx, dy) => engineRef.current?.addTouchLookDelta(dx, dy)}
          onTouchFire={(held) => engineRef.current?.setTouchFire(held)}
          onTouchAds={(active) => engineRef.current?.setTouchAds(active)}
          onTouchAction={(action) => engineRef.current?.triggerTouchAction(action)}
        />
      )}

      {(hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'defeat') && (
        <PauseEndModal
          hud={hud}
          muted={muted}
          sensitivity={sensitivity}
          armoryOpen={armoryOpen}
          subscribeGamepadNav={subscribeGamepadNav}
          onGamepadRumble={(strong) => engineRef.current?.rumbleMenu(strong)}
          onToggleMute={handleToggleMute}
          onChangeSensitivity={handleSensitivity}
          onChangeSfxVolume={(v) => engineRef.current?.setSfxVolume(v)}
          onChangeMusicVolume={(v) => engineRef.current?.setMusicVolume(v)}
          onChangeVoiceVolume={(v) => engineRef.current?.setVoiceVolume(v)}
          onTestVoice={() => engineRef.current?.playTestVoiceVolume()}
          onChangeGamepadSettings={(partial) => engineRef.current?.setGamepadSettings(partial)}
          onResetGamepadSettings={() => engineRef.current?.resetGamepadSettings()}
          onOpenArmory={() => setArmoryOpen(true)}
          onResume={() => engineRef.current?.resumeGame()}
          onRestart={() => engineRef.current?.startGame(hud.playerFaction, hud.combatMode)}
          onLeaveLan={() => engineRef.current?.leaveLanMatch()}
          onReturnToTitle={() => engineRef.current?.returnToTitle()}
        />
      )}

      {armoryOpen && (
        <ArmoryModal
          loadout={hud.loadout}
          faction={hud.playerFaction}
          gamepadNavActive={gamepadNavActive}
          subscribeGamepadNav={subscribeGamepadNav}
          onGamepadRumble={(strong) => engineRef.current?.rumbleMenu(strong)}
          onSaveLoadout={(next) => engineRef.current?.setPlayerLoadout(next)}
          onClose={() => setArmoryOpen(false)}
        />
      )}

      {/* Mandatory Android Landscape & Direct Fullscreen Expansion Gate */}
      {hud.isMobileDevice && hud.isPortrait && (
        <div className="fixed inset-0 z-50 bg-[#090e0b]/98 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-sm w-full rounded-xl bg-[#101813] border border-amber-500/70 p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-950/80 border border-amber-500/70 flex items-center justify-center text-amber-300">
              <RotateCw className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-black uppercase tracking-wider text-stone-100">
                Écran Horizontal Obligatoire
              </h2>
              <p className="text-xs text-stone-300 leading-relaxed">
                Kivu : Ligne de Front se joue uniquement en mode horizontal plein écran sur Android afin d&apos;afficher toute la scène et l&apos;armurerie.
              </p>
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.requestFullscreenImmersive()}
              className="w-full py-3 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-95 text-stone-950 font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-lg"
            >
              <Maximize2 className="w-4 h-4" />
              Agrandir en Horizontal
            </button>
            <p className="text-[10.5px] text-stone-400">
              Pivotez également votre téléphone à l&apos;horizontale si la rotation système est verrouillée.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
