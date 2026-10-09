'use strict';
/*
 * Game: bucle principal, actualización, renderizado y estado general.
 * Orden del ciclo: Input → Update → AI → Physics → Collision → Combat → Particles → Render
 */
(function (HF) {
  const U = HF.U;
  const tmp = [];

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = HF.UI;
      this.map = new HF.GameMap();
      this.enemies = new HF.Pool(() => new HF.Enemy(), 260);
      this.projectiles = new HF.Pool(() => new HF.Projectile(), 1100);
      this.items = new HF.Pool(() => new HF.Item(), 260);
      this.particles = new HF.ParticleSystem(this);
      this.hash = new HF.SpatialHash(64);
      this.spawnMarkers = [];
      this.hazards = [];
      this.barrels = [];
      this.boss = null;
      this.player = null;
      this.waves = null;
      this.state = 'menu';
      this.time = 0;
      this.cam = { x: this.map.pw / 2, y: this.map.ph / 2 };
      this.view = { x: 0, y: 0, w: 100, h: 100 };
      this.shakeAmt = 0;
      this.combo = 0;
      this.comboT = 0;
      this.pendingLevelUps = 0;
      this.aliveEnemies = 0;
      this.deathT = 0;
      this.fps = 60; this.fpsAcc = 0; this.fpsFrames = 0;
      this.last = performance.now();
      this.run = this.freshRun();
      this.glowCache = {};
      this.buildLightSprites();
      this.applySettings(HF.SaveManager.settings);
      this.resize();
      addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
      document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && this.state === 'playing' && HF.Input.pointerLock) this.pause();
      });
    }

    freshRun() {
      return { score: 0, kills: 0, time: 0, shots: 0, coinsEarned: 0, bosses: 0, bestCombo: 0, damage: 0, killsByType: {}, modulesBought: 0, scoreAcc: 0 };
    }

    /* ---------------- configuración / pantalla ---------------- */
    applySettings(s) {
      this.settings = s;
      this.quality = s.quality;
      this.particles.density = s.quality === 'low' ? 0.45 : s.quality === 'medium' ? 0.75 : 1;
      HF.Input.sensitivity = s.sensitivity;
      HF.Input.pointerLock = s.pointerLock;
      HF.Input.setBindings(s.bindings);
      HF.Audio.applySettings(s);
      this.resize();
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2);
      this.dpr = dpr;
      this.canvas.width = Math.floor(innerWidth * dpr);
      this.canvas.height = Math.floor(innerHeight * dpr);
      this.zoom = U.clamp(Math.min(innerWidth / 1280, innerHeight / 760) * 1.3, 0.85, 2);
      this.scale = this.zoom * dpr;
      const lr = this.quality === 'high' ? 0.5 : 0.33;
      this.lightCanvas = U.makeCanvas(Math.max(1, Math.floor(this.canvas.width * lr)), Math.max(1, Math.floor(this.canvas.height * lr)));
      this.lctx = this.lightCanvas.getContext('2d');
      this.lightRes = lr;
    }
    buildLightSprites() {
      const c = U.makeCanvas(128, 128), x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      this.lightSprite = c;
      // cono de la linterna
      const k = U.makeCanvas(512, 360), kx = k.getContext('2d');
      const kg = kx.createRadialGradient(0, 180, 0, 0, 180, 512);
      kg.addColorStop(0, 'rgba(255,255,255,0.95)');
      kg.addColorStop(0.6, 'rgba(255,255,255,0.45)');
      kg.addColorStop(1, 'rgba(255,255,255,0)');
      kx.fillStyle = kg;
      kx.beginPath(); kx.moveTo(0, 168); kx.lineTo(512, 0); kx.lineTo(512, 360); kx.lineTo(0, 192); kx.closePath(); kx.fill();
      this.coneSprite = k;
    }
    glow(color) {
      let c = this.glowCache[color];
      if (c) return c;
      c = U.makeCanvas(64, 64);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `rgba(${color},0.9)`);
      g.addColorStop(1, `rgba(${color},0)`);
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return (this.glowCache[color] = c);
    }

    mouseWorld() {
      const m = HF.Input.mouse;
      return { x: this.view.x + m.sx / this.zoom, y: this.view.y + m.sy / this.zoom };
    }
    shake(n) { if (this.settings.shake) this.shakeAmt = Math.min(18, this.shakeAmt + n); }
    sfxVol(x, y) {
      if (!this.player) return 0.6;
      return U.clamp(1 - U.dist(x, y, this.player.x, this.player.y) / 1100, 0.08, 1);
    }

    /* ---------------- partida ---------------- */
    newRun() {
      this.enemies.clear();
      this.projectiles.clear();
      this.items.clear();
      this.particles.clear();
      this.spawnMarkers.length = 0;
      this.hazards.length = 0;
      this.boss = null;
      this.map.clearDecals();
      this.map.flowTile = -1;
      this.run = this.freshRun();
      this.combo = 0; this.comboT = 0;
      this.pendingLevelUps = 0;
      this.time = 0;
      this.player = new HF.Player(this);
      this.waves = new HF.WaveManager(this);
      this.respawnBarrels();
      this.cam.x = this.player.x; this.cam.y = this.player.y;
      this.state = 'playing';
      HF.Audio.playMusic('combat');
      this.ui.startRun();
      this.ui.banner('SECTOR 7', 'Prepárate. La primera oleada llega en 4 s', 2.5);
      this.lockPointer();
    }
    lockPointer() {
      if (HF.Input.pointerLock && this.canvas.requestPointerLock) {
        try { this.canvas.requestPointerLock(); } catch (e) { /* requiere gesto del usuario */ }
      }
    }
    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.showPause();
    }
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      this.ui.hideOverlays();
      this.lockPointer();
    }
    quitToMenu() {
      if (this.player && (this.state === 'paused' || this.state === 'playing')) this.recordRun(false);
      this.state = 'menu';
      this.player = null;
      this.boss = null;
      this.enemies.clear(); this.projectiles.clear(); this.items.clear(); this.spawnMarkers.length = 0; this.hazards.length = 0;
      HF.Audio.playMusic('menu');
      this.ui.showMenu();
    }

    respawnBarrels() {
      this.barrels = this.map.barrelSpots.map((s) => ({ x: s.x, y: s.y, r: 13, hp: 25, alive: true, fuse: -1 }));
      if (this.player) this.barrels = this.barrels.filter((b) => U.dist2(b.x, b.y, this.player.x, this.player.y) > 60 * 60);
    }

    /* ---------------- bucle ---------------- */
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.fpsAcc += dt; this.fpsFrames++;
      if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }

      const I = HF.Input;
      if (I.pressed('pause')) {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused' && !this.ui.subScreenOpen()) this.resume();
        else if (this.state === 'shop') this.closeShop();
      }

      if (this.state === 'playing') {
        if (I.pressed('ready') && this.waves.state === 'intermission') this.waves.skipIntermission();
        if (I.pressed('interact') && this.nearTerminal()) this.openShop();
        this.update(dt);
      } else if (this.state === 'dying') {
        this.deathT -= dt;
        this.update(dt * 0.3);
        if (this.deathT <= 0) this.gameOver();
      } else if (this.state === 'menu') {
        this.time += dt;
        this.cam.x = this.map.pw / 2 + Math.cos(this.time * 0.05) * 700;
        this.cam.y = this.map.ph / 2 + Math.sin(this.time * 0.07) * 420;
        if (Math.random() < 0.3) {
          const v = this.view;
          this.particles.spawn('dot', v.x + Math.random() * v.w, v.y + v.h, U.rand(-10, 10), U.rand(-60, -20), 4, 2, U.pick(['#ff6a2a', '#ff3a1a', '#ffa040']), { drag: 0, add: true });
        }
        this.particles.update(dt);
      }

      this.render();
      this.ui.update(dt);
      I.endFrame();
    }

    update(dt) {
      const p = this.player, map = this.map;
      this.time += dt;
      if (this.state === 'playing') this.run.time += dt;

      map.updateFlow(p.x, p.y);
      if (p.alive) p.update(dt);

      // rejilla espacial + auras de escudo
      this.hash.clear();
      let alive = 0;
      this.enemies.forEach((e) => {
        if (!e.alive) return;
        e.shielded = false;
        this.hash.insert(e);
        alive++;
      });
      this.aliveEnemies = alive;
      if (this.boss && this.boss.alive && !this.boss.hidden) this.hash.insert(this.boss);
      this.enemies.forEach((w) => {
        if (!w.alive || w.type !== 'warlock') return;
        const R = w.def.auraR;
        this.hash.query(w.x, w.y, R, tmp);
        for (const e of tmp) if (e !== w && !e.isBoss && U.dist2(w.x, w.y, e.x, e.y) < R * R) e.shielded = true;
      });

      // IA y movimiento
      this.enemies.forEach((e) => { if (!e.update(dt, this)) this.enemies.release(e); });
      if (this.boss) {
        if (!this.boss.update(dt, this)) this.boss = null;
      }

      // colisiones entre enemigos, barriles y jugador
      this.enemies.forEach((e) => {
        if (!e.alive) return;
        this.hash.query(e.x, e.y, e.r + 28, tmp);
        for (const o of tmp) {
          if (o === e || !o.alive || o.isBoss || o.id < e.id) continue;
          HF.Collision.separate(e, o, e.mass, o.mass);
        }
        for (const b of this.barrels) if (b.alive) HF.Collision.separate(b, e, 1000, 1);
        if (p.alive && p.dash.active <= 0) HF.Collision.separate(e, p, e.mass, 4);
      });
      if (this.boss && this.boss.alive && !this.boss.hidden && p.alive) HF.Collision.separate(this.boss, p, 40, 1);
      HF.Collision.resolveCircleMap(p, map);

      // proyectiles
      this.projectiles.forEach((pr) => { if (!pr.update(dt, this)) this.projectiles.release(pr); });
      // objetos
      this.items.forEach((it) => { if (!it.update(dt, this)) this.items.release(it); });
      // marcadores de aparición
      for (let i = this.spawnMarkers.length - 1; i >= 0; i--) {
        const m = this.spawnMarkers[i];
        m.t -= dt;
        if (m.t <= 0) { this.spawnMarkers.splice(i, 1); this.spawnEnemy(m); }
      }
      this.updateHazards(dt);
      for (const b of this.barrels) {
        if (b.alive && b.fuse > 0) {
          b.fuse -= dt;
          if (b.fuse <= 0) { b.alive = false; this.explode(b.x, b.y, 125, 95, { byPlayer: true, hurtPlayer: 0.5 }); }
        }
      }
      this.particles.update(dt);
      if (this.state === 'playing') this.waves.update(dt);

      // combo
      if (this.combo > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
      // puntuación por supervivencia
      if (this.state === 'playing' && this.waves.state === 'active') {
        this.run.scoreAcc += dt * 5;
        if (this.run.scoreAcc >= 1) { const n = Math.floor(this.run.scoreAcc); this.run.score += n; this.run.scoreAcc -= n; }
      }
      // ambiente: burbujas tóxicas y chispas de consolas
      if (Math.random() < 0.15) {
        const t = U.pick(map.toxic), a = Math.random() * U.TAU, r = Math.random() * t.r * 0.8;
        this.particles.spawn('dot', t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, 0, -12, 0.8, 3, '#b6ff5a', { drag: 0, add: true });
      }

      if (this.pendingLevelUps > 0 && this.state === 'playing') this.openLevelUp('playing');
      this.updateCamera(dt);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    }

    updateCamera(dt) {
      const p = this.player;
      if (!p) return;
      const mw = this.mouseWorld();
      let ox = (mw.x - p.x) * 0.2, oy = (mw.y - p.y) * 0.2;
      const ol = Math.hypot(ox, oy);
      if (ol > 150) { ox *= 150 / ol; oy *= 150 / ol; }
      this.cam.x = U.damp(this.cam.x, p.x + ox, 7, dt);
      this.cam.y = U.damp(this.cam.y, p.y + oy, 7, dt);
    }
    computeView() {
      const vw = this.canvas.width / this.scale, vh = this.canvas.height / this.scale;
      let cx = this.cam.x, cy = this.cam.y;
      const m = this.map;
      cx = vw >= m.pw ? m.pw / 2 : U.clamp(cx, vw / 2, m.pw - vw / 2);
      cy = vh >= m.ph ? m.ph / 2 : U.clamp(cy, vh / 2, m.ph - vh / 2);
      const s = this.shakeAmt;
      this.view.x = cx - vw / 2 + (s ? U.rand(-s, s) * 0.5 : 0);
      this.view.y = cy - vh / 2 + (s ? U.rand(-s, s) * 0.5 : 0);
      this.view.w = vw; this.view.h = vh;
    }

    /* ---------------- generación de entidades ---------------- */
    addSpawnMarker(x, y, type, elite, mods, t = 0.9) {
      this.spawnMarkers.push({ x, y, type, elite, mods, t, max: t });
    }
    spawnEnemy(m) {
      const e = this.enemies.get();
      if (!e) return;
      e.init(m.type, m.x, m.y, { ...m.mods, elite: m.elite });
      this.particles.burst(m.x, m.y, 10, { type: 'spark', speed: [60, 200], life: [0.2, 0.4], size: [1, 2], color: m.elite ? '#ffbe28' : '#ff3a2a', add: true });
      this.particles.light(m.x, m.y, 120, '255,60,40', 0.7, 0.3);
    }
    summon(src, type, n) {
      const mods = this.waves.cfg ? this.waves.cfg.mods : { hp: 1, dmg: 1, speed: 1 };
      HF.Audio.play('summon', { vol: this.sfxVol(src.x, src.y) });
      for (let i = 0; i < n; i++) {
        if (this.aliveEnemies + this.spawnMarkers.length >= this.waves.maxAlive + 10) break;
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * U.TAU, r = src.r + U.rand(25, 70);
          const x = src.x + Math.cos(a) * r, y = src.y + Math.sin(a) * r;
          if (this.map.isFreeCircle(x, y, 14)) { this.addSpawnMarker(x, y, type, false, { ...mods, summoned: true }, 0.55); break; }
        }
      }
      this.particles.burst(src.x, src.y, 14, { type: 'spark', speed: [80, 220], life: [0.3, 0.5], size: [1, 2], color: '#c77aff', add: true });
    }
    spawnBoss(type, tier) {
      const p = this.player;
      let pos = null;
      for (let k = 0; k < 30 && !pos; k++) {
        const a = Math.random() * U.TAU, r = U.rand(380, 520);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (this.map.isFreeCircle(x, y, 50) && this.map.flowDist(x, y) < 65535) pos = { x, y };
      }
      if (!pos) pos = { x: 38 * 32, y: 14 * 32 };
      this.boss = new HF.Boss(this, type, tier, pos.x, pos.y);
      HF.Audio.play('boss');
      HF.Audio.playMusic('boss');
      this.shake(10);
      this.ui.showBoss(this.boss);
      this.particles.spawn('ring', pos.x, pos.y, 0, 0, 1, 260, '#ff3a2a', { add: true });
    }
    enemyShot(x, y, a, speed, dmg, r, type, color) {
      const pr = this.projectiles.get();
      if (!pr) return null;
      return pr.init({ x, y, angle: a, speed, dmg, r, owner: 'enemy', type, color, range: 1200 });
    }
    spawnItem(type, x, y, data) {
      const it = this.items.get();
      if (it) it.init(type, x, y, data);
      return it;
    }
    addHazard(h) {
      h.t = 0;
      this.hazards.push(h);
    }
    updateHazards(dt) {
      const p = this.player;
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const h = this.hazards[i];
        h.t += dt;
        if (h.kind === 'telegraph') {
          if (h.t >= h.delay) {
            this.hazards.splice(i, 1);
            this.shake(4);
            HF.Audio.play('slam', { vol: this.sfxVol(h.x, h.y) });
            this.particles.spawn('flash', h.x, h.y, 0, 0, 0.2, h.r, `rgba(${h.color},0.9)`, { add: true });
            this.particles.burst(h.x, h.y, 12, { type: 'debris', speed: [80, 220], life: [0.3, 0.6], size: [3, 6], color: ['#3a3a3a', '#5a5048'], spin: 10 });
            if (p.alive && U.dist(h.x, h.y, p.x, p.y) < h.r + p.r * 0.5) p.takeDamage(h.dmg, { x: h.x, y: h.y });
            if (h.leaveAcid) this.hazards.push({ kind: 'acid', x: h.x, y: h.y, r: h.r * 0.9, life: 6, t: 0, tick: 0, dps: 14 });
          }
        } else if (h.kind === 'acid') {
          h.life -= dt;
          if (h.life <= 0) { this.hazards.splice(i, 1); continue; }
          h.tick -= dt;
          if (h.tick <= 0 && p.alive && U.dist(h.x, h.y, p.x, p.y) < h.r) {
            h.tick = 0.3;
            p.takeDamage(h.dps * 0.3, { env: true, iframes: 0 });
          }
        }
      }
    }

    /* ---------------- combate ---------------- */
    damageEnemy(e, dmg, o = {}) {
      if (!e.alive || e.invulnerable) return 0;
      const dealt = e.takeDamage(this, dmg, o);
      if (dealt <= 0) return 0;
      this.run.damage += dealt;
      if (this.settings.damageNumbers) {
        this.particles.text(e.x, e.y - e.r - 4, String(Math.round(dealt)), o.crit ? '#ff7a3a' : e.shielded ? '#c79aff' : '#ffffff', o.crit ? 17 : 12, 0.55);
      }
      HF.Audio.play(o.crit ? 'crit' : 'hit', { vol: 0.6, pitch: U.rand(0.9, 1.1) });
      return dealt;
    }
    forEachEnemyInRadius(x, y, R, fn) {
      this.enemies.forEach((e) => {
        if (!e.alive) return;
        const d = U.dist(x, y, e.x, e.y);
        if (d < R + e.r) fn(e, d);
      });
      const b = this.boss;
      if (b && b.alive && !b.hidden) {
        const d = U.dist(x, y, b.x, b.y);
        if (d < R + b.r) fn(b, d);
      }
    }
    forEachEnemyProjectile(fn) {
      this.projectiles.forEach((pr) => { if (pr.owner === 'enemy') fn(pr); });
    }

    explode(x, y, R, dmg, o = {}) {
      const P = this.particles;
      HF.Audio.play('explosion', { vol: this.sfxVol(x, y) });
      const p = this.player;
      const dp = p ? U.dist(x, y, p.x, p.y) : 0;
      this.shake(U.clamp(14 - dp / 60, 2, 14));
      P.spawn('flash', x, y, 0, 0, 0.12, R * 0.9, '#ffe0a0', { add: true });
      P.spawn('ring', x, y, 0, 0, 0.35, R, '#ffb060', { add: true });
      P.burst(x, y, 26, { type: 'spark', speed: [150, 520], life: [0.15, 0.45], size: [1.5, 3], color: ['#ffd070', '#ff8a2a', '#fff2c0'], add: true, drag: 4 });
      P.burst(x, y, 14, { type: 'smoke', speed: [30, 140], life: [0.6, 1.2], size: [8, 16], color: ['#2a2a2e', '#3a3236'], grow: 18, drag: 3 });
      P.burst(x, y, 8, { type: 'debris', speed: [100, 300], life: [0.4, 0.8], size: [3, 6], color: ['#3a3a3a', '#6a5040'], spin: 14 });
      P.light(x, y, R * 2.6, o.color || '255,160,60', 1, 0.35);
      if (this.quality !== 'low') this.map.scorch(x, y, R * 0.7);

      const ed = o.enemyDmg ?? 1;
      this.forEachEnemyInRadius(x, y, R, (e, d) => {
        const f = 1 - U.clamp(d / (R + e.r), 0, 1);
        const a = U.angleTo(x, y, e.x, e.y);
        this.damageEnemy(e, dmg * (0.45 + 0.55 * f) * ed, { crit: o.crit, kx: Math.cos(a) * 500 * f, ky: Math.sin(a) * 500 * f, stagger: true, x: e.x, y: e.y, weapon: o.weapon });
      });
      if (p && p.alive && o.hurtPlayer && dp < R + p.r) {
        const f = 1 - U.clamp(dp / (R + p.r), 0, 1);
        p.takeDamage(dmg * o.hurtPlayer * (0.4 + 0.6 * f) * (o.byPlayer ? 0.5 : 1), { x, y });
      }
      for (const b of this.barrels) {
        if (b.alive && b.fuse < 0 && U.dist(x, y, b.x, b.y) < R + b.r) b.fuse = 0.12;
      }
    }
    hitBarrel(b, dmg) {
      b.hp -= dmg;
      this.particles.burst(b.x, b.y, 3, { type: 'spark', speed: [60, 160], life: [0.1, 0.2], size: [1, 2], color: '#ffd030', add: true });
      if (b.hp <= 0 && b.fuse < 0) b.fuse = 0.05;
    }
    nuke() {
      const p = this.player;
      this.shake(16);
      this.particles.spawn('ring', p.x, p.y, 0, 0, 0.8, 900, '#ffb060', { add: true });
      this.particles.light(p.x, p.y, 1400, '255,180,90', 1, 0.6);
      HF.Audio.play('explosion');
      this.enemies.forEach((e) => { if (e.alive && U.dist(p.x, p.y, e.x, e.y) < 900) this.damageEnemy(e, 99999, { x: e.x, y: e.y }); });
      if (this.boss && this.boss.alive) this.damageEnemy(this.boss, 350, {});
    }

    /* ---------------- eventos ---------------- */
    get comboMult() { return 1 + Math.min(this.combo, 40) * 0.1; }

    onEnemyKilled(e, opts) {
      const P = this.particles, d = e.def;
      P.burst(e.x, e.y, 14, { type: 'dot', speed: [60, 260], life: [0.3, 0.7], size: [2, 4], color: [e.blood, e.blood, '#2a0808'], drag: 5 });
      P.burst(e.x, e.y, 5, { type: 'debris', speed: [80, 200], life: [0.4, 0.7], size: [3, 5], color: e.blood, spin: 10 });
      if (this.quality !== 'low') this.map.splat(e.x, e.y, e.r * 1.4, e.blood);
      HF.Audio.play('enemyDie', { vol: this.sfxVol(e.x, e.y), pitch: U.rand(0.85, 1.15) });
      if (opts && opts.selfDestruct) return;

      const r = this.run;
      r.kills++;
      r.killsByType[e.type] = (r.killsByType[e.type] || 0) + 1;
      this.combo++;
      this.comboT = 3.2;
      if (this.combo > r.bestCombo) r.bestCombo = this.combo;
      if (this.combo === 25) this.unlock('combo25');
      if (this.combo === 50) this.unlock('combo50');
      const pts = Math.round(d.score * (e.elite ? 3 : 1) * this.comboMult);
      r.score += pts;
      if (e.elite) P.text(e.x, e.y - 20, 'ÉLITE +' + pts, '#ffbe28', 14, 0.9);
      this.player.gainXp(d.xp * (e.elite ? 3 : 1) * (e.summoned ? 0.5 : 1));
      if (!e.summoned || Math.random() < 0.4) this.dropLoot(e);
      this.unlock('first_blood');
    }

    onBossKilled(b) {
      const r = this.run;
      const pts = 5000 * b.tier;
      r.score += pts;
      r.bosses++;
      r.kills++;
      this.waves.bossesDefeated++;
      this.waves.queue.length = 0;
      this.shake(18);
      HF.Audio.play('explosion');
      HF.Audio.play('roar');
      this.particles.spawn('ring', b.x, b.y, 0, 0, 1, 500, '#ffb060', { add: true });
      this.particles.light(b.x, b.y, 800, b.def.color, 1, 1);
      this.particles.burst(b.x, b.y, 60, { type: 'dot', speed: [100, 400], life: [0.5, 1.2], size: [3, 6], color: [b.blood, '#2a0808', '#fff'], drag: 3 });
      this.map.splat(b.x, b.y, 90, b.blood);
      this.ui.banner('¡JEFE DERROTADO!', '+' + U.fmtNum(pts) + ' puntos', 2.5);
      this.ui.hideBoss();
      this.player.gainXp(250 * b.tier);
      for (let i = 0; i < 18; i++) this.spawnItem('coin', b.x, b.y, U.randInt(2, 4));
      this.spawnItem('health', b.x, b.y, 50);
      this.spawnItem('armor', b.x, b.y, 50);
      for (const t of this.player.ownedAmmoTypes()) this.spawnItem('ammo', b.x, b.y, { type: t, amount: HF.AMMO_TYPES[t].pickup * 2 });
      this.spawnItem('power', b.x, b.y, U.pick(['quad', 'rapid', 'invul']));
      this.dropWeaponCrate(b.x, b.y);
      this.unlock('boss1');
      HF.Audio.playMusic('combat');
    }

    dropLoot(e) {
      const p = this.player, d = e.def;
      const m = p.dropMult * (e.elite ? 2.5 : 1);
      if (Math.random() < d.coin) {
        const v = U.randInt(1, 2) * (e.elite ? 3 : 1);
        this.spawnItem('coin', e.x, e.y, v);
      }
      if (Math.random() < 0.035 * m + (p.hp < p.maxHp * 0.35 ? 0.04 : 0)) this.spawnItem('health', e.x, e.y, 20);
      if (Math.random() < 0.03 * m) this.spawnItem('armor', e.x, e.y, 15);
      const types = p.ownedAmmoTypes();
      if (types.length && Math.random() < 0.14 * m) {
        let t = U.pick(types);
        if (Math.random() < 0.7) t = types.slice().sort((a, b) => p.ammo[a] / p.ammoMax(a) - p.ammo[b] / p.ammoMax(b))[0];
        this.spawnItem('ammo', e.x, e.y, { type: t, amount: HF.AMMO_TYPES[t].pickup });
      }
      if (Math.random() < 0.03 * m) this.spawnItem('energy', e.x, e.y, 1);
      if (Math.random() < 0.007 * m + (e.elite ? 0.12 : 0)) {
        this.spawnItem('power', e.x, e.y, U.weightedPick([{ w: 3, v: 'quad' }, { w: 3, v: 'rapid' }, { w: 2, v: 'invul' }, { w: 1, v: 'nuke' }]).v);
      }
    }

    /** Suelta una caja con la siguiente arma desbloqueada que el jugador no tenga. */
    dropWeaponCrate(x, y) {
      const unlocked = HF.SaveManager.data.unlockedWeapons;
      const id = HF.WEAPON_ORDER.find((w) => unlocked.includes(w) && !this.player.weapons[w]);
      if (!id) return false;
      const it = this.spawnItem('crate', x, y, id);
      if (it) { it.vx *= 0.3; it.vy *= 0.3; }
      return true;
    }
    openWeaponCrate(id) {
      const p = this.player;
      const def = HF.WEAPONS[id];
      if (p.addWeapon(id)) {
        p.switchTo(id);
        this.ui.toast(`NUEVA ARMA: ${def.name.toUpperCase()} [${def.slot}]`, 'weapon');
        HF.Audio.play('levelup');
        this.checkArsenal();
      } else {
        p.refillAmmo(1);
        this.ui.toast('MUNICIÓN REPUESTA', 'weapon');
        HF.Audio.play('pickup');
      }
    }
    checkArsenal() {
      if (HF.WEAPON_ORDER.every((id) => this.player.weapons[id])) this.unlock('arsenal');
    }

    onWaveStart(n, cfg) {
      HF.Audio.play('waveStart');
      if (!cfg.isBoss) HF.Audio.playMusic('combat');
      this.ui.banner('OLEADA ' + String(n).padStart(2, '0'), cfg.isBoss ? '¡ALERTA: ENTIDAD MAYOR DETECTADA!' : cfg.total + ' hostiles detectados', 2.2);
      if (n === 5) this.unlock('wave5');
      if (n === 10) this.unlock('wave10');
      if (n === 20) this.unlock('wave20');
    }
    onWaveComplete(n, prep) {
      const p = this.player;
      const bonus = 150 * n;
      this.run.score += bonus;
      const coins = p.addCoins(5 + n * 2);
      p.heal(p.maxHp * 0.1);
      HF.Audio.play('waveClear');
      if (n >= 3 && !p.hitThisWave) this.unlock('untouchable');
      this.ui.banner('OLEADA ' + String(n).padStart(2, '0') + ' COMPLETADA',
        `+${U.fmtNum(bonus)} pts · +${coins} monedas` + (prep ? ' · Terminal de preparación activa' : ''), 3);
      if ([2, 4, 7, 12, 15].includes(n)) {
        const t = this.map.terminal;
        if (this.dropWeaponCrate(t.x, t.y + 70)) this.ui.toast('CAJA DE ARMAS junto a la terminal', 'weapon');
      }
      if (prep) HF.Audio.playMusic('menu');
      if (this.run.coinsEarned >= 1000) this.unlock('rich');
    }

    onLevelUp() {
      this.pendingLevelUps++;
      HF.Audio.play('levelup');
      const p = this.player;
      this.particles.text(p.x, p.y - 34, '¡NIVEL ' + p.level + '!', '#7affc8', 18, 1.2);
      this.particles.spawn('ring', p.x, p.y, 0, 0, 0.5, 80, '#7affc8', { add: true });
      if (p.level >= 15) this.unlock('level15');
    }
    openLevelUp(returnTo) {
      this.state = 'levelup';
      this.levelUpReturn = returnTo;
      if (document.pointerLockElement) document.exitPointerLock();
      const choices = HF.UpgradeSystem.getChoices(this.player, 3);
      if (!choices.length) { this.pendingLevelUps = 0; this.state = returnTo; return; }
      this.ui.showLevelUp(choices, (u) => {
        HF.UpgradeSystem.apply(this.player, u);
        this.pendingLevelUps--;
        HF.Audio.play('buy');
        if (this.pendingLevelUps > 0) this.openLevelUp(returnTo);
        else {
          this.state = returnTo;
          if (returnTo === 'shop') this.ui.showShop();
          else { this.ui.hideOverlays(); this.lockPointer(); }
        }
      });
    }

    onPlayerHurt(amount, opts) {
      if (opts.env) { this.ui.hurt(0.25); return; }
      if (this.combo >= 5) this.particles.text(this.player.x, this.player.y - 40, 'COMBO PERDIDO', '#ff5a4a', 13);
      this.combo = 0;
      this.player.hitThisWave = true;
      this.shake(6);
      this.ui.hurt(1);
      HF.Audio.play('hurt');
      this.particles.burst(this.player.x, this.player.y, 8, { type: 'dot', speed: [60, 200], life: [0.3, 0.5], size: [2, 3], color: '#c01818' });
    }
    onPlayerDeath() {
      const p = this.player;
      this.state = 'dying';
      this.deathT = 1.8;
      HF.Audio.stopMusic();
      HF.Audio.play('death');
      this.shake(16);
      this.particles.burst(p.x, p.y, 40, { type: 'dot', speed: [80, 300], life: [0.5, 1.2], size: [2, 5], color: ['#c01818', '#3c5a7a', '#7ff6ff'], drag: 3 });
      this.map.splat(p.x, p.y, 30, '#7a0c0c');
      if (document.pointerLockElement) document.exitPointerLock();
    }

    /* ---------------- tienda ---------------- */
    nearTerminal() {
      const p = this.player, t = this.map.terminal;
      return this.waves.state === 'intermission' && this.waves.prep && U.dist(p.x, p.y, t.x, t.y) < 95;
    }
    openShop() {
      this.state = 'shop';
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.showShop();
      HF.Audio.play('ui');
    }
    closeShop() {
      if (this.state !== 'shop') return;
      this.state = 'playing';
      this.ui.hideOverlays();
      HF.Audio.play('uiBack');
      this.lockPointer();
    }
    buy(item) {
      const p = this.player;
      if (item.disabled || p.coins < item.cost) { HF.Audio.play('deny'); return false; }
      p.coins -= item.cost;
      item.buy();
      HF.Audio.play('buy');
      if (item.id === 'module') { this.openLevelUp('shop'); return true; }
      return true;
    }
    equipAbility(id, cost) {
      const p = this.player;
      if (p.ability.id === id || p.coins < cost) { HF.Audio.play('deny'); return false; }
      p.coins -= cost;
      p.ability = { id, t: 0, active: 0 };
      HF.Audio.play('buy');
      return true;
    }
    startNextFromShop() {
      this.closeShop();
      this.waves.skipIntermission();
    }

    /* ---------------- game over y guardado ---------------- */
    recordRun(died) {
      const S = HF.SaveManager, d = S.data, r = this.run;
      const wave = this.waves ? this.waves.wave : 0;
      const prevBestScore = d.best.score, prevBestWave = d.best.wave;
      const cores = Math.floor(r.score / 1500) + wave * 2 + r.bosses * 10;
      d.cores += cores;
      d.best.score = Math.max(d.best.score, r.score);
      d.best.wave = Math.max(d.best.wave, wave);
      d.best.level = Math.max(d.best.level, this.player ? this.player.level : 0);
      d.best.time = Math.max(d.best.time, r.time);
      const st = d.stats;
      st.games++;
      st.kills += r.kills;
      st.time += r.time;
      st.bosses += r.bosses;
      st.shots += r.shots;
      st.coresEarned += cores;
      st.coinsEarned += r.coinsEarned;
      st.damageDealt += Math.round(r.damage);
      st.bestCombo = Math.max(st.bestCombo, r.bestCombo);
      for (const k in r.killsByType) st.killsByType[k] = (st.killsByType[k] || 0) + r.killsByType[k];
      if (st.kills >= 1000) this.unlock('kills1000', true);
      if (r.score >= 50000) this.unlock('score50k', true);
      S.save();
      return {
        died, wave, kills: r.kills, score: r.score, time: r.time, cores,
        level: this.player ? this.player.level : 1, bestCombo: r.bestCombo,
        bestWave: d.best.wave, bestScore: d.best.score,
        newScore: r.score > prevBestScore && r.score > 0, newWave: wave > prevBestWave,
      };
    }
    gameOver() {
      const data = this.recordRun(true);
      this.state = 'gameover';
      this.ui.showGameOver(data);
    }
    unlock(id, silentSave) {
      const d = HF.SaveManager.data;
      if (d.achievements[id]) return;
      d.achievements[id] = Date.now();
      const a = HF.UpgradeSystem.ACHIEVEMENTS.find((x) => x.id === id);
      if (a) {
        this.ui.toast('LOGRO DESBLOQUEADO: ' + a.name, 'achievement');
        HF.Audio.play('achievement');
      }
      if (!silentSave) HF.SaveManager.save();
    }

    /* ---------------- render ---------------- */
    render() {
      const ctx = this.ctx, c = this.canvas;
      this.computeView();
      const v = this.view, s = this.scale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      const tx = Math.round(-v.x * s), ty = Math.round(-v.y * s);
      ctx.setTransform(s, 0, 0, s, tx, ty);

      this.drawLayer(ctx, this.map.canvas, v);
      if (this.quality !== 'low') this.drawLayer(ctx, this.map.decals, v);
      this.renderMapDynamic(ctx, v);

      const inView = (x, y, m = 80) => x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m;

      // peligros
      for (const h of this.hazards) {
        if (!inView(h.x, h.y, h.r)) continue;
        if (h.kind === 'telegraph') {
          const f = h.t / h.delay;
          ctx.fillStyle = `rgba(${h.color},${0.1 + f * 0.25})`;
          ctx.beginPath(); ctx.arc(h.x, h.y, h.r * f, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = `rgba(${h.color},0.8)`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, U.TAU); ctx.stroke();
        } else {
          const a = Math.min(1, h.life / 1.5);
          ctx.fillStyle = `rgba(120,230,40,${0.35 * a})`;
          ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, U.TAU); ctx.fill();
          ctx.fillStyle = `rgba(200,255,120,${0.25 * a})`;
          ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.5 + Math.sin(this.time * 4 + h.x) * 0.1), 0, U.TAU); ctx.fill();
        }
      }
      // marcadores de aparición (runas)
      for (const m of this.spawnMarkers) {
        const f = 1 - m.t / m.max;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(this.time * 3);
        ctx.strokeStyle = m.elite ? `rgba(255,190,40,${0.4 + f * 0.6})` : `rgba(255,50,30,${0.4 + f * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 20 * (0.4 + f * 0.6), 0, U.TAU); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * U.TAU;
          ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
          ctx.lineTo(Math.cos(a + 2.1) * 18, Math.sin(a + 2.1) * 18);
        }
        ctx.stroke();
        ctx.restore();
      }
      this.items.forEach((it) => { if (inView(it.x, it.y)) it.render(ctx, this); });
      const bsp = HF.Sprites.get('barrel');
      for (const b of this.barrels) {
        if (!b.alive || !inView(b.x, b.y)) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 5, 13, 9, 0, 0, U.TAU); ctx.fill();
        const jit = b.fuse > 0 ? U.rand(-1.5, 1.5) : 0;
        ctx.drawImage(bsp.img, Math.round(b.x - bsp.w / 2 + jit), Math.round(b.y - bsp.h / 2));
      }
      this.enemies.forEach((e) => { if (!e.alive && inView(e.x, e.y)) e.render(ctx, this); });
      this.enemies.forEach((e) => { if (e.alive && inView(e.x, e.y)) e.render(ctx, this); });
      if (this.boss) this.boss.render(ctx, this);
      if (this.player && (this.player.alive)) this.player.render(ctx);
      this.projectiles.forEach((pr) => { if (inView(pr.x, pr.y, 20)) pr.render(ctx); });
      this.particles.render(ctx, v);

      if (this.quality !== 'low') this.renderLighting(v);
      else this.renderVignette();

      ctx.setTransform(s, 0, 0, s, tx, ty);
      this.particles.renderTexts(ctx);
      this.renderWorldPrompts(ctx);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.state === 'playing' || this.state === 'dying') this.renderCrosshair(ctx);
      if (this.settings.showFps) {
        ctx.font = `${12 * this.dpr}px monospace`;
        ctx.fillStyle = '#7f7';
        ctx.textAlign = 'right';
        ctx.fillText(this.fps + ' FPS', c.width - 10 * this.dpr, c.height - 10 * this.dpr);
      }
    }

    drawLayer(ctx, img, v) {
      const sx = Math.max(0, Math.floor(v.x)), sy = Math.max(0, Math.floor(v.y));
      const sw = Math.min(img.width - sx, Math.ceil(v.w) + 2), sh = Math.min(img.height - sy, Math.ceil(v.h) + 2);
      if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    renderMapDynamic(ctx, v) {
      const t = this.time;
      // pantallas parpadeantes
      for (const sc of this.map.screens) {
        if (Math.sin(t * 3 + sc.x * 0.1) > 0.6) {
          ctx.fillStyle = 'rgba(80,255,180,0.5)';
          ctx.fillRect(sc.x - 6, sc.y - 2, 12, 3);
        }
      }
      // terminal activa
      const T = this.map.terminal;
      const active = this.waves && this.waves.state === 'intermission' && this.waves.prep;
      ctx.strokeStyle = active ? `rgba(60,255,170,${0.5 + Math.sin(t * 5) * 0.4})` : 'rgba(60,255,170,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(T.x - 36, T.y - 36, 72, 72);
    }

    renderWorldPrompts(ctx) {
      if (!this.player || this.state !== 'playing') return;
      const T = this.map.terminal;
      if (this.waves.state === 'intermission' && this.waves.prep) {
        const near = this.nearTerminal();
        ctx.font = '700 13px "Chakra Petch", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        const label = near ? `[${HF.Input.codeLabel(HF.Input.bindings.interact[0])}] ABRIR TERMINAL` : 'TERMINAL DE PREPARACIÓN';
        ctx.fillText(label, T.x + 1, T.y - 49);
        ctx.fillStyle = near ? '#3affaa' : '#7fbfa0';
        ctx.fillText(label, T.x, T.y - 50);
      }
    }

    renderLighting(v) {
      const lc = this.lightCanvas, lx = this.lctx;
      const k = this.lightRes;
      const s = this.scale * k;
      const t = this.time;
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.globalCompositeOperation = 'source-over';
      lx.globalAlpha = 1;
      lx.fillStyle = 'rgba(2,3,9,0.74)';
      lx.fillRect(0, 0, lc.width, lc.height);
      lx.globalCompositeOperation = 'destination-out';
      lx.setTransform(s, 0, 0, s, -v.x * s, -v.y * s);
      const spr = this.lightSprite;
      const vis = (x, y, r) => x + r > v.x && x - r < v.x + v.w && y + r > v.y && y - r < v.y + v.h;
      const L = (x, y, r, a) => {
        if (!vis(x, y, r)) return;
        lx.globalAlpha = U.clamp(a, 0, 1);
        lx.drawImage(spr, x - r, y - r, r * 2, r * 2);
      };
      const lights = this.map.lights;
      const lvl = [];
      for (const l of lights) {
        let a = l.a;
        if (l.rot) a *= 0.45 + 0.55 * Math.max(0, Math.sin(t * 3 + l.phase));
        if (l.pulse) a *= 0.75 + 0.25 * Math.sin(t * 2 + l.phase);
        if (l.flicker && Math.sin(t * 23 + l.phase * 7) > 0.85) a *= 0.2;
        lvl.push(a);
        L(l.x, l.y, l.r, a * 1.5);
      }
      const p = this.player;
      if (p && (p.alive || this.state === 'dying')) {
        L(p.x, p.y, 190, 0.95);
        if (p.alive) {
          lx.save();
          lx.translate(p.x, p.y);
          lx.rotate(p.angle);
          lx.globalAlpha = 0.9;
          lx.drawImage(this.coneSprite, 0, -175, 500, 350);
          lx.restore();
        }
      } else if (this.state === 'menu') {
        L(this.cam.x, this.cam.y, 520, 0.5);
      }
      this.particles.lights.forEach((l) => L(l.x, l.y, l.r, l.a * (l.life / l.max)));
      this.projectiles.forEach((pr) => {
        if (pr.type === 'plasma' || pr.type === 'rocket' || pr.owner === 'enemy') L(pr.x, pr.y, pr.owner === 'enemy' ? 46 : 70, 0.6);
      });
      this.items.forEach((it) => L(it.x, it.y, 44, 0.45));
      for (const m of this.spawnMarkers) L(m.x, m.y, 70, 0.6);
      for (const h of this.hazards) L(h.x, h.y, h.r * 1.4, 0.5);
      if (this.boss && this.boss.alive && !this.boss.hidden) L(this.boss.x, this.boss.y, 170, 0.6);
      this.enemies.forEach((e) => { if (e.elite && e.alive) L(e.x, e.y, 60, 0.4); });
      lx.globalAlpha = 1;

      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lc, 0, 0, this.canvas.width, this.canvas.height);

      // brillos de color aditivos
      ctx.setTransform(this.scale, 0, 0, this.scale, -v.x * this.scale, -v.y * this.scale);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i];
        if (!vis(l.x, l.y, l.r)) continue;
        ctx.globalAlpha = lvl[i] * 0.55;
        ctx.drawImage(this.glow(l.color), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      this.particles.lights.forEach((l) => {
        if (!vis(l.x, l.y, l.r)) return;
        ctx.globalAlpha = l.a * (l.life / l.max) * 0.35;
        ctx.drawImage(this.glow(l.color), l.x - l.r * 0.6, l.y - l.r * 0.6, l.r * 1.2, l.r * 1.2);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
    }

    renderVignette() {
      const ctx = this.ctx, c = this.canvas;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.vignette || this.vignette.width !== c.width || this.vignette.height !== c.height) {
        this.vignette = U.makeCanvas(c.width, c.height);
        const x = this.vignette.getContext('2d');
        const g = x.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.3, c.width / 2, c.height / 2, c.height * 0.9);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.7)');
        x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(this.vignette, 0, 0);
    }

    renderCrosshair(ctx) {
      const m = HF.Input.mouse, d = this.dpr;
      const x = m.sx * d, y = m.sy * d;
      const p = this.player;
      if (!p) return;
      const w = p.weapon;
      const gap = (6 + p.bloom * 10 + (w.def.spread || 0) * 40) * d;
      const len = 7 * d;
      ctx.lineWidth = 4 * d;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      const draw = () => {
        ctx.beginPath();
        ctx.moveTo(x - gap - len, y); ctx.lineTo(x - gap, y);
        ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
        ctx.moveTo(x, y - gap - len); ctx.lineTo(x, y - gap);
        ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
        ctx.stroke();
      };
      draw();
      ctx.lineWidth = 2 * d;
      ctx.strokeStyle = p.power.quad > 0 || p.berserkActive ? '#ff5a4a' : '#f2f2f2';
      draw();
      ctx.fillStyle = '#ff3a2a';
      ctx.fillRect(x - d, y - d, 2 * d, 2 * d);
      if (w.reloading) {
        ctx.strokeStyle = '#ffd03a';
        ctx.lineWidth = 3 * d;
        ctx.beginPath();
        ctx.arc(x, y, gap + len + 6 * d, -Math.PI / 2, -Math.PI / 2 + U.TAU * (1 - w.reloadT / w.reloadMax));
        ctx.stroke();
      }
    }
  }

  HF.Game = Game;
})(window.HF);
