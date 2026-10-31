'use strict';
/*
 * Jefes con 4 fases. Cada fase añade patrones de ataque y aumenta la velocidad.
 *  - El Carcelero (Sector 7): ráfagas radiales, embestidas, golpes de área y cadenas que atraen.
 *  - La Forja Viviente (Fundición): anillos de fuego con hueco, lluvia de escoria y martillazos.
 *  - Arconte del Vacío (Criogenia): rayos telegrafiados, orbes rastreadores y teletransporte.
 *  - Núcleo de Ruptura (La Brecha): invoca crías, zonas de ruptura y atraviesa grietas.
 */
(function (HF) {
  const U = HF.U;

  const BOSSES = {
    herald: { name: 'EL CARCELERO', hp: 5400, speed: 82, r: 40, dmg: 30, sprite: 'herald', blood: '#c03020', color: '255,90,40' },
    matriarch: { name: 'NÚCLEO DE RUPTURA', hp: 6000, speed: 70, r: 42, dmg: 24, sprite: 'matriarch', blood: '#7aff3a', color: '140,255,80' },
    forge: { name: 'LA FORJA VIVIENTE', hp: 6600, speed: 58, r: 44, dmg: 30, sprite: 'forge', blood: '#ff8a2a', color: '255,130,40' },
    archon: { name: 'ARCONTE DEL VACÍO', hp: 5700, speed: 92, r: 36, dmg: 26, sprite: 'archon', blood: '#b07aff', color: '190,110,255' },
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
          const los = g.map.los(this.x, this.y, p.x, p.y);
          if (!los) { const fd = g.map.flowDir(this.x, this.y); if (fd !== null) a = fd; }
          // detección de atasco: si no avanza y no ve al jugador, salta cerca de él
          this.stuckT = (this.stuckT || 0) + dt;
          if (this.stuckT > 1.5) {
            const moved = U.dist(this.x, this.y, this.lastX ?? this.x, this.lastY ?? this.y);
            if (moved < 40 && !los) this.relocate(g);
            this.stuckT = 0; this.lastX = this.x; this.lastY = this.y;
          }
          const keep = { herald: 160, matriarch: 220, forge: 140, archon: 300 }[this.type];
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
          if (Math.random() < 0.3) HF.FX.smoke(this.x + U.rand(-20, 20), this.y + U.rand(-20, 20), U.rand(-20, 20), U.rand(-20, 20));
          if (this.stateT <= 0) this.state = 'fight';
          break;
        }

        case 'stunned':
          this.stateT -= dt;
          if (this.stateT <= 0) this.state = 'fight';
          break;

        case 'rooted': // inmóvil mientras canaliza un ataque telegrafiado
          this.stateT -= dt;
          if (this.wellRingT !== undefined && this.stateT < 3.2) {
            this.wellRingT -= dt;
            if (this.wellRingT <= 0) { this.wellRingT = 0.9; this.ring(g, 14, 150, Math.random(), '#ff4af0', 'rift'); }
            if (this.stateT <= 0) this.wellRingT = undefined;
          }
          this.angle += U.clamp(U.angleDiff(this.angle, toP), -1.5 * dt, 1.5 * dt);
          if (this.stateT <= 0) {
            this.state = 'fight';
            if (this.onRootEnd) { const f = this.onRootEnd; this.onRootEnd = null; f(); }
          }
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
      if (np === 4) HF.Story.onBossFinalPhase(this.type);
      g.ui.banner(np === 4 ? 'FASE FINAL' : 'FASE ' + np, np === 4 ? 'El jefe está enfurecido' : 'El jefe se vuelve más peligroso', 1.6);
      g.forEachEnemyProjectile((pr) => g.projectiles.release(pr));
      if (np >= 3) g.summon(this, { herald: 'stalker', matriarch: 'crawler', forge: 'bloater', archon: 'phantom' }[this.type], (this.type === 'forge' || this.type === 'archon' ? 1 : 3) + this.tier);
    }

    runPatterns(dt, g, toP, dist) {
      const T = this.timers, ph = this.phase;
      for (const k in T) T[k] -= dt;

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
        if (ph >= 3 && T.d <= 0) { // CADENAS: lanza un garfio telegrafiado; si te alcanza, te arrastra hacia él
          T.d = ph >= 4 ? 4.2 : 6.5;
          const fan = ph >= 4 ? [-0.35, 0, 0.35] : [0];
          for (const o of fan) g.addHazard({ kind: 'chain', boss: this, x: this.x, y: this.y, a: toP + o, len: 560, w: 14, delay: 0.65, life: 0.12, dmg: this.dmg * 0.5, color: '210,190,160' });
          this.state = 'rooted'; this.stateT = 0.9; this.vx = this.vy = 0;
          HF.Audio.play('reload');
        }
        if (ph >= 3 && T.e <= 0) { T.e = 11; g.summon(this, 'stalker', 3 + this.tier); }
        if (ph >= 4 && T.f <= 0) { // golpes de área sobre el jugador
          T.f = 3.6;
          const p = g.player;
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * U.TAU, r = i === 0 ? 0 : U.rand(60, 140);
            g.addHazard({ src: 'boss_area', kind: 'telegraph', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 85, delay: 0.85 + i * 0.25, dmg: this.dmg, color: '255,70,40' });
          }
        }
      } else if (this.type === 'forge') {
        this.patternsForge(g, T, ph, toP);
      } else if (this.type === 'archon') {
        this.patternsArchon(g, T, ph, toP);
      } else {
        if (T.a <= 0) { // escupitajo en abanico
          T.a = [0, 1.9, 1.7, 1.5, 1.2][ph];
          const n = ph >= 3 ? 7 : 5;
          for (let i = 0; i < n; i++) this.shoot(g, toP + (i - (n - 1) / 2) * 0.14, 260, 8, '#7ff6ff', 'rift');
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
            g.addHazard({ src: 'boss_area', kind: 'telegraph', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 70, delay: 0.9, dmg: this.dmg * 0.6, color: '255,74,240', leaveAcid: true });
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
        if (ph >= 4 && T.e <= 0) { // COLAPSO: pozo gravitatorio que arrastra hacia el núcleo mientras dispara anillos
          T.e = 9;
          g.addHazard({ kind: 'well', boss: this, x: this.x, y: this.y, r: 420, delay: 0.9, life: 3.2, force: 120, color: '255,74,240' });
          this.state = 'rooted'; this.stateT = 4.1; this.vx = this.vy = 0;
          this.wellRingT = 1.2;
          HF.Audio.play('boss');
          g.ui.toast('¡COLAPSO DIMENSIONAL!', 'power');
        }
      }
    }

    /** Salto de reposicionamiento (evita quedarse atascado en esquinas). */
    relocate(g) {
      const p = g.player;
      for (let k = 0; k < 24; k++) {
        const a = Math.random() * U.TAU, r = U.rand(260, 380);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (g.map.isFreeCircle(x, y, this.r + 6) && g.map.los(x, y, p.x, p.y)) {
          HF.FX.smoke(this.x, this.y); HF.FX.smoke(this.x + 10, this.y - 8);
          this.x = x; this.y = y; this.vx = this.vy = 0;
          g.shake(6);
          HF.Audio.play('slam', { vol: g.sfxVol(x, y) });
          g.particles.spawn('ring', x, y, 0, 0, 0.4, this.r * 2, '#c8b890');
          for (let i = 0; i < 3; i++) HF.FX.smoke(x + U.rand(-20, 20), y + U.rand(-20, 20));
          return true;
        }
      }
      return false;
    }

    /* ---- La Forja Viviente ---- */
    patternsForge(g, T, ph, toP) {
      const p = g.player;
      if (T.a <= 0) { // anillo de fuego con un hueco para esquivar
        T.a = [0, 3, 2.6, 2.2, 1.8][ph];
        const n = 16 + ph * 3, gap = Math.floor(Math.random() * n), off = Math.random();
        for (let i = 0; i < n; i++) if (Math.abs(i - gap) > 1) this.shoot(g, off + (i / n) * U.TAU, 165 + ph * 15, 8, '#ff8a2a');
        HF.Audio.play('enemyShot');
      }
      if (T.b <= 0) { // lluvia de escoria que deja charcos ardientes
        T.b = [0, 4.6, 4, 3.4, 2.8][ph];
        for (let i = 0; i < 1 + ph; i++) {
          const a = Math.random() * U.TAU, r = i === 0 ? 0 : U.rand(70, 210);
          g.addHazard({ src: 'boss_area', kind: 'telegraph', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 60, delay: 1.15 + i * 0.12, dmg: this.dmg * 0.6, color: '255,120,40', leaveAcid: true, poolDps: 9 });
        }
      }
      if (ph >= 2 && T.c <= 0) { // martillazo: área alrededor del jefe y onda de fuego
        T.c = ph >= 4 ? 5 : 6.5;
        this.state = 'rooted'; this.stateT = 0.85; this.vx = this.vy = 0;
        g.addHazard({ src: 'boss_area', kind: 'telegraph', x: this.x, y: this.y, r: 150, delay: 0.85, dmg: this.dmg, color: '255,90,30' });
        this.onRootEnd = () => { g.shake(12); this.ring(g, 24, 230, Math.random(), '#ffb040'); };
      }
      if (ph >= 3 && T.d <= 0) { T.d = 12; g.summon(this, 'bloater', 2 + this.tier); }
      if (ph >= 3 && T.e <= 0) { T.e = 14; g.summon(this, 'mortar', 1); }
      if (ph >= 4 && T.f <= 0) { // MAREA DE ESCORIA: los charcos crecen y brota uno nuevo bajo el jefe
        T.f = 7;
        for (const h of g.hazards) if (h.kind === 'acid') { h.targetR = Math.min(170, (h.targetR || h.r) + 34); h.life = Math.max(h.life, 7); }
        g.hazards.push({ kind: 'acid', x: this.x, y: this.y, r: 30, targetR: 120, life: 9, t: 0, tick: 0, dps: 16, color: '255,120,40' });
        g.particles.text(this.x, this.y - this.r - 20, '¡LA ESCORIA SE EXPANDE!', '#ffb040', 16, 1.4);
        g.shake(8);
        HF.Audio.play('slam');
      }
    }

    /* ---- Arconte del Vacío ---- */
    patternsArchon(g, T, ph, toP) {
      if (T.a <= 0) { // orbes rastreadores en abanico
        T.a = [0, 2.2, 1.9, 1.6, 1.3][ph];
        const n = ph >= 3 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const pr = g.enemyShot(this.x, this.y, toP + (i - (n - 1) / 2) * 0.32, 200, this.dmg * 0.5, 7, 'orb', '#c77aff');
          if (pr) pr.homing = 1.1;
        }
        this.attackVis = 0.25;
        HF.Audio.play('enemyShot');
      }
      if (T.b <= 0) { // rayo del vacío: telegrafiado, el jefe se detiene
        T.b = [0, 4.4, 3.8, 3.2, 2.6][ph];
        const fan = ph >= 3 ? [-0.5, 0, 0.5] : [0];
        for (const o of fan) g.addHazard({ kind: 'beam', x: this.x, y: this.y, a: toP + o, len: 950, w: 18, delay: 0.95, life: 0.45, dmg: this.dmg * 1.1, color: '190,110,255' });
        this.state = 'rooted'; this.stateT = 1.4; this.vx = this.vy = 0;
        HF.Audio.play('shield');
      }
      if (T.c <= 0) { // teletransporte
        T.c = ph >= 3 ? 5.5 : 7.5;
        this.state = 'burrow'; this.stateT = 0.7;
        this.hidden = true; this.invulnerable = true;
        g.particles.anim('fx_portalViolet', this.x, this.y, { speed: 1.5 });
        HF.Audio.play('summon');
      }
      if (ph >= 2 && T.d <= 0) { T.d = 10; g.summon(this, 'phantom', 1 + this.tier); }
      if (ph >= 4 && T.e <= 0) { // ESPEJISMOS: se teletransporta y crea copias que disparan
        T.e = 11;
        const p = g.player;
        const n = 2 + Math.min(2, this.tier);
        const off = Math.random() * U.TAU;
        const mods = { hp: 1 + 0.4 * (this.tier - 1), dmg: 1 + 0.15 * (this.tier - 1), speed: 1, summoned: true };
        for (let i = 0; i < n; i++) {
          const a = off + (i / (n + 1)) * U.TAU, r = 300;
          const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
          if (g.map.isFreeCircle(x, y, 32)) g.addSpawnMarker(x, y, 'mirage', false, mods, 0.5);
        }
        this.state = 'burrow'; this.stateT = 0.7; this.hidden = true; this.invulnerable = true;
        g.particles.anim('fx_portalViolet', this.x, this.y, { speed: 1.5 });
        g.ui.toast('¡ESPEJISMOS! Encuentra al Arconte real', 'power');
        HF.Audio.play('summon');
      }
    }

    emerge(g) {
      const p = g.player;
      let placed = false;
      const far = this.type === 'archon';
      for (let i = 0; i < 12 && !placed; i++) {
        const a = Math.random() * U.TAU, r = far ? U.rand(240, 340) : U.rand(170, 240);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (g.map.isFreeCircle(x, y, this.r + 4)) { this.x = x; this.y = y; placed = true; }
      }
      this.hidden = false;
      this.invulnerable = false;
      this.state = 'fight';
      g.shake(10);
      HF.Audio.play('roar');
      if (far) {
        g.particles.anim('fx_portalViolet', this.x, this.y, { speed: 1.5 });
        this.ring(g, 12, 180, Math.random(), '#c77aff', 'orb');
      } else {
        this.ring(g, 20, 220, Math.random(), '#7ff6ff', 'rift');
        g.particles.burst(this.x, this.y, 30, { type: 'debris', speed: [100, 320], life: [0.4, 0.9], size: [3, 7], color: ['#3a3020', '#5a4a30'], spin: 10 });
      }
      if (U.dist(this.x, this.y, p.x, p.y) < this.r + 70) p.takeDamage(this.dmg, { x: this.x, y: this.y, source: 'boss' });
    }

    shoot(g, a, speed, r, color, type) {
      type = type || (this.type === 'matriarch' || this.type === 'archon' ? 'rift' : 'boss');
      this.attackVis = 0.25;
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
      this.dying = 1.6; // animación de muerte del jefe (visual)
      g.onBossKilled(this, opts);
    }

    /* ---------------- presentación ---------------- */
    animate(dt) {
      if (!this.anim) this.anim = new HF.Animator();
      const a = this.anim;
      const sheet = 'boss_' + this.type + (this.phase >= 3 ? '_rage' : '');
      this.attackVis = Math.max(0, (this.attackVis || 0) - dt);
      if (!this.alive) { a.set(sheet, 'death'); a.update(dt); return; }
      switch (this.state) {
        case 'windup': a.set(sheet, 'windup'); a.progress(1 - this.stateT / 0.75); return;
        case 'charge': a.set(sheet, 'move'); a.update(dt, 2.4); return;
        case 'stunned': case 'transition': a.set(sheet, 'hurt'); return;
        case 'burrow': a.set(sheet, 'phase'); a.progress(1 - this.stateT / (this.type === 'archon' ? 0.7 : 1.3)); return;
        case 'rooted': a.set(sheet, 'windup'); a.progress(0.99); return;
      }
      if (this.attackVis > 0) { a.set(sheet, 'attack'); a.progress(1 - this.attackVis / 0.25); return; }
      const sp = Math.hypot(this.vx, this.vy);
      a.set(sheet, sp > 10 ? 'move' : 'idle');
      a.update(dt);
    }

    render(ctx, g) {
      const A = HF.Assets, t = g.time;
      if (!this.anim) this.animate(0);
      if (this.hidden) {
        // grieta dimensional por la que se desplaza
        A.draw(ctx, 'fx_portalViolet', 'play', 4 + (Math.floor(t * 10) % 4), 0, this.x, this.y, { alpha: 0.9 });
        ctx.fillStyle = '#ff4af0';
        HF.PX.ring(ctx, this.x, this.y, 18 + Math.floor((t * 30) % 8), 1);
        return;
      }
      if (this.state === 'windup') {
        // franja de embestida tramada
        ctx.fillStyle = '#ff3a2a';
        ctx.globalAlpha = 0.35 + (Math.floor(t * 16) % 2) * 0.25;
        const c = Math.cos(this.chargeA), s = Math.sin(this.chargeA);
        for (let d = 0; d < 680; d += 3) {
          for (let w = -this.r * 0.8; w <= this.r * 0.8; w += 3) {
            if (((d + w) / 3) & 1) continue;
            ctx.fillRect(Math.round(this.x + c * d - s * w), Math.round(this.y + s * d + c * w), 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }
      let alpha = 1;
      if (this.state === 'intro') alpha = Math.min(1, 1 - this.stateT / 2 + 0.15);
      if (!this.alive) alpha = Math.min(1, this.dying / 0.4);
      A.drawImage(ctx, 'shadow_xl', this.x + 4, this.y + 18, { alpha: alpha * 0.9 });
      const flash = this.flash > 0.03 ? 0.4 : this.state === 'transition' && Math.floor(t * 20) % 2 ? 0.7 : 0;
      this.anim.draw(ctx, A.dirIndex(this.angle, 8), this.x, this.y, { alpha, flash });
      if (this.state === 'stunned') {
        ctx.fillStyle = '#ffd040';
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * U.TAU) / 3;
          ctx.fillRect(Math.round(this.x + Math.cos(a) * 26) - 2, Math.round(this.y - this.r - 8 + Math.sin(a) * 6) - 2, 4, 4);
        }
      }
    }
  }

  HF.BOSSES = BOSSES;
  HF.Boss = Boss;
})(window.HF);
