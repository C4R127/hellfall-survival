'use strict';
/*
 * Bestiario. Cada criatura define su modelo en función de (anim, frame, elite).
 * Animaciones comunes: idle, move, windup (preparación), attack, hurt, death.
 * La variante élite comparte la familia: placas óseas extra y energía dorada.
 */
const { P, xform } = require('../lib/model');
const C = require('./palette');

const TAU = Math.PI * 2;
const sin = Math.sin, cos = Math.cos;
const lerp = (a, b, t) => a + (b - a) * t;

/* ================= ERRANTE (enemigo básico) ================= */
function errante(anim, f, elite) {
  const glow = elite ? C.eGold : C.eRed;
  let ph = 0, swingR = 0, swingL = 0, crouch = 0, reachR = 0, reachL = 0, lean = 0, collapse = 0;
  if (anim === 'idle') { crouch = f ? 0.5 : 0; }
  if (anim === 'move') { ph = (f / 4) * TAU; swingR = sin(ph) * 3; swingL = -sin(ph) * 2.4; lean = 0.6; }
  if (anim === 'windup') { reachR = -4 - f * 2; reachL = -3 - f * 1.5; crouch = 1.5; lean = -1; }
  if (anim === 'attack') { reachR = [6, 9, 4][f]; reachL = [3, 7, 3][f]; lean = [2, 3, 1][f]; }
  if (anim === 'hurt') { lean = -2.5; reachR = -2; reachL = -2; }
  if (anim === 'death') collapse = Math.min(1, f / 4);
  const zk = 1 - collapse * 0.75;
  const spread = collapse * 4;
  const prims = [
    // piernas cortas
    P.cap({ x0: -4, y0: 3.4, z0: 6 * zk, x1: -5 + sin(ph) * 2.4, y1: 5.4 + spread, z1: 1.5, r0: 2.4, r1: 1.8, ramp: C.flesh, group: 'legR' }),
    P.cap({ x0: -4, y0: -3.4, z0: 6 * zk, x1: -5 - sin(ph) * 2.4, y1: -5.4 - spread, z1: 1.5, r0: 2.4, r1: 1.8, ramp: C.flesh, group: 'legL' }),
    // espalda encorvada
    P.ell({ x: -1 + lean * 0.5, y: 0, z: 4 * zk - crouch, rx: 7.4 + collapse * 2, ry: 6.6 + collapse * 1.5, rz: 7 * zk, ramp: C.flesh, group: 'back' }),
    // nódulos óseos de la columna
    ...[-4.5, -2, 0.5].map((x, i) => P.ell({ x: x + lean * 0.5, y: 0.4 * (i % 2 ? 1 : -1), z: (10 - i * 0.3) * zk - crouch, rx: 1.3, rz: 1.2, ramp: C.bone, group: 'spine' + i })),
    // zonas de mutación luminosas
    P.ell({ x: -3 + lean * 0.5, y: 3.4, z: 8 * zk - crouch, rx: 1.4, emit: glow, emitIdx: collapse > 0.8 ? 0 : 2 }),
    P.ell({ x: 0 + lean * 0.5, y: -3.6, z: 8.4 * zk - crouch, rx: 1, emit: glow, emitIdx: collapse > 0.8 ? 0 : 3 }),
    // brazo derecho largo y brazo izquierdo mutado (asimétricos)
    P.cap({ x0: 2.5 + lean, y0: 5, z0: 8 * zk, x1: 8 + reachR + swingR, y1: 8.4 + spread, z1: 3 * zk, r0: 2.2, r1: 1.5, ramp: C.flesh, group: 'armR' }),
    P.cap({ x0: 2.5 + lean, y0: -5, z0: 8 * zk, x1: 6.5 + reachL + swingL, y1: -8.6 - spread, z1: 3 * zk, r0: 3.2, r1: 2.4, ramp: C.fleshPale, group: 'armL', bias: -1 }),
    // garras
    ...[-0.9, 0, 0.9].map((o, i) => P.cap({ x0: 8 + reachR + swingR, y0: 8.4 + o + spread, z0: 3 * zk, x1: 11 + reachR + swingR, y1: 8.8 + o * 1.6 + spread, z1: 2 * zk, r0: 0.75, r1: 0.3, ramp: C.bone, group: 'clawR' + i })),
    ...[-1.1, 0, 1.1].map((o, i) => P.cap({ x0: 6.5 + reachL + swingL, y0: -8.6 + o - spread, z0: 3 * zk, x1: 10 + reachL + swingL, y1: -9 + o * 1.8 - spread, z1: 2 * zk, r0: 0.9, r1: 0.3, ramp: C.bone, group: 'clawL' + i })),
    // cabeza pequeña
    P.ell({ x: 6.6 + lean, y: 0.6, z: 6.5 * zk - crouch, rx: 3, ry: 2.7, rz: 3, ramp: C.fleshPale, group: 'head' }),
    P.ell({ x: 9, y: -0.6, z: 7.6 * zk - crouch, rx: 0.7, emit: C.eYellow, emitIdx: collapse > 0.6 ? 0 : 2 }),
    P.ell({ x: 9, y: 1.8, z: 7.6 * zk - crouch, rx: 0.7, emit: C.eYellow, emitIdx: collapse > 0.6 ? 0 : 2 }),
  ];
  if (elite) prims.push(
    P.plate({ pts: [[-6, -4], [-1, -5], [1, 0], [-1, 5], [-6, 4], [-8, 0]], z: 7.5 * zk - crouch, h: 3, bevel: 1.2, ramp: C.bone, group: 'plate' }),
    P.box({ x: -3.5, y: 0, hx: 0.6, hy: 4, z: 10.4 * zk - crouch, h: 0.4, emit: C.eGold, emitIdx: 2 }),
  );
  return prims;
}

