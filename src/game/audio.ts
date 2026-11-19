import { SurfaceType, WeaponId } from './types';
import { isFlameWeapon, isRocketWeapon, isSniperWeapon } from './weapons';

export class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private riverGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  private muted = false;
  private sfxVolume = 0.8;
  private musicVolume = 0.45;
  private voiceVolume = 0.9;
  private initialized = false;

  // Dynamic tactical music sequencer state
  private musicStep = 0;
  private musicStepTimer = 0;

  public unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1.0;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume * 0.78;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume * 0.42;
    this.musicGain.connect(this.masterGain);

    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.value = this.voiceVolume * 0.85;
    this.voiceGain.connect(this.masterGain);

    // Pre-generate 2 seconds of white/pink noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, b0 + b1 + b2 + white * 0.18));
    }

    // Continuous river current loop (SFX bus)
    const riverSrc = this.ctx.createBufferSource();
    riverSrc.buffer = this.noiseBuffer;
    riverSrc.loop = true;
    const riverFilter = this.ctx.createBiquadFilter();
    riverFilter.type = 'bandpass';
    riverFilter.frequency.value = 540;
    riverFilter.Q.value = 0.7;
    this.riverGain = this.ctx.createGain();
    this.riverGain.gain.value = 0.02;
    riverSrc.connect(riverFilter);
    riverFilter.connect(this.riverGain);
    this.riverGain.connect(this.sfxGain);
    riverSrc.start();

    // Continuous forest canopy breeze loop (SFX bus)
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 340;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.035;
    windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxGain);
    windSrc.start();

    // Continuous tropical rainfall patter loop (SFX bus)
    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffer;
    rainSrc.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1350;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.sfxGain);
    rainSrc.start();

    this.initialized = true;
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 1.0, this.ctx.currentTime, 0.03);
    }
  }

  public setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume * 0.78, this.ctx.currentTime, 0.03);
    }
  }

  public setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.42, this.ctx.currentTime, 0.05);
    }
  }

  public setVoiceVolume(v: number) {
    this.voiceVolume = Math.max(0, Math.min(1, v));
    if (this.voiceGain && this.ctx) {
      this.voiceGain.gain.setTargetAtTime(this.voiceVolume * 0.85, this.ctx.currentTime, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  // Procedural dynamic tactical soundtrack (Kivu D-minor atmospheric bass, percussive pulse & tense pad)
  public updateMusic(dt: number, combatIntensity: number, inMatch: boolean) {
    if (!this.ctx || !this.musicGain || this.muted || this.musicVolume <= 0.01) return;
    if (this.ctx.state !== 'running') return;

    const stepInterval = inMatch ? (combatIntensity > 0.45 ? 0.27 : 0.34) : 0.44;
    this.musicStepTimer -= dt;
    if (this.musicStepTimer > 0) return;
    this.musicStepTimer = stepInterval;

    const now = this.ctx.currentTime;
    const step = this.musicStep % 16;
    this.musicStep++;

    // D natural minor tactical scale (D2 = 73.42Hz)
    const bassNotes = [73.42, 73.42, 87.31, 82.41, 73.42, 65.41, 69.3, 65.41];
    const barNote = bassNotes[Math.floor((this.musicStep / 8) % bassNotes.length)];

    // 1. Deep warm tactical bass pulse on steps 0, 6, 8, 12
    if (step === 0 || step === 8 || (inMatch && (step === 6 || step === 12))) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(barNote, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160 + combatIntensity * 140, now);
      filter.frequency.exponentialRampToValueAtTime(75, now + 0.42);
      const amp = step === 0 ? 0.36 : 0.24;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.58);
    }

    // 2. Atmospheric minor pad every 16 steps
    if (step === 0) {
      const chord = [barNote * 2, barNote * 2.4, barNote * 3];
      chord.forEach((freq) => {
        const pad = this.ctx!.createOscillator();
        const pf = this.ctx!.createBiquadFilter();
        const pg = this.ctx!.createGain();
        pad.type = 'triangle';
        pad.frequency.setValueAtTime(freq, now);
        pf.type = 'lowpass';
        pf.frequency.value = 520 + combatIntensity * 280;
        pg.gain.setValueAtTime(0.001, now);
        pg.gain.linearRampToValueAtTime(0.065, now + 0.9);
        pg.gain.exponentialRampToValueAtTime(0.001, now + 4.4);
        pad.connect(pf);
        pf.connect(pg);
        pg.connect(this.musicGain!);
        pad.start(now);
        pad.stop(now + 4.5);
      });
    }

    // 3. Kivu hand-drum / war percussion groove (djembe-style low & muted slap)
    if (inMatch) {
      if (step === 0 || step === 3 || step === 10 || (combatIntensity > 0.35 && step === 14)) {
        const drum = this.ctx.createOscillator();
        const dg = this.ctx.createGain();
        drum.type = 'sine';
        const baseF = step === 0 || step === 10 ? 112 : 148;
        drum.frequency.setValueAtTime(baseF * 1.4, now);
        drum.frequency.exponentialRampToValueAtTime(baseF * 0.52, now + 0.14);
        dg.gain.setValueAtTime(0.001, now);
        dg.gain.linearRampToValueAtTime(0.18 + combatIntensity * 0.12, now + 0.008);
        dg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        drum.connect(dg);
        dg.connect(this.musicGain);
        drum.start(now);
        drum.stop(now + 0.2);
      }

      // Soft tactical shaker on off-beats when combat heats up
      if (combatIntensity > 0.2 && this.noiseBuffer && step % 2 === 1) {
        const sh = this.ctx.createBufferSource();
        sh.buffer = this.noiseBuffer;
        const sf = this.ctx.createBiquadFilter();
        sf.type = 'highpass';
        sf.frequency.value = 4200;
        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(0.035 * combatIntensity, now);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        sh.connect(sf);
        sf.connect(sg);
        sg.connect(this.musicGain);
        sh.start(now);
        sh.stop(now + 0.05);
      }
    }
  }

  public updateAmbience(distanceToRiver: number, rainIntensity = 0, windStrength = 1) {
    if (!this.ctx || !this.riverGain || this.muted) return;
    const riverVol = Math.max(0.012, Math.min(0.16, 0.16 * Math.exp(-distanceToRiver * 0.045)));
    this.riverGain.gain.setTargetAtTime(riverVol, this.ctx.currentTime, 0.12);
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(rainIntensity * 0.24, this.ctx.currentTime, 0.25);
    }
    if (this.windGain) {
      const wVol = Math.min(0.14, 0.025 + windStrength * 0.012);
      this.windGain.gain.setTargetAtTime(wVol, this.ctx.currentTime, 0.25);
    }
  }

  public playThunder(intensity = 0.85) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + 2.6);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.75 * intensity, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.28 * intensity, now + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 2.9);
  }

  public playGunshot(weaponId: WeaponId, distance = 0) {
    if (isRocketWeapon(weaponId)) {
      this.playBazookaLaunch(distance);
      return;
    }
    if (isFlameWeapon(weaponId)) {
      this.playFlamethrowerBurst(distance);
      return;
    }
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    if (distance > 155) return;

    const now = this.ctx.currentTime;
    const atten = distance <= 1 ? 1 : Math.max(0.035, 1 / (1 + distance * 0.064));

    const isSuppressed = weaponId === 'vss';
    const isHeavy50 = weaponId === 'barrett';
    const isSniper = isSniperWeapon(weaponId);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isSuppressed
      ? 2400
      : isHeavy50
      ? 860
      : isSniper
      ? 1480
      : weaponId === 'ak47' || weaponId === 'fnfal'
      ? 1020
      : 1340;
    filter.Q.value = isSuppressed ? 1.4 : 0.65;

    const nGain = this.ctx.createGain();
    const tailDur = isSuppressed ? 0.14 : isHeavy50 ? 0.78 : isSniper ? 0.56 : 0.34;
    const peakGain = isSuppressed ? 0.28 : isHeavy50 ? 0.92 : 0.62;
    nGain.gain.setValueAtTime(peakGain * atten, now);
    nGain.gain.exponentialRampToValueAtTime(0.08 * atten, now + 0.055);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + tailDur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + tailDur + 0.02);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const startFreq = isSuppressed
      ? 125
      : isHeavy50
      ? 115
      : isSniper
      ? 178
      : weaponId === 'ak47' || weaponId === 'fnfal'
      ? 144
      : 192;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isHeavy50 ? 26 : 36, now + (isHeavy50 ? 0.19 : 0.11));
    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime((isSuppressed ? 0.22 : isHeavy50 ? 0.72 : 0.45) * atten, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy50 ? 0.22 : 0.12));
    osc.connect(oGain);
    oGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isHeavy50 ? 0.24 : 0.13));
  }

  public playFlamethrowerBurst(distance = 0) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    if (distance > 65) return;

    const now = this.ctx.currentTime;
    const atten = distance <= 1 ? 1 : Math.max(0.05, 1 / (1 + distance * 0.09));

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(640 + Math.random() * 180, now);
    filter.frequency.exponentialRampToValueAtTime(290, now + 0.18);
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32 * atten, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.19);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now, Math.random() * 1.2, 0.2);
  }

  public playBazookaLaunch(distance = 0) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    if (distance > 150) return;

    const now = this.ctx.currentTime;
    const atten = distance <= 1 ? 1 : Math.max(0.04, 1 / (1 + distance * 0.055));

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.65);
    filter.Q.value = 0.55;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.85 * atten, now);
    nGain.gain.exponentialRampToValueAtTime(0.28 * atten, now + 0.25);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.74);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime(0.65 * atten, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(oGain);
    oGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playBulletWhiz() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900 + Math.random() * 500, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playFootstep(surface: SurfaceType, sprinting: boolean) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const vol = sprinting ? 0.18 : 0.11;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    if (surface === 'water') {
      filter.type = 'bandpass';
      filter.frequency.value = 920 + Math.random() * 250;
      filter.Q.value = 0.9;
      g.gain.setValueAtTime(vol * 1.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.25);
    } else if (surface === 'wood') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.07);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(vol * 1.25, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(og);
      og.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.09);

      filter.type = 'lowpass';
      filter.frequency.value = 600;
      g.gain.setValueAtTime(vol * 0.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.09);
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = surface === 'mud' ? 460 : 720;
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.1);
    }
  }

  public playHitmarker(headshot: boolean) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1760 : 1180, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 980 : 620, now + 0.055);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(headshot ? 0.22 : 0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playReload() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 0.28, 0.62].forEach((offset, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 2 ? 520 : 310, now + offset);
      osc.frequency.exponentialRampToValueAtTime(140, now + offset + 0.045);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.09, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.055);
    });
  }

  public playExplosion(distance = 0) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.08, 1 / (1 + distance * 0.04));

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 1.1);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.95 * atten, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 1.3);

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.65);
    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.75 * atten, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sub.connect(sGain);
    sGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.72);
  }

  public playRadioSquelch() {
    if (!this.ctx || !this.voiceGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1020, now);
    osc.frequency.setValueAtTime(1320, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.065, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.voiceGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playDiveThud(distance = 0) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    if (distance > 35) return;
    const now = this.ctx.currentTime;
    const atten = Math.max(0.1, 1 / (1 + distance * 0.09));
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28 * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playSmokeDeploy(distance = 0) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    if (distance > 90) return;
    const now = this.ctx.currentTime;
    const atten = distance <= 1 ? 1 : Math.max(0.08, 1 / (1 + distance * 0.045));

    // Metallic canister pop
    const pop = this.ctx.createOscillator();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(240, now);
    pop.frequency.exponentialRampToValueAtTime(70, now + 0.09);
    const pGain = this.ctx.createGain();
    pGain.gain.setValueAtTime(0.32 * atten, now);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    pop.connect(pGain);
    pGain.connect(this.sfxGain);
    pop.start(now);
    pop.stop(now + 0.12);

    // Pressurized tactical smoke hiss (1.8s pressurized burst)
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.noiseBuffer;
    hiss.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, now);
    filter.frequency.exponentialRampToValueAtTime(1150, now + 1.9);
    filter.Q.value = 0.85;

    const hGain = this.ctx.createGain();
    hGain.gain.setValueAtTime(0.005, now);
    hGain.gain.linearRampToValueAtTime(0.36 * atten, now + 0.08);
    hGain.gain.exponentialRampToValueAtTime(0.11 * atten, now + 0.9);
    hGain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

    hiss.connect(filter);
    filter.connect(hGain);
    hGain.connect(this.sfxGain);
    hiss.start(now);
    hiss.stop(now + 2.15);
  }

  public playRegenRecover() {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    // Subtle MW4 exhale / relief breath as auto-regeneration starts
    const breath = this.ctx.createBufferSource();
    breath.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.55);
    filter.Q.value = 1.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    breath.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    breath.start(now);
    breath.stop(now + 0.6);
  }

  public playHeartbeatPulse(severity: number) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const amp = Math.min(0.32, 0.08 + severity * 0.24);
    [0, 0.16].forEach((offset, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      const t = now + offset;
      osc.frequency.setValueAtTime(idx === 0 ? 64 : 54, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(idx === 0 ? amp : amp * 0.72, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playWoundGrunt() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playSlide(surface: SurfaceType) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(115, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.12);
    const tGain = this.ctx.createGain();
    tGain.gain.setValueAtTime(0.24, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    thump.connect(tGain);
    tGain.connect(this.sfxGain);
    thump.start(now);
    thump.stop(now + 0.14);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(
      surface === 'water' ? 1250 : surface === 'wood' ? 680 : 880,
      now
    );
    filter.frequency.exponentialRampToValueAtTime(surface === 'water' ? 620 : 340, now + 0.56);
    filter.Q.value = surface === 'water' ? 0.7 : 1.05;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.01, now);
    nGain.gain.linearRampToValueAtTime(surface === 'water' ? 0.28 : 0.22, now + 0.06);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.6);
  }

  public playCommandChirp(kind: 'issue' | 'ack' | 'promote') {
    if (!this.ctx || !this.voiceGain || this.muted) return;
    const now = this.ctx.currentTime;
    const tones =
      kind === 'issue'
        ? [1180, 1560]
        : kind === 'ack'
        ? [880, 1320]
        : [587.33, 783.99, 1046.5];

    tones.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = kind === 'promote' ? 'triangle' : 'sine';
      const t = now + i * (kind === 'promote' ? 0.085 : 0.055);
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(kind === 'promote' ? 0.14 : 0.085, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'promote' ? 0.24 : 0.08));
      osc.connect(g);
      g.connect(this.voiceGain!);
      osc.start(t);
      osc.stop(t + (kind === 'promote' ? 0.26 : 0.09));
    });
  }

  public playVoiceTimbre(style: 'vigorous' | 'funny', basePitchHz: number, distance = 0) {
    if (!this.ctx || !this.voiceGain || this.muted || this.voiceVolume <= 0.01) return;
    if (distance > 70) return;

    const now = this.ctx.currentTime;
    const atten = Math.max(0.2, Math.min(1.0, 1 - distance / 75));

    // Formant-filtered male chest resonance + radio squelch burst
    const syllables = style === 'funny' ? [0, 0.09, 0.19, 0.3] : [0, 0.11, 0.23];
    syllables.forEach((off, idx) => {
      const t = now + off;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      const pitchShift =
        style === 'funny'
          ? idx === 1
            ? 1.24
            : idx === 3
            ? 1.32
            : 0.96
          : idx === 0
          ? 1.05
          : 0.92;
      osc.frequency.setValueAtTime(basePitchHz * pitchShift, t);
      osc.frequency.exponentialRampToValueAtTime(
        basePitchHz * (style === 'funny' ? 1.12 : 0.84),
        t + 0.085
      );

      // Male vowel formant filter (700-1150 Hz band)
      const formant = this.ctx!.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(style === 'funny' ? 1080 : 760, t);
      formant.Q.value = 3.4;

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.065 * atten, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

      osc.connect(formant);
      formant.connect(g);
      g.connect(this.voiceGain!);
      osc.start(t);
      osc.stop(t + 0.095);
    });
  }

  public playFriendlyFireWarn() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = [560, 410];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.065;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  public playKillcamSting(entering = true) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(entering ? 190 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(entering ? 78 : 220, now + 0.24);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playDroneEvent(kind: 'deploy' | 'recall' | 'mark' | 'scan') {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const seq =
      kind === 'deploy'
        ? [540, 820, 1240]
        : kind === 'recall'
        ? [980, 620, 410]
        : kind === 'mark'
        ? [1320, 1760]
        : [920];
    seq.forEach((freq, i) => {
      const t = now + i * 0.048;
      const osc = this.ctx!.createOscillator();
      osc.type = kind === 'mark' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(kind === 'mark' ? 0.14 : 0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.085);
    });
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
  }
}
