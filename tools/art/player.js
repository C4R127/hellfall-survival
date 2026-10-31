'use strict';
/*
 * Protagonista: operador de la Unidad de Contención 7.
 * Capas separadas: piernas (dirección de movimiento) y torso + brazos + arma (dirección de apuntado).
 */
const { P, xform } = require('../lib/model');
const C = require('./palette');

/* ---------------- armas sostenidas (coordenadas locales, +x hacia delante) ---------------- */
const WEAPONS = {
  pistol() {
    return {
      rh: [7.5, 2.6, 16.5], lh: [7.6, 0.6, 16.5], muzzle: [15, 1.6],
      prims: [
        P.box({ x: 10.2, y: 1.6, hx: 3.6, hy: 1.3, z: 15.6, h: 2.4, ramp: C.gunmetal, group: 'gun', bevel: 0.8 }),
        P.box({ x: 10.8, y: 1.6, hx: 3.1, hy: 0.9, z: 18, h: 0.8, ramp: C.steel, group: 'gun', bevel: 0.5 }),
        P.ell({ x: 8.2, y: 0.5, z: 19, rx: 0.7, emit: C.eCyan, emitIdx: 3 }),
      ],
    };
  },
  shotgun() {
    return {
      rh: [6.5, 3.6, 16.2], lh: [15, 3.7, 16], muzzle: [22, 1.4],
      prims: [
        P.box({ x: 2.8, y: 2.2, hx: 3, hy: 1.4, z: 14.2, h: 2.5, ramp: C.brown, group: 'gun' }),
        P.box({ x: 8.6, y: 1.9, hx: 3.1, hy: 1.9, z: 14.6, h: 3, ramp: C.gunmetal, group: 'gun' }),
        P.box({ x: 8.8, y: 3.9, hx: 1.6, hy: 0.5, z: 16.3, h: 0.7, ramp: C.hazard, group: 'gun', bevel: 0 }),
        P.cap({ x0: 10.5, y0: 1.3, x1: 21.5, y1: 1.3, z0: 16.8, r0: 1.3, ramp: C.gunmetal, group: 'gun', spec: true }),
        P.cap({ x0: 10.5, y0: 2.8, x1: 18.5, y1: 2.8, z0: 15.6, r0: 0.9, ramp: C.carbon, group: 'gun' }),
        P.box({ x: 15.2, y: 2.2, hx: 2.8, hy: 2, z: 14.4, h: 2.8, ramp: C.brown, group: 'pump', bias: 1 }),
      ],
    };
  },
  rifle() {
    return {
      rh: [6.6, 3.1, 16.4], lh: [14.4, 3.5, 16], muzzle: [23.5, 1.8],
      prims: [
        P.box({ x: 2.4, y: 1.8, hx: 2.6, hy: 1.2, z: 14.8, h: 2.4, ramp: C.carbon, group: 'gun' }),
        P.box({ x: 8.6, y: 1.8, hx: 4.3, hy: 1.6, z: 14.8, h: 2.8, ramp: C.gunmetal, group: 'gun' }),
        P.box({ x: 9.2, y: 4, hx: 1.2, hy: 1.9, z: 13.4, h: 2, yaw: 0.25, ramp: C.gunmetal, group: 'mag', bias: -1 }),
        P.box({ x: 15.4, y: 1.8, hx: 2.9, hy: 1.4, z: 15.1, h: 2.4, ramp: C.carbon, group: 'gun' }),
        P.cap({ x0: 17.5, y0: 1.8, x1: 22.8, y1: 1.8, z0: 16.4, r0: 0.75, ramp: C.steel, group: 'gun' }),
        P.ell({ x: 8.2, y: 1.8, z: 18.2, rx: 2.4, ry: 0.95, rz: 1, ramp: C.steel, group: 'scope', spec: true }),
        P.ell({ x: 10.5, y: 1.8, z: 18.6, rx: 0.6, emit: C.eRed, emitIdx: 2 }),
      ],
    };
  },
  plasma() {
    return {
      rh: [5.6, 3.6, 16], lh: [13.2, 3.9, 16], muzzle: [21.5, 1.8],
      prims: [
        P.ell({ x: 10, y: 1.8, z: 14.6, rx: 7.4, ry: 2.9, rz: 2.6, ramp: C.gunmetal, group: 'gun' }),
        P.box({ x: 9, y: 1.8, hx: 4.6, hy: 1.6, z: 15.8, h: 1.8, ramp: C.steel, group: 'gun' }),
        P.box({ x: 10.2, y: 1.8, hx: 4, hy: 0.5, z: 17.6, h: 0.5, emit: C.eCyan, emitIdx: 2 }),
        P.ell({ x: 5.2, y: 1.8, z: 17.4, rx: 1.9, emit: C.eCyan }),
        P.cap({ x0: 15, y0: 0.1, x1: 20.5, y1: 0.4, z0: 16, r0: 0.85, ramp: C.steel, group: 'prong' }),
        P.cap({ x0: 15, y0: 3.5, x1: 20.5, y1: 3.2, z0: 16, r0: 0.85, ramp: C.steel, group: 'prong' }),
        P.ell({ x: 19.6, y: 1.8, z: 16, rx: 1, emit: C.eCyan, emitIdx: 3 }),
      ],
    };
  },
  launcher() {
    return {
      rh: [5, 6.2, 16.5], lh: [10.5, 0.8, 16.8], muzzle: [21, 3.6],
      prims: [
        P.cap({ x0: -4, y0: 3.6, x1: 19, y1: 3.6, z0: 18, r0: 3.2, rzk: 0.95, ramp: C.military, group: 'tube' }),
        P.cap({ x0: 17.2, y0: 3.6, x1: 19.6, y1: 3.6, z0: 18.2, r0: 3.6, ramp: C.carbon, group: 'ring' }),
        P.cap({ x0: -4.6, y0: 3.6, x1: -2.6, y1: 3.6, z0: 18.2, r0: 3.5, ramp: C.carbon, group: 'ring2' }),
        P.box({ x: 7.5, y: 3.6, hx: 0.8, hy: 3.3, z: 20.6, h: 0.5, ramp: C.hazard, group: 'tube', bevel: 0 }),
        P.box({ x: 10.5, y: 3.6, hx: 0.8, hy: 3.3, z: 20.6, h: 0.5, ramp: C.hazard, group: 'tube', bevel: 0 }),
        P.box({ x: 4, y: 0.4, hx: 1.6, hy: 0.9, z: 20, h: 1.4, ramp: C.gunmetal, group: 'sight' }),
        P.ell({ x: 5.4, y: 0.4, z: 21.2, rx: 0.6, emit: C.eRed, emitIdx: 2 }),
      ],
    };
  },
  tesla() {
    return {
      rh: [5.6, 3.9, 16.2], lh: [11, 4.4, 16], muzzle: [22.5, 1.8],
      prims: [
        P.box({ x: 7.8, y: 1.8, hx: 4.2, hy: 2.2, z: 14.6, h: 2.8, ramp: C.gunmetal, group: 'gun' }),
        P.box({ x: 7, y: 1.8, hx: 1.8, hy: 1, z: 17.2, h: 0.5, emit: C.eViolet, emitIdx: 2 }),
        P.ell({ x: 12.6, y: 1.8, z: 16.4, rx: 1.4, ry: 2.4, rz: 1.6, ramp: C.copper, group: 'c1', spec: true }),
        P.ell({ x: 14.8, y: 1.8, z: 16.4, rx: 1.4, ry: 2.4, rz: 1.6, ramp: C.copper, group: 'c2', spec: true }),
        P.ell({ x: 17, y: 1.8, z: 16.4, rx: 1.4, ry: 2.4, rz: 1.6, ramp: C.copper, group: 'c3', spec: true }),
        P.cap({ x0: 17.5, y0: -0.2, x1: 21.6, y1: 0.1, z0: 16, r0: 0.8, ramp: C.steel, group: 'prong' }),
        P.cap({ x0: 17.5, y0: 3.8, x1: 21.6, y1: 3.5, z0: 16, r0: 0.8, ramp: C.steel, group: 'prong' }),
        P.ell({ x: 21.8, y: 0.1, z: 16.4, rx: 0.8, emit: C.eViolet, emitIdx: 3 }),
        P.ell({ x: 21.8, y: 3.5, z: 16.4, rx: 0.8, emit: C.eViolet, emitIdx: 3 }),
      ],
    };
  },
};

