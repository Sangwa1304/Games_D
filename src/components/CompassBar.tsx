import React from 'react';
import { HudSnapshot, MinimapUnit } from '../game/types';

interface CompassBarProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  headingDeg: number;
  sectors: HudSnapshot['sectors'];
  orderMarkerPos: { x: number; z: number } | null;
  units: MinimapUnit[];
  compact?: boolean;
}

const HALF_SPAN_DEG = 75;

const COMPASS_TICKS: Array<{ deg: number; label?: string; major: boolean }> = [
  { deg: 0, label: 'N', major: true },
  { deg: 15, major: false },
  { deg: 30, major: false },
  { deg: 45, label: 'NE', major: true },
  { deg: 60, major: false },
  { deg: 75, major: false },
  { deg: 90, label: 'E', major: true },
  { deg: 105, major: false },
  { deg: 120, major: false },
  { deg: 135, label: 'SE', major: true },
  { deg: 150, major: false },
  { deg: 165, major: false },
  { deg: 180, label: 'S', major: true },
  { deg: 195, major: false },
  { deg: 210, major: false },
  { deg: 225, label: 'SO', major: true },
  { deg: 240, major: false },
  { deg: 255, major: false },
  { deg: 270, label: 'O', major: true },
  { deg: 285, major: false },
  { deg: 300, major: false },
  { deg: 315, label: 'NO', major: true },
  { deg: 330, major: false },
  { deg: 345, major: false },
];

function wrap180(deg: number): number {
  return ((deg + 540) % 360) - 180;
}

