'use strict';
/*
 * Jefes (112 × 112). Cada uno con paleta normal y "enfurecida" (fases 3–4).
 *  - El Carcelero (herald): mutante pesado con placas orgánicas, brazo-escudo y garfios.
 *  - Núcleo de Ruptura (matriarch): organismo energético con fragmentos orbitales y apéndices.
 */
const { P, xform } = require('../lib/model');
const C = require('./palette');

const TAU = Math.PI * 2;
const sin = Math.sin, cos = Math.cos;

const RAGE_FLESH = ['#180606', '#300a0a', '#4c1010', '#6e1814', '#94241a', '#c03a22'];

function carcelero(anim, f, rage) {
  const flesh = rage ? RAGE_FLESH : C.rust;
  const core = rage ? C.eWhite : C.eOrange;
  const tox = rage ? C.eGreen : C.eToxic;
  let ph = 0, pulse = 0, crouch = 0, armR = 0, armL = 0, lean = 0, collapse = 0, coreK = 1;
  if (anim === 'idle') { pulse = [0, 0.6, 1, 0.6][f]; }
  if (anim === 'move') { ph = (f / 4) * TAU; lean = 1; pulse = 0.5; }
  if (anim === 'windup') { crouch = 2 + f * 2; armR = -6 - f * 3; armL = -5 - f * 3; pulse = 1.5; coreK = 1.3; }
  if (anim === 'attack') { armR = [10, 6][f]; armL = [12, 7][f]; lean = [4, 2][f]; pulse = 2; coreK = 1.4; }
  if (anim === 'hurt') { lean = -3; armR = -3; armL = -3; }
  if (anim === 'death') { collapse = Math.min(1, f / 6); coreK = Math.max(0, 1 - f / 7); }
  const zk = 1 - collapse * 0.6;
  const zc = (z) => z * zk - crouch;
  const prims = [];
  // piernas pesadas
  for (const s of [1, -1]) {
    const st = anim === 'move' ? sin(ph + (s > 0 ? 0 : Math.PI)) * 6 : 0;
    prims.push(
      P.cap({ x0: -14, y0: s * 14, z0: zc(14), x1: -16 + st, y1: s * 21, z1: 3, r0: 7.5, r1: 6, ramp: flesh, group: 'leg' + s }),
      P.ell({ x: -14 + st, y: s * 22, z: 0, rx: 7, ry: 5.5, rz: 4, ramp: C.jailIron, group: 'foot' + s }),
    );
  }
  // cuerpo
  prims.push(P.ell({ x: -4 + lean, y: 0, z: zc(6), rx: 27 + collapse * 4, ry: 27 + collapse * 3, rz: 23 * zk, ramp: flesh, group: 'body' }));
  // placas orgánicas de protección (asimétricas)
  const plates = [
    [[-28, -6], [-14, -12], [-8, -2], [-18, 6], [-29, 4]],
    [[-26, 8], [-14, 4], [-6, 16], [-16, 22], [-24, 18]],
    [[-12, -22], [-2, -24], [4, -14], [-6, -8], [-14, -14]],
    [[-8, 10], [2, 6], [8, 18], [-2, 24]],
  ];
  plates.forEach((pts, i) => prims.push(P.plate({ pts: pts.map(([x, y]) => [x + lean, y]), z: zc(20 - i), h: 7, bevel: 2.4, ramp: C.jailIron, group: 'pl' + i, spec: true })));
  if (rage) for (const [x, y] of [[-20, -2], [-12, -16], [-14, 16], [-2, 18]]) prims.push(P.cap({ x0: x, y0: y, z0: zc(26), x1: x - 3, y1: y * 1.15, z1: zc(34), r0: 2, r1: 0.4, ramp: C.bone, group: 'sp' + x }));
  // marcas de contaminación
  for (const [x, y] of [[-6, -18], [-20, 12], [4, 20], [-24, -12]]) prims.push(P.ell({ x: x + lean, y, z: zc(22), rx: 1.6, emit: tox, emitIdx: collapse > 0.7 ? 0 : 2 }));
  // núcleo brillante dentro de la caja torácica
  const cr = (5.5 + pulse * 0.8) * coreK;
  if (cr > 0.5) prims.push(P.ell({ x: 9 + lean, y: 0, z: zc(24), rx: cr, rz: 3, emit: core }));
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    prims.push(P.cap({ x0: 3 + i * 4 + lean, y0: s * 3, z0: zc(27), x1: 7 + i * 4 + lean, y1: s * (9 - i), z1: zc(26), r0: 1.4, r1: 1, ramp: C.bone, group: 'rib' + s + i }));
  }
  // cabeza con máscara ósea
  prims.push(
    P.ell({ x: 23 + lean, y: 0, z: zc(14), rx: 9, ry: 10, rz: 9, ramp: flesh, bias: 1, group: 'head' }),
    P.plate({ pts: [[24, -8], [31, -5], [33, 0], [31, 5], [24, 8], [21, 0]].map(([x, y]) => [x + lean, y]), z: zc(20), h: 3, bevel: 1.4, ramp: C.bone, group: 'mask', spec: true }),
    P.box({ x: 30 + lean, y: -3, hx: 1.6, hy: 0.7, z: zc(23), h: 0.6, emit: C.eRed, emitIdx: collapse > 0.5 ? 0 : 3 }),
    P.box({ x: 30 + lean, y: 3, hx: 1.6, hy: 0.7, z: zc(23), h: 0.6, emit: C.eRed, emitIdx: collapse > 0.5 ? 0 : 3 }),
  );
  // brazo derecho masivo con antebrazo-escudo
  const sw = anim === 'move' ? sin(ph) * 4 : 0;
  const rx = 26 + armR + sw, ry = 28;
  prims.push(
    P.cap({ x0: 2, y0: 22, z0: zc(26), x1: rx, y1: ry, z1: zc(12), r0: 9, r1: 7.5, ramp: flesh, group: 'armR' }),
    P.plate({ pts: [[rx - 16, ry - 7], [rx + 2, ry - 8], [rx + 6, ry + 1], [rx - 2, ry + 9], [rx - 16, ry + 8]], z: zc(17), h: 5, bevel: 2, ramp: C.bone, group: 'shield', spec: true }),
    P.ell({ x: rx + 5, y: ry, z: zc(8), rx: 7, ry: 6, rz: 6, ramp: C.jailIron, group: 'fistR', spec: true }),
  );
  // brazo izquierdo largo con garfios
  const lx = 30 + armL - sw, ly = -32;
  prims.push(P.cap({ x0: 2, y0: -22, z0: zc(26), x1: lx, y1: ly, z1: zc(10), r0: 6, r1: 4.5, ramp: flesh, group: 'armL' }));
  for (const [o, k] of [[-3, 0], [0, 1], [3, 2]]) {
    prims.push(
      P.cap({ x0: lx, y0: ly + o, z0: zc(10), x1: lx + 8, y1: ly + o - 2, z1: zc(8), r0: 1.6, r1: 1.1, ramp: C.bone, group: 'hook' + k }),
      P.cap({ x0: lx + 8, y0: ly + o - 2, z0: zc(8), x1: lx + 9, y1: ly + o + 3, z1: zc(6), r0: 1.1, r1: 0.3, ramp: C.bone, group: 'hook' + k }),
    );
  }
  return prims;
}