/* ---------------- torso ---------------- */
function body(o = {}) {
  const b = o.breath || 0;
  const visor = o.visorOff ? { ramp: C.gunmetal } : { emit: C.eCyan, emitIdx: 2 };
  return [
    // mochila técnica
    P.box({ x: -6.8, y: 0, hx: 3, hy: 5.2, z: 8, h: 9.5, bevel: 1.4, ramp: C.military, group: 'pack' }),
    P.box({ x: -7.4, y: 0, hx: 1.6, hy: 3.6, z: 17.2, h: 1.2, ramp: C.gunmetal, group: 'packTop', bevel: 0.5 }),
    P.cap({ x0: -9.2, y0: -4.6, x1: -9.2, y1: 4.6, z0: 13, r0: 1.7, ramp: C.fabric, group: 'roll' }),
    P.ell({ x: -8.2, y: -3.2, z: 18.6, rx: 0.8, emit: C.eGreen, emitIdx: 3 }),
    P.ell({ x: -8.2, y: 3.2, z: 18.6, rx: 0.7, emit: C.eRed, emitIdx: 2 }),
    P.cap({ x0: -6.5, y0: -4.2, x1: -10.5, y1: -7.2, z0: 18, z1: 21, r0: 0.55, ramp: C.gunmetal, group: 'ant' }),
    // torso (traje) y placa pectoral
    P.ell({ x: 0, y: 0, z: 5 + b, rx: 6.6, ry: 8.4, rz: 9.5, ramp: C.suit, group: 'torso' }),
    P.plate({ pts: [[0.5, -5.4], [5.6, -3.6], [6.4, 0], [5.6, 3.6], [0.5, 5.4], [-2.5, 3.4], [-2.5, -3.4]], z: 11.2 + b, h: 3.6, bevel: 1.5, ramp: C.armor, group: 'chest', spec: true }),
    P.box({ x: 3.6, y: 0, hx: 0.9, hy: 2.6, z: 14.9 + b, h: 0.5, ramp: C.hazard, group: 'chest', bevel: 0 }),
    P.box({ x: 1.8, y: -3.8, hx: 3.6, hy: 0.6, z: 14.4 + b, h: 1, yaw: 0.5, ramp: C.fabric, group: 'strap', bevel: 0.3 }),
    P.box({ x: 1.8, y: 3.8, hx: 3.6, hy: 0.6, z: 14.4 + b, h: 1, yaw: -0.5, ramp: C.fabric, group: 'strap', bevel: 0.3 }),
    // hombreras reforzadas (placas angulares)
    P.plate({ pts: [[-3.4, -6.2], [3.8, -6.6], [4.4, -9.6], [1.6, -12], [-3.6, -11.4]], z: 10.5 + b, h: 4.6, bevel: 1.6, ramp: C.armor, group: 'shL', spec: true }),
    P.plate({ pts: [[-3.4, 6.2], [3.8, 6.6], [4.4, 9.6], [1.6, 12], [-3.6, 11.4]], z: 10.5 + b, h: 4.6, bevel: 1.6, ramp: C.armor, group: 'shR', spec: true }),
    P.box({ x: 0.2, y: -10, hx: 2.6, hy: 0.7, z: 15 + b, h: 0.6, yaw: 0.15, ramp: C.hazard, group: 'shL', bevel: 0 }),
    P.box({ x: -1.6, y: 10, hx: 0.6, hy: 1.2, z: 15 + b, h: 0.5, ramp: C.armor, bias: -2, group: 'shR', bevel: 0 }),
    // casco oscuro con visor luminoso
    P.ell({ x: 1.4, y: 0, z: 13.4 + b * 1.2, rx: 5.5, ry: 4.6, rz: 5.6, ramp: C.helmet, group: 'helm', spec: true }),
    P.plate({ pts: [[4.6, -3.4], [6.9, -1.8], [6.9, 1.8], [4.6, 3.4], [5.4, 0]], z: 16 + b, h: 2, bevel: 0.6, group: 'visor', ...visor }),
    P.box({ x: -0.6, y: 0, hx: 3.4, hy: 0.8, z: 18.6 + b * 1.2, h: 0.7, ramp: C.helmet, bias: 1, group: 'ridge', bevel: 0.3 }),
    P.box({ x: 1, y: -3.4, hx: 1.3, hy: 0.4, z: 17.4 + b, h: 0.4, ramp: C.helmet, bias: -3, group: 'scratch', bevel: 0 }),
  ];
}

