import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Crosshair,
  Flame,
  Gamepad2,
  Lock,
  Rocket,
  Shield,
  Target,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  Faction,
  GamepadMenuEvent,
  WeaponCategory,
  WeaponId,
  WeaponSpec,
} from '../game/types';
import {
  DEFAULT_ARMY_LOADOUT,
  DEFAULT_REBEL_LOADOUT,
  getWeaponsByCategory,
  MAX_LOADOUT_SIZE,
  WEAPON_SPECS,
} from '../game/weapons';

interface ArmoryModalProps {
  loadout: WeaponId[];
  faction: Faction;
  gamepadNavActive: boolean;
  subscribeGamepadNav: (cb: (ev: GamepadMenuEvent) => void) => () => void;
  onGamepadRumble?: (strong?: boolean) => void;
  onSaveLoadout: (nextLoadout: WeaponId[]) => void;
  onClose: () => void;
}

const CATEGORY_TABS: Array<{
  id: WeaponCategory;
  label: string;
  count: number;
  subtitle: string;
}> = [
  {
    id: 'assault',
    label: "Fusils d'Assaut",
    count: 10,
    subtitle: '10 modèles automatiques · textures bois, polymère, FDE & olive',
  },
  {
    id: 'sniper',
    label: 'Précision & Zoom',
    count: 6,
    subtitle: '6 fusils optiques avec double niveau de zoom calibré [Shift / Molette]',
  },
  {
    id: 'destruction',
    label: 'Destruction Lourde',
    count: 4,
    subtitle: 'Lance-roquettes antichar & lance-flammes avec brûlure continue',
  },
];

function getWeaponPalette(id: WeaponId): { body: string; accent: string; stock: string } {
  switch (id) {
    case 'ak47':
      return { body: '#3a3f46', accent: '#7c4b27', stock: '#6e4020' };
    case 'ak74m':
      return { body: '#23272c', accent: '#9a4320', stock: '#1f2328' };
    case 'carbine':
      return { body: '#202429', accent: '#3d454f', stock: '#181b1f' };
    case 'fnfal':
      return { body: '#2b3036', accent: '#4e5b41', stock: '#45513a' };
    case 'scar_l':
      return { body: '#a88d67', accent: '#8e7350', stock: '#9e845e' };
    case 'hk416':
      return { body: '#1f2328', accent: '#626870', stock: '#191d22' };
    case 'famas':
      return { body: '#1e2226', accent: '#353b42', stock: '#1a1e22' };
    case 'aug':
      return { body: '#49583c', accent: '#24292e', stock: '#3f4c34' };
    case 'galil':
      return { body: '#31363d', accent: '#784a26', stock: '#2d3238' };
    case 'sg552':
      return { body: '#26383a', accent: '#1e2629', stock: '#223234' };
    case 'sniper':
      return { body: '#363b42', accent: '#7a4926', stock: '#6e4020' };
    case 'm24':
      return { body: '#48563c', accent: '#1f2428', stock: '#3e4b34' };
    case 'awm':
      return { body: '#4a5a3c', accent: '#23282c', stock: '#445337' };
    case 'barrett':
      return { body: '#23282e', accent: '#99805b', stock: '#2b3038' };
    case 'mk20':
      return { body: '#a88c66', accent: '#2d3238', stock: '#947853' };
    case 'vss':
      return { body: '#252a30', accent: '#744524', stock: '#693d1e' };
    case 'bazooka':
      return { body: '#3c4a2e', accent: '#764524', stock: '#2b3035' };
    case 'at4':
      return { body: '#455336', accent: '#ca8a04', stock: '#292e33' };
    case 'flamethrower':
      return { body: '#3d4c31', accent: '#b45309', stock: '#31383f' };
    case 'lpo50':
      return { body: '#2e3834', accent: '#b91c1c', stock: '#4a5248' };
  }
}

