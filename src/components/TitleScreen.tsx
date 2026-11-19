import React, { useState } from 'react';
import {
  Copy,
  Crosshair,
  Gamepad2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Radar,
  RefreshCw,
  Shield,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { COMBAT_MODES, getCombatModeSpec } from '../game/modes';
import { CombatModeId, Faction, LanPeerPlayer, LanRoomSummary, WeaponId } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';

interface TitleScreenProps {
  selectedFaction: Faction;
  onSelectFaction: (faction: Faction) => void;
  selectedMode: CombatModeId;
  onSelectMode: (mode: CombatModeId) => void;
  loadout: WeaponId[];
  onOpenArmory: () => void;
  totalZonesCount: number;
  gamepadConnected: boolean;
  isMobileDevice?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  lanConnected: boolean;
  lanIps: string[];
  lanPort: number;
  lanRooms: LanRoomSummary[];
  lanPeers: LanPeerPlayer[];
  lanUdpActive: boolean;
  lanUdpPort: number;
  initialRoomCode: string;
  onPresenceChange: (name: string) => void;
  onRefreshRooms: () => void;
  onStartSolo: () => void;
  onJoinLan: (
    roomCode: string,
    playerName: string,
    targetHost?: { ip: string; port: number } | null
  ) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedFaction,
  onSelectFaction,
  selectedMode,
  onSelectMode,
  loadout,
  onOpenArmory,
  totalZonesCount,
  gamepadConnected,
  isMobileDevice = false,
  isFullscreen = false,
  onToggleFullscreen,
  lanConnected,
  lanIps,
  lanPort,
  lanRooms,
  lanPeers,
  lanUdpActive,
  lanUdpPort,
  initialRoomCode,
  onPresenceChange,
  onRefreshRooms,
  onStartSolo,
  onJoinLan,
}) => {
  const [playerName, setPlayerName] = useState('Soldat-Kivu');
  const [roomCode, setRoomCode] = useState(initialRoomCode || 'KIVU-LAN');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const normalizedRoom =
    roomCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'KIVU-LAN';
  const primaryIp = lanIps[0] || window.location.hostname || '127.0.0.1';
  const shareUrl = `http://${primaryIp}:${lanPort}?room=${normalizedRoom}`;

  const activeModeSpec = getCombatModeSpec(selectedMode);

  const handleCopyInvite = () => {
    try {
      navigator.clipboard?.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Clipboard may be restricted on HTTP LAN contexts
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-4 md:p-7 pointer-events-none overflow-y-auto touch-pan-y">
      {/* Subtle dark edge vignette */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 68% 45%, rgba(12,18,14,0.18) 0%, rgba(10,15,12,0.86) 76%)',
        }}
      />

      {/* Top Left Title Lockup */}
      <div className="max-w-2xl pointer-events-auto pt-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-300/90 bg-[#121914]/92 border border-stone-700/70 rounded">
            <MapIcon className="w-3.5 h-3.5 text-amber-400" />
            {totalZonesCount} Zones Tactiques · Vallée du Kivu
          </div>
          {gamepadConnected && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-sky-300 bg-[#101c24]/92 border border-sky-700/70 rounded">
              <Gamepad2 className="w-3.5 h-3.5" />
              DualShock Détectée
            </div>
          )}
          {isMobileDevice && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-emerald-300 bg-[#0f1d15]/92 border border-emerald-700/70 rounded">
              <Smartphone className="w-3.5 h-3.5" />
              Mobile Android
            </div>
          )}
          {isMobileDevice && onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase text-amber-200 bg-[#1d2215]/95 hover:bg-[#2a311e] border border-amber-500/70 rounded cursor-pointer active:scale-95 transition-transform"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                  Réduire Écran
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                  Plein Écran (Masquer Barre Web)
                </>
              )}
            </button>
          )}
        </div>

        <svg
          viewBox="0 0 540 104"
          className="w-full max-w-[420px] h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
          aria-label="Kivu : Ligne de Front"
        >
          <path
            d="M4 22 Q 95 6, 190 20 T 390 14 T 532 22"
            fill="none"
            stroke="#a16207"
            strokeWidth="1.5"
            strokeOpacity="0.65"
          />
          <path
            d="M4 92 Q 130 84, 260 94 T 532 88"
            fill="none"
            stroke="#4d7c0f"
            strokeWidth="1.5"
            strokeOpacity="0.5"
          />
          <text
            x="4"
            y="60"
            fill="#f5f5f4"
            fontSize="44"
            fontWeight="900"
            letterSpacing="4"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            KIVU
          </text>
          <rect x="148" y="32" width="4" height="30" fill="#d97706" />
          <text
            x="166"
            y="58"
            fill="#d6d3d1"
            fontSize="26"
            fontWeight="700"
            letterSpacing="5"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            LIGNE DE FRONT
          </text>
          <text
            x="6"
            y="81"
            fill="#a8a29e"
            fontSize="11.5"
            fontWeight="600"
            letterSpacing="2.8"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {totalZonesCount} ZONES · 6 TYPES DE COMBAT · WI-FI LAN &amp; UDP
          </text>
        </svg>
      </div>

      {/* Main Selection Panel: Camp + Combat Mode + Wi-Fi LAN */}
      <div className="max-w-3xl w-full pointer-events-auto space-y-2.5">
        {/* 1. Faction Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onSelectFaction('army')}
            className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedFaction === 'army'
                ? 'bg-[#17231c]/95 border-sky-500 text-stone-100'
                : 'bg-[#111713]/88 border-stone-700/70 text-stone-300 hover:border-stone-500'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
                Camp 01 · Rive Sud
              </span>
              {selectedFaction === 'army' && (
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-sky-300">
                  Sélectionné
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-stone-100">Armée Régulière</div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              QG fortifié, Héliport, Marché &amp; Artillerie Est.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectFaction('rebels')}
            className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedFaction === 'rebels'
                ? 'bg-[#231715]/95 border-red-500 text-stone-100'
                : 'bg-[#111713]/88 border-stone-700/70 text-stone-300 hover:border-stone-500'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">
                Camp 02 · Crête Nord
              </span>
              {selectedFaction === 'rebels' && (
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-red-300">
                  Sélectionné
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-stone-100">Forces Rebelles</div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Campement forestier, Mirador, Ruines &amp; Carrière Nord.
            </p>
          </button>
        </div>

        {/* 2. Combat Mode Selector (6 Modes) */}
        <div className="p-3 rounded-lg bg-[#101713]/94 border border-stone-700/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Crosshair className="w-3.5 h-3.5" />
              Type de Combat ({COMBAT_MODES.length} Modes)
            </span>
            <span className="text-[11px] text-stone-300 font-medium">
              {activeModeSpec.description}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {COMBAT_MODES.map((m) => {
              const active = m.id === selectedMode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMode(m.id)}
                  className={`px-2.5 py-2 rounded border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1c291e] border-amber-500 text-amber-200'
                      : 'bg-[#0b110d] border-stone-800 text-stone-300 hover:border-stone-600'
                  }`}
                >
                  <div className="text-[11px] font-extrabold uppercase tracking-wide truncate">
                    {m.name}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate mt-0.5">
                    {m.objectiveLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Réseau Local (Même Wi-Fi) + Auto-Détection UDP Broadcast */}
        <div className="p-3 rounded-lg bg-[#101713]/94 border border-stone-700/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>Multijoueur Réseau Local (Même Wi-Fi)</span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  lanConnected && lanUdpActive
                    ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                    : lanConnected
                    ? 'bg-sky-950 border border-sky-700 text-sky-300'
                    : 'bg-stone-800 border border-stone-600 text-stone-400'
                }`}
              >
                <Radar className="w-3 h-3" />
                {lanUdpActive
                  ? `Broadcast UDP :${lanUdpPort}`
                  : lanConnected
                  ? 'Scan Réseau Actif'
                  : 'Connexion...'}
              </span>
            </div>

            <button
              type="button"
              onClick={onRefreshRooms}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[11px] text-stone-200 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Sonder
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Votre Pseudo
              </span>
              <input
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  onPresenceChange(e.target.value);
                }}
                placeholder="Soldat-Kivu"
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0f0c] border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Code Salon Wi-Fi
              </span>
              <input
                type="text"
                maxLength={12}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="KIVU-LAN"
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0f0c] border border-stone-700 text-xs font-bold tracking-wider text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onJoinLan(normalizedRoom, playerName)}
                className="w-full py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-colors"
              >
                Créer / Rejoindre Wi-Fi
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-stone-800/90 text-[11px]">
            <div className="p-2 rounded bg-[#0b110d] border border-stone-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400">
                <span>Parties détectées ({lanRooms.length})</span>
                <span className="text-emerald-400">Auto-Sync</span>
              </div>
              {lanRooms.length > 0 ? (
                <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
                  {lanRooms.map((rm) => (
                    <button
                      key={`${rm.hostIp || 'local'}:${rm.code}`}
                      type="button"
                      onClick={() => {
                        setRoomCode(rm.code);
                        if (rm.combatMode) onSelectMode(rm.combatMode);
                        onJoinLan(
                          rm.code,
                          playerName,
                          rm.isRemoteHost && rm.hostIp
                            ? { ip: rm.hostIp, port: rm.port || 3000 }
                            : null
                        );
                      }}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#14221a] hover:bg-[#1a2e23] border border-emerald-700/70 text-[10.5px] text-emerald-200 cursor-pointer text-left"
                    >
                      <span className="truncate">
                        <strong className="text-amber-300">{rm.code}</strong> ·{' '}
                        {rm.combatMode ? getCombatModeSpec(rm.combatMode).shortName : rm.hostName}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-emerald-300">
                        {rm.playerCount} j. · {rm.armyCount}A/{rm.rebelCount}R
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[10.5px] text-stone-500">
                  En écoute UDP... aucune partie active détectée
                </div>
              )}
            </div>

            <div className="p-2 rounded bg-[#0b110d] border border-stone-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400">
                <span>Joueurs sur le même réseau ({lanPeers.length})</span>
                <Users className="w-3 h-3 text-sky-400" />
              </div>
              {lanPeers.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {lanPeers.map((peer) => (
                    <span
                      key={`${peer.hostIp}:${peer.id}`}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${
                        peer.faction === 'army'
                          ? 'bg-[#0e1b24] border-sky-800/80 text-sky-200'
                          : 'bg-[#241111] border-red-800/80 text-red-200'
                      }`}
                    >
                      <strong className="truncate max-w-[90px]">{peer.name}</strong>
                      <span className="text-stone-400">
                        {peer.status === 'playing' && peer.roomCode
                          ? `[${peer.roomCode}]`
                          : `(${peer.ip})`}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[10.5px] text-stone-500">
                  Aucun autre joueur détecté sur le Wi-Fi
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-800/90 text-[11px]">
            <div className="flex items-center gap-1.5 text-stone-300 min-w-0">
              <span className="text-stone-400 shrink-0">Lien même Wi-Fi :</span>
              <code className="px-2 py-0.5 rounded bg-[#0a0f0c] border border-stone-800 text-amber-200 truncate max-w-[280px]">
                {shareUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[10px] text-stone-200 cursor-pointer shrink-0"
              >
                <Copy className="w-3 h-3" />
                {copiedUrl ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        </div>

        {/* Armory Loadout Summary + Solo Deploy Row */}
        <div className="p-2.5 rounded-lg bg-[#101713]/94 border border-stone-700/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-300 mr-1">
              <Shield className="w-3.5 h-3.5" />
              Dotation ({loadout.length}/3) :
            </span>
            {loadout.map((wid, idx) => (
              <span
                key={wid}
                className="px-2 py-0.5 rounded bg-[#0a100c] border border-stone-700 text-[11px] font-bold text-stone-200"
              >
                <span className="text-amber-400 mr-1">[{idx + 1}]</span>
                {WEAPON_SPECS[wid]?.shortName ?? wid}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenArmory}
            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-amber-600 hover:text-stone-950 border border-amber-500/70 text-[11px] font-extrabold uppercase tracking-wider text-amber-200 cursor-pointer transition-colors"
          >
            Armurerie (20 Armes · 3 Max)
          </button>
        </div>

        {/* Solo Deploy Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartSolo}
              className="px-7 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-stone-950 font-extrabold text-sm tracking-widest uppercase transition-colors cursor-pointer shadow-lg"
            >
              Déployer · {activeModeSpec.shortName}
            </button>
            <span className="text-xs text-stone-400 tracking-wide">
              {gamepadConnected ? (
                <>
                  Appuyez sur <strong className="text-sky-300">✕ Croix</strong> ou{' '}
                  <strong className="text-stone-200">Entrée</strong>
                </>
              ) : isMobileDevice ? (
                <>
                  Touchez <strong className="text-amber-300">Déployer</strong> (passage plein écran automatique)
                </>
              ) : (
                <>
                  <strong className="text-stone-200">Entrée</strong> pour lancer ·{' '}
                  <strong className="text-stone-200">B</strong> Armurerie ·{' '}
                  <strong className="text-stone-200">Echap</strong> Paramètres audio
                </>
              )}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-stone-300/90 bg-[#0e1410]/92 border border-stone-800 px-3.5 py-2 rounded-md tracking-wide">
          {gamepadConnected
            ? 'DualShock : Stick G Marche · L3 Avant Sprint · Stick D Visée · L2/R2 Viser/Tirer · L1/R1 Fumi/Frag · □ Rech · △/↓ Armes · ↓ Maintenu Drone · ✕ Saut · ○ Accroupi/Glisse · R3 Allongé'
            : isMobileDevice
            ? 'Tactile Android (horizontal plein écran) : Joystick gauche Marche · SPRINT · DRN Drone Recon · Zone droite Caméra · TIR / VISER / ZOOM / MARQUER (masqués si manette connectée)'
            : 'Clavier/Souris : WASD/ZQSD Marche · Espace Saut · Shift Sprint/Zoom · C Accroupi · X Allongé · 1-3 Armes · H/4 Drone Recon (M/Clic G Marquer) · B Armurerie · F1-F4 Ordres · Echap Paramètres'}
        </div>
      </div>
    </div>
  );
};
