'use strict';
/* Interfaz: paneles 9-slice, botones, barras, iconos 16×16, arte de armas y logotipo. */
const { Img, lighten, darken } = require('../lib/image');
const { P, render, xform } = require('../lib/model');
const C = require('./palette');
const { drawText, textWidth, G } = require('./font');
const PL = require('./player');

const OUT = '#05040a';

/* ---------------- 9-slice ---------------- */
function frame(size, { fill, border, hi, lo, accent, bolts, cut = 0 }) {
  const im = new Img(size, size);
  const inCut = (x, y) => cut && (x + y < cut || (size - 1 - x) + (size - 1 - y) < cut);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (inCut(x, y)) continue;
    const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1 || (cut && (x + y === cut || (size - 1 - x) + (size - 1 - y) === cut));
    if (edge) { im.set(x, y, OUT); continue; }
    const e2 = x === 1 || y === 1 || x === size - 2 || y === size - 2 || (cut && (x + y === cut + 1 || (size - 1 - x) + (size - 1 - y) === cut + 1));
    if (e2) { im.set(x, y, border); continue; }
    if (x === 2 || y === 2) { im.set(x, y, hi); continue; }
    if (x === size - 3 || y === size - 3) { im.set(x, y, lo); continue; }
    im.set(x, y, fill);
  }
  if (bolts) for (const [x, y] of [[4, 4], [size - 6, 4], [4, size - 6], [size - 6, size - 6]]) { im.set(x, y, bolts); im.set(x + 1, y + 1, darken(bolts, 0.5)); }
  if (accent) { im.rect(cut ? cut + 2 : 4, 1, Math.min(10, size / 3), 2, accent); }
  return im;
}
const UI = {
  panel: () => frame(48, { fill: '#0c0e13', border: '#2b313b', hi: '#1a1e26', lo: '#08090c', accent: '#e86a1a', bolts: '#4a525e' }),
  panel_red: () => frame(48, { fill: '#100a0c', border: '#5a1a14', hi: '#1e1012', lo: '#08060a', accent: '#ff3a2a', bolts: '#6a3a32' }),
  panel_inset: () => frame(24, { fill: '#080a0d', border: '#1e232b', hi: '#06070a', lo: '#14181e' }),
  btn: () => frame(24, { fill: '#151a22', border: '#353d49', hi: '#232a35', lo: '#0c0f13', cut: 5 }),
  btn_hover: () => frame(24, { fill: '#261810', border: '#e86a1a', hi: '#3a2414', lo: '#120b07', cut: 5 }),
  btn_primary: () => frame(24, { fill: '#3a0e09', border: '#c8301c', hi: '#561810', lo: '#1e0604', cut: 5 }),
  btn_primary_hover: () => frame(24, { fill: '#58140c', border: '#ff5a3a', hi: '#7a2414', lo: '#2a0806', cut: 5 }),
  btn_disabled: () => frame(24, { fill: '#0e1014', border: '#1e2228', hi: '#13161b', lo: '#0a0b0e', cut: 5 }),
  bar: () => frame(12, { fill: '#05060a', border: '#2b313b', hi: '#05060a', lo: '#05060a' }),
  card: () => frame(48, { fill: '#10141b', border: '#2e3642', hi: '#1a2029', lo: '#090b0f', bolts: '#3a424e' }),
  card_rare: () => frame(48, { fill: '#0e1622', border: '#2a6aa8', hi: '#16243a', lo: '#080c12', bolts: '#3a6a9a' }),
  card_epic: () => frame(48, { fill: '#160e22', border: '#8a4ad8', hi: '#241638', lo: '#0c0812', bolts: '#7a4ab0' }),
};
/** Rellenos de barra en franjas pixeladas (4 × 8, repetibles en horizontal). */
function fill(c) {
  const im = new Img(4, 8);
  im.rect(0, 0, 4, 1, lighten(c, 0.45)); im.rect(0, 1, 4, 3, c); im.rect(0, 4, 4, 3, darken(c, 0.25)); im.rect(0, 7, 4, 1, darken(c, 0.5));
  im.rect(3, 1, 1, 6, darken(c, 0.15));
  return im;
}
const FILLS = { hp: '#d8281c', armor: '#2a8ae0', xp: '#3ad88a', stamina: '#c8d0da', boss: '#c01a2a', lag: '#f0e8e0', combo: '#ffc23a', exhausted: '#e86a3a' };

