import * as THREE from 'three';
import { WeatherType } from './types';

export interface WeatherPreset {
  id: WeatherType;
  label: string;
  skyColor: THREE.Color;
  fogDensity: number;
  sunIntensity: number;
  sunColor: THREE.Color;
  hemiIntensity: number;
  exposure: number;
  rainDensity: number; // 0..1
  windStrength: number; // m/s lateral wind
  lightningChance: number;
}

export const WEATHER_ORDER: WeatherType[] = ['clear', 'mist', 'rain', 'storm'];
const _lightningSkyColor = new THREE.Color(0xdbeafe);

export const WEATHER_PRESETS: Record<WeatherType, WeatherPreset> = {
  clear: {
    id: 'clear',
    label: 'Éclaircie',
    skyColor: new THREE.Color('#7f9a8e'),
    fogDensity: 0.0075,
    sunIntensity: 2.15,
    sunColor: new THREE.Color('#ffedd0'),
    hemiIntensity: 0.78,
    exposure: 1.12,
    rainDensity: 0,
    windStrength: 1.2,
    lightningChance: 0,
  },
  mist: {
    id: 'mist',
    label: 'Brume du Kivu',
    skyColor: new THREE.Color('#708478'),
    fogDensity: 0.0165,
    sunIntensity: 1.35,
    sunColor: new THREE.Color('#e8e4d4'),
    hemiIntensity: 0.72,
    exposure: 1.05,
    rainDensity: 0,
    windStrength: 0.8,
    lightningChance: 0,
  },
  rain: {
    id: 'rain',
    label: 'Pluie Tropicale',
    skyColor: new THREE.Color('#51615c'),
    fogDensity: 0.0145,
    sunIntensity: 0.92,
    sunColor: new THREE.Color('#bfd0cc'),
    hemiIntensity: 0.66,
    exposure: 0.98,
    rainDensity: 0.65,
    windStrength: 4.5,
    lightningChance: 0,
  },
  storm: {
    id: 'storm',
    label: 'Orage Violent',
    skyColor: new THREE.Color('#313c3b'),
    fogDensity: 0.0205,
    sunIntensity: 0.52,
    sunColor: new THREE.Color('#9db3ba'),
    hemiIntensity: 0.56,
    exposure: 0.92,
    rainDensity: 1.0,
    windStrength: 8.5,
    lightningChance: 0.22,
  },
};

const RAIN_COUNT = 900;
const RAIN_BOX_XZ = 38;
const RAIN_BOX_Y = 22;

export class WeatherController {
  public currentWeather: WeatherType = WEATHER_ORDER[Math.floor(Math.random() * WEATHER_ORDER.length)];
  public autoCycle = true;
  public currentRainIntensity = 0;
  public windVector = new THREE.Vector3(1.2, 0, 0.5);

  private autoTimer = 36 + Math.random() * 22;
  private lightningTimer = 6;
  private lightningFlash = 0;
  private pendingThunderDelay = -1;

  private rainPositions: Float32Array;
  private rainLines: THREE.LineSegments;
  private rainMat: THREE.LineBasicMaterial;
  private lightningLight: THREE.DirectionalLight;

  private curSky = new THREE.Color('#708478');
  private curSun = new THREE.Color('#ffedd0');

