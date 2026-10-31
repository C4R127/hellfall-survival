'use strict';
/*
 * Rasterizador de "pixel art volumétrico".
 * Cada sprite se describe con primitivas 3D sencillas en espacio local
 * (x = hacia delante, y = lado derecho, z = altura). Para cada orientación se
 * proyectan desde arriba, se sombrean con una luz FIJA del mundo (arriba-izquierda),
 * se cuantizan a la rampa de su material (sombreado por bloques) y se contornean.
 * Así las 8/32 direcciones comparten iluminación coherente sin rotar bitmaps.
 */
const { Img, hex, darken } = require('./image');

const L = (() => { const v = [-0.5, -0.65, 0.75]; const m = Math.hypot(...v); return v.map((c) => c / m); })();

/* ---------------- primitivas ---------------- */
const P = {
  /** Elipsoide. x,y,z centro; rx,ry,rz radios; yaw giro local. */
  ell: (o) => ({ t: 'ell', rz: o.rz ?? Math.min(o.rx, o.ry ?? o.rx), ry: o.ry ?? o.rx, yaw: 0, z: 0, ...o }),
  /** Cápsula/cono entre dos puntos 3D con radio r0→r1. rz = aplastamiento vertical (1 = redonda). */
  cap: (o) => ({ t: 'cap', z0: 0, z1: o.z0 ?? 0, r1: o.r0, rzk: 1, ...o }),
  /** Caja orientada con bisel. z = base, h = altura. */
  box: (o) => ({ t: 'box', yaw: 0, z: 0, bevel: 1, ...o }),
  /** Cilindro vertical con bisel en el borde superior. */
  cyl: (o) => ({ t: 'cyl', z: 0, bevel: 1, ...o }),
  /** Placa poligonal biselada. pts = [[x,y],...] */
  plate: (o) => ({ t: 'plate', z: 0, bevel: 1, ...o }),
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function bounds(p) {
  switch (p.t) {
    case 'ell': return [p.x, p.y, Math.max(p.rx, p.ry) + 1];
    case 'cap': return [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, Math.hypot(p.x1 - p.x0, p.y1 - p.y0) / 2 + Math.max(p.r0, p.r1) + 1];
    case 'box': return [p.x, p.y, Math.hypot(p.hx, p.hy) + 1];
    case 'cyl': return [p.x, p.y, p.r + 1];
    case 'plate': {
      const cx = p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length, cy = p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length;
      return [cx, cy, Math.max(...p.pts.map((q) => Math.hypot(q[0] - cx, q[1] - cy))) + 1];
    }
  }
  return [0, 0, 0];
}

/** Evalúa la primitiva en (lx,ly). Devuelve [z, nx, ny, nz, w] o null. */
function evalPrim(p, lx, ly) {
  switch (p.t) {
    case 'ell': {
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      const dx = lx - p.x, dy = ly - p.y;
      const u = (dx * c + dy * s) / p.rx, v = (-dx * s + dy * c) / p.ry;
      const d = u * u + v * v;
      if (d > 1) return null;
      const w = Math.sqrt(1 - d);
      const n0 = (p.rz * u) / p.rx, n1 = (p.rz * v) / p.ry;
      return [p.z + p.rz * w, n0 * c - n1 * s, n0 * s + n1 * c, w, w];
    }
    case 'cap': {
      const ax = p.x1 - p.x0, ay = p.y1 - p.y0, L2 = ax * ax + ay * ay;
      let t = L2 ? ((lx - p.x0) * ax + (ly - p.y0) * ay) / L2 : 0;
      t = clamp(t, 0, 1);
      const cx = p.x0 + ax * t, cy = p.y0 + ay * t;
      const r = p.r0 + (p.r1 - p.r0) * t;
      const ex = lx - cx, ey = ly - cy, e2 = ex * ex + ey * ey;
      if (e2 > r * r || r <= 0) return null;
      const w = Math.sqrt(1 - e2 / (r * r));
      const rz = r * p.rzk;
      return [p.z0 + (p.z1 - p.z0) * t + rz * w, (rz * ex) / (r * r), (rz * ey) / (r * r), w, w];
    }
    case 'box': {
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      const dx = lx - p.x, dy = ly - p.y;
      const bx = dx * c + dy * s, by = -dx * s + dy * c;
      if (Math.abs(bx) > p.hx || Math.abs(by) > p.hy) return null;
      const ex = p.hx - Math.abs(bx), ey = p.hy - Math.abs(by);
      let z = p.z + p.h, n0 = 0, n1 = 0;
      const b = p.bevel;
      if (b > 0) {
        if (ex < b) { const k = 1 - ex / b; n0 = Math.sign(bx) * k * 0.9; z -= k * b * 0.6; }
        if (ey < b) { const k = 1 - ey / b; n1 = Math.sign(by) * k * 0.9; z -= k * b * 0.6; }
      }
      if (p.tilt) { n0 += p.tilt[0]; n1 += p.tilt[1]; z -= bx * p.tilt[0] + by * p.tilt[1]; }
      return [z, n0 * c - n1 * s, n0 * s + n1 * c, 1, Math.min(ex / p.hx, ey / p.hy)];
    }
    case 'cyl': {
      const dx = lx - p.x, dy = ly - p.y, d = Math.hypot(dx, dy);
      if (d > p.r) return null;
      let z = p.z + p.h, n0 = 0, n1 = 0;
      const e = p.r - d;
      if (p.bevel > 0 && e < p.bevel && d > 0) {
        const k = 1 - e / p.bevel;
        n0 = (dx / d) * k * 0.9; n1 = (dy / d) * k * 0.9; z -= k * p.bevel * 0.6;
      }
      return [z, n0, n1, 1, 1 - d / p.r];
    }
    case 'plate': {
      const pts = p.pts;
      let inside = false, best = Infinity, ox = 0, oy = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > ly) !== (yj > ly) && lx < ((xj - xi) * (ly - yi)) / (yj - yi) + xi) inside = !inside;
        const ax = xj - xi, ay = yj - yi, L2 = ax * ax + ay * ay;
        const t = clamp(L2 ? ((lx - xi) * ax + (ly - yi) * ay) / L2 : 0, 0, 1);
        const qx = xi + ax * t, qy = yi + ay * t, d = Math.hypot(lx - qx, ly - qy);
        if (d < best) { best = d; ox = qx - lx; oy = qy - ly; }
      }
      if (!inside) return null;
      let z = p.z + p.h, n0 = 0, n1 = 0;
      if (p.bevel > 0 && best < p.bevel && best > 0) {
        const k = 1 - best / p.bevel;
        n0 = (ox / best) * k * 0.9; n1 = (oy / best) * k * 0.9; z -= k * p.bevel * 0.6;
      }
      if (p.tilt) { n0 += p.tilt[0]; n1 += p.tilt[1]; }
      return [z, n0, n1, 1, clamp(best / 3, 0, 1)];
    }
  }
  return null;
}