function arms(rh, lh, breath = 0) {
  return [
    P.cap({ x0: 0.6, y0: 7.6, z0: 12 + breath, x1: rh[0], y1: rh[1], z1: rh[2] - 0.8, r0: 2.3, r1: 1.9, ramp: C.suit, group: 'armR' }),
    P.cap({ x0: 0.6, y0: -7.6, z0: 12 + breath, x1: lh[0], y1: lh[1], z1: lh[2] - 0.8, r0: 2.3, r1: 1.9, ramp: C.suit, group: 'armL' }),
    P.ell({ x: (0.6 + rh[0]) / 2, y: (7.6 + rh[1]) / 2, z: (12 + rh[2]) / 2 + 0.6, rx: 1.6, rz: 1.4, ramp: C.armor, group: 'elbR' }),
    P.ell({ x: (0.6 + lh[0]) / 2, y: (-7.6 + lh[1]) / 2, z: (12 + lh[2]) / 2 + 0.6, rx: 1.6, rz: 1.4, ramp: C.armor, group: 'elbL' }),
    P.ell({ x: rh[0], y: rh[1], z: rh[2] - 0.6, rx: 2, rz: 1.8, ramp: C.rubber, group: 'handR' }),
    P.ell({ x: lh[0], y: lh[1], z: lh[2] - 0.6, rx: 2, rz: 1.8, ramp: C.rubber, group: 'handL' }),
  ];
}

