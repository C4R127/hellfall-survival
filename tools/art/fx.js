'use strict';
/* Proyectiles, efectos de combate, manchas, sombras y objetos recogibles. */
const { Img, hex, rng } = require('../lib/image');
const { P, render } = require('../lib/model');
const C = require('./palette');

const TAU = Math.PI * 2;

/** Rasteriza una plantilla direccional: fn(u, v, frame) → color|null; u hacia delante. */
function directional(size, angle, frame, fn, ox = size / 2, oy = size / 2) {
  const im = new Img(size, size);
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    const col = fn(u, v, frame);
    if (col) im.set(x, y, col);
  }
  return im;
}

/* ===================== PROYECTILES ===================== */
const PROJ = {
  bullet: { dirs: 16, frames: 1, size: 12, fn: (a) => directional(12, a, 0, (u, v) => {
    if (Math.abs(v) > 0.6) return null;
    if (u > 1.5 && u <= 3.5) return '#fffbe8';
    if (u > -0.5 && u <= 1.5) return '#ffd870';
    if (u > -3.5 && u <= -0.5) return '#c87a24';
    return null;
  }) },
  bulletCrit: { dirs: 16, frames: 1, size: 12, fn: (a) => directional(12, a, 0, (u, v) => {
    if (Math.abs(v) > (u > 1 ? 1.1 : 0.6)) return null;
    if (u > 1.5 && u <= 4) return '#fff0e0';
    if (u > -0.5 && u <= 1.5) return '#ff7a3a';
    if (u > -4 && u <= -0.5) return '#b8281a';
    return null;
  }) },
  pellet: { dirs: 16, frames: 1, size: 8, fn: (a) => directional(8, a, 0, (u, v) => {
    if (Math.abs(v) > 0.7) return null;
    if (u > 0.5 && u <= 2) return '#fff0c8';
    if (u > -2 && u <= 0.5) return '#e89a3a';
    return null;
  }) },
  plasma: { dirs: 1, frames: 4, size: 14, fn: (a, f) => {
    const im = new Img(14, 14);
    im.disc(7, 7, 5.6, C.eCyan[0]);
    im.disc(7, 7, 4.4, C.eCyan[1]);
    im.disc(7, 7, 3, C.eCyan[2]);
    im.disc(7, 7, 1.6, C.eCyan[3]);
    for (let i = 0; i < 4; i++) {
      const ang = f * 0.4 + i * TAU / 4;
      im.set(7 + Math.cos(ang) * 6.2, 7 + Math.sin(ang) * 6.2, C.eCyan[2]);
    }
    return im;
  } },
  rocket: { dirs: 16, frames: 2, size: 20, fn: (a, f) => render([
    P.cap({ x0: -5, y0: 0, x1: 4, y1: 0, z0: 3, r0: 2.1, ramp: C.steel, group: 'b', spec: true }),
    P.ell({ x: 5, y: 0, z: 3, rx: 2.4, ry: 1.9, ramp: C.flesh.map((c, i) => [ '#3a0806', '#6a0e0a', '#a01a10', '#d03a1c', '#f0683a', '#ff9a6a'][i]), group: 'w' }),
    P.plate({ pts: [[-6, -4], [-3, -1.5], [-3, 1.5], [-6, 4], [-5, 0]], z: 2.5, h: 1, bevel: 0.4, ramp: C.gunmetal, group: 'f' }),
    P.ell({ x: -7.4, y: 0, z: 2, rx: f ? 2.6 : 1.9, ry: f ? 1.6 : 1.3, emit: C.eOrange }),
  ], { w: 20, h: 20, angle: a }) },
  grenade: { dirs: 1, frames: 4, size: 10, fn: (a, f) => render([
    P.ell({ x: 0, y: 0, z: 0, rx: 3.2, ry: 2.8, rz: 3, yaw: f * TAU / 4, ramp: C.military, group: 'g', spec: true }),
    P.box({ x: 0, y: 0, hx: 0.6, hy: 3, z: 2.2, h: 1, yaw: f * TAU / 4, ramp: C.gunmetal, group: 'band' }),
    P.ell({ x: Math.cos(f * TAU / 4) * 2.2, y: Math.sin(f * TAU / 4) * 2.2, z: 3.6, rx: 0.8, emit: C.eYellow, emitIdx: 2 }),
  ], { w: 10, h: 10 }) },
  acid: { dirs: 1, frames: 3, size: 12, fn: (a, f) => {
    const im = new Img(12, 12);
    const w = [0, 0.6, -0.4][f];
    im.ellipse(6, 6, 4.4 + w, 4.4 - w, C.eToxic[0]);
    im.ellipse(6, 6, 3.4 + w, 3.4 - w, C.eToxic[1]);
    im.disc(5.6, 5.6, 2.2, C.eToxic[2]);
    im.disc(5, 5, 1, C.eToxic[3]);
    im.set(9 + (f % 2), 3, C.eToxic[2]); im.set(2, 9 - f, C.eToxic[1]);
    return im.outline('#0a1a06');
  } },
  orb: { dirs: 1, frames: 4, size: 14, fn: (a, f) => {
    const im = new Img(14, 14);
    im.disc(7, 7, 4.2, C.eViolet[0]);
    im.disc(7, 7, 3.2, C.eViolet[1]);
    im.disc(7, 7, 2, C.eViolet[2]);
    im.disc(6.6, 6.6, 1, C.eViolet[3]);
    for (let i = 0; i < 4; i++) {
      const ang = f * TAU / 16 + i * TAU / 4;
      im.set(7 + Math.cos(ang) * 6, 7 + Math.sin(ang) * 6, C.eViolet[2]);
    }
    return im;
  } },
  ember: { dirs: 1, frames: 4, size: 14, fn: (a, f) => {
    const im = new Img(14, 14);
    const rot = (f % 2) * Math.PI / 4;
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
      const dx = x + 0.5 - 7, dy = y + 0.5 - 7;
      const r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) - rot;
      const spike = 2.6 + 3.6 * Math.pow(Math.abs(Math.cos(ang * 2)), 6);
      if (r < spike) im.set(x, y, r < 1.6 ? '#fff4c0' : r < 2.8 ? C.eOrange[2] : r < 4.2 ? C.eRed[2] : C.eRed[1]);
    }
    return im.outline('#2a0402');
  } },
  shell: { dirs: 1, frames: 4, size: 12, fn: (a, f) => {
    const im = new Img(12, 12);
    im.disc(6, 6, 4.4, '#3a1206');
    im.disc(6, 6, 3.4, f % 2 ? '#c0520e' : '#a0400a');
    im.disc(5.4, 5.4, 1.8, '#ff9a2a');
    im.set(5, 5, '#fff0a0');
    im.set(2 + f, 9, '#ffd04a');
    return im.outline('#140602');
  } },
  rift: { dirs: 1, frames: 4, size: 16, fn: (a, f) => {
    const im = new Img(16, 16);
    const r = 5.6 + [0, 0.6, 1, 0.6][f];
    im.ring(8, 8, r + 1, 1, C.eCyan[0]);
    im.ring(8, 8, r, 2, C.eCyan[2]);
    im.ring(8, 8, r - 1, 1, C.eCyan[3]);
    im.disc(8, 8, 1.2, C.eMagenta[2 + (f % 2)]);
    return im;
  } },
};