/* ---------------- transformaciones de grupos ---------------- */
function rot(x, y, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }

/** Gira (yaw alrededor de ox,oy) y desplaza una lista de primitivas. Devuelve copias. */
function xform(prims, { dx = 0, dy = 0, dz = 0, yaw = 0, ox = 0, oy = 0, s = 1 } = {}) {
  const tp = (x, y) => { const [a, b] = rot((x - ox) * s, (y - oy) * s, yaw); return [a + ox + dx, b + oy + dy]; };
  return prims.map((p) => {
    const q = { ...p };
    switch (p.t) {
      case 'ell': case 'box': case 'cyl': {
        [q.x, q.y] = tp(p.x, p.y); q.z = p.z * s + dz;
        if (p.t !== 'cyl') q.yaw = (p.yaw || 0) + yaw;
        if (s !== 1) {
          for (const k of ['rx', 'ry', 'rz', 'hx', 'hy', 'h', 'r']) if (q[k] !== undefined) q[k] = p[k] * s;
        }
        break;
      }
      case 'cap':
        [q.x0, q.y0] = tp(p.x0, p.y0); [q.x1, q.y1] = tp(p.x1, p.y1);
        q.z0 = p.z0 * s + dz; q.z1 = p.z1 * s + dz; q.r0 = p.r0 * s; q.r1 = p.r1 * s;
        break;
      case 'plate':
        q.pts = p.pts.map(([x, y]) => tp(x, y)); q.z = p.z * s + dz; q.h = p.h * s;
        break;
    }
    return q;
  });
}