const POSES = { idle: 2, shoot: 2, reload: 4, hurt: 1 };

/** Torso con arma en una pose. */
function torso(weaponId, pose, f) {
  const w = WEAPONS[weaponId]();
  let gun = w.prims, rh = w.rh.slice(), lh = w.lh.slice();
  let breath = 0, extra = [];
  const shift = (prims, o) => xform(prims, o);
  const moveH = (h, o) => { const [x, y] = require('../lib/model').rot(h[0] - (o.ox || 0), h[1] - (o.oy || 0), o.yaw || 0); return [x + (o.ox || 0) + (o.dx || 0), y + (o.oy || 0) + (o.dy || 0), h[2] + (o.dz || 0)]; };

  if (pose === 'idle') breath = f === 1 ? 0.5 : 0;
  if (pose === 'shoot') {
    const o = { dx: f === 0 ? -1.8 : -0.7 };
    gun = shift(gun, o); rh = moveH(rh, o); lh = moveH(lh, o);
  }
  if (pose === 'reload') {
    const yaws = [-0.3, -0.5, -0.5, -0.22];
    const o = { yaw: yaws[f], ox: rh[0], oy: rh[1], dx: -1 };
    gun = shift(gun, o); rh = moveH(rh, o);
    const lhs = [[5.5, 6, 14], [2, 8, 11.5], [6, 6.5, 14], null];
    if (lhs[f]) lh = lhs[f]; else lh = moveH(lh, o);
    if (f === 1) extra.push(P.box({ x: 3, y: 7.5, hx: 1.2, hy: 1.9, z: 10, h: 2, ramp: C.gunmetal, group: 'magOut' }));
  }
  let all = [...body({ breath }), ...arms(rh, lh, breath), ...gun, ...extra];
  if (pose === 'hurt') all = xform(all, { dx: -1.6, yaw: 0.12 });
  return all;
}

