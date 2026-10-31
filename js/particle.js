'use strict';
/*
 * Partículas pixel art (con pooling): puntos, chispas, restos, anillos, destellos,
 * animaciones de hoja (explosiones, humo, impactos), estelas del dash, textos y rayos.
 * Todo se dibuja alineado a la rejilla de píxeles del canvas lógico.
 */
(function (HF) {
  const U = HF.U;

  /* ---------------- primitivas de dibujo pixelado ---------------- */
  const PX = {
    rect(ctx, x, y, w, h) { ctx.fillRect(Math.round(x), Math.round(y), w, h); },
    line(ctx, x0, y0, x1, y1, w = 1) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, n = 0;
      const o = Math.floor(w / 2);
      for (;;) {
        ctx.fillRect(x0 - o, y0 - o, w, w);
        if ((x0 === x1 && y0 === y1) || ++n > 2000) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    /** Circunferencia (algoritmo del punto medio). */
    ring(ctx, cx, cy, r, w = 1) {
      cx = Math.round(cx); cy = Math.round(cy);
      for (let k = 0; k < w; k++) {
        let x = Math.max(0, Math.round(r) - k), y = 0, err = 1 - x;
        if (x <= 0) { ctx.fillRect(cx, cy, 1, 1); continue; }
        while (x >= y) {
          ctx.fillRect(cx + x, cy + y, 1, 1); ctx.fillRect(cx + y, cy + x, 1, 1);
          ctx.fillRect(cx - y, cy + x, 1, 1); ctx.fillRect(cx - x, cy + y, 1, 1);
          ctx.fillRect(cx - x, cy - y, 1, 1); ctx.fillRect(cx - y, cy - x, 1, 1);
          ctx.fillRect(cx + y, cy - x, 1, 1); ctx.fillRect(cx + x, cy - y, 1, 1);
          y++;
          if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
        }
      }
    },
    /** Disco relleno por filas. */
    disc(ctx, cx, cy, r) {
      cx = Math.round(cx); cy = Math.round(cy);
      const R = Math.round(r);
      for (let y = -R; y <= R; y++) {
        const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
        ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
      }
    },
    /** Disco tramado (ajedrez) para zonas de peligro sin tapar el suelo. */
    ditherDisc(ctx, cx, cy, r, phase = 0) {
      cx = Math.round(cx); cy = Math.round(cy);
      const R = Math.round(r);
      for (let y = -R; y <= R; y++) {
        const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
        for (let x = -w; x <= w; x++) if (((x + y + phase) & 1) === 0) ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    },
  };
  HF.PX = PX;

  class Particle { constructor() { this.active = false; } }
  class FloatText { constructor() { this.active = false; } }

  class ParticleSystem {
    constructor(game) {
      this.game = game;
      this.pool = new HF.Pool(() => new Particle(), 2400);
      this.texts = new HF.Pool(() => new FloatText(), 160);
      this.lights = new HF.Pool(() => ({ active: false }), 140);
      this.bolts = [];
      this.density = 1;
    }
    clear() {
      this.pool.clear(); this.texts.clear(); this.lights.clear(); this.bolts.length = 0;
    }

    spawn(type, x, y, vx, vy, life, size, color, opts) {
      const p = this.pool.get();
      if (!p) return null;
      p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = p.max = life; p.size = size; p.color = color;
      p.drag = (opts && opts.drag) ?? 3;
      p.grow = (opts && opts.grow) || 0;
      p.add = !!(opts && opts.add);
      p.sheet = (opts && opts.sheet) || null;
      p.dir = (opts && opts.dir) || 0;
      p.anim = (opts && opts.anim) || null;
      p.frame = (opts && opts.frame) || 0;
      p.layer = (opts && opts.layer) || 0; // 0 = sobre entidades, -1 = suelo
      p.alpha = (opts && opts.alpha) ?? 1;
      p.flick = !!(opts && opts.flick);
      return p;
    }
    /** Animación de hoja que dura exactamente lo que marca su fps. */
    anim(sheet, x, y, opts = {}) {
      const s = HF.Assets.sheet(sheet);
      if (!s) return null;
      const a = s.anims[opts.anim || 'play'] || s.anims[Object.keys(s.anims)[0]];
      const life = (a.frames / a.fps) / (opts.speed || 1);
      return this.spawn('anim', x, y, opts.vx || 0, opts.vy || 0, life, 1, null,
        { sheet, dir: opts.dir || 0, anim: opts.anim || 'play', add: opts.add, drag: opts.drag ?? 2, layer: opts.layer, alpha: opts.alpha });
    }

    burst(x, y, n, o) {
      n = Math.max(1, Math.round(n * this.density));
      const base = o.angle ?? 0, spread = o.spread ?? Math.PI;
      for (let i = 0; i < n; i++) {
        const a = base + U.rand(-spread, spread);
        const s = U.rand(o.speed[0], o.speed[1]);
        this.spawn(o.type || 'dot', x, y, Math.cos(a) * s, Math.sin(a) * s,
          U.rand(o.life[0], o.life[1]), Math.round(U.rand(o.size[0], o.size[1])),
          Array.isArray(o.color) ? U.pick(o.color) : o.color, o);
      }
    }

    text(x, y, str, color, size = 1, life = 0.8) {
      const t = this.texts.get();
      if (!t) return;
      t.x = x + U.rand(-5, 5); t.y = y; t.vy = -46; t.str = str; t.color = color;
      t.scale = size >= 16 ? 2 : 1; t.life = t.max = life; t.crit = size >= 16;
    }
    light(x, y, r, color, a, life) {
      const l = this.lights.get();
      if (!l) return;
      l.x = x; l.y = y; l.r = r; l.color = color; l.a = a; l.life = l.max = life;
    }
    /** Rayo pixelado con ramificaciones. */
    bolt(x0, y0, x1, y1, color, life = 0.1, width = 1) {
      const pts = [x0, y0];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.floor(d / 10));
      const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
      const branches = [];
      for (let i = 1; i < n; i++) {
        const t = i / n, off = U.rand(-7, 7);
        const px = x0 + (x1 - x0) * t + nx * off, py = y0 + (y1 - y0) * t + ny * off;
        pts.push(px, py);
        if (Math.random() < 0.25) branches.push([px, py, px + U.rand(-12, 12), py + U.rand(-12, 12)]);
      }
      pts.push(x1, y1);
      this.bolts.push({ pts, branches, life, max: life, color, width });
    }

    update(dt) {
      this.pool.forEach((p) => {
        p.life -= dt;
        if (p.life <= 0) { this.pool.release(p); return; }
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.size += p.grow * dt;
      });
      this.texts.forEach((t) => {
        t.life -= dt;
        if (t.life <= 0) { this.texts.release(t); return; }
        t.y += t.vy * dt;
        t.vy *= Math.exp(-3.5 * dt);
      });
      this.lights.forEach((l) => { l.life -= dt; if (l.life <= 0) this.lights.release(l); });
      for (let i = this.bolts.length - 1; i >= 0; i--) {
        this.bolts[i].life -= dt;
        if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
      }
    }

    /** layer -1 = efectos de suelo (antes de las entidades); 0 = encima. */
    render(ctx, view, layer = 0) {
      const x0 = view.x - 60, y0 = view.y - 60, x1 = view.x + view.w + 60, y1 = view.y + view.h + 60;
      for (const add of [false, true]) {
        if (add) ctx.globalCompositeOperation = 'lighter';
        this.pool.forEach((p) => {
          if (p.add !== add || p.layer !== layer || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;
          this.draw(ctx, p);
        });
      }
      if (layer === 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (const b of this.bolts) {
          const a = b.life / b.max;
          ctx.globalAlpha = a;
          ctx.fillStyle = b.color;
          for (let i = 2; i < b.pts.length; i += 2) PX.line(ctx, b.pts[i - 2], b.pts[i - 1], b.pts[i], b.pts[i + 1], b.width + 1);
          for (const br of b.branches) PX.line(ctx, br[0], br[1], br[2], br[3], 1);
          ctx.fillStyle = '#ffffff';
          for (let i = 2; i < b.pts.length; i += 2) PX.line(ctx, b.pts[i - 2], b.pts[i - 1], b.pts[i], b.pts[i + 1], 1);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    draw(ctx, p) {
      const t = p.life / p.max;
      ctx.globalAlpha = p.alpha;
      switch (p.type) {
        case 'dot': {
          if (p.flick && Math.random() < 0.3) break;
          ctx.globalAlpha = p.alpha * (t > 0.3 ? 1 : t / 0.3);
          ctx.fillStyle = p.color;
          const s = Math.max(1, Math.round(p.size));
          ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
          break;
        }
        case 'spark': {
          ctx.fillStyle = p.color;
          const len = Math.min(6, Math.hypot(p.vx, p.vy) * 0.02);
          const a = Math.atan2(p.vy, p.vx);
          PX.line(ctx, p.x, p.y, p.x - Math.cos(a) * len, p.y - Math.sin(a) * len, 1);
          break;
        }
        case 'debris': {
          ctx.fillStyle = p.color;
          const s = Math.max(1, Math.round(p.size));
          const flip = Math.floor(p.life * 20) % 2;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), flip ? s : Math.max(1, s >> 1), flip ? Math.max(1, s >> 1) : s);
          break;
        }
        case 'ring':
          ctx.fillStyle = p.color;
          PX.ring(ctx, p.x, p.y, p.size * (1 - t * t) + 2, t > 0.5 ? 2 : 1);
          break;
        case 'flash':
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * Math.min(1, t * 2);
          PX.disc(ctx, p.x, p.y, p.size * (0.5 + 0.5 * t));
          break;
        case 'anim': {
          const s = HF.Assets.sheet(p.sheet);
          if (!s) break;
          const a = s.anims[p.anim];
          const f = Math.min(a.frames - 1, Math.floor((1 - t) * a.frames));
          HF.Assets.draw(ctx, p.sheet, p.anim, f, p.dir, p.x, p.y, { alpha: p.alpha });
          break;
        }
        case 'lob': {
          // proyectil en parábola: sombra en el suelo y bola elevada
          const k = 1 - t, h = Math.sin(k * Math.PI) * 70;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 1, 6, 3);
          HF.Assets.draw(ctx, p.sheet, 'fly', Math.floor(k * 14) % 4, 0, p.x, p.y - h);
          break;
        }
        case 'ghost':
          HF.Assets.draw(ctx, p.sheet, p.anim, p.frame, p.dir, p.x, p.y, { alpha: t * 0.45, tint: { color: '#7ff6ff', a: 0.6 } });
          break;
      }
      ctx.globalAlpha = 1;
    }
    renderTexts(ctx) {
      const F = HF.PixelFont;
      this.texts.forEach((t) => {
        const a = Math.min(1, (t.life / t.max) * 2.5);
        const pop = t.crit && t.life > t.max - 0.1 ? 1 : 0;
        F.draw(ctx, t.str, t.x, t.y - pop, t.color, { align: 'center', scale: t.scale, alpha: a });
      });
    }
  }

  HF.ParticleSystem = ParticleSystem;
})(window.HF);
