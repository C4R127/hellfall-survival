'use strict';
/*
 * Jefes con 4 fases. Cada fase añade patrones de ataque y aumenta la velocidad.
 *  - Heraldo de la Brecha: ráfagas radiales, embestidas, espirales y golpes de área.
 *  - Matriarca de la Colmena: invoca crías, charcos de ácido, se entierra y emerge.
 */
(function (HF) {
  const U = HF.U;

  const BOSSES = {
    herald: { name: 'HERALDO DE LA BRECHA', hp: 4200, speed: 82, r: 40, dmg: 26, sprite: 'herald', blood: '#c03020', color: '255,90,40' },
    matriarch: { name: 'MATRIARCA DE LA COLMENA', hp: 4600, speed: 70, r: 42, dmg: 24, sprite: 'matriarch', blood: '#7aff3a', color: '140,255,80' },
  };

  let bossId = 1e6;

  class Boss {
    constructor(g, type, tier, x, y) {
      const d = BOSSES[type];
      this.g = g;
      this.id = bossId++;
      this.type = type;
      this.def = d;
      this.isBoss = true;
      this.active = true;
      this.alive = true;
      this.tier = tier;
      this.name = d.name + (tier > 1 ? ' ' + ['', 'II', 'III', 'IV', 'V', 'VI'][Math.min(5, tier - 1)] : '');
      this.maxHp = d.hp * (1 + 0.7 * (tier - 1)) * (1 + 0.04 * HF.U.clamp(g.waves.wave - 10, 0, 100));
      this.hp = this.maxHp;
      this.r = d.r;
      this.mass = 20;
      this.blood = d.blood;
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
      this.angle = Math.PI / 2;
      this.phase = 1;
      this.state = 'intro';
      this.stateT = 2;
      this.invulnerable = true;
      this.flash = 0;
      this.slowT = 0;
      this.walkPhase = 0;
      this.contactT = 0;
      this.timers = { a: 2, b: 3, c: 5, d: 7, e: 9, f: 4 };
      this.spiralT = 0; this.spiralA = 0;
      this.chargeA = 0;
      this.dying = 0;
      this.shielded = false;
      this.hidden = false;
    }

    get speedMult() { return [1, 1, 1.25, 1.4, 1.65][this.phase] * (1 + 0.05 * (this.tier - 1)); }
    get dmg() { return this.def.dmg * (1 + 0.15 * (this.tier - 1)); }

    update(dt, g) {
      if (!this.alive) {
        this.dying -= dt;
        if (Math.random() < 0.5) {
          const a = Math.random() * U.TAU, r = Math.random() * this.r;
          g.particles.spawn('flash', this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, 0, 0, 0.2, U.rand(10, 26), '#ffb060', { add: true });
        }
        return this.dying > 0;
      }
      const p = g.player;
      const toP = U.angleTo(this.x, this.y, p.x, p.y);
      const dist = U.dist(this.x, this.y, p.x, p.y);
      this.flash -= dt;
      this.slowT -= dt;
      this.contactT -= dt;
      this.walkPhase += dt * 3;

      let mvx = 0, mvy = 0;
      const spd = this.def.speed * this.speedMult * (this.slowT > 0 ? 0.8 : 1);

      switch (this.state) {
        case 'intro':
          this.stateT -= dt;
          if (this.stateT <= 0) { this.state = 'fight'; this.invulnerable = false; }
          break;

        case 'transition':
          this.stateT -= dt;
          if (this.stateT <= 0) { this.state = 'fight'; this.invulnerable = false; }
          break;

        case 'fight': {
          // movimiento: acercarse manteniendo cierta distancia
          let a = toP;
          if (!g.map.los(this.x, this.y, p.x, p.y)) { const fd = g.map.flowDir(this.x, this.y); if (fd !== null) a = fd; }
          const keep = this.type === 'herald' ? 160 : 220;
          const m = dist > keep ? 1 : dist < keep * 0.6 ? -0.6 : 0.2;
          mvx = Math.cos(a) * spd * m; mvy = Math.sin(a) * spd * m;
          this.angle += U.clamp(U.angleDiff(this.angle, toP), -3 * dt, 3 * dt);
          this.runPatterns(dt, g, toP, dist);
          break;
        }

        case 'windup': // telegrafiado de embestida
          this.stateT -= dt;
          this.angle = this.chargeA;
          if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 0.75; HF.Audio.play('roar'); }
          break;

        case 'charge': {
          this.stateT -= dt;
          const cs = 640 * (1 + 0.1 * (this.phase - 2));
          this.vx = Math.cos(this.chargeA) * cs; this.vy = Math.sin(this.chargeA) * cs;
          if (Math.random() < 0.6) g.particles.spawn('smoke', this.x, this.y, U.rand(-30, 30), U.rand(-30, 30), 0.5, 10, '#533', { grow: 20 });
          if (this.stateT <= 0) this.state = 'fight';
          break;
        }

        case 'stunned':
          this.stateT -= dt;
          if (this.stateT <= 0) this.state = 'fight';
          break;

        case 'burrow':
          this.stateT -= dt;
          if (this.stateT <= 0) this.emerge(g);
          break;
      }

      if (this.state !== 'charge') {
        this.vx = U.damp(this.vx, mvx, 5, dt);
        this.vy = U.damp(this.vy, mvy, 5, dt);
      }
      const kd = Math.exp(-6 * dt);
      this.kx *= kd; this.ky *= kd;
      if (!this.hidden) {
        this.x += (this.vx + this.kx) * dt;
        this.y += (this.vy + this.ky) * dt;
      }
      const hit = HF.Collision.resolveCircleMap(this, g.map);
      if (hit && this.state === 'charge') {
        this.state = 'stunned'; this.stateT = 1.1;
        this.vx = this.vy = 0;
        g.shake(10);
        HF.Audio.play('slam');
        this.ring(g, 14, 230, 0, '#ff7a4a');
        g.particles.burst(this.x, this.y, 20, { type: 'debris', speed: [100, 300], life: [0.4, 0.8], size: [3, 7], color: ['#444', '#665a50'], spin: 12 });
      }

      // daño por contacto
      if (!this.hidden && this.contactT <= 0 && dist < this.r + p.r) {
        this.contactT = 0.7;
        p.takeDamage(this.dmg * (this.state === 'charge' ? 1.4 : 0.8), { x: this.x, y: this.y, source: 'boss' });
      }

      // cambio de fase
      const f = this.hp / this.maxHp;
      const np = f > 0.75 ? 1 : f > 0.5 ? 2 : f > 0.25 ? 3 : 4;
      if (np > this.phase && this.state !== 'burrow') this.enterPhase(np, g);
      return true;
    }

    enterPhase(np, g) {
      this.phase = np;
      this.state = 'transition';
      this.stateT = 1.1;
      this.invulnerable = true;
      this.vx = this.vy = 0;
      HF.Audio.play('roar');
      g.shake(12);
      g.particles.spawn('ring', this.x, this.y, 0, 0, 0.6, 300, '#ff5a3a', { add: true });
      g.particles.light(this.x, this.y, 400, this.def.color, 1, 0.5);
      const p = g.player;
      const a = U.angleTo(this.x, this.y, p.x, p.y);
      if (U.dist(this.x, this.y, p.x, p.y) < 320) { p.kx += Math.cos(a) * 700; p.ky += Math.sin(a) * 700; }
      g.ui.banner(np === 4 ? 'FASE FINAL' : 'FASE ' + np, np === 4 ? 'El jefe está enfurecido' : 'El jefe se vuelve más peligroso', 1.6);
      g.forEachEnemyProjectile((pr) => g.projectiles.release(pr));
      if (np >= 3) g.summon(this, this.type === 'herald' ? 'stalker' : 'crawler', 3 + this.tier);
    }

    runPatterns(dt, g, toP, dist) {
      const T = this.timers, ph = this.phase;
      for (const k in T) T[k] -= dt;

      if (this.spiralT > 0) {
        this.spiralT -= dt;
        this.spiralCd = (this.spiralCd || 0) - dt;
        if (this.spiralCd <= 0) {
          this.spiralCd = ph >= 4 ? 0.06 : 0.08;
          this.spiralA += 0.33;
          const arms = ph >= 4 ? 3 : 2;
          for (let i = 0; i < arms; i++) this.shoot(g, this.spiralA + (i * U.TAU) / arms, 190, 8, '#ff9a3a');
        }
      }

      if (this.type === 'herald') {
        if (T.a <= 0) { // ráfaga radial
          T.a = [0, 2.6, 2.2, 2.0, 1.6][ph];
          this.ring(g, [0, 14, 18, 22, 26][ph], 190 + 20 * ph, Math.random(), '#ff5a3a');
          HF.Audio.play('enemyShot');
        }
        if (T.b <= 0) { // disparo dirigido en abanico
          T.b = 1.6;
          const n = ph >= 3 ? 5 : 3;
          for (let i = 0; i < n; i++) this.shoot(g, toP + (i - (n - 1) / 2) * 0.16, 300, 7, '#ffd040');
        }
        if (ph >= 2 && T.c <= 0) { // embestida
          T.c = ph >= 4 ? 3.6 : 5;
          this.state = 'windup'; this.stateT = 0.75; this.chargeA = toP;
          this.vx = this.vy = 0;
        }
        if (ph >= 3 && T.d <= 0) { T.d = 7; this.spiralT = 2.4; }
        if (ph >= 3 && T.e <= 0) { T.e = 11; g.summon(this, 'stalker', 3 + this.tier); }
        if (ph >= 4 && T.f <= 0) { // golpes de área sobre el jugador
          T.f = 3.6;
          const p = g.player;
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * U.TAU, r = i === 0 ? 0 : U.rand(60, 140);
            g.addHazard({ kind: 'telegraph', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 85, delay: 0.85 + i * 0.25, dmg: this.dmg, color: '255,70,40' });
          }
        }
      } else {
        if (T.a <= 0) { // escupitajo en abanico
          T.a = [0, 1.9, 1.7, 1.5, 1.2][ph];
          const n = ph >= 3 ? 7 : 5;
          for (let i = 0; i < n; i++) this.shoot(g, toP + (i - (n - 1) / 2) * 0.14, 260, 8, '#9aff3a', 'acid');
          HF.Audio.play('spit');
        }
        if (T.b <= 0) { // crías
          T.b = [0, 5, 4.5, 4, 3.5][ph];
          if (g.aliveEnemies < g.waves.maxAlive) g.summon(this, U.chance(0.25 * ph) ? 'bloater' : 'crawler', 2 + Math.floor(ph / 2) + this.tier);
        }
        if (ph >= 2 && T.c <= 0) { // charcos de ácido
          T.c = 4;
          const p = g.player;
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * U.TAU, r = i === 0 ? 0 : U.rand(70, 150);
            g.addHazard({ kind: 'telegraph', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 70, delay: 0.9, dmg: this.dmg * 0.6, color: '140,255,60', leaveAcid: true });
          }
        }
        if (ph >= 3 && T.d <= 0) { // enterrarse
          T.d = 9;
          this.state = 'burrow'; this.stateT = 1.3;
          this.hidden = true; this.invulnerable = true;
          g.particles.burst(this.x, this.y, 30, { type: 'debris', speed: [80, 260], life: [0.4, 0.9], size: [3, 7], color: ['#3a3020', '#5a4a30'], spin: 10 });
          g.shake(6);
          HF.Audio.play('slam');
        }
        if (ph >= 4 && T.e <= 0) { T.e = 6; this.spiralT = 2.2; }
      }
    }

    emerge(g) {
      const p = g.player;
      let placed = false;
      for (let i = 0; i < 12 && !placed; i++) {
        const a = Math.random() * U.TAU, r = U.rand(170, 240);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (g.map.isFreeCircle(x, y, this.r + 4)) { this.x = x; this.y = y; placed = true; }
      }
      this.hidden = false;
      this.invulnerable = false;
      this.state = 'fight';
      g.shake(10);
      HF.Audio.play('roar');
      this.ring(g, 20, 220, Math.random(), '#9aff3a', 'acid');
      g.particles.burst(this.x, this.y, 30, { type: 'debris', speed: [100, 320], life: [0.4, 0.9], size: [3, 7], color: ['#3a3020', '#5a4a30'], spin: 10 });
      if (U.dist(this.x, this.y, p.x, p.y) < this.r + 70) p.takeDamage(this.dmg, { x: this.x, y: this.y });
    }

    shoot(g, a, speed, r, color, type = 'boss') {
      g.enemyShot(this.x + Math.cos(a) * this.r * 0.7, this.y + Math.sin(a) * this.r * 0.7, a, speed, this.dmg * 0.55, r, type, color);
    }
    ring(g, n, speed, offset, color, type) {
      for (let i = 0; i < n; i++) this.shoot(g, offset + (i / n) * U.TAU, speed, 8, color, type);
    }

    takeDamage(g, dmg, opts) {
      if (!this.alive || this.invulnerable) return 0;
      this.hp -= dmg;
      this.flash = 0.06;
      if (opts.slow) this.slowT = 0.5;
      if (this.hp <= 0) this.die(g, opts);
      return dmg;
    }

    die(g, opts) {
      if (!this.alive) return;
      this.hp = 0;
      this.alive = false;
      this.dying = 1.6;
      g.onBossKilled(this, opts);
    }

    render(ctx, g) {
      const t = g.time;
      if (this.hidden) {
        // montículo en movimiento
        ctx.fillStyle = 'rgba(60,50,30,0.6)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 30 + Math.sin(t * 20) * 4, 22, 0, 0, U.TAU); ctx.fill();
        return;
      }
      if (this.state === 'windup') {
        ctx.strokeStyle = `rgba(255,60,40,${0.4 + Math.sin(t * 30) * 0.3})`;
        ctx.lineWidth = this.r * 1.6;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.chargeA) * 700, this.y + Math.sin(this.chargeA) * 700);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const spr = HF.Sprites.get(this.def.sprite, Math.floor(this.walkPhase) % 2);
      let sc = 1, alpha = 1;
      if (this.state === 'intro') { const k = 1 - this.stateT / 2; sc = 0.3 + 0.7 * k; alpha = k; }
      if (!this.alive) { const k = this.dying / 1.6; sc = 0.7 + 0.3 * k; alpha = k; }

      ctx.globalAlpha = 0.45 * alpha;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x + 5, this.y + 9, this.r * 1.05, this.r * 0.8, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = alpha;

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${this.def.color},${0.08 + this.phase * 0.03})`;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.5 + Math.sin(t * 5) * 4, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      const pulse = 1 + Math.sin(t * (2 + this.phase)) * 0.03;
      ctx.scale(sc * pulse, sc * pulse);
      ctx.drawImage(spr.img, -spr.w / 2, -spr.h / 2);
      if (this.flash > 0 || this.state === 'transition' && Math.floor(t * 20) % 2) {
        ctx.globalAlpha = 0.8 * alpha;
        ctx.drawImage(spr.white, -spr.w / 2, -spr.h / 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (this.state === 'stunned') {
        ctx.fillStyle = '#ffd040';
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * U.TAU) / 3;
          ctx.fillRect(this.x + Math.cos(a) * 26 - 3, this.y - this.r - 8 + Math.sin(a) * 6, 6, 6);
        }
      }
    }
  }

  HF.BOSSES = BOSSES;
  HF.Boss = Boss;
})(window.HF);
