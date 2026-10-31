'use strict';
/*
 * Tilesets y props del Complejo Hellfall (tiles de 32 × 32).
 * Zonas: hangar (metal), laboratorio, control, almacén contaminado (hormigón) y energía.
 */
const { Img, rng, mix, darken, lighten } = require('../lib/image');
const { P, render } = require('../lib/model');
const C = require('./palette');
const { drawText, textWidth } = require('./font');

const T = 32;

/* ---------------- utilidades de textura ---------------- */
function plateBase(im, base, seam, hi, lo, x = 0, y = 0, w = T, h = T) {
  im.rect(x, y, w, h, base);
  im.rect(x, y, w, 1, seam); im.rect(x, y, 1, h, seam);
  im.rect(x + 1, y + 1, w - 2, 1, hi); im.rect(x + 1, y + 1, 1, h - 2, hi);
  im.rect(x + 1, y + h - 1, w - 1, 1, lo); im.rect(x + w - 1, y + 1, 1, h - 1, lo);
}
function rivet(im, x, y, base) {
  im.set(x, y, lighten(base, 0.18)); im.set(x + 1, y, base); im.set(x, y + 1, base); im.set(x + 1, y + 1, darken(base, 0.4));
}
function scratches(im, r, n, color, x0 = 2, y0 = 2, w = 28, h = 28) {
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(r() * w), y = y0 + Math.floor(r() * h);
    const len = 2 + Math.floor(r() * 4), d = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < len; k++) im.set(x + k, y + k * d * (r() < 0.6 ? 1 : 0), color);
  }
}
function crack(im, r, x, y, len, color) {
  let cx = x, cy = y;
  for (let i = 0; i < len; i++) {
    im.set(cx, cy, color);
    cx += r() < 0.7 ? 1 : 0; cy += r() < 0.5 ? 1 : r() < 0.5 ? -1 : 0;
    if (r() < 0.12) { let bx = cx, by = cy; for (let k = 0; k < 3; k++) { by += 1; bx += r() < 0.5 ? 1 : 0; im.set(bx, by, color); } }
  }
}
function stain(im, r, cx, cy, R, color, alpha = 90) {
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d = r() * R * 0.6;
    im.disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.3 + r() * 0.4), color, alpha);
  }
}

