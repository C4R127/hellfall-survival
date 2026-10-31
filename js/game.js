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
      this.hurtFlash = 0;
      this.fxLevel = 1;
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
      const fx = s.fx || 'high';
      this.fxLevel = fx === 'low' ? 0.4 : fx === 'medium' ? 0.7 : 1;
      this.particles.density = this.fxLevel * (s.quality === 'low' ? 0.75 : 1);
      HF.Input.sensitivity = s.sensitivity;
      HF.Input.pointerLock = s.pointerLock;
      HF.Input.setBindings(s.bindings);
      HF.Audio.applySettings(s);
      this.resize();
    }
    /**
     * Resolución lógica pixel-perfect: el mundo se dibuja a 1 unidad = 1 píxel en un canvas
     * lógico que se amplía con vecino más cercano. "auto" usa un factor entero.
     */
    resize() {
      // escala de la interfaz: automática según el viewport × preferencia del usuario
      const autoUi = U.clamp(Math.min(innerWidth / 1440, innerHeight / 860), 0.55, 1.3);
      const ui = Math.round(autoUi * Number((this.settings && this.settings.uiScale) || 1) * 20) / 20;
      document.documentElement.style.setProperty('--ui', String(ui));
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.dpr = dpr;
      const pw = Math.max(1, Math.floor(innerWidth * dpr)), ph = Math.max(1, Math.floor(innerHeight * dpr));
      this.canvas.width = pw;
      this.canvas.height = ph;
      const mode = this.settings ? this.settings.pixelScale : 'auto';
      // objetivo: ~1000 unidades de mundo visibles en horizontal
      const fitF = Math.max(1, Math.min(pw / 1000, ph / 560));
      const intF = Math.max(1, Math.round(fitF));
      let f;
      if (mode === 'fit') f = fitF;
      else if (mode === 'integer') f = intF;
      else { const vw = pw / intF; f = vw >= 760 && vw <= 1250 ? intF : fitF; }
      this.pixel = f;
      this.zoom = f / dpr;
      this.lcanvas = U.makeCanvas(Math.ceil(pw / f), Math.ceil(ph / f));
      this.lc = this.lcanvas.getContext('2d');
      this.lc.imageSmoothingEnabled = false;
      this.lightCanvas = U.makeCanvas(Math.ceil(this.lcanvas.width / 2), Math.ceil(this.lcanvas.height / 2));
      this.lictx = this.lightCanvas.getContext('2d');
      this.lictx.imageSmoothingEnabled = false;
      this.ctx.imageSmoothingEnabled = false;
    }
    /** Luces con bandas duras (sin degradados suaves) para mantener el estilo pixel art. */
    buildLightSprites() {
      const band = (d) => (d < 0.45 ? 1 : d < 0.75 ? 0.62 : d < 1 ? 0.26 : 0);
      const make = (w, h, fn) => {
        const c = U.makeCanvas(w, h), x = c.getContext('2d');
        const img = x.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
          const a = fn(i + 0.5, y + 0.5);
          const k = (y * w + i) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
          img.data[k + 3] = Math.round(a * 255);
        }
        x.putImageData(img, 0, 0);
        return c;
      };
      this.lightSprite = make(48, 48, (x, y) => band(Math.hypot(x - 24, y - 24) / 24));
      // cono de la linterna (apunta a +x desde el borde izquierdo)
      this.coneSprite = make(128, 90, (x, y) => {
        const dy = y - 45, ang = Math.abs(Math.atan2(dy, x));
        if (ang > 0.36) return 0;
        const d = x / 128;
        return band(Math.max(d, ang / 0.36 * 0.8)) * 0.95;
      });
    }
    glow(color) {
      let c = this.glowCache[color];
      if (c) return c;
      const [r, g, b] = color.split(',').map(Number);
      c = U.makeCanvas(32, 32);
      const x = c.getContext('2d');
      const img = x.createImageData(32, 32);
      for (let y = 0; y < 32; y++) for (let i = 0; i < 32; i++) {
        const d = Math.hypot(i + 0.5 - 16, y + 0.5 - 16) / 16;
        const a = d < 0.3 ? 0.9 : d < 0.6 ? 0.5 : d < 1 ? 0.2 : 0;
        const k = (y * 32 + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.round(a * 255);
      }
      x.putImageData(img, 0, 0);
      return (this.glowCache[color] = c);
    }

    mouseWorld() {
      const m = HF.Input.mouse;
      return { x: this.view.x + (m.sx * this.dpr) / this.pixel, y: this.view.y + (m.sy * this.dpr) / this.pixel };
    }
    shake(n) { if (this.settings.shake) this.shakeAmt = Math.min(14, this.shakeAmt + n * this.fxLevel); }
    sfxVol(x, y) {
      if (!this.player) return 0.6;
      return U.clamp(1 - U.dist(x, y, this.player.x, this.player.y) / 1100, 0.08, 1);
    }

    /* ---------------- partida ---------------- */
    /** Carga (o reutiliza) el mapa de un sector. */
    loadSector(id) {
      if (!this.map || this.map.sector.id !== id) this.map = new HF.GameMap(id);
      else this.map.clearDecals();
      this.map.flowTile = -1;
      const d = HF.SaveManager.data;
      if (!d.unlockedSectors.includes(id)) { d.unlockedSectors.push(id); HF.SaveManager.save(); }
      if (d.unlockedSectors.length >= 2) this.unlock('evac');
      if (HF.SECTOR_ORDER.every((s) => d.unlockedSectors.includes(s))) this.unlock('allsectors');
    }
    /** Tras derrotar al jefe: evacuación al siguiente sector (los objetos pendientes se recogen). */
    evacuate() {
      const p = this.player;
      this.items.forEach((it) => { if (it.canPick(p)) it.apply(this, p); });
      this.items.clear();
      this.projectiles.clear();
      this.hazards.length = 0;
      this.spawnMarkers.length = 0;
      const next = HF.nextSector(this.map.sector.id);
      this.loadSector(next);
      this.run.sectors = (this.run.sectors || 1) + 1;
      p.x = this.map.playerStart.x; p.y = this.map.playerStart.y;
      p.vx = p.vy = p.kx = p.ky = 0;
      this.cam.x = p.x; this.cam.y = p.y;
      this.respawnBarrels();
      this.hurtFlash = 0;
      const S = this.map.sector;
      this.particles.light(p.x, p.y, 600, '255,255,255', 1, 0.6);
      HF.Story.onEvacuate(next, () => this.ui.banner(S.code + ' · ' + S.name.toUpperCase(), 'Evacuación completada. Terminal de preparación activa', 3.2));
    }

    newRun(sectorId) {
      this.loadSector(sectorId || this.selectedSector || 's7');
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
      const S = this.map.sector;
      this.ui.banner(S.code + ' · ' + S.name.toUpperCase(), 'Prepárate. La primera oleada llega en 4 s', 2.8);
      HF.Story.onRunStart(S.id);
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
      HF.Story.clearRadio();
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
      HF.Story.update(dt);
      if (this.state === 'story') {
        if (I.pressed('pause')) HF.Story.skip();
        else if (I.pressed('ready') || I.pressed('interact') || I.pressed('dash')) HF.Story.next();
      } else if (I.pressed('pause')) {
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
          this.particles.spawn('dot', v.x + Math.random() * v.w, v.y + v.h, U.rand(-10, 10), U.rand(-60, -20), 4, 1, U.pick(['#ff6a2a', '#ff3a1a', '#ffa040']), { drag: 0, add: true, flick: true });
        }
        this.updateAmbient(dt);
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
        // tras los empujones, el enemigo nunca puede quedar dentro de un muro
        HF.Collision.resolveCircleMap(e, map);
        // red de seguridad: si lleva 3 s en una zona inalcanzable, reaparece en una rejilla
        if (map.flowDist(e.x, e.y) >= 65535) {
          e.trappedT = (e.trappedT || 0) + dt;
          if (e.trappedT > 3 && map.spawnVents.length) { const v = U.pick(map.spawnVents); e.x = v.x; e.y = v.y; e.trappedT = 0; }
        } else e.trappedT = 0;
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
          if (b.fuse <= 0) { b.alive = false; this.explode(b.x, b.y, 125, 95, { byPlayer: true, hurtPlayer: 0.35 }); }
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
      // presentación: animaciones y ambiente (no afectan a la lógica)
      if (p) p.animate(dt);
      this.enemies.forEach((e) => e.animate(dt));
      if (this.boss) this.boss.animate(dt);
      this.updateAmbient(dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);

      if (this.pendingLevelUps > 0 && this.state === 'playing') this.openLevelUp('playing');
      this.updateCamera(dt);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    }

    updateCamera(dt) {
      const p = this.player;
      if (!p) return;
      let ox = 0, oy = 0;
      if (this.settings.cameraLead !== false) {
        const mw = this.mouseWorld();
        ox = (mw.x - p.x) * 0.18; oy = (mw.y - p.y) * 0.18;
        const ol = Math.hypot(ox, oy);
        if (ol > 120) { ox *= 120 / ol; oy *= 120 / ol; }
      }
      this.cam.x = U.damp(this.cam.x, p.x + ox, 7, dt);
      this.cam.y = U.damp(this.cam.y, p.y + oy, 7, dt);
    }
    /** Vista en coordenadas enteras para que los píxeles no tiemblen. */
    computeView() {
      const vw = this.lcanvas.width, vh = this.lcanvas.height;
      let cx = this.cam.x, cy = this.cam.y;
      const m = this.map;
      cx = vw >= m.pw ? m.pw / 2 : U.clamp(cx, vw / 2, m.pw - vw / 2);
      cy = vh >= m.ph ? m.ph / 2 : U.clamp(cy, vh / 2, m.ph - vh / 2);
      const s = this.shakeAmt;
      this.view.x = Math.round(cx - vw / 2 + (s ? U.rand(-s, s) * 0.5 : 0));
      this.view.y = Math.round(cy - vh / 2 + (s ? U.rand(-s, s) * 0.5 : 0));
      this.view.w = vw; this.view.h = vh;
    }
    /** Ambiente: vapor, chispas, polvo y burbujas tóxicas cerca de la cámara. */
    updateAmbient(dt) {
      const v = this.view, P = this.particles, map = this.map, fx = this.fxLevel;
      const near = (x, y) => x > v.x - 40 && x < v.x + v.w + 40 && y > v.y - 40 && y < v.y + v.h + 40;
      for (const s of map.steamSpots || []) if (near(s.x, s.y) && Math.random() < dt * 0.9 * fx) HF.FX.steam(s.x + U.rand(-4, 4), s.y, U.rand(-5, 5), U.rand(8, 18));
      for (const s of map.sparkSpots || []) {
        if (near(s.x, s.y) && Math.random() < dt * 0.35 * fx) {
          P.burst(s.x, s.y, 5, { type: 'spark', angle: -Math.PI / 2, spread: 1.4, speed: [40, 140], life: [0.15, 0.35], size: [1, 1], color: ['#ffd060', '#fff0c0'], add: true, drag: 2 });
          P.light(s.x, s.y, 50, '255,210,120', 0.7, 0.08);
        }
      }
      if (Math.random() < dt * 6 * fx) {
        P.spawn('dot', v.x + Math.random() * v.w, v.y + Math.random() * v.h, U.rand(-6, 6), U.rand(-4, 4), U.rand(2, 4), 1, '#8a909c', { drag: 0, alpha: 0.4 });
      }
      if (Math.random() < dt * 9 * fx) {
        const t = U.pick(map.toxic), a = Math.random() * U.TAU, r = Math.random() * t.r * 0.75;
        if (near(t.x, t.y)) P.spawn('dot', t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, 0, -10, 0.7, 2, map.poolKind.bubble, { drag: 0, add: true });
      }
    }

    /* ---------------- generación de entidades ---------------- */
    addSpawnMarker(x, y, type, elite, mods, t = 0.9) {
      this.spawnMarkers.push({ x, y, type, elite, mods, t, max: t });
    }
    spawnEnemy(m) {
      const e = this.enemies.get();
      if (!e) return;
      e.init(m.type, m.x, m.y, { ...m.mods, elite: m.elite });
      HF.Story.onEnemySeen(m.type);
      HF.FX.spawnBurst(m.x, m.y, m.elite);
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
      HF.Story.onBossSpawn(type);
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
            if (p.alive && U.dist(h.x, h.y, p.x, p.y) < h.r + p.r * 0.5) p.takeDamage(h.dmg, { x: h.x, y: h.y, source: h.src || 'area' });
            if (h.leaveAcid) this.hazards.push({ kind: 'acid', x: h.x, y: h.y, r: h.r * 0.9, life: 6, t: 0, tick: 0, dps: h.poolDps || 14, color: h.color });
          }
        } else if (h.kind === 'chain') {
          // garfio del Carcelero: si alcanza al jugador lo arrastra hacia el jefe
          const b = h.boss;
          if (b) { h.x = b.x; h.y = b.y; }
          if (h.t >= h.delay && !h.fired) {
            h.fired = true;
            const ex = h.x + Math.cos(h.a) * h.len, ey = h.y + Math.sin(h.a) * h.len;
            const vx = ex - h.x, vy = ey - h.y, L2 = vx * vx + vy * vy;
            const k = U.clamp(((p.x - h.x) * vx + (p.y - h.y) * vy) / L2, 0, 1);
            if (p.alive && p.dash.active <= 0 && U.dist(p.x, p.y, h.x + vx * k, h.y + vy * k) < h.w + p.r * 0.6) {
              h.hooked = true;
              p.takeDamage(h.dmg, { iframes: 0.2, x: h.x, y: h.y, source: 'chain' });
              p.pull(h.x, h.y, 520, 0.55);
              this.shake(6);
              HF.Audio.play('slam', { vol: 0.7 });
            }
          }
          const done = h.fired && (!h.hooked || !(p.pullT > 0));
          if (done && h.t >= h.delay + h.life) this.hazards.splice(i, 1);
        } else if (h.kind === 'well') {
          // pozo gravitatorio del Núcleo de Ruptura
          const b = h.boss;
          if (b && b.alive) { h.x = b.x; h.y = b.y; }
          if (h.t >= h.delay && p.alive && U.dist(p.x, p.y, h.x, h.y) < h.r) p.pull(h.x, h.y, h.force, 0.1);
          if (h.t >= h.delay && Math.random() < 0.6) {
            const a = Math.random() * U.TAU, r = h.r * (0.6 + Math.random() * 0.4);
            this.particles.spawn('dot', h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, -Math.cos(a) * 180, -Math.sin(a) * 180, 0.9, 1, '#ff4af0', { drag: 0, add: true });
          }
          if (h.t >= h.delay + h.life || !(b && b.alive)) this.hazards.splice(i, 1);
        } else if (h.kind === 'beam') {
          // rayo: telegrafiado durante delay y activo durante life
          if (h.t >= h.delay && !h.fired) {
            h.fired = true;
            this.shake(6);
            HF.Audio.play('shoot_plasma', { vol: this.sfxVol(h.x, h.y) });
          }
          if (h.fired && !h.hit && p.alive) {
            const ex = h.x + Math.cos(h.a) * h.len, ey = h.y + Math.sin(h.a) * h.len;
            const vx = ex - h.x, vy = ey - h.y, L2 = vx * vx + vy * vy;
            const k = U.clamp(((p.x - h.x) * vx + (p.y - h.y) * vy) / L2, 0, 1);
            if (U.dist(p.x, p.y, h.x + vx * k, h.y + vy * k) < h.w + p.r * 0.5) { h.hit = true; p.takeDamage(h.dmg, { x: h.x + vx * k, y: h.y + vy * k, source: 'beam' }); }
          }
          if (h.t >= h.delay + h.life) this.hazards.splice(i, 1);
        } else if (h.kind === 'acid') {
          h.life -= dt;
          if (h.life <= 0) { this.hazards.splice(i, 1); continue; }
          if (h.targetR && h.r < h.targetR) h.r = Math.min(h.targetR, h.r + 40 * dt);
          h.tick -= dt;
          if (h.tick <= 0 && p.alive && U.dist(h.x, h.y, p.x, p.y) < h.r) {
            h.tick = 0.3;
            p.takeDamage(h.dps * 0.3, { env: true, iframes: 0, source: 'pool_boss' });
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
      HF.Audio.play('explosion', { vol: this.sfxVol(x, y) });
      const p = this.player;
      const dp = p ? U.dist(x, y, p.x, p.y) : 0;
      this.shake(U.clamp(14 - dp / 60, 2, 14));
      HF.FX.explosion(x, y, R, o.energy ? 'energy' : 'fire');

      const ed = o.enemyDmg ?? 1;
      this.forEachEnemyInRadius(x, y, R, (e, d) => {
        const f = 1 - U.clamp(d / (R + e.r), 0, 1);
        const a = U.angleTo(x, y, e.x, e.y);
        this.damageEnemy(e, dmg * (0.45 + 0.55 * f) * ed, { crit: o.crit, kx: Math.cos(a) * 500 * f, ky: Math.sin(a) * 500 * f, stagger: true, x: e.x, y: e.y, weapon: o.weapon });
      });
      if (p && p.alive && o.hurtPlayer && dp < R + p.r) {
        const f = 1 - U.clamp(dp / (R + p.r), 0, 1);
        // el daño de tus propias explosiones no escala con tus mejoras de daño (máx. 10)
        const self = dmg * o.hurtPlayer * (0.4 + 0.6 * f) * (o.byPlayer ? 0.5 : 1);
        p.takeDamage(o.byPlayer ? Math.min(10, self) : self, { x, y, source: o.byPlayer ? 'explosion_own' : 'explosion' });
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
      HF.FX.death(e);
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
      HF.FX.explosion(b.x, b.y, 150, b.type === 'matriarch' || b.type === 'archon' ? 'energy' : 'fire');
      this.particles.burst(b.x, b.y, 40, { type: 'dot', speed: [100, 400], life: [0.5, 1.2], size: [2, 4], color: HF.FX.BLOOD[HF.FX.FAMILY[b.type]], drag: 3 });
      this.map.splat(b.x, b.y, 60, HF.FX.FAMILY[b.type]);
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
      HF.Story.onBossKilled(b.type);
      const st = HF.SaveManager.data.stats;
      st.bossTypes = st.bossTypes || {};
      st.bossTypes[b.type] = (st.bossTypes[b.type] || 0) + 1;
      if (Object.keys(st.bossTypes).length >= 4) this.unlock('titans');
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
      HF.Story.onWaveStart(n);
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
      if (n % 10 === 0) this.evacuate();
      else HF.Story.maybeDropLog();
    }

    onLevelUp() {
      this.pendingLevelUps++;
      HF.Audio.play('levelup');
      const p = this.player;
      this.particles.text(p.x, p.y - 34, '¡NIVEL ' + p.level + '!', '#7affc8', 18, 1.2);
      HF.FX.levelUp(p);
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
      if (this.player.hp < this.player.maxHp * 0.3) HF.Story.onLowHp();
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
      this.map.splat(p.x, p.y, 24, 'crimson');
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
      // las monedas sin gastar también cuentan (1 núcleo cada 40)
      const cores = Math.floor(r.score / 1500) + wave * 2 + r.bosses * 10 + Math.min(30, Math.floor((this.player ? this.player.coins : 0) / 40));
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
      HF.Story.clearRadio();
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
      const L = this.lcanvas, lc = this.lc, ctx = this.ctx, A = HF.Assets;
      this.computeView();
      const v = this.view;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalAlpha = 1;
      lc.globalCompositeOperation = 'source-over';
      lc.fillStyle = '#050608';
      lc.fillRect(0, 0, L.width, L.height);
      lc.setTransform(1, 0, 0, 1, -v.x, -v.y);

      this.drawLayer(lc, this.map.canvas, v);
      this.renderMapDynamic(lc, v);

      const inView = (x, y, m = 80) => x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m;
      this.renderHazards(lc, inView);
      // portales de aparición
      for (const m of this.spawnMarkers) {
        if (!inView(m.x, m.y)) continue;
        const id = m.mods && m.mods.summoned ? 'fx_portalViolet' : m.elite ? 'fx_portalElite' : 'fx_portal';
        const s = A.sheet(id);
        const f = Math.min(s.anims.play.frames - 1, Math.floor((1 - m.t / m.max) * s.anims.play.frames));
        A.draw(lc, id, 'play', f, 0, m.x, m.y);
      }
      this.particles.render(lc, v, -1);
      this.items.forEach((it) => { if (inView(it.x, it.y)) it.render(lc, this); });
      for (const b of this.barrels) {
        if (!b.alive || !inView(b.x, b.y)) continue;
        A.drawImage(lc, 'shadow_m', b.x + 2, b.y + 6);
        const warn = b.fuse > 0 || (b.hp < 25 && Math.floor(this.time * 6) % 2);
        A.draw(lc, 'pickup_barrel', 'idle', warn ? 1 : 0, 0, b.x + (b.fuse > 0 ? U.randInt(-1, 1) : 0), b.y);
      }
      this.enemies.forEach((e) => { if (!e.alive && inView(e.x, e.y)) e.render(lc, this); });
      this.enemies.forEach((e) => { if (e.alive && inView(e.x, e.y)) e.render(lc, this); });
      if (this.boss) this.boss.render(lc, this);
      if (this.player) this.player.render(lc);
      this.projectiles.forEach((pr) => { if (inView(pr.x, pr.y, 20)) pr.render(lc); });
      this.particles.render(lc, v, 0);

      if (this.quality !== 'low') this.renderLighting(v);

      lc.setTransform(1, 0, 0, 1, -v.x, -v.y);
      this.particles.renderTexts(lc);
      this.renderWorldPrompts(lc);
      lc.setTransform(1, 0, 0, 1, 0, 0);
      this.renderScreenFX(lc);

      // presentación: escalado entero con vecino más cercano
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(L, 0, 0, L.width * this.pixel, L.height * this.pixel);
      if (this.state === 'playing' || this.state === 'dying') this.renderCrosshair(ctx);
      if (this.settings.showFps) HF.PixelFont.draw(ctx, this.fps + ' FPS', this.canvas.width - 8, this.canvas.height - 18 * Math.ceil(this.pixel), '#7aff9a', { align: 'right', scale: Math.ceil(this.pixel) });
    }

    drawLayer(ctx, img, v) {
      const sx = Math.max(0, v.x), sy = Math.max(0, v.y);
      const sw = Math.min(img.width - sx, v.w + 1), sh = Math.min(img.height - sy, v.h + 1);
      if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    renderMapDynamic(ctx, v) {
      const A = HF.Assets, t = this.time, map = this.map;
      // pantallas murales con texto que parpadea
      for (const s of map.wallScreens || []) {
        if (s.x < v.x - 20 || s.x > v.x + v.w || s.y < v.y - 20 || s.y > v.y + v.h) continue;
        const seed = Math.floor(t * 2 + s.x);
        ctx.fillStyle = '#1aff9a';
        for (let r = 0; r < 3; r++) {
          const len = 3 + ((seed * 7 + r * 13) % 9);
          if ((seed + r) % 5) ctx.fillRect(s.x + 1, s.y + 1 + r * 2, len, 1);
        }
        if (Math.floor(t * 4 + s.x) % 2) ctx.fillRect(s.x + 12, s.y + 5, 1, 1);
      }
      // generadores con bobinas pulsantes
      for (const g of map.generators) A.drawImage(ctx, 'prop_generator_' + (Math.floor(t * 3 + g.x) % 2), g.x, g.y);
      // terminal de preparación
      const T = map.terminal;
      const active = this.waves && this.waves.state === 'intermission' && this.waves.prep;
      A.drawImage(ctx, 'prop_terminal_' + (active && Math.floor(t * 3) % 2 ? 1 : active ? 1 : 0), T.x, T.y);
      if (active) {
        ctx.fillStyle = '#3affaa';
        const r = 40 + Math.floor((t * 20) % 10);
        HF.PX.ring(ctx, T.x, T.y, r, 1);
      }
      // balizas de emergencia giratorias
      for (const l of map.lights) {
        if (!l.rot || l.x < v.x - 20 || l.x > v.x + v.w + 20 || l.y < v.y - 20 || l.y > v.y + v.h + 20) continue;
        A.drawImage(ctx, 'prop_beacon_' + (Math.floor(t * 8 + l.phase) % 4), l.x, l.y);
      }
    }

    renderHazards(ctx, inView) {
      const PX = HF.PX, t = this.time;
      for (const h of this.hazards) {
        if (h.kind !== 'beam' && h.kind !== 'chain' && !inView(h.x, h.y, h.r)) continue;
        if (h.kind === 'chain') {
          const p = this.player;
          if (!h.fired) {
            const ex = h.x + Math.cos(h.a) * h.len, ey = h.y + Math.sin(h.a) * h.len;
            ctx.fillStyle = `rgb(${h.color})`;
            ctx.globalAlpha = 0.45 + (h.t / h.delay) * 0.45;
            if (Math.floor(t * 18) % 2) PX.line(ctx, h.x, h.y, ex, ey, 1);
            ctx.globalAlpha = 1;
          } else if (h.hooked && p) {
            // eslabones de la cadena hasta el jugador
            const d = U.dist(h.x, h.y, p.x, p.y), n = Math.floor(d / 7);
            for (let k = 1; k < n; k++) {
              const x = h.x + (p.x - h.x) * (k / n), y = h.y + (p.y - h.y) * (k / n);
              ctx.fillStyle = '#05040a'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
              ctx.fillStyle = k % 2 ? '#bdb092' : '#6e604a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
            }
          }
          continue;
        }
        if (h.kind === 'well') {
          const act = h.t >= h.delay;
          ctx.fillStyle = `rgb(${h.color})`;
          for (let k = 0; k < 3; k++) {
            const rr = act ? h.r * (1 - ((t * 0.6 + k / 3) % 1)) : h.r * (h.t / h.delay);
            ctx.globalAlpha = act ? 0.35 + 0.4 * (1 - rr / h.r) : 0.6;
            PX.ring(ctx, h.x, h.y, rr, 1);
            if (!act) break;
          }
          ctx.globalAlpha = 1;
          continue;
        }
        if (h.kind === 'beam') {
          const ex = h.x + Math.cos(h.a) * h.len, ey = h.y + Math.sin(h.a) * h.len;
          if (h.t < h.delay) {
            // aviso: línea tramada que parpadea cada vez más rápido
            const f = h.t / h.delay;
            ctx.fillStyle = `rgb(${h.color})`;
            ctx.globalAlpha = 0.35 + f * 0.5;
            if (Math.floor(t * (8 + f * 20)) % 2) PX.line(ctx, h.x, h.y, ex, ey, 1 + Math.round(f * 2));
            ctx.globalAlpha = 1;
          } else {
            const k = 1 - (h.t - h.delay) / h.life;
            ctx.globalAlpha = 0.5 * k;
            ctx.fillStyle = `rgb(${h.color})`;
            PX.line(ctx, h.x, h.y, ex, ey, Math.round(h.w * 2 * (0.7 + 0.3 * k)));
            ctx.globalAlpha = k;
            ctx.fillStyle = '#ffffff';
            PX.line(ctx, h.x, h.y, ex, ey, Math.max(2, Math.round(h.w * 0.6)));
            ctx.globalAlpha = 1;
          }
          continue;
        }
        if (h.kind === 'telegraph') {
          const f = h.t / h.delay;
          ctx.globalAlpha = 0.35 + f * 0.35;
          ctx.fillStyle = `rgb(${h.color})`;
          PX.ditherDisc(ctx, h.x, h.y, h.r * f, Math.floor(t * 12) & 1);
          ctx.globalAlpha = 1;
          PX.ring(ctx, h.x, h.y, h.r, 2);
          if (Math.floor(t * 10) % 2) { ctx.fillStyle = '#ffffff'; PX.ring(ctx, h.x, h.y, h.r * f, 1); }
        } else {
          const a = Math.min(1, h.life / 1.5);
          const col = h.color || '120,230,40';
          ctx.globalAlpha = 0.5 * a;
          ctx.fillStyle = `rgb(${col})`;
          PX.ditherDisc(ctx, h.x, h.y, h.r, 0);
          ctx.globalAlpha = 0.8 * a;
          PX.ring(ctx, h.x, h.y, h.r, 1);
          ctx.fillStyle = '#e0ffb0';
          for (let i = 0; i < 4; i++) {
            const ang = t * 1.3 + i * 1.7 + h.x, d = h.r * (0.2 + ((i * 37) % 6) / 10);
            if (Math.floor(t * 3 + i) % 3) ctx.fillRect(Math.round(h.x + Math.cos(ang) * d), Math.round(h.y + Math.sin(ang) * d), 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    renderWorldPrompts(ctx) {
      if (!this.player || this.state !== 'playing') return;
      const T = this.map.terminal;
      if (this.waves.state === 'intermission' && this.waves.prep) {
        const near = this.nearTerminal();
        const label = near ? `[${HF.Input.codeLabel(HF.Input.bindings.interact[0])}] ABRIR TERMINAL` : 'TERMINAL DE PREPARACIÓN';
        HF.PixelFont.draw(ctx, label, T.x, T.y - 52, near ? '#3affaa' : '#7fbfa0', { align: 'center' });
      }
    }

    /** Iluminación pixelada: mapa de oscuridad a media resolución lógica, con luces en bandas. */
    renderLighting(v) {
      const lcv = this.lightCanvas, x = this.lictx, k = 0.5, t = this.time;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = 'source-over';
      x.globalAlpha = 1;
      x.fillStyle = `rgba(3,4,10,${this.map.sector.darkness})`;
      x.fillRect(0, 0, lcv.width, lcv.height);
      x.globalCompositeOperation = 'destination-out';
      x.setTransform(k, 0, 0, k, -v.x * k, -v.y * k);
      const spr = this.lightSprite;
      const vis = (px, py, r) => px + r > v.x && px - r < v.x + v.w && py + r > v.y && py - r < v.y + v.h;
      const L = (px, py, r, a) => {
        if (!vis(px, py, r)) return;
        x.globalAlpha = U.clamp(a, 0, 1);
        x.drawImage(spr, Math.round(px - r), Math.round(py - r), Math.round(r * 2), Math.round(r * 2));
      };
      const lights = this.map.lights, lvl = this._lvl || (this._lvl = []);
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i];
        let a = l.a;
        if (l.rot) a *= 0.45 + 0.55 * Math.max(0, Math.sin(t * 3 + l.phase));
        if (l.pulse) a *= 0.75 + 0.25 * Math.sin(t * 2 + l.phase);
        if (l.flicker && Math.sin(t * 23 + l.phase * 7) > 0.85) a *= 0.2;
        lvl[i] = a;
        L(l.x, l.y, l.r, a);
      }
      const p = this.player;
      if (p && (p.alive || this.state === 'dying')) {
        L(p.x, p.y, 170, 0.95);
        if (p.alive) {
          x.save();
          x.translate(Math.round(p.x), Math.round(p.y));
          x.rotate(p.angle);
          x.globalAlpha = 0.9;
          x.drawImage(this.coneSprite, 0, -150, 420, 300);
          x.restore();
        }
      } else if (this.state === 'menu') {
        L(this.cam.x, this.cam.y, 420, 0.55);
      }
      this.particles.lights.forEach((l) => L(l.x, l.y, l.r, l.a * (l.life / l.max)));
      this.projectiles.forEach((pr) => {
        if (pr.type === 'plasma' || pr.type === 'rocket' || pr.owner === 'enemy') L(pr.x, pr.y, pr.owner === 'enemy' ? 40 : 60, 0.6);
      });
      this.items.forEach((it) => L(it.x, it.y, 36, 0.45));
      for (const m of this.spawnMarkers) L(m.x, m.y, 60, 0.6);
      for (const h of this.hazards) {
        if (h.kind === 'chain') continue;
        if (h.kind === 'well') { if (h.t >= h.delay) L(h.x, h.y, 260, 0.5); continue; }
        if (h.kind !== 'beam') L(h.x, h.y, h.r * 1.3, 0.5);
        else if (h.fired) for (let k = 0; k <= 6; k++) L(h.x + Math.cos(h.a) * h.len * k / 6, h.y + Math.sin(h.a) * h.len * k / 6, 110, 0.8);
      }
      if (this.boss && this.boss.alive && !this.boss.hidden) L(this.boss.x, this.boss.y, 150, 0.6);
      this.enemies.forEach((e) => { if (e.alive && (e.elite || e.type === 'bloater' || e.type === 'spitter' || e.type === 'warlock')) L(e.x, e.y, e.elite ? 50 : 36, 0.4); });

      const lc = this.lc;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.imageSmoothingEnabled = false;
      lc.drawImage(lcv, 0, 0, lcv.width * 2, lcv.height * 2);
      // brillos de color aditivos (también en bandas)
      lc.setTransform(1, 0, 0, 1, -v.x, -v.y);
      lc.globalCompositeOperation = 'lighter';
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i];
        if (!vis(l.x, l.y, l.r)) continue;
        lc.globalAlpha = lvl[i] * 0.4;
        lc.drawImage(this.glow(l.color), Math.round(l.x - l.r), Math.round(l.y - l.r), Math.round(l.r * 2), Math.round(l.r * 2));
      }
      this.particles.lights.forEach((l) => {
        if (!vis(l.x, l.y, l.r)) return;
        lc.globalAlpha = l.a * (l.life / l.max) * 0.3;
        lc.drawImage(this.glow(l.color), Math.round(l.x - l.r * 0.6), Math.round(l.y - l.r * 0.6), Math.round(l.r * 1.2), Math.round(l.r * 1.2));
      });
      lc.globalAlpha = 1;
      lc.globalCompositeOperation = 'source-over';
    }

    /** Daño recibido y vida baja: marco tramado en los bordes (no tapa el centro de la pantalla). */
    renderScreenFX(lc) {
      const W = this.lcanvas.width, H = this.lcanvas.height;
      const p = this.player;
      let a = 0;
      if (this.hurtFlash > 0) a = this.hurtFlash * (this.settings.reduceFlash ? 0.35 : 0.8);
      if (p && p.alive && p.hp / p.maxHp < 0.3) a = Math.max(a, 0.25 + Math.sin(this.time * 6) * 0.12);
      if (a <= 0.01) return;
      // el marco tramado se genera una sola vez por tamaño de pantalla
      if (!this.vignette || this.vignette.width !== W || this.vignette.height !== H) {
        const c = U.makeCanvas(W, H), x = c.getContext('2d');
        const img = x.createImageData(W, H), d = img.data;
        const band = Math.round(Math.min(W, H) * 0.06);
        for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
          const e = Math.min(i, y, W - 1 - i, H - 1 - y);
          if (e >= band) continue;
          const step = e < band * 0.35 ? 1 : e < band * 0.7 ? 2 : 4;
          if (step > 1 && ((i + y) % step !== 0)) continue;
          const k = (y * W + i) * 4;
          d[k] = 192; d[k + 1] = 20; d[k + 2] = 12; d[k + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        this.vignette = c;
      }
      lc.globalAlpha = Math.min(1, a);
      lc.drawImage(this.vignette, 0, 0);
      lc.globalAlpha = 1;
    }

    /** Retícula pixelada a la escala de píxel actual. */
    renderCrosshair(ctx) {
      const m = HF.Input.mouse, d = this.dpr;
      const p = this.player;
      if (!p) return;
      const u = Math.max(1, Math.round(this.pixel));
      const x = Math.round(m.sx * d), y = Math.round(m.sy * d);
      const w = p.weapon;
      const gap = Math.round((3 + p.bloom * 5 + (w.def.spread || 0) * 22) ) * u;
      const len = 4 * u;
      const hot = p.power.quad > 0 || p.berserkActive;
      const bars = [[x - gap - len, y - u / 2, len, u], [x + gap, y - u / 2, len, u], [x - u / 2, y - gap - len, u, len], [x - u / 2, y + gap, u, len]];
      ctx.fillStyle = '#05040a';
      for (const [bx, by, bw, bh] of bars) ctx.fillRect(Math.round(bx) - u, Math.round(by) - u, bw + 2 * u, bh + 2 * u);
      ctx.fillStyle = hot ? '#ff5a3a' : '#f2f0e8';
      for (const [bx, by, bw, bh] of bars) ctx.fillRect(Math.round(bx), Math.round(by), bw, bh);
      ctx.fillStyle = '#ff3a1a';
      ctx.fillRect(x - Math.floor(u / 2), y - Math.floor(u / 2), u, u);
      if (w.reloading) {
        const prog = 1 - w.reloadT / w.reloadMax;
        const R = gap + len + 4 * u, n = 24;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i / n) * U.TAU;
          ctx.fillStyle = i / n <= prog ? '#ffd03a' : 'rgba(255,255,255,0.18)';
          ctx.fillRect(Math.round(x + Math.cos(a) * R) - u, Math.round(y + Math.sin(a) * R) - u, 2 * u, 2 * u);
        }
      }
    }
  }

  HF.Game = Game;
})(window.HF);