function nucleo(anim, f, rage) {
  const energy = rage ? C.eMagenta : C.eCyan;
  const tip = rage ? C.eRed : C.eMagenta;
  const frag = rage ? C.rust : C.steel;
  let rot = 0, pulse = 0, ringR = 42, collapse = 0, flare = 0, tilt = 0, sc = 1;
  if (anim === 'idle') { rot = f * (TAU / 32); pulse = [0, 1, 2, 1][f]; }
  if (anim === 'move') { rot = f * (TAU / 24); pulse = 1; tilt = 2; }
  if (anim === 'windup') { ringR = 34 - f * 4; pulse = 2.5; flare = 1; rot = f * 0.15; }
  if (anim === 'attack') { ringR = [50, 46][f]; pulse = 3; flare = 2; rot = f * 0.2; }
  if (anim === 'hurt') { pulse = -1; ringR = 40; }
  if (anim === 'death') { collapse = f / 7; ringR = 42 + f * 4; pulse = 3 - f; }
  if (anim === 'phase') { sc = 1 - f * 0.24; rot = f * 0.5; pulse = 2; }
  const prims = [];
  // apéndices flotantes
  for (let i = 0; i < 4; i++) {
    const base = i * (TAU / 4) + TAU / 8 + rot * 0.5;
    let x = cos(base) * 12, y = sin(base) * 12, a = base, z = 12;
    for (let k = 0; k < 4; k++) {
      const na = a + sin(f * 1.3 + i + k) * 0.35;
      const len = 7 - k * 0.8;
      const nx = x + cos(na) * len * (1 - collapse * 0.5), ny = y + sin(na) * len * (1 - collapse * 0.5);
      prims.push(P.cap({ x0: x, y0: y, z0: z, x1: nx, y1: ny, z1: z - 1.5, r0: 3.4 - k * 0.7, r1: 2.8 - k * 0.7, ramp: C.void, group: 'ten' + i + k }));
      x = nx; y = ny; a = na; z -= 1.5;
    }
    prims.push(P.ell({ x, y, z: z + 1, rx: 1.6, emit: tip, emitIdx: collapse > 0.6 ? 0 : 3 }));
  }
  // cuerpo central luminoso
  const R = 15 + pulse * 0.7;
  prims.push(P.ell({ x: tilt, y: 0, z: 4, rx: R * (1 - collapse * 0.6), rz: 14, emit: energy }));
  // caparazón fragmentado
  for (let i = 0; i < 5; i++) {
    const a = i * (TAU / 5) + rot;
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const aa = a + (k / 4) * 0.95;
      pts.push([cos(aa) * (R + 2.5), sin(aa) * (R + 2.5)]);
    }
    for (let k = 4; k >= 0; k--) {
      const aa = a + (k / 4) * 0.95;
      pts.push([cos(aa) * (R - 5), sin(aa) * (R - 5)]);
    }
    prims.push(P.plate({ pts: pts.map(([x, y]) => [x * (1 + collapse * 0.8) + tilt, y * (1 + collapse * 0.8)]), z: 16 - collapse * 10, h: 4, bevel: 1.5, ramp: C.void, group: 'shell' + i, spec: true }));
  }
  prims.push(P.ell({ x: tilt, y: 0, z: 20, rx: (5 + flare) * (1 - collapse), rz: 2, emit: C.eWhite }));
  // núcleos secundarios
  for (let i = 0; i < 3; i++) {
    const a = -rot * 1.6 + i * (TAU / 3);
    prims.push(P.ell({ x: cos(a) * 27, y: sin(a) * 27, z: 18 - collapse * 14, rx: 3, emit: energy }));
  }
  // fragmentos giratorios
  for (let i = 0; i < 8; i++) {
    const a = rot * 2 + i * (TAU / 8);
    const cx = cos(a) * ringR, cy = sin(a) * ringR, pa = a + Math.PI / 2;
    const pts = [[-3.6, -1.6], [3.6, -2.2], [2.6, 2], [-2.6, 1.6]].map(([x, y]) => [cx + x * cos(pa) - y * sin(pa), cy + x * sin(pa) + y * cos(pa)]);
    prims.push(P.plate({ pts, z: 22 - collapse * 20, h: 2.4, bevel: 0.8, ramp: frag, group: 'fr' + i, spec: true }));
    prims.push(P.ell({ x: cos(a) * (ringR - 3), y: sin(a) * (ringR - 3), z: 25 - collapse * 20, rx: 0.8, emit: energy, emitIdx: 2 }));
  }
  return sc !== 1 ? xform(prims, { s: sc }) : prims;
}


