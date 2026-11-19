import React, { useMemo } from 'react';
import { BRIDGE_CROSSINGS_X, riverCenterZ } from '../game/terrain';
import { MinimapUnit } from '../game/types';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  units: MinimapUnit[];
  sectors: Array<{
    id: string;
    x: number;
    z: number;
    owner: 'army' | 'rebels' | 'neutral';
    active: boolean;
  }>;
  orderMarkerPos: { x: number; z: number } | null;
  enemyRadarRange?: number;
  size?: number;
}

const SIZE = 136;
const CENTER = SIZE / 2;
const RADAR_RADIUS_PX = 60;
const RADAR_RANGE_M = 68;
const SCALE = RADAR_RADIUS_PX / RADAR_RANGE_M;

function worldToRadar(
  wx: number,
  wz: number,
  px: number,
  pz: number,
  sinYaw: number,
  cosYaw: number,
  clampToRim = false
): { x: number; y: number; clamped: boolean } {
  const dx = wx - px;
  const dz = wz - pz;
  const fwd = dx * -sinYaw + dz * -cosYaw;
  const right = dx * cosYaw + dz * -sinYaw;

  let rx = right * SCALE;
  let ry = -fwd * SCALE;
  let clamped = false;

  if (clampToRim) {
    const distPx = Math.hypot(rx, ry);
    if (distPx > RADAR_RADIUS_PX - 3) {
      const k = (RADAR_RADIUS_PX - 3) / distPx;
      rx *= k;
      ry *= k;
      clamped = true;
    }
  }

  return { x: CENTER + rx, y: CENTER + ry, clamped };
}

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerYaw,
  units,
  sectors,
  orderMarkerPos,
  enemyRadarRange = 32,
  size = SIZE,
}) => {
  const sinYaw = Math.sin(playerYaw);
  const cosYaw = Math.cos(playerYaw);

  const riverPoints = useMemo(() => {
    const pts: string[] = [];
    for (let wx = -175; wx <= 175; wx += 14) {
      const wz = riverCenterZ(wx);
      const p = worldToRadar(wx, wz, playerX, playerZ, sinYaw, cosYaw, false);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [playerX, playerZ, sinYaw, cosYaw]);

  const bridgeSegments = useMemo(() => {
    return BRIDGE_CROSSINGS_X.map((bx) => {
      const cz = riverCenterZ(bx);
      return {
        bx,
        s: worldToRadar(bx, cz - 11.5, playerX, playerZ, sinYaw, cosYaw, false),
        e: worldToRadar(bx, cz + 11.5, playerX, playerZ, sinYaw, cosYaw, false),
      };
    });
  }, [playerX, playerZ, sinYaw, cosYaw]);

  const proximityRadiusPx = Math.min(RADAR_RADIUS_PX - 2, enemyRadarRange * SCALE);
  const northLabelPos = worldToRadar(playerX, playerZ - 64, playerX, playerZ, sinYaw, cosYaw, true);

  return (
    <div className="pointer-events-none select-none flex flex-col items-center">
      <div className="rounded-lg bg-[#0b120e]/88 border border-stone-700/80 p-2 shadow-lg">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="block rounded-full bg-[#09100c]"
          aria-label="Carte tactique"
        >
          <defs>
            <clipPath id="kivu-minimap-clip">
              <circle cx={CENTER} cy={CENTER} r={RADAR_RADIUS_PX + 2} />
            </clipPath>
          </defs>

          <g clipPath="url(#kivu-minimap-clip)">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADAR_RADIUS_PX}
              fill="#0d1711"
              stroke="#29352d"
              strokeWidth="1"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={proximityRadiusPx}
              fill="none"
              stroke="#991b1b"
              strokeOpacity="0.45"
              strokeWidth="0.9"
              strokeDasharray="3 3"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADAR_RADIUS_PX * 0.3}
              fill="none"
              stroke="#26332a"
              strokeWidth="0.7"
            />

            {/* Kivu River path */}
            <polyline
              points={riverPoints}
              fill="none"
              stroke="#1e4847"
              strokeWidth={14 * SCALE}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.78"
            />

            {/* All 3 Tactical River Bridges */}
            {bridgeSegments.map((b) => (
              <line
                key={b.bx}
                x1={b.s.x}
                y1={b.s.y}
                x2={b.e.x}
                y2={b.e.y}
                stroke={b.bx === 78 ? '#78848c' : '#a17b4e'}
                strokeWidth={3.6}
                strokeLinecap="butt"
              />
            ))}

            {/* Player sight cone */}
            <path
              d={`M ${CENTER} ${CENTER} L ${CENTER - 22} ${CENTER - 38} A 44 44 0 0 1 ${CENTER + 22} ${CENTER - 38} Z`}
              fill="#f59e0b"
              fillOpacity="0.09"
            />

            {/* Active Sectors */}
            {sectors
              .filter((s) => s.active)
              .map((sec) => {
                const p = worldToRadar(sec.x, sec.z, playerX, playerZ, sinYaw, cosYaw, true);
                const fill =
                  sec.owner === 'army'
                    ? '#0284c7'
                    : sec.owner === 'rebels'
                    ? '#dc2626'
                    : '#d97706';
                return (
                  <g key={sec.id} transform={`translate(${p.x}, ${p.y})`}>
                    <rect
                      x={-5.5}
                      y={-5.5}
                      width={11}
                      height={11}
                      rx={2}
                      fill={fill}
                      fillOpacity="0.85"
                      stroke="#0b120e"
                      strokeWidth="1"
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="7.5"
                      fontWeight="800"
                    >
                      {sec.id}
                    </text>
                  </g>
                );
              })}

            {/* Active Cross-Com Waypoint */}
            {orderMarkerPos &&
              (() => {
                const om = worldToRadar(
                  orderMarkerPos.x,
                  orderMarkerPos.z,
                  playerX,
                  playerZ,
                  sinYaw,
                  cosYaw,
                  true
                );
                return (
                  <g transform={`translate(${om.x}, ${om.y})`}>
                    <circle r={4.5} fill="none" stroke="#38bdf8" strokeWidth="1.3" />
                    <circle r={1.6} fill="#38bdf8" />
                  </g>
                );
              })()}

            {/* Allies & Proximity Enemies */}
            {units.map((u) => {
              const p = worldToRadar(u.x, u.z, playerX, playerZ, sinYaw, cosYaw, u.isAlly);
              if (u.isAlly) {
                const color = u.isHuman ? '#22d3ee' : u.isWounded ? '#34d399' : '#38bdf8';
                return (
                  <g key={u.id} transform={`translate(${p.x}, ${p.y})`}>
                    <circle
                      r={u.isHuman ? 3.8 : u.rankLevel >= 4 ? 3.5 : 2.9}
                      fill={color}
                      stroke="#08131a"
                      strokeWidth="1"
                    />
                    {u.isHuman && (
                      <circle r={6.0} fill="none" stroke="#67e8f9" strokeWidth="1" />
                    )}
                    {!u.isHuman && u.rankLevel >= 4 && (
                      <circle r={5.4} fill="none" stroke="#fbbf24" strokeWidth="0.9" strokeOpacity="0.85" />
                    )}
                  </g>
                );
              }
              return (
                <g key={u.id} transform={`translate(${p.x}, ${p.y})`}>
                  {u.marked && (
                    <circle r={6.2} fill="none" stroke="#fb923c" strokeWidth="1.1" strokeOpacity="0.9" />
                  )}
                  <polygon
                    points="0,-4 4,0 0,4 -4,0"
                    fill={u.marked ? '#f97316' : '#ef4444'}
                    stroke={u.marked ? '#fef08a' : '#240808'}
                    strokeWidth="0.9"
                  />
                  {u.isHuman && (
                    <circle r={6.0} fill="none" stroke="#fca5a5" strokeWidth="0.9" />
                  )}
                </g>
              );
            })}

            {/* Player Center Chevron */}
            <polygon
              points={`${CENTER},${CENTER - 5.5} ${CENTER + 4},${CENTER + 4} ${CENTER},${CENTER + 1.8} ${CENTER - 4},${CENTER + 4}`}
              fill="#fbbf24"
              stroke="#14110a"
              strokeWidth="0.9"
            />
          </g>

          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADAR_RADIUS_PX + 2}
            fill="none"
            stroke="#3f4a43"
            strokeWidth="1.2"
          />
          <text
            x={northLabelPos.x}
            y={northLabelPos.y + 2.5}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="7.5"
            fontWeight="900"
          >
            N
          </text>
        </svg>

        <div className="mt-1 flex items-center justify-between px-1 text-[9px] font-bold tracking-wide text-stone-400">
          <span className="text-sky-300">● ALLIÉS</span>
          <span className="text-red-400">◆ ENN. ≤{enemyRadarRange}m</span>
        </div>
      </div>
    </div>
  );
};