function getCardinalAbbrev(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export const CompassBar: React.FC<CompassBarProps> = ({
  playerX,
  playerZ,
  playerYaw,
  headingDeg,
  sectors,
  orderMarkerPos,
  units,
  compact = false,
}) => {
  const playerDeg = (((-playerYaw * 180) / Math.PI) % 360 + 360) % 360;

  const projectWorld = (wx: number, wz: number) => {
    const dx = wx - playerX;
    const dz = wz - playerZ;
    const dist = Math.round(Math.hypot(dx, dz));
    const bearingDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const delta = wrap180(bearingDeg - playerDeg);
    const clamped = Math.max(-72, Math.min(72, delta));
    const pct = 50 + (clamped / HALF_SPAN_DEG) * 50;
    const edgeSide: 'left' | 'right' | null =
      delta < -72 ? 'left' : delta > 72 ? 'right' : null;
    return { pct, dist, edgeSide };
  };

  const activeSectors = sectors.filter((s) => s.active);
  const detectedEnemies = units.filter((u) => !u.isAlly);

  return (
    <div
      className={`pointer-events-none select-none flex flex-col items-center ${
        compact ? 'w-[260px]' : 'w-[300px] sm:w-[400px]'
      }`}
      aria-label="Barre boussole tactique"
    >
      <div className="relative w-full h-8 rounded-md bg-gradient-to-b from-[#0b120e]/88 via-[#0b120e]/75 to-[#0b120e]/45 border border-stone-700/55 overflow-hidden">
        {/* Edge fade masks */}
        <div
          className="absolute inset-y-0 left-0 w-5 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, rgba(9,14,11,0.75), transparent)' }}
        />
        <div
          className="absolute inset-y-0 right-0 w-5 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(9,14,11,0.75), transparent)' }}
        />

        {/* Degree & Cardinal Ticks */}
        {COMPASS_TICKS.map((tick) => {
          const delta = wrap180(tick.deg - playerDeg);
          if (Math.abs(delta) > HALF_SPAN_DEG + 4) return null;
          const pct = 50 + (delta / HALF_SPAN_DEG) * 50;
          const isNorth = tick.deg === 0;
          return (
            <div
              key={tick.deg}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pct.toFixed(2)}%` }}
            >
              <div
                className={`w-px ${
                  isNorth
                    ? 'h-2.5 bg-amber-400'
                    : tick.major
                    ? 'h-2 bg-stone-300/75'
                    : 'h-1.5 bg-stone-500/55'
                }`}
              />
              {tick.label && (
                <span
                  className={`text-[9px] leading-none mt-0.5 tracking-tight ${
                    isNorth
                      ? 'font-black text-amber-300'
                      : tick.label.length === 1
                      ? 'font-extrabold text-stone-100/90'
                      : 'font-semibold text-stone-400/90'
                  }`}
                >
                  {tick.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Active Sectors (A..E) Projected along Compass */}
        {activeSectors.map((sec) => {
          const { pct, dist, edgeSide } = projectWorld(sec.x, sec.z);
          const bgClass =
            sec.owner === 'army'
              ? 'bg-sky-600/90 border-sky-300 text-white'
              : sec.owner === 'rebels'
              ? 'bg-red-600/90 border-red-300 text-white'
              : 'bg-amber-600/90 border-amber-200 text-stone-950';
          return (
            <div
              key={sec.id}
              className={`absolute bottom-0.5 -translate-x-1/2 flex items-center gap-0.5 ${
                edgeSide ? 'opacity-70' : 'opacity-95'
              }`}
              style={{ left: `${pct.toFixed(2)}%` }}
            >
              {edgeSide === 'left' && (
                <span className="text-[7.5px] font-black text-stone-300 leading-none">‹</span>
              )}
              <span
                className={`px-1 py-px rounded-[3px] border text-[8.5px] font-black leading-none shadow ${bgClass}`}
              >
                {sec.id}
              </span>
              {!edgeSide && (
                <span className="text-[7.5px] font-bold text-stone-200/90 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  {dist}m
                </span>
              )}
              {edgeSide === 'right' && (
                <span className="text-[7.5px] font-black text-stone-300 leading-none">›</span>
              )}
            </div>
          );
        })}

        {/* Active Cross-Com Order Waypoint */}
        {orderMarkerPos &&
          (() => {
            const { pct, dist, edgeSide } = projectWorld(orderMarkerPos.x, orderMarkerPos.z);
            return (
              <div
                className={`absolute bottom-0.5 -translate-x-1/2 flex items-center gap-0.5 ${
                  edgeSide ? 'opacity-75' : 'opacity-100'
                }`}
                style={{ left: `${pct.toFixed(2)}%` }}
              >
                <span className="w-2.5 h-2.5 rotate-45 rounded-[1px] bg-cyan-400 border border-white/90 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
                {!edgeSide && (
                  <span className="text-[7.5px] font-extrabold text-cyan-200 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                    {dist}m
                  </span>
                )}
              </div>
            );
          })()}

        {/* Proximate & Drone-Marked Enemies on Compass */}
        {detectedEnemies.map((u) => {
          const { pct, edgeSide } = projectWorld(u.x, u.z);
          return (
            <div
              key={u.id}
              className={`absolute top-2.5 -translate-x-1/2 ${
                edgeSide ? 'opacity-70' : 'opacity-100'
              }`}
              style={{ left: `${pct.toFixed(2)}%` }}
            >
              <div
                className={
                  u.marked
                    ? 'w-2.5 h-2.5 rotate-45 bg-orange-500 border border-amber-200 shadow-[0_0_8px_rgba(249,115,22,0.95)] animate-pulse'
                    : 'w-2 h-2 rotate-45 bg-red-500 border border-red-100 shadow-[0_0_5px_rgba(239,68,68,0.9)]'
                }
              />
            </div>
          );
        })}

        {/* Center Caret Marker */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-300" />
        </div>
      </div>

      {/* Tiny Heading Deg Pill */}
      <div className="-mt-1 px-1.5 py-px rounded bg-[#0b120e]/80 border border-stone-700/60 text-[8.5px] font-extrabold tracking-wider text-amber-300 tabular-nums leading-tight">
        {getCardinalAbbrev(headingDeg)} · {headingDeg}°
      </div>
    </div>
  );
};
