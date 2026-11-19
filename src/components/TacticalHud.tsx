import React from 'react';
import {
  Award,
  CloudFog,
  Crosshair,
  Flame,
  Maximize2,
  Minimize2,
  Pause,
  Radar,
  Radio,
  Shield,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TACTICAL_ORDERS } from '../game/ranks';
import { HudSnapshot } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';
import { CompassBar } from './CompassBar';
import { TouchActionId, TouchControls } from './TouchControls';

interface TacticalHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onRequestLock: () => void;
  onToggleFullscreen: () => void;
  onSkipKillcam: () => void;
  onTouchMove: (x: number, y: number, sprint: boolean) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchFire: (held: boolean) => void;
  onTouchAds: (active: boolean) => void;
  onTouchAction: (action: TouchActionId) => void;
}

function formatTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const min = Math.floor(s / 60);
  const rem = s % 60;
  return `${min}:${rem.toString().padStart(2, '0')}`;
}

export const TacticalHud: React.FC<TacticalHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onRequestLock,
  onToggleFullscreen,
  onSkipKillcam,
  onTouchMove,
  onTouchLookDelta,
  onTouchFire,
  onTouchAds,
  onTouchAction,
}) => {
  const isTdm = hud.combatMode === 'tdm';
  const leftVal = isTdm ? hud.armyScore : hud.armyTickets;
  const rightVal = isTdm ? hud.rebelScore : hud.rebelTickets;
  const denom = Math.max(1, isTdm ? hud.scoreLimit : hud.maxTickets);
  const armyPct = Math.min(100, Math.round((leftVal / denom) * 100));
  const rebelPct = Math.min(100, Math.round((rightVal / denom) * 100));

  const gap = Math.min(34, Math.max(6, hud.crosshairSpread));
  const showSniperScope = hud.isAds && hud.weaponCategory === 'sniper' && hud.hp > 0 && !hud.droneActive;
  const activeScopeType = WEAPON_SPECS[hud.weaponId]?.scopeType ?? 'pso';
  const killcamActive = hud.hp <= 0 && Boolean(hud.killcam?.active);

  const postureLabel = hud.isSliding
    ? 'GLISSADE'
    : hud.isDiving
    ? 'PLONGEON'
    : hud.isProne
    ? 'ALLONGÉ'
    : hud.isInWater
    ? 'GUÉ'
    : hud.isCrouching
    ? 'ACCROUPI'
    : hud.isTacSprinting
    ? 'SPRINT TAC.'
    : hud.isSprinting
    ? 'SPRINT'
    : 'DEBOUT';

  // Intensité de dégâts & pulsation rouge sur les bords (s'intensifie quand les PV chutent)
  const hpRatio = Math.max(0, Math.min(1, hud.hp / Math.max(1, hud.maxHp)));
  const damageSeverity = hud.hp > 0 ? Math.max(0, 1 - hpRatio) : 1;
  const hitSpike = Math.max(0, Math.min(1, hud.damageFlash));
  const showEdgeDamage = hud.hp <= 0 || damageSeverity > 0.04 || hitSpike > 0.02;
  const edgeSpreadPct = Math.round(76 - damageSeverity * 38 - hitSpike * 16);
  const edgeAlpha = Math.min(0.92, damageSeverity * 0.68 + hitSpike * 0.56);
  const pulseDurationSec = Math.max(0.48, 1.35 - damageSeverity * 0.85);
  const insetShadowPx = Math.round(28 + damageSeverity * 95 + hitSpike * 55);

  // Directional crimson edge origin when struck by enemy fire
  let dirEdgeCenter = '50% 50%';
  if (hud.damageDirectionAngle !== null && hitSpike > 0.04) {
    const px = 50 + Math.sin(hud.damageDirectionAngle) * 48;
    const py = 50 - Math.cos(hud.damageDirectionAngle) * 48;
    dirEdgeCenter = `${px.toFixed(1)}% ${py.toFixed(1)}%`;
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Pulsing Crimson Screen-Edge Damage Vignette (escalates as HP drops) */}
      {showEdgeDamage && (
        <div
          className="fixed inset-0 animate-kivu-edge-pulse"
          style={{
            animationDuration: `${pulseDurationSec.toFixed(2)}s`,
            opacity: Math.max(0.18, Math.min(1, damageSeverity * 0.95 + hitSpike * 0.75)),
            background: `radial-gradient(ellipse at center, transparent ${edgeSpreadPct}%, rgba(153, 27, 27, ${edgeAlpha.toFixed(
              2
            )}) 92%, rgba(95, 10, 10, ${Math.min(0.96, edgeAlpha + 0.22).toFixed(2)}) 100%)`,
            boxShadow: `inset 0 0 ${insetShadowPx}px rgba(185, 28, 28, ${Math.min(
              0.88,
              0.22 + damageSeverity * 0.6 + hitSpike * 0.45
            ).toFixed(2)})`,
          }}
        />
      )}

      {/* Directional Crimson Hit Flare on the Struck Edge */}
      {hitSpike > 0.03 && hud.damageDirectionAngle !== null && (
        <div
          className="fixed inset-0"
          style={{
            background: `radial-gradient(circle at ${dirEdgeCenter}, rgba(220, 38, 38, ${(
              hitSpike * 0.68
            ).toFixed(2)}) 0%, rgba(185, 28, 28, ${(hitSpike * 0.28).toFixed(2)}) 26%, transparent 56%)`,
          }}
        />
      )}

      {/* Directional Red Shot / Hit Arrows pointing toward active shooters */}
      {!killcamActive && hud.hp > 0 && hud.shotIndicators.length > 0 && (
        <div className="fixed inset-0 pointer-events-none">
          {hud.shotIndicators.map((ind) => {
            const deg = (ind.angleRad * 180) / Math.PI;
            const radiusPx = ind.isHit ? 116 : 132;
            const opacity = Math.max(0.08, Math.min(1, ind.intensity));
            const scale = ind.isHit ? 1.06 + ind.intensity * 0.12 : 0.88 + ind.intensity * 0.08;
            return (
              <div
                key={ind.id}
                className="fixed left-1/2 top-1/2 pointer-events-none"
                style={{
                  transform: `translate(-50%, -50%) rotate(${deg.toFixed(1)}deg)`,
                  opacity,
                }}
              >
                <div
                  style={{
                    transform: `translateY(-${radiusPx}px) scale(${scale.toFixed(2)})`,
                  }}
                >
                  <svg
                    viewBox="0 0 44 38"
                    className={ind.isHit ? 'w-11 h-9 drop-shadow-[0_0_8px_rgba(220,38,38,0.85)]' : 'w-9 h-8 drop-shadow-[0_0_5px_rgba(239,68,68,0.65)]'}
                  >
                    {ind.isHit ? (
                      <>
                        {/* Solid tactical impact arrow + flank arc */}
                        <path
                          d="M22 3 L38 25 L29 22 L22 34 L15 22 L6 25 Z"
                          fill="#ef4444"
                          stroke="#450a0a"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 30 Q22 25 35 30"
                          fill="none"
                          stroke="#fca5a5"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                        />
                      </>
                    ) : (
                      /* Sleek incoming suppressive-fire directional red chevron arrow */
                      <path
                        d="M22 5 L36 27 L27 23 L22 31 L17 23 L8 27 Z"
                        fill="#dc2626"
                        fillOpacity="0.82"
                        stroke="#fecaca"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subtle MW4 Cover Auto-Regen Border Shimmer */}
      {hud.isRegenerating && hud.hp > 0 && hud.hp < hud.maxHp && (
        <div
          className="fixed inset-0 animate-kivu-regen"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 74%, rgba(16, 185, 129, 0.22) 100%)',
          }}
        />
      )}

      {/* Tactical Smoke Screen Soft Edge Mist */}
      {hud.inSmokeCover && hud.hp > 0 && (
        <div
          className="fixed inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(168, 166, 158, 0.28) 25%, rgba(120, 122, 114, 0.56) 100%)',
          }}
        />
      )}

      {/* Thermal Burn Screen-Edge Pulse when hit by Flamethrower */}
      {hud.isBurning && hud.hp > 0 && (
        <>
          <div
            className="fixed inset-0 animate-kivu-edge-pulse"
            style={{
              animationDuration: '0.52s',
              opacity: Math.max(0.35, hud.burnIntensity),
              background:
                'radial-gradient(ellipse at center, transparent 52%, rgba(234, 88, 12, 0.42) 86%, rgba(185, 28, 28, 0.72) 100%)',
              boxShadow: 'inset 0 0 68px rgba(249, 115, 22, 0.65)',
            }}
          />
          <div className="fixed top-20 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#2b1008]/92 border border-orange-500/80 text-[11px] font-black uppercase tracking-widest text-orange-300 shadow-lg">
            <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span>BRÛLURE ACTIVE · REJOINDRE L&apos;EAU POUR ÉTEINDRE</span>
          </div>
        </>
      )}

      {/* Multi-Reticle Precision Sniper Scope Overlay with Live Calibrated Zoom & Vertical Drop */}
      {showSniperScope && (() => {
        const impactY = Math.min(186, Math.max(100, 100 + hud.scopeDropSvgUnits));
        const enemyLocked = hud.aimingAtEnemy;
        let lastLabelY = 100;
        const visibleTicks = hud.scopeDropTicks.map((tick) => {
          const showLabel = tick.ySvg >= 103.2 && tick.ySvg - lastLabelY >= 4.4 && tick.ySvg <= 184;
          if (showLabel) lastLabelY = tick.ySvg;
          return { ...tick, showLabel };
        });

        return (
          <div className="fixed inset-0 flex items-center justify-center">
            <div
              className="w-full h-full flex flex-col items-center justify-center relative"
              style={{
                background:
                  'radial-gradient(circle at center, transparent 28.5%, rgba(6, 9, 8, 0.97) 30%)',
              }}
            >
              <svg viewBox="0 0 200 200" className="w-[57vmin] h-[57vmin]">
                <circle cx="100" cy="100" r="96" fill="none" stroke="#1c1917" strokeWidth="2.4" />
                {activeScopeType === 'mildot' ? (
                  <>
                    <line x1="10" y1="100" x2="190" y2="100" stroke="#0f172a" strokeWidth="0.7" />
                    <line x1="100" y1="10" x2="100" y2="190" stroke="#0f172a" strokeWidth="0.7" />
                    {[40, 55, 70, 85, 115, 130, 145, 160].map((pos) => (
                      <React.Fragment key={pos}>
                        <circle cx={pos} cy="100" r="1.15" fill="#0f172a" />
                        <circle cx="100" cy={pos} r="1.15" fill="#0f172a" />
                      </React.Fragment>
                    ))}
                  </>
                ) : activeScopeType === 'heavy' ? (
                  <>
                    <line x1="10" y1="100" x2="84" y2="100" stroke="#0f172a" strokeWidth="1.4" />
                    <line x1="116" y1="100" x2="190" y2="100" stroke="#0f172a" strokeWidth="1.4" />
                    <line x1="100" y1="12" x2="100" y2="84" stroke="#0f172a" strokeWidth="1.1" />
                    <line x1="100" y1="116" x2="100" y2="188" stroke="#0f172a" strokeWidth="1.4" />
                    <line x1="84" y1="100" x2="116" y2="100" stroke="#0f172a" strokeWidth="0.55" />
                    <line x1="100" y1="84" x2="100" y2="116" stroke="#0f172a" strokeWidth="0.55" />
                  </>
                ) : (
                  <>
                    {/* Illuminated PSO-1 stadia */}
                    <line x1="12" y1="100" x2="90" y2="100" stroke="#0f172a" strokeWidth="0.95" />
                    <line x1="110" y1="100" x2="188" y2="100" stroke="#0f172a" strokeWidth="0.95" />
                    {[42, 58, 74, 126, 142, 158].map((tickX) => (
                      <line key={tickX} x1={tickX} y1="97.5" x2={tickX} y2="102.5" stroke="#0f172a" strokeWidth="0.8" />
                    ))}
                    <line x1="100" y1="104" x2="100" y2="184" stroke="#0f172a" strokeWidth="0.95" />
                    <polyline
                      points="95.5,104.5 100,100 104.5,104.5"
                      fill="none"
                      stroke={enemyLocked ? '#ef4444' : '#f59e0b'}
                      strokeWidth="1.25"
                    />
                  </>
                )}

                {/* Calibrated Vertical Ballistic Drop Stadia Ticks (75m, 125m, 175m, 225m) */}
                {visibleTicks.map((tick) =>
                  tick.ySvg >= 100.7 && tick.ySvg <= 186 ? (
                    <g key={tick.dist}>
                      <line
                        x1="96.8"
                        y1={tick.ySvg}
                        x2="103.2"
                        y2={tick.ySvg}
                        stroke="#38bdf8"
                        strokeOpacity="0.82"
                        strokeWidth="0.7"
                      />
                      {tick.showLabel && (
                        <text
                          x="105.5"
                          y={tick.ySvg + 1.3}
                          fill="#bae6fd"
                          fillOpacity="0.85"
                          fontSize="4.1"
                          fontWeight="700"
                          fontFamily="monospace"
                        >
                          {tick.dist}m
                        </text>
                      )}
                    </g>
                  ) : null
                )}

                {/* Live Vertical Drop Axis & Calculated Impact Point */}
                {impactY > 100.6 && (
                  <>
                    <line
                      x1="100"
                      y1="100"
                      x2="100"
                      y2={impactY}
                      stroke={enemyLocked ? '#ef4444' : '#fbbf24'}
                      strokeWidth="0.75"
                      strokeDasharray="1.6 1.2"
                      strokeOpacity="0.9"
                    />
                    <line
                      x1="94.8"
                      y1={impactY}
                      x2="105.2"
                      y2={impactY}
                      stroke={enemyLocked ? '#ef4444' : '#fbbf24'}
                      strokeWidth="1.0"
                    />
                    <circle
                      cx="100"
                      cy={impactY}
                      r="1.35"
                      fill={enemyLocked ? '#ef4444' : '#fbbf24'}
                      stroke="#090d0b"
                      strokeWidth="0.45"
                    />
                  </>
                )}

                {/* Center Aiming Dot (Crimson Target Lock when hovering enemy through fog/smoke) */}
                {enemyLocked && (
                  <circle
                    cx="100"
                    cy="100"
                    r="3.2"
                    fill="none"
                    stroke="#ef4444"
                    strokeOpacity="0.78"
                    strokeWidth="0.8"
                  />
                )}
                <circle
                  cx="100"
                  cy="100"
                  r={enemyLocked ? 1.6 : 1.0}
                  fill={enemyLocked ? '#ef4444' : activeScopeType === 'heavy' ? '#22c55e' : '#e7e5e4'}
                />
              </svg>

              <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded bg-[#0c120e]/90 border border-sky-700/70 text-[11px] font-bold uppercase tracking-wider text-sky-300 tabular-nums">
                <span>Optique {hud.sniperZoomLabel || '6×'}</span>
                {hud.scopeRangeMeters !== null && (
                  <>
                    <span className="text-stone-500">·</span>
                    <span className="text-amber-300">Dist. {hud.scopeRangeMeters}m</span>
                  </>
                )}
                {enemyLocked && hud.aimingEnemyDist !== null && (
                  <>
                    <span className="text-stone-500">·</span>
                    <span className="text-red-400 font-black">CIBLE {hud.aimingEnemyDist}m</span>
                  </>
                )}
                <span className="text-stone-500">·</span>
                <span className="text-stone-300">
                  [{hud.gamepadConnected ? 'L3' : 'Shift / Molette'}] Zoom
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Virtual Touch Controls — Displayed ONLY on phones when controller is disconnected */}
      <TouchControls
        hud={hud}
        onMove={onTouchMove}
        onLookDelta={onTouchLookDelta}
        onFire={onTouchFire}
        onAdsToggle={onTouchAds}
        onAction={onTouchAction}
      />

      {/* Top Left: Ultra-Minimal Icon Controls Only (No cards, no minimap, no menus) */}
      {!killcamActive && (
        <div className="fixed top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 z-20 pointer-events-auto">
          {hud.isMobileDevice ? (
            <>
              <button
                type="button"
                onClick={() => onTouchAction('pause')}
                title="Paramètres & Carte"
                aria-label="Ouvrir les paramètres et la carte"
                className="p-1.5 rounded-md bg-[#0b120e]/80 border border-stone-600/50 text-amber-300/95 active:scale-95 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={hud.isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
                aria-label="Basculer en plein écran"
                className="p-1.5 rounded-md bg-[#0b120e]/80 border border-stone-600/50 text-sky-300/95 active:scale-95 cursor-pointer"
              >
                {hud.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Activer le son' : 'Couper le son'}
              aria-label={muted ? 'Activer le son' : 'Couper le son'}
              className="p-1.5 rounded bg-[#0b120e]/75 border border-stone-700/50 text-stone-200 hover:border-stone-500 cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          )}
        </div>
      )}

      {/* Top Center: Compact Score Strip + Tactical Compass Bar (Essential Points Only) */}
      {!killcamActive && (
        <div className="fixed top-1.5 sm:top-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 w-max max-w-[94vw] pointer-events-none z-10">
          {/* Ultra-compact Score / Timer Strip */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-0.5 rounded bg-[#0b120e]/80 border border-stone-700/55 text-[10px] tabular-nums">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-sky-400">A</span>
              <div className="w-8 sm:w-12 h-1 bg-stone-800/90 rounded overflow-hidden">
                <div className="h-full bg-sky-500 transition-all duration-200" style={{ width: `${armyPct}%` }} />
              </div>
              <span className="font-extrabold text-stone-100">{leftVal}</span>
            </div>

            <span className="px-1.5 border-x border-stone-700/60 font-bold text-stone-300">
              {formatTimer(hud.matchTimeRemaining)}
            </span>

            <div className="flex items-center gap-1">
              <span className="font-extrabold text-stone-100">{rightVal}</span>
              <div className="w-8 sm:w-12 h-1 bg-stone-800/90 rounded overflow-hidden flex justify-end">
                <div className="h-full bg-red-500 transition-all duration-200" style={{ width: `${rebelPct}%` }} />
              </div>
              <span className="font-extrabold text-red-400">R</span>
            </div>
          </div>

          {/* Scrolling Compass Bar showing Cardinals, Sectors, Order Waypoint & Enemies */}
          <CompassBar
            playerX={hud.playerPosX}
            playerZ={hud.playerPosZ}
            playerYaw={hud.playerYaw}
            headingDeg={hud.compassHeadingDeg}
            sectors={hud.sectors}
            orderMarkerPos={hud.orderMarkerPos}
            units={hud.minimapUnits}
            compact={hud.isPortrait || hud.isMobileDevice}
          />

          {hud.radioBanner && (
            <div className="px-2.5 py-0.5 rounded bg-[#0b120e]/65 border border-amber-600/40 text-[10px] font-semibold tracking-wide text-amber-200 max-w-[84vw] truncate">
              {hud.radioBanner}
            </div>
          )}
        </div>
      )}

      {/* Top Right Compact Kill Feed (Desktop md+ only — hidden on mobile/Android for clear view) */}
      {!killcamActive && !hud.isMobileDevice && (
        <div className="hidden md:flex fixed top-3 right-3 flex-col items-end gap-1">
          {hud.killFeed.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="px-2 py-0.5 rounded bg-[#0b120e]/60 border border-stone-800/60 text-[10px] flex items-center gap-1.5"
            >
              <span className={item.killerFaction === 'army' ? 'text-sky-400 font-semibold' : 'text-red-400 font-semibold'}>
                {item.killerName}
              </span>
              <span className="text-stone-500">[{item.weaponLabel}{item.isHeadshot ? '·TÊTE' : ''}]</span>
              <span className={item.victimFaction === 'army' ? 'text-sky-300' : 'text-red-300'}>
                {item.victimName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recon Drone Cross-Com EO/Thicket-Spotting Visor */}
      {hud.droneActive && hud.hp > 0 && !killcamActive && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          {/* Subtle Electro-Optical Frame Vignette */}
          <div
            className="fixed inset-0"
            style={{
              background:
                'radial-gradient(circle at center, rgba(14, 116, 144, 0.05) 38%, rgba(4, 15, 22, 0.56) 100%)',
            }}
          />

          {/* Top-under-compass Telemetry Bar */}
          <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded bg-[#07151c]/88 border border-cyan-500/55 text-[10px] font-bold uppercase tracking-wider text-cyan-200 tabular-nums shadow-lg">
            <span className="inline-flex items-center gap-1 text-cyan-300 font-black">
              <Radar className="w-3.5 h-3.5 animate-pulse" />
              DRONE RECON
            </span>
            <span className="text-stone-500">·</span>
            <span className={hud.droneBattery <= 25 ? 'text-red-400 font-black' : 'text-emerald-300'}>
              BAT {hud.droneBattery}%
            </span>
            <span className="text-stone-500">·</span>
            <span>
              {hud.droneRangeMeters}/{hud.droneMaxRange}m
            </span>
            <span className="text-stone-500">·</span>
            <span>ALT {hud.droneAltitudeMeters}m</span>
            {hud.droneMarkedCount > 0 && (
              <>
                <span className="text-stone-500">·</span>
                <span className="text-orange-300 font-black">
                  {hud.droneMarkedCount} MARQUÉ{hud.droneMarkedCount > 1 ? 'S' : ''}
                </span>
              </>
            )}
          </div>

          {/* Optical Spotting Brackets */}
          <div className="relative w-40 h-28 flex items-center justify-center">
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/80" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/80" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/80" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/80" />

            <div
              className={`w-3 h-3 rotate-45 border-2 transition-colors ${
                hud.droneAimingEnemy
                  ? 'border-orange-400 bg-orange-500/70 scale-125 shadow-[0_0_10px_rgba(249,115,22,0.95)]'
                  : 'border-cyan-300/85 bg-transparent'
              }`}
            />
          </div>

          {/* Target Lock in Thicket + Action Prompt */}
          {hud.droneAimingEnemy && hud.droneAimingEnemyDist !== null && (
            <div className="absolute top-[calc(50%+36px)] flex flex-col items-center gap-1">
              <div className="px-2.5 py-0.5 rounded bg-[#210d08]/92 border border-orange-500/80 text-[10px] font-black tracking-wider text-orange-300 tabular-nums shadow">
                CIBLE FOURRÉ · {hud.droneAimingEnemyDist}m
                {hud.droneAimingEnemyName ? ` · ${hud.droneAimingEnemyName}` : ''}
              </div>
              {!hud.isMobileDevice && (
                <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-200 bg-[#07151c]/88 px-2 py-0.5 rounded border border-cyan-600/60">
                  {hud.gamepadConnected
                    ? '[R2 / □] Marquer · [D-Pad →] Ordre 1 Sub.'
                    : '[Clic G / M] Marquer · [F / F2] Ordre 1 Sub.'}
                </div>
              )}
            </div>
          )}

          {!hud.isMobileDevice && (
            <div className="fixed bottom-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-[#07151c]/85 border border-cyan-700/55 text-[9.5px] font-semibold tracking-wide text-cyan-200">
              {hud.gamepadConnected
                ? 'Stick G Vol · Stick D Caméra · ✕/○ Altitude · R2 Marquer · D-Pad ↓ Maintenu / △ Rappeler'
                : 'WASD/ZQSD Vol · Espace/C Altitude · Clic G / M Marquer · F/F2 Éliminer (1 sub.) · H/4/Clic D Rappeler'}
            </div>
          )}
        </div>
      )}

      {/* Center Reticle & Hitmarker */}
      {hud.hp > 0 && !showSniperScope && !hud.droneActive && (
        <div className="fixed inset-0 flex items-center justify-center">
          {!hud.isAds ? (
            <div className="relative w-1 h-1 flex items-center justify-center">
              <span
                className={`absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 shadow-[0_0_2px_rgba(0,0,0,0.9)] ${
                  hud.aimingAtEnemy ? 'bg-red-400/95' : 'bg-stone-100/90'
                }`}
                style={{ bottom: `${gap}px` }}
              />
              <span
                className={`absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 shadow-[0_0_2px_rgba(0,0,0,0.9)] ${
                  hud.aimingAtEnemy ? 'bg-red-400/95' : 'bg-stone-100/90'
                }`}
                style={{ top: `${gap}px` }}
              />
              <span
                className={`absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 shadow-[0_0_2px_rgba(0,0,0,0.9)] ${
                  hud.aimingAtEnemy ? 'bg-red-400/95' : 'bg-stone-100/90'
                }`}
                style={{ right: `${gap}px` }}
              />
              <span
                className={`absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 shadow-[0_0_2px_rgba(0,0,0,0.9)] ${
                  hud.aimingAtEnemy ? 'bg-red-400/95' : 'bg-stone-100/90'
                }`}
                style={{ left: `${gap}px` }}
              />
              {hud.aimingAtEnemy && (
                <span className="w-2 h-2 rounded-full bg-red-500 ring-1 ring-red-200/90 shadow-[0_0_8px_rgba(239,68,68,1)]" />
              )}
            </div>
          ) : (
            <div
              className={
                hud.aimingAtEnemy
                  ? 'w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-300/85 shadow-[0_0_9px_rgba(239,68,68,1)]'
                  : 'w-[3px] h-[3px] rounded-full bg-stone-100/85 shadow-[0_0_3px_rgba(0,0,0,0.95)]'
              }
            />
          )}

          {/* Compact Enemy Distance & Tom Clancy Single-Subordinate Lock Hint */}
          {hud.aimingAtEnemy &&
            !hud.aimingAtAlly &&
            hud.friendlyFireWarnTimer <= 0 &&
            hud.aimingEnemyDist !== null && (
              <div className="absolute top-[calc(50%+20px)] flex flex-col items-center gap-0.5 pointer-events-none">
                <div className="text-[9.5px] font-black tracking-wider text-red-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] tabular-nums">
                  {hud.aimingEnemyDist}m{hud.aimingEnemyName ? ` · ${hud.aimingEnemyName}` : ''}
                </div>
                {!hud.isMobileDevice && hud.subordinatesCount > 0 && (
                  <div className="text-[8px] font-bold tracking-wider uppercase text-red-200/90 bg-red-950/70 px-1.5 py-0.5 rounded border border-red-500/40">
                    {hud.gamepadConnected ? 'D-Pad → Éliminer (1 sub.)' : 'F / F2 Éliminer (1 sub.)'}
                  </div>
                )}
              </div>
            )}

          {hud.hitMarkerTimer > 0 && (
            <svg viewBox="0 0 32 32" className="absolute w-7 h-7">
              <line
                x1="6"
                y1="6"
                x2="12"
                y2="12"
                stroke={hud.hitMarkerHeadshot ? '#ef4444' : '#f5f5f4'}
                strokeWidth="2.2"
              />
              <line
                x1="26"
                y1="6"
                x2="20"
                y2="12"
                stroke={hud.hitMarkerHeadshot ? '#ef4444' : '#f5f5f4'}
                strokeWidth="2.2"
              />
              <line
                x1="6"
                y1="26"
                x2="12"
                y2="20"
                stroke={hud.hitMarkerHeadshot ? '#ef4444' : '#f5f5f4'}
                strokeWidth="2.2"
              />
              <line
                x1="26"
                y1="26"
                x2="20"
                y2="20"
                stroke={hud.hitMarkerHeadshot ? '#ef4444' : '#f5f5f4'}
                strokeWidth="2.2"
              />
            </svg>
          )}

          {/* Real-Time Friendly Fire (IFF) Reticle Indicator */}
          {(hud.aimingAtAlly || hud.friendlyFireWarnTimer > 0) && (
            <div className="absolute top-[calc(50%+30px)] flex flex-col items-center gap-0.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              <div
                className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${
                  hud.friendlyFireWarnTimer > 0 ? 'text-red-400' : 'text-amber-300'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {hud.friendlyFireWarnTimer > 0
                    ? 'TIR AMI — CESSEZ LE FEU'
                    : `ALLIÉ · ${hud.aimingAtAlly?.name}`}
                </span>
                {hud.aimingAtAlly && (
                  <span className="text-[10px] font-bold text-stone-200 tabular-nums">
                    · {hud.aimingAtAlly.distance}m
                  </span>
                )}
              </div>
              <div
                className={`h-[2px] w-28 ${
                  hud.friendlyFireWarnTimer > 0 ? 'bg-red-500/90' : 'bg-amber-400/75'
                }`}
              />
            </div>
          )}
        </div>
      )}

      {/* Pointer Lock Prompt (Hidden when DualShock connected OR on Touch Phone) */}
      {!hud.pointerLocked && !hud.gamepadConnected && !hud.isMobileDevice && hud.hp > 0 && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-auto">
          <button
            type="button"
            onClick={onRequestLock}
            className="px-5 py-2.5 rounded-lg bg-[#101713]/95 border border-amber-500/80 text-amber-200 text-xs font-bold uppercase tracking-widest cursor-pointer shadow-xl"
          >
            Cliquer pour verrouiller la visée (Souris · Echap Paramètres)
          </button>
        </div>
      )}

      {/* Brief fatal-hit screen (0.35s) before 3s Killcam begins */}
      {hud.hp <= 0 && !killcamActive && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/45">
          <div className="px-6 py-4 rounded-lg bg-[#121713]/95 border border-red-700/70 text-center">
            <div className="text-sm font-bold uppercase tracking-widest text-red-400">
              Hors de combat
            </div>
            <div className="text-lg font-black text-stone-100 mt-1 tabular-nums">
              Analyse balistique · {hud.respawnTimer.toFixed(1)}s
            </div>
          </div>
        </div>
      )}

      {/* 3-Second Tactical Killcam Replay Overlay (Center 3D Perspective Kept Clear) */}
      {killcamActive && hud.killcam && (
        <>
          <div className="fixed inset-x-0 top-0 pt-4 pb-8 px-6 bg-gradient-to-b from-[#070b09]/92 via-[#070b09]/55 to-transparent flex flex-col items-center">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-red-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              <Crosshair className="w-3.5 h-3.5" />
              <span>Killcam · Perspective Adverse</span>
              {hud.killcam.isHeadshot && (
                <span className="text-amber-300">· Tir Tête</span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-sm font-extrabold text-stone-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              <span
                className={
                  hud.killcam.killerFaction === 'army' ? 'text-sky-400' : 'text-red-400'
                }
              >
                {hud.killcam.killerName}
              </span>
              <span className="text-stone-500">·</span>
              <span className="text-amber-200">{hud.killcam.weaponLabel}</span>
              <span className="text-stone-500">·</span>
              <span className="text-stone-300 font-semibold">{hud.killcam.killerZoneName}</span>
              <span className="text-stone-500">·</span>
              <span className="text-stone-200 tabular-nums">{hud.killcam.distanceMeters} m</span>
            </div>
          </div>

          {/* Subtle corner reticle frame hinting enemy optic without obstructing replay */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 border border-red-400/30 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500/65" />
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 pb-5 pt-10 px-6 bg-gradient-to-t from-[#070b09]/95 via-[#070b09]/65 to-transparent flex flex-col items-center gap-2.5">
            <div className="w-full max-w-md flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-300 tabular-nums">
              <span>Position tactique ennemie</span>
              <span className="text-red-300">
                Redéploiement {hud.killcam.remainingSec.toFixed(1)}s
              </span>
            </div>

            <div className="w-full max-w-md h-1.5 bg-stone-800/90 rounded overflow-hidden">
              <div
                className="h-full bg-red-500 transition-[width] duration-75"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      ((hud.killcam.totalSec - hud.killcam.remainingSec) /
                        Math.max(0.1, hud.killcam.totalSec)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>

            <button
              type="button"
              onClick={onSkipKillcam}
              className="pointer-events-auto mt-0.5 px-4 py-1.5 rounded bg-[#141c18]/90 hover:bg-[#1c2822] border border-stone-600/80 text-[11px] font-bold uppercase tracking-wider text-stone-200 cursor-pointer"
            >
              Passer Killcam [{hud.gamepadConnected ? '✕' : 'Espace'}]
            </button>
          </div>
        </>
      )}

      {/* Bottom Left: Ultra-Minimal Translucent HP & Stance Strip (Menus hidden on gameplay screen) */}
      {!killcamActive && (
        <div className="fixed bottom-1.5 sm:bottom-2.5 left-2 sm:left-3 flex flex-col items-start gap-1 z-20 pointer-events-none">
          {hud.inSmokeCover && hud.hp > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1d2220]/70 text-[9.5px] font-bold text-stone-200">
              <CloudFog className="w-3 h-3 text-stone-300" />
              <span>FUMIGÈNE</span>
            </div>
          )}

          {!hud.isMobileDevice && hud.statusPanelOpen && (
            <div className="w-[228px] px-3 py-2 rounded-lg bg-[#101713]/85 border border-stone-700/70 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-stone-300">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  {hud.playerFaction === 'army' ? 'Armée Régulière' : 'Forces Rebelles'}
                </span>
                <span className="font-semibold text-emerald-400">
                  {hud.isRegenerating ? 'Régénération' : hud.isWounded ? 'À couvert' : 'Opérationnel'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-300">
                <span className="text-stone-400">ENDURANCE</span>
                <div className="w-20 h-1.5 bg-stone-800 rounded overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${hud.stamina}%` }} />
                </div>
                <span className="font-bold text-stone-200">{postureLabel}</span>
              </div>
            </div>
          )}

          <div className="w-[126px] sm:w-[168px] px-2 py-1 rounded bg-[#0a100c]/75 border border-stone-800/60">
            <div className="flex items-baseline justify-between gap-1.5 mb-0.5 tabular-nums">
              <div className="flex items-baseline gap-1">
                <span className={`text-sm sm:text-base font-black leading-none ${hud.hp > 45 ? 'text-stone-100' : 'text-red-400'}`}>
                  {hud.hp}
                </span>
                <span className="text-[9px] font-bold text-stone-400">PV</span>
              </div>
              <span
                className={`text-[8.5px] font-bold uppercase ${
                  hud.isRegenerating
                    ? 'text-emerald-400'
                    : hud.isProne || hud.isDiving
                    ? 'text-emerald-300'
                    : hud.isCrouching || hud.isSliding
                    ? 'text-amber-300'
                    : 'text-stone-300'
                }`}
              >
                {hud.isRegenerating ? 'Régén.' : postureLabel}
              </span>
            </div>
            <div className="w-full h-1 bg-stone-800/85 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${hud.hp > 45 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right: Ultra-Minimal Translucent Weapon & Ammo Strip (Menus hidden on gameplay screen) */}
      {!killcamActive && (
        <div className="fixed bottom-1.5 sm:bottom-2.5 right-2 sm:right-3 flex flex-col items-end gap-1 z-20 pointer-events-none">
          {!hud.isMobileDevice && hud.commandPanelOpen && (
            <div className="w-[248px] px-3 py-2 rounded-lg bg-[#101713]/85 border border-stone-700/70">
              <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px]">
                <span className="inline-flex items-center gap-1 font-extrabold uppercase text-amber-300">
                  <Award className="w-3 h-3 text-amber-400" />
                  Gr.{hud.rankLevel} · {hud.rankTitle}
                </span>
                <span className="font-bold text-sky-300 tabular-nums">
                  {hud.subordinatesCount}/{hud.totalAlliesCount}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {TACTICAL_ORDERS.map((ord) => {
                  const isSelected = hud.selectedOrder === ord.id;
                  const isActive = hud.activeOrder === ord.id && hud.activeOrderTimer > 0;
                  return (
                    <div
                      key={ord.id}
                      className={`px-1 py-1 rounded border text-center leading-tight ${
                        isActive
                          ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                          : isSelected
                          ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                          : 'bg-stone-900/80 border-stone-800 text-stone-400'
                      }`}
                    >
                      <div className="text-[8px] font-black">{ord.hotkey}</div>
                      <div className="text-[8px] font-bold truncate">{ord.shortLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-[146px] sm:w-[196px] px-2 py-1 rounded bg-[#0a100c]/75 border border-stone-800/60">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9.5px] sm:text-[10.5px] font-bold text-stone-200 truncate">
                {WEAPON_SPECS[hud.weaponId]?.shortName ?? hud.weaponName}
              </span>
              <div className="flex items-center gap-1 shrink-0 tabular-nums">
                {hud.sniperZoomLabel && (
                  <span className="text-[8px] font-bold px-1 rounded bg-sky-950/80 text-sky-300">
                    {hud.sniperZoomLabel}
                  </span>
                )}
                <span
                  className={`text-sm sm:text-base font-black leading-none ${
                    hud.ammoInMag <= 5 ? 'text-red-400' : 'text-stone-100'
                  }`}
                >
                  {hud.ammoInMag}
                </span>
                <span className="text-[10px] text-stone-400">/{hud.ammoReserve}</span>
              </div>
            </div>

            {!hud.isMobileDevice && (
              <div className="mt-0.5 flex items-center justify-between text-[9px] text-stone-400 tabular-nums">
                <span className="inline-flex items-center gap-1 truncate max-w-[105px]">
                  <Radio className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                  {hud.activeEliminateTargetName
                    ? `1▸ ${hud.activeEliminateTargetName}`
                    : TACTICAL_ORDERS.find((o) => o.id === (hud.activeOrder ?? hud.selectedOrder))?.shortLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={hud.droneBattery >= 18 ? 'text-cyan-300 font-bold' : 'text-stone-500'}>
                    DRN {hud.droneBattery}%[H]
                  </span>
                  <span>
                    G:{hud.grenades}·F:{hud.smokeGrenades}
                  </span>
                </span>
              </div>
            )}

            {hud.isReloading && (
              <div className="mt-0.5 w-full h-0.5 bg-stone-800 rounded overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
