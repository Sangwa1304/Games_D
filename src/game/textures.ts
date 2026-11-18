import * as THREE from 'three';

export interface ProceduralTexturePack {
  terrainDetail: THREE.CanvasTexture;
  terrainBump: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  foliageLeaf: THREE.CanvasTexture;
  grassBlade: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  sandbagWeave: THREE.CanvasTexture;
  corrugatedMetal: THREE.CanvasTexture;
  rockSurface: THREE.CanvasTexture;
  brickWall: THREE.CanvasTexture;
  concretePad: THREE.CanvasTexture;
  camoArmy: THREE.CanvasTexture;
  camoRebel: THREE.CanvasTexture;
  tacticalFabric: THREE.CanvasTexture;
  brushedSteel: THREE.CanvasTexture;
  walnutWood: THREE.CanvasTexture;
  weaponPolymerBlack: THREE.CanvasTexture;
  weaponFdeTan: THREE.CanvasTexture;
  weaponOliveMetal: THREE.CanvasTexture;
  weaponBakelite: THREE.CanvasTexture;
  weaponTigerWood: THREE.CanvasTexture;
  weaponHazardYellow: THREE.CanvasTexture;
  fireFlameSprite: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  smokePuff: THREE.CanvasTexture;
  dustMote: THREE.CanvasTexture;
  fallingLeaf: THREE.CanvasTexture;
  waterDroplet: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  clampEdge = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTexturePack(renderer: THREE.WebGLRenderer): ProceduralTexturePack {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const created: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    created.push(t);
    return t;
  };

  // 1. Rich Terrain micro-detail (laterite grit, soil pores, grass blades, pebble relief)
  const [tdC, tdCtx] = makeCanvas(512, 512);
  const [tbC, tbCtx] = makeCanvas(512, 512);
  tdCtx.fillStyle = '#c4c0b4';
  tdCtx.fillRect(0, 0, 512, 512);
  tbCtx.fillStyle = '#808080';
  tbCtx.fillRect(0, 0, 512, 512);
  const randT = seededRand(104729);
  for (let i = 0; i < 8200; i++) {
    const x = randT() * 512;
    const y = randT() * 512;
    const r = 0.8 + randT() * 4.2;
    const v = Math.floor(132 + randT() * 98);
    tdCtx.fillStyle = `rgba(${v}, ${Math.floor(v * 0.96)}, ${Math.floor(v * 0.88)}, 0.34)`;
    tdCtx.beginPath();
    tdCtx.arc(x, y, r, 0, Math.PI * 2);
    tdCtx.fill();

    const bv = Math.floor(65 + randT() * 145);
    tbCtx.fillStyle = `rgba(${bv},${bv},${bv},0.38)`;
    tbCtx.beginPath();
    tbCtx.arc(x, y, r * 1.15, 0, Math.PI * 2);
    tbCtx.fill();
  }
  // Fine soil fissures & dry leaf litter strokes
  for (let i = 0; i < 950; i++) {
    const x = randT() * 512;
    const y = randT() * 512;
    const ang = randT() * Math.PI * 2;
    const len = 4 + randT() * 11;
    tdCtx.strokeStyle = randT() > 0.5 ? 'rgba(92,82,66,0.28)' : 'rgba(218,212,188,0.2)';
    tdCtx.lineWidth = 1.1;
    tdCtx.beginPath();
    tdCtx.moveTo(x, y);
    tdCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    tdCtx.stroke();
  }
  const terrainDetail = track(finalizeTexture(tdC, true, 44, 44, maxAniso));
  const terrainBump = track(finalizeTexture(tbC, false, 44, 44, maxAniso));

