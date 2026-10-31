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

      // estelas (solo visuales)
      if (this.type === 'rocket' || this.type === 'plasma' || this.type === 'orb' || this.type === 'rift') {
        this.trailT -= dt;
        if (this.trailT <= 0) {
          if (this.type === 'rocket') {
            this.trailT = 0.035;
            HF.FX.smoke(this.x - Math.cos(this.angle) * 8, this.y - Math.sin(this.angle) * 8, U.rand(-10, 10), U.rand(-10, 10));
            g.particles.spawn('dot', this.x - Math.cos(this.angle) * 8, this.y - Math.sin(this.angle) * 8, U.rand(-15, 15), U.rand(-15, 15), 0.2, 1, '#ffb040', { add: true });
          } else {
            this.trailT = 0.025;
            g.particles.spawn('dot', this.x + U.rand(-2, 2), this.y + U.rand(-2, 2), 0, 0, 0.22, 1, this.color, { add: true });
          }
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
        HF.FX.hit(e, this.x, this.y, this.angle, this.crit, this.weapon);
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
      p.takeDamage(this.dmg, { x: this.x, y: this.y, source: 'proj_' + this.type });
      g.particles.burst(this.x, this.y, 6, { type: 'dot', speed: [40, 160], life: [0.2, 0.4], size: [1, 2], color: this.color });
      return true;
    }

    impactWall(g) {
      if (this.explode) { this.detonate(g); return; }
      const x = this.x - Math.cos(this.angle) * 3, y = this.y - Math.sin(this.angle) * 3;
      HF.FX.impactWall(x, y, this.angle, this.owner === 'player' ? (this.type === 'plasma' ? 'plasma' : 'bullet') : 'enemy');
    }

    detonate(g) {
      g.explode(this.x, this.y, this.explode, this.dmg, {
        byPlayer: this.owner === 'player', hurtPlayer: this.owner === 'player' ? 0.2 : 1, crit: this.crit, weapon: this.weapon,
      });
    }

    /** Cada tipo tiene forma propia (trazador, perdigón, esfera, cohete, glóbulo, orbe, astilla, anillo). */
    render(ctx) {
      const A = HF.Assets, t = HF.game.time;
      const dir16 = (a) => A.dirIndex(a, 16);
      switch (this.type) {
        case 'bullet': A.draw(ctx, this.crit ? 'proj_bulletCrit' : 'proj_bullet', 'fly', 0, dir16(Math.atan2(this.vy, this.vx)), this.x, this.y); break;
        case 'pellet': A.draw(ctx, 'proj_pellet', 'fly', 0, dir16(Math.atan2(this.vy, this.vx)), this.x, this.y); break;
        case 'plasma': A.draw(ctx, 'proj_plasma', 'fly', Math.floor(t * 14) % 4, 0, this.x, this.y); break;
        case 'rocket': A.draw(ctx, 'proj_rocket', 'fly', Math.floor(t * 20) % 2, dir16(this.angle), this.x, this.y); break;
        case 'grenade':
          A.draw(ctx, 'proj_grenade', 'fly', Math.floor(this.angle * 0.6) % 4, 0, this.x, this.y);
          if (this.fuse < 0.4 && Math.floor(this.fuse * 20) % 2) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 1, 3, 3); }
          break;
        case 'acid': A.draw(ctx, 'proj_acid', 'fly', Math.floor(t * 10) % 3, 0, this.x, this.y); break;
        case 'orb': A.draw(ctx, 'proj_orb', 'fly', Math.floor(t * 12) % 4, 0, this.x, this.y); break;
        case 'rift': A.draw(ctx, 'proj_rift', 'fly', Math.floor(t * 12) % 4, 0, this.x, this.y); break;
        default: A.draw(ctx, 'proj_ember', 'fly', Math.floor(t * 12) % 4, 0, this.x, this.y); break;
      }
    }
  }

  HF.Projectile = Projectile;
})(window.HF);