/* ================= ACECHADOR (enemigo rápido) ================= */
function acechador(anim, f, elite) {
  const eye = elite ? C.eGold : C.eMagenta;
  let ph = 0, crouch = 0, claw = 0, collapse = 0, stretch = 0;
  if (anim === 'idle') ph = f * 0.4;
  if (anim === 'move') { ph = (f / 6) * TAU; stretch = sin(ph * 2) * 0.6; }
  if (anim === 'windup') { crouch = 1.5 + f; claw = -3 - f * 1.5; }
  if (anim === 'attack') { claw = [7, 4][f]; stretch = [2, 1][f]; }
  if (anim === 'hurt') { claw = -2; stretch = -1.5; }
  if (anim === 'death') collapse = Math.min(1, f / 4);
  const zk = 1 - collapse * 0.7;
  const z = 6.5 * zk - crouch * 0.6;
  const prims = [];
  // patas largas (pares delantero y trasero)
  const legs = [[3.5, 1, 8, 9.5, 0], [-3, -1, -7, -10, Math.PI]];
  for (const [hx, kx, fx0, fx1, off] of legs) {
    for (const s of [1, -1]) {
      const sw = anim === 'move' ? sin(ph + off + (s > 0 ? 0 : Math.PI)) * 3.4 : 0;
      const curl = collapse * 5;
      const knee = [hx + kx + sw * 0.5 - (s * 0) , s * (7.5 - curl), 9 * zk];
      const foot = [fx1 * (1 - collapse * 0.5) + sw, s * (9.5 - curl * 1.2), 0.8];
      prims.push(
        P.cap({ x0: hx, y0: s * 2.2, z0: z, x1: knee[0], y1: knee[1], z1: knee[2], r0: 1.3, r1: 1, ramp: C.chitin, group: 'th' + hx + s }),
        P.cap({ x0: knee[0], y0: knee[1], z0: knee[2], x1: foot[0], y1: foot[1], z1: foot[2], r0: 1, r1: 0.5, ramp: C.chitin, bias: 1, group: 'sh' + hx + s }),
      );
    }
  }
  prims.push(
    // cola
    P.cap({ x0: -6, y0: 0, z0: z, x1: -12 + stretch, y1: anim === 'move' ? sin(ph) * 2 : 0, z1: 3 * zk, r0: 1.6, r1: 0.5, ramp: C.chitin, group: 'tail' }),
    // cuerpo bajo y alargado con espalda arqueada
    P.ell({ x: stretch * 0.5, y: 0, z: z - 2, rx: 7.4 + stretch * 0.5, ry: 3.4, rz: 4.5, ramp: C.chitin, group: 'body' }),
    ...[-3.5, -0.5, 2.5].map((x, i) => P.ell({ x: x + stretch * 0.5, y: 0, z: z + 1 - crouch * 0.3, rx: 1.7, ry: 2.2, rz: 1.6, ramp: C.chitin, bias: 1, group: 'seg' + i, spec: true })),
    ...[-2, 1].map((x, i) => P.cap({ x0: x, y0: 0, z0: z + 2.4, x1: x - 1.6, y1: 0, z1: z + 4.4, r0: 0.8, r1: 0.2, ramp: C.bone, group: 'spike' + i })),
    // cabeza estrecha
    P.ell({ x: 8.6 + stretch, y: 0, z: z - 0.5, rx: 3.4, ry: 1.9, rz: 2.2, ramp: C.chitin, bias: 1, group: 'head' }),
    P.ell({ x: 10.6 + stretch, y: -0.9, z: z + 0.8, rx: 0.65, emit: eye, emitIdx: collapse > 0.6 ? 0 : 2 }),
    P.ell({ x: 10.6 + stretch, y: 0.9, z: z + 0.8, rx: 0.65, emit: eye, emitIdx: collapse > 0.6 ? 0 : 2 }),
  );
  // garras visibles (guadañas)
  for (const s of [1, -1]) {
    prims.push(
      P.cap({ x0: 4.5, y0: s * 2.6, z0: z + 0.5, x1: 9 + claw, y1: s * (4.6 + (claw < 0 ? 1.5 : 0)), z1: z + 1.5, r0: 1.1, r1: 0.8, ramp: C.chitin, bias: 1, group: 'arm' + s }),
      P.cap({ x0: 9 + claw, y0: s * (4.6 + (claw < 0 ? 1.5 : 0)), z0: z + 1.5, x1: 13 + claw, y1: s * (2.4 + (claw < 0 ? 2 : 0)), z1: z, r0: 0.9, r1: 0.2, ramp: C.bone, group: 'claw' + s, spec: true }),
    );
  }
  if (elite) prims.push(P.box({ x: 0, y: 0, hx: 4, hy: 0.5, z: z + 2.2, h: 0.4, emit: C.eGold, emitIdx: 2 }));
  return prims;
}