/* ===================== FOGONAZOS ===================== */
const MUZZLE = {
  small: (u, v, f) => {
    const L = f ? 4 : 7, W = f ? 1.5 : 2.6;
    if (u < -1 || u > L) return null;
    const w = W * (1 - Math.abs(u - L * 0.3) / L);
    if (Math.abs(v) > w) return Math.abs(v) < w + 2.5 && Math.abs(u - L * 0.45) < 0.6 && !f ? '#ffb040' : null;
    return Math.abs(v) < w * 0.45 && u < L * 0.7 ? '#fffbe8' : '#ffd060';
  },
  wide: (u, v, f) => {
    const L = f ? 7 : 11;
    if (u < -1 || u > L) return null;
    const w = 1.5 + u * (f ? 0.45 : 0.62);
    if (Math.abs(v) > w) return null;
    const k = u / L;
    return k < 0.3 && Math.abs(v) < 2 ? '#fffbe8' : k < 0.65 ? '#ffd060' : '#ff8a2a';
  },
  rapid: (u, v, f) => {
    const L = f ? 5 : 8;
    if (u < -1 || u > L) return null;
    if (Math.abs(v) <= 1 && u < L) return u < 3 ? '#fffbe8' : '#ffd060';
    if (!f && Math.abs(u - 2) <= 1 && Math.abs(v) < 4) return '#ffc050';
    return null;
  },
  energy: (u, v, f) => {
    const d = Math.hypot(u - 3, v);
    const R = f ? 3 : 5;
    if (d < R * 0.45) return '#ffffff';
    if (d < R * 0.75) return C.eCyan[2];
    if (d < R) return C.eCyan[1];
    if (!f && Math.abs(v) < 0.6 && u > 5 && u < 10) return C.eCyan[2];
    return null;
  },
  heavy: (u, v, f) => {
    const d = Math.hypot(u - 4, v * 1.2);
    const R = f ? 5 : 8;
    if (d < R * 0.4) return '#fffbe8';
    if (d < R * 0.7) return '#ffb040';
    if (d < R) return f ? '#5a5a5a' : '#ff6a20';
    if (!f && d < R + 2 && (Math.round(u * 3 + v * 7) % 3 === 0)) return '#4a4a4a';
    return null;
  },
  electric: (u, v, f) => {
    if (u < -1 || u > 9) return null;
    const zig = Math.round(Math.sin(u * 1.7 + f * 2) * 2);
    if (Math.abs(v - zig) < 0.7 || (u > 4 && Math.abs(v + zig) < 0.7 && !f)) return u < 3 ? '#ffffff' : C.eViolet[2];
    if (Math.hypot(u, v) < 2.2) return C.eViolet[3];
    return null;
  },
};