  // 2. Tropical rainforest bark (deep vertical furrows + moss/lichen)
  const [bkC, bkCtx] = makeCanvas(256, 512);
  const [bkbC, bkbCtx] = makeCanvas(256, 512);
  bkCtx.fillStyle = '#473829';
  bkCtx.fillRect(0, 0, 256, 512);
  bkbCtx.fillStyle = '#7c7c7c';
  bkbCtx.fillRect(0, 0, 256, 512);
  const randB = seededRand(5521);
  for (let i = 0; i < 520; i++) {
    const x = randB() * 256;
    const y = randB() * 512;
    const w = 1.5 + randB() * 5.5;
    const h = 24 + randB() * 96;
    const dark = randB() > 0.45;
    bkCtx.fillStyle = dark ? 'rgba(24,18,12,0.58)' : 'rgba(98,86,62,0.38)';
    bkCtx.fillRect(x, y, w, h);
    bkbCtx.fillStyle = dark ? 'rgba(28,28,28,0.7)' : 'rgba(215,215,215,0.48)';
    bkbCtx.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 42; i++) {
    bkCtx.fillStyle = 'rgba(72, 102, 56, 0.36)';
    bkCtx.beginPath();
    bkCtx.ellipse(randB() * 256, randB() * 512, 8 + randB() * 14, 5 + randB() * 10, 0, 0, Math.PI * 2);
    bkCtx.fill();
  }
  const barkAlbedo = track(finalizeTexture(bkC, true, 2, 3, maxAniso));
  const barkBump = track(finalizeTexture(bkbC, false, 2, 3, maxAniso));

  // 2b. Clean Alpha-Tested Tropical Foliage Leaf Cluster Card
  const [lfC, lfCtx] = makeCanvas(256, 256);
  lfCtx.clearRect(0, 0, 256, 256);
  const randL = seededRand(9012);
  // Central twig
  lfCtx.strokeStyle = '#483b28';
  lfCtx.lineWidth = 4;
  lfCtx.beginPath();
  lfCtx.moveTo(128, 242);
  lfCtx.quadraticCurveTo(124, 130, 128, 32);
  lfCtx.stroke();

  const drawLeaf = (cx: number, cy: number, len: number, wid: number, angle: number, shade: number) => {
    lfCtx.save();
    lfCtx.translate(cx, cy);
    lfCtx.rotate(angle);
    const g = Math.floor(110 + shade * 65);
    const r = Math.floor(48 + shade * 42);
    const b = Math.floor(34 + shade * 24);
    const grad = lfCtx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, `rgb(${Math.floor(r * 0.72)}, ${Math.floor(g * 0.78)}, ${Math.floor(b * 0.8)})`);
    grad.addColorStop(1, `rgb(${Math.min(255, r + 26)}, ${Math.min(255, g + 36)}, ${Math.min(255, b + 16)})`);
    lfCtx.fillStyle = grad;
    lfCtx.beginPath();
    lfCtx.moveTo(0, 0);
    lfCtx.quadraticCurveTo(-wid, -len * 0.45, 0, -len);
    lfCtx.quadraticCurveTo(wid, -len * 0.45, 0, 0);
    lfCtx.closePath();
    lfCtx.fill();

