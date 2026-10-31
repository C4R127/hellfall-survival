'use strict';
/* Buffer de imagen RGBA con utilidades de pixel art (sin antialiasing). */
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./png');

function hex(h) {
  if (Array.isArray(h)) return h;
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function toHex(c) { return '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { a = hex(a); b = hex(b); return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)).concat(255); }
function darken(c, t) { return mix(c, '#05040a', t); }
function lighten(c, t) { return mix(c, '#fff4e0', t); }

class Img {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c, a) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inside(x, y)) return;
    c = hex(c);
    const i = (y * this.w + x) * 4;
    const alpha = a === undefined ? (c[3] ?? 255) : a;
    if (alpha >= 255) { this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255; return; }
    if (alpha <= 0) return;
    // mezcla "source-over" sin antialiasing (para capas semitransparentes intencionadas)
    const sa = alpha / 255, da = this.data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.round((c[k] * sa + this.data[i + k] * da * (1 - sa)) / (oa || 1));
    this.data[i + 3] = Math.round(oa * 255);
  }
  get(x, y) {
    if (!this.inside(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return null;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  alpha(x, y) { return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0; }
  clear(x, y) { if (this.inside(x, y)) this.data[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  disc(cx, cy, r, c, a) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c, a);
  }
  ellipse(cx, cy, rx, ry, c, a) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, c, a);
  }
  ring(cx, cy, r, w, c, a) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d > r - w) this.set(x, y, c, a);
      }
  }
  line(x0, y0, x1, y1, c, a) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Contorno exterior de 1 px. color puede ser función(colorVecino) → color. */
  outline(color) {
    const out = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alpha(x, y)) continue;
      let n = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = this.get(x + dx, y + dy);
        if (c && c[3] > 128) { n = c; break; }
      }
      if (n) out.push([x, y, typeof color === 'function' ? color(n) : color]);
    }
    for (const [x, y, c] of out) this.set(x, y, c);
    return this;
  }
  blit(src, dx, dy, opts = {}) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (!c) continue;
      const tx = opts.flipX ? src.w - 1 - x : x;
      this.set(dx + tx, dy + y, c, opts.alpha !== undefined ? Math.round(c[3] * opts.alpha) : c[3]);
    }
    return this;
  }
  /** Copia escalada por un factor entero (vecino más cercano). */
  scaled(k) {
    const o = new Img(this.w * k, this.h * k);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const i = ((y / k | 0) * this.w + (x / k | 0)) * 4, j = (y * o.w + x) * 4;
      o.data[j] = this.data[i]; o.data[j + 1] = this.data[i + 1]; o.data[j + 2] = this.data[i + 2]; o.data[j + 3] = this.data[i + 3];
    }
    return o;
  }
  /** Recorta el alfa a 0/255 para evitar halos de exportación. */
  hardAlpha(th = 100) {
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = this.data[i] >= th ? 255 : 0;
    return this;
  }
  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePNG(this.w, this.h, this.data));
  }
}

/** Generador pseudoaleatorio determinista. */
function rng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dibuja un mapa de caracteres → colores (para iconos y glifos pintados a mano). */
function fromMap(rows, legend) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const img = new Img(w, h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (legend[ch]) img.set(x, y, legend[ch]); }));
  return img;
}

module.exports = { Img, hex, toHex, mix, darken, lighten, rng, fromMap };
