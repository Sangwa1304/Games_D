import { GamepadSettings, StickCurveType } from './types';

export const DEFAULT_GAMEPAD_SETTINGS: GamepadSettings = {
  lookSensitivity: 2.85,
  adsMultiplier: 0.58,
  stickCurve: 'dynamic',
  moveDeadzone: 0.06,
  lookDeadzone: 0.07,
  autoSprint: true,
  invertY: false,
  vibration: true,
};

export interface DualShockState {
  connected: boolean;
  name: string | null;
  moveX: number; // -1 left .. +1 right
  moveY: number; // -1 forward .. +1 back
  lookX: number; // -1 left .. +1 right (curved)
  lookY: number; // -1 up .. +1 down (curved)
  rawAxes: { lx: number; ly: number; rx: number; ry: number };
  adsHeld: boolean; // L2 (6)
  fireHeld: boolean; // R2 (7)
  fireJustPressed: boolean; // R2 edge
  jumpJustPressed: boolean; // Croix (0)
  crouchJustPressed: boolean; // Rond court (1) -> Accroupi / Glissade en sprint
  proneJustPressed: boolean; // Rond long (1) -> Allongé / Plongeon en sprint
  diveOrProneJustPressed: boolean; // R3 (11) -> Allongé immédiat / Plongeon en sprint
  reloadJustPressed: boolean; // Carré (2)
  nextWeaponJustPressed: boolean; // Triangle (3)
  prevWeaponJustPressed: boolean; // D-Pad Bas (13)
  smokeJustPressed: boolean; // L1 (4) -> Fumigène tactique
  grenadeJustPressed: boolean; // R1 (5) -> Grenade Frag
  sprintHeld: boolean; // L3 (10) ou Auto-Sprint stick gauche
  l3JustPressed: boolean; // Clic L3 (Zoom lunette en visée L2)
  tacSprintHeld: boolean; // Double-clic L3
  pauseJustPressed: boolean; // Options (9)
  quickOrderJustPressed: boolean; // D-Pad Haut (12) -> Ordre rapide Regroupement
  cycleOrderJustPressed: boolean; // D-Pad Gauche (14) -> Choisir Ordre
  issueOrderJustPressed: boolean; // D-Pad Droite (15) -> Exécuter Ordre
  toggleStatusPanelJustPressed: boolean; // Select / Share (8)
  toggleCommandPanelJustPressed: boolean; // Pavé tactile (17) ou Share long
  confirmJustPressed: boolean; // Croix sur menus
  switchCampJustPressed: boolean; // Share / D-Pad G-D sur menus
}

function applyRadialDeadzone(x: number, y: number, deadzone: number): [number, number] {
  const dz = Math.min(0.45, Math.max(0.01, deadzone));
  const mag = Math.hypot(x, y);
  if (mag < dz) return [0, 0];
  const norm = Math.min(1, (mag - dz) / (1 - dz));
  const scale = norm / mag;
  return [x * scale, y * scale];
}

function applyAimCurve(val: number, curve: StickCurveType): number {
  const sign = val < 0 ? -1 : 1;
  const a = Math.abs(val);
  if (curve === 'linear') {
    return val;
  }
  if (curve === 'precision') {
    // Smooth fine aim near center with gradual ramp
    return sign * Math.pow(a, 1.85);
  }
  // 'dynamic': rapid micro-corrections + high angular velocity at full deflection
  const sCurve = 0.56 * a + 0.44 * a * a;
  return sign * Math.min(1, sCurve);
}

export class DualShockController {
  private prevButtons: boolean[] = new Array(20).fill(false);
  private prevR2 = false;
  private sprintLatched = false;
  private tacSprintLatched = false;
  private lastL3Time = 0;
  private sharePressTime = 0;
  private shareLongHandled = false;
  private circlePressTime = 0;
  private circleLongHandled = false;
  private activePadIndex: number | null = null;
  private settings: GamepadSettings = { ...DEFAULT_GAMEPAD_SETTINGS };
  public connected = false;
  public padName: string | null = null;

  constructor() {
    window.addEventListener('gamepadconnected', this.onConnected);
    window.addEventListener('gamepaddisconnected', this.onDisconnected);
    this.scanPads();
  }

