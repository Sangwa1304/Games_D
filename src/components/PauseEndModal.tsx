import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Gamepad2,
  Lock,
  Map as MapIcon,
  Mic,
  Music,
  RotateCcw,
  Shield,
  Sliders,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { TACTICAL_ORDERS } from '../game/ranks';
import {
  GamepadMenuEvent,
  GamepadSettings,
  HudSnapshot,
  StickCurveType,
} from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';
import { Minimap } from './Minimap';

interface PauseEndModalProps {
  hud: HudSnapshot;
  muted: boolean;
  sensitivity: number;
  armoryOpen: boolean;
  subscribeGamepadNav: (cb: (ev: GamepadMenuEvent) => void) => () => void;
  onGamepadRumble?: (strong?: boolean) => void;
  onToggleMute: () => void;
  onChangeSensitivity: (val: number) => void;
  onChangeSfxVolume: (val: number) => void;
  onChangeMusicVolume: (val: number) => void;
  onChangeVoiceVolume: (val: number) => void;
  onTestVoice: () => void;
  onChangeGamepadSettings: (partial: Partial<GamepadSettings>) => void;
  onResetGamepadSettings: () => void;
  onOpenArmory: () => void;
  onResume: () => void;
  onRestart: () => void;
  onLeaveLan: () => void;
  onReturnToTitle: () => void;
}

const CURVE_OPTIONS: Array<{ id: StickCurveType; label: string; hint: string }> = [
  { id: 'dynamic', label: 'Dynamique', hint: 'Rapide & fluide' },
  { id: 'linear', label: 'Linéaire', hint: 'Direct 1:1' },
  { id: 'precision', label: 'Précision', hint: 'Souple au centre' },
];

type SettingsFocusId =
  | 'tab-switcher'
  | 'gamepad-enabled'
  | 'mute'
  | 'voice-test'
  | 'voice-vol'
  | 'sfx-vol'
  | 'music-vol'
  | 'mouse-sens'
  | 'reset-gamepad'
  | 'look-sens'
  | 'ads-mult'
  | 'move-dz'
  | 'look-dz'
  | 'stick-curve'
  | 'auto-sprint'
  | 'invert-y'
  | 'vibration'
  | 'armory'
  | 'resume'
  | 'restart'
  | 'leave-or-title';