/* ================= LA FORJA VIVIENTE ================= */
function forja(anim, f, rage) {
  const seam = rage ? C.eWhite : C.eOrange;
  const core = rage ? C.eWhite : C.eYellow;
  let ph = 0, pulse = 0, hamZ = 22, hamX = 24, crouch = 0, lean = 0, cool = 0;
  if (anim === 'idle') pulse = [0, 1, 2, 1][f];
  if (anim === 'move') { ph = (f / 4) * TAU; lean = 1; pulse = 1; }
  if (anim === 'windup') { hamZ = 34 + f * 6; hamX = 10 - f * 5; crouch = 2; pulse = 2; }
  if (anim === 'attack') { hamZ = [8, 6][f]; hamX = [32, 30][f]; lean = 3; pulse = 3; }
  if (anim === 'hurt') { lean = -3; }
  if (anim === 'death') cool = Math.min(1, f / 6);
  const zk = 1 - cool * 0.55;
  const zc = (z) => z * zk - crouch;
  const emitIdx = cool > 0.8 ? 0 : cool > 0.4 ? 1 : undefined;
  const prims = [];
  for (const s of [1, -1]) {
    const st = anim === 'move' ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 6 : 0;
    prims.push(
      P.cap({ x0: -10, y0: s * 15, z0: zc(16), x1: -12 + st, y1: s * 22, z1: 3, r0: 8, r1: 7, ramp: C.char, group: 'leg' + s }),
      P.box({ x: -11 + st, y: s * 23, hx: 7, hy: 5, z: 0, h: 5, bevel: 1.5, ramp: C.jailIron, group: 'foot' + s }),
    );
  }
  // torso de placas de hierro con vetas de magma
  prims.push(P.ell({ x: -2 + lean, y: 0, z: zc(8), rx: 25, ry: 26, rz: 22 * zk, ramp: C.char, group: 'body' }));
  const plates = [
    [[-22, -18], [-6, -22], [-2, -8], [-18, -4]], [[-22, 18], [-6, 22], [-2, 8], [-18, 4]],
    [[-26, -3], [-14, -3], [-14, 3], [-26, 3]], [[-4, -20], [10, -16], [12, -6], [0, -6]], [[-4, 20], [10, 16], [12, 6], [0, 6]],
  ];
  plates.forEach((pts, i) => prims.push(P.plate({ pts: pts.map(([x, y]) => [x + lean, y]), z: zc(24 - (i % 2)), h: 6, bevel: 2, ramp: C.jailIron, group: 'pl' + i, spec: true })));
  for (const [x0, y0, x1, y1] of [[-20, -10, -6, -14], [-20, 10, -6, 14], [-12, -2, -12, 2], [-2, -10, 6, -10], [-2, 10, 6, 10]]) {
    prims.push(P.cap({ x0: x0 + lean, y0, x1: x1 + lean, y1, z0: zc(30), z1: zc(30), r0: 0.9 + pulse * 0.15, r1: 0.8, emit: seam, emitIdx }));
  }
  // chimeneas dorsales
  for (const s of [1, -1]) {
    prims.push(P.cyl({ x: -16 + lean, y: s * 11, r: 4.5, z: zc(26), h: 8, bevel: 1.2, ramp: C.gunmetal, group: 'ch' + s }));
    prims.push(P.cyl({ x: -16 + lean, y: s * 11, r: 2.4, z: zc(34) + 0.2, h: 0.4, bevel: 0, emit: seam, emitIdx: cool > 0.6 ? 0 : 2 }));
  }
  // boca del horno en el pecho
  prims.push(
    P.box({ x: 12 + lean, y: 0, hx: 5, hy: 9, z: zc(16), h: 12, bevel: 2, ramp: C.jailIron, group: 'furnace' }),
    P.box({ x: 15 + lean, y: 0, hx: 2.5, hy: 6.5, z: zc(26), h: 2.5, bevel: 0, emit: core, emitIdx }),
    ...[-4, -1.3, 1.3, 4].map((y, i) => P.box({ x: 15.5 + lean, y, hx: 2.6, hy: 0.6, z: zc(28), h: 1, bevel: 0.3, ramp: C.gunmetal, group: 'grill' + i })),
    // cabeza-yelmo con rendija
    P.ell({ x: 22 + lean, y: 0, z: zc(16), rx: 7, ry: 8, rz: 7, ramp: C.jailIron, group: 'head', spec: true }),
    P.box({ x: 27 + lean, y: 0, hx: 1, hy: 4, z: zc(22), h: 0.6, emit: seam, emitIdx: cool > 0.5 ? 0 : 3 }),
  );
  // brazo derecho: martillo gigante
  const sw = anim === 'move' ? Math.sin(ph) * 3 : 0;
  const hx = hamX + sw, hy = 30;
  prims.push(
    P.cap({ x0: 2, y0: 22, z0: zc(28), x1: hx - 4, y1: hy - 2, z1: zc(hamZ), r0: 8, r1: 6.5, ramp: C.char, group: 'armR' }),
    P.cap({ x0: hx - 6, y0: hy, z0: zc(hamZ + 2), x1: hx + 8, y1: hy, z1: zc(hamZ + 2), r0: 2, ramp: C.gunmetal, group: 'haft' }),
    P.box({ x: hx + 9, y: hy, hx: 6, hy: 9, z: zc(hamZ - 4), h: 10, bevel: 2, ramp: C.jailIron, group: 'hammer', spec: true }),
    P.box({ x: hx + 9, y: hy, hx: 6.2, hy: 1, z: zc(hamZ + 6), h: 0.5, bevel: 0, emit: seam, emitIdx }),
  );
  // brazo izquierdo: crisol de metal fundido
  prims.push(
    P.cap({ x0: 2, y0: -22, z0: zc(28), x1: 22 - sw, y1: -30, z1: zc(16), r0: 7, r1: 5.5, ramp: C.char, group: 'armL' }),
    P.cyl({ x: 26 - sw, y: -31, r: 8, z: zc(10), h: 9, bevel: 2, ramp: C.jailIron, group: 'crucible' }),
    P.cyl({ x: 26 - sw, y: -31, r: 5.5, z: zc(19) + 0.2, h: 0.5, bevel: 0, emit: core, emitIdx }),
  );
  return prims;
}