/* ================= COLOSO (tanque) ================= */
function coloso(anim, f, elite) {
  const core = elite ? C.eGold : C.eOrange;
  let ph = 0, roll = 0, fistZ = 8, fistX = 15, crouch = 0, collapse = 0, fistIn = 0;
  if (anim === 'idle') crouch = f ? 0.6 : 0;
  if (anim === 'move') { ph = (f / 4) * TAU; roll = sin(ph) * 1.4; }
  if (anim === 'windup') { fistZ = 14 + f * 5; fistX = 9 - f * 2.5; crouch = -1 - f; fistIn = f * 1.5; }
  if (anim === 'attack') { fistZ = [5, 3, 6][f]; fistX = [19, 20, 17][f]; fistIn = [5, 6, 4][f]; crouch = [2, 2.5, 1][f]; }
  if (anim === 'hurt') { crouch = -1.5; fistX = 12; }
  if (anim === 'death') collapse = Math.min(1, f / 4);
  const zk = 1 - collapse * 0.6;
  const prims = [
    // piernas gruesas
    P.cap({ x0: -8, y0: 8 + roll, z0: 9 * zk, x1: -10 + sin(ph) * 3, y1: 10 + roll, z1: 2, r0: 4.4, r1: 3.6, ramp: C.hide, group: 'legR' }),
    P.cap({ x0: -8, y0: -8 + roll, z0: 9 * zk, x1: -10 - sin(ph) * 3, y1: -10 + roll, z1: 2, r0: 4.4, r1: 3.6, ramp: C.hide, group: 'legL' }),
    // cuerpo masivo
    P.ell({ x: -2, y: roll, z: 6 * zk - crouch, rx: 15 + collapse * 3, ry: 15.5 + collapse * 2, rz: 13 * zk, ramp: C.hide, group: 'body' }),
    // energía interna entre placas
    P.box({ x: -4, y: roll, hx: 9, hy: 1, z: 15 * zk - crouch, h: 2.6, emit: core, emitIdx: collapse > 0.8 ? 0 : 2 }),
    P.box({ x: -4, y: roll, hx: 1, hy: 9, z: 15 * zk - crouch, h: 2.6, emit: core, emitIdx: collapse > 0.8 ? 0 : 1 }),
  ];
  // placas de protección de la espalda
  const plates = [
    [[-13, -11], [-5, -11.5], [-5, -1.6], [-13, -1.5], [-15, -6]],
    [[-13, 11], [-5, 11.5], [-5, 1.6], [-13, 1.5], [-15, 6]],
    [[-3, -11.5], [5, -9.5], [6, -1.6], [-3, -1.6]],
    [[-3, 11.5], [5, 9.5], [6, 1.6], [-3, 1.6]],
  ];
  plates.forEach((pts, i) => prims.push(P.plate({ pts: pts.map(([x, y]) => [x, y + roll]), z: 12 * zk - crouch, h: 5, bevel: 1.8, ramp: C.plates, group: 'pl' + i, spec: true })));
  if (elite) prims.push(P.plate({ pts: [[-11, -3], [3, -3], [5, 0], [3, 3], [-11, 3]], z: 14 * zk - crouch, h: 5, bevel: 1.5, ramp: C.bone, group: 'plE' }));
  prims.push(
    // cabeza protegida
    P.ell({ x: 12 - crouch * 0.5, y: roll, z: 9 * zk - crouch, rx: 5.6, ry: 5.8, rz: 5.4, ramp: C.hide, bias: 1, group: 'head' }),
    P.plate({ pts: [[9, -5.2], [15.5, -3.6], [17, 0], [15.5, 3.6], [9, 5.2], [8, 0]].map(([x, y]) => [x - crouch * 0.5, y + roll]), z: 12.5 * zk - crouch, h: 2.4, bevel: 1.2, ramp: C.plates, group: 'helm', spec: true }),
    P.ell({ x: 16.6 - crouch * 0.5, y: -2 + roll, z: 12 * zk - crouch, rx: 0.8, emit: C.eRed, emitIdx: collapse > 0.6 ? 0 : 2 }),
    P.ell({ x: 16.6 - crouch * 0.5, y: 2 + roll, z: 12 * zk - crouch, rx: 0.8, emit: C.eRed, emitIdx: collapse > 0.6 ? 0 : 2 }),
  );
  // brazos gruesos con puños blindados
  for (const s of [1, -1]) {
    const fx = (fistX + (anim === 'move' ? s * sin(ph) * 2.5 : 0)) * (1 - collapse * 0.4);
    const fy = s * (15 - fistIn) + roll;
    prims.push(
      P.cap({ x0: 3, y0: s * 12 + roll, z0: 16 * zk - crouch, x1: fx, y1: fy, z1: fistZ * zk, r0: 4.6, r1: 3.8, ramp: C.hide, group: 'arm' + s }),
      P.ell({ x: fx + 1.5, y: fy, z: fistZ * zk, rx: 4.8, ry: 4.4, rz: 4.2, ramp: C.plates, group: 'fist' + s, spec: true }),
      P.box({ x: fx + 3.5, y: fy, hx: 1.2, hy: 3.4, z: fistZ * zk + 1, h: 2.4, ramp: C.plates, bias: 1, group: 'fist' + s, bevel: 0.6 }),
    );
  }
  return prims;
}