export const PauseEndModal: React.FC<PauseEndModalProps> = ({
  hud,
  muted,
  sensitivity,
  armoryOpen,
  subscribeGamepadNav,
  onGamepadRumble,
  onToggleMute,
  onChangeSensitivity,
  onChangeSfxVolume,
  onChangeMusicVolume,
  onChangeVoiceVolume,
  onTestVoice,
  onChangeGamepadSettings,
  onResetGamepadSettings,
  onOpenArmory,
  onResume,
  onRestart,
  onLeaveLan,
  onReturnToTitle,
}) => {
  const gp = hud.gamepadSettings;
  const gamepadNavActive = hud.gamepadConnected && gp.enabled;

  const [settingsTab, setSettingsTab] = useState<'audio' | 'gamepad' | 'map'>(() =>
    gamepadNavActive ? 'gamepad' : hud.isMobileDevice ? 'map' : 'audio'
  );
  const [focusedId, setFocusedId] = useState<SettingsFocusId>('look-sens');

  const itemRefs = useRef<Partial<Record<SettingsFocusId, HTMLElement | null>>>({});
  const setItemRef = useCallback(
    (id: SettingsFocusId) => (el: HTMLElement | null) => {
      itemRefs.current[id] = el;
    },
    []
  );

  const isEnd = hud.phase === 'victory' || hud.phase === 'defeat';

  const focusOrder = useMemo<SettingsFocusId[]>(() => {
    const items: SettingsFocusId[] = ['tab-switcher'];
    if (hud.gamepadConnected) {
      items.push('gamepad-enabled');
    }
    if (settingsTab === 'audio') {
      items.push('mute', 'voice-test', 'voice-vol', 'sfx-vol', 'music-vol', 'mouse-sens');
    } else if (settingsTab === 'gamepad') {
      items.push(
        'reset-gamepad',
        'look-sens',
        'ads-mult',
        'move-dz',
        'look-dz',
        'stick-curve',
        'auto-sprint',
        'invert-y',
        'vibration'
      );
    }
    items.push('armory');
    if (!isEnd) items.push('resume');
    if (!hud.lanRoomCode) items.push('restart');
    items.push('leave-or-title');
    return items;
  }, [hud.gamepadConnected, hud.lanRoomCode, isEnd, settingsTab]);

  // Keep focusedId valid whenever tab or available options change
  useEffect(() => {
    if (!focusOrder.includes(focusedId)) {
      setFocusedId(
        settingsTab === 'audio'
          ? 'voice-vol'
          : settingsTab === 'gamepad'
          ? 'look-sens'
          : 'tab-switcher'
      );
    }
  }, [focusOrder, focusedId, settingsTab]);

  // Auto-switch to gamepad tab when a controller becomes active
  useEffect(() => {
    if (gamepadNavActive) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [gamepadNavActive]);

  // Smoothly scroll focused control into view when navigating via controller
  useEffect(() => {
    if (!gamepadNavActive || armoryOpen) return;
    const el = itemRefs.current[focusedId];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedId, gamepadNavActive, armoryOpen]);

  // Lock keyboard navigation inside Settings whenever gamepad is active
  useEffect(() => {
    if (!gamepadNavActive || armoryOpen) return;
    const blockKeyboardNav = (e: KeyboardEvent) => {
      const blocked = [
        'Tab',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'Space',
        'Escape',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'KeyB',
      ];
      if (blocked.includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockKeyboardNav, { capture: true });
    return () => window.removeEventListener('keydown', blockKeyboardNav, { capture: true });
  }, [gamepadNavActive, armoryOpen]);

  // Latest-state ref so gamepad callback stays rock-solid without resubscribing on slider ticks
  const stateRef = useRef({
    focusedId,
    focusOrder,
    settingsTab,
    isEnd,
    muted,
    sensitivity,
    hud,
    gp,
    onToggleMute,
    onChangeSensitivity,
    onChangeSfxVolume,
    onChangeMusicVolume,
    onChangeVoiceVolume,
    onTestVoice,
    onChangeGamepadSettings,
    onResetGamepadSettings,
    onOpenArmory,
    onResume,
    onRestart,
    onLeaveLan,
    onReturnToTitle,
    onGamepadRumble,
  });
  stateRef.current = {
    focusedId,
    focusOrder,
    settingsTab,
    isEnd,
    muted,
    sensitivity,
    hud,
    gp,
    onToggleMute,
    onChangeSensitivity,
    onChangeSfxVolume,
    onChangeMusicVolume,
    onChangeVoiceVolume,
    onTestVoice,
    onChangeGamepadSettings,
    onResetGamepadSettings,
    onOpenArmory,
    onResume,
    onRestart,
    onLeaveLan,
    onReturnToTitle,
    onGamepadRumble,
  };

  useEffect(() => {
    if (!gamepadNavActive || armoryOpen) return;

    const unsub = subscribeGamepadNav((ev) => {
      const s = stateRef.current;

      if (ev.action === 'tabPrev' || ev.action === 'tabNext') {
        const tabs: Array<'audio' | 'gamepad' | 'map'> = ['audio', 'gamepad', 'map'];
        const curIdx = tabs.indexOf(s.settingsTab);
        const dir = ev.action === 'tabPrev' ? -1 : 1;
        const nextTab = tabs[(curIdx + dir + tabs.length) % tabs.length];
        setSettingsTab(nextTab);
        setFocusedId(
          nextTab === 'audio' ? 'voice-vol' : nextTab === 'gamepad' ? 'look-sens' : 'tab-switcher'
        );
        s.onGamepadRumble?.(false);
        return;
      }
      if (ev.action === 'back') {
        if (!s.isEnd) {
          s.onGamepadRumble?.(true);
          s.onResume();
        }
        return;
      }
      if (ev.action === 'triangle') {
        s.onGamepadRumble?.(true);
        s.onOpenArmory();
        return;
      }
      if (ev.action === 'square') {
        s.onGamepadRumble?.(true);
        if (s.settingsTab === 'gamepad') {
          s.onResetGamepadSettings();
        } else {
          s.onToggleMute();
        }
        return;
      }

      if (ev.action === 'up' || ev.action === 'down') {
        const order = s.focusOrder;
        const curIdx = Math.max(0, order.indexOf(s.focusedId));
        const delta = ev.action === 'up' ? -1 : 1;
        const nextIdx = (curIdx + delta + order.length) % order.length;
        setFocusedId(order[nextIdx]);
        s.onGamepadRumble?.(false);
        return;
      }

      if (ev.action === 'left' || ev.action === 'right') {
        const dir = ev.action === 'left' ? -1 : 1;
        const id = s.focusedId;

        if (id === 'tab-switcher') {
          if (!ev.isRepeat) {
            const tabs: Array<'audio' | 'gamepad' | 'map'> = ['audio', 'gamepad', 'map'];
            const nextTab = tabs[(tabs.indexOf(s.settingsTab) + dir + tabs.length) % tabs.length];
            setSettingsTab(nextTab);
            s.onGamepadRumble?.(false);
          }
          return;
        }
        if (id === 'gamepad-enabled' && !ev.isRepeat) {
          s.onChangeGamepadSettings({ enabled: !s.gp.enabled });
          s.onGamepadRumble?.(true);
          return;
        }
        if (id === 'mute' && !ev.isRepeat) {
          s.onToggleMute();
          s.onGamepadRumble?.(false);
          return;
        }
        if (id === 'voice-vol') {
          s.onChangeVoiceVolume(
            Math.round(Math.min(1, Math.max(0, s.hud.voiceVolume + dir * 0.05)) * 100) / 100
          );
          return;
        }
        if (id === 'sfx-vol') {
          s.onChangeSfxVolume(
            Math.round(Math.min(1, Math.max(0, s.hud.sfxVolume + dir * 0.05)) * 100) / 100
          );
          return;
        }
        if (id === 'music-vol') {
          s.onChangeMusicVolume(
            Math.round(Math.min(1, Math.max(0, s.hud.musicVolume + dir * 0.05)) * 100) / 100
          );
          return;
        }
        if (id === 'mouse-sens') {
          s.onChangeSensitivity(
            Math.round(Math.min(0.0045, Math.max(0.0008, s.sensitivity + dir * 0.0001)) * 10000) / 10000
          );
          return;
        }
        if (id === 'look-sens') {
          s.onChangeGamepadSettings({
            lookSensitivity:
              Math.round(Math.min(5.2, Math.max(0.8, s.gp.lookSensitivity + dir * 0.1)) * 10) / 10,
          });
          return;
        }
        if (id === 'ads-mult') {
          s.onChangeGamepadSettings({
            adsMultiplier:
              Math.round(Math.min(1.15, Math.max(0.25, s.gp.adsMultiplier + dir * 0.05)) * 100) / 100,
          });
          return;
        }
        if (id === 'move-dz') {
          s.onChangeGamepadSettings({
            moveDeadzone:
              Math.round(Math.min(0.25, Math.max(0.02, s.gp.moveDeadzone + dir * 0.01)) * 100) / 100,
          });
          return;
        }
        if (id === 'look-dz') {
          s.onChangeGamepadSettings({
            lookDeadzone:
              Math.round(Math.min(0.25, Math.max(0.02, s.gp.lookDeadzone + dir * 0.01)) * 100) / 100,
          });
          return;
        }
        if (id === 'stick-curve' && !ev.isRepeat) {
          const idx = CURVE_OPTIONS.findIndex((c) => c.id === s.gp.stickCurve);
          const next = CURVE_OPTIONS[(idx + dir + CURVE_OPTIONS.length) % CURVE_OPTIONS.length];
          s.onChangeGamepadSettings({ stickCurve: next.id });
          s.onGamepadRumble?.(false);
          return;
        }
        if (id === 'auto-sprint' && !ev.isRepeat) {
          s.onChangeGamepadSettings({ autoSprint: !s.gp.autoSprint });
          s.onGamepadRumble?.(false);
          return;
        }
        if (id === 'invert-y' && !ev.isRepeat) {
          s.onChangeGamepadSettings({ invertY: !s.gp.invertY });
          s.onGamepadRumble?.(false);
          return;
        }
        if (id === 'vibration' && !ev.isRepeat) {
          s.onChangeGamepadSettings({ vibration: !s.gp.vibration });
          return;
        }
        return;
      }

      if (ev.action === 'confirm') {
        s.onGamepadRumble?.(true);
        switch (s.focusedId) {
          case 'tab-switcher': {
            const tabs: Array<'audio' | 'gamepad' | 'map'> = ['audio', 'gamepad', 'map'];
            const nextTab = tabs[(tabs.indexOf(s.settingsTab) + 1) % tabs.length];
            setSettingsTab(nextTab);
            break;
          }
          case 'gamepad-enabled':
            s.onChangeGamepadSettings({ enabled: !s.gp.enabled });
            break;
          case 'mute':
            s.onToggleMute();
            break;
          case 'voice-test':
            s.onTestVoice();
            break;
          case 'reset-gamepad':
            s.onResetGamepadSettings();
            break;
          case 'stick-curve': {
            const idx = CURVE_OPTIONS.findIndex((c) => c.id === s.gp.stickCurve);
            const next = CURVE_OPTIONS[(idx + 1) % CURVE_OPTIONS.length];
            s.onChangeGamepadSettings({ stickCurve: next.id });
            break;
          }
          case 'auto-sprint':
            s.onChangeGamepadSettings({ autoSprint: !s.gp.autoSprint });
            break;
          case 'invert-y':
            s.onChangeGamepadSettings({ invertY: !s.gp.invertY });
            break;
          case 'vibration':
            s.onChangeGamepadSettings({ vibration: !s.gp.vibration });
            break;
          case 'armory':
            s.onOpenArmory();
            break;
          case 'resume':
            s.onResume();
            break;
          case 'restart':
            s.onRestart();
            break;
          case 'leave-or-title':
            if (s.hud.lanRoomCode) {
              s.onLeaveLan();
            } else {
              s.onReturnToTitle();
            }
            break;
        }
      }
    });

    return unsub;
  }, [gamepadNavActive, armoryOpen, subscribeGamepadNav]);

  const isFocused = (id: SettingsFocusId) => gamepadNavActive && focusedId === id;
  const focusRing = (id: SettingsFocusId, accent: 'amber' | 'sky' = 'sky') =>
    isFocused(id)
      ? accent === 'amber'
        ? 'ring-2 ring-amber-400 bg-amber-950/25 border-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.22)]'
        : 'ring-2 ring-sky-400 bg-sky-950/30 border-sky-400/80 shadow-[0_0_16px_rgba(56,189,248,0.24)]'
      : '';

  const FocusHint: React.FC<{ id: SettingsFocusId; type?: 'action' | 'slider' | 'cycle' }> = ({
    id,
    type = 'action',
  }) => {
    if (!isFocused(id)) return null;
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/70 text-[9.5px] font-black uppercase tracking-wider text-sky-200 shrink-0">
        {type === 'slider' ? '◀ ▶ Régler' : type === 'cycle' ? '◀ ▶ / ✕' : '✕ Valider'}
      </span>
    );
  };

  const title =
    hud.phase === 'victory'
      ? 'VICTOIRE SUR LE FRONT'
      : hud.phase === 'defeat'
      ? 'SECTEUR PERDU'
      : 'PARAMÈTRES & PAUSE';

  const shareIp = hud.lanIps[0] || window.location.hostname || '127.0.0.1';
  const shareUrl = hud.lanRoomCode
    ? `http://${shareIp}:${hud.lanPort}?room=${hud.lanRoomCode}`
    : null;

  const isTdm = hud.combatMode === 'tdm';
  const leftScore = isTdm ? hud.armyScore : hud.armyTickets;
  const rightScore = isTdm ? hud.rebelScore : hud.rebelTickets;
  const sticks = hud.gamepadSticks;

  return (
    <div
      className={`fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto touch-pan-y ${
        gamepadNavActive ? 'pointer-events-none select-none cursor-none' : ''
      }`}
    >
      <div className="w-full max-w-lg rounded-xl bg-[#111813] border border-stone-700 p-5 shadow-2xl space-y-3 my-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
              {hud.combatModeName} · {hud.currentZoneName}
            </div>
            <h2
              className={`text-xl font-black tracking-wide mt-0.5 ${
                hud.phase === 'victory'
                  ? 'text-emerald-400'
                  : hud.phase === 'defeat'
                  ? 'text-red-400'
                  : 'text-stone-100'
              }`}
            >
              {title}
            </h2>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${
              gamepadNavActive
                ? 'bg-[#0f1c24] border-sky-500 text-sky-300'
                : hud.gamepadConnected
                ? 'bg-stone-900 border-amber-700/70 text-amber-300'
                : 'bg-stone-900 border-stone-700 text-stone-400'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            {gamepadNavActive
              ? 'DualShock Exclusive'
              : hud.gamepadConnected
              ? 'Manette Désactivée'
              : 'Aucune Manette'}
          </div>
        </div>

        {/* Exclusive Controller Lock Banner */}
        {gamepadNavActive && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[#0c1a24] border border-sky-700/70 px-3 py-1.5 text-[10.5px] text-sky-200">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              Navigation manette activée — Clavier &amp; souris désactivés
            </span>
            <span className="text-[10px] text-sky-300/90 font-semibold shrink-0">
              L1/R1 · D-Pad / Stick G
            </span>
          </div>
        )}

        {/* Combat Summary */}
        <div className="grid grid-cols-4 gap-2 text-center bg-[#0b100d] border border-stone-800 rounded-lg p-2.5 tabular-nums">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Grade</div>
            <div className="text-xs font-extrabold text-amber-300 mt-1 truncate" title={hud.rankTitle}>
              {hud.rankTitle}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Élim.</div>
            <div className="text-lg font-extrabold text-stone-100">{hud.playerKills}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Pertes</div>
            <div className="text-lg font-extrabold text-stone-100">{hud.playerDeaths}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500">
              {isTdm ? 'Score' : 'Tickets'}
            </div>
            <div className="text-sm font-bold text-stone-200 mt-1">
              <span className="text-sky-400">{leftScore}</span> -{' '}
              <span className="text-red-400">{rightScore}</span>
            </div>
          </div>
        </div>

        {hud.lanRoomCode && (
          <div className="bg-[#0b100d] border border-stone-800 rounded-lg p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-300">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Wifi className="w-3.5 h-3.5" />
                Salon Wi-Fi : {hud.lanRoomCode}
              </span>
              <span className="tabular-nums font-semibold">{hud.lanPlayerCount} joueur(s)</span>
            </div>
            {shareUrl && (
              <div className="text-[10.5px] text-stone-400 truncate">
                Partager : <code className="text-amber-200">{shareUrl}</code>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab Switcher */}
        <div
          ref={setItemRef('tab-switcher')}
          className={`grid grid-cols-3 gap-1 bg-[#0b100d] p-1 rounded-lg border border-stone-800 transition-all ${focusRing(
            'tab-switcher'
          )}`}
        >
          <button
            type="button"
            tabIndex={gamepadNavActive ? -1 : 0}
            onClick={() => {
              if (!gamepadNavActive) setSettingsTab('audio');
            }}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
              gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
            } ${
              settingsTab === 'audio'
                ? 'bg-stone-800 text-amber-300 border border-stone-600'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {gamepadNavActive && (
              <span className="px-1 rounded bg-stone-900 border border-stone-600 text-[9px] text-stone-300">
                L1
              </span>
            )}
            <Sliders className="w-3.5 h-3.5" />
            <span>Audio</span>
          </button>
          <button
            type="button"
            tabIndex={gamepadNavActive ? -1 : 0}
            onClick={() => {
              if (!gamepadNavActive) setSettingsTab('gamepad');
            }}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
              gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
            } ${
              settingsTab === 'gamepad'
                ? 'bg-[#0f1f2b] text-sky-300 border border-sky-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Manette</span>
          </button>
          <button
            type="button"
            tabIndex={gamepadNavActive ? -1 : 0}
            onClick={() => {
              if (!gamepadNavActive) setSettingsTab('map');
            }}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
              gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
            } ${
              settingsTab === 'map'
                ? 'bg-[#12241a] text-emerald-300 border border-emerald-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Carte</span>
            {gamepadNavActive && (
              <span className="px-1 rounded bg-emerald-950 border border-emerald-700 text-[9px] text-emerald-200">
                R1
              </span>
            )}
          </button>
        </div>

        {/* Controller Activation Toggle (Visible whenever a DualShock is plugged in) */}
        {hud.gamepadConnected && (
          <div
            ref={setItemRef('gamepad-enabled')}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
              gp.enabled
                ? 'bg-[#0b161f] border-sky-800/80'
                : 'bg-[#0b100d] border-stone-800'
            } ${focusRing('gamepad-enabled')}`}
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-stone-100 flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                Contrôle Manette DualShock
              </div>
              <div className="text-[10px] text-stone-400 truncate">
                {gp.enabled
                  ? 'Actif (Clavier & Souris bloqués dans les paramètres)'
                  : 'Désactivé (Navigation Clavier & Souris active)'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <FocusHint id="gamepad-enabled" />
              <button
                type="button"
                tabIndex={gamepadNavActive ? -1 : 0}
                onClick={() => {
                  if (!gamepadNavActive) onChangeGamepadSettings({ enabled: !gp.enabled });
                }}
                className={`px-2.5 py-1 rounded border text-[10.5px] font-extrabold uppercase tracking-wider ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                } ${
                  gp.enabled
                    ? 'bg-sky-600/25 border-sky-500 text-sky-200'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300'
                }`}
              >
                {gp.enabled ? 'ACTIVÉE' : 'DÉSACTIVÉE'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: Audio & Mouse */}
        {settingsTab === 'audio' && (
          <div className="bg-[#0b100d] border border-stone-800 rounded-lg p-3 space-y-2.5 max-h-[44vh] overflow-y-auto">
            <div
              ref={setItemRef('mute')}
              className={`flex items-center justify-between border border-transparent rounded-lg px-2 py-1.5 transition-all border-b-stone-800 ${focusRing(
                'mute'
              )}`}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-200">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                Audio Principal
              </span>
              <div className="flex items-center gap-2">
                <FocusHint id="mute" />
                <button
                  type="button"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  onClick={() => {
                    if (!gamepadNavActive) onToggleMute();
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-bold ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  } ${
                    muted
                      ? 'bg-red-950/80 border-red-700 text-red-300'
                      : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-100'
                  }`}
                >
                  {muted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {muted ? 'Son Coupé' : 'Son Actif'}
                </button>
              </div>
            </div>

            <div
              ref={setItemRef('voice-test')}
              className={`flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'voice-test'
              )}`}
            >
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-200 font-medium">
                <Mic className="w-3.5 h-3.5 text-sky-400" />
                Échantillon Radio Congolais / Africain
              </span>
              <div className="flex items-center gap-2">
                <FocusHint id="voice-test" />
                <button
                  type="button"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  onClick={() => {
                    if (!gamepadNavActive) onTestVoice();
                  }}
                  className={`px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[10.5px] font-bold text-sky-300 ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
                >
                  Tester Voix
                </button>
              </div>
            </div>

            <div
              ref={setItemRef('voice-vol')}
              className={`space-y-1 rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'voice-vol'
              )}`}
            >
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Mic className="w-3.5 h-3.5 text-sky-400" />
                  Voix de commandement
                </span>
                <div className="flex items-center gap-2">
                  <FocusHint id="voice-vol" type="slider" />
                  <span className="tabular-nums text-sky-300 font-bold w-9 text-right">
                    {Math.round(hud.voiceVolume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                tabIndex={gamepadNavActive ? -1 : 0}
                disabled={gamepadNavActive}
                min={0}
                max={1}
                step={0.05}
                value={hud.voiceVolume}
                onChange={(e) => {
                  if (!gamepadNavActive) onChangeVoiceVolume(parseFloat(e.target.value));
                }}
                className={`w-full accent-sky-400 ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                }`}
              />
            </div>

            <div
              ref={setItemRef('sfx-vol')}
              className={`space-y-1 rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'sfx-vol'
              )}`}
            >
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  Effets sonores (Tirs, Explosions)
                </span>
                <div className="flex items-center gap-2">
                  <FocusHint id="sfx-vol" type="slider" />
                  <span className="tabular-nums text-amber-300 font-bold w-9 text-right">
                    {Math.round(hud.sfxVolume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                tabIndex={gamepadNavActive ? -1 : 0}
                disabled={gamepadNavActive}
                min={0}
                max={1}
                step={0.05}
                value={hud.sfxVolume}
                onChange={(e) => {
                  if (!gamepadNavActive) onChangeSfxVolume(parseFloat(e.target.value));
                }}
                className={`w-full accent-amber-500 ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                }`}
              />
            </div>

            <div
              ref={setItemRef('music-vol')}
              className={`space-y-1 rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'music-vol'
              )}`}
            >
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  Musique
                </span>
                <div className="flex items-center gap-2">
                  <FocusHint id="music-vol" type="slider" />
                  <span className="tabular-nums text-emerald-300 font-bold w-9 text-right">
                    {Math.round(hud.musicVolume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                tabIndex={gamepadNavActive ? -1 : 0}
                disabled={gamepadNavActive}
                min={0}
                max={1}
                step={0.05}
                value={hud.musicVolume}
                onChange={(e) => {
                  if (!gamepadNavActive) onChangeMusicVolume(parseFloat(e.target.value));
                }}
                className={`w-full accent-emerald-500 ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                }`}
              />
            </div>

            <div
              ref={setItemRef('mouse-sens')}
              className={`space-y-1 rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'mouse-sens'
              )}`}
            >
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span>Sensibilité visée souris</span>
                <div className="flex items-center gap-2">
                  <FocusHint id="mouse-sens" type="slider" />
                  <span className="tabular-nums text-amber-300 font-bold">
                    {(sensitivity * 1000).toFixed(1)}
                  </span>
                </div>
              </div>
              <input
                type="range"
                tabIndex={gamepadNavActive ? -1 : 0}
                disabled={gamepadNavActive}
                min={0.0008}
                max={0.0045}
                step={0.0001}
                value={sensitivity}
                onChange={(e) => {
                  if (!gamepadNavActive) onChangeSensitivity(parseFloat(e.target.value));
                }}
                className={`w-full accent-amber-500 ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                }`}
              />
            </div>
          </div>
        )}

        {/* TAB 2: DualShock Joysticks & All-Button Controls */}
        {settingsTab === 'gamepad' && (
          <div className="bg-[#0b100d] border border-stone-800 rounded-lg p-3 space-y-2 max-h-[46vh] overflow-y-auto">
            <div
              ref={setItemRef('reset-gamepad')}
              className={`flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'reset-gamepad'
              )}`}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                <Gamepad2 className="w-3.5 h-3.5" />
                Accessibilité Joysticks
              </span>
              <div className="flex items-center gap-2">
                <FocusHint id="reset-gamepad" />
                <button
                  type="button"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  onClick={() => {
                    if (!gamepadNavActive) onResetGamepadSettings();
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[10px] font-bold text-stone-300 ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  Défaut {gamepadNavActive ? '[□]' : ''}
                </button>
              </div>
            </div>

            {/* Live Dual-Stick Calibration Preview */}
            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-[#080d0a] border border-stone-800/90">
              {[
                {
                  label: 'Stick Gauche (L3 · Dépl.)',
                  x: sticks.lx,
                  y: sticks.ly,
                  dz: gp.moveDeadzone,
                  color: '#34d399',
                },
                {
                  label: 'Stick Droit (R3 · Visée)',
                  x: sticks.rx,
                  y: sticks.ry,
                  dz: gp.lookDeadzone,
                  color: '#38bdf8',
                },
              ].map((st) => (
                <div key={st.label} className="flex items-center gap-2.5">
                  <svg viewBox="-28 -28 56 56" className="w-11 h-11 shrink-0">
                    <circle
                      cx="0"
                      cy="0"
                      r="24"
                      fill="#111915"
                      stroke="#334155"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r={Math.max(1.5, st.dz * 24)}
                      fill="none"
                      stroke="#f59e0b"
                      strokeDasharray="2 2"
                      strokeWidth="0.9"
                    />
                    <line x1="-24" y1="0" x2="24" y2="0" stroke="#1e293b" strokeWidth="0.8" />
                    <line x1="0" y1="-24" x2="0" y2="24" stroke="#1e293b" strokeWidth="0.8" />
                    <circle
                      cx={Math.max(-22, Math.min(22, st.x * 22))}
                      cy={Math.max(-22, Math.min(22, st.y * 22))}
                      r="4"
                      fill={st.color}
                    />
                  </svg>
                  <div className="min-w-0 text-[10px] leading-tight">
                    <div className="font-bold text-stone-200 truncate">{st.label}</div>
                    <div className="text-stone-400 tabular-nums mt-0.5">
                      X:{st.x.toFixed(2)} Y:{st.y.toFixed(2)}
                    </div>
                    <div className="text-amber-400/90 tabular-nums">
                      Zone morte: {Math.round(st.dz * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5 gap-y-1.5">
              <div
                ref={setItemRef('look-sens')}
                className={`space-y-0.5 rounded-lg border border-transparent px-2 py-1 transition-all ${focusRing(
                  'look-sens'
                )}`}
              >
                <div className="flex justify-between items-center text-[11px] text-stone-300 gap-1">
                  <span className="truncate">Vitesse Rotation (D)</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <FocusHint id="look-sens" type="slider" />
                    <strong className="text-sky-300 tabular-nums">
                      {gp.lookSensitivity.toFixed(2)}
                    </strong>
                  </div>
                </div>
                <input
                  type="range"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  disabled={gamepadNavActive}
                  min={0.8}
                  max={5.2}
                  step={0.1}
                  value={gp.lookSensitivity}
                  onChange={(e) => {
                    if (!gamepadNavActive)
                      onChangeGamepadSettings({ lookSensitivity: parseFloat(e.target.value) });
                  }}
                  className={`w-full accent-sky-400 ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
                />
              </div>

              <div
                ref={setItemRef('ads-mult')}
                className={`space-y-0.5 rounded-lg border border-transparent px-2 py-1 transition-all ${focusRing(
                  'ads-mult'
                )}`}
              >
                <div className="flex justify-between items-center text-[11px] text-stone-300 gap-1">
                  <span className="truncate">Multiplicateur Visée</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <FocusHint id="ads-mult" type="slider" />
                    <strong className="text-sky-300 tabular-nums">
                      {Math.round(gp.adsMultiplier * 100)}%
                    </strong>
                  </div>
                </div>
                <input
                  type="range"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  disabled={gamepadNavActive}
                  min={0.25}
                  max={1.15}
                  step={0.05}
                  value={gp.adsMultiplier}
                  onChange={(e) => {
                    if (!gamepadNavActive)
                      onChangeGamepadSettings({ adsMultiplier: parseFloat(e.target.value) });
                  }}
                  className={`w-full accent-sky-400 ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
                />
              </div>

              <div
                ref={setItemRef('move-dz')}
                className={`space-y-0.5 rounded-lg border border-transparent px-2 py-1 transition-all ${focusRing(
                  'move-dz'
                )}`}
              >
                <div className="flex justify-between items-center text-[11px] text-stone-300 gap-1">
                  <span className="truncate">Zone Morte Gauche</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <FocusHint id="move-dz" type="slider" />
                    <strong className="text-emerald-300 tabular-nums">
                      {Math.round(gp.moveDeadzone * 100)}%
                    </strong>
                  </div>
                </div>
                <input
                  type="range"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  disabled={gamepadNavActive}
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={gp.moveDeadzone}
                  onChange={(e) => {
                    if (!gamepadNavActive)
                      onChangeGamepadSettings({ moveDeadzone: parseFloat(e.target.value) });
                  }}
                  className={`w-full accent-emerald-400 ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
                />
              </div>

              <div
                ref={setItemRef('look-dz')}
                className={`space-y-0.5 rounded-lg border border-transparent px-2 py-1 transition-all ${focusRing(
                  'look-dz'
                )}`}
              >
                <div className="flex justify-between items-center text-[11px] text-stone-300 gap-1">
                  <span className="truncate">Zone Morte Droite</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <FocusHint id="look-dz" type="slider" />
                    <strong className="text-amber-300 tabular-nums">
                      {Math.round(gp.lookDeadzone * 100)}%
                    </strong>
                  </div>
                </div>
                <input
                  type="range"
                  tabIndex={gamepadNavActive ? -1 : 0}
                  disabled={gamepadNavActive}
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={gp.lookDeadzone}
                  onChange={(e) => {
                    if (!gamepadNavActive)
                      onChangeGamepadSettings({ lookDeadzone: parseFloat(e.target.value) });
                  }}
                  className={`w-full accent-amber-400 ${
                    gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
                />
              </div>
            </div>

            {/* Response Curve Selector */}
            <div
              ref={setItemRef('stick-curve')}
              className={`space-y-1 rounded-lg border border-transparent px-2 py-1.5 transition-all ${focusRing(
                'stick-curve'
              )}`}
            >
              <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-stone-400">
                <span>Courbe de Réponse Stick Droit</span>
                <FocusHint id="stick-curve" type="cycle" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CURVE_OPTIONS.map((c) => {
                  const active = gp.stickCurve === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      tabIndex={gamepadNavActive ? -1 : 0}
                      onClick={() => {
                        if (!gamepadNavActive) onChangeGamepadSettings({ stickCurve: c.id });
                      }}
                      className={`px-2 py-1.5 rounded border text-left ${
                        gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                      } ${
                        active
                          ? 'bg-[#0f2330] border-sky-500 text-sky-200'
                          : 'bg-stone-900/70 border-stone-800 text-stone-400 hover:border-stone-600'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{c.label}</div>
                      <div className="text-[9.5px] opacity-80">{c.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Accessibility Toggles */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                ref={setItemRef('auto-sprint')}
                type="button"
                tabIndex={gamepadNavActive ? -1 : 0}
                onClick={() => {
                  if (!gamepadNavActive) onChangeGamepadSettings({ autoSprint: !gp.autoSprint });
                }}
                className={`px-2 py-1.5 rounded border text-[10.5px] font-bold transition-all ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                } ${
                  gp.autoSprint
                    ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                } ${focusRing('auto-sprint')}`}
              >
                Sprint Auto : {gp.autoSprint ? 'OUI' : 'NON'}
              </button>
              <button
                ref={setItemRef('invert-y')}
                type="button"
                tabIndex={gamepadNavActive ? -1 : 0}
                onClick={() => {
                  if (!gamepadNavActive) onChangeGamepadSettings({ invertY: !gp.invertY });
                }}
                className={`px-2 py-1.5 rounded border text-[10.5px] font-bold transition-all ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                } ${
                  gp.invertY
                    ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                } ${focusRing('invert-y')}`}
              >
                Inverser Y : {gp.invertY ? 'OUI' : 'NON'}
              </button>
              <button
                ref={setItemRef('vibration')}
                type="button"
                tabIndex={gamepadNavActive ? -1 : 0}
                onClick={() => {
                  if (!gamepadNavActive) onChangeGamepadSettings({ vibration: !gp.vibration });
                }}
                className={`px-2 py-1.5 rounded border text-[10.5px] font-bold transition-all ${
                  gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
                } ${
                  gp.vibration
                    ? 'bg-sky-950/70 border-sky-600 text-sky-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                } ${focusRing('vibration')}`}
              >
                Vibration : {gp.vibration ? 'OUI' : 'NON'}
              </button>
            </div>

            {/* Complete DualShock All-Button Map */}
            <div className="pt-2 border-t border-stone-800 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Mapping Complet DualShock (Combat &amp; Menus)
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-stone-300 bg-[#080d0a] border border-stone-800/80 rounded p-2">
                <div><strong className="text-emerald-300">L2 / R2</strong> : Viser / Tirer</div>
                <div><strong className="text-emerald-300">L1 / R1</strong> : Fumigène / Frag (Onglets)</div>
                <div><strong className="text-sky-300">Stick G / L3 Avant</strong> : Marche / Sprint</div>
                <div><strong className="text-sky-300">Stick D + R3</strong> : Visée / Allongé-Plongeon</div>
                <div><strong className="text-amber-300">✕ Croix</strong> : Saut / Valider menu</div>
                <div><strong className="text-amber-300">○ Rond</strong> : Accroupi-Allongé / Retour</div>
                <div><strong className="text-amber-300">□ Carré</strong> : Recharger / Défaut-Muet</div>
                <div><strong className="text-amber-300">△ Triangle</strong> : Arme suiv. / Armurerie</div>
                <div><strong className="text-stone-100">D-Pad ↑ / ↓</strong> : Regroup. / Arme (Maint. Drone)</div>
                <div><strong className="text-stone-100">D-Pad ← / →</strong> : Assaut · Éliminer · Couvert · Déplac.</div>
                <div><strong className="text-stone-100">Select/Share</strong> : Mini-fenêtre État</div>
                <div><strong className="text-stone-100">L2 + L3</strong> : Changer Zoom Lunette</div>
                <div><strong className="text-stone-100">Pavé / Options</strong> : Grades / Paramètres</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Carte Tactique (Displayed ONLY inside Settings) */}
        {settingsTab === 'map' && (
          <div className="bg-[#0b100d] border border-stone-800 rounded-lg p-3 space-y-2.5 max-h-[48vh] overflow-y-auto touch-pan-y">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                <MapIcon className="w-3.5 h-3.5" />
                {hud.currentZoneName}
              </span>
              <span className="text-stone-400 tabular-nums font-semibold">
                Cap {hud.compassHeadingDeg}° · {hud.aliveAllies} Alliés / {hud.aliveEnemies} Ennemis
              </span>
            </div>

            <div className="flex justify-center">
              <Minimap
                playerX={hud.playerPosX}
                playerZ={hud.playerPosZ}
                playerYaw={hud.playerYaw}
                units={hud.minimapUnits}
                sectors={hud.sectors}
                orderMarkerPos={hud.orderMarkerPos}
                enemyRadarRange={hud.minimapEnemyRange}
                size={190}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-stone-800/80">
              {hud.sectors
                .filter((s) => s.active)
                .map((sec) => {
                  const badgeCls =
                    sec.owner === 'army'
                      ? 'bg-sky-600 text-white border-sky-400'
                      : sec.owner === 'rebels'
                      ? 'bg-red-600 text-white border-red-400'
                      : 'bg-stone-800 text-amber-300 border-amber-500/80';
                  return (
                    <div
                      key={sec.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-[#080d0a] border border-stone-800/90 text-[10.5px]"
                    >
                      <span
                        className={`w-5 h-5 rounded border flex items-center justify-center font-black text-[10px] shrink-0 ${badgeCls}`}
                      >
                        {sec.id}
                      </span>
                      <span className="text-stone-200 font-semibold truncate">{sec.name}</span>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-800/80">
              <span>
                Ordre Cross-Com :{' '}
                <strong className="text-sky-300">
                  {TACTICAL_ORDERS.find((o) => o.id === (hud.activeOrder ?? hud.selectedOrder))?.shortLabel}
                </strong>
              </span>
              <span className="tabular-nums">
                Position ({Math.round(hud.playerPosX)}, {Math.round(hud.playerPosZ)})
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 pt-0.5">
          <button
            ref={setItemRef('armory')}
            type="button"
            tabIndex={gamepadNavActive ? -1 : 0}
            onClick={() => {
              if (!gamepadNavActive) onOpenArmory();
            }}
            className={`w-full py-2 rounded-lg bg-[#16221b] hover:bg-[#1e2f25] border border-amber-500/70 text-amber-200 font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all ${
              gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
            } ${focusRing('armory', 'amber')}`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Armurerie ({hud.loadout.map((id) => WEAPON_SPECS[id]?.shortName ?? id).join(' · ')}) [
              {gamepadNavActive ? '△' : 'B'}]
            </span>
          </button>

          {!isEnd && (
            <button
              ref={setItemRef('resume')}
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) onResume();
              }}
              className={`w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-extrabold text-xs uppercase tracking-widest transition-all ${
                gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
              } ${
                isFocused('resume')
                  ? 'ring-2 ring-white shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                  : ''
              }`}
            >
              Reprendre le combat {gamepadNavActive ? '(○ / Options)' : '(Echap)'}
            </button>
          )}

          {!hud.lanRoomCode && (
            <button
              ref={setItemRef('restart')}
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) onRestart();
              }}
              className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
              } ${
                isEnd
                  ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600'
              } ${focusRing('restart')}`}
            >
              Recommencer la bataille {isFocused('restart') ? '· [✕]' : ''}
            </button>
          )}

          {hud.lanRoomCode ? (
            <button
              ref={setItemRef('leave-or-title')}
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) onLeaveLan();
              }}
              className={`w-full py-2 rounded-lg bg-red-950/70 hover:bg-red-900/80 border border-red-700/70 text-red-200 text-xs font-bold uppercase tracking-widest transition-all ${
                gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
              } ${focusRing('leave-or-title')}`}
            >
              Quitter le salon Wi-Fi {isFocused('leave-or-title') ? '· [✕]' : ''}
            </button>
          ) : (
            <button
              ref={setItemRef('leave-or-title')}
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) onReturnToTitle();
              }}
              className={`w-full py-2 rounded-lg bg-transparent hover:bg-stone-800/70 text-stone-400 hover:text-stone-200 text-xs font-semibold uppercase tracking-widest transition-all border border-transparent ${
                gamepadNavActive ? 'pointer-events-none' : 'cursor-pointer'
              } ${focusRing('leave-or-title')}`}
            >
              Changer de camp / Mode (Menu) {isFocused('leave-or-title') ? '· [✕]' : ''}
            </button>
          )}
        </div>

        {/* Gamepad Legend Bar */}
        {gamepadNavActive && (
          <div className="pt-2 border-t border-stone-800 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-stone-400">
            <span><strong className="text-sky-300">↑↓ / Stick G</strong> Naviguer</span>
            <span><strong className="text-sky-300">←→</strong> Ajuster / Choisir</span>
            <span><strong className="text-amber-300">L1/R1</strong> Onglet</span>
            <span><strong className="text-emerald-300">✕</strong> Valider</span>
            <span><strong className="text-stone-200">□</strong> {settingsTab === 'gamepad' ? 'Défaut' : 'Muet'}</span>
            <span><strong className="text-amber-300">△</strong> Armurerie</span>
            {!isEnd && <span><strong className="text-red-300">○ / Options</strong> Reprendre</span>}
          </div>
        )}
      </div>
    </div>
  );
};