/* ================= ARCONTE DEL VACÍO ================= */
function arconte(anim, f, rage) {
  const eye = rage ? C.eMagenta : C.eCyan;
  const shardRamp = rage ? C.rust : C.obsidian;
  let rot = 0, sway = 0, arms = 0, flare = 0, collapse = 0, sc = 1;
  if (anim === 'idle') { rot = f * (TAU / 24); sway = Math.sin((f / 4) * TAU) * 1.5; }
  if (anim === 'move') { rot = f * (TAU / 16); sway = Math.sin((f / 4) * TAU) * 3; }
  if (anim === 'windup') { arms = -4 - f * 3; flare = 1 + f; rot = f * 0.3; }
  if (anim === 'attack') { arms = [10, 6][f]; flare = 3; rot = f * 0.4; }
  if (anim === 'hurt') { arms = -3; sway = -3; }
  if (anim === 'death') { collapse = f / 7; rot = f * 0.5; }
  if (anim === 'phase') { sc = 1 - f * 0.22; rot = f * 0.6; flare = 2; }
  const z0 = 18;
  const prims = [];
  // túnica con jirones que flotan hacia atrás
  for (let i = 0; i < 5; i++) {
    const y = (i - 2) * 8, len = 26 + (i % 2) * 6;
    const w = Math.sin((i + f) * 1.7) * 2 + sway;
    prims.push(P.plate({ pts: [[-6, y - 4], [-6 - len * 0.6, y - 3 + w], [-6 - len, y + w], [-6 - len * 0.6, y + 3 + w], [-6, y + 4]], z: z0 - 8 - collapse * 8, h: 2, bevel: 1, ramp: C.void, group: 'rag' + i }));
  }
  prims.push(
    P.ell({ x: 0, y: 0, z: z0 - 10 - collapse * 10, rx: 16, ry: 20, rz: 16 * (1 - collapse * 0.6), ramp: C.obsidian, group: 'robe' }),
    // manto con placas
    P.plate({ pts: [[-6, -20], [8, -16], [12, 0], [8, 16], [-6, 20], [-2, 0]], z: z0 + 2 - collapse * 14, h: 3, bevel: 1.5, ramp: C.obsidian, bias: 1, group: 'mantle', spec: true }),
    // capucha y ojo único
    P.ell({ x: 12, y: 0, z: z0 + 4 - collapse * 14, rx: 8, ry: 8.5, rz: 7, ramp: C.obsidian, bias: 1, group: 'hood' }),
    P.ell({ x: 17, y: 0, z: z0 + 10 - collapse * 14, rx: 2.4 + flare * 0.4, ry: 3, rz: 1.5, emit: eye, emitIdx: collapse > 0.6 ? 0 : undefined }),
    // núcleo del pecho
    P.ell({ x: 2, y: 0, z: z0 + 6 - collapse * 12, rx: 3.5 + flare * 0.5, rz: 2, emit: C.eViolet, emitIdx: collapse > 0.7 ? 0 : undefined }),
  );
  // manos con orbes
  for (const s of [1, -1]) {
    const hx = 18 + arms, hy = s * (20 - (arms > 0 ? 6 : 0));
    prims.push(
      P.cap({ x0: 4, y0: s * 15, z0: z0 - collapse * 12, x1: hx, y1: hy, z1: z0 - 2 - collapse * 12, r0: 3.2, r1: 2.2, ramp: C.obsidian, group: 'arm' + s }),
      P.ell({ x: hx + 2, y: hy, z: z0 - 1 - collapse * 12, rx: 2.6 + flare * 0.3, emit: eye, emitIdx: collapse > 0.6 ? 0 : undefined }),
    );
  }
  // corona de fragmentos orbitales
  for (let i = 0; i < 6; i++) {
    const a = rot + i * (TAU / 6);
    const R = 30 + collapse * 18 + flare * 2;
    const cx = 10 + Math.cos(a) * R * 0.6, cy = Math.sin(a) * R;
    const pa = a + Math.PI / 2;
    const pts = [[-3, -1.4], [4, 0], [-3, 1.4]].map(([x, y]) => [cx + x * Math.cos(pa) - y * Math.sin(pa), cy + x * Math.sin(pa) + y * Math.cos(pa)]);
    prims.push(P.plate({ pts, z: z0 + 12 - collapse * 26, h: 2.4, bevel: 0.8, ramp: shardRamp, group: 'sh' + i, spec: true }));
    prims.push(P.ell({ x: cx, y: cy, z: z0 + 15 - collapse * 26, rx: 0.8, emit: eye, emitIdx: collapse > 0.5 ? 0 : 2 }));
  }
  return sc !== 1 ? xform(prims, { s: sc }) : prims;
}

const BOSS_MODELS = {
  herald: { fn: carcelero, size: 112, anims: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 8 }, fps: { idle: 5, move: 6, windup: 6, attack: 10, hurt: 1, death: 8 } },
  matriarch: { fn: nucleo, size: 112, anims: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 8, phase: 4 }, fps: { idle: 8, move: 8, windup: 6, attack: 10, hurt: 1, death: 8, phase: 10 } },
  forge: { fn: forja, size: 112, anims: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 8 }, fps: { idle: 5, move: 5, windup: 5, attack: 10, hurt: 1, death: 8 } },
  archon: { fn: arconte, size: 112, anims: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 8, phase: 4 }, fps: { idle: 6, move: 8, windup: 6, attack: 10, hurt: 1, death: 8, phase: 10 } },
};

module.exports = { BOSS_MODELS };