/* ================= TEJEDOR (a distancia) ================= */
function tejedor(anim, f, elite) {
  const glow = elite ? C.eGold : C.eToxic;
  let ph = 0, swell = 0, recoil = 0, collapse = 0, conv = 0;
  if (anim === 'idle') swell = f * 0.4;
  if (anim === 'move') ph = (f / 4) * TAU;
  if (anim === 'windup') { swell = 0.6 + f * 0.7; conv = f * 0.8; }
  if (anim === 'attack') { recoil = [-2.5, -1][f]; swell = [1.6, 0.5][f]; }
  if (anim === 'hurt') recoil = -2;
  if (anim === 'death') collapse = Math.min(1, f / 4);
  const zk = 1 - collapse * 0.7;
  const prims = [];
  // patas traseras finas (aracnoides)
  for (const [hx, ang] of [[-2, 1.9], [-4.5, 2.4]]) for (const s of [1, -1]) {
    const sw = anim === 'move' ? sin(ph + hx + (s > 0 ? 0 : Math.PI)) * 0.35 : 0;
    const a = s * (ang + sw);
    const kx = hx + cos(a) * 6, ky = sin(a) * 6;
    prims.push(
      P.cap({ x0: hx, y0: s * 1.6, z0: 7 * zk, x1: kx, y1: ky, z1: 8 * zk, r0: 0.9, r1: 0.8, ramp: C.sick, group: 'l' + hx + s }),
      P.cap({ x0: kx, y0: ky, z0: 8 * zk, x1: kx + cos(a) * 3.4 * (1 - collapse * 0.6), y1: ky + sin(a) * 3.4 * (1 - collapse * 0.6), z1: 0.6, r0: 0.8, r1: 0.4, ramp: C.sick, bias: 1, group: 'f' + hx + s }),
    );
  }
  prims.push(
    // cuerpo delgado
    P.ell({ x: -1 + recoil * 0.5, y: 0, z: 3 * zk, rx: 7.6, ry: 5.2, rz: 6.5 * zk, ramp: C.sick, group: 'body' }),
    P.plate({ pts: [[-6, -4], [1, -5], [3, 0], [1, 5], [-6, 4], [-8, 0]].map(([x, y]) => [x + recoil * 0.5, y]), z: 7 * zk, h: 2, bevel: 1, ramp: C.sick, bias: 1, group: 'carapace' }),
    // núcleo energético dorsal con conductos
    P.ell({ x: -4.6 + recoil * 0.5, y: 0, z: 9 * zk, rx: 3.9 + swell, ry: 3.6 + swell, rz: 3, emit: glow, emitIdx: collapse > 0.8 ? 0 : undefined }),
    P.cap({ x0: -3, y0: -1.4, z0: 9 * zk, x1: 4, y1: -2.4, z1: 8.4 * zk, r0: 0.6, r1: 0.5, emit: glow, emitIdx: collapse > 0.8 ? 0 : 1 }),
    P.cap({ x0: -3, y0: 1.4, z0: 9 * zk, x1: 4, y1: 2.4, z1: 8.4 * zk, r0: 0.6, r1: 0.5, emit: glow, emitIdx: collapse > 0.8 ? 0 : 1 }),
    // cabeza
    P.ell({ x: 6 + recoil, y: 0, z: 5 * zk, rx: 3, ry: 2.8, rz: 2.6, ramp: C.sick, bias: 1, group: 'head' }),
    P.ell({ x: 8.2 + recoil, y: -1, z: 7 * zk, rx: 0.6, emit: glow, emitIdx: 3 }), P.ell({ x: 8.2 + recoil, y: 1, z: 7 * zk, rx: 0.6, emit: glow, emitIdx: 3 }),
  );
  // extremidades delanteras-cañón con boquillas luminosas
  for (const s of [1, -1]) {
    const tipY = s * (2.6 - conv);
    prims.push(
      P.cap({ x0: 2.5, y0: s * 2.8, z0: 7 * zk, x1: 11 + recoil, y1: tipY, z1: 6.5 * zk, r0: 1.7, r1: 1.2, ramp: C.sick, group: 'can' + s }),
      P.ell({ x: 6 + recoil * 0.5, y: s * 2.8, z: 8.2 * zk, rx: 1.6, ry: 1.1, rz: 1, ramp: C.bone, group: 'canR' + s }),
      P.ell({ x: 11.4 + recoil, y: tipY, z: 6.8 * zk, rx: 1.2 + swell * 0.3, emit: glow, emitIdx: collapse > 0.6 ? 0 : (anim === 'attack' && f === 0 ? 3 : 2) }),
    );
  }
  if (elite) prims.push(P.plate({ pts: [[-2, -3], [3, -2.5], [3, 2.5], [-2, 3]], z: 7.8 * zk, h: 1.6, bevel: 0.8, ramp: C.bone, group: 'eplate' }));
  return prims;
}