/* ---------------- suelos ---------------- */
const FLOORS = {};
const metal = { base: '#20242b', seam: '#121419', hi: '#2b3039', lo: '#181b21' };
FLOORS.metal_a = (r) => { const im = new Img(T, T); plateBase(im, metal.base, metal.seam, metal.hi, metal.lo); [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(([x, y]) => rivet(im, x, y, '#2a2f38')); scratches(im, r, 2, '#262a32'); return im; };
FLOORS.metal_b = (r) => { const im = new Img(T, T); plateBase(im, metal.base, metal.seam, metal.hi, metal.lo, 0, 0, T, 16); plateBase(im, '#1e2229', metal.seam, metal.hi, metal.lo, 0, 16, T, 16); [[3, 3], [27, 3], [3, 19], [27, 19]].forEach(([x, y]) => rivet(im, x, y, '#2a2f38')); return im; };
FLOORS.metal_c = (r) => { const im = FLOORS.metal_a(r); scratches(im, r, 7, '#2c313a'); scratches(im, r, 3, '#181b20'); return im; };
FLOORS.metal_d = (r) => { const im = FLOORS.metal_a(r); stain(im, r, 10 + r() * 12, 10 + r() * 12, 9, '#0c0d10', 120); return im; };
FLOORS.tread = (r) => {
  const im = new Img(T, T); plateBase(im, '#23272f', metal.seam, metal.hi, metal.lo);
  for (let y = 3; y < 30; y += 4) for (let x = 3; x < 30; x += 4) {
    const o = ((x + y) / 4) % 2;
    if (o) { im.set(x, y, '#323844'); im.set(x + 1, y + 1, '#1a1d23'); } else { im.set(x + 1, y, '#323844'); im.set(x, y + 1, '#1a1d23'); }
  }
  return im;
};
const lab = { base: '#363c46', grout: '#22262d', hi: '#434a56', lo: '#2c313a' };
function labTiles(r, mod) {
  const im = new Img(T, T);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const b = mod && mod(i, j) ? mod(i, j) : lab.base;
    plateBase(im, b, lab.grout, lab.hi, lab.lo, i * 16, j * 16, 16, 16);
  }
  return im;
}
FLOORS.lab_a = (r) => labTiles(r);
FLOORS.lab_b = (r) => labTiles(r, (i, j) => (i === 1 && j === 0 ? '#323843' : null));
FLOORS.lab_crack = (r) => { const im = labTiles(r); crack(im, r, 3, 9 + r() * 10, 26, '#1e2228'); return im; };
FLOORS.lab_stain = (r) => { const im = labTiles(r); stain(im, r, 16, 16, 12, '#3a5a2a', 70); return im; };
FLOORS.control_a = (r) => {
  const im = new Img(T, T); plateBase(im, '#191d24', '#0e1014', '#222731', '#14171c');
  im.rect(15, 1, 2, 30, '#121419'); im.rect(15, 1, 1, 30, '#0c0d10');
  for (let y = 4; y < 30; y += 8) im.set(16, y, '#1a6a7a');
  return im;
};
FLOORS.control_b = (r) => { const im = new Img(T, T); plateBase(im, '#1b1f27', '#0e1014', '#242a34', '#14171c'); [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(([x, y]) => rivet(im, x, y, '#262b34')); return im; };
const conc = { base: '#29292b', light: '#323234', dark: '#212123' };
function concrete(r) {
  const im = new Img(T, T); im.rect(0, 0, T, T, conc.base);
  for (let y = 1; y < T; y += 4) for (let x = 1; x < T; x += 4) {
    const jx = x + Math.floor(r() * 3), jy = y + Math.floor(r() * 3);
    const k = r();
    if (k < 0.3) im.set(jx, jy, conc.light); else if (k < 0.55) im.set(jx, jy, conc.dark);
    if (k < 0.08) im.rect(jx, jy, 2, 1, conc.light);
  }
  im.rect(0, 0, T, 1, '#202022'); im.rect(0, 0, 1, T, '#202022');
  return im;
}
FLOORS.concrete_a = (r) => concrete(r);
FLOORS.concrete_crack = (r) => { const im = concrete(r); crack(im, r, 2, 6 + r() * 18, 28, '#18181a'); return im; };
FLOORS.concrete_stain = (r) => { const im = concrete(r); stain(im, r, 16, 16, 13, '#101012', 110); return im; };
FLOORS.concrete_patch = (r) => { const im = concrete(r); im.rect(6, 8, 14, 12, '#2f2f31'); im.rect(6, 8, 14, 1, '#38383a'); im.rect(6, 19, 14, 1, '#1e1e20'); return im; };
FLOORS.toxic = (r) => { const im = concrete(r); stain(im, r, 16, 16, 15, '#2a4a14', 120); stain(im, r, 16, 16, 8, '#3a6a1a', 100); return im; };
FLOORS.grate_a = (r) => {
  const im = new Img(T, T); im.rect(0, 0, T, T, '#0a0b0e');
  im.rect(2, 13, 28, 5, '#121418'); im.rect(2, 13, 28, 1, '#181b20');
  for (let y = 3; y < 30; y += 4) { im.rect(2, y, 28, 2, '#2c313a'); im.rect(2, y, 28, 1, '#3b424d'); }
  plateFrame(im, '#2a2f37', '#3a414c', '#15181d');
  return im;
};
FLOORS.grate_b = (r) => {
  const im = new Img(T, T); im.rect(0, 0, T, T, '#0a0b0e');
  im.rect(9, 2, 4, 28, '#14171c');
  for (let x = 3; x < 30; x += 4) { im.rect(x, 2, 2, 28, '#2c313a'); im.rect(x, 2, 1, 28, '#3b424d'); }
  plateFrame(im, '#2a2f37', '#3a414c', '#15181d');
  return im;
};
function plateFrame(im, c, hi, lo) {
  im.rect(0, 0, T, 2, c); im.rect(0, 0, 2, T, c); im.rect(0, T - 2, T, 2, lo); im.rect(T - 2, 0, 2, T, lo);
  im.rect(0, 0, T, 1, hi); im.rect(0, 0, 1, T, hi);
}
function cables(im, horiz) {
  const cols = [['#0e0f12', '#24272e'], ['#3a0e0a', '#6a1e14'], ['#0e0f12', '#24272e'], ['#3a300a', '#6a5a14']];
  cols.forEach(([d, l], i) => {
    const o = 11 + i * 3;
    for (let k = 0; k < T; k++) {
      const w = Math.round(Math.sin((k + i * 5) * 0.35) * 0.6);
      if (horiz) { im.set(k, o + w, d); im.set(k, o + w - 1, l); } else { im.set(o + w, k, d); im.set(o + w - 1, k, l); }
    }
  });
  return im;
}
FLOORS.cable_h = (r) => cables(FLOORS.metal_a(r), true);
FLOORS.cable_v = (r) => cables(FLOORS.metal_a(r), false);
FLOORS.hazard = (r) => {
  const im = new Img(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) im.set(x, y, Math.floor((x + y) / 6) % 2 ? '#7a6416' : '#17171a');
  for (let i = 0; i < 18; i++) im.set(Math.floor(r() * T), Math.floor(r() * T), '#5a4a12');
  return im;
};
FLOORS.track = (r) => { const im = FLOORS.metal_b(r); im.rect(0, 7, T, 2, '#0c0d10'); im.rect(0, 23, T, 2, '#0c0d10'); im.rect(0, 9, T, 1, '#2e333c'); im.rect(0, 25, T, 1, '#2e333c'); return im; };
FLOORS.damaged = (r) => {
  const im = FLOORS.metal_a(r);
  im.disc(17, 15, 7, '#08090b'); im.disc(15, 14, 5, '#050607');
  for (let i = 0; i < 4; i++) im.line(10 + i * 4, 9, 11 + i * 4, 21, '#5a3a24');
  im.ring(17, 15, 8, 1, '#3a2a1e');
  return im;
};

/* ---------------- paredes autoconectadas ---------------- */
const WALL_STYLES = {
  steel: { top: '#262b33', top2: '#2d333c', seam: '#1a1e24', rimN: '#4a5361', rimW: '#3c4450', rimE: '#15181d', face: ['#0f1115', '#16191e', '#1d2127'], detail: '#2a2f38', stripe: true },
  lab: { top: '#3a414c', top2: '#424a56', seam: '#2a3038', rimN: '#5c6674', rimW: '#4e5764', rimE: '#20242b', face: ['#1a1e24', '#252a32', '#2e343d'], detail: '#3e7aa0', stripe: false },
  concrete: { top: '#2c2c2e', top2: '#333335', seam: '#1e1e20', rimN: '#48484b', rimW: '#3c3c3f', rimE: '#18181a', face: ['#121213', '#19191a', '#202021'], detail: '#2a2a2c', stripe: true },
};
/** mask: 1=N abierto, 2=E, 4=S, 8=W (abierto = suelo vecino). */
function wallTile(styleName, mask, variant, r) {
  const s = WALL_STYLES[styleName];
  const im = new Img(T, T);
  im.rect(0, 0, T, T, s.top);
  // patrón superior por estilo
  const pat = s.pattern || styleName;
  if (pat === 'steel') {
    im.rect(0, 15, T, 1, s.seam); im.rect(15, 0, 1, 15, s.seam); im.rect(7 + variant * 10, 16, 1, 16, s.seam);
    [[4, 4], [26, 4], [4, 20], [26, 26]].forEach(([x, y]) => rivet(im, x, y, s.top2));
    if (variant) im.rect(4, 8, 8, 3, s.top2);
  } else if (pat === 'lab') {
    for (let x = 3; x < T; x += 6) im.rect(x, 0, 1, T, s.top2);
    im.rect(0, 15, T, 1, s.seam);
  } else {
    for (let y = 0; y < T; y += 8) { im.rect(0, y, T, 1, s.seam); const off = (y / 8) % 2 ? 8 : 0; for (let x = off; x < T; x += 16) im.rect(x, y, 1, 8, s.seam); }
    for (let i = 0; i < 10; i++) im.set(Math.floor(r() * T), Math.floor(r() * T), s.top2);
  }
  // bordes iluminados (luz desde arriba-izquierda)
  if (mask & 1) { im.rect(0, 0, T, 2, s.rimN); im.rect(0, 2, T, 1, s.top2); }
  if (mask & 8) { im.rect(0, 0, 2, T, s.rimW); }
  if (mask & 2) { im.rect(T - 2, 0, 2, T, s.rimE); }
  // cara frontal (cuando hay suelo debajo)
  if (mask & 4) {
    const fh = 12, fy = T - fh;
    im.rect(0, fy - 1, T, 1, s.rimN);
    im.rect(0, fy, T, 4, s.face[2]); im.rect(0, fy + 4, T, 4, s.face[1]); im.rect(0, fy + 8, T, 4, s.face[0]);
    if (pat === 'lab') { im.rect(0, fy + 3, T, 2, s.detail); im.rect(0, fy + 3, T, 1, lighten(s.detail, 0.25)); }
    if (variant === 0) { [6, 22].forEach((x) => { im.rect(x, fy + 2, 1, 8, s.face[0]); im.set(x + 2, fy + 2, s.detail); im.set(x + 2, fy + 8, s.detail); }); }
    else if (s.stripe) { for (let x = 0; x < T; x++) im.rect(x, T - 3, 1, 2, Math.floor((x + 2) / 4) % 2 ? '#7a6416' : '#141416'); }
    else { im.rect(9, fy + 2, 14, 6, '#121418'); for (let x = 10; x < 23; x += 2) im.rect(x, fy + 3, 1, 4, '#262b33'); }
    if (mask & 8) im.rect(0, fy, 1, fh, s.rimW);
    if (mask & 2) im.rect(T - 1, fy, 1, fh, s.rimE);
  }
  // esquinas interiores
  if ((mask & 1) && (mask & 8)) im.set(0, 0, lighten(s.rimN, 0.2));
  return im;
}

/* ---------------- props (modelados con volumen) ---------------- */
const RUSTY = ['#1a0c06', '#33170a', '#4e240e', '#6e3414', '#8e4a1e', '#b0662e'];
function container(hx, hy, ramp, angle, w, h, label) {
  const ribs = [];
  const n = Math.round(hx / 6);
  for (let i = 0; i < n; i++) ribs.push(P.box({ x: -hx + 3 + i * ((hx * 2 - 6) / Math.max(1, n - 1)), y: 0, hx: 1, hy: hy + 0.2, z: 0, h: 15.6, bevel: 0.5, ramp, bias: -1, group: 'rib' + i }));
  const im = render([
    P.box({ x: 0, y: 0, hx, hy, z: 0, h: 15, bevel: 2, ramp, group: 'b' }),
    ...ribs,
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => P.box({ x: sx * (hx - 2), y: sy * (hy - 2), hx: 2.2, hy: 2.2, z: 0, h: 16, bevel: 0.6, ramp: C.gunmetal, group: 'c' + i })),
  ], { w, h, angle });
  if (label) {
    const tw = textWidth(label);
    const bx = Math.floor((w - tw) / 2), by = Math.floor(h / 2 - 4);
    im.rect(bx - 2, by - 2, tw + 4, 11, '#a8821a');
    drawText(im, label, bx, by, '#1a1408');
  }
  return im;
}
const PROPS = {
  container_2x2: () => container(29, 28, C.military, 0, 64, 64, 'HF-7'),
  container_2x1: () => container(29.5, 13, RUSTY, 0, 64, 32, ''),
  container_1x2: () => container(29.5, 13, C.armor, Math.PI / 2, 32, 64, ''),
  crate: () => render([
    P.box({ x: 0, y: 0, hx: 14, hy: 13.5, z: 0, h: 12, bevel: 1.6, ramp: C.gunmetal, group: 'b' }),
    P.box({ x: 0, y: 0, hx: 15.5, hy: 1.4, z: 0, h: 12.6, yaw: 0.76, ramp: C.steel, group: 'x1', bevel: 0.5 }),
    P.box({ x: 0, y: 0, hx: 15.5, hy: 1.4, z: 0, h: 12.6, yaw: -0.76, ramp: C.steel, group: 'x2', bevel: 0.5 }),
    P.box({ x: -8, y: 9, hx: 4, hy: 1.4, z: 12.5, h: 0.3, ramp: C.yellow, bevel: 0 }),
  ], { w: 32, h: 32 }),
  pillar: () => {
    const im = render([
      P.box({ x: 0, y: 0, hx: 30, hy: 30, z: 0, h: 40, bevel: 3, ramp: C.steel, group: 'b' }),
      P.box({ x: 0, y: 0, hx: 22, hy: 22, z: 40, h: 2, bevel: 1.5, ramp: C.steel, bias: -1, group: 'i' }),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => P.cyl({ x: sx * 25, y: sy * 25, r: 1.6, z: 40, h: 1.4, bevel: 0.5, ramp: C.gunmetal, group: 'bolt' + i })),
    ], { w: 64, h: 64 });
    for (let i = 0; i < 64; i++) for (const [x, y] of [[i, 5], [i, 58], [5, i], [58, i]]) if (x >= 5 && x <= 58 && y >= 5 && y <= 58) im.set(x, y, Math.floor(i / 4) % 2 ? '#a8821a' : '#16161a');
    return im;
  },
  console_s: () => consoleProp(0), console_n: () => consoleProp(Math.PI), console_e: () => consoleProp(-Math.PI / 2), console_w: () => consoleProp(Math.PI / 2),
  generator_0: () => generator(2), generator_1: () => generator(3),
  terminal_0: () => terminal(1), terminal_1: () => terminal(3),
  spawn_vent: () => {
    const im = render([
      P.box({ x: 0, y: 0, hx: 19, hy: 19, z: 0, h: 2, bevel: 1, ramp: C.gunmetal, group: 'f' }),
      P.box({ x: 0, y: 0, hx: 15, hy: 15, z: 0, h: 2.2, bevel: 0, emit: C.eRed, emitIdx: 0, group: 'in' }),
      ...[-12, -6, 0, 6, 12].map((y, i) => P.box({ x: 0, y, hx: 15, hy: 1.2, z: 1, h: 2, bevel: 0.6, ramp: C.carbon, group: 'bar' + i })),
    ], { w: 40, h: 40 });
    return im;
  },
  pipe_h: () => render([
    P.cap({ x0: -17, y0: 0, x1: 17, y1: 0, z0: 4, r0: 4.6, ramp: C.steel, group: 'p', spec: true }),
    P.cap({ x0: -2, y0: 0, x1: 2, y1: 0, z0: 4, r0: 5.4, ramp: C.gunmetal, group: 'band' }),
  ], { w: 32, h: 14, outline: false }),
  pipe_v: () => render([
    P.cap({ x0: -17, y0: 0, x1: 17, y1: 0, z0: 4, r0: 4.6, ramp: C.steel, group: 'p', spec: true }),
    P.cap({ x0: -2, y0: 0, x1: 2, y1: 0, z0: 4, r0: 5.4, ramp: C.gunmetal, group: 'band' }),
  ], { w: 14, h: 32, angle: Math.PI / 2, outline: false }),
  valve: () => render([
    P.cyl({ x: 0, y: 0, r: 6, z: 4, h: 3, bevel: 1, ramp: C.gunmetal, group: 'f' }),
    P.cyl({ x: 0, y: 0, r: 4.6, z: 7, h: 1, bevel: 0.6, ramp: ['#3a0806', '#6a0e0a', '#a01a10', '#d03a1c', '#f0683a'], group: 'w' }),
    P.cyl({ x: 0, y: 0, r: 1.4, z: 8, h: 1, bevel: 0.4, ramp: C.steel, group: 'c' }),
  ], { w: 16, h: 16 }),
  door_h: () => doorPost(0), door_v: () => doorPost(Math.PI / 2),
  debris_a: () => render([
    P.box({ x: -4, y: 2, hx: 5, hy: 2, z: 0, h: 1.5, yaw: 0.4, ramp: C.gunmetal, group: 'a' }),
    P.box({ x: 4, y: -3, hx: 3, hy: 2.4, z: 0, h: 1.2, yaw: -0.7, ramp: C.steel, group: 'b' }),
    P.cap({ x0: -6, y0: -5, x1: 2, y1: -1, z0: 1, r0: 0.8, ramp: C.rust, group: 'c' }),
    P.box({ x: 6, y: 5, hx: 2, hy: 1.4, z: 0, h: 1, yaw: 1.2, ramp: C.hazard, bias: -1, group: 'd' }),
  ], { w: 24, h: 20 }),
  debris_b: () => render([
    P.box({ x: 0, y: 0, hx: 7, hy: 3, z: 0, h: 1.5, yaw: -0.3, ramp: C.plates, group: 'a' }),
    P.cap({ x0: -8, y0: 4, x1: 7, y1: 6, z0: 1, r0: 0.9, ramp: C.carbon, group: 'b' }),
    P.cap({ x0: -5, y0: -6, x1: 4, y1: -4, z0: 0.8, r0: 0.6, ramp: ['#3a0e0a', '#6a1e14', '#8a2a1a'], group: 'c' }),
  ], { w: 24, h: 20 }),
  remains: () => render([
    P.ell({ x: 4, y: 1, z: 0, rx: 4, ry: 3.6, rz: 2.4, ramp: C.helmet, group: 'helm', spec: true }),
    P.box({ x: 6.6, y: 1, hx: 0.8, hy: 2.4, z: 1.6, h: 0.6, ramp: C.gunmetal, group: 'v' }),
    P.cap({ x0: -8, y0: -2, x1: -1, y1: -1, z0: 0.8, r0: 1, ramp: C.bone, group: 'b1' }),
    P.cap({ x0: -6, y0: 3, x1: 0, y1: 4.5, z0: 0.8, r0: 0.9, ramp: C.bone, group: 'b2' }),
    P.plate({ pts: [[-4, -6], [2, -6], [3, -3], [-3, -2]], z: 0, h: 1.2, bevel: 0.5, ramp: C.armor, bias: -1, group: 'p' }),
  ], { w: 24, h: 20 }),
  beacon_0: () => beacon(0), beacon_1: () => beacon(1), beacon_2: () => beacon(2), beacon_3: () => beacon(3),
  sign_warn: () => {
    const im = new Img(12, 11);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) if (Math.abs(x + 0.5 - 6) <= (y + 1) * 0.6) im.set(x, y, '#d8b02a');
    im.rect(5, 3, 2, 4, '#141416'); im.rect(5, 8, 2, 1, '#141416');
    return im.outline('#0a0806');
  },
  sign_bio: () => {
    const im = new Img(12, 12); im.rect(0, 0, 12, 12, '#1a2a12'); im.rect(1, 1, 10, 10, '#2e5a14');
    im.ring(6, 6, 4, 1.4, '#9ae02a'); im.disc(6, 6, 1.2, '#9ae02a');
    return im.outline('#06080a');
  },
  wall_screen: () => { const im = new Img(16, 10); im.rect(0, 0, 16, 10, '#2a2f38'); im.rect(1, 1, 14, 8, '#06120e'); im.rect(1, 1, 14, 1, '#3a414c'); return im; },
  stencil_s7: () => { const t = 'SECTOR 7'; const im = new Img(textWidth(t, 2) + 4, 18); drawText(im, t, 2, 2, '#a8821a', 2); return fade(im, 120); },
  stencil_lab: () => { const t = 'LAB-B'; const im = new Img(textWidth(t, 2) + 4, 18); drawText(im, t, 2, 2, '#6a8aa0', 2); return fade(im, 110); },
  stencil_ctrl: () => { const t = 'CONTROL'; const im = new Img(textWidth(t, 2) + 4, 18); drawText(im, t, 2, 2, '#3a9aa8', 2); return fade(im, 110); },
  stencil_bio: () => { const t = 'PELIGRO BIO'; const im = new Img(textWidth(t) + 4, 11); drawText(im, t, 2, 2, '#8ac02a'); return fade(im, 130); },
  stencil_pwr: () => { const t = 'ENERGIA'; const im = new Img(textWidth(t, 2) + 4, 18); drawText(im, t, 2, 2, '#c08a1a', 2); return fade(im, 120); },
  stencil_arrow: () => {
    const im = new Img(24, 14);
    im.rect(1, 5, 14, 4, '#a8821a');
    for (let i = 0; i < 7; i++) im.rect(14 + i, i, 1, 14 - i * 2, '#a8821a');
    return fade(im, 110);
  },
};
function fade(im, a) {
  // pintura desgastada: alfa reducido y huecos regulares
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const i = (y * im.w + x) * 4;
    if (!im.data[i + 3]) continue;
    im.data[i + 3] = ((x * 7 + y * 13) % 11 === 0) ? 0 : a;
  }
  return im;
}
function consoleProp(angle) {
  return render([
    P.box({ x: 0, y: 0, hx: 13, hy: 14, z: 0, h: 10, bevel: 1.4, ramp: C.gunmetal, group: 'desk' }),
    P.box({ x: -4, y: 0, hx: 4, hy: 12, z: 10, h: 6, bevel: 1, tilt: [0.5, 0], ramp: C.carbon, group: 'scr' }),
    P.box({ x: -3.6, y: 0, hx: 2.6, hy: 10.5, z: 12, h: 4.4, bevel: 0, emit: ['#05140e', '#0a2a1e', '#12503a', '#1aff9a'], emitIdx: 1 }),
    ...[-8, -3, 2, 7].map((y, i) => P.box({ x: 7, y, hx: 2.4, hy: 1.8, z: 10, h: 1, bevel: 0.4, ramp: C.steel, group: 'k' + i })),
    P.ell({ x: 7, y: 11, z: 10.6, rx: 0.8, emit: C.eRed, emitIdx: 2 }),
  ], { w: 32, h: 32, angle: angle + Math.PI });
}
function generator(k) {
  return render([
    P.box({ x: 0, y: 0, hx: 30, hy: 28, z: 0, h: 10, bevel: 2, ramp: C.military, group: 'b' }),
    P.box({ x: 0, y: -24, hx: 30, hy: 2, z: 10, h: 0.5, ramp: C.yellow, bevel: 0 }),
    P.box({ x: 0, y: 24, hx: 30, hy: 2, z: 10, h: 0.5, ramp: C.yellow, bevel: 0 }),
    P.cyl({ x: -14, y: 0, r: 9, z: 10, h: 10, bevel: 2, ramp: C.copper, group: 'c1' }),
    P.cyl({ x: 14, y: 0, r: 9, z: 10, h: 10, bevel: 2, ramp: C.copper, group: 'c2' }),
    P.cyl({ x: -14, y: 0, r: 3.4, z: 20, h: 1, bevel: 0, emit: C.eYellow, emitIdx: k }),
    P.cyl({ x: 14, y: 0, r: 3.4, z: 20, h: 1, bevel: 0, emit: C.eYellow, emitIdx: k }),
    P.box({ x: 0, y: 0, hx: 3, hy: 10, z: 10, h: 4, bevel: 0.8, ramp: C.gunmetal, group: 'bus' }),
    P.box({ x: 0, y: 0, hx: 1, hy: 8, z: 14, h: 0.6, emit: C.eYellow, emitIdx: k - 1 }),
  ], { w: 64, h: 64 });
}
function terminal(k) {
  return render([
    P.box({ x: 0, y: 0, hx: 28, hy: 28, z: 0, h: 6, bevel: 2, ramp: C.steel, group: 'base' }),
    P.box({ x: 0, y: 0, hx: 28.4, hy: 1.6, z: 6, h: 0.4, ramp: C.yellow, bevel: 0 }),
    P.box({ x: 0, y: 0, hx: 1.6, hy: 28.4, z: 6, h: 0.4, ramp: C.yellow, bevel: 0 }),
    P.cyl({ x: 0, y: 0, r: 12, z: 6, h: 12, bevel: 2, ramp: C.gunmetal, group: 'ped' }),
    P.box({ x: -2, y: 0, hx: 9, hy: 13, z: 18, h: 3, bevel: 1, tilt: [0.35, 0], ramp: C.carbon, group: 'frame' }),
    P.box({ x: -2, y: 0, hx: 7.4, hy: 11.4, z: 20, h: 1.6, bevel: 0, emit: ['#063a24', '#0c6a40', '#1ab070', '#7affc8'], emitIdx: k }),
    ...[[-22, -22], [22, -22], [-22, 22], [22, 22]].map(([x, y]) => P.ell({ x, y, z: 6, rx: 1.4, emit: C.eGreen, emitIdx: k })),
  ], { w: 64, h: 64 });
}
function doorPost(angle) {
  const im = render([
    P.box({ x: 0, y: 0, hx: 15, hy: 14, z: 0, h: 22, bevel: 2, ramp: C.steel, group: 'h' }),
    P.box({ x: 0, y: 10, hx: 15.2, hy: 3, z: 0, h: 22.4, bevel: 0.6, ramp: C.gunmetal, group: 's' }),
    P.ell({ x: -9, y: -8, z: 22, rx: 1.4, emit: C.eGreen, emitIdx: 2 }),
  ], { w: 32, h: 32, angle });
  return im;
}
function beacon(f) {
  const im = render([
    P.cyl({ x: 0, y: 0, r: 5, z: 0, h: 3, bevel: 1, ramp: C.gunmetal, group: 'b' }),
    P.ell({ x: 0, y: 0, z: 3, rx: 3.6, rz: 3, emit: C.eRed, emitIdx: 1 }),
  ], { w: 14, h: 14 });
  const a = f * Math.PI / 2;
  for (let k = 1; k < 4; k++) im.set(7 + Math.round(Math.cos(a) * k), 7 + Math.round(Math.sin(a) * k), '#ffd0b0');
  return im;
}