/* ---------------- render ---------------- */
/**
 * opts: w, h, cx, cy (origen en px), angle (rad, 0 = +x, horario), scale,
 *       outline (true | false | color), amb (luz ambiente), selout (líneas internas)
 */
function render(prims, opts) {
  const { w, h } = opts;
  const cx = opts.cx ?? w / 2, cy = opts.cy ?? h / 2;
  const ang = opts.angle || 0, sc = opts.scale || 1;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const N = w * h;
  const zb = new Float32Array(N).fill(-Infinity);
  const id = new Int32Array(N).fill(-1);
  const nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N), cw = new Float32Array(N);

  prims.forEach((p, pi) => {
    const [bx, by, br] = bounds(p);
    const sx = cx + (bx * ca - by * sa) * sc, sy = cy + (bx * sa + by * ca) * sc, r = br * sc + 1;
    const x0 = Math.max(0, Math.floor(sx - r)), x1 = Math.min(w - 1, Math.ceil(sx + r));
    const y0 = Math.max(0, Math.floor(sy - r)), y1 = Math.min(h - 1, Math.ceil(sy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / sc, dy = (y + 0.5 - cy) / sc;
        const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
        const e = evalPrim(p, lx, ly);
        if (!e) continue;
        const z = e[0] + pi * 1e-4;
        const i = y * w + x;
        if (z <= zb[i]) continue;
        zb[i] = z; id[i] = pi;
        // normal a espacio de pantalla
        const m = Math.hypot(e[1], e[2], e[3]) || 1;
        const n0 = e[1] / m, n1 = e[2] / m;
        nx[i] = n0 * ca - n1 * sa; ny[i] = n0 * sa + n1 * ca; nz[i] = e[3] / m;
        cw[i] = e[4];
      }
    }
  });

  const img = new Img(w, h);
  const amb = opts.amb ?? 0.2;
  const idx = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const pi = id[i];
    if (pi < 0) continue;
    const p = prims[pi];
    if (p.emit) {
      const r = p.emit;
      idx[i] = p.emitIdx !== undefined ? p.emitIdx : clamp(Math.floor(cw[i] * r.length * (p.emitK || 1.15)), 0, r.length - 1);
      continue;
    }
    const d = nx[i] * L[0] + ny[i] * L[1] + nz[i] * L[2];
    const lum = amb + (1 - amb) * Math.max(0, d);
    const r = p.ramp;
    let k = Math.floor(lum * r.length) + (p.bias || 0);
    if (p.spec && d > 0.97) k = r.length - 1;
    idx[i] = clamp(k, 0, r.length - 1);
  }
  // líneas internas: el píxel más bajo junto a una pieza más alta se oscurece un tono
  if (opts.selout !== false) {
    const dark = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, pi = id[i];
      if (pi < 0 || prims[pi].emit) continue;
      const g = prims[pi].group ?? pi;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + ddx, Y = y + ddy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X, pj = id[j];
        if (pj < 0) continue;
        if ((prims[pj].group ?? pj) !== g && zb[j] > zb[i] + (opts.seloutDepth ?? 1.2)) { dark[i] = 1; break; }
      }
    }
    for (let i = 0; i < N; i++) if (dark[i]) idx[i] = Math.max(0, idx[i] - 1);
  }
  for (let i = 0; i < N; i++) {
    const pi = id[i];
    if (pi < 0) continue;
    const p = prims[pi];
    const r = p.emit || p.ramp;
    img.set(i % w, (i / w) | 0, hex(r[idx[i]]));
  }
  if (opts.outline !== false) {
    img.outline(typeof opts.outline === 'string' ? opts.outline : (c) => darken(c, 0.72));
  }
  return img;
}

/** Monta una hoja: columnas = direcciones, filas = frames. fn(dirIndex, frameIndex) → Img */
function sheet(cols, rows, fw, fh, fn) {
  const out = new Img(cols * fw, rows * fh);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const im = fn(c, r);
    if (im) out.blit(im, c * fw + Math.floor((fw - im.w) / 2), r * fh + Math.floor((fh - im.h) / 2));
  }
  return out;
}

module.exports = { P, render, xform, rot, sheet, LIGHT: L };
