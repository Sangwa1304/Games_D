import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CloudFog,
  Crosshair,
  Flame,
  Radar,
  RefreshCw,
  Repeat,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { HudSnapshot } from '../game/types';

export type TouchActionId =
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
  | 'droneMark';

interface TouchControlsProps {
  hud: HudSnapshot;
  onMove: (x: number, y: number, sprint: boolean) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFire: (held: boolean) => void;
  onAdsToggle: (active: boolean) => void;
  onAction: (action: TouchActionId) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  hud,
  onMove,
  onLookDelta,
  onFire,
  onAdsToggle,
  onAction,
}) => {
  const [stickOffset, setStickOffset] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const [sprintArmed, setSprintArmed] = useState(false);
  const [fireActive, setFireActive] = useState(false);

  const stickPointerIdRef = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastStickNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sprintArmedRef = useRef(false);
  const sprintedSinceArmRef = useRef(false);
  const lookPointerIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const firePointerIdRef = useRef<number | null>(null);

  // Strictly visible ONLY on phones when controller is disconnected!
  if (!hud.isMobileDevice || hud.gamepadConnected || hud.hp <= 0 || hud.killcam?.active) {
    return null;
  }

  const maxRadius = 44;

  const setSprintMode = (next: boolean) => {
    sprintArmedRef.current = next;
    sprintedSinceArmRef.current = false;
    setSprintArmed(next);
    const { x, y } = lastStickNormRef.current;
    onMove(x, y, next && y < -0.25);
  };

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenterRef.current.x;
    const dy = clientY - stickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxRadius, dist);
    const scale = dist > 0.001 ? clampedDist / dist : 0;
    const cx = dx * scale;
    const cy = dy * scale;
    const normX = cx / maxRadius;
    const normY = cy / maxRadius;
    lastStickNormRef.current = { x: normX, y: normY };
    const shouldSprint = sprintArmedRef.current && normY < -0.25;
    if (shouldSprint) sprintedSinceArmRef.current = true;
    setStickOffset({ x: cx, y: cy, active: true });
    onMove(normX, normY, shouldSprint);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickPointerIdRef.current !== null) return;
    stickPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    stickPointerIdRef.current = null;
    lastStickNormRef.current = { x: 0, y: 0 };
    if (sprintedSinceArmRef.current) {
      sprintArmedRef.current = false;
      sprintedSinceArmRef.current = false;
      setSprintArmed(false);
    }
    setStickOffset({ x: 0, y: 0, active: false });
    onMove(0, 0, false);
  };

  // Multi-touch Look Swipe Pad (covers the screen behind action buttons)
  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerIdRef.current !== null) return;
    lookPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - lastLookPosRef.current.x;
    const dy = e.clientY - lastLookPosRef.current.y;
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
    onLookDelta(dx, dy);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerIdRef.current !== e.pointerId) return;
    lookPointerIdRef.current = null;
  };

  const handleFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (firePointerIdRef.current !== null) return;
    firePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFireActive(true);
    onFire(true);
  };

  const handleFireUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    firePointerIdRef.current = null;
    setFireActive(false);
    onFire(false);
  };

  const isActivelySprinting = sprintArmed && hud.isSprinting;

  return (
    <div className="fixed inset-0 z-15 pointer-events-none select-none touch-none">
      {/* Right & Center-Right Swipe Zone for Smooth Camera Aim */}
      <div
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        className="fixed inset-y-12 right-0 left-[30%] pointer-events-auto touch-none"
        aria-label="Zone de visée tactile"
      />

      {/* Left Virtual Movement Area: Dedicated SPRINT Button + Normal-Walk Thumbstick */}
      <div className="fixed bottom-[42px] left-3 pointer-events-auto touch-none flex flex-col items-center gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            setSprintMode(!sprintArmedRef.current);
          }}
          className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow transition-colors ${
            isActivelySprinting
              ? 'bg-amber-500/90 border-amber-200 text-stone-950'
              : sprintArmed
              ? 'bg-amber-900/85 border-amber-400 text-amber-200'
              : 'bg-[#0b120e]/75 border-stone-500/65 text-stone-200 active:bg-amber-700/70'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>{sprintArmed ? 'SPRINT ON' : 'SPRINT'}</span>
        </button>

        <div
          onPointerDown={handleStickDown}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickUp}
          onPointerCancel={handleStickUp}
          className={`relative w-28 h-28 rounded-full border-2 flex items-center justify-center transition-colors ${
            sprintArmed && stickOffset.active
              ? 'bg-amber-950/30 border-amber-400/75'
              : stickOffset.active
              ? 'bg-[#101c15]/45 border-emerald-400/70'
              : 'bg-[#0b120e]/32 border-stone-500/40'
          }`}
        >
          <span className="absolute top-1.5 text-[8px] font-black uppercase tracking-widest text-stone-300/65">
            {sprintArmed ? 'COURIR' : hud.isProne ? 'RAMPER' : hud.isCrouching ? 'DISCRET' : 'MARCHE'}
          </span>
          <div
            className={`w-10 h-10 rounded-full border shadow-lg transition-transform duration-75 ${
              sprintArmed && stickOffset.active
                ? 'bg-amber-500/80 border-amber-200'
                : 'bg-stone-200/28 border-stone-300/65'
            }`}
            style={{
              transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Right Ergonomic Action Buttons Cluster (Phone Only, Gamepad Disconnected) */}
      {hud.droneActive ? (
        <div className="fixed bottom-[42px] right-3 pointer-events-auto touch-none flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('drone');
              }}
              className="px-3 h-10 rounded-full bg-red-950/90 active:bg-red-800 border border-red-400/80 text-red-200 text-[9.5px] font-black uppercase tracking-wider shadow-lg"
            >
              RAPPEL
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('orderIssue');
              }}
              className="px-3 h-10 rounded-full bg-[#0a1d26]/90 active:bg-sky-800 border border-sky-400/80 text-sky-200 text-[9.5px] font-black uppercase tracking-wider shadow-lg"
            >
              {hud.droneAimingEnemy ? 'ÉLIMINER' : 'ORDRE'}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('droneDescend');
              }}
              className="w-12 h-12 rounded-full bg-[#09161d]/88 active:bg-cyan-800 border border-cyan-500/75 text-cyan-200 flex flex-col items-center justify-center shadow"
            >
              <ArrowDown className="w-4 h-4" />
              <span className="text-[7.5px] font-black">BAS</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('droneAscend');
              }}
              className="w-12 h-12 rounded-full bg-[#09161d]/88 active:bg-cyan-800 border border-cyan-500/75 text-cyan-200 flex flex-col items-center justify-center shadow"
            >
              <ArrowUp className="w-4 h-4" />
              <span className="text-[7.5px] font-black">HAUT</span>
            </button>
          </div>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('droneMark');
            }}
            className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center shadow-2xl transition-colors ${
              hud.droneAimingEnemy
                ? 'bg-orange-600/90 active:bg-orange-500 border-amber-200 text-white'
                : 'bg-[#09202a]/90 active:bg-cyan-700 border-cyan-400/85 text-cyan-100'
            }`}
          >
            <Radar className="w-6 h-6" />
            <span className="text-[9.5px] font-black uppercase tracking-wider mt-0.5">
              MARQUER
            </span>
          </button>
        </div>
      ) : (
      <div className="fixed bottom-[42px] right-3 pointer-events-auto touch-none flex flex-col items-end gap-1.5">
        {/* Top Row: Recon Drone + Sniper Zoom (when scoped) + Grenades */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('drone');
            }}
            className={`px-2.5 h-10 rounded-full border flex items-center gap-1 shadow ${
              hud.droneBattery >= 18
                ? 'bg-[#081a22]/85 active:bg-cyan-800 border-cyan-500/75 text-cyan-200'
                : 'bg-[#121614]/80 border-stone-600/70 text-stone-400'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span className="text-[8.5px] font-black tabular-nums">DRN {hud.droneBattery}%</span>
          </button>

          {hud.isAds && hud.weaponCategory === 'sniper' && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onAction('zoom');
              }}
              className="w-11 h-11 rounded-full bg-sky-950/85 active:bg-sky-700 border border-sky-400/80 text-sky-200 flex flex-col items-center justify-center shadow-lg"
            >
              <ZoomIn className="w-4 h-4" />
              <span className="text-[8px] font-black">{hud.sniperZoomLabel || 'ZOOM'}</span>
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('smoke');
            }}
            className="w-10 h-10 rounded-full bg-[#131b17]/80 active:bg-stone-700 border border-stone-500/70 text-stone-200 flex flex-col items-center justify-center shadow"
          >
            <CloudFog className="w-3.5 h-3.5 text-stone-300" />
            <span className="text-[8px] font-bold tabular-nums">{hud.smokeGrenades}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('frag');
            }}
            className="w-10 h-10 rounded-full bg-[#1b1510]/80 active:bg-amber-800 border border-amber-600/70 text-amber-200 flex flex-col items-center justify-center shadow"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[8px] font-bold tabular-nums">{hud.grenades}</span>
          </button>
        </div>

        {/* Middle Row: Reload + Weapon Switch + Stance Pills (Saut / Accr. / Allongé) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('nextWeapon');
            }}
            className="px-2.5 h-10 rounded-xl bg-[#101814]/82 active:bg-stone-700 border border-stone-500/75 text-stone-100 flex items-center gap-1 text-[9.5px] font-extrabold shadow"
          >
            <Repeat className="w-3.5 h-3.5 text-amber-300" />
            <span>ARME</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('reload');
            }}
            className="w-10 h-10 rounded-full bg-[#101814]/82 active:bg-amber-700 border border-stone-500/75 text-stone-100 flex flex-col items-center justify-center shadow"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[7.5px] font-bold">RECH</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setSprintMode(false);
              onAction('prone');
            }}
            className={`w-10 h-10 rounded-full border flex flex-col items-center justify-center shadow text-[8px] font-black ${
              hud.isProne
                ? 'bg-emerald-700/85 border-emerald-300 text-white'
                : 'bg-[#101814]/82 active:bg-stone-700 border-stone-500/75 text-stone-200'
            }`}
          >
            <span>ALLG</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setSprintMode(false);
              onAction('crouch');
            }}
            className={`w-10 h-10 rounded-full border flex flex-col items-center justify-center shadow text-[8px] font-black ${
              hud.isCrouching
                ? 'bg-amber-700/85 border-amber-300 text-white'
                : 'bg-[#101814]/82 active:bg-stone-700 border-stone-500/75 text-stone-200'
            }`}
          >
            <span>ACCR</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onAction('jump');
            }}
            className="w-10 h-10 rounded-full bg-[#101814]/82 active:bg-sky-700 border border-stone-500/75 text-stone-100 flex flex-col items-center justify-center shadow"
          >
            <ArrowUp className="w-4 h-4" />
            <span className="text-[7.5px] font-bold">SAUT</span>
          </button>
        </div>

        {/* Bottom Primary Triggers Row: ADS Toggle + Big FIRE Trigger */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!hud.isAds) setSprintMode(false);
              onAdsToggle(!hud.isAds);
            }}
            className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center shadow-lg transition-colors ${
              hud.isAds
                ? 'bg-sky-600/85 border-sky-200 text-white'
                : 'bg-[#101814]/85 active:bg-sky-800 border-sky-500/75 text-sky-200'
            }`}
          >
            <Crosshair className="w-5 h-5" />
            <span className="text-[8.5px] font-black uppercase">VISER</span>
          </button>

          <button
            type="button"
            onPointerDown={handleFireDown}
            onPointerUp={handleFireUp}
            onPointerCancel={handleFireUp}
            className={`w-18 h-18 rounded-full border-2 flex flex-col items-center justify-center shadow-2xl transition-transform ${
              fireActive
                ? 'scale-95 bg-red-600/90 border-amber-200 text-white'
                : 'bg-[#3d1111]/85 border-red-400/85 text-red-100'
            }`}
          >
            <Crosshair className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-wider mt-0.5">TIR</span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};