/* ================= Sectores nuevos: Fundición, Criogenia y La Brecha ================= */
// --- Fundición
const iron = { base: '#231b17', seam: '#100b09', hi: '#33281f', lo: '#18120f' };
FLOORS.foundry_a = (r) => {
  const im = new Img(T, T); plateBase(im, iron.base, iron.seam, iron.hi, iron.lo);
  [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(([x, y]) => rivet(im, x, y, '#3a2e24'));
  stain(im, r, 8 + r() * 16, 8 + r() * 16, 6, '#4a2410', 70);
  scratches(im, r, 3, '#2c221b');
  return im;
};
FLOORS.foundry_b = (r) => {
  const im = new Img(T, T); plateBase(im, '#211a16', iron.seam, iron.hi, iron.lo);
  for (let k = 0; k < T; k++) { im.set(k, k, '#2e241c'); im.set(k, T - 1 - k, '#2e241c'); }
  im.disc(16, 16, 3, '#2c221a'); rivet(im, 15, 15, '#3a2e24');
  return im;
};
FLOORS.foundry_c = (r) => {
  const im = FLOORS.foundry_a(r);
  crack(im, r, 2, 8 + r() * 16, 28, '#c0520e');
  crack(im, r, 10, 2, 14, '#ff8a1e');
  return im;
};
FLOORS.foundry_grill = (r) => {
  const im = new Img(T, T); im.rect(0, 0, T, T, '#1a0804');
  for (let i = 0; i < 6; i++) im.disc(4 + r() * 24, 4 + r() * 24, 2 + r() * 3, r() < 0.5 ? '#7a2a08' : '#c0520e');
  for (let y = 3; y < 30; y += 4) { im.rect(2, y, 28, 2, '#2e2620'); im.rect(2, y, 28, 1, '#40362c'); }
  plateFrame(im, '#2a221c', '#3a3028', '#140e0a');
  return im;
};
// --- Criogenia
const frost = { base: '#344452', seam: '#1c2731', hi: '#46596a', lo: '#2a3844' };
FLOORS.cryo_a = (r) => {
  const im = new Img(T, T); plateBase(im, frost.base, frost.seam, frost.hi, frost.lo);
  im.rect(3, 15, 26, 2, '#2a3a48'); im.rect(3, 15, 26, 1, '#5a8ab0');
  for (let i = 0; i < 2; i++) im.set(2 + Math.floor(r() * 28), 2 + Math.floor(r() * 28), '#8ab0c8');
  return im;
};
FLOORS.cryo_b = (r) => {
  const im = new Img(T, T);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) plateBase(im, (i + j) % 2 ? '#30404e' : '#38495a', frost.seam, frost.hi, frost.lo, i * 16, j * 16, 16, 16);
  im.set(15, 15, '#7fd8ff'); im.set(16, 16, '#7fd8ff');
  return im;
};
FLOORS.cryo_c = (r) => {
  const im = FLOORS.cryo_a(r);
  stain(im, r, 16, 16, 9, '#4a6e88', 60);
  crack(im, r, 3, 6 + r() * 18, 24, '#8ab8d8');
  return im;
};
FLOORS.cryo_grate = (r) => {
  const im = new Img(T, T); im.rect(0, 0, T, T, '#0a1620');
  im.rect(2, 12, 28, 6, '#123048');
  for (let y = 3; y < 30; y += 4) { im.rect(2, y, 28, 2, '#3a4e60'); im.rect(2, y, 28, 1, '#5a7088'); }
  plateFrame(im, '#30404e', '#4a5e70', '#18222c');
  return im;
};
// --- La Brecha
const obs = { base: '#16121f', seam: '#09070e', hi: '#221c30', lo: '#100c17' };
FLOORS.rift_a = (r) => {
  const im = new Img(T, T);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) plateBase(im, obs.base, obs.seam, obs.hi, obs.lo, i * 16, j * 16, 16, 16);
  if (r() < 0.6) { im.rect(15, 0, 2, T, '#2a1048'); im.rect(15, 4 + Math.floor(r() * 20), 2, 3, '#7a30c0'); }
  return im;
};
FLOORS.rift_b = (r) => {
  const im = FLOORS.rift_a(r);
  for (let i = 0; i < 3; i++) {
    const x = 4 + r() * 24, y = 4 + r() * 24;
    im.line(x, y + 3, x + 1, y - 3, '#a050e0'); im.set(x, y - 1, '#e0a0ff'); im.line(x - 2, y + 2, x - 1, y - 1, '#5a1e8a');
  }
  return im;
};
FLOORS.rift_c = (r) => {
  const im = new Img(T, T); im.rect(0, 0, T, T, '#0c0814');
  crack(im, r, 1, 10 + r() * 12, 30, '#7a2aa8');
  crack(im, r, 8, 2, 12, '#5a1e8a');
  for (let i = 0; i < 8; i++) im.set(Math.floor(r() * T), Math.floor(r() * T), '#3a1a5a');
  return im;
};