const WeaponSilhouetteSvg: React.FC<{ weapon: WeaponSpec; className?: string }> = ({
  weapon,
  className = 'w-full h-12',
}) => {
  const { body, accent, stock } = getWeaponPalette(weapon.id);

  if (weapon.delivery === 'rocket') {
    const isAt4 = weapon.id === 'at4';
    return (
      <svg viewBox="0 0 180 48" className={className} aria-hidden="true">
        {/* Main launch tube */}
        <rect x="20" y="18" width="136" height="11" rx="3" fill={body} stroke="#0f172a" strokeWidth="1" />
        {/* Warning band or wood heatguard */}
        <rect x="64" y="17.5" width="32" height="12" rx="1.5" fill={accent} />
        {isAt4 ? (
          <>
            <rect x="138" y="16" width="18" height="15" rx="2" fill={stock} />
            <rect x="16" y="16.5" width="10" height="14" rx="2" fill={stock} />
          </>
        ) : (
          /* Exposed RPG-7 PG-7V Warhead */
          <>
            <polygon points="154,19 175,23.5 154,28" fill="#475534" stroke="#1c1917" strokeWidth="0.8" />
            <rect x="148" y="21" width="8" height="5" fill="#d97706" />
          </>
        )}
        {/* Pistol grip & optic */}
        <polygon points="88,29 94,41 86,41 81,29" fill={stock} />
        <polygon points="118,29 123,39 116,39 112,29" fill={stock} />
        <rect x="92" y="12" width="14" height="6" rx="1" fill="#1e293b" />
      </svg>
    );
  }

  if (weapon.delivery === 'flame') {
    const isLpo = weapon.id === 'lpo50';
    return (
      <svg viewBox="0 0 180 48" className={className} aria-hidden="true">
        {/* Pressurized backpack tank cylinders */}
        <rect x="14" y="10" width="14" height="28" rx="5" fill={accent} stroke="#111827" strokeWidth="1" />
        <rect x="30" y="10" width="14" height="28" rx="5" fill={accent} stroke="#111827" strokeWidth="1" />
        {isLpo && (
          <rect x="22" y="13" width="12" height="22" rx="4" fill="#d97706" stroke="#111827" strokeWidth="0.8" />
        )}
        {/* Flexible hose */}
        <path d="M42 30 Q 58 42, 74 28" fill="none" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        {/* Wand & brass nozzle */}
        <rect x="66" y="19" width="66" height="8" rx="2" fill={body} />
        <rect x="132" y="20" width="24" height="6" rx="1" fill="#475569" />
        <rect x="155" y="18.5" width="9" height="9" rx="1.5" fill="#d97706" />
        {/* Live pilot flame */}
        <polygon points="164,23 175,18 171,23 175,28" fill="#fb923c" />
        <polygon points="94,27 99,39 91,39 87,27" fill={stock} />
        <rect x="112" y="14" width="12" height="5" rx="1" fill={stock} />
      </svg>
    );
  }

  const isSniper = weapon.category === 'sniper';
  const isBullpup = weapon.id === 'famas' || weapon.id === 'aug';
  const isVss = weapon.id === 'vss';
  const isAk = weapon.id === 'ak47' || weapon.id === 'ak74m' || weapon.id === 'galil';

  return (
    <svg viewBox="0 0 180 48" className={className} aria-hidden="true">
      {/* Stock */}
      {isBullpup ? (
        <rect x="18" y="18" width="44" height="15" rx="2.5" fill={stock} stroke="#0f172a" strokeWidth="0.8" />
      ) : (
        <polygon points="14,20 52,18 52,27 16,35" fill={stock} stroke="#0f172a" strokeWidth="0.8" />
      )}
      {/* Receiver */}
      <rect x="50" y="17" width="54" height="11" rx="2" fill={body} stroke="#0f172a" strokeWidth="0.8" />
      {/* Handguard */}
      <rect x="102" y="18" width={isSniper ? 30 : 26} height="8.5" rx="1.5" fill={accent} />
      {/* Barrel & Muzzle */}
      {isVss ? (
        <rect x="122" y="17.5" width="44" height="8" rx="3" fill="#181b20" stroke="#334155" strokeWidth="0.6" />
      ) : (
        <>
          <rect
            x="126"
            y="20"
            width={isSniper ? 44 : 30}
            height="3.5"
            rx="1"
            fill="#334155"
          />
          {weapon.id === 'barrett' && (
            <polygon points="168,18 177,17 177,26 168,25" fill="#1e293b" />
          )}
        </>
      )}
      {/* Magazine */}
      {isAk ? (
        <path
          d="M84,28 L93,28 Q95,38 89,44 L80,43 Q84,36 84,28 Z"
          fill={weapon.id === 'ak74m' ? '#9a4320' : '#262b30'}
        />
      ) : isBullpup ? (
        <rect x="38" y="31" width="10" height="13" rx="1.5" transform="rotate(8 38 31)" fill="#272c33" />
      ) : (
        <rect
          x="84"
          y="28"
          width={isSniper ? 12 : 9}
          height={isSniper ? 11 : 14}
          rx="1.5"
          transform="rotate(6 84 28)"
          fill="#272c33"
        />
      )}
      {/* Pistol grip */}
      <polygon
        points={`${isBullpup ? 76 : 62},28 ${isBullpup ? 82 : 68},40 ${isBullpup ? 75 : 61},40 ${isBullpup ? 70 : 56},28`}
        fill={stock}
      />
      {/* Optic / Scope */}
      {isSniper ? (
        <g>
          <rect x="58" y="8" width="44" height="6.5" rx="2" fill="#181c20" stroke="#475569" strokeWidth="0.7" />
          <rect x="54" y="7" width="8" height="8.5" rx="1.5" fill="#0f172a" />
          <rect x="98" y="6.5" width="11" height="9.5" rx="1.5" fill="#0f172a" />
          <rect x="68" y="14.5" width="5" height="3" fill="#334155" />
          <rect x="86" y="14.5" width="5" height="3" fill="#334155" />
          {/* Bipod */}
          {weapon.id !== 'vss' && (
            <line x1="128" y1="26" x2="122" y2="37" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
          )}
        </g>
      ) : (
        <rect x="68" y="11" width="18" height="5.5" rx="1.2" fill="#1e242b" stroke="#475569" strokeWidth="0.6" />
      )}
    </svg>
  );
};

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  loadout,
  faction,
  gamepadNavActive,
  subscribeGamepadNav,
  onGamepadRumble,
  onSaveLoadout,
  onClose,
}) => {
  const [draft, setDraft] = useState<WeaponId[]>(() =>
    loadout.slice(0, MAX_LOADOUT_SIZE)
  );
  const [activeTab, setActiveTab] = useState<WeaponCategory>('assault');
  const [focusedWeaponIdx, setFocusedWeaponIdx] = useState<number>(0);
  const [pendingWeapon, setPendingWeapon] = useState<WeaponSpec | null>(null);
  const [focusedSlotIdx, setFocusedSlotIdx] = useState<number>(0);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const categoryWeapons = getWeaponsByCategory(activeTab);

  useEffect(() => {
    setFocusedWeaponIdx(0);
  }, [activeTab]);

  useEffect(() => {
    if (!gamepadNavActive) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const blockKeys = (e: KeyboardEvent) => {
      const blocked = [
        'Tab',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'Space',
        'Escape',
        'KeyB',
      ];
      if (blocked.includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockKeys, { capture: true });
    return () => window.removeEventListener('keydown', blockKeys, { capture: true });
  }, [gamepadNavActive]);

  useEffect(() => {
    if (!gamepadNavActive || pendingWeapon) return;
    const card = cardRefs.current[focusedWeaponIdx];
    if (card) {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedWeaponIdx, gamepadNavActive, activeTab, pendingWeapon]);

  useEffect(() => {
    if (!validationNotice) return;
    const t = window.setTimeout(() => setValidationNotice(null), 2400);
    return () => window.clearTimeout(t);
  }, [validationNotice]);

  const openSlotPicker = (weapon: WeaponSpec) => {
    const existingIdx = draft.indexOf(weapon.id);
    setFocusedSlotIdx(existingIdx !== -1 ? existingIdx : 0);
    setPendingWeapon(weapon);
  };

  const confirmSlotSelection = (slotIdx: number) => {
    if (!pendingWeapon) return;
    const next = [...draft];
    const existingIdx = next.indexOf(pendingWeapon.id);

    let finalSlot = slotIdx;
    if (existingIdx !== -1) {
      if (slotIdx < next.length) {
        const displaced = next[slotIdx];
        next[slotIdx] = pendingWeapon.id;
        next[existingIdx] = displaced;
      } else {
        // Move to end if targeting a currently empty slot beyond draft.length
        next.splice(existingIdx, 1);
        next.push(pendingWeapon.id);
        finalSlot = next.length - 1;
      }
    } else if (slotIdx < next.length) {
      next[slotIdx] = pendingWeapon.id;
    } else if (next.length < MAX_LOADOUT_SIZE) {
      next.push(pendingWeapon.id);
      finalSlot = next.length - 1;
    } else {
      next[MAX_LOADOUT_SIZE - 1] = pendingWeapon.id;
      finalSlot = MAX_LOADOUT_SIZE - 1;
    }

    setDraft(next);
    onSaveLoadout(next);
    setValidationNotice(`${pendingWeapon.shortName} validée sur l'Emplacement [${finalSlot + 1}]`);
    setPendingWeapon(null);
  };

  const handleRemoveSlot = (idx: number) => {
    if (draft.length <= 1) return;
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    onSaveLoadout(next);
  };

  const handleApplyPreset = () => {
    const preset =
      faction === 'army' ? [...DEFAULT_ARMY_LOADOUT] : [...DEFAULT_REBEL_LOADOUT];
    setDraft(preset);
    onSaveLoadout(preset);
    setValidationNotice(
      `Dotation ${faction === 'army' ? 'Armée' : 'Rebelle'} appliquée`
    );
  };

  const handleFinish = () => {
    onSaveLoadout(draft);
    onClose();
  };

  const presetLoadout =
    faction === 'army' ? DEFAULT_ARMY_LOADOUT : DEFAULT_REBEL_LOADOUT;

  const navStateRef = useRef({
    activeTab,
    focusedWeaponIdx,
    categoryWeapons,
    draft,
    presetLoadout,
    pendingWeapon,
    focusedSlotIdx,
    openSlotPicker,
    confirmSlotSelection,
    handleApplyPreset,
    handleFinish,
    onClose,
    onGamepadRumble,
  });
  navStateRef.current = {
    activeTab,
    focusedWeaponIdx,
    categoryWeapons,
    draft,
    presetLoadout,
    pendingWeapon,
    focusedSlotIdx,
    openSlotPicker,
    confirmSlotSelection,
    handleApplyPreset,
    handleFinish,
    onClose,
    onGamepadRumble,
  };

  useEffect(() => {
    if (!gamepadNavActive) return;
    return subscribeGamepadNav((ev) => {
      const s = navStateRef.current;

      // Sub-menu: Slot Selection Dialog active
      if (s.pendingWeapon) {
        if (ev.action === 'left' || ev.action === 'up' || ev.action === 'tabPrev') {
          setFocusedSlotIdx((prev) => (prev + 2) % MAX_LOADOUT_SIZE);
          s.onGamepadRumble?.(false);
          return;
        }
        if (ev.action === 'right' || ev.action === 'down' || ev.action === 'tabNext') {
          setFocusedSlotIdx((prev) => (prev + 1) % MAX_LOADOUT_SIZE);
          s.onGamepadRumble?.(false);
          return;
        }
        if (ev.action === 'confirm') {
          s.onGamepadRumble?.(true);
          s.confirmSlotSelection(s.focusedSlotIdx);
          return;
        }
        if (ev.action === 'back' || ev.action === 'options') {
          s.onGamepadRumble?.(false);
          setPendingWeapon(null);
          return;
        }
        return;
      }

      const tabOrder: WeaponCategory[] = ['assault', 'sniper', 'destruction'];
      const count = s.categoryWeapons.length;

      if (ev.action === 'tabPrev' || ev.action === 'tabNext') {
        const idx = tabOrder.indexOf(s.activeTab);
        const dir = ev.action === 'tabNext' ? 1 : -1;
        setActiveTab(tabOrder[(idx + dir + tabOrder.length) % tabOrder.length]);
        s.onGamepadRumble?.(false);
        return;
      }
      if (ev.action === 'back' || ev.action === 'options' || ev.action === 'triangle') {
        s.onGamepadRumble?.(true);
        s.handleFinish();
        return;
      }
      if (ev.action === 'square') {
        s.onGamepadRumble?.(true);
        s.handleApplyPreset();
        return;
      }
      if (ev.action === 'left' || ev.action === 'right') {
        const delta = ev.action === 'left' ? -1 : 1;
        setFocusedWeaponIdx((prev) => (prev + delta + count) % count);
        s.onGamepadRumble?.(false);
        return;
      }
      if (ev.action === 'up' || ev.action === 'down') {
        const step = ev.action === 'up' ? -2 : 2;
        setFocusedWeaponIdx((prev) => {
          const next = prev + step;
          if (next < 0) return Math.max(0, count - 1);
          if (next >= count) return 0;
          return next;
        });
        s.onGamepadRumble?.(false);
        return;
      }
      if (ev.action === 'confirm') {
        const w = s.categoryWeapons[s.focusedWeaponIdx];
        if (w) {
          s.onGamepadRumble?.(true);
          s.openSlotPicker(w);
        }
      }
    });
  }, [gamepadNavActive, subscribeGamepadNav]);

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/84 p-2 sm:p-4 ${
        gamepadNavActive ? 'pointer-events-none select-none cursor-none' : ''
      }`}
    >
      <div className="relative w-full max-w-5xl rounded-xl bg-[#0f1612] border border-stone-700 shadow-2xl overflow-hidden flex flex-col h-[94dvh] max-h-[94dvh]">
        {/* Compact Top Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#0a100c] border-b border-stone-800">
          <div className="min-w-0">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-amber-400">
              Armurerie Tactique · 3 Armes Max (1 · 2 · 3)
            </div>
            <h2 className="text-sm sm:text-base font-black tracking-wide text-stone-100 truncate">
              Choisissez une arme puis son emplacement
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {gamepadNavActive && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0c1a24] border border-sky-700 text-[10px] font-bold text-sky-200">
                <Lock className="w-3 h-3 text-sky-400" />
                Manette
              </span>
            )}
            <button
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) handleApplyPreset();
              }}
              className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[10.5px] font-bold text-stone-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              Dotation {faction === 'army' ? 'Armée' : 'Rebelle'} {gamepadNavActive ? '[□]' : ''}
            </button>
            <button
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) handleFinish();
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-extrabold text-[11px] uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              Terminer ({draft.length}/{MAX_LOADOUT_SIZE}) {gamepadNavActive ? '[△]' : ''}
            </button>
            <button
              type="button"
              tabIndex={gamepadNavActive ? -1 : 0}
              onClick={() => {
                if (!gamepadNavActive) onClose();
              }}
              aria-label="Fermer l'armurerie"
              className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Category Tabs + Slim 3-Slot Summary Row (Leaves ~75%+ height for Weapon Grid) */}
        <div className="shrink-0 px-3 sm:px-4 py-1.5 bg-[#0c120e] border-b border-stone-800/90 space-y-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORY_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                    active
                      ? 'bg-[#1a281f] border-amber-500 text-amber-200'
                      : 'bg-[#0b110d] border-stone-800 text-stone-300 hover:border-stone-600'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide truncate">
                    {tab.id === 'assault' && <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {tab.id === 'sniper' && <Target className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                    {tab.id === 'destruction' && <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                    <span className="truncate">{tab.label}</span>
                  </span>
                  <span className="text-[10.5px] font-black tabular-nums px-1.5 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-200 shrink-0">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-[10.5px]">
            {[0, 1, 2].map((slotIdx) => {
              const wid = draft[slotIdx];
              const spec = wid ? WEAPON_SPECS[wid] : null;
              return (
                <div
                  key={slotIdx}
                  className="px-2 py-1 rounded bg-[#101813] border border-stone-800 flex items-center justify-between gap-1.5 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-black text-amber-400 shrink-0">[{slotIdx + 1}]</span>
                    <span className="font-bold text-stone-200 truncate">
                      {spec ? spec.shortName : 'Libre'}
                    </span>
                  </div>
                  {spec && draft.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slotIdx)}
                      title="Libérer cet emplacement"
                      className="p-0.5 rounded hover:bg-red-950/70 text-stone-400 hover:text-red-300 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {validationNotice && (
            <div className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/70 text-[11px] font-bold text-emerald-200 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{validationNotice}</span>
            </div>
          )}
        </div>

        {/* Primary Weapon Catalog Grid — Always Immediately Visible */}
        <div className="p-3 sm:p-4 flex-1 min-h-0 overflow-y-auto touch-pan-y grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
          {categoryWeapons.map((w, idx) => {
            const slotIdx = draft.indexOf(w.id);
            const isEquipped = slotIdx !== -1;
            const isGamepadFocused = gamepadNavActive && !pendingWeapon && focusedWeaponIdx === idx;

            const dmgPct =
              w.delivery === 'rocket'
                ? 100
                : w.delivery === 'flame'
                ? 82
                : Math.min(100, Math.round((w.damage / 96) * 100));
            const rpmPct =
              w.delivery === 'rocket'
                ? 10
                : Math.min(100, Math.round((w.rpm / 1120) * 100));
            const accPct =
              w.delivery === 'flame'
                ? 42
                : w.delivery === 'rocket'
                ? 58
                : Math.min(100, Math.round(100 - w.adsSpread * 42000));

            return (
              <div
                key={w.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                onClick={() => {
                  if (!gamepadNavActive) openSlotPicker(w);
                }}
                role="button"
                tabIndex={gamepadNavActive ? -1 : 0}
                onKeyDown={(e) => {
                  if (!gamepadNavActive && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openSlotPicker(w);
                  }
                }}
                className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  isGamepadFocused
                    ? 'ring-2 ring-sky-400 border-sky-400 bg-[#12222c] shadow-[0_0_18px_rgba(56,189,248,0.28)]'
                    : isEquipped
                    ? 'bg-[#16241b] border-emerald-500/80 hover:border-emerald-400'
                    : 'bg-[#0b110d] border-stone-800 hover:border-amber-500/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-extrabold text-stone-100 truncate">
                        {w.name}
                      </h3>
                      {w.zoomLabels && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-300">
                          <ZoomIn className="w-3 h-3" />
                          {w.zoomLabels[0]} / {w.zoomLabels[1]}
                        </span>
                      )}
                      {w.delivery === 'flame' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-300">
                          <Flame className="w-3 h-3" />
                          Brûlure
                        </span>
                      )}
                      {w.delivery === 'rocket' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                          <Rocket className="w-3 h-3" />
                          Antichar
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-stone-400 mt-0.5">
                      <span className="text-amber-300/90 font-semibold">{w.caliber}</span> ·{' '}
                      <span>{w.finishLabel}</span> · <span>{w.fireMode}</span> ({w.magSize}/{w.reserveMax})
                    </div>
                  </div>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!gamepadNavActive) openSlotPicker(w);
                    }}
                    className={`shrink-0 px-2.5 py-1 rounded text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                      isEquipped
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                        : 'bg-amber-600/90 hover:bg-amber-500 text-stone-950'
                    }`}
                  >
                    {isEquipped ? `Empl. [${slotIdx + 1}]` : 'Choisir'}
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2.5 items-center">
                  <div className="col-span-5 bg-[#070b08] border border-stone-800/90 rounded-md px-2 py-1">
                    <WeaponSilhouetteSvg weapon={w} className="w-full h-11" />
                  </div>
                  <div className="col-span-7 space-y-1 text-[10px] text-stone-300">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-stone-400">Dégâts</span>
                      <div className="flex-1 h-1.5 bg-stone-800 rounded overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${dmgPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-stone-400">Cadence</span>
                      <div className="flex-1 h-1.5 bg-stone-800 rounded overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${rpmPct}%` }} />
                      </div>
                      <span className="w-12 text-right text-[9.5px] font-bold text-amber-300 tabular-nums">
                        {w.rpm} c/m
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-stone-400">Précision</span>
                      <div className="flex-1 h-1.5 bg-stone-800 rounded overflow-hidden">
                        <div className="h-full bg-sky-400" style={{ width: `${accPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10.5px] text-stone-400 leading-snug line-clamp-2">{w.description}</p>
              </div>
            );
          })}
        </div>

        {/* Bottom Footer */}
        <div className="shrink-0 px-3 sm:px-4 py-1.5 bg-[#0a100c] border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-stone-400">
          {gamepadNavActive ? (
            <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sky-200 font-semibold">
              <span className="inline-flex items-center gap-1 text-sky-300">
                <Gamepad2 className="w-3.5 h-3.5" />
                L1/R1 Catégories
              </span>
              <span>· Stick G/D-Pad Naviguer</span>
              <span>· <strong className="text-emerald-300">✕</strong> Choisir l&apos;arme</span>
              <span>· <strong className="text-stone-200">□</strong> Dotation</span>
              <span>· <strong className="text-amber-300">△ / ○</strong> Terminer</span>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  Touchez une arme pour ouvrir la sélection d&apos;emplacement [1], [2] ou [3].
                </span>
              </div>
              <span className="text-amber-300 font-semibold">
                Raccourci Armurerie : [B]
              </span>
            </>
          )}
        </div>

        {/* Dedicated Slot Selection Sub-Menu (Opens when user chooses a weapon) */}
        {pendingWeapon && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/88 p-3 sm:p-5">
            <div className="w-full max-w-2xl rounded-xl bg-[#101813] border border-amber-500/80 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#0a100c] border-b border-stone-800">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Validation de l&apos;arme &amp; emplacement
                  </div>
                  <h3 className="text-base font-black text-stone-100">
                    Choisir l&apos;emplacement pour {pendingWeapon.shortName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!gamepadNavActive) setPendingWeapon(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[11px] font-bold text-stone-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Annuler {gamepadNavActive ? '[○]' : ''}
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3 overflow-y-auto">
                {/* Selected Weapon Preview */}
                <div className="p-2.5 rounded-lg bg-[#0b110d] border border-stone-800 flex items-center gap-3">
                  <div className="w-28 sm:w-32 shrink-0 bg-[#070b08] rounded px-2 py-1 border border-stone-800">
                    <WeaponSilhouetteSvg weapon={pendingWeapon} className="w-full h-10" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-stone-100 truncate">
                      {pendingWeapon.name}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5 tabular-nums">
                      {pendingWeapon.caliber} · {pendingWeapon.rpm} c/m · {pendingWeapon.fireMode} ({pendingWeapon.magSize}/{pendingWeapon.reserveMax})
                    </div>
                    {pendingWeapon.zoomLabels && (
                      <div className="text-[10.5px] font-bold text-sky-300 mt-0.5">
                        Optique {pendingWeapon.zoomLabels[0]} / {pendingWeapon.zoomLabels[1]}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3 Emplacement Choice Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[0, 1, 2].map((slotIdx) => {
                    const currentId = draft[slotIdx];
                    const currentSpec = currentId ? WEAPON_SPECS[currentId] : null;
                    const isSameWeapon = currentId === pendingWeapon.id;
                    const isPadSlotFocused = gamepadNavActive && focusedSlotIdx === slotIdx;

                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        onClick={() => {
                          if (!gamepadNavActive) confirmSlotSelection(slotIdx);
                        }}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isPadSlotFocused
                            ? 'ring-2 ring-sky-400 border-sky-400 bg-[#132530]'
                            : isSameWeapon
                            ? 'bg-[#17281e] border-emerald-500'
                            : 'bg-[#0b110d] border-stone-700 hover:border-amber-500 hover:bg-[#162119]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                            Emplacement {slotIdx + 1}
                          </span>
                          <span className="text-[10px] font-bold text-stone-400">
                            Touche [{slotIdx + 1}]
                          </span>
                        </div>

                        {currentSpec ? (
                          <div className="space-y-1">
                            <div className="bg-[#070b08] rounded px-1.5 py-0.5 border border-stone-800">
                              <WeaponSilhouetteSvg weapon={currentSpec} className="w-full h-8" />
                            </div>
                            <div className="text-xs font-bold text-stone-200 truncate">
                              {currentSpec.shortName}
                            </div>
                            <div className="text-[10px] text-stone-400 truncate">
                              {isSameWeapon ? 'Déjà dans cet emplacement' : 'Sera remplacée'}
                            </div>
                          </div>
                        ) : (
                          <div className="h-14 flex items-center justify-center text-xs text-emerald-300 font-semibold border border-dashed border-stone-700 rounded">
                            Emplacement libre
                          </div>
                        )}

                        <div className="w-full py-1.5 rounded bg-amber-600 text-stone-950 font-black text-[11px] uppercase tracking-wider text-center">
                          Valider ici {isPadSlotFocused ? '[✕]' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
