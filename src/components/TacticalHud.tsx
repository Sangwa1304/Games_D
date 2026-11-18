import React from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  CloudFog,
  Compass,
  Crosshair,
  Flame,
  Gamepad2,
  HeartPulse,
  MapPin,
  Radio,
  Shield,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { TACTICAL_ORDERS } from '../game/ranks';
import { HudSnapshot } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';
import { Minimap } from './Minimap';

interface TacticalHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onRequestLock: () => void;
  onToggleStatusPanel: () => void;
  onToggleCommandPanel: () => void;
  onSkipKillcam: () => void;
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
  onToggleStatusPanel,
  onToggleCommandPanel,
  onSkipKillcam,
}) => {
  const isTdm = hud.combatMode === 'tdm';
  const leftVal = isTdm ? hud.armyScore : hud.armyTickets;
  const rightVal = isTdm ? hud.rebelScore : hud.rebelTickets;
  const denom = Math.max(1, isTdm ? hud.scoreLimit : hud.maxTickets);
  const armyPct = Math.min(100, Math.round((leftVal / denom) * 100));
  const rebelPct = Math.min(100, Math.round((rightVal / denom) * 100));
  const activeSectors = hud.sectors.filter((s) => s.active);

  const gap = Math.min(34, Math.max(6, hud.crosshairSpread));
  const showSniperScope = hud.isAds && hud.weaponCategory === 'sniper' && hud.hp > 0;
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

      {/* Multi-Reticle Precision Sniper Scope Overlay with Live Calibrated Zoom */}
      {showSniperScope && (
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
                      <circle cx={pos} cy="100" r="1.2" fill="#0f172a" />
                      <circle cx="100" cy={pos} r="1.2" fill="#0f172a" />
                    </React.Fragment>
                  ))}
                  <circle cx="100" cy="100" r="1.15" fill="#ef4444" />
                </>
              ) : activeScopeType === 'heavy' ? (
                <>
                  <line x1="10" y1="100" x2="84" y2="100" stroke="#0f172a" strokeWidth="1.4" />
                  <line x1="116" y1="100" x2="190" y2="100" stroke="#0f172a" strokeWidth="1.4" />
                  <line x1="100" y1="12" x2="100" y2="84" stroke="#0f172a" strokeWidth="1.1" />
                  <line x1="100" y1="116" x2="100" y2="188" stroke="#0f172a" strokeWidth="1.4" />
                  <line x1="84" y1="100" x2="116" y2="100" stroke="#0f172a" strokeWidth="0.55" />
                  <line x1="100" y1="84" x2="100" y2="116" stroke="#0f172a" strokeWidth="0.55" />
                  {[114, 126, 138, 150].map((y, idx) => (
                    <line
                      key={y}
                      x1={96 - idx * 1.4}
                      y1={y}
                      x2={104 + idx * 1.4}
                      y2={y}
                      stroke="#0f172a"
                      strokeWidth="0.9"
                    />
                  ))}
                  <circle cx="100" cy="100" r="1.1" fill="#22c55e" />
                </>
              ) : (
                <>
                  {/* Illuminated PSO-1 stadia */}
                  <line x1="12" y1="100" x2="90" y2="100" stroke="#0f172a" strokeWidth="0.95" />
                  <line x1="110" y1="100" x2="188" y2="100" stroke="#0f172a" strokeWidth="0.95" />
                  {[42, 58, 74, 126, 142, 158].map((tickX) => (
                    <line key={tickX} x1={tickX} y1="97.5" x2={tickX} y2="102.5" stroke="#0f172a" strokeWidth="0.8" />
                  ))}
                  <line x1="100" y1="106" x2="100" y2="184" stroke="#0f172a" strokeWidth="0.95" />
                  <polyline
                    points="95.5,104.5 100,100 104.5,104.5"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.25"
                  />
                  <circle cx="100" cy="100" r="0.85" fill="#ef4444" />
                  <polyline points="97,113 100,109 103,113" fill="none" stroke="#0f172a" strokeWidth="0.85" />
                  <polyline points="97.5,122 100,118.5 102.5,122" fill="none" stroke="#0f172a" strokeWidth="0.8" />
                </>
              )}
            </svg>

            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded bg-[#0c120e]/90 border border-sky-700/70 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <span>Optique {hud.sniperZoomLabel || '6×'}</span>
              <span className="text-stone-500">·</span>
              <span className="text-stone-300">
                [{hud.gamepadConnected ? 'L3' : 'Shift / Molette'}] Changer Zoom
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Left: Compact Controls Row + Tactical Zone + Minimap */}
      {!killcamActive && (
        <div className="fixed top-3 left-3 flex flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? 'Activer le son' : 'Couper le son'}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            className="p-1.5 rounded bg-[#101713]/85 border border-stone-700/70 text-stone-200 hover:border-stone-500 cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#101713]/85 border border-stone-700/70 text-[11px] text-stone-300 tabular-nums pointer-events-none">
            <span className="text-stone-400">ÉLIM</span>
            <strong className="text-stone-100">{hud.playerKills}</strong>
            <span className="text-stone-600">|</span>
            <Compass className="w-3 h-3 text-amber-400" />
            <strong className="text-amber-300">{hud.compassHeadingDeg}°</strong>
          </div>

          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#101713]/85 border border-stone-700/70 text-[10.5px] font-semibold text-amber-200 pointer-events-none">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span className="max-w-[165px] truncate">{hud.currentZoneName}</span>
          </div>

          {hud.lanRoomCode && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0d2419]/90 border border-emerald-600/70 text-[10px] font-bold text-emerald-200 pointer-events-none tabular-nums">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>{hud.lanRoomCode}</span>
              <span className="text-emerald-400">({hud.lanPlayerCount})</span>
            </div>
          )}

          {hud.gamepadConnected && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0f1c24]/90 border border-sky-700/70 text-[10px] font-semibold text-sky-300 pointer-events-none">
              <Gamepad2 className="w-3 h-3" />
              PS
            </div>
          )}
        </div>

        <Minimap
          playerX={hud.playerPosX}
          playerZ={hud.playerPosZ}
          playerYaw={hud.playerYaw}
          units={hud.minimapUnits}
          sectors={hud.sectors}
          orderMarkerPos={hud.orderMarkerPos}
          enemyRadarRange={hud.minimapEnemyRange}
        />
        </div>
      )}

      {/* Top Center Compact Mode, Timer & Frontline Tickets/Scores */}
      {!killcamActive && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#101713]/88 border border-stone-700/70">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Armée
            </span>
            <div className="w-16 h-1.5 bg-stone-800 rounded overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-200"
                style={{ width: `${armyPct}%` }}
              />
            </div>
            <span className="text-xs font-extrabold text-stone-100 tabular-nums w-8 text-right">
              {leftVal}
            </span>
          </div>

          <div className="flex items-center gap-1 px-2 border-x border-stone-700/70">
            {isTdm ? (
              <span className="text-[10px] font-black tracking-wider text-amber-300 tabular-nums">
                MME /{hud.scoreLimit} · {formatTimer(hud.matchTimeRemaining)}
              </span>
            ) : (
              <>
                {activeSectors.map((sec) => {
                  const badgeColor =
                    sec.owner === 'army'
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : sec.owner === 'rebels'
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-stone-800 border-amber-500/80 text-amber-300';
                  return (
                    <div
                      key={sec.id}
                      title={sec.name}
                      className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black border ${badgeColor}`}
                    >
                      {sec.id}
                    </div>
                  );
                })}
                <span className="ml-1 text-[10px] font-bold text-stone-400 tabular-nums">
                  {formatTimer(hud.matchTimeRemaining)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-stone-100 tabular-nums w-8">
              {rightVal}
            </span>
            <div className="w-16 h-1.5 bg-stone-800 rounded overflow-hidden flex justify-end">
              <div
                className="h-full bg-red-500 transition-all duration-200"
                style={{ width: `${rebelPct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              Rebelles
            </span>
          </div>
        </div>

        <div className="px-2.5 py-0.5 rounded bg-[#101713]/82 border border-stone-800 text-[10px] font-bold uppercase tracking-widest text-stone-300">
          {hud.combatModeName} · {hud.totalZonesCount} Zones
        </div>

        {hud.radioBanner && (
          <div className="px-3 py-0.5 rounded bg-[#141d17]/95 border border-amber-600/60 text-[11px] font-semibold tracking-wide text-amber-200">
            {hud.radioBanner}
          </div>
        )}
        </div>
      )}

      {/* Top Right Compact Kill Feed (max 3 entries) */}
      {!killcamActive && (
        <div className="fixed top-3 right-3 flex flex-col items-end gap-1">
          {hud.killFeed.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="px-2 py-0.5 rounded bg-[#101713]/85 border border-stone-800 text-[10px] flex items-center gap-1.5"
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

      {/* Center Reticle & Hitmarker */}
      {hud.hp > 0 && !showSniperScope && (
        <div className="fixed inset-0 flex items-center justify-center">
          {!hud.isAds ? (
            <div className="relative w-1 h-1">
              <span
                className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-stone-100/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                style={{ bottom: `${gap}px` }}
              />
              <span
                className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-stone-100/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                style={{ top: `${gap}px` }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-stone-100/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                style={{ right: `${gap}px` }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-stone-100/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                style={{ left: `${gap}px` }}
              />
            </div>
          ) : (
            <div className="w-[3px] h-[3px] rounded-full bg-red-400/80 shadow-[0_0_3px_rgba(0,0,0,0.95)]" />
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

      {/* Pointer Lock Prompt (Hidden when DualShock controller is connected) */}
      {!hud.pointerLocked && !hud.gamepadConnected && hud.hp > 0 && (
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

      {/* Bottom Left: Slim Vitals Strip + Collapsible Mini-Fenêtre État */}
      {!killcamActive && (
        <div className="fixed bottom-3 left-3 flex flex-col items-start gap-1.5">
        {hud.inSmokeCover && hud.hp > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1d2220]/92 border border-stone-500/80 text-[10.5px] font-bold text-stone-200">
            <CloudFog className="w-3.5 h-3.5 text-stone-300" />
            <span>SOUS ÉCRAN FUMIGÈNE</span>
          </div>
        )}

        {hud.statusPanelOpen && (
          <div className="w-[244px] px-3 py-2.5 rounded-lg bg-[#101713]/95 border border-stone-600/80 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-[10px]">
              <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-stone-300">
                <Shield className="w-3 h-3 text-emerald-400" />
                {hud.playerFaction === 'army' ? 'Armée Régulière' : 'Forces Rebelles'}
              </span>
              {hud.isRegenerating ? (
                <span className="font-bold uppercase text-emerald-300">Régénération</span>
              ) : hud.isWounded ? (
                <span className="font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-950 border border-red-600 text-red-300">
                  Blessé · À couvert
                </span>
              ) : (
                <span className="font-semibold text-emerald-400">Opérationnel</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-300 py-1 px-2 rounded bg-stone-900/90 border border-stone-800">
              <div className="inline-flex items-center gap-1.5">
                <CloudFog className="w-3.5 h-3.5 text-stone-300" />
                <span>Fumigène Tactique</span>
              </div>
              <span className="tabular-nums font-bold text-stone-200">
                {hud.smokeGrenades} <span className="text-stone-500">[{hud.gamepadConnected ? 'L1' : 'E'}]</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-300">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">ENDURANCE</span>
                <div className="w-16 h-1.5 bg-stone-800 rounded overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${hud.stamina}%` }} />
                </div>
              </div>
              <span
                className={`font-bold ${
                  hud.isSliding
                    ? 'text-sky-300'
                    : hud.isProne || hud.isDiving
                    ? 'text-emerald-300'
                    : hud.isCrouching || hud.isTacSprinting
                    ? 'text-amber-300'
                    : 'text-stone-200'
                }`}
              >
                {postureLabel}
              </span>
            </div>

            <div className="pt-1.5 border-t border-stone-800 text-[9.5px] text-stone-400 flex items-center justify-between">
              {hud.gamepadConnected ? (
                <>
                  <span className="text-sky-300">L3 Sprint</span>
                  <span className="text-sky-300">○ Accr./Glisse</span>
                  <span className="text-sky-300">R3 Allongé</span>
                </>
              ) : (
                <>
                  <span>[Shift×2] Tac</span>
                  <span>[C] Accroupi</span>
                  <span>[X] Allongé</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="w-[236px] px-3 py-2 rounded-lg bg-[#101713]/88 border border-stone-700/75">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-baseline gap-1 tabular-nums">
              <HeartPulse
                className={`w-3.5 h-3.5 self-center ${
                  hud.isRegenerating
                    ? 'text-emerald-400 animate-pulse'
                    : hud.hp <= 45
                    ? 'text-red-400 animate-pulse'
                    : 'text-stone-400'
                }`}
              />
              <span className={`text-lg font-black leading-none ${hud.hp > 45 ? 'text-stone-100' : 'text-red-400'}`}>
                {hud.hp}
              </span>
              <span className="text-[10px] font-semibold text-stone-400">PV</span>
              <span
                className={`ml-1 text-[9px] font-bold uppercase ${
                  hud.isRegenerating
                    ? 'text-emerald-400'
                    : hud.isProne || hud.isDiving
                    ? 'text-emerald-300'
                    : hud.isCrouching || hud.isSliding
                    ? 'text-amber-300'
                    : 'text-stone-400'
                }`}
              >
                {hud.isRegenerating ? 'Régén.' : postureLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-900 border border-stone-700 text-[10px] text-stone-200 tabular-nums">
                <CloudFog className="w-2.5 h-2.5 text-stone-300" />
                <strong className={hud.smokeGrenades > 0 ? 'text-stone-100' : 'text-stone-500'}>
                  {hud.smokeGrenades}
                </strong>
                <span className="text-[9px] text-stone-400">{hud.gamepadConnected ? 'L1' : 'E'}</span>
              </span>

              <button
                type="button"
                onClick={onToggleStatusPanel}
                aria-expanded={hud.statusPanelOpen}
                aria-label="Ouvrir ou fermer la mini-fenêtre d'état"
                title="Mini-fenêtre État (Clavier: I | DualShock: Select/Share)"
                className="pointer-events-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-500/80 text-[9.5px] font-bold text-amber-200 cursor-pointer"
              >
                <span>{hud.gamepadConnected ? 'Select' : 'I'}</span>
                {hud.statusPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="w-full h-1.5 bg-stone-800 rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hud.hp > 45 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100))}%`,
              }}
            />
          </div>
        </div>
        </div>
      )}

      {/* Bottom Right: Collapsible Mini-Fenêtre Grades & Ordres + Compact Weapon Card */}
      {!killcamActive && (
        <div className="fixed bottom-3 right-3 flex flex-col items-end gap-1.5">
        {hud.commandPanelOpen && (
          <div className="w-[264px] px-3 py-2.5 rounded-lg bg-[#101713]/95 border border-stone-600/80 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="inline-flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-300">
                  Gr.{hud.rankLevel} · {hud.rankTitle}
                </span>
              </div>
              <span className="text-[10px] font-bold text-sky-300 tabular-nums">
                Sub. {hud.subordinatesCount}/{hud.totalAlliesCount}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-stone-800 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-200"
                  style={{
                    width: `${
                      hud.nextRankXp !== null
                        ? Math.min(100, Math.round((hud.rankXp / Math.max(1, hud.nextRankXp)) * 100))
                        : 100
                    }%`,
                  }}
                />
              </div>
              <span className="text-[9.5px] text-stone-400 tabular-nums">
                {hud.nextRankXp !== null ? `${hud.rankXp}/${hud.nextRankXp}` : 'MAX'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[9.5px] uppercase tracking-wider text-stone-400 mb-1">
              <span className="inline-flex items-center gap-1 text-stone-300 font-semibold">
                <Radio className="w-3 h-3 text-sky-400" />
                Cross-Com
              </span>
              <span>{hud.gamepadConnected ? '[← Choix · → Ordre]' : '[T Choix · F Ordre]'}</span>
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
                    <div className="text-[8.5px] font-black">{ord.hotkey}</div>
                    <div className="text-[8.5px] font-bold truncate">{ord.shortLabel}</div>
                  </div>
                );
              })}
            </div>

            {hud.activeOrder && hud.activeOrderTimer > 0 && (
              <div className="mt-1.5 text-[9.5px] font-semibold text-sky-300 flex items-center justify-between tabular-nums">
                <span>
                  Actif : {TACTICAL_ORDERS.find((o) => o.id === hud.activeOrder)?.shortLabel}
                </span>
                <span>{Math.ceil(hud.activeOrderTimer)}s</span>
              </div>
            )}
          </div>
        )}

        <div className="w-[244px] px-3 py-2 rounded-lg bg-[#101713]/88 border border-stone-700/75">
          <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-stone-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <Award className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold text-amber-300 truncate">
                {hud.rankAbbr} · {TACTICAL_ORDERS.find((o) => o.id === (hud.activeOrder ?? hud.selectedOrder))?.shortLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleCommandPanel}
              aria-expanded={hud.commandPanelOpen}
              aria-label="Ouvrir ou fermer la mini-fenêtre Grades et Ordres"
              title="Mini-fenêtre Grades & Ordres (Clavier: Tab | DualShock: Pavé / Share long)"
              className="pointer-events-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-500/80 text-[9.5px] font-bold text-sky-200 cursor-pointer shrink-0"
            >
              <span>{hud.gamepadConnected ? 'Pavé' : 'Tab'}</span>
              {hud.commandPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[11px] font-bold text-stone-200 tracking-wide truncate">
              {hud.weaponName}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {hud.sniperZoomLabel && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-sky-950 border border-sky-700 text-sky-300">
                  {hud.sniperZoomLabel}
                </span>
              )}
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-stone-800 text-amber-300">
                {hud.fireMode}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="tabular-nums">
              <span
                className={`text-xl font-black leading-none ${
                  hud.ammoInMag <= 5 ? 'text-red-400' : 'text-stone-100'
                }`}
              >
                {hud.ammoInMag}
              </span>
              <span className="text-xs text-stone-500 mx-1">/</span>
              <span className="text-xs font-bold text-stone-400">{hud.ammoReserve}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-stone-300 tabular-nums">
              <span>
                FRAG [{hud.gamepadConnected ? 'R1' : 'G'}]:{' '}
                <strong className="text-amber-300">{hud.grenades}</strong>
              </span>
              <span className="text-stone-600">·</span>
              <span>
                FUMI [{hud.gamepadConnected ? 'L1' : 'E'}]:{' '}
                <strong className="text-stone-100">{hud.smokeGrenades}</strong>
              </span>
            </div>
          </div>

          {/* 3-Slot Equipped Loadout Strip */}
          <div className="mt-1.5 pt-1.5 border-t border-stone-800/90 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {hud.loadout.map((wid, idx) => {
                const active = wid === hud.weaponId;
                const wSpec = WEAPON_SPECS[wid];
                return (
                  <span
                    key={wid}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate border ${
                      active
                        ? 'bg-amber-600/20 border-amber-500 text-amber-200'
                        : 'bg-stone-900/80 border-stone-800 text-stone-400'
                    }`}
                  >
                    {idx + 1}:{wSpec?.shortName ?? wid}
                  </span>
                );
              })}
            </div>
            <span className="text-[8.5px] font-bold text-stone-400 shrink-0">[B] Armes</span>
          </div>

          {hud.isReloading && (
            <div className="mt-1.5">
              <div className="w-full h-1 bg-stone-800 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
};