/* ---------------- iconos 16 × 16 ---------------- */
function icon(fn) { const im = new Img(16, 16); fn(im); return im.outline(OUT); }
const Y = C.yellow, R = ['#4a0808', '#901a14', '#d8281c', '#ff6a4a'], B = ['#0e2a4a', '#1a5aa0', '#2a8ae0', '#8ac8ff'];
const ICONS = {
  hp: icon((i) => { i.rect(6, 2, 4, 12, R[2]); i.rect(2, 6, 12, 4, R[2]); i.rect(6, 2, 1, 12, R[3]); i.rect(2, 6, 12, 1, R[3]); i.rect(9, 3, 1, 11, R[1]); i.rect(3, 9, 11, 1, R[1]); }),
  armor: icon((i) => { for (let y = 1; y < 15; y++) { const w = y < 9 ? 6 : 6 - (y - 8); i.rect(8 - w, y, w * 2, 1, B[2]); } i.rect(7, 2, 2, 11, B[3]); i.rect(3, 2, 10, 1, B[3]); for (let y = 9; y < 15; y++) i.set(8 + (6 - (y - 8)) - 1, y, B[1]); }),
  ammo_light: icon((i) => { for (const x of [3, 7, 11]) { i.rect(x, 5, 3, 9, Y[3]); i.rect(x, 2, 3, 3, Y[4]); i.set(x + 1, 1, Y[4]); i.rect(x + 2, 5, 1, 9, Y[2]); } }),
  ammo_shells: icon((i) => { for (const x of [2, 6, 10]) { i.rect(x, 2, 4, 9, R[2]); i.rect(x, 2, 1, 9, R[3]); i.rect(x, 11, 4, 3, Y[3]); i.rect(x + 3, 2, 1, 9, R[1]); } }),
  ammo_heavy: icon((i) => { i.rect(5, 6, 6, 8, C.military[3]); i.rect(5, 6, 1, 8, C.military[4]); i.disc(8, 5, 3.5, R[2]); i.rect(7, 3, 1, 2, R[3]); i.rect(3, 12, 10, 2, C.military[2]); }),
  ammo_energy: icon((i) => { i.rect(4, 3, 8, 11, C.steel[3]); i.rect(6, 1, 4, 2, C.steel[4]); i.rect(5, 5, 6, 7, C.eCyan[1]); i.rect(6, 6, 2, 5, C.eCyan[3]); }),
  ammo_special: icon((i) => { i.rect(4, 3, 8, 11, C.obsidian[3]); for (let y = 4; y < 13; y += 2) i.rect(4, y, 8, 1, C.copper[3]); i.disc(8, 8, 2, C.eViolet[2]); }),
  ammo_inf: icon((i) => { i.ring(5, 8, 3.5, 1.6, Y[4]); i.ring(11, 8, 3.5, 1.6, Y[4]); }),
  coin: icon((i) => { i.rect(2, 4, 12, 9, C.sick[3]); i.rect(2, 4, 12, 1, C.sick[4]); i.rect(5, 6, 5, 5, C.carbon[2]); for (const y of [5, 8, 11]) i.rect(13, y, 2, 1, Y[4]); i.set(11, 6, C.eGold[3]); }),
  core: icon((i) => { for (let y = 1; y < 15; y++) { const w = y < 8 ? y * 0.7 : (15 - y) * 0.7; i.rect(8 - w, y, w * 2, 1, C.eViolet[1]); } i.rect(7, 3, 2, 10, C.eViolet[2]); i.rect(7, 5, 1, 4, C.eViolet[3]); }),
  wave: icon((i) => { i.disc(8, 7, 6, C.bone[4]); i.rect(4, 11, 8, 4, C.bone[4]); i.rect(4, 6, 3, 3, OUT); i.rect(9, 6, 3, 3, OUT); i.rect(7, 10, 2, 2, OUT); for (const x of [5, 8, 10]) i.set(x, 14, OUT); i.rect(5, 6, 1, 1, R[2]); i.rect(10, 6, 1, 1, R[2]); }),
  enemy: icon((i) => { for (const o of [0, 4, 8]) i.line(3 + o, 2, 6 + o, 14, R[2]); for (const o of [0, 4, 8]) i.line(4 + o, 2, 7 + o, 14, R[3]); }),
  score: icon((i) => { const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3 : 7; pts.push([8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]); } for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let ins = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y + 0.5) !== (yb > y + 0.5) && x + 0.5 < ((xb - xa) * (y + 0.5 - ya)) / (yb - ya) + xa) ins = !ins; } if (ins) i.set(x, y, y < 8 ? Y[4] : Y[3]); } }),
  combo: icon((i) => { i.disc(8, 10, 5, '#e8641a'); i.disc(8, 11, 3, '#ffc84a'); for (let y = 2; y < 8; y++) i.rect(8 - (y - 2) * 0.6, y, (y - 2) * 1.2 + 1, 1, '#e8641a'); i.rect(5, 4, 1, 3, '#ff9a2a'); i.set(8, 12, '#fff4c0'); }),
  level: icon((i) => { for (const o of [0, 5]) for (let k = 0; k < 6; k++) { i.rect(2 + k, 7 - k + o, 2, 2, C.eGreen[2]); i.rect(12 - k, 7 - k + o, 2, 2, C.eGreen[2]); } }),
  dash: icon((i) => { for (const o of [0, 5]) for (let k = 0; k < 5; k++) { i.rect(3 + k + o, 3 + k, 2, 1, C.eCyan[2]); i.rect(3 + k + o, 12 - k, 2, 1, C.eCyan[2]); } }),
  grenade: icon((i) => { i.disc(8, 9, 5.5, C.military[3]); i.disc(7, 8, 2, C.military[4]); i.rect(7, 2, 3, 2, C.gunmetal[4]); i.rect(10, 2, 3, 1, Y[4]); i.rect(3, 9, 10, 1, C.military[1]); }),
  shockwave: icon((i) => { i.ring(8, 8, 7, 1.5, C.eCyan[2]); i.ring(8, 8, 4.4, 1.4, C.eCyan[3]); i.disc(8, 8, 1.6, '#ffffff'); }),
  shield: icon((i) => { const pts = []; for (let k = 0; k < 6; k++) pts.push([8 + Math.cos(k * Math.PI / 3) * 7, 8 + Math.sin(k * Math.PI / 3) * 7]); for (let k = 0; k < 6; k++) i.line(...pts[k], ...pts[(k + 1) % 6], C.eCyan[3]); i.disc(8, 8, 3, C.eCyan[1]); }),
  overdrive: icon((i) => { const pl = [[9, 1], [3, 9], [7, 9], [5, 15], [13, 6], [9, 6], [11, 1]]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let ins = false; for (let a = 0, b = pl.length - 1; a < pl.length; b = a++) { const [xa, ya] = pl[a], [xb, yb] = pl[b]; if ((ya > y + 0.5) !== (yb > y + 0.5) && x + 0.5 < ((xb - xa) * (y + 0.5 - ya)) / (yb - ya) + xa) ins = !ins; } if (ins) i.set(x, y, x < 8 ? Y[5] : Y[4]); } }),
  berserk: icon((i) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; i.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, R[2]); } i.disc(8, 8, 3.5, R[3]); i.disc(8, 8, 1.5, '#ffffff'); }),
  settings: icon((i) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; i.rect(8 + Math.cos(a) * 6 - 1, 8 + Math.sin(a) * 6 - 1, 3, 3, C.steel[4]); } i.disc(8, 8, 5, C.steel[4]); i.disc(8, 8, 2, OUT); }),
  pause: icon((i) => { i.rect(3, 2, 4, 12, C.white[4]); i.rect(9, 2, 4, 12, C.white[4]); }),
  play: icon((i) => { for (let x = 0; x < 10; x++) i.rect(4 + x, 2 + x * 0.6, 1, 12 - x * 1.2, C.white[4]); }),
  restart: icon((i) => { i.ring(8, 8, 6, 2, C.white[4]); for (let y = 2; y < 9; y++) for (let x = 9; x < 16; x++) i.clear(x, y); i.rect(9, 2, 5, 2, C.white[4]); i.rect(12, 2, 2, 5, C.white[4]); }),
  back: icon((i) => { i.rect(5, 7, 9, 3, C.white[4]); for (let k = 0; k < 5; k++) i.rect(1 + k, 8 - k, 1, 1 + k * 2, C.white[4]); }),
  trophy: icon((i) => { i.rect(4, 2, 8, 6, Y[4]); i.disc(8, 7, 4, Y[4]); i.rect(7, 10, 2, 3, Y[3]); i.rect(4, 13, 8, 2, Y[2]); i.rect(1, 3, 3, 1, Y[3]); i.rect(12, 3, 3, 1, Y[3]); i.rect(1, 3, 1, 3, Y[3]); i.rect(14, 3, 1, 3, Y[3]); i.rect(6, 3, 1, 5, Y[5]); }),
  lock: icon((i) => { i.ring(8, 6, 4.5, 1.6, C.steel[4]); for (let y = 6; y < 9; y++) for (let x = 3; x < 13; x++) i.clear(x, y); i.rect(3, 7, 10, 8, Y[3]); i.rect(7, 9, 2, 4, OUT); }),
  check: icon((i) => { for (let k = 0; k < 4; k++) i.rect(2 + k, 8 + k, 2, 2, C.eGreen[2]); for (let k = 0; k < 8; k++) i.rect(6 + k, 11 - k, 2, 2, C.eGreen[2]); }),
  danger: icon((i) => { for (let y = 1; y < 15; y++) { const w = y * 0.5; i.rect(8 - w, y, w * 2, 1, Y[4]); } i.rect(7, 5, 2, 5, OUT); i.rect(7, 12, 2, 2, OUT); }),
  boss: icon((i) => { i.disc(8, 9, 5.5, C.bone[4]); i.rect(5, 12, 6, 3, C.bone[4]); i.line(3, 6, 1, 1, C.bone[3]); i.line(13, 6, 15, 1, C.bone[3]); i.line(4, 6, 2, 1, C.bone[3]); i.line(12, 6, 14, 1, C.bone[3]); i.rect(5, 8, 2, 2, R[2]); i.rect(9, 8, 2, 2, R[2]); }),
  clock: icon((i) => { i.disc(8, 8, 7, C.white[4]); i.disc(8, 8, 5.5, C.carbon[1]); i.rect(8, 4, 1, 5, C.white[4]); i.rect(8, 8, 3, 1, C.white[4]); }),
  kills: icon((i) => { i.ring(8, 8, 6, 1.4, R[3]); i.rect(7, 0, 2, 6, R[3]); i.rect(7, 10, 2, 6, R[3]); i.rect(0, 7, 6, 2, R[3]); i.rect(10, 7, 6, 2, R[3]); }),
  stats: icon((i) => { i.rect(2, 9, 3, 6, C.eCyan[2]); i.rect(6, 5, 3, 10, C.eCyan[2]); i.rect(10, 2, 3, 13, C.eCyan[2]); }),
  arsenal: icon((i) => { i.rect(1, 6, 11, 3, C.gunmetal[4]); i.rect(11, 7, 4, 1, C.gunmetal[4]); i.rect(3, 9, 3, 5, C.gunmetal[3]); i.rect(8, 9, 2, 3, C.gunmetal[3]); i.rect(2, 6, 9, 1, C.gunmetal[5]); }),
  // mejoras
  up_dmg: icon((i) => { i.rect(3, 6, 8, 4, Y[3]); i.rect(11, 7, 2, 2, Y[4]); i.rect(3, 6, 8, 1, Y[4]); i.rect(12, 1, 1, 5, R[2]); i.rect(10, 3, 5, 1, R[2]); }),
  up_rate: icon((i) => { for (const y of [3, 9]) { i.rect(2, y, 8, 3, Y[3]); i.rect(10, y + 1, 3, 1, Y[4]); } for (let k = 0; k < 3; k++) i.rect(12 + k, 6 - k, 1, 1 + k * 2, '#ffffff'); }),
  up_crit: icon((i) => { i.ring(8, 8, 6, 1.4, R[3]); i.disc(8, 8, 2, Y[4]); i.rect(7, 1, 2, 3, R[3]); i.rect(7, 12, 2, 3, R[3]); }),
  up_critdmg: icon((i) => { i.disc(8, 7, 6, C.bone[4]); i.rect(5, 11, 6, 4, C.bone[4]); i.rect(5, 6, 2, 2, OUT); i.rect(9, 6, 2, 2, OUT); i.line(8, 1, 11, 6, R[2]); i.line(11, 6, 9, 10, R[2]); }),
  up_pierce: icon((i) => { i.rect(1, 7, 14, 2, Y[4]); for (let k = 0; k < 3; k++) i.rect(12 - k, 7 - k, 1, 2 + k * 2, Y[4]); i.rect(6, 3, 3, 10, R[1]); i.rect(6, 7, 3, 2, Y[4]); }),
  up_range: icon((i) => { i.ring(8, 8, 6.5, 1.3, C.eCyan[2]); i.ring(8, 8, 3.5, 1, C.eCyan[1]); i.rect(7, 7, 2, 2, R[3]); i.rect(8, 0, 1, 4, C.eCyan[3]); }),
  up_multishot: icon((i) => { for (const y of [2, 7, 12]) { i.rect(2, y, 9, 2, Y[3]); i.rect(11, y, 2, 2, Y[4]); } }),
  up_explosive: icon((i) => { i.disc(7, 10, 5, C.carbon[3]); i.disc(6, 9, 1.5, C.carbon[4]); i.line(10, 6, 13, 2, Y[3]); i.rect(13, 1, 2, 2, '#ff9a2a'); }),
  up_maxhp: icon((i) => { i.rect(5, 3, 4, 10, R[2]); i.rect(2, 6, 10, 4, R[2]); i.rect(12, 1, 1, 5, C.eGreen[2]); i.rect(10, 3, 5, 1, C.eGreen[2]); }),
  up_armor: icon((i) => { for (let y = 2; y < 15; y++) { const w = y < 9 ? 5 : 5 - (y - 8); i.rect(7 - w, y, w * 2, 1, B[2]); } i.rect(12, 1, 1, 5, C.eGreen[2]); i.rect(10, 3, 5, 1, C.eGreen[2]); }),
  up_stamina: icon((i) => { i.rect(3, 4, 4, 10, C.white[3]); i.rect(9, 4, 4, 10, C.white[3]); i.rect(7, 1, 2, 6, C.white[4]); i.rect(3, 4, 1, 10, C.white[4]); }),
  up_reduction: icon((i) => { for (let y = 1; y < 15; y++) { const w = y < 9 ? 6 : 6 - (y - 8); i.rect(8 - w, y, w * 2, 1, C.steel[4]); } i.rect(4, 7, 8, 2, R[2]); }),
  up_regen: icon((i) => { i.rect(6, 2, 4, 12, C.eGreen[2]); i.rect(2, 6, 12, 4, C.eGreen[2]); i.rect(6, 2, 1, 12, C.eGreen[3]); i.ring(8, 8, 7, 1, C.eGreen[1]); }),
  up_speed: icon((i) => { i.rect(5, 2, 4, 9, C.rubber[4]); i.rect(5, 10, 9, 4, C.rubber[4]); i.rect(5, 13, 9, 1, C.gunmetal[5]); for (const y of [4, 7]) i.rect(0, y, 4, 1, C.eCyan[2]); }),
  up_dashcd: icon((i) => { for (let k = 0; k < 5; k++) { i.rect(2 + k, 2 + k, 2, 1, C.eCyan[2]); i.rect(2 + k, 11 - k, 2, 1, C.eCyan[2]); } i.disc(11, 11, 4, C.white[4]); i.rect(11, 9, 1, 3, OUT); i.rect(11, 11, 2, 1, OUT); }),
  up_dashcharge: icon((i) => { for (const o of [0, 4, 8]) for (let k = 0; k < 4; k++) { i.rect(2 + k + o, 3 + k, 1, 1, C.eCyan[3]); i.rect(2 + k + o, 12 - k, 1, 1, C.eCyan[3]); } }),
  up_evasion: icon((i) => { i.disc(6, 6, 3, C.white[4]); i.rect(3, 9, 6, 6, C.white[4]); i.disc(11, 6, 3, C.white[2]); i.rect(8, 9, 6, 6, C.white[2]); }),
  up_mag: icon((i) => { for (let y = 1; y < 15; y++) i.rect(5 + Math.floor(y * 0.25), y, 6, 1, C.gunmetal[4]); for (let y = 2; y < 14; y += 3) i.rect(6 + Math.floor(y * 0.25), y, 4, 1, Y[4]); }),
  up_reload: icon((i) => { i.ring(8, 8, 6.5, 2, Y[4]); for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) i.clear(x, y); for (let k = 0; k < 4; k++) i.rect(0 + k, 4 + k, 7 - k * 2, 1, Y[4]); }),
  up_ammo: icon((i) => { i.rect(1, 5, 14, 10, C.military[3]); i.rect(1, 5, 14, 1, C.military[4]); i.rect(5, 2, 2, 4, Y[4]); i.rect(9, 2, 2, 4, Y[4]); i.rect(1, 9, 14, 1, C.military[1]); }),
  up_drops: icon((i) => { i.disc(8, 10, 5.5, C.brown[3]); i.rect(6, 2, 4, 4, C.brown[3]); i.rect(5, 5, 6, 1, C.brown[1]); i.disc(7, 9, 1.5, C.brown[4]); }),
  up_coins: icon((i) => { for (const [x, y] of [[2, 8], [6, 4], [9, 9]]) { i.rect(x, y, 6, 5, C.sick[3]); i.rect(x + 1, y + 1, 3, 3, C.carbon[2]); i.rect(x + 5, y + 1, 1, 1, Y[4]); } }),
  up_magnet: icon((i) => { i.ring(8, 9, 6, 3, R[2]); for (let y = 9; y < 16; y++) for (let x = 0; x < 16; x++) i.clear(x, y); i.rect(2, 9, 3, 5, R[2]); i.rect(11, 9, 3, 5, R[2]); i.rect(2, 12, 3, 2, C.white[4]); i.rect(11, 12, 3, 2, C.white[4]); }),
  up_abilitycd: icon((i) => { i.disc(8, 8, 7, C.eCyan[1]); i.disc(8, 8, 5.4, C.carbon[1]); i.rect(8, 4, 1, 5, C.eCyan[3]); i.rect(8, 8, 3, 1, C.eCyan[3]); }),
  up_grenadecd: icon((i) => { i.disc(7, 9, 5, C.military[3]); i.rect(6, 3, 3, 2, C.gunmetal[4]); i.disc(12, 12, 3.4, C.white[4]); i.rect(12, 10, 1, 2, OUT); }),
};