/* ================= INCINERADOR (explosivo) ================= */
function incinerador(anim, f, elite) {
  let ph = 0, swell = 0, heat = 1, collapse = 0, wob = 0;
  if (anim === 'idle') swell = f * 0.3;
  if (anim === 'move') { ph = (f / 4) * TAU; wob = sin(ph) * 0.6; }
  if (anim === 'windup') { swell = 0.8 + f * 0.7; heat = 2 + (f % 2); }
  if (anim === 'attack') { swell = 3; heat = 3; }
  if (anim === 'hurt') { wob = -1; heat = 2; }
  if (anim === 'death') collapse = Math.min(1, f / 3);
  const crack = heat >= 3 ? C.eWhite : heat >= 2 ? C.eYellow : (elite ? C.eGold : C.eOrange);
  const R = 9.6 + swell;
  const prims = [];
  // patas pequeñas
  for (const [x, s] of [[3, 1], [3, -1], [-3.5, 1], [-3.5, -1]]) {
    const sw = anim === 'move' ? sin(ph + x + s) * 1.6 : 0;
    prims.push(P.cap({ x0: x, y0: s * 6, z0: 4, x1: x + 1 + sw, y1: s * (R + 0.6), z1: 0.6, r0: 1.6, r1: 1.1, ramp: C.char, group: 'leg' + x + s }));
  }
  prims.push(
    P.ell({ x: wob, y: 0, z: 1 - collapse * 4, rx: R, ry: R - 0.6, rz: (10 + swell) * (1 - collapse * 0.6), ramp: C.char, group: 'body' }),
  );
  // grietas de energía en el caparazón
  const cracks = [[-6, -4, -1, -6], [-1, -6, 4, -3], [2, 3, 6, 6], [-5, 5, -1, 2], [-7, 0, -4, 1]];
  cracks.forEach(([x0, y0, x1, y1], i) => prims.push(
    P.cap({ x0: x0 + wob, y0, x1: x1 + wob, y1, z0: (8.6 + swell * 0.6) * (1 - collapse * 0.6), z1: (8.6 + swell * 0.6) * (1 - collapse * 0.6), r0: 0.6 + heat * 0.12, r1: 0.5, emit: crack, emitIdx: 2 }),
  ));
  prims.push(
    // núcleo luminoso visible
    P.ell({ x: -1 + wob, y: 0, z: (10.5 + swell) * (1 - collapse * 0.6), rx: 2.6 + swell * 0.5 + heat * 0.3, rz: 1.5, emit: crack }),
    // cabeza pequeña
    P.ell({ x: 8.2 + swell * 0.6, y: 0, z: 5, rx: 2.6, ry: 2.4, rz: 2.2, ramp: C.char, bias: 1, group: 'head' }),
    P.ell({ x: 10.2 + swell * 0.6, y: -1, z: 6, rx: 0.6, emit: C.eYellow, emitIdx: 2 }),
    P.ell({ x: 10.2 + swell * 0.6, y: 1, z: 6, rx: 0.6, emit: C.eYellow, emitIdx: 2 }),
  );
  if (elite) prims.push(P.cyl({ x: -1 + wob, y: 0, r: 4.2, z: 9 + swell, h: 1.2, bevel: 0.8, ramp: C.plates, group: 'ring' }), P.ell({ x: -1 + wob, y: 0, z: 10.6 + swell, rx: 2.2, rz: 1, emit: C.eGold }));
  return prims;
}