  constructor(scene: THREE.Scene) {
    this.rainPositions = new Float32Array(RAIN_COUNT * 6);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * RAIN_BOX_XZ;
      const ry = Math.random() * RAIN_BOX_Y;
      const rz = (Math.random() - 0.5) * RAIN_BOX_XZ;
      this.setStreak(i, rx, ry, rz, 0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMat = new THREE.LineBasicMaterial({
      color: '#c7d9d4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(geo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    scene.add(this.rainLines);

    this.lightningLight = new THREE.DirectionalLight('#d8eaff', 0);
    this.lightningLight.position.set(-30, 80, -25);
    scene.add(this.lightningLight);
  }

  private setStreak(idx: number, x: number, y: number, z: number, windX: number) {
    const base = idx * 6;
    const len = 0.72;
    this.rainPositions[base] = x;
    this.rainPositions[base + 1] = y;
    this.rainPositions[base + 2] = z;
    this.rainPositions[base + 3] = x - windX * 0.045;
    this.rainPositions[base + 4] = y + len;
    this.rainPositions[base + 5] = z - 0.06;
  }

  public applyServerWeather(w: WeatherType) {
    this.currentWeather = w;
  }

  public randomizeWeather(): WeatherType {
    const pool = WEATHER_ORDER.filter((w) => w !== this.currentWeather);
    this.currentWeather = pool[Math.floor(Math.random() * pool.length)];
    this.autoTimer = 38 + Math.random() * 24;
    return this.currentWeather;
  }

  public update(
    dt: number,
    cameraPos: THREE.Vector3,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    sunLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    onThunder: (intensity: number) => void,
    onWeatherAutoChanged?: (w: WeatherType) => void,
    serverControlled = false
  ) {
    if (!serverControlled && this.autoCycle) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        this.randomizeWeather();
        onWeatherAutoChanged?.(this.currentWeather);
      }
    }

    const target = WEATHER_PRESETS[this.currentWeather];
    const blend = 1 - Math.exp(-0.55 * dt);

    this.curSky.lerp(target.skyColor, blend);
    this.curSun.lerp(target.sunColor, blend);
    this.currentRainIntensity = THREE.MathUtils.lerp(
      this.currentRainIntensity,
      target.rainDensity,
      blend
    );

    const targetWindX = target.windStrength;
    const targetWindZ = target.windStrength * 0.35;
    this.windVector.x = THREE.MathUtils.lerp(this.windVector.x, targetWindX, blend);
    this.windVector.z = THREE.MathUtils.lerp(this.windVector.z, targetWindZ, blend);

    // Lightning & Thunder during Storm
    if (target.lightningChance > 0) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4.5 + Math.random() * 7.5;
        this.lightningFlash = 1.0;
        this.pendingThunderDelay = 0.45 + Math.random() * 1.15;
      }
    }

    if (this.pendingThunderDelay >= 0) {
      this.pendingThunderDelay -= dt;
      if (this.pendingThunderDelay < 0) {
        onThunder(0.75 + Math.random() * 0.25);
      }
    }

    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);
    const flashBoost = this.lightningFlash > 0.35 ? this.lightningFlash : 0;
    this.lightningLight.intensity = flashBoost * 4.8;

    // Apply sky, fog & lighting smoothly
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(this.curSky);
      if (flashBoost > 0.001) {
        scene.background.lerp(_lightningSkyColor, flashBoost * 0.42);
      }
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(scene.background as THREE.Color);
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, target.fogDensity, blend);
    }

    sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, target.sunIntensity, blend) + flashBoost * 1.6;
    sunLight.color.copy(this.curSun);
    hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, target.hemiIntensity, blend);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      renderer.toneMappingExposure,
      target.exposure,
      blend
    );

    // Update 3D Rain Streaks around camera
    if (this.currentRainIntensity > 0.03) {
      this.rainLines.visible = true;
      this.rainMat.opacity = Math.min(0.48, this.currentRainIntensity * 0.46);
      const activeStreaks = Math.floor(RAIN_COUNT * this.currentRainIntensity);
      const fallSpeed = 24 + this.currentRainIntensity * 10;

      const minX = cameraPos.x - RAIN_BOX_XZ * 0.5;
      const maxX = cameraPos.x + RAIN_BOX_XZ * 0.5;
      const minZ = cameraPos.z - RAIN_BOX_XZ * 0.5;
      const maxZ = cameraPos.z + RAIN_BOX_XZ * 0.5;
      const minY = cameraPos.y - 6;
      const maxY = cameraPos.y + RAIN_BOX_Y - 6;

      for (let i = 0; i < RAIN_COUNT; i++) {
        const base = i * 6;
        if (i >= activeStreaks) {
          this.rainPositions[base + 1] = -999;
          this.rainPositions[base + 4] = -999;
          continue;
        }
        let x = this.rainPositions[base] + this.windVector.x * dt;
        let y = this.rainPositions[base + 1] - fallSpeed * dt;
        let z = this.rainPositions[base + 2] + this.windVector.z * dt;

        if (y < minY || y > maxY + 4) {
          x = minX + Math.random() * RAIN_BOX_XZ;
          y = maxY - Math.random() * 2;
          z = minZ + Math.random() * RAIN_BOX_XZ;
        }
        if (x < minX) x += RAIN_BOX_XZ;
        else if (x > maxX) x -= RAIN_BOX_XZ;
        if (z < minZ) z += RAIN_BOX_XZ;
        else if (z > maxZ) z -= RAIN_BOX_XZ;

        this.setStreak(i, x, y, z, this.windVector.x);
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }
  }
}