/* ===================== EFECTOS ANIMADOS ===================== */
function blobCloud(im, cx, cy, R, n, shades, seed, t) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R;
    const br = (1.5 + r() * R * 0.45) * (1 - t * 0.35);
    const x = cx + Math.cos(a) * d * (1 + t * 0.3), y = cy + Math.sin(a) * d * (1 + t * 0.3) - t * 4;
    const k = Math.min(shades.length - 1, Math.floor(r() * shades.length));
    if (r() > 1 - t * 0.9) continue; // se deshace
    im.disc(x, y, br, shades[k]);
  }
}

const EFFECTS = {
  explosion: { size: 80, frames: 10, fps: 20, fn: (f) => {
    const im = new Img(80, 80);
    const c = 40;
    if (f === 0) { im.disc(c, c, 22, '#ffe08a'); im.disc(c, c, 16, '#fffbe8'); return im; }
    if (f <= 3) {
      const R = 22 + f * 5;
      blobCloud(im, c, c, R * 0.8, 26, ['#c03a10', '#e8641a'], 11 + f, 0);
      blobCloud(im, c, c, R * 0.6, 20, ['#ff9a2a', '#ffc84a'], 21 + f, 0);
      im.disc(c, c, R * 0.35 - f * 2, '#fff4c0');
      im.ring(c, c, R + 4, 2, f === 1 ? '#ffe08a' : '#ff9a2a');
      return im;
    }
    const t = (f - 4) / 5;
    blobCloud(im, c, c, 30, 30, ['#1a1618', '#2a2426', '#3a3234'], 41 + f, t);
    if (f < 7) blobCloud(im, c, c, 22, 14, ['#c03a10', '#ff7a20'], 61 + f, t + 0.3);
    const r = rng(90 + f);
    for (let i = 0; i < 12 * (1 - t); i++) im.set(c + (r() - 0.5) * 70, c + (r() - 0.5) * 70 - t * 6, r() < 0.5 ? '#ffb040' : '#ff6a20');
    return im;
  } },
  explosionEnergy: { size: 64, frames: 8, fps: 18, fn: (f) => {
    const im = new Img(64, 64);
    const c = 32;
    const R = 8 + f * 3.6;
    if (f < 3) im.disc(c, c, 18 - f * 3, f === 0 ? '#ffffff' : C.eCyan[3]);
    im.ring(c, c, R, 3, f < 4 ? C.eCyan[2] : C.eCyan[1]);
    im.ring(c, c, R * 0.7, 1, C.eMagenta[2]);
    const r = rng(7 + f);
    for (let i = 0; i < 16; i++) { const a = r() * TAU, d = R * (0.8 + r() * 0.5); im.set(c + Math.cos(a) * d, c + Math.sin(a) * d, r() < 0.5 ? C.eCyan[3] : C.eMagenta[2]); }
    return im;
  } },
  smoke: { size: 16, frames: 6, fps: 10, fn: (f) => {
    const im = new Img(16, 16);
    blobCloud(im, 8, 9, 3 + f * 0.6, 7, ['#24222a', '#34313a', '#46424c'], 5, f / 6);
    return im;
  } },
  steam: { size: 16, frames: 6, fps: 9, fn: (f) => {
    const im = new Img(16, 16);
    blobCloud(im, 8, 10, 2.5 + f * 0.7, 7, ['#5a6270', '#7a8494', '#9aa4b2'], 9, f / 6);
    return im;
  } },
  impact: { size: 12, frames: 4, fps: 24, fn: (f) => {
    const im = new Img(12, 12);
    const c = 6;
    if (f === 0) { im.rect(5, 2, 2, 8, '#fffbe8'); im.rect(2, 5, 8, 2, '#fffbe8'); im.rect(4, 4, 4, 4, '#ffd060'); }
    else { const r = rng(f); for (let i = 0; i < 6 - f; i++) { const a = r() * TAU, d = 2 + f * 1.4; im.set(c + Math.cos(a) * d, c + Math.sin(a) * d, f < 2 ? '#ffd060' : '#c87a24'); } }
    return im;
  } },
  hit: { size: 16, frames: 3, fps: 24, fn: (f) => {
    const im = new Img(16, 16);
    if (f === 0) { im.disc(8, 8, 4.5, '#ffffff'); im.ring(8, 8, 6, 1, '#ffd0c0'); }
    if (f === 1) { im.ring(8, 8, 6.5, 2, '#ffffff'); }
    if (f === 2) { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; im.set(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, '#ffd0c0'); } }
    return im;
  } },
  critHit: { size: 22, frames: 4, fps: 22, fn: (f) => {
    const im = new Img(22, 22);
    const c = 11;
    const L = [9, 10, 8, 5][f];
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; im.line(c, c, c + Math.cos(a) * L, c + Math.sin(a) * L, f < 2 ? '#fff0e0' : '#ff7a3a'); }
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; im.line(c, c, c + Math.cos(a) * L * 0.6, c + Math.sin(a) * L * 0.6, '#ff5a2a'); }
    if (f < 2) im.disc(c, c, 3 - f, '#ffffff');
    return im;
  } },
  energyHit: { size: 24, frames: 5, fps: 22, fn: (f) => {
    const im = new Img(24, 24);
    if (f === 0) im.disc(12, 12, 5, '#ffffff');
    im.ring(12, 12, 4 + f * 2, 2, f < 3 ? C.eCyan[2] : C.eCyan[1]);
    const r = rng(3 + f);
    for (let i = 0; i < 6; i++) { const a = r() * TAU, d = 3 + f * 2.4; im.set(12 + Math.cos(a) * d, 12 + Math.sin(a) * d, C.eCyan[3]); }
    return im;
  } },
  zap: { size: 14, frames: 3, fps: 20, fn: (f) => {
    const im = new Img(14, 14);
    const r = rng(17 + f);
    for (let i = 0; i < 5; i++) { const a = r() * TAU; im.line(7, 7, 7 + Math.cos(a) * (5 - f), 7 + Math.sin(a) * (5 - f), i % 2 ? C.eViolet[2] : '#ffffff'); }
    if (f === 0) im.disc(7, 7, 2, '#ffffff');
    return im;
  } },
  sparkle: { size: 16, frames: 5, fps: 16, fn: (f) => {
    const im = new Img(16, 16);
    const L = [3, 6, 7, 5, 2][f];
    im.line(8 - L, 8, 8 + L, 8, '#fffbe8'); im.line(8, 8 - L, 8, 8 + L, '#fffbe8');
    if (f > 0 && f < 4) { im.set(8 - 2, 8 - 2, '#ffd060'); im.set(8 + 2, 8 + 2, '#ffd060'); im.set(8 + 2, 8 - 2, '#ffd060'); im.set(8 - 2, 8 + 2, '#ffd060'); }
    return im;
  } },
  levelup: { size: 48, frames: 6, fps: 12, fn: (f) => {
    const im = new Img(48, 48);
    im.ring(24, 24, 8 + f * 3, 2, f < 4 ? C.eGreen[2] : C.eGreen[1]);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + f * 0.2, d = 10 + f * 3; im.rect(24 + Math.cos(a) * d, 24 + Math.sin(a) * d - f * 2, 2, 2, C.eGreen[3]); }
    return im;
  } },
  shield: { size: 40, frames: 4, fps: 8, fn: (f) => {
    const im = new Img(40, 40);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const d = Math.hypot(x + 0.5 - 20, y + 0.5 - 20);
      if (d > 19) continue;
      if (d > 17.6) { im.set(x, y, C.eCyan[2]); continue; }
      // retícula hexagonal
      const q = (x + (Math.floor(y / 5) % 2) * 3 + f) % 6, r = y % 5;
      if ((q === 0 || r === 0) && d > 8) im.set(x, y, C.eCyan[d > 14 ? 1 : 0], 170);
    }
    return im;
  } },
};