/* ================= GUARDIÁN (especial) ================= */
function guardian(anim, f, elite) {
  const glow = elite ? C.eGold : C.eViolet;
  let rotA = 0, expand = 0, flare = 0, collapse = 0, ph = 0;
  if (anim === 'idle') rotA = f * 0.2;
  if (anim === 'move') { rotA = (f / 4) * (TAU / 6); ph = (f / 4) * TAU; }
  if (anim === 'windup') { expand = 1.5 + f * 1.4; flare = 1; rotA = f * 0.3; }
  if (anim === 'attack') { expand = [4, 2, 1][f]; flare = 2; rotA = f * 0.4; }
  if (anim === 'hurt') { expand = -1; }
  if (anim === 'death') collapse = Math.min(1, f / 4);
  const prims = [];
  // patas cortas
  for (const a of [0.9, -0.9, Math.PI]) {
    const sw = anim === 'move' ? sin(ph + a) * 1.5 : 0;
    prims.push(P.cap({ x0: cos(a) * 5, y0: sin(a) * 5, z0: 6, x1: cos(a) * 11 + sw, y1: sin(a) * 11, z1: 0.8, r0: 2, r1: 1.4, ramp: C.obsidian, group: 'leg' + a }));
  }
  // cuerpo hexagonal
  const hex = Array.from({ length: 6 }, (_, i) => [cos(i * TAU / 6 + 0.52) * 10.5, sin(i * TAU / 6 + 0.52) * 10.5]);
  prims.push(P.plate({ pts: hex, z: 6 - collapse * 5, h: 7 * (1 - collapse * 0.5), bevel: 2, ramp: C.obsidian, group: 'body', spec: true }));
  // placas externas orbitales
  for (let i = 0; i < 4; i++) {
    const a = rotA + i * (TAU / 4) + Math.PI / 4;
    const r = 13 + expand + collapse * 6;
    const cx = cos(a) * r, cy = sin(a) * r;
    const pa = a + Math.PI / 2;
    const pts = [[-4, -1.6], [4, -1.6], [3, 1.6], [-3, 1.6]].map(([x, y]) => [cx + x * cos(pa) - y * sin(pa), cy + x * sin(pa) + y * cos(pa)]);
    prims.push(P.plate({ pts, z: (12 - collapse * 11), h: 2.4, bevel: 0.9, ramp: elite ? C.bone : C.plates, group: 'op' + i, spec: true }));
    prims.push(P.ell({ x: cos(a) * (r - 2.2), y: sin(a) * (r - 2.2), z: 14.6 - collapse * 12, rx: 0.7, emit: glow, emitIdx: collapse > 0.5 ? 0 : 2 }));
  }
  // núcleo energético y visor frontal
  prims.push(
    P.ell({ x: -1, y: 0, z: 11 - collapse * 6, rx: 3.6 + flare * 0.6, rz: 2.6, emit: glow, emitIdx: collapse > 0.8 ? 0 : undefined }),
    P.box({ x: 8.6, y: 0, hx: 1.4, hy: 4.4, z: 10 - collapse * 6, h: 2.4, bevel: 0.8, ramp: C.obsidian, bias: 1, group: 'visor' }),
    P.box({ x: 9.8, y: 0, hx: 0.4, hy: 3, z: 12.2 - collapse * 6, h: 0.4, emit: glow, emitIdx: flare > 1 ? 3 : 2 }),
  );
  return prims;
}


/* ================= ESPECTRO (dimensional) ================= */
const SPECTRAL = ['#06101a', '#0c1e2c', '#143044', '#1e4a62', '#2e6a86', '#4a90aa'];
const ICE = ['#1a2a38', '#2e4a60', '#4a7090', '#7aa8c8', '#b8d8ec', '#e8f6ff'];
function espectro(anim, f, elite) {
  const eye = elite ? C.eGold : C.eCyan;
  let bob = 0, flutter = 0, armR = 0, armL = 0, lean = 0, fade = 0;
  if (anim === 'idle') bob = f * 0.8;
  if (anim === 'move') { flutter = Math.sin((f / 4) * TAU) * 1.6; bob = (f % 2) * 0.6; lean = 1; }
  if (anim === 'windup') { armR = -4 - f * 2; armL = -4 - f * 2; lean = -1; }
  if (anim === 'attack') { armR = [7, 9, 4][f]; armL = [5, 9, 3][f]; lean = [2, 3, 1][f]; }
  if (anim === 'hurt') { lean = -2.5; armR = armL = -2; }
  if (anim === 'death') fade = Math.min(1, f / 5);
  const zk = 1 - fade * 0.7, z = 8 + bob;
  const prims = [
    // sudario desgarrado que ondea hacia atrás
    P.plate({ pts: [[2, -6], [-6, -7 + flutter], [-13, -4 - flutter], [-11, 0], [-14, 4 + flutter], [-6, 7 - flutter], [2, 6]], z: (z - 3) * zk, h: 2.5, bevel: 1, ramp: SPECTRAL, group: 'shroud' }),
    P.ell({ x: lean * 0.5, y: 0, z: (z - 2) * zk, rx: 6, ry: 6.4, rz: 5 * zk, ramp: SPECTRAL, bias: 1, group: 'body' }),
    // capucha
    P.ell({ x: 5 + lean, y: 0, z: (z + 1) * zk, rx: 3.6, ry: 3.4, rz: 3.4, ramp: SPECTRAL, bias: 1, group: 'hood' }),
    P.ell({ x: 7.6 + lean, y: -1.1, z: (z + 2.6) * zk, rx: 0.7, emit: eye, emitIdx: fade > 0.6 ? 0 : 3 }),
    P.ell({ x: 7.6 + lean, y: 1.1, z: (z + 2.6) * zk, rx: 0.7, emit: eye, emitIdx: fade > 0.6 ? 0 : 3 }),
    P.ell({ x: -2, y: 0, z: (z + 2.5) * zk, rx: 1.6, emit: eye, emitIdx: fade > 0.6 ? 0 : 1 }),
  ];
  // brazos-guadaña de hielo
  for (const [s, ex] of [[1, armR], [-1, armL]]) {
    prims.push(
      P.cap({ x0: 2, y0: s * 5, z0: z * zk, x1: 7 + ex, y1: s * 8.5, z1: (z - 1) * zk, r0: 1.4, r1: 1, ramp: SPECTRAL, group: 'arm' + s }),
      P.cap({ x0: 7 + ex, y0: s * 8.5, z0: (z - 1) * zk, x1: 12 + ex, y1: s * 4.5, z1: (z - 2) * zk, r0: 1.1, r1: 0.2, ramp: ICE, group: 'blade' + s, spec: true }),
    );
  }
  if (elite) prims.push(P.box({ x: 0, y: 0, hx: 3, hy: 0.5, z: (z + 3) * zk, h: 0.4, emit: C.eGold, emitIdx: 2 }));
  return fade > 0 ? xform(prims, { s: 1 - fade * 0.45 }) : prims;
}

