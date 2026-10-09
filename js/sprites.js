'use strict';
/*
 * Sprites pixel art generados por código (sin archivos externos).
 * Cada sprite se dibuja en una rejilla pequeña (16/24/32 px), recibe contorno y
 * sombreado automáticos y se escala x2/x3 con "nearest neighbour".
 * Todos miran hacia +X (ángulo 0) para poder rotarlos.
 * Si se colocan PNG en assets/, pueden registrarse con HF.Sprites.loadImage().
 */
(function (HF) {
  const U = HF.U;

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, amt) {
    const [r, g, b] = hexToRgb(h);
    const f = (v) => U.clamp(Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  class PixelArt {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.px = new Array(w * h).fill(null);
      this.glow = new Array(w * h).fill(false);
    }
    set(x, y, c, glow) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.px[y * this.w + x] = c;
      this.glow[y * this.w + x] = !!glow;
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      return this.px[y * this.w + x];
    }
    disc(cx, cy, r, c, glow) {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c, glow);
    }
    ellipse(cx, cy, rx, ry, c, glow) {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
        for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++)
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, c, glow);
    }
    rect(x, y, w, h, c, glow) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, glow);
    }
    line(x0, y0, x1, y1, c, glow) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.set(x0, y0, c, glow);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    toCanvas(scale, opts = {}) {
      const outline = opts.outline === undefined ? '#07070b' : opts.outline;
      const { w, h } = this;
      const c = U.makeCanvas(w * scale, h * scale);
      const ctx = c.getContext('2d');
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let col = this.get(x, y);
          if (col) {
            if (opts.shade !== false && !this.glow[y * w + x] && col[0] === '#') {
              if (!this.get(x - 1, y) || !this.get(x, y - 1)) col = shade(col, 0.22);
              else if (!this.get(x + 1, y) || !this.get(x, y + 1)) col = shade(col, -0.3);
            }
          } else if (outline && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) {
            col = outline;
          }
          if (col) {
            ctx.fillStyle = col;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
      return c;
    }
  }

  function whiteVersion(src) {
    const c = U.makeCanvas(src.width, src.height);
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* ---------------------------------------------------------------- */
  /* Definiciones                                                       */
  /* ---------------------------------------------------------------- */
  const DEFS = {
    player(f) {
      const p = new PixelArt(16, 16);
      p.rect(2, 5, 3, 6, '#2b3440');                 // mochila
      p.ellipse(7, 8, 4, 6.2, '#3c5a7a');           // torso
      p.disc(7, 3.2, 2.2, '#4f7090');               // hombreras
      p.disc(7, 12.8, 2.2, '#4f7090');
      p.rect(6, 7, 2, 2, '#e0802a');                // insignia
      p.disc(8.5, 8, 3, '#5d7f9f');                 // casco
      p.rect(10, 7, 2, 2, '#7ff6ff', true);         // visor
      p.disc(11.5 + f * 0.5, 11, 1.4, '#3a3a40');   // guantes
      p.disc(11, 5.5, 1.2, '#3a3a40');
      return p.toCanvas(2);
    },
    crawler(f) {
      const p = new PixelArt(16, 16);
      p.line(5, 4, 3, 1 + f, '#5a1f1f'); p.line(5, 12, 3, 15 - f, '#5a1f1f');
      p.line(8, 4, 8, 1 + f, '#5a1f1f'); p.line(8, 12, 8, 15 - f, '#5a1f1f');
      p.ellipse(7, 8, 5, 4.5, '#7a2e2e');
      p.set(5, 8, '#5a1f1f'); p.set(7, 7, '#5a1f1f'); p.set(4, 6, '#5a1f1f'); p.set(4, 10, '#5a1f1f');
      p.disc(11.5, 8, 2.6, '#9a4038');
      p.line(11, 5, 14, 2 + f, '#d9c8a8'); p.line(11, 11, 14, 14 - f, '#d9c8a8');
      p.set(13, 7, '#ffd23a', true); p.set(13, 9, '#ffd23a', true);
      return p.toCanvas(2);
    },
    stalker(f) {
      const p = new PixelArt(16, 16);
      const lc = '#3a1f4c';
      p.line(7, 6, 4, 1 + f, lc); p.line(7, 10, 4, 15 - f, lc);
      p.line(10, 6, 13, 2 - f + 1, lc); p.line(10, 10, 13, 14 + f - 1, lc);
      p.line(1, 8, 3, 8, '#55306e');
      p.ellipse(7.5, 8, 5.5, 2.6, '#55306e');
      p.rect(5, 7, 4, 1, '#7a4a9a');
      p.disc(13, 8, 1.9, '#6e3f8d');
      p.set(14, 7, '#ff4af0', true); p.set(14, 9, '#ff4af0', true);
      return p.toCanvas(2);
    },
    brute(f) {
      const p = new PixelArt(24, 24);
      p.disc(16 + f, 5, 2.8, '#4c5640');
      p.disc(16 - f, 19, 2.8, '#4c5640');
      p.disc(11, 12, 8.2, '#5a6448');
      p.rect(5, 8, 6, 8, '#3c4232');
      p.rect(6, 9, 4, 1, '#56604a'); p.rect(6, 12, 4, 1, '#56604a'); p.rect(6, 15, 4, 1, '#56604a');
      p.disc(18, 12, 3.6, '#6e7a56');
      p.line(19, 8, 22, 5, '#d8cfb0'); p.line(19, 16, 22, 19, '#d8cfb0');
      p.set(20, 11, '#ff3030', true); p.set(20, 13, '#ff3030', true);
      return p.toCanvas(2);
    },
    spitter(f) {
      const p = new PixelArt(16, 16);
      p.line(5, 4, 4, 1 + f, '#2f4a18'); p.line(5, 12, 4, 15 - f, '#2f4a18');
      p.line(9, 4, 10, 1 + f, '#2f4a18'); p.line(9, 12, 10, 15 - f, '#2f4a18');
      p.disc(7, 8, 5 + f * 0.3, '#4f7a2a');
      p.set(5, 6, '#b6ff3a', true); p.set(8, 10, '#b6ff3a', true); p.set(5, 10, '#b6ff3a', true); p.set(8, 5, '#b6ff3a', true);
      p.rect(11, 7, 3, 2, '#3c5a20');
      p.rect(14, 7, 1, 2, '#c8ff5a', true);
      return p.toCanvas(2);
    },
    bloater(f) {
      const p = new PixelArt(16, 16);
      p.disc(8, 8, 6 + f * 0.5, '#c46a1e');
      p.disc(8, 8, 4, '#e8a038');
      p.line(3, 6, 6, 8, '#8a3a10'); p.line(12, 4, 10, 7, '#8a3a10'); p.line(9, 13, 9, 10, '#8a3a10');
      p.set(6, 6, '#fff27a', true); p.set(10, 9, '#fff27a', true); p.set(7, 11, '#fff27a', true); p.set(11, 6, '#fff27a', true);
      p.set(13, 7, '#ff5a2a', true); p.set(13, 9, '#ff5a2a', true);
      return p.toCanvas(2);
    },
    warlock(f) {
      const p = new PixelArt(18, 18);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU + f * 0.39;
        p.set(9 + Math.cos(a) * 8.3, 9 + Math.sin(a) * 8.3, '#9a4ad8', true);
      }
      p.disc(8, 9, 5.8, '#2a1838');
      p.rect(4, 8, 5, 2, '#46285c');
      p.disc(10, 9, 3, '#3d2350');
      p.set(12, 8, '#e0a0ff', true); p.set(12, 10, '#e0a0ff', true);
      p.disc(14.5, 9, 1.8, '#c78aff', true);
      p.set(14, 9, '#ffffff', true);
      return p.toCanvas(2);
    },
    herald(f) {
      const p = new PixelArt(32, 32);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU + f * 0.13;
        p.line(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 16 + Math.cos(a) * 14.5, 16 + Math.sin(a) * 14.5, '#c8b8a0');
      }
      p.rect(18, 3, 8, 4, '#4a1010'); p.rect(18, 25, 8, 4, '#4a1010');
      p.line(26, 3, 29, 2 + f, '#d0c0a0'); p.line(26, 6, 29, 7 - f, '#d0c0a0');
      p.line(26, 25, 29, 24 + f, '#d0c0a0'); p.line(26, 28, 29, 29 - f, '#d0c0a0');
      p.disc(15.5, 16, 11, '#5a1414');
      p.disc(15.5, 16, 8, '#7a2020');
      p.disc(16, 16, 4.2, '#ff6a2a', true);
      p.disc(16, 16, 2, '#ffe08a', true);
      p.disc(24, 16, 3.6, '#8a2424');
      p.set(26, 14, '#ffef5a', true); p.set(26, 18, '#ffef5a', true); p.set(27, 14, '#ffef5a', true); p.set(27, 18, '#ffef5a', true);
      return p.toCanvas(3);
    },
    matriarch(f) {
      const p = new PixelArt(32, 32);
      const lc = '#2a3414';
      for (let i = 0; i < 3; i++) {
        const lx = 17 + i * 3;
        p.line(lx, 12, lx - 2 + (i + f) % 2 * 3, 2, lc);
        p.line(lx, 20, lx - 2 + (i + f + 1) % 2 * 3, 30, lc);
      }
      p.ellipse(11, 16, 10, 8, '#3a4a1e');
      for (let x = 4; x < 18; x += 4) p.line(x, 10, x, 22, '#2c3a16');
      p.disc(6, 9, 3, '#9aff5a', true); p.disc(6, 23, 3, '#9aff5a', true); p.disc(2.5, 16, 2.6, '#9aff5a', true);
      p.set(5, 8, '#e8ffd0', true); p.set(5, 22, '#e8ffd0', true);
      p.disc(20, 16, 6, '#4e6a26');
      p.disc(26, 16, 3.6, '#5e3a6e');
      p.line(28, 13, 31, 11 + f, '#e0d0a0'); p.line(28, 19, 31, 21 - f, '#e0d0a0');
      p.set(27, 14, '#e07aff', true); p.set(27, 18, '#e07aff', true);
      return p.toCanvas(3);
    },
    /* ---- armas (vista superior, empuñadura en x=0) ---- */
    w_pistol() { const p = new PixelArt(10, 4); p.rect(0, 1, 6, 2, '#2a2a30'); p.rect(6, 1, 1, 2, '#555a66'); return p.toCanvas(2); },
    w_shotgun() { const p = new PixelArt(12, 4); p.rect(0, 1, 4, 2, '#5a3a22'); p.rect(4, 1, 7, 2, '#30333a'); p.rect(10, 1, 1, 2, '#777'); return p.toCanvas(2); },
    w_rifle() { const p = new PixelArt(14, 4); p.rect(0, 1, 4, 2, '#26282e'); p.rect(4, 1, 9, 2, '#3a3e48'); p.rect(6, 3, 2, 1, '#26282e'); p.rect(13, 1, 1, 2, '#888'); return p.toCanvas(2); },
    w_plasma() { const p = new PixelArt(13, 5); p.rect(0, 1, 9, 3, '#2a3a48'); p.rect(3, 2, 4, 1, '#5cf2ff', true); p.rect(9, 1, 3, 3, '#3a5466'); p.rect(12, 2, 1, 1, '#aaffff', true); return p.toCanvas(2); },
    w_launcher() { const p = new PixelArt(15, 6); p.rect(0, 1, 14, 4, '#3a4430'); p.rect(2, 2, 3, 2, '#ffb030'); p.rect(14, 1, 1, 4, '#222'); return p.toCanvas(2); },
    w_tesla() { const p = new PixelArt(13, 6); p.rect(0, 2, 7, 2, '#33303f'); p.rect(7, 1, 4, 4, '#5a4a20'); p.rect(8, 1, 1, 4, '#ffe066', true); p.rect(10, 1, 1, 4, '#ffe066', true); p.rect(11, 2, 2, 2, '#c9b8ff', true); return p.toCanvas(2); },
    /* ---- objetos ---- */
    i_health() { const p = new PixelArt(10, 10); p.rect(1, 1, 8, 8, '#e4e4e4'); p.rect(4, 2, 2, 6, '#e02a2a', true); p.rect(2, 4, 6, 2, '#e02a2a', true); return p.toCanvas(2); },
    i_healthBig() { const p = new PixelArt(12, 12); p.rect(1, 1, 10, 10, '#f0f0f0'); p.rect(5, 2, 2, 8, '#ff2a4a', true); p.rect(2, 5, 8, 2, '#ff2a4a', true); p.rect(1, 1, 10, 1, '#ff2a4a'); return p.toCanvas(2); },
    i_armor() { const p = new PixelArt(10, 10); p.rect(1, 1, 8, 5, '#3a8fe0'); p.disc(5, 5, 4, '#3a8fe0'); p.rect(4, 2, 2, 5, '#9fd0ff', true); return p.toCanvas(2); },
    i_ammo() { const p = new PixelArt(10, 10); p.rect(1, 3, 8, 6, '#6a5c2a'); p.rect(2, 1, 1, 3, '#e8c850'); p.rect(4, 1, 1, 3, '#e8c850'); p.rect(6, 1, 1, 3, '#e8c850'); p.rect(1, 5, 8, 1, '#8a7a3a'); return p.toCanvas(2); },
    i_coin() { const p = new PixelArt(8, 8); p.disc(4, 4, 3.5, '#ffc030'); p.disc(4, 4, 2.2, '#ffe27a', true); p.rect(3.5, 2, 1, 4, '#c88a10'); return p.toCanvas(2); },
    i_energy() { const p = new PixelArt(8, 10); p.rect(1, 1, 6, 8, '#1a6a5a'); p.rect(2, 2, 4, 6, '#2affd0', true); p.rect(3, 0, 2, 1, '#888'); return p.toCanvas(2); },
    i_quad() { const p = new PixelArt(12, 12); p.disc(6, 6, 5.5, '#7a0a14'); p.disc(6, 6, 4, '#ff3a3a', true); p.rect(4, 4, 1, 2, '#200'); p.rect(7, 4, 1, 2, '#200'); p.rect(4, 8, 4, 1, '#200'); return p.toCanvas(2); },
    i_rapid() { const p = new PixelArt(12, 12); p.disc(6, 6, 5.5, '#6a4a00'); p.line(7, 1, 4, 6, '#ffd03a', true); p.line(4, 6, 8, 6, '#ffd03a', true); p.line(8, 6, 5, 11, '#ffd03a', true); return p.toCanvas(2); },
    i_invul() { const p = new PixelArt(12, 12); p.disc(6, 6, 5.5, '#0a4a5a'); p.disc(6, 6, 3.5, '#3affff', true); p.disc(6, 6, 2, '#0a4a5a'); return p.toCanvas(2); },
    i_nuke() { const p = new PixelArt(12, 12); p.disc(6, 6, 5.5, '#5a3000'); p.disc(6, 6, 4.5, '#ff8a2a', true); p.disc(6, 6, 1.3, '#200'); for (let i = 0; i < 3; i++) { const a = i * U.TAU / 3 - 1.57; p.line(6 + Math.cos(a) * 2, 6 + Math.sin(a) * 2, 6 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, '#200'); } return p.toCanvas(2); },
    i_crate() { const p = new PixelArt(14, 14); p.rect(1, 1, 12, 12, '#5a4a30'); p.line(1, 1, 12, 12, '#7a6440'); p.line(12, 1, 1, 12, '#7a6440'); p.rect(1, 6, 12, 2, '#e0b030', true); return p.toCanvas(2); },
    barrel() { const p = new PixelArt(14, 14); p.disc(7, 7, 6.2, '#9a2818'); p.disc(7, 7, 4.5, '#c03a22'); p.disc(7, 7, 1.5, '#401008'); p.rect(3, 6, 2, 2, '#ffd030', true); p.rect(9, 6, 2, 2, '#ffd030', true); return p.toCanvas(2); },
    grenade() { const p = new PixelArt(6, 6); p.disc(3, 3, 2.6, '#3a4a2a'); p.set(3, 1, '#ffcc33', true); return p.toCanvas(2); },
    rocket() { const p = new PixelArt(8, 4); p.rect(0, 1, 6, 2, '#888c90'); p.rect(6, 1, 2, 2, '#e04020'); p.set(0, 0, '#555'); p.set(0, 3, '#555'); return p.toCanvas(2); },
  };

  const FRAMED = ['player', 'crawler', 'stalker', 'brute', 'spitter', 'bloater', 'warlock', 'herald', 'matriarch'];

  const Sprites = {
    cache: {},
    build() {
      for (const name in DEFS) {
        const frames = FRAMED.includes(name) ? [0, 1] : [0];
        this.cache[name] = frames.map((f) => {
          const img = DEFS[name](f);
          return { img, white: whiteVersion(img), w: img.width, h: img.height };
        });
      }
    },
    get(name, frame = 0) {
      const s = this.cache[name];
      if (!s) return null;
      return s[frame % s.length];
    },
    /** Permite reemplazar un sprite procedural por una imagen de assets/. */
    loadImage(name, url) {
      const im = new Image();
      im.onload = () => {
        this.cache[name] = [{ img: im, white: whiteVersion(im), w: im.width, h: im.height }];
      };
      im.src = url;
    },
    PixelArt,
    shade,
  };

  HF.Sprites = Sprites;
})(window.HF);