function portal(colors) {
  return { size: 44, frames: 8, fps: 12, fn: (f) => {
    const im = new Img(44, 44);
    const c = 22, t = f / 7;
    const R = 8 + t * 12;
    im.disc(c, c, R * 0.55, colors[0], 200);
    im.ring(c, c, R, 2, colors[2]);
    im.ring(c, c, R - 3, 1, colors[1]);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + f * 0.35;
      const b = a + TAU / 3;
      im.line(c + Math.cos(a) * (R - 2), c + Math.sin(a) * (R - 2), c + Math.cos(b) * (R - 2), c + Math.sin(b) * (R - 2), colors[1]);
    }
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 - f * 0.2;
      im.set(c + Math.cos(a) * (R + 2), c + Math.sin(a) * (R + 2), colors[3]);
    }
    return im;
  } };
}
EFFECTS.portal = portal(C.eRed);
EFFECTS.portalElite = portal(C.eGold);
EFFECTS.portalViolet = portal(C.eViolet);

/* ===================== MANCHAS Y SOMBRAS ===================== */
const BLOOD = {
  crimson: ['#2a0608', '#4a0c0e', '#6a1414'],
  violet: ['#1e0a2a', '#36124a', '#4e1e6a'],
  green: ['#122a08', '#1e4a0e', '#2e6a16'],
  ash: ['#1a0e08', '#2e1a0e', '#4a2a12'],
  energy: ['#1a0a3a', '#2e145a', '#46207e'],
  rust: ['#24090a', '#3e100e', '#5a1a12'],
  oil: ['#060608', '#0c0c10', '#16161c'],
  frost: ['#0e2a3a', '#1a4a6a', '#2a6a9a'],
};
function splat(shades, seed) {
  const im = new Img(24, 24);
  const r = rng(seed);
  im.disc(12, 12, 5 + r() * 2, shades[1]);
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, d = 3 + r() * 8;
    im.disc(12 + Math.cos(a) * d, 12 + Math.sin(a) * d, 0.8 + r() * 2.2, shades[i % 3 === 0 ? 0 : 1]);
  }
  im.disc(11, 11, 2.4, shades[2]);
  for (let i = 0; i < 6; i++) { const a = r() * TAU, d = 9 + r() * 3; im.set(12 + Math.cos(a) * d, 12 + Math.sin(a) * d, shades[1]); }
  return im;
}
function scorch(seed) {
  const im = new Img(64, 64);
  const r = rng(seed);
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 24;
    im.disc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 2 + r() * 5, '#000000', 60);
  }
  im.disc(32, 32, 12, '#000000', 90);
  for (let i = 0; i < 14; i++) { const a = r() * TAU, d = 10 + r() * 18; im.line(32, 32, 32 + Math.cos(a) * d, 32 + Math.sin(a) * d, '#000000', 70); }
  return im;
}
function shadow(w, h) {
  const im = new Img(w, h);
  im.ellipse(w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.5, '#000000', 110);
  im.ellipse(w / 2, h / 2, w / 2 - 2.5, h / 2 - 1.5, '#000000', 40);
  return im;
}