/* ================= ARTILLERO (artillería) ================= */
const SLAG = ['#140a06', '#2a140a', '#43200e', '#5e3014', '#7e441e', '#a05e2a'];
function artillero(anim, f, elite) {
  let ph = 0, crouch = 0, recoil = 0, heat = 1, collapse = 0, tubeUp = 0;
  if (anim === 'idle') crouch = f * 0.4;
  if (anim === 'move') ph = (f / 4) * TAU;
  if (anim === 'windup') { crouch = 1 + f; heat = 2; tubeUp = 1 + f; }
  if (anim === 'attack') { recoil = [-2.5, -1][f]; heat = 3; tubeUp = 2; }
  if (anim === 'hurt') recoil = -2;
  if (anim === 'death') collapse = Math.min(1, f / 4);
  const zk = 1 - collapse * 0.6;
  const glow = heat >= 3 ? C.eYellow : elite ? C.eGold : C.eOrange;
  const prims = [];
  // seis patas cortas
  for (const [x, s, o] of [[5, 1, 0], [5, -1, 1], [0, 1, 1], [0, -1, 0], [-5, 1, 0], [-5, -1, 1]]) {
    const sw = anim === 'move' ? Math.sin(ph + o * Math.PI) * 2 : 0;
    prims.push(P.cap({ x0: x * 0.8, y0: s * 7, z0: 5 * zk, x1: x + sw, y1: s * 13 * (1 - collapse * 0.2), z1: 0.8, r0: 1.6, r1: 1, ramp: C.chitin, group: 'leg' + x + s }));
  }
  prims.push(
    // caparazón ancho
    P.ell({ x: recoil, y: 0, z: 2 * zk - crouch * 0.5, rx: 11.5, ry: 12, rz: 8 * zk, ramp: SLAG, group: 'shell' }),
    P.plate({ pts: [[-8, -9], [3, -10], [8, -5], [8, 5], [3, 10], [-8, 9], [-11, 0]].map(([x, y]) => [x + recoil, y]), z: 7.5 * zk - crouch * 0.5, h: 2.5, bevel: 1.4, ramp: C.plates, group: 'plates', spec: true }),
    // mortero dorsal con interior incandescente
    P.cyl({ x: -2 + recoil - tubeUp * 0.3, y: 0, r: 4.6, z: 10 * zk, h: 4 + tubeUp, bevel: 1.2, ramp: C.gunmetal, group: 'tube' }),
    P.cyl({ x: -2 + recoil - tubeUp * 0.3, y: 0, r: 2.8, z: 14.2 * zk + tubeUp, h: 0.5, bevel: 0, emit: glow, emitIdx: collapse > 0.7 ? 0 : heat >= 2 ? 3 : 2 }),
    // cabeza y pinzas
    P.ell({ x: 10 + recoil, y: 0, z: 3 * zk, rx: 3.4, ry: 4, rz: 3, ramp: SLAG, bias: 1, group: 'head' }),
    P.ell({ x: 12.6 + recoil, y: -1.6, z: 5 * zk, rx: 0.7, emit: C.eRed, emitIdx: 2 }),
    P.ell({ x: 12.6 + recoil, y: 1.6, z: 5 * zk, rx: 0.7, emit: C.eRed, emitIdx: 2 }),
    P.cap({ x0: 11 + recoil, y0: -3.4, z0: 2, x1: 15 + recoil, y1: -2, z1: 2, r0: 1.3, r1: 0.4, ramp: C.bone, group: 'p1' }),
    P.cap({ x0: 11 + recoil, y0: 3.4, z0: 2, x1: 15 + recoil, y1: 2, z1: 2, r0: 1.3, r1: 0.4, ramp: C.bone, group: 'p2' }),
  );
  if (elite) prims.push(P.box({ x: 3 + recoil, y: 0, hx: 1, hy: 9, z: 10 * zk, h: 0.5, emit: C.eGold, emitIdx: 2 }));
  return prims;
}

