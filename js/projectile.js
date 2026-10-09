'use strict';
/* Proyectiles del jugador y de los enemigos: movimiento, colisiones, daño y eliminación. */
(function (HF) {
  const U = HF.U;
  const tmp = [];

  class Projectile {
    constructor() {
      this.active = false;
      this.hits = [];
    }
    init(o) {
      this.x = o.x; this.y = o.y;
      this.vx = Math.cos(o.angle) * o.speed;
      this.vy = Math.sin(o.angle) * o.speed;
      this.angle = o.angle;
      this.speed = o.speed;
      this.r = o.r || 3;
      this.dmg = o.dmg;
      this.owner = o.owner;          // 'player' | 'enemy'
      this.type = o.type || 'bullet';
      this.color = o.color || '#fff';
      this.range = o.range || 800;
      this.travel = 0;
      this.pierce = o.pierce || 0;
      this.crit = !!o.crit;
      this.knock = o.knock || 0;
      this.explode = o.explode || 0;
      this.fuse = o.fuse || 0;
      this.homing = o.homing || 0;
      this.drag = o.drag || 0;
      this.trailT = 0;
      this.hits.length = 0;
      this.weapon = o.weapon || null;
      return this;
    }

    /** Devuelve false cuando el proyectil debe eliminarse. */
    update(dt, g) {
      if (this.type === 'grenade') return this.updateGrenade(dt, g);

      if (this.homing && this.owner === 'enemy') {
        const p = g.player;
        const want = U.angleTo(this.x, this.y, p.x, p.y);
        this.angle += U.clamp(U.angleDiff(this.angle, want), -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
      }

      const step = Math.hypot(this.vx, this.vy) * dt;
      const sub = Math.max(1, Math.ceil(step / 10));
      const sdt = dt / sub;
      for (let s = 0; s < sub; s++) {
        this.x += this.vx * sdt;
        this.y += this.vy * sdt;
        this.travel += step / sub;
        if (g.map.blocksShot(this.x, this.y)) { this.impactWall(g); return false; }
        if (this.owner === 'player') {
          if (this.checkEnemies(g)) return false;
          if (this.checkBarrels(g)) return false;
        } else if (this.checkPlayer(g)) return false;
      }

      if (this.type === 'rocket' || this.type === 'plasma' || this.type === 'orb') {
        this.trailT -= dt;
        if (this.trailT <= 0) {
          this.trailT = 0.02;
          const c = this.type === 'rocket' ? '#777' : this.color;
          g.particles.spawn(this.type === 'rocket' ? 'smoke' : 'dot', this.x, this.y, U.rand(-20, 20), U.rand(-20, 20),
            this.type === 'rocket' ? 0.5 : 0.25, this.type === 'rocket' ? 4 : 3, c, { grow: this.type === 'rocket' ? 10 : 0, add: this.type !== 'rocket' });
        }
      }

      if (this.travel >= this.range) {
        if (this.explode) this.detonate(g);
        return false;
      }
      return true;
    }

    updateGrenade(dt, g) {
      this.fuse -= dt;
      const k = Math.exp(-this.drag * dt);
      this.vx *= k; this.vy *= k;
      const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      if (g.map.solidAt(nx, this.y)) this.vx *= -0.6; else this.x = nx;
      if (g.map.solidAt(this.x, ny)) this.vy *= -0.6; else this.y = ny;
      this.angle += dt * 12;
      if (this.fuse <= 0) { this.detonate(g); return false; }
      return true;
    }

    checkEnemies(g) {
      const list = g.hash.query(this.x, this.y, this.r + 48, tmp);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.invulnerable) continue;
        const rr = this.r + e.r;
        if (U.dist2(this.x, this.y, e.x, e.y) > rr * rr) continue;
        if (this.hits.includes(e.id)) continue;
        this.hits.push(e.id);
        if (this.explode) { this.detonate(g); return true; }
        const kx = Math.cos(this.angle) * this.knock, ky = Math.sin(this.angle) * this.knock;
        g.damageEnemy(e, this.dmg, { crit: this.crit, kx, ky, x: this.x, y: this.y, weapon: this.weapon });
        g.particles.burst(this.x, this.y, 4, {
          type: 'spark', angle: this.angle + Math.PI, spread: 0.9, speed: [80, 260], life: [0.1, 0.25],
          size: [1, 2], color: e.blood || '#a22', add: false,
        });
        if (this.type === 'plasma') g.particles.light(this.x, this.y, 70, '90,240,255', 0.5, 0.12);
        if (this.pierce > 0) { this.pierce--; this.dmg *= 0.8; continue; }
        return true;
      }
      return false;
    }

    checkBarrels(g) {
      for (const b of g.barrels) {
        if (!b.alive) continue;
        if (U.dist2(this.x, this.y, b.x, b.y) < (b.r + this.r) ** 2) {
          g.hitBarrel(b, this.dmg);
          if (this.explode) this.detonate(g);
          return true;
        }
      }
      return false;
    }

    checkPlayer(g) {
      const p = g.player;
      const rr = this.r + p.r - 3;
      if (U.dist2(this.x, this.y, p.x, p.y) > rr * rr) return false;
      if (p.dash.active > 0) return false; // atraviesa durante el dash
      p.takeDamage(this.dmg, { x: this.x, y: this.y });
      g.particles.burst(this.x, this.y, 6, { type: 'dot', speed: [40, 160], life: [0.2, 0.4], size: [2, 3], color: this.color });
      return true;
    }

    impactWall(g) {
      if (this.explode) { this.detonate(g); return; }
      const back = Math.atan2(-this.vy, -this.vx);
      g.particles.burst(this.x - Math.cos(this.angle) * 4, this.y - Math.sin(this.angle) * 4, this.owner === 'player' ? 4 : 5, {
        type: this.owner === 'player' ? 'spark' : 'dot', angle: back, spread: 1.1, speed: [60, 220], life: [0.08, 0.22],
        size: [1, 2.5], color: this.color, add: true,
      });
    }

    detonate(g) {
      g.explode(this.x, this.y, this.explode, this.dmg, {
        byPlayer: this.owner === 'player', hurtPlayer: this.owner === 'player' ? 0.35 : 1, crit: this.crit, weapon: this.weapon,
      });
    }

    render(ctx) {
      switch (this.type) {
        case 'bullet':
        case 'pellet': {
          const len = this.type === 'pellet' ? 0.012 : 0.022;
          ctx.strokeStyle = this.color;
          ctx.lineWidth = this.crit ? 3 : 2;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x - this.vx * len, this.y - this.vy * len);
          ctx.stroke();
          break;
        }
        case 'plasma':
        case 'orb':
        case 'acid':
        case 'boss': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = this.color;
          ctx.globalAlpha = 0.35;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2, 0, U.TAU); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.45, 0, U.TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'rocket':
        case 'grenade': {
          const s = HF.Sprites.get(this.type);
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          ctx.drawImage(s.img, -s.w / 2, -s.h / 2);
          ctx.restore();
          if (this.type === 'grenade' && this.fuse < 0.4 && Math.floor(this.fuse * 20) % 2) {
            ctx.fillStyle = '#ff3a2a';
            ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, U.TAU); ctx.fill();
          }
          break;
        }
      }
    }
  }

  HF.Projectile = Projectile;
})(window.HF);