/* ===================== OBJETOS RECOGIBLES ===================== */
const MEDIC_RED = ['#4a0808', '#a01414', '#ff3a3a', '#ffb0a0'];
const PICKUPS = {
  health: { size: 18, fn: (f) => [
    P.box({ x: 0, y: 0, hx: 6, hy: 4.6, z: 0, h: 4.2, bevel: 1.2, ramp: C.white, group: 'case' }),
    P.box({ x: 0, y: 0, hx: 3.4, hy: 1, z: 4, h: 0.6, emit: MEDIC_RED, emitIdx: 2 + (f % 2) }),
    P.box({ x: 0, y: 0, hx: 1, hy: 3.4, z: 4, h: 0.6, emit: MEDIC_RED, emitIdx: 2 + (f % 2) }),
    P.cap({ x0: -2.5, y0: -5, x1: 2.5, y1: -5, z0: 3, r0: 0.8, ramp: C.gunmetal, group: 'h' }),
    P.ell({ x: 4.6, y: 3.2, z: 4.4, rx: 0.6, emit: C.eCyan, emitIdx: f < 2 ? 3 : 1 }),
  ] },
  healthBig: { size: 24, fn: (f) => [
    P.box({ x: 0, y: 0, hx: 8.5, hy: 6.2, z: 0, h: 5, bevel: 1.5, ramp: C.white, group: 'case' }),
    P.box({ x: 0, y: -6.4, hx: 8.5, hy: 0.7, z: 0, h: 5.2, ramp: MEDIC_RED.map((c) => c), bevel: 0, emit: MEDIC_RED, emitIdx: 1 }),
    P.box({ x: 0, y: 0.6, hx: 4.6, hy: 1.4, z: 4.8, h: 0.6, emit: MEDIC_RED, emitIdx: 2 + (f % 2) }),
    P.box({ x: 0, y: 0.6, hx: 1.4, hy: 4.6, z: 4.8, h: 0.6, emit: MEDIC_RED, emitIdx: 2 + (f % 2) }),
  ] },
  armor: { size: 18, fn: (f) => [
    P.plate({ pts: [[-6, -5], [6, -5], [6, 1], [0, 6.5], [-6, 1]], z: 0, h: 3.6, bevel: 1.5, ramp: C.armor, group: 'p', spec: true }),
    P.box({ x: 0, y: -0.6, hx: 0.8, hy: 3.6, z: 3.4, h: 0.5, emit: C.eCyan, emitIdx: 2 + (f % 2) }),
    P.box({ x: 0, y: -3.6, hx: 4, hy: 0.6, z: 3.4, h: 0.4, ramp: C.hazard, bevel: 0 }),
  ] },
  ammo_light: { size: 16, fn: (f) => [
    P.box({ x: 0, y: 1, hx: 5, hy: 4, z: 0, h: 3.6, bevel: 1, ramp: C.gunmetal, group: 'b' }),
    ...[-3, -1, 1, 3].map((x, i) => P.cap({ x0: x, y0: -1, x1: x, y1: -4.6, z0: 3, r0: 0.8, ramp: C.yellow, group: 'c' + i, spec: true })),
    P.box({ x: 0, y: 3, hx: 5, hy: 0.5, z: 3.5, h: 0.3, ramp: C.yellow, bevel: 0, bias: 1 }),
  ] },
  ammo_shells: { size: 16, fn: (f) => [
    ...[-3, 0, 3].map((y, i) => P.cap({ x0: -4, y0: y, x1: 3, y1: y, z0: 1.6, r0: 1.4, ramp: ['#2a0606', '#5a0e0c', '#901a14', '#c03020', '#e05a3a'], group: 's' + i, spec: true })),
    ...[-3, 0, 3].map((y, i) => P.cap({ x0: 3, y0: y, x1: 5, y1: y, z0: 1.6, r0: 1.5, ramp: C.yellow, group: 'b' + i })),
  ] },
  ammo_heavy: { size: 20, fn: (f) => [
    P.box({ x: 0, y: 0, hx: 7, hy: 5, z: 0, h: 4.6, bevel: 1.2, ramp: C.military, group: 'b' }),
    P.box({ x: -4, y: 0, hx: 0.9, hy: 5.1, z: 4.4, h: 0.4, ramp: C.hazard, bevel: 0 }),
    P.box({ x: 4, y: 0, hx: 0.9, hy: 5.1, z: 4.4, h: 0.4, ramp: C.hazard, bevel: 0 }),
    P.ell({ x: 0, y: 0, z: 4.5, rx: 2, rz: 1.2, ramp: ['#3a0806', '#6a0e0a', '#a01a10', '#d03a1c', '#f0683a'], spec: true }),
  ] },
  ammo_energy: { size: 16, fn: (f) => [
    P.cyl({ x: 0, y: 0, r: 4.6, z: 0, h: 5, bevel: 1.2, ramp: C.steel, group: 'c' }),
    P.cyl({ x: 0, y: 0, r: 2.8, z: 5, h: 0.6, bevel: 0, emit: C.eCyan, emitIdx: 2 + (f % 2) }),
    P.box({ x: 0, y: 4.6, hx: 1, hy: 1, z: 1, h: 3, ramp: C.gunmetal }),
  ] },
  ammo_special: { size: 16, fn: (f) => [
    P.cyl({ x: 0, y: 0, r: 4.6, z: 0, h: 4.4, bevel: 1.2, ramp: C.obsidian, group: 'c' }),
    P.cyl({ x: 0, y: 0, r: 3, z: 4.4, h: 0.6, bevel: 0.6, ramp: C.copper, group: 'coil', spec: true }),
    P.ell({ x: 0, y: 0, z: 5.2, rx: 1.4, emit: C.eViolet, emitIdx: 2 + (f % 2) }),
  ] },
  coin: { size: 12, fn: (f) => [
    P.box({ x: 0, y: 0, hx: 3.6, hy: 2.8, z: 0, h: 1.4, bevel: 0.5, ramp: C.sick, group: 'pcb' }),
    P.box({ x: -0.6, y: 0, hx: 1.8, hy: 1.6, z: 1.4, h: 1, bevel: 0.4, ramp: C.carbon, group: 'chip' }),
    ...[-2, 0, 2].map((y, i) => P.box({ x: 3.6, y: y * 0.9, hx: 0.9, hy: 0.4, z: 0.4, h: 0.8, ramp: C.yellow, bevel: 0, bias: f === i ? 2 : 0 })),
    P.ell({ x: 1.6, y: -1.4, z: 1.8, rx: 0.5, emit: C.eGold, emitIdx: f % 2 ? 3 : 1 }),
  ] },
  energy: { size: 16, fn: (f) => [
    P.plate({ pts: [[0, -6.5], [3.2, -1], [1.6, 6], [-1.6, 6], [-3.2, -1]], z: 0, h: 4, bevel: 1.6, emit: C.eGreen, emitIdx: undefined, emitK: 1 + f * 0.08 }),
    P.plate({ pts: [[4.2, -2], [6, 1], [4.6, 4], [3, 1]], z: 0, h: 2.4, bevel: 1, emit: C.eGreen, emitIdx: 1 + (f % 2) }),
  ] },
  quad: { size: 20, fn: (f) => [
    P.ell({ x: 0, y: 0, z: 0, rx: 6.2, rz: 5.4, ramp: C.flesh, group: 'o', spec: true }),
    ...[0, 1, 2, 3, 4, 5].map((i) => { const a = i * TAU / 6 + f * 0.13; return P.cap({ x0: Math.cos(a) * 5, y0: Math.sin(a) * 5, x1: Math.cos(a) * 8.6, y1: Math.sin(a) * 8.6, z0: 3, r0: 1.3, r1: 0.2, ramp: C.bone, group: 'sp' + i }); }),
    P.ell({ x: 0, y: 0, z: 5, rx: 3, rz: 1, emit: C.eRed, emitIdx: 2 + (f % 2) }),
  ] },
  rapid: { size: 18, fn: (f) => [
    P.cyl({ x: 0, y: 0, r: 6, z: 0, h: 4.4, bevel: 1.4, ramp: C.gunmetal, group: 'c' }),
    P.plate({ pts: [[1.5, -5], [-2.5, 0.6], [0, 0.6], [-1.5, 5], [2.5, -0.6], [0, -0.6]], z: 4.4, h: 0.8, bevel: 0, emit: C.eYellow, emitIdx: 2 + (f % 2) }),
  ] },
  invul: { size: 18, fn: (f) => [
    P.cyl({ x: 0, y: 0, r: 6.4, z: 0, h: 3, bevel: 1.4, ramp: C.steel, group: 'c' }),
    P.cyl({ x: 0, y: 0, r: 4.6, z: 3, h: 0.6, bevel: 0, emit: C.eCyan, emitIdx: 1 + (f % 2) }),
    P.cyl({ x: 0, y: 0, r: 2.6, z: 3.6, h: 0.8, bevel: 0.8, ramp: C.steel, group: 'cap' }),
    P.ell({ x: 0, y: 0, z: 4.6, rx: 1.2, emit: C.eCyan, emitIdx: 3 }),
  ] },
  nuke: { size: 20, fn: (f) => [
    P.cyl({ x: 0, y: 0, r: 7, z: 0, h: 4.4, bevel: 1.6, ramp: C.hazard, group: 'c' }),
    ...[0, 1, 2].map((i) => { const a = i * TAU / 3 - Math.PI / 2; const b = a + 1.05; return P.plate({ pts: [[Math.cos(a) * 1.8, Math.sin(a) * 1.8], [Math.cos(a) * 5.6, Math.sin(a) * 5.6], [Math.cos(b) * 5.6, Math.sin(b) * 5.6], [Math.cos(b) * 1.8, Math.sin(b) * 1.8]], z: 4.4, h: 0.6, bevel: 0, ramp: C.carbon, group: 't' + i }); }),
    P.ell({ x: 0, y: 0, z: 4.8, rx: 1.1, emit: C.eOrange, emitIdx: 2 + (f % 2) }),
  ] },
  crate: { size: 28, fn: (f) => [
    P.box({ x: 0, y: 0, hx: 11, hy: 7.4, z: 0, h: 6, bevel: 1.6, ramp: C.military, group: 'b' }),
    P.box({ x: 0, y: 0, hx: 11.1, hy: 1.4, z: 5.8, h: 0.5, ramp: C.yellow, bevel: 0, bias: f % 2 }),
    ...[-7, 7].map((x, i) => P.box({ x, y: 0, hx: 1.6, hy: 7.6, z: 0.5, h: 5.8, bevel: 0.6, ramp: C.gunmetal, group: 'l' + i })),
    P.box({ x: 0, y: -4.2, hx: 3.4, hy: 1.2, z: 6, h: 0.4, ramp: C.carbon, bevel: 0 }),
    P.ell({ x: 9, y: 5, z: 6.4, rx: 0.8, emit: C.eGreen, emitIdx: f % 2 ? 3 : 1 }),
  ] },
  datalog: { size: 18, fn: (f) => [
    P.box({ x: 0, y: 0, hx: 6, hy: 4.5, z: 0, h: 2.4, bevel: 0.8, ramp: C.gunmetal, group: 'case' }),
    P.box({ x: -0.8, y: 0, hx: 3.6, hy: 3, z: 2.4, h: 0.5, bevel: 0, emit: ['#063a24', '#0c6a40', '#1ab070', '#7affc8'], emitIdx: 1 + (f % 3) }),
    ...[-2.4, 0, 2.4].map((y, i) => P.box({ x: 5.8, y, hx: 0.9, hy: 0.6, z: 0.6, h: 1.2, ramp: C.yellow, bevel: 0, bias: f === i ? 2 : 0 })),
    P.ell({ x: 4.2, y: -3, z: 3, rx: 0.6, emit: C.eCyan, emitIdx: f % 2 ? 3 : 1 }),
  ] },
  barrel: { size: 28, frames: 2, fn: (f) => [
    P.cyl({ x: 0, y: 0, r: 12, z: 0, h: 12, bevel: 2.2, ramp: ['#2a0806', '#4e0e0a', '#7a1a10', '#a02a18', '#c84426', '#e86a3a'], group: 'b' }),
    P.cyl({ x: 0, y: 0, r: 9.4, z: 12, h: 0.4, bevel: 0.8, ramp: ['#2a0806', '#4e0e0a', '#7a1a10', '#a02a18', '#c84426'], bias: -1, group: 'rim' }),
    ...[0, 1, 2].map((i) => { const a = i * TAU / 3 - Math.PI / 2, b = a + 1.05; return P.plate({ pts: [[Math.cos(a) * 1.6, Math.sin(a) * 1.6], [Math.cos(a) * 6.4, Math.sin(a) * 6.4], [Math.cos(b) * 6.4, Math.sin(b) * 6.4], [Math.cos(b) * 1.6, Math.sin(b) * 1.6]], z: 12.3, h: 0.4, bevel: 0, ramp: C.yellow, group: 'h' + i }); }),
    P.cyl({ x: 6, y: 6, r: 1.6, z: 12, h: 1.2, bevel: 0.4, ramp: C.gunmetal, group: 'cap' }),
    P.ell({ x: -6.5, y: 5.5, z: 12.8, rx: 0.9, emit: f ? C.eRed : C.eGreen, emitIdx: f ? 3 : 1 }),
  ] },
};

module.exports = { PROJ, MUZZLE, EFFECTS, BLOOD, splat, scorch, shadow, PICKUPS, directional, render };