/* ================= PARÁSITO (enjambre) ================= */
function parasito(anim, f, elite) {
  let ph = 0, lunge = 0, collapse = 0;
  if (anim === 'move') ph = (f / 4) * TAU;
  if (anim === 'windup') lunge = -1 - f;
  if (anim === 'attack') lunge = [3, 1][f];
  if (anim === 'hurt') lunge = -1.5;
  if (anim === 'death') collapse = Math.min(1, f / 3);
  const zk = 1 - collapse * 0.6;
  const prims = [];
  for (const [x, s, o] of [[2, 1, 0], [2, -1, 1], [0, 1, 1], [0, -1, 0], [-2, 1, 0], [-2, -1, 1]]) {
    const sw = anim === 'move' ? Math.sin(ph + o * Math.PI) * 1.6 : 0;
    const curl = collapse * 3;
    prims.push(P.cap({ x0: x, y0: s * 2.5, z0: 3 * zk, x1: x * 1.6 + sw, y1: s * (7 - curl), z1: 0.5, r0: 0.7, r1: 0.4, ramp: C.chitin, bias: 1, group: 'l' + x + s }));
  }
  prims.push(
    P.ell({ x: lunge * 0.5, y: 0, z: 1 * zk, rx: 5.2, ry: 4.4, rz: 3.6 * zk, ramp: C.flesh, group: 'body' }),
    P.ell({ x: -1 + lunge * 0.5, y: 0, z: 3.5 * zk, rx: 1.6, emit: elite ? C.eGold : C.eRed, emitIdx: collapse > 0.6 ? 0 : 2 }),
    P.cap({ x0: -3, y0: -2, z0: 3.6 * zk, x1: 1, y1: -2.2, z1: 3.6 * zk, r0: 0.6, ramp: C.bone, group: 'r1' }),
    P.cap({ x0: -3, y0: 2, z0: 3.6 * zk, x1: 1, y1: 2.2, z1: 3.6 * zk, r0: 0.6, ramp: C.bone, group: 'r2' }),
    P.ell({ x: 5 + lunge, y: 0, z: 1.5 * zk, rx: 2.2, ry: 2, rz: 1.8, ramp: C.flesh, bias: 1, group: 'head' }),
    P.cap({ x0: 6.5 + lunge, y0: -1, z0: 1.5, x1: 8.5 + lunge, y1: -0.3, z1: 1.5, r0: 0.5, r1: 0.2, ramp: C.bone, group: 'm1' }),
    P.cap({ x0: 6.5 + lunge, y0: 1, z0: 1.5, x1: 8.5 + lunge, y1: 0.3, z1: 1.5, r0: 0.5, r1: 0.2, ramp: C.bone, group: 'm2' }),
  );
  return prims;
}

const ENEMY_MODELS = {
  crawler: { fn: errante, size: 32, scale: 1, anims: { idle: 2, move: 4, windup: 2, attack: 3, hurt: 1, death: 6 }, fps: { idle: 3, move: 9, windup: 8, attack: 14, hurt: 1, death: 14 } },
  stalker: { fn: acechador, size: 34, scale: 1, anims: { idle: 2, move: 6, windup: 2, attack: 2, hurt: 1, death: 6 }, fps: { idle: 3, move: 16, windup: 10, attack: 14, hurt: 1, death: 14 } },
  brute: { fn: coloso, size: 56, scale: 1, anims: { idle: 2, move: 4, windup: 3, attack: 3, hurt: 1, death: 6 }, fps: { idle: 2, move: 6, windup: 5, attack: 12, hurt: 1, death: 10 } },
  spitter: { fn: tejedor, size: 36, scale: 1.15, anims: { idle: 2, move: 4, windup: 3, attack: 2, hurt: 1, death: 6 }, fps: { idle: 3, move: 8, windup: 8, attack: 10, hurt: 1, death: 12 } },
  bloater: { fn: incinerador, size: 34, scale: 1, anims: { idle: 2, move: 4, windup: 4, attack: 1, hurt: 1, death: 4 }, fps: { idle: 3, move: 8, windup: 10, attack: 1, hurt: 1, death: 14 } },
  warlock: { fn: guardian, size: 44, scale: 1, anims: { idle: 2, move: 4, windup: 3, attack: 3, hurt: 1, death: 6 }, fps: { idle: 3, move: 6, windup: 6, attack: 10, hurt: 1, death: 10 } },
  phantom: { fn: espectro, size: 36, scale: 1, anims: { idle: 2, move: 4, windup: 2, attack: 3, hurt: 1, death: 6 }, fps: { idle: 3, move: 8, windup: 8, attack: 14, hurt: 1, death: 12 } },
  mortar: { fn: artillero, size: 40, scale: 1, anims: { idle: 2, move: 4, windup: 3, attack: 2, hurt: 1, death: 6 }, fps: { idle: 2, move: 7, windup: 5, attack: 10, hurt: 1, death: 10 } },
  swarm: { fn: parasito, size: 22, scale: 1, anims: { idle: 2, move: 4, windup: 2, attack: 2, hurt: 1, death: 4 }, fps: { idle: 4, move: 16, windup: 10, attack: 14, hurt: 1, death: 14 } },
};

module.exports = { ENEMY_MODELS };
