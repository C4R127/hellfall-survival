'use strict';
/*
 * Enemigos con IA basada en estados: IDLE, CHASE, ATTACK, HURT, SEARCH, DEATH.
 * Cada tipo define un "behavior" que varía cómo persigue y ataca.
 */
(function (HF) {
  const U = HF.U;

  const ENEMIES = {
    crawler: {
      name: 'Rastrero', role: 'Básico', hp: 30, speed: 92, dmg: 9, r: 13, score: 50, xp: 9, coin: 0.4,
      behavior: 'melee', attackCd: 0.9, windup: 0.2, reach: 8, mass: 1, blood: '#8a1a1a',
      desc: 'Criatura débil que ataca en grandes grupos.',
    },
    stalker: {
      name: 'Acechador', role: 'Rápido', hp: 22, speed: 172, dmg: 11, r: 11, score: 80, xp: 11, coin: 0.45,
      behavior: 'melee', lunge: true, attackCd: 0.8, windup: 0.12, reach: 8, mass: 0.7, blood: '#7a2a9a',
      desc: 'Veloz y frágil. Salta sobre su presa.',
    },
    brute: {
      name: 'Coloso', role: 'Tanque', hp: 260, speed: 56, dmg: 24, r: 22, score: 260, xp: 38, coin: 0.9,
      behavior: 'slam', attackCd: 1.7, windup: 0.6, reach: 26, slamR: 82, mass: 5, armor: 0.25, blood: '#4a6a2a',
      desc: 'Montaña de carne blindada. Golpea el suelo con fuerza.',
    },
    spitter: {
      name: 'Escupidor', role: 'A distancia', hp: 48, speed: 78, dmg: 11, r: 13, score: 110, xp: 15, coin: 0.55,
      behavior: 'ranged', range: [220, 380], attackCd: 2.0, windup: 0.35, projSpeed: 300, mass: 1.1, blood: '#6aaa2a',
      desc: 'Mantiene la distancia y escupe ácido.',
    },
    bloater: {
      name: 'Hinchado', role: 'Explosivo', hp: 44, speed: 138, dmg: 32, r: 14, score: 120, xp: 13, coin: 0.5,
      behavior: 'explode', windup: 0.55, reach: 44, explodeR: 95, mass: 1.2, blood: '#e0902a',
      desc: 'Corre hacia ti y estalla. Dispárale de lejos.',
    },
    warlock: {
      name: 'Invocador', role: 'Especial', hp: 130, speed: 68, dmg: 13, r: 15, score: 300, xp: 42, coin: 1,
      behavior: 'summoner', range: [300, 470], attackCd: 2.8, windup: 0.4, summonCd: 6.5, auraR: 170, mass: 1.5, blood: '#9a4aff',
      desc: 'Invoca rastreros y protege con un escudo a sus aliados.',
    },
  };

  let nextId = 1;

  class Enemy {
    constructor() { this.active = false; this.alive = false; this.isBoss = false; }

    init(type, x, y, mods) {
      const d = ENEMIES[type];
      this.id = nextId++;
      this.type = type;
      this.def = d;
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
      this.elite = !!mods.elite;
      const e = this.elite;
      this.maxHp = d.hp * mods.hp * (e ? 2.6 : 1);
      this.hp = this.maxHp;
      this.speed = d.speed * mods.speed * (e ? 1.08 : 1) * U.rand(0.9, 1.1);
      this.dmg = d.dmg * mods.dmg * (e ? 1.4 : 1);
      this.r = d.r * (e ? 1.25 : 1);
      this.scale = e ? 1.25 : 1;
      this.mass = d.mass * (e ? 1.6 : 1);
      this.blood = d.blood;
      this.state = 'idle';
      this.stateT = 0;
      this.atkT = U.rand(0.3, 1);
      this.losT = U.rand(0, 0.25);
      this.hasLos = false;
      this.lastSeenX = x; this.lastSeenY = y;
      this.flash = 0;
      this.slowT = 0;
      this.shielded = false;
      this.walkPhase = Math.random() * 10;
      this.angle = Math.random() * U.TAU;
      this.summonT = d.summonCd ? U.rand(2, d.summonCd) : 0;
      this.lungeT = U.rand(1, 2);
      this.lungeActive = 0;
      this.strafe = Math.random() < 0.5 ? -1 : 1;
      this.strafeT = U.rand(1, 3);
      this.alive = true;
      this.dying = 0;
      this.invulnerable = false;
      this.summoned = !!mods.summoned;
      this.fuseSfx = false;
      return this;
    }

    setState(s, t = 0) { this.state = s; this.stateT = t; }

    update(dt, g) {
      if (!this.alive) {
        this.dying -= dt;
        return this.dying > 0;
      }
      const p = g.player, d = this.def;
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const toP = Math.atan2(dy, dx);

      this.flash -= dt;
      this.slowT -= dt;
      this.atkT -= dt;
      this.losT -= dt;
      if (this.losT <= 0) {
        this.losT = 0.2 + Math.random() * 0.1;
        this.hasLos = dist < 900 && g.map.los(this.x, this.y, p.x, p.y);
        if (this.hasLos) { this.lastSeenX = p.x; this.lastSeenY = p.y; }
      }

      const spd = this.speed * (this.slowT > 0 ? 0.5 : 1) * (g.player.alive ? 1 : 0.3);
      let mvx = 0, mvy = 0, face = null;

      const chaseDir = () => {
        if (this.hasLos) return toP;
        const fd = g.map.flowDir(this.x, this.y);
        return fd === null ? toP : fd;
      };

      switch (this.state) {
        case 'idle': {
          // IDLE: emerge del portal y merodea hasta detectar al jugador
          this.stateT += dt;
          mvx = Math.cos(this.angle) * spd * 0.2;
          mvy = Math.sin(this.angle) * spd * 0.2;
          if ((this.hasLos && dist < 800) || this.stateT > 1.1) this.setState(this.hasLos ? 'chase' : 'search');
          break;
        }
        case 'hurt': {
          // HURT: aturdimiento breve por el impacto
          this.stateT -= dt;
          if (this.stateT <= 0) this.setState(this.hasLos ? 'chase' : 'search');
          break;
        }
        case 'chase':
        case 'search': {
          this.state = this.hasLos ? 'chase' : 'search';
          if (d.behavior === 'ranged' || d.behavior === 'summoner') {
            if (this.hasLos) {
              this.strafeT -= dt;
              if (this.strafeT <= 0) { this.strafeT = U.rand(1.2, 2.8); this.strafe *= -1; }
              let a;
              if (dist > d.range[1]) a = toP;
              else if (dist < d.range[0]) a = toP + Math.PI;
              else a = toP + (Math.PI / 2) * this.strafe;
              mvx = Math.cos(a) * spd; mvy = Math.sin(a) * spd;
              face = toP;
              if (this.atkT <= 0 && dist < d.range[1] + 120) this.setState('attack', d.windup);
            } else {
              const a = chaseDir();
              mvx = Math.cos(a) * spd; mvy = Math.sin(a) * spd;
            }
            if (d.behavior === 'summoner') {
              this.summonT -= dt;
              if (this.summonT <= 0 && g.aliveEnemies < g.waves.maxAlive) {
                this.summonT = d.summonCd;
                g.summon(this, 'crawler', this.elite ? 3 : 2);
              }
            }
          } else {
            const a = chaseDir();
            const sm = this.state === 'search' ? 0.9 : 1;
            mvx = Math.cos(a) * spd * sm; mvy = Math.sin(a) * spd * sm;
            // salto del acechador
            if (d.lunge) {
              this.lungeT -= dt;
              if (this.hasLos && dist < 190 && dist > 50 && this.lungeT <= 0) {
                this.lungeT = U.rand(1.6, 2.6);
                this.lungeActive = 0.22;
                this.kx += Math.cos(toP) * 520; this.ky += Math.sin(toP) * 520;
              }
            }
            const reach = this.r + p.r + d.reach;
            if (dist < reach && this.atkT <= 0) {
              this.setState('attack', d.windup);
              if (d.behavior === 'explode') HF.Audio.play('fuse', { vol: g.sfxVol(this.x, this.y) });
            }
          }
          break;
        }
        case 'attack': {
          // ATTACK: preparación (telegrafiada) y ejecución
          this.stateT -= dt;
          face = toP;
          const slow = d.behavior === 'explode' ? 0.15 : d.behavior === 'slam' ? 0.1 : 0.35;
          mvx = Math.cos(toP) * spd * slow; mvy = Math.sin(toP) * spd * slow;
          if (this.stateT <= 0) this.executeAttack(g, dist, toP);
          break;
        }
      }

      // movimiento con inercia + knockback
      this.vx = U.damp(this.vx, mvx, 8, dt);
      this.vy = U.damp(this.vy, mvy, 8, dt);
      const kd = Math.exp(-6 * dt);
      this.kx *= kd; this.ky *= kd;
      this.x += (this.vx + this.kx) * dt;
      this.y += (this.vy + this.ky) * dt;
      HF.Collision.resolveCircleMap(this, g.map);

      const moveA = Math.atan2(this.vy, this.vx);
      const target = face ?? (Math.abs(this.vx) + Math.abs(this.vy) > 5 ? moveA : this.angle);
      this.angle += U.clamp(U.angleDiff(this.angle, target), -9 * dt, 9 * dt);
      this.walkPhase += dt * (Math.hypot(this.vx, this.vy) * 0.06 + 0.5);
      if (this.lungeActive > 0) this.lungeActive -= dt;
      return true;
    }

    executeAttack(g, dist, toP) {
      const d = this.def, p = g.player;
      this.atkT = d.attackCd || 1;
      switch (d.behavior) {
        case 'melee':
          if (dist < this.r + p.r + d.reach + 10) {
            p.takeDamage(this.dmg, { x: this.x, y: this.y, source: this.type });
            g.particles.burst(p.x, p.y, 5, { type: 'spark', angle: toP, spread: 0.7, speed: [80, 200], life: [0.1, 0.2], size: [1, 2], color: '#ff4a3a' });
          }
          break;
        case 'slam': {
          HF.Audio.play('slam', { vol: g.sfxVol(this.x, this.y) });
          const R = d.slamR * this.scale;
          const sx = this.x + Math.cos(this.angle) * 18, sy = this.y + Math.sin(this.angle) * 18;
          g.shake(5);
          g.particles.spawn('ring', sx, sy, 0, 0, 0.35, R, '#c8b890');
          g.particles.burst(sx, sy, 14, { type: 'debris', speed: [80, 240], life: [0.3, 0.6], size: [3, 6], color: ['#3a3a3a', '#5a5048'], spin: 10 });
          if (U.dist(sx, sy, p.x, p.y) < R + p.r) p.takeDamage(this.dmg, { x: sx, y: sy, source: this.type });
          break;
        }
        case 'explode':
          this.hp = 0;
          this.die(g, { selfDestruct: true });
          return;
        case 'ranged': {
          HF.Audio.play('spit', { vol: g.sfxVol(this.x, this.y) });
          const lead = U.clamp(dist / d.projSpeed, 0, 1) * 0.5;
          const ax = p.x + p.vx * lead, ay = p.y + p.vy * lead;
          const a = U.angleTo(this.x, this.y, ax, ay);
          const n = this.elite ? 3 : 1;
          for (let i = 0; i < n; i++) {
            g.enemyShot(this.x + Math.cos(a) * 14, this.y + Math.sin(a) * 14, a + (i - (n - 1) / 2) * 0.2, d.projSpeed, this.dmg, 6, 'acid', '#9aff3a');
          }
          break;
        }
        case 'summoner': {
          HF.Audio.play('enemyShot', { vol: g.sfxVol(this.x, this.y) });
          for (let i = -1; i <= 1; i++) {
            const pr = g.enemyShot(this.x, this.y, toP + i * 0.3, 210, this.dmg, 7, 'orb', '#c77aff');
            if (pr) pr.homing = 1.3;
          }
          break;
        }
      }
      this.setState(this.hasLos ? 'chase' : 'search');
    }

    takeDamage(g, dmg, opts) {
      if (!this.alive) return 0;
      if (this.shielded) dmg *= 0.5;
      if (this.def.armor) dmg *= 1 - this.def.armor;
      this.hp -= dmg;
      this.flash = 0.08;
      if (opts.kx || opts.ky) {
        this.kx += opts.kx / this.mass;
        this.ky += opts.ky / this.mass;
      }
      if (opts.slow) this.slowT = Math.max(this.slowT, opts.slow);
      if (this.state === 'idle' || this.state === 'search') { this.lastSeenX = g.player.x; this.lastSeenY = g.player.y; }
      if ((opts.stagger || dmg > this.maxHp * 0.25) && this.state !== 'attack' && this.mass < 3) this.setState('hurt', 0.12);
      if (this.hp <= 0) this.die(g, opts);
      return dmg;
    }

    die(g, opts) {
      if (!this.alive) return;
      this.alive = false;
      this.state = 'dead'; // DEATH
      this.dying = 0.22;
      g.onEnemyKilled(this, opts);
      if (this.def.behavior === 'explode') {
        const R = this.def.explodeR * this.scale * (opts && opts.selfDestruct ? 1 : 0.85);
        g.explode(this.x, this.y, R, this.dmg, { byPlayer: !(opts && opts.selfDestruct), hurtPlayer: 1, enemyDmg: 0.6, color: '255,150,40' });
      }
    }

    render(ctx, g) {
      const t = g.time;
      const frame = Math.floor(this.walkPhase) % 2;
      const spr = HF.Sprites.get(this.type, frame);
      let sc = this.scale;
      let alpha = 1;
      if (!this.alive) {
        const k = this.dying / 0.22;
        sc *= 0.6 + 0.4 * k;
        alpha = k;
      } else if (this.state === 'idle' && this.stateT < 0.35) {
        sc *= 0.4 + (this.stateT / 0.35) * 0.6;
      }

      // telegrafiado de ataques
      if (this.alive && this.state === 'attack') {
        const d = this.def;
        const f = 1 - this.stateT / (d.windup || 0.3);
        if (d.behavior === 'slam') {
          const R = d.slamR * this.scale;
          const sx = this.x + Math.cos(this.angle) * 18, sy = this.y + Math.sin(this.angle) * 18;
          ctx.fillStyle = `rgba(255,60,40,${0.12 + f * 0.2})`;
          ctx.beginPath(); ctx.arc(sx, sy, R * f, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,80,60,0.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, sy, R, 0, U.TAU); ctx.stroke();
        } else if (d.behavior === 'explode') {
          const R = d.explodeR * this.scale;
          ctx.strokeStyle = `rgba(255,160,40,${0.3 + f * 0.5})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, U.TAU); ctx.stroke();
          sc *= 1 + f * 0.35 + Math.sin(t * 50) * 0.05;
        }
      }

      // sombra
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x + 3, this.y + 5, this.r * 1.05, this.r * 0.75, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = alpha;

      if (this.elite) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,190,40,0.18)';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.6 + Math.sin(t * 6) * 2, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      const wob = Math.sin(this.walkPhase * Math.PI) * 0.05;
      ctx.scale(sc * (1 + wob), sc * (1 - wob));
      ctx.drawImage(spr.img, -spr.w / 2, -spr.h / 2);
      if (this.flash > 0 || (this.state === 'attack' && this.def.behavior === 'explode' && Math.floor(t * 16) % 2)) {
        ctx.globalAlpha = alpha * 0.85;
        ctx.drawImage(spr.white, -spr.w / 2, -spr.h / 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      if (this.shielded && this.alive) {
        ctx.strokeStyle = 'rgba(190,120,255,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 6, 0, U.TAU); ctx.stroke();
      }
      if (this.slowT > 0 && this.alive && Math.random() < 0.3) {
        g.particles.spawn('spark', this.x + U.rand(-this.r, this.r), this.y + U.rand(-this.r, this.r), U.rand(-40, 40), U.rand(-40, 40), 0.1, 1, '#c9b8ff', { add: true });
      }
      // barra de vida
      if (this.alive && this.hp < this.maxHp) {
        const w = this.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - w / 2, this.y - this.r - 10, w, 4);
        ctx.fillStyle = this.elite ? '#ffbe28' : '#e83a2a';
        ctx.fillRect(this.x - w / 2, this.y - this.r - 10, w * Math.max(0, this.hp / this.maxHp), 4);
      }
    }
  }

  HF.ENEMIES = ENEMIES;
  HF.Enemy = Enemy;
})(window.HF);
