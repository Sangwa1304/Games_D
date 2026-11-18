import React, { useState } from 'react';
import { Gamepad2, Mic, Music, RotateCcw, Shield, Sliders, Volume2, VolumeX, Wifi } from 'lucide-react';
import { GamepadSettings, HudSnapshot, StickCurveType } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';

interface PauseEndModalProps {
  hud: HudSnapshot;
  muted: boolean;
  sensitivity: number;
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

export const PauseEndModal: React.FC<PauseEndModalProps> = ({
  hud,
  muted,
  sensitivity,
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
  const [settingsTab, setSettingsTab] = useState<'audio' | 'gamepad'>(() =>
    hud.gamepadConnected ? 'gamepad' : 'audio'
  );

  const isEnd = hud.phase === 'victory' || hud.phase === 'defeat';
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
  const gp = hud.gamepadSettings;
  const sticks = hud.gamepadSticks;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-[#111813] border border-stone-700 p-5 shadow-2xl space-y-3.5 my-auto">
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
              hud.gamepadConnected
                ? 'bg-[#0f1c24] border-sky-700 text-sky-300'
                : 'bg-stone-900 border-stone-700 text-stone-400'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            {hud.gamepadConnected ? 'DualShock Active' : 'Aucune Manette'}
          </div>
        </div>

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
        <div className="grid grid-cols-2 gap-1.5 bg-[#0b100d] p-1 rounded-lg border border-stone-800">
          <button
            type="button"
            onClick={() => setSettingsTab('audio')}
            className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
              settingsTab === 'audio'
                ? 'bg-stone-800 text-amber-300 border border-stone-600'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Audio &amp; Souris
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('gamepad')}
            className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
              settingsTab === 'gamepad'
                ? 'bg-[#0f1f2b] text-sky-300 border border-sky-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            Joysticks &amp; DualShock
          </button>
        </div>

        {/* TAB 1: Audio & Mouse */}
        {settingsTab === 'audio' && (
          <div className="bg-[#0b100d] border border-stone-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-200">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                Niveaux Audio &amp; Souris
              </span>
              <button
                type="button"
                onClick={onToggleMute}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-bold cursor-pointer ${
                  muted
                    ? 'bg-red-950/80 border-red-700 text-red-300'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-100'
                }`}
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                {muted ? 'Son Coupé' : 'Son Actif'}
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Mic className="w-3.5 h-3.5 text-sky-400" />
                  Voix de commandement
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTestVoice}
                    className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[10px] text-sky-300 cursor-pointer"
                  >
                    Tester Voix
                  </button>
                  <span className="tabular-nums text-sky-300 font-bold w-9 text-right">
                    {Math.round(hud.voiceVolume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={hud.voiceVolume}
                onChange={(e) => onChangeVoiceVolume(parseFloat(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  Effets sonores (Tirs, Explosions)
                </span>
                <span className="tabular-nums text-amber-300 font-bold w-9 text-right">
                  {Math.round(hud.sfxVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={hud.sfxVolume}
                onChange={(e) => onChangeSfxVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  Musique
                </span>
                <span className="tabular-nums text-emerald-300 font-bold w-9 text-right">
                  {Math.round(hud.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={hud.musicVolume}
                onChange={(e) => onChangeMusicVolume(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 pt-1 border-t border-stone-800/80">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span>Sensibilité visée souris</span>
                <span className="tabular-nums text-amber-300 font-bold">
                  {(sensitivity * 1000).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0.0008}
                max={0.0045}
                step={0.0001}
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 2: DualShock Joysticks & All-Button Controls */}
        {settingsTab === 'gamepad' && (
          <div className="bg-[#0b100d] border border-stone-800 rounded-lg p-3 space-y-2.5 max-h-[54vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                <Gamepad2 className="w-3.5 h-3.5" />
                Accessibilité Joysticks (Mouvements Rapides)
              </span>
              <button
                type="button"
                onClick={onResetGamepadSettings}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[10px] font-bold text-stone-300 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Défaut
              </button>
            </div>

            {/* Live Dual-Stick Calibration Preview */}
            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-[#080d0a] border border-stone-800/90">
              {[
                { label: 'Stick Gauche (L3 · Dépl.)', x: sticks.lx, y: sticks.ly, dz: gp.moveDeadzone, color: '#34d399' },
                { label: 'Stick Droit (R3 · Visée)', x: sticks.rx, y: sticks.ry, dz: gp.lookDeadzone, color: '#38bdf8' },
              ].map((st) => (
                <div key={st.label} className="flex items-center gap-2.5">
                  <svg viewBox="-28 -28 56 56" className="w-12 h-12 shrink-0">
                    <circle cx="0" cy="0" r="24" fill="#111915" stroke="#334155" strokeWidth="1.2" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] text-stone-300">
                  <span>Vitesse Rotation (Stick Droit)</span>
                  <strong className="text-sky-300 tabular-nums">{gp.lookSensitivity.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={5.2}
                  step={0.1}
                  value={gp.lookSensitivity}
                  onChange={(e) => onChangeGamepadSettings({ lookSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] text-stone-300">
                  <span>Multiplicateur Visée (ADS)</span>
                  <strong className="text-sky-300 tabular-nums">{Math.round(gp.adsMultiplier * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1.15}
                  step={0.05}
                  value={gp.adsMultiplier}
                  onChange={(e) => onChangeGamepadSettings({ adsMultiplier: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] text-stone-300">
                  <span>Zone Morte Gauche (Dépl.)</span>
                  <strong className="text-emerald-300 tabular-nums">{Math.round(gp.moveDeadzone * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={gp.moveDeadzone}
                  onChange={(e) => onChangeGamepadSettings({ moveDeadzone: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] text-stone-300">
                  <span>Zone Morte Droite (Visée)</span>
                  <strong className="text-amber-300 tabular-nums">{Math.round(gp.lookDeadzone * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={gp.lookDeadzone}
                  onChange={(e) => onChangeGamepadSettings({ lookDeadzone: parseFloat(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Response Curve Selector */}
            <div className="space-y-1">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400">
                Courbe de Réponse Stick Droit
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CURVE_OPTIONS.map((c) => {
                  const active = gp.stickCurve === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onChangeGamepadSettings({ stickCurve: c.id })}
                      className={`px-2 py-1.5 rounded border text-left cursor-pointer ${
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
                type="button"
                onClick={() => onChangeGamepadSettings({ autoSprint: !gp.autoSprint })}
                className={`px-2 py-1.5 rounded border text-[10.5px] font-bold cursor-pointer ${
                  gp.autoSprint
                    ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
              >
                Sprint Auto : {gp.autoSprint ? 'OUI' : 'NON'}
              </button>
              <button
                type="button"
                onClick={() => onChangeGamepadSettings({ invertY: !gp.invertY })}
                className={`px-2 py-1.5 rounded border text-[10.5px] font-bold cursor-pointer ${
                  gp.invertY
                    ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
              >
                Inverser Y : {gp.invertY ? 'OUI' : 'NON'}
              </button>
              <button
                type="button"
                onClick={() => onChangeGamepadSettings({ vibration: !gp.vibration })}
                className={`px-2 py-1.5 rounded border text-[10.5px] font-bold cursor-pointer ${
                  gp.vibration
                    ? 'bg-sky-950/70 border-sky-600 text-sky-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
              >
                Vibration : {gp.vibration ? 'OUI' : 'NON'}
              </button>
            </div>

            {/* Complete DualShock All-Button Map */}
            <div className="pt-2 border-t border-stone-800 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Mapping Complet DualShock (Toutes Touches Actives)
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-stone-300 bg-[#080d0a] border border-stone-800/80 rounded p-2">
                <div><strong className="text-emerald-300">L2 / R2</strong> : Viser / Tirer</div>
                <div><strong className="text-emerald-300">L1 / R1</strong> : Fumigène / Frag</div>
                <div><strong className="text-sky-300">Stick G + L3</strong> : Dépl. / Sprint (×2 Tac)</div>
                <div><strong className="text-sky-300">Stick D + R3</strong> : Visée / Allongé-Plongeon</div>
                <div><strong className="text-amber-300">✕ Croix</strong> : Saut (ou Se relever)</div>
                <div><strong className="text-amber-300">○ Rond</strong> : Court Accroupi · Long Allongé</div>
                <div><strong className="text-amber-300">□ Carré</strong> : Recharger</div>
                <div><strong className="text-amber-300">△ Triangle</strong> : Arme suivante</div>
                <div><strong className="text-stone-100">D-Pad ↑ / ↓</strong> : Regroupement / Arme préc.</div>
                <div><strong className="text-stone-100">D-Pad ← / →</strong> : Choisir / Donner Ordre</div>
                <div><strong className="text-stone-100">Select/Share</strong> : Mini-fenêtre État</div>
                <div><strong className="text-stone-100">L2 + L3</strong> : Changer Zoom Lunette</div>
                <div><strong className="text-stone-100">Pavé / Options</strong> : Grades / Paramètres</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-0.5">
          <button
            type="button"
            onClick={onOpenArmory}
            className="w-full py-2 rounded-lg bg-[#16221b] hover:bg-[#1e2f25] border border-amber-500/70 text-amber-200 font-bold text-xs uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Armurerie ({hud.loadout.map((id) => WEAPON_SPECS[id]?.shortName ?? id).join(' · ')}) [B]
            </span>
          </button>
          {!isEnd && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-extrabold text-xs uppercase tracking-widest cursor-pointer"
            >
              Reprendre le combat {hud.gamepadConnected ? '(✕ / Options)' : '(Echap)'}
            </button>
          )}
          {!hud.lanRoomCode && (
            <button
              type="button"
              onClick={onRestart}
              className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest cursor-pointer ${
                isEnd
                  ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600'
              }`}
            >
              Recommencer la bataille
            </button>
          )}
          {hud.lanRoomCode ? (
            <button
              type="button"
              onClick={onLeaveLan}
              className="w-full py-2 rounded-lg bg-red-950/70 hover:bg-red-900/80 border border-red-700/70 text-red-200 text-xs font-bold uppercase tracking-widest cursor-pointer"
            >
              Quitter le salon Wi-Fi
            </button>
          ) : (
            <button
              type="button"
              onClick={onReturnToTitle}
              className="w-full py-2 rounded-lg bg-transparent hover:bg-stone-800/70 text-stone-400 hover:text-stone-200 text-xs font-semibold uppercase tracking-widest cursor-pointer"
            >
              Changer de camp / Mode (Menu)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