/* ---------------- arte de armas (vista superior a escala 3) ---------------- */
function weaponArt(id) {
  const w = PL.WEAPONS[id]();
  const xs = [];
  for (const p of w.prims) xs.push(p.x ?? p.x0, p.x1 ?? p.x);
  const prims = xform(w.prims, { dx: -8, dy: -1.8 });
  return render(prims, { w: 84, h: 30, scale: 3, cx: 42, cy: 15 });
}

/* ---------------- logotipo ---------------- */
function logo() {
  const word = 'HELLFALL', sc = 4;
  const tw = word.length * 6 * sc - sc;
  const W = tw + 60, H = 76;
  const im = new Img(W, H);
  // símbolo: anillo de contención hexagonal con grieta dimensional
  const cx = 26, cy = 30;
  const hexPts = Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3 + Math.PI / 6; return [cx + Math.cos(a) * 22, cy + Math.sin(a) * 22]; });
  for (let k = 0; k < 6; k++) {
    const [x0, y0] = hexPts[k], [x1, y1] = hexPts[(k + 1) % 6];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      im.disc(x, y, 2.6, '#2a303a');
    }
  }
  for (let k = 0; k < 6; k++) {
    const [x0, y0] = hexPts[k], [x1, y1] = hexPts[(k + 1) % 6];
    for (let t = 0; t <= 1; t += 0.02) im.set((x0 + (x1 - x0) * t) - 1, (y0 + (y1 - y0) * t) - 1, k < 3 ? '#4a5262' : '#6a7486');
  }
  for (const [x, y] of hexPts) { im.disc(x, y, 2.2, '#c8301c'); im.set(x - 1, y - 1, '#ff8a5a'); }
  // grieta
  const crackPts = [[26, 8], [23, 16], [28, 22], [24, 30], [29, 37], [25, 44], [27, 52]];
  for (let k = 0; k < crackPts.length - 1; k++) {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = crackPts[k][0] + (crackPts[k + 1][0] - crackPts[k][0]) * t, y = crackPts[k][1] + (crackPts[k + 1][1] - crackPts[k][1]) * t;
      im.rect(Math.round(x) - 2, Math.round(y), 5, 1, '#ff3a1a');
      im.rect(Math.round(x) - 1, Math.round(y), 3, 1, '#ffb050');
      im.set(Math.round(x), Math.round(y), '#fff4d0');
    }
  }
  // letras biseladas
  const lx = 58, ly = 6;
  [...word].forEach((ch, n) => {
    G[ch].forEach((row, yy) => [...row].forEach((p, xx) => {
      if (p !== '#') return;
      const X = lx + (n * 6 + xx) * sc, Yy = ly + yy * sc;
      const top = yy < 3;
      im.rect(X, Yy, sc, sc, top ? '#e8ecf0' : yy < 5 ? '#a8b0bc' : '#6c7686');
      im.rect(X, Yy, sc, 1, '#ffffff');
      im.rect(X + sc - 1, Yy, 1, sc, top ? '#b8c0ca' : '#4a5260');
    }));
  });
  // daño en las letras
  for (const [x, y] of [[lx + 30, ly + 4], [lx + 110, ly + 18], [lx + 160, ly + 8]]) { im.clear(x, y); im.clear(x + 1, y); im.clear(x + 1, y + 1); }
  // SURVIVAL en rojo
  const sub = 'SURVIVAL', ss = 2;
  const sw = sub.length * 6 * ss * 1.6;
  let sx = lx + Math.floor((tw - sw) / 2);
  [...sub].forEach((ch) => {
    G[ch].forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '#') im.rect(sx + xx * ss, 42 + yy * ss, ss, ss, yy < 3 ? '#ff5a3a' : '#c8281a'); }));
    sx += 6 * ss * 1.6;
  });
  im.rect(lx, 62, tw, 2, '#c8281a');
  for (let x = lx; x < lx + tw; x += 8) im.rect(x, 66, 4, 2, '#7a6416');
  return im.outline(OUT);
}