    // Central leaf vein
    lfCtx.strokeStyle = 'rgba(180, 210, 125, 0.42)';
    lfCtx.lineWidth = 1.4;
    lfCtx.beginPath();
    lfCtx.moveTo(0, -2);
    lfCtx.lineTo(0, -len * 0.88);
    lfCtx.stroke();
    lfCtx.restore();
  };

  for (let i = 0; i < 34; i++) {
    const t = i / 34;
    const cy = 225 - t * 175 + (randL() - 0.5) * 26;
    const cx = 128 + (randL() - 0.5) * 90;
    const angle = (randL() - 0.5) * 2.5;
    const len = 36 + randL() * 34;
    const wid = 13 + randL() * 11;
    drawLeaf(cx, cy, len, wid, angle, randL());
  }
  const foliageLeaf = track(finalizeTexture(lfC, true, 1, 1, maxAniso, true));

  // 2c. Natural Grass Blade Micro-Texture
  const [gbC, gbCtx] = makeCanvas(64, 256);
  const gGrad = gbCtx.createLinearGradient(0, 256, 0, 0);
  gGrad.addColorStop(0, '#2a451c');
  gGrad.addColorStop(0.55, '#4c752b');
  gGrad.addColorStop(1, '#7ea346');
  gbCtx.fillStyle = gGrad;
  gbCtx.fillRect(0, 0, 64, 256);
  for (let x = 4; x < 64; x += 6) {
    gbCtx.fillStyle = x % 12 === 0 ? 'rgba(22,42,14,0.28)' : 'rgba(175,210,110,0.18)';
    gbCtx.fillRect(x, 0, 2, 256);
  }
  const grassBlade = track(finalizeTexture(gbC, true, 1, 1, maxAniso, true));

  // 3. Weathered timber planks
  const [wpC, wpCtx] = makeCanvas(512, 512);
  wpCtx.fillStyle = '#6f5236';
  wpCtx.fillRect(0, 0, 512, 512);
  const randW = seededRand(8831);
  const plankCount = 6;
  const ph = 512 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const y0 = p * ph;
    const tone = 88 + Math.floor(randW() * 34);
    wpCtx.fillStyle = `rgb(${tone + 18}, ${tone - 2}, ${tone - 28})`;
    wpCtx.fillRect(0, y0 + 2, 512, ph - 4);
    for (let g = 0; g < 65; g++) {
      const gy = y0 + 3 + randW() * (ph - 6);
      wpCtx.fillStyle = randW() > 0.5 ? 'rgba(42,28,16,0.28)' : 'rgba(155,122,82,0.18)';
      wpCtx.fillRect(0, gy, 512, 1 + randW() * 2);
    }
    wpCtx.fillStyle = '#251a11';
    wpCtx.fillRect(0, y0, 512, 3);
  }
  const woodPlank = track(finalizeTexture(wpC, true, 1, 1, maxAniso));

  // 4. Sandbag burlap weave
  const [sbC, sbCtx] = makeCanvas(256, 256);
  sbCtx.fillStyle = '#a38d68';
  sbCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    sbCtx.fillStyle = y % 8 === 0 ? 'rgba(72,58,38,0.22)' : 'rgba(210,192,155,0.16)';
    sbCtx.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 4) {
    sbCtx.fillStyle = x % 8 === 0 ? 'rgba(72,58,38,0.2)' : 'rgba(210,192,155,0.14)';
    sbCtx.fillRect(x, 0, 2, 256);
  }
  const randS = seededRand(9923);
  for (let i = 0; i < 60; i++) {
    sbCtx.fillStyle = 'rgba(130, 62, 36, 0.14)';
    sbCtx.beginPath();
    sbCtx.arc(randS() * 256, randS() * 256, 6 + randS() * 18, 0, Math.PI * 2);
    sbCtx.fill();
  }
  const sandbagWeave = track(finalizeTexture(sbC, true, 2, 2, maxAniso));

  // 5. Corrugated rusted tin roof
  const [cmC, cmCtx] = makeCanvas(256, 256);
  for (let x = 0; x < 256; x++) {
    const wave = Math.sin((x / 256) * Math.PI * 16) * 0.5 + 0.5;
    const c = Math.floor(85 + wave * 68);
    cmCtx.fillStyle = `rgb(${c}, ${Math.floor(c * 0.96)}, ${Math.floor(c * 0.92)})`;
    cmCtx.fillRect(x, 0, 1, 256);
  }
  const randM = seededRand(4412);
  for (let i = 0; i < 90; i++) {
    cmCtx.fillStyle = `rgba(${105 + Math.floor(randM() * 35)}, ${48 + Math.floor(randM() * 25)}, 24, ${0.15 + randM() * 0.35})`;
    cmCtx.beginPath();
    cmCtx.ellipse(randM() * 256, randM() * 256, 6 + randM() * 22, 10 + randM() * 30, 0, 0, Math.PI * 2);
    cmCtx.fill();
  }
  const corrugatedMetal = track(finalizeTexture(cmC, true, 2, 2, maxAniso));

  // 6. Volcanic basalt rock
  const [rkC, rkCtx] = makeCanvas(256, 256);
  rkCtx.fillStyle = '#4e524e';
  rkCtx.fillRect(0, 0, 256, 256);
  const randR = seededRand(3117);
  for (let i = 0; i < 900; i++) {
    const shade = 48 + Math.floor(randR() * 62);
    rkCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade - 2}, 0.4)`;
    rkCtx.fillRect(randR() * 256, randR() * 256, 2 + randR() * 8, 2 + randR() * 8);
  }
  for (let i = 0; i < 40; i++) {
    rkCtx.fillStyle = 'rgba(75, 96, 56, 0.3)';
    rkCtx.beginPath();
    rkCtx.arc(randR() * 256, randR() * 256, 4 + randR() * 14, 0, Math.PI * 2);
    rkCtx.fill();
  }
  const rockSurface = track(finalizeTexture(rkC, true, 2, 2, maxAniso));

  // 6b. Weathered Laterite Brick Wall (Mission ruins, Customs, Pump station)
  const [brC, brCtx] = makeCanvas(256, 256);
  brCtx.fillStyle = '#7c7366';
  brCtx.fillRect(0, 0, 256, 256);
  const randBr = seededRand(6182);
  const rows = 10;
  const cols = 5;
  const bh = 256 / rows;
  const bw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const cr = 128 + Math.floor(randBr() * 38);
      const cg = 72 + Math.floor(randBr() * 22);
      const cb = 52 + Math.floor(randBr() * 18);
      brCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
      brCtx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  const brickWall = track(finalizeTexture(brC, true, 2, 2, maxAniso));

  // 6c. Concrete / Helipad Surface
  const [cpC, cpCtx] = makeCanvas(256, 256);
  cpCtx.fillStyle = '#737671';
  cpCtx.fillRect(0, 0, 256, 256);
  const randCp = seededRand(7431);
  for (let i = 0; i < 1600; i++) {
    const s = 92 + Math.floor(randCp() * 52);
    cpCtx.fillStyle = `rgba(${s},${s},${s},0.28)`;
    cpCtx.fillRect(randCp() * 256, randCp() * 256, 2 + randCp() * 4, 2 + randCp() * 4);
  }
  cpCtx.strokeStyle = 'rgba(42, 44, 41, 0.4)';
  cpCtx.lineWidth = 2;
  cpCtx.strokeRect(2, 2, 252, 252);
  const concretePad = track(finalizeTexture(cpC, true, 2, 2, maxAniso));

  // 7. Army Woodland Camo & Rebel Earth Gear + Ripstop Tactical Fabric Bump
  const [caC, caCtx] = makeCanvas(256, 256);
  caCtx.fillStyle = '#3c4a31';
  caCtx.fillRect(0, 0, 256, 256);
  const randC1 = seededRand(712);
  const armyColors = ['#293420', '#545f39', '#4a3d28', '#22281c'];
  for (let i = 0; i < 110; i++) {
    caCtx.fillStyle = armyColors[i % armyColors.length];
    caCtx.beginPath();
    caCtx.ellipse(randC1() * 256, randC1() * 256, 10 + randC1() * 26, 7 + randC1() * 18, randC1() * 3, 0, Math.PI * 2);
    caCtx.fill();
  }
  const camoArmy = track(finalizeTexture(caC, true, 2, 2, maxAniso));

  const [crC, crCtx] = makeCanvas(256, 256);
  crCtx.fillStyle = '#5a4734';
  crCtx.fillRect(0, 0, 256, 256);
  const randC2 = seededRand(819);
  const rebelColors = ['#3d3124', '#6d583d', '#3e4532', '#2d241b'];
  for (let i = 0; i < 95; i++) {
    crCtx.fillStyle = rebelColors[i % rebelColors.length];
    crCtx.beginPath();
    crCtx.ellipse(randC2() * 256, randC2() * 256, 9 + randC2() * 22, 6 + randC2() * 15, randC2() * 3, 0, Math.PI * 2);
    crCtx.fill();
  }
  const camoRebel = track(finalizeTexture(crC, true, 2, 2, maxAniso));

  const [tfC, tfCtx] = makeCanvas(128, 128);
  tfCtx.fillStyle = '#808080';
  tfCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {
    tfCtx.fillStyle = i % 8 === 0 ? 'rgba(40,40,40,0.45)' : 'rgba(210,210,210,0.35)';
    tfCtx.fillRect(0, i, 128, 1);
    tfCtx.fillRect(i, 0, 1, 128);
  }
  const tacticalFabric = track(finalizeTexture(tfC, false, 4, 4, maxAniso));

  // 8. Brushed Gunmetal Steel & Walnut Wood (weapons)
  const [bsC, bsCtx] = makeCanvas(256, 256);
  bsCtx.fillStyle = '#2d3136';
  bsCtx.fillRect(0, 0, 256, 256);
  const randBS = seededRand(601);
  for (let y = 0; y < 256; y++) {
    const v = 34 + Math.floor(randBS() * 26);
    bsCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    bsCtx.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 24; i++) {
    bsCtx.fillStyle = 'rgba(180,190,200,0.08)';
    bsCtx.fillRect(0, Math.floor(randBS() * 256), 256, 1);
  }
  const brushedSteel = track(finalizeTexture(bsC, true, 1, 1, maxAniso));

  const [wwC, wwCtx] = makeCanvas(256, 256);
  wwCtx.fillStyle = '#62351c';
  wwCtx.fillRect(0, 0, 256, 256);
  const randWW = seededRand(774);
  for (let y = 0; y < 256; y += 2) {
    wwCtx.fillStyle = randWW() > 0.5 ? 'rgba(42,18,8,0.38)' : 'rgba(135,78,38,0.25)';
    wwCtx.fillRect(0, y, 256, 2);
  }
  const walnutWood = track(finalizeTexture(wwC, true, 1, 1, maxAniso));

  // 8b. Stippled Matte Black Tactical Polymer (M4, HK416, FAMAS, SG552, VSS suppressor)
  const [wpC, wpCtx] = makeCanvas(256, 256);
  wpCtx.fillStyle = '#1e2124';
  wpCtx.fillRect(0, 0, 256, 256);
  const randWP = seededRand(4109);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const s = 22 + Math.floor(randWP() * 24);
      wpCtx.fillStyle = `rgb(${s},${s + 1},${s + 2})`;
      wpCtx.fillRect(x, y, 3, 3);
    }
  }
  const weaponPolymerBlack = track(finalizeTexture(wpC, true, 2, 2, maxAniso));

  // 8c. FDE Desert Sand Ceramic Alloy (SCAR-L, MK20 SSR)
  const [fdC, fdCtx] = makeCanvas(256, 256);
  fdCtx.fillStyle = '#a38963';
  fdCtx.fillRect(0, 0, 256, 256);
  const randFD = seededRand(5203);
  for (let i = 0; i < 1800; i++) {
    const shade = 132 + Math.floor(randFD() * 44);
    fdCtx.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.85)}, ${Math.floor(shade * 0.62)}, 0.35)`;
    fdCtx.fillRect(randFD() * 256, randFD() * 256, 2 + randFD() * 6, 1 + randFD() * 2);
  }
  const weaponFdeTan = track(finalizeTexture(fdC, true, 1, 1, maxAniso));

  // 8d. Military Olive Drab Weathered Coating (AUG, AWM, AT4, LPO-50)
  const [olC, olCtx] = makeCanvas(256, 256);
  olCtx.fillStyle = '#404c33';
  olCtx.fillRect(0, 0, 256, 256);
  const randOL = seededRand(6131);
  for (let i = 0; i < 1400; i++) {
    const v = 50 + Math.floor(randOL() * 38);
    olCtx.fillStyle = `rgba(${v}, ${v + 12}, ${Math.max(20, v - 10)}, 0.34)`;
    olCtx.fillRect(randOL() * 256, randOL() * 256, 3 + randOL() * 8, 1 + randOL() * 3);
  }
  for (let i = 0; i < 24; i++) {
    olCtx.fillStyle = 'rgba(170,175,165,0.12)';
    olCtx.fillRect(randOL() * 220, randOL() * 256, 12 + randOL() * 28, 1);
  }
  const weaponOliveMetal = track(finalizeTexture(olC, true, 1, 1, maxAniso));

  // 8e. Marbled Orange-Brown Bakelite (AK-74M magazines & accents)
  const [baC, baCtx] = makeCanvas(128, 128);
  baCtx.fillStyle = '#8b3d1a';
  baCtx.fillRect(0, 0, 128, 128);
  const randBA = seededRand(7229);
  for (let i = 0; i < 280; i++) {
    baCtx.fillStyle = randBA() > 0.45 ? 'rgba(176, 78, 28, 0.35)' : 'rgba(72, 24, 10, 0.35)';
    baCtx.beginPath();
    baCtx.ellipse(randBA() * 128, randBA() * 128, 4 + randBA() * 12, 1.5 + randBA() * 4, randBA() * 1.4, 0, Math.PI * 2);
    baCtx.fill();
  }
  const weaponBakelite = track(finalizeTexture(baC, true, 1, 1, maxAniso));

  // 8f. Laminated Tiger-Stripe Hardwood (SVD, VSS)
  const [twC, twCtx] = makeCanvas(256, 256);
  twCtx.fillStyle = '#6f3b1e';
  twCtx.fillRect(0, 0, 256, 256);
  const randTW = seededRand(8317);
  for (let y = 0; y < 256; y += 3) {
    const wave = Math.sin(y * 0.18) * 14;
    twCtx.fillStyle = randTW() > 0.4 ? 'rgba(42, 19, 8, 0.45)' : 'rgba(155, 92, 46, 0.28)';
    twCtx.fillRect(0, y + wave * 0.15, 256, 2);
  }
  const weaponTigerWood = track(finalizeTexture(twC, true, 1, 1, maxAniso));

  // 8g. Ordnance Caution Stripe / Pressurized Tank Coating (AT4, M2A1 Flamethrower)
  const [hzC, hzCtx] = makeCanvas(256, 256);
  hzCtx.fillStyle = '#38432b';
  hzCtx.fillRect(0, 0, 256, 256);
  hzCtx.fillStyle = '#eab308';
  hzCtx.fillRect(0, 96, 256, 28);
  hzCtx.fillStyle = '#18181b';
  for (let x = -32; x < 288; x += 28) {
    hzCtx.beginPath();
    hzCtx.moveTo(x, 96);
    hzCtx.lineTo(x + 14, 96);
    hzCtx.lineTo(x + 2, 124);
    hzCtx.lineTo(x - 12, 124);
    hzCtx.closePath();
    hzCtx.fill();
  }
  const weaponHazardYellow = track(finalizeTexture(hzC, true, 1, 1, maxAniso));

  // 8h. Volumetric Incandescent Fire Flame Sprite (flamethrower jet & burning bodies)
  const [ffC, ffCtx] = makeCanvas(128, 128);
  const randFF = seededRand(9141);
  const fg = ffCtx.createRadialGradient(64, 68, 4, 64, 64, 58);
  fg.addColorStop(0, 'rgba(255, 254, 224, 1)');
  fg.addColorStop(0.28, 'rgba(255, 200, 64, 0.94)');
  fg.addColorStop(0.58, 'rgba(249, 82, 22, 0.72)');
  fg.addColorStop(0.84, 'rgba(185, 28, 28, 0.34)');
  fg.addColorStop(1, 'rgba(90, 12, 12, 0)');
  ffCtx.fillStyle = fg;
  ffCtx.beginPath();
  ffCtx.arc(64, 64, 58, 0, Math.PI * 2);
  ffCtx.fill();
  for (let i = 0; i < 8; i++) {
    const lx = 64 + (randFF() - 0.5) * 34;
    const ly = 56 + (randFF() - 0.5) * 36;
    const lr = 12 + randFF() * 18;
    const lg = ffCtx.createRadialGradient(lx, ly, 1, lx, ly, lr);
    lg.addColorStop(0, 'rgba(255, 240, 175, 0.6)');
    lg.addColorStop(1, 'rgba(255, 110, 20, 0)');
    ffCtx.fillStyle = lg;
    ffCtx.beginPath();
    ffCtx.arc(lx, ly, lr, 0, Math.PI * 2);
    ffCtx.fill();
  }
  const fireFlameSprite = track(new THREE.CanvasTexture(ffC));
  fireFlameSprite.colorSpace = THREE.SRGBColorSpace;
  fireFlameSprite.needsUpdate = true;

  // 9. Soft radial contact shadow
  const [csC, csCtx] = makeCanvas(128, 128);
  const gradCS = csCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradCS.addColorStop(0, 'rgba(8, 10, 8, 0.85)');
  gradCS.addColorStop(0.55, 'rgba(8, 10, 8, 0.38)');
  gradCS.addColorStop(1, 'rgba(8, 10, 8, 0)');
  csCtx.fillStyle = gradCS;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = track(new THREE.CanvasTexture(csC));
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  // 10. Smoke / Dust / Splash Puff Sprite
  const [smC, smCtx] = makeCanvas(128, 128);
  const gradSM = smCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  gradSM.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradSM.addColorStop(0.45, 'rgba(240, 240, 235, 0.55)');
  gradSM.addColorStop(1, 'rgba(230, 230, 225, 0)');
  smCtx.fillStyle = gradSM;
  smCtx.fillRect(0, 0, 128, 128);
  const smokePuff = track(new THREE.CanvasTexture(smC));
  smokePuff.colorSpace = THREE.SRGBColorSpace;
  smokePuff.needsUpdate = true;

  // 11. Organic Ground Dust Mote Sprite (soft grit + irregular cloud edge)
  const [dmC, dmCtx] = makeCanvas(128, 128);
  const randDM = seededRand(2197);
  for (let i = 0; i < 18; i++) {
    const cx = 64 + (randDM() - 0.5) * 34;
    const cy = 64 + (randDM() - 0.5) * 34;
    const r = 18 + randDM() * 26;
    const gD = dmCtx.createRadialGradient(cx, cy, 2, cx, cy, r);
    gD.addColorStop(0, 'rgba(255, 246, 232, 0.42)');
    gD.addColorStop(0.6, 'rgba(232, 212, 186, 0.18)');
    gD.addColorStop(1, 'rgba(210, 185, 155, 0)');
    dmCtx.fillStyle = gD;
    dmCtx.beginPath();
    dmCtx.arc(cx, cy, r, 0, Math.PI * 2);
    dmCtx.fill();
  }
  const dustMote = track(new THREE.CanvasTexture(dmC));
  dustMote.colorSpace = THREE.SRGBColorSpace;
  dustMote.needsUpdate = true;

  // 12. Detailed Single Tropical Falling Leaf (alpha-tested 3D leaf particle)
  const [flC, flCtx] = makeCanvas(128, 128);
  flCtx.clearRect(0, 0, 128, 128);
  // Petiole stem
  flCtx.strokeStyle = '#4e3c22';
  flCtx.lineWidth = 3.5;
  flCtx.beginPath();
  flCtx.moveTo(64, 120);
  flCtx.quadraticCurveTo(62, 106, 64, 96);
  flCtx.stroke();
  // Leaf blade
  const leafGrad = flCtx.createLinearGradient(34, 96, 94, 14);
  leafGrad.addColorStop(0, '#5a8234');
  leafGrad.addColorStop(0.55, '#76a042');
  leafGrad.addColorStop(1, '#9ab54c');
  flCtx.fillStyle = leafGrad;
  flCtx.beginPath();
  flCtx.moveTo(64, 98);
  flCtx.bezierCurveTo(24, 82, 22, 34, 64, 8);
  flCtx.bezierCurveTo(106, 34, 104, 82, 64, 98);
  flCtx.closePath();
  flCtx.fill();
  // Central midrib & side veins
  flCtx.strokeStyle = 'rgba(215, 230, 155, 0.55)';
  flCtx.lineWidth = 2;
  flCtx.beginPath();
  flCtx.moveTo(64, 96);
  flCtx.quadraticCurveTo(63, 52, 64, 12);
  flCtx.stroke();
  flCtx.lineWidth = 1.2;
  for (let v = 0; v < 4; v++) {
    const vy = 78 - v * 16;
    flCtx.beginPath();
    flCtx.moveTo(64, vy);
    flCtx.lineTo(40 + v * 3, vy - 11);
    flCtx.moveTo(64, vy);
    flCtx.lineTo(88 - v * 3, vy - 11);
    flCtx.stroke();
  }
  const fallingLeaf = track(finalizeTexture(flC, true, 1, 1, maxAniso, true));

  // 13. Crisp Water Splash Droplet & Foam Sprite
  const [wdC, wdCtx] = makeCanvas(128, 128);
  const randWD = seededRand(3345);
  const gW = wdCtx.createRadialGradient(64, 64, 4, 64, 64, 52);
  gW.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  gW.addColorStop(0.45, 'rgba(216, 243, 238, 0.6)');
  gW.addColorStop(1, 'rgba(180, 225, 218, 0)');
  wdCtx.fillStyle = gW;
  wdCtx.beginPath();
  wdCtx.arc(64, 64, 52, 0, Math.PI * 2);
  wdCtx.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + randWD() * 0.3;
    const d = 24 + randWD() * 24;
    const r = 4 + randWD() * 6;
    wdCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    wdCtx.beginPath();
    wdCtx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2);
    wdCtx.fill();
  }
  const waterDroplet = track(new THREE.CanvasTexture(wdC));
  waterDroplet.colorSpace = THREE.SRGBColorSpace;
  waterDroplet.needsUpdate = true;

  return {
    terrainDetail,
    terrainBump,
    barkAlbedo,
    barkBump,
    foliageLeaf,
    grassBlade,
    woodPlank,
    sandbagWeave,
    corrugatedMetal,
    rockSurface,
    brickWall,
    concretePad,
    camoArmy,
    camoRebel,
    tacticalFabric,
    brushedSteel,
    walnutWood,
    weaponPolymerBlack,
    weaponFdeTan,
    weaponOliveMetal,
    weaponBakelite,
    weaponTigerWood,
    weaponHazardYellow,
    fireFlameSprite,
    contactShadow,
    smokePuff,
    dustMote,
    fallingLeaf,
    waterDroplet,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