WALL_STYLES.foundry = { pattern: 'steel', top: '#2a201a', top2: '#352920', seam: '#160f0b', rimN: '#5a4232', rimW: '#4a3628', rimE: '#140d09', face: ['#110a07', '#1a110c', '#231710'], detail: '#ff7a1e', stripe: true };
WALL_STYLES.cryo = { pattern: 'lab', top: '#3c4c5a', top2: '#485a6a', seam: '#24323e', rimN: '#7a98b0', rimW: '#5e7a90', rimE: '#1c2731', face: ['#16222c', '#1e2c38', '#283846'], detail: '#7fd8ff', stripe: false };
WALL_STYLES.rift = { pattern: 'concrete', top: '#3a2e52', top2: '#46385f', seam: '#1e1630', rimN: '#8a70b8', rimW: '#6a56a0', rimE: '#140e20', face: ['#0c0814', '#18102a', '#24183a'], detail: '#a050e0', stripe: false };

// --- props de los nuevos sectores
const MOLTEN = ['#5a1a04', '#a03a08', '#ff7a1e', '#ffe07a'];
const SPEC_BODY = ['#1a2a34', '#2a4250', '#3e5e70', '#5a8094'];
const GLASS = ['#16303e', '#24506a', '#3a7896', '#6aa8c8', '#a8d8f0', '#e8f8ff'];
const CRYSTAL = ['#1a0a30', '#36125a', '#5a1e8a', '#8a40c8', '#c080ff', '#f0d8ff'];
PROPS.piston = () => render([
  P.box({ x: 0, y: 0, hx: 30, hy: 30, z: 0, h: 18, bevel: 3, ramp: C.jailIron, group: 'base' }),
  P.cyl({ x: 0, y: 0, r: 18, z: 18, h: 10, bevel: 2, ramp: C.gunmetal, group: 'ram' }),
  P.cyl({ x: 0, y: 0, r: 10, z: 28, h: 4, bevel: 1.5, ramp: C.steel, group: 'cap' }),
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => P.cyl({ x: sx * 24, y: sy * 24, r: 3, z: 18, h: 2, bevel: 0.8, ramp: C.hazard, group: 'b' + i })),
], { w: 64, h: 64 });
PROPS.crucible = () => render([
  P.cyl({ x: 0, y: 0, r: 29, z: 0, h: 16, bevel: 3, ramp: C.char, group: 'pot' }),
  P.cyl({ x: 0, y: 0, r: 22, z: 16, h: 0.6, bevel: 0, emit: MOLTEN }),
  P.box({ x: 0, y: -29, hx: 6, hy: 3, z: 6, h: 8, bevel: 1, ramp: C.jailIron, group: 'lip' }),
], { w: 64, h: 64 });
PROPS.cryo_column = () => render([
  P.box({ x: 0, y: 0, hx: 30, hy: 30, z: 0, h: 34, bevel: 3, ramp: C.white, group: 'c' }),
  P.box({ x: 0, y: 0, hx: 20, hy: 20, z: 34, h: 2, bevel: 1.5, ramp: C.armor, group: 'top' }),
  P.cyl({ x: 0, y: 0, r: 7, z: 36, h: 1, bevel: 0, emit: C.eCyan, emitIdx: 2 }),
], { w: 64, h: 64 });
PROPS.cryo_pod = () => {
  const im = render([
    P.box({ x: 0, y: 0, hx: 30, hy: 26, z: 0, h: 8, bevel: 2, ramp: C.steel, group: 'base' }),
    P.ell({ x: 0, y: 0, z: 6, rx: 25, ry: 19, rz: 10, ramp: GLASS, group: 'glass', spec: true }),
    P.ell({ x: -2, y: 0, z: 9, rx: 13, ry: 6, rz: 4, ramp: SPEC_BODY, group: 'body' }),
    P.ell({ x: 12, y: 0, z: 10, rx: 4, ry: 4, rz: 3, ramp: SPEC_BODY, group: 'head' }),
    ...[-26, 26].map((x, i) => P.box({ x, y: 0, hx: 2, hy: 20, z: 6, h: 8, bevel: 0.8, ramp: C.gunmetal, group: 'clamp' + i })),
    P.ell({ x: 24, y: 18, z: 9, rx: 1.2, emit: C.eCyan, emitIdx: 3 }),
  ], { w: 64, h: 64 });
  return im;
};
PROPS.crystal = () => render([
  P.ell({ x: 0, y: 0, z: 0, rx: 26, ry: 24, rz: 6, ramp: C.void, group: 'base' }),
  P.plate({ pts: [[-4, -20], [6, -14], [4, 4], [-8, 2]], z: 6, h: 26, bevel: 3, ramp: CRYSTAL, group: 'c1', spec: true }),
  P.plate({ pts: [[-22, -2], [-10, -8], [-6, 10], [-18, 14]], z: 4, h: 18, bevel: 3, ramp: CRYSTAL, group: 'c2', spec: true }),
  P.plate({ pts: [[8, 4], [22, -4], [24, 12], [12, 20]], z: 4, h: 20, bevel: 3, ramp: CRYSTAL, group: 'c3', spec: true }),
  P.ell({ x: 0, y: 2, z: 20, rx: 3, emit: C.eMagenta, emitIdx: 2 }),
], { w: 64, h: 64 });
const stencilText = (t, col, sc = 2) => () => { const im = new Img(textWidth(t, sc) + 4, sc * 7 + 4); drawText(im, t, 2, 2, col, sc); return fade(im, 115); };
PROPS.stencil_s9 = stencilText('SECTOR 9', '#c06a1a');
PROPS.stencil_hot = stencilText('CALOR EXTREMO', '#ff8a2a', 1);
PROPS.stencil_s12 = stencilText('SECTOR 12', '#6aa8c8');
PROPS.stencil_cold = stencilText('CRIOGENIA', '#8ad8f0', 1);
PROPS.stencil_s0 = stencilText('SECTOR 0', '#a050e0');

module.exports = { FLOORS, WALL_STYLES, wallTile, PROPS, T };