/* ---------------- retratos de radio (32 × 32, vista frontal) ---------------- */
function portraitFrame(im, bg) {
  im.rect(0, 0, 32, 32, bg);
  for (let y = 0; y < 32; y += 2) im.rect(0, y, 32, 1, darken(bg, 0.25));
  return im;
}
const PORTRAITS = {
  // Dra. Elena Varga: directora científica, gafas y bata
  varga: () => {
    const im = portraitFrame(new Img(32, 32), '#0e2a2e');
    im.ellipse(16, 30, 13, 8, '#d8dee4'); im.rect(14, 23, 4, 9, '#8a95a0'); im.rect(15, 24, 2, 8, '#3a8ab0');
    im.ellipse(16, 14, 7, 8.5, '#c8906a'); im.ellipse(17, 15, 5, 7, '#d8a07a');
    im.ellipse(16, 8, 8, 5, '#3a2418'); im.rect(8, 8, 3, 12, '#3a2418'); im.rect(21, 8, 3, 9, '#3a2418');
    im.rect(10, 13, 5, 3, '#1a1a20'); im.rect(17, 13, 5, 3, '#1a1a20'); im.rect(15, 14, 2, 1, '#1a1a20');
    im.rect(11, 14, 3, 1, '#7fe0f0'); im.rect(18, 14, 3, 1, '#7fe0f0');
    im.rect(14, 20, 4, 1, '#8a4a3a');
    return im.outline(OUT);
  },
  // Comandante Reyes («Atalaya»): casco con auricular
  reyes: () => {
    const im = portraitFrame(new Img(32, 32), '#1a1e14');
    im.ellipse(16, 30, 14, 8, '#3e4a2e'); im.rect(6, 26, 20, 2, '#55653c');
    im.ellipse(16, 16, 7, 8, '#9a6a4a'); im.ellipse(17, 17, 5, 6.5, '#aa7a58');
    im.ellipse(16, 10, 9.5, 6, '#4a5a38'); im.rect(6, 10, 20, 3, '#3a4a2a'); im.rect(6, 12, 20, 1, '#71844e');
    im.rect(11, 15, 3, 1, '#1a1410'); im.rect(18, 15, 3, 1, '#1a1410');
    im.rect(13, 21, 6, 1, '#5a3a28'); im.rect(12, 19, 8, 1, '#7a5038');
    im.rect(5, 14, 3, 6, '#2a2a30'); im.line(7, 19, 12, 22, '#2a2a30'); im.rect(12, 21, 2, 2, '#e0402a');
    return im.outline(OUT);
  },
  // Operador K-7 (el jugador)
  k7: () => {
    const im = portraitFrame(new Img(32, 32), '#121a24');
    im.ellipse(16, 30, 14, 8, '#2e4058'); im.rect(5, 26, 6, 4, '#e88a1c');
    im.ellipse(16, 15, 10, 11, '#3a4b63'); im.ellipse(15, 13, 8, 8, '#557090');
    im.rect(9, 14, 14, 5, '#0e5a6a'); im.rect(10, 15, 12, 3, '#4ae0f0'); im.rect(11, 15, 4, 1, '#b8fcff');
    im.rect(14, 5, 4, 3, '#283447');
    return im.outline(OUT);
  },
  // La Señal: la voz de la anomalía
  signal: () => {
    const im = portraitFrame(new Img(32, 32), '#0a0614');
    for (let i = 0; i < 40; i++) im.set((i * 37) % 32, (i * 17) % 32, i % 3 ? '#2a1048' : '#5a1e8a');
    im.ellipse(16, 16, 12, 7, '#36125a'); im.ellipse(16, 16, 9, 5, '#a01a8a'); im.disc(16, 16, 4, '#ff4af0'); im.disc(16, 16, 2, '#1a0a2a');
    im.set(15, 15, '#ffc8f8');
    for (let y = 4; y < 30; y += 5) im.rect(0, y, 32, 1, '#ff4af0', 60);
    return im.outline(OUT);
  },
  // Archivo de datos del complejo
  archive: () => {
    const im = portraitFrame(new Img(32, 32), '#06120e');
    im.rect(6, 6, 20, 20, '#1a2a24'); im.rect(8, 8, 16, 16, '#062a1e');
    for (let y = 10; y < 22; y += 3) im.rect(10, y, 4 + ((y * 7) % 9), 1, '#3affaa');
    im.rect(4, 26, 24, 2, '#2c3440');
    return im.outline(OUT);
  },
};

module.exports = { UI, FILLS, fill, ICONS, weaponArt, logo, PORTRAITS };