  public setSettings(partial: Partial<GamepadSettings>) {
    this.settings = {
      ...this.settings,
      ...partial,
    };
  }

  public getSettings(): GamepadSettings {
    return { ...this.settings };
  }

  private onConnected = (e: GamepadEvent) => {
    this.activePadIndex = e.gamepad.index;
    this.connected = true;
    this.padName = e.gamepad.id;
  };

  private onDisconnected = (e: GamepadEvent) => {
    if (this.activePadIndex === e.gamepad.index) {
      this.activePadIndex = null;
      this.connected = false;
      this.padName = null;
      this.scanPads();
    }
  };

  private scanPads() {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        this.activePadIndex = p.index;
        this.connected = true;
        this.padName = p.id;
        return;
      }
    }
  }

  private getActiveGamepad(): Gamepad | null {
    const pads = navigator.getGamepads?.();
    if (!pads) return null;
    if (this.activePadIndex !== null && pads[this.activePadIndex]?.connected) {
      return pads[this.activePadIndex];
    }
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        this.activePadIndex = p.index;
        this.connected = true;
        this.padName = p.id;
        return p;
      }
    }
    this.connected = false;
    this.padName = null;
    return null;
  }

  public poll(): DualShockState {
    const pad = this.getActiveGamepad();
    const empty: DualShockState = {
      connected: this.connected,
      name: this.padName,
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      rawAxes: { lx: 0, ly: 0, rx: 0, ry: 0 },
      adsHeld: false,
      fireHeld: false,
      fireJustPressed: false,
      jumpJustPressed: false,
      crouchJustPressed: false,
      proneJustPressed: false,
      diveOrProneJustPressed: false,
      reloadJustPressed: false,
      nextWeaponJustPressed: false,
      prevWeaponJustPressed: false,
      smokeJustPressed: false,
      grenadeJustPressed: false,
      sprintHeld: false,
      l3JustPressed: false,
      tacSprintHeld: false,
      pauseJustPressed: false,
      quickOrderJustPressed: false,
      cycleOrderJustPressed: false,
      issueOrderJustPressed: false,
      toggleStatusPanelJustPressed: false,
      toggleCommandPanelJustPressed: false,
      confirmJustPressed: false,
      switchCampJustPressed: false,
    };

    if (!pad) return empty;

    const btn = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
    const btnVal = (idx: number) => pad.buttons[idx]?.value ?? (btn(idx) ? 1 : 0);
    const justPressed = (idx: number) => btn(idx) && !this.prevButtons[idx];

    const rawLx = pad.axes[0] ?? 0;
    const rawLy = pad.axes[1] ?? 0;
    const rawRx = pad.axes[2] ?? 0;
    const rawRy = pad.axes[3] ?? 0;

    const [mx, my] = applyRadialDeadzone(rawLx, rawLy, this.settings.moveDeadzone);
    const [lxRaw, lyRaw] = applyRadialDeadzone(rawRx, rawRy, this.settings.lookDeadzone);

    const l2Held = btnVal(6) > 0.2;
    const r2Held = btnVal(7) > 0.22;
    const r2Just = r2Held && !this.prevR2;
    const now = performance.now();

    // L3 click toggles Sprint; double-tap L3 engages CoD Tactical Sprint.
    // Auto-sprint also engages smooth sprint when left stick is pushed strongly forward.
    if (justPressed(10)) {
      if (now - this.lastL3Time < 340) {
        this.sprintLatched = true;
        this.tacSprintLatched = true;
      } else {
        this.sprintLatched = !this.sprintLatched;
        if (!this.sprintLatched) this.tacSprintLatched = false;
      }
      this.lastL3Time = now;
    }
    const autoSprintActive = this.settings.autoSprint && my < -0.84 && !l2Held;
    if (my > -0.22 || l2Held) {
      this.sprintLatched = false;
      this.tacSprintLatched = false;
    }

    // Circle (1): Tap (< 260ms) -> Crouch / Slide; Hold (>= 260ms) -> Prone / Dolphin Dive
    let crouchTap = false;
    let proneHold = false;
    if (btn(1)) {
      if (!this.prevButtons[1]) {
        this.circlePressTime = now;
        this.circleLongHandled = false;
      } else if (!this.circleLongHandled && now - this.circlePressTime >= 260) {
        this.circleLongHandled = true;
        proneHold = true;
      }
    } else if (this.prevButtons[1] && !this.circleLongHandled) {
      crouchTap = true;
    }

    // Select/Share (8) toggles État; Touchpad (17) toggles Cross-Com Commandes
    // Fallback for adapters without button 17: holding Share >= 360ms toggles Commandes
    let toggleStatus = false;
    let toggleCommand = justPressed(17);
    const hasTouchpadBtn = pad.buttons.length > 17;
    if (btn(8)) {
      if (!this.prevButtons[8]) {
        this.sharePressTime = now;
        this.shareLongHandled = false;
        if (hasTouchpadBtn) {
          toggleStatus = true;
        }
      } else if (!hasTouchpadBtn && !this.shareLongHandled && now - this.sharePressTime >= 360) {
        this.shareLongHandled = true;
        toggleCommand = true;
      }
    } else if (this.prevButtons[8] && !hasTouchpadBtn && !this.shareLongHandled) {
      toggleStatus = true;
    }

    const curvedLookX = applyAimCurve(lxRaw, this.settings.stickCurve);
    const curvedLookY =
      applyAimCurve(lyRaw, this.settings.stickCurve) * (this.settings.invertY ? -1 : 1);

    const state: DualShockState = {
      connected: true,
      name: pad.id,
      moveX: mx,
      moveY: my,
      lookX: curvedLookX,
      lookY: curvedLookY,
      rawAxes: { lx: mx, ly: my, rx: lxRaw, ry: lyRaw },
      adsHeld: l2Held,
      fireHeld: r2Held,
      fireJustPressed: r2Just,
      jumpJustPressed: justPressed(0), // Croix (X)
      crouchJustPressed: crouchTap, // Rond court (O) -> Accroupi / Glissade
      proneJustPressed: proneHold, // Rond maintenu (O) -> Allongé
      diveOrProneJustPressed: justPressed(11), // R3 -> Allongé / Plongeon immédiat
      reloadJustPressed: justPressed(2), // Carré (□)
      nextWeaponJustPressed: justPressed(3), // Triangle (△)
      prevWeaponJustPressed: justPressed(13), // D-Pad Bas (↓)
      smokeJustPressed: justPressed(4), // L1 -> Fumigène
      grenadeJustPressed: justPressed(5), // R1 -> Grenade Frag
      sprintHeld: this.sprintLatched || btn(10) || autoSprintActive,
      l3JustPressed: justPressed(10), // L3
      tacSprintHeld: this.tacSprintLatched,
      pauseJustPressed: justPressed(9), // Options
      quickOrderJustPressed: justPressed(12), // D-Pad Haut (↑) -> Ordre rapide Regroupement
      cycleOrderJustPressed: justPressed(14), // D-Pad Gauche (←) -> Choisir Ordre
      issueOrderJustPressed: justPressed(15), // D-Pad Droite (→) -> Exécuter Ordre
      toggleStatusPanelJustPressed: toggleStatus, // Select / Share (8)
      toggleCommandPanelJustPressed: toggleCommand, // Pavé Tactile (17)
      confirmJustPressed: justPressed(0), // Croix
      switchCampJustPressed: justPressed(8) || justPressed(14) || justPressed(15),
    };

    for (let i = 0; i < Math.min(pad.buttons.length, 20); i++) {
      this.prevButtons[i] = btn(i);
    }
    this.prevR2 = r2Held;

    return state;
  }

  public rumble(weakMagnitude: number, strongMagnitude: number, durationMs: number) {
    if (!this.settings.vibration) return;
    const pad = this.getActiveGamepad();
    if (!pad) return;
    const actuator = (pad as Gamepad & {
      vibrationActuator?: {
        playEffect?: (type: string, params: Record<string, number>) => Promise<void>;
      };
    }).vibrationActuator;
    if (actuator?.playEffect) {
      actuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1, Math.max(0, weakMagnitude)),
          strongMagnitude: Math.min(1, Math.max(0, strongMagnitude)),
        })
        .catch(() => {});
    }
  }

  public dispose() {
    window.removeEventListener('gamepadconnected', this.onConnected);
    window.removeEventListener('gamepaddisconnected', this.onDisconnected);
  }
}