/* ---------------- piernas ---------------- */
const LEG_ANIMS = { idle: 1, walk: 6, run: 6 };
function legs(anim, f) {
  const n = LEG_ANIMS[anim];
  const stride = anim === 'run' ? 6.2 : anim === 'walk' ? 4.4 : 0;
  const lift = anim === 'run' ? 2.4 : 1.4;
  const out = [P.ell({ x: 0, y: 0, z: 6, rx: 4.2, ry: 6.4, rz: 3, ramp: C.suit, group: 'hips' })];
  for (const s of [1, -1]) {
    const ph = (f / n) * Math.PI * 2 + (s > 0 ? 0 : Math.PI);
    const fx = anim === 'idle' ? s * 0.8 : Math.sin(ph) * stride;
    const up = anim === 'idle' ? 0 : Math.max(0, Math.cos(ph)) * lift;
    out.push(
      P.cap({ x0: 0, y0: s * 3, z0: 5.5, x1: fx, y1: s * 3.8, z1: 2 + up, r0: 2.4, r1: 2, ramp: C.suit, group: 'leg' + s }),
      P.ell({ x: fx * 0.55, y: s * 3.6, z: 4 + up * 0.5, rx: 1.7, rz: 1.5, ramp: C.armor, group: 'knee' + s }),
      P.ell({ x: fx + 1.3, y: s * 3.8, z: 0.4 + up, rx: 3.4, ry: 2.1, rz: 1.8, ramp: C.rubber, group: 'boot' + s }),
      P.box({ x: fx + 3.6, y: s * 3.8, hx: 0.8, hy: 1.6, z: 0.6 + up, h: 1.4, ramp: C.gunmetal, group: 'boot' + s, bevel: 0.4 }),
    );
  }
  return out;
}

/* ---------------- muerte ---------------- */
const DEATH_FRAMES = 8;
function death(f) {
  const t = Math.min(1, f / 5);
  const visorOff = f >= 6;
  const w = WEAPONS.rifle();
  const gun = xform(w.prims, { dx: 5 * t, dy: 9 * t, yaw: 0.9 * t, dz: -13 * t, ox: 8, oy: 2 });
  return [
    ...gun,
    P.box({ x: -7.2 - 4 * t, y: 0, hx: 3.6, hy: 6, z: 8 - 8 * t, h: 10 - 6 * t, bevel: 1.6, ramp: C.military, group: 'pack' }),
    P.cap({ x0: 2, y0: 3.4, z0: 4 - t, x1: 2 + 11 * t, y1: 4.5, z1: 2, r0: 2.4, r1: 2, ramp: C.fabric, group: 'legR' }),
    P.cap({ x0: 2, y0: -3.4, z0: 4 - t, x1: 2 + 10 * t, y1: -5, z1: 2, r0: 2.4, r1: 2, ramp: C.fabric, group: 'legL' }),
    P.ell({ x: 3 + 11 * t, y: 4.6, z: 1.5, rx: 2.2, ry: 2.4, rz: 2, ramp: C.rubber, group: 'bootR' }),
    P.ell({ x: 3 + 10 * t, y: -5, z: 1.5, rx: 2.2, ry: 2.4, rz: 2, ramp: C.rubber, group: 'bootL' }),
    P.ell({ x: -4 * t, y: 0, z: 6 - 4 * t, rx: 7 + 3 * t, ry: 9, rz: 9.5 - 6 * t, ramp: C.armor, group: 'torso' }),
    P.cap({ x0: -2 * t, y0: 8, z0: 9 - 6 * t, x1: -6 * t + 4 * (1 - t), y1: 9 + 6 * t, z1: 3, r0: 2.5, r1: 2, ramp: C.fabric, group: 'armR' }),
    P.cap({ x0: -2 * t, y0: -8, z0: 9 - 6 * t, x1: -5 * t + 4 * (1 - t), y1: -9 - 7 * t, z1: 3, r0: 2.5, r1: 2, ramp: C.fabric, group: 'armL' }),
    P.ell({ x: 0.4 - 4 * t, y: -8.6 - t, z: 11 - 7 * t, rx: 4.6, ry: 3.9, rz: 5 - 2 * t, ramp: C.armor, group: 'shL' }),
    P.ell({ x: 0.4 - 4 * t, y: 8.6 + t, z: 11 - 7 * t, rx: 4.6, ry: 3.9, rz: 5 - 2 * t, ramp: C.armor, group: 'shR' }),
    P.ell({ x: 1.6 - 14 * t, y: t * 1.5, z: 13.5 - 11 * t, rx: 5.1, ry: 4.9, rz: 5.4, ramp: C.armorLight, group: 'helm' }),
    P.box({ x: 5.5 - 19 * t, y: t * 1.5, hx: 1.3, hy: 3, z: 17 - 12 * t, h: 1.6, bevel: 0.6, group: 'visor', ...(visorOff ? { ramp: C.gunmetal } : { emit: C.eCyan, emitIdx: f % 2 ? 1 : 2 }) }),
  ];
}

module.exports = { WEAPONS, POSES, LEG_ANIMS, DEATH_FRAMES, torso, legs, death };
