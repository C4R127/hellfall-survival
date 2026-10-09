'use strict';
/* Sistema de partículas, textos flotantes, luces temporales y rayos (todo con pooling). */
(function (HF) {
  const U = HF.U;

  class Particle {
    constructor() { this.active = false; }
  }
  class FloatText {
    constructor() { this.active = false; }
  }

  class ParticleSystem {
    constructor(game) {
      this.game = game;
      this.pool = new HF.Pool(() => new Particle(), 2400);
      this.texts = new HF.Pool(() => new FloatText(), 160);
      this.lights = new HF.Pool(() => ({ active: false }), 120);
      this.bolts = [];
      this.density = 1;
    }
    clear() {
      this.pool.clear();
      this.texts.clear();
      this.lights.clear();
      this.bolts.length = 0;
    }

    spawn(type, x, y, vx, vy, life, size, color, opts) {
      const p = this.pool.get();
      if (!p) return null;
      p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = p.max = life; p.size = size; p.color = color;
      p.drag = (opts && opts.drag) ?? 3;
      p.grow = (opts && opts.grow) || 0;
      p.rot = Math.random() * U.TAU;
      p.spin = (opts && opts.spin) || 0;
      p.img = (opts && opts.img) || null;
      p.angle = (opts && opts.angle) || 0;
      p.add = !!(opts && opts.add);
      return p;
    }

    /** Ráfaga de partículas en todas direcciones o en un cono. */
    burst(x, y, n, o) {
      n = Math.max(1, Math.round(n * this.density));
      const base = o.angle ?? 0, spread = o.spread ?? Math.PI;
      for (let i = 0; i < n; i++) {
        const a = base + U.rand(-spread, spread);
        const s = U.rand(o.speed[0], o.speed[1]);
        this.spawn(o.type || 'dot', x, y, Math.cos(a) * s, Math.sin(a) * s,
          U.rand(o.life[0], o.life[1]), U.rand(o.size[0], o.size[1]),
          Array.isArray(o.color) ? U.pick(o.color) : o.color, o);
      }
    }

    text(x, y, str, color, size = 14, life = 0.8) {
      const t = this.texts.get();
      if (!t) return;
      t.x = x + U.rand(-6, 6); t.y = y; t.vy = -60; t.str = str; t.color = color;
      t.size = size; t.life = t.max = life;
    }

    light(x, y, r, color, a, life) {
      const l = this.lights.get();
      if (!l) return;
      l.x = x; l.y = y; l.r = r; l.color = color; l.a = a; l.life = l.max = life;
    }

    /** Rayo zigzagueante entre dos puntos. */
    bolt(x0, y0, x1, y1, color, life = 0.1, width = 2) {
      const pts = [x0, y0];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.floor(d / 18));
      const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
      for (let i = 1; i < n; i++) {
        const t = i / n, off = U.rand(-10, 10);
        pts.push(x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off);
      }
      pts.push(x1, y1);
      this.bolts.push({ pts, life, max: life, color, width });
    }

    update(dt) {
      this.pool.forEach((p) => {
        p.life -= dt;
        if (p.life <= 0) { this.pool.release(p); return; }
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.spin * dt;
      });
      this.texts.forEach((t) => {
        t.life -= dt;
        if (t.life <= 0) { this.texts.release(t); return; }
        t.y += t.vy * dt;
        t.vy *= Math.exp(-3 * dt);
      });
      this.lights.forEach((l) => {
        l.life -= dt;
        if (l.life <= 0) this.lights.release(l);
      });
      for (let i = this.bolts.length - 1; i >= 0; i--) {
        this.bolts[i].life -= dt;
        if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
      }
    }

    render(ctx, view) {
      const x0 = view.x - 60, y0 = view.y - 60, x1 = view.x + view.w + 60, y1 = view.y + view.h + 60;
      // capa normal
      this.pool.forEach((p) => {
        if (p.add || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;
        this.draw(ctx, p);
      });
      // capa aditiva
      ctx.globalCompositeOperation = 'lighter';
      this.pool.forEach((p) => {
        if (!p.add || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;
        this.draw(ctx, p);
      });
      for (const b of this.bolts) {
        const a = b.life / b.max;
        ctx.globalAlpha = a;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width + 3;
        ctx.globalAlpha = a * 0.35;
        this.strokePts(ctx, b.pts);
        ctx.globalAlpha = a;
        ctx.lineWidth = b.width;
        ctx.strokeStyle = '#fff';
        this.strokePts(ctx, b.pts);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    strokePts(ctx, pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    }
    draw(ctx, p) {
      const t = p.life / p.max;
      switch (p.type) {
        case 'dot':
          ctx.globalAlpha = Math.min(1, t * 1.5);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'spark': {
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
          break;
        }
        case 'smoke':
          ctx.globalAlpha = t * 0.45;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
          break;
        case 'ring':
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 + t * 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t * t) + 2, 0, U.TAU); ctx.stroke();
          break;
        case 'flash':
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * t), 0, U.TAU); ctx.fill();
          break;
        case 'debris':
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        case 'ghost':
          if (!p.img) break;
          ctx.globalAlpha = t * 0.5;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
          ctx.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
          ctx.restore();
          break;
      }
      ctx.globalAlpha = 1;
    }
    renderTexts(ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.texts.forEach((t) => {
        const a = Math.min(1, t.life / t.max * 2.2);
        const pop = 1 + Math.max(0, (t.life - t.max + 0.12) / 0.12) * 0.5;
        ctx.globalAlpha = a;
        ctx.font = `700 ${Math.round(t.size * pop)}px "Chakra Petch", monospace`;
        ctx.fillStyle = '#000';
        ctx.fillText(t.str, t.x + 1.5, t.y + 1.5);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      });
      ctx.globalAlpha = 1;
    }
  }

  HF.ParticleSystem = ParticleSystem;
})(window.HF);
