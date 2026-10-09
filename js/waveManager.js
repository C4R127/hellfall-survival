'use strict';
/*
 * WaveManager: crea oleadas, controla la dificultad, genera enemigos con
 * distintos patrones de aparición y detecta cuándo termina cada oleada.
 */
(function (HF) {
  const U = HF.U;
  const MIN_SPAWN_DIST = 400;

  // oleada en la que aparece por primera vez cada tipo
  const INTRO = { crawler: 1, stalker: 3, spitter: 4, warlock: 5, bloater: 6, brute: 8 };

  class WaveManager {
    constructor(g) {
      this.g = g;
      this.wave = 0;
      this.state = 'intermission'; // intermission | active
      this.timer = 4;
      this.prep = false;
      this.queue = [];
      this.spawnT = 0;
      this.cfg = null;
      this.bossWave = false;
      this.maxAlive = 40;
      this.bossesDefeated = 0;
    }

    get remaining() {
      return this.queue.length + this.g.spawnMarkers.length + this.g.aliveEnemies + (this.g.boss && this.g.boss.alive ? 1 : 0);
    }
    get total() { return this.cfg ? this.cfg.total : 0; }

    /** Composición y escalado de la oleada n. */
    config(n) {
      const isBoss = n % 10 === 0;
      const mods = {
        hp: 1 + 0.1 * (n - 1) + 0.004 * (n - 1) ** 2,
        dmg: 1 + 0.05 * (n - 1),
        speed: 1 + Math.min(0.35, 0.012 * (n - 1)),
      };
      const elite = n < 7 ? 0 : Math.min(0.28, 0.025 * (n - 6));
      const counts = {};
      const add = (t, c) => { counts[t] = (counts[t] || 0) + Math.round(c); };

      const fixed = {
        1: { crawler: 8 },
        2: { crawler: 14 },
        3: { crawler: 12, stalker: 6 },
        4: { crawler: 12, stalker: 5, spitter: 5 },
        5: { crawler: 12, stalker: 6, spitter: 4, warlock: 2 },
        6: { crawler: 14, stalker: 6, spitter: 5, warlock: 1, bloater: 5 },
        7: { crawler: 20, stalker: 9, spitter: 6, warlock: 2, bloater: 6 },
        8: { crawler: 18, stalker: 8, spitter: 6, warlock: 2, bloater: 5, brute: 2 },
        9: { crawler: 20, stalker: 10, spitter: 7, warlock: 3, bloater: 7, brute: 3 },
      };
      if (fixed[n]) {
        for (const t in fixed[n]) add(t, fixed[n][t]);
      } else if (isBoss) {
        add('crawler', 6 + n * 0.6);
        add('stalker', n * 0.3);
        if (n >= 20) add('spitter', n * 0.15);
      } else {
        const budget = 30 + n * 5.5;
        const w = {
          crawler: 1, stalker: 0.55, spitter: 0.35, bloater: 0.3,
          warlock: Math.min(0.14, 0.05 + n * 0.004), brute: Math.min(0.2, 0.06 + n * 0.005),
        };
        // oleadas temáticas para variar los patrones
        const theme = n % 4;
        if (theme === 1) w.stalker *= 2;
        if (theme === 2) { w.spitter *= 1.8; w.warlock *= 1.5; }
        if (theme === 3) { w.brute *= 1.8; w.bloater *= 1.6; }
        const cost = { crawler: 1, stalker: 1.2, spitter: 1.6, bloater: 1.5, warlock: 4, brute: 5 };
        let total = 0;
        for (const t in w) total += w[t];
        for (const t in w) add(t, (budget * (w[t] / total)) / cost[t]);
      }

      const list = [];
      for (const t in counts) for (let i = 0; i < counts[t]; i++) list.push(t);
      U.shuffle(list);
      // los tipos duros llegan más tarde dentro de la oleada
      list.sort((a, b) => (a === 'brute' || a === 'warlock' ? 1 : 0) - (b === 'brute' || b === 'warlock' ? 1 : 0));

      return {
        n, isBoss, mods, elite, list,
        total: list.length + (isBoss ? 1 : 0),
        interval: Math.max(0.8, 2.8 - n * 0.09),
        group: Math.min(8, 2 + Math.floor(n / 2.5)),
        maxAlive: Math.min(110, 30 + n * 4),
        patterns: n < 3 ? ['groups', 'frontal'] : n < 6 ? ['groups', 'frontal', 'lateral', 'circular'] : ['groups', 'frontal', 'lateral', 'circular', 'surround', 'combined'],
      };
    }

    startNext() {
      const g = this.g;
      this.wave++;
      this.cfg = this.config(this.wave);
      this.queue = this.cfg.list.slice();
      this.maxAlive = this.cfg.maxAlive;
      this.state = 'active';
      this.prep = false;
      this.spawnT = 1;
      this.bossWave = this.cfg.isBoss;
      g.player.hitThisWave = false;
      g.respawnBarrels();
      g.onWaveStart(this.wave, this.cfg);
      if (this.bossWave) {
        const tier = Math.floor(this.wave / 10);
        const type = tier % 2 === 1 ? 'herald' : 'matriarch';
        g.spawnBoss(type, Math.ceil(tier / 2));
        this.spawnT = 6;
      }
    }

    update(dt) {
      const g = this.g;
      if (this.state === 'intermission') {
        if (!this.prep) {
          this.timer -= dt;
          if (this.timer <= 0) this.startNext();
        }
        return;
      }
      // oleada activa
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.queue.length) {
        if (g.aliveEnemies + g.spawnMarkers.length < this.maxAlive) this.spawnGroup();
        this.spawnT = this.cfg.interval * U.rand(0.8, 1.2) * (this.bossWave ? 2.2 : 1);
      }
      if (!this.queue.length && !g.spawnMarkers.length && g.aliveEnemies === 0 && !(g.boss && g.boss.alive)) {
        this.complete();
      }
    }

    complete() {
      const g = this.g;
      this.state = 'intermission';
      this.prep = this.wave % 5 === 0;
      this.timer = 7;
      g.onWaveComplete(this.wave, this.prep);
    }

    skipIntermission() {
      if (this.state === 'intermission') { this.prep = false; this.timer = 0; }
    }

    spawnGroup() {
      const c = this.cfg;
      const pattern = U.pick(c.patterns);
      const n = Math.min(this.queue.length, U.randInt(Math.max(1, c.group - 2), c.group));
      const pts = this.pickPoints(pattern, n);
      for (const pt of pts) {
        const type = this.queue.shift();
        if (!type) break;
        this.g.addSpawnMarker(pt.x, pt.y, type, Math.random() < c.elite, c.mods);
      }
    }

    validPoint(x, y) {
      const g = this.g, p = g.player;
      if (!g.map.isFreeCircle(x, y, 22)) return false;
      if (U.dist2(x, y, p.x, p.y) < MIN_SPAWN_DIST * MIN_SPAWN_DIST) return false;
      return g.map.flowDist(x, y) < 65535;
    }

    /** Devuelve posiciones válidas según el patrón de ataque. */
    pickPoints(pattern, n) {
      const g = this.g, p = g.player;
      const out = [];
      const ventFallback = () => {
        const vents = g.map.spawnVents.filter((v) => this.validPoint(v.x, v.y));
        return vents.length ? U.pick(vents) : null;
      };
      const ringPoint = (ang, rMin = 460, rMax = 640) => {
        for (let k = 0; k < 8; k++) {
          const a = ang + U.rand(-0.25, 0.25) * (k + 1) * 0.5;
          const r = U.rand(rMin, rMax);
          const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
          if (this.validPoint(x, y)) return { x, y };
        }
        return null;
      };
      const cluster = (c) => {
        for (let k = 0; k < 6; k++) {
          const x = c.x + U.rand(-50, 50), y = c.y + U.rand(-50, 50);
          if (g.map.isFreeCircle(x, y, 16)) return { x, y };
        }
        return { x: c.x, y: c.y };
      };

      if (pattern === 'groups') {
        const v = ventFallback();
        if (v) for (let i = 0; i < n; i++) out.push(cluster(v));
      } else if (pattern === 'frontal' || pattern === 'lateral') {
        const base = pattern === 'frontal' ? p.angle : p.angle + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        for (let i = 0; i < n; i++) {
          const pt = ringPoint(base + (i - (n - 1) / 2) * 0.18);
          if (pt) out.push(pt);
        }
      } else if (pattern === 'circular' || pattern === 'surround') {
        const off = Math.random() * U.TAU;
        const rr = pattern === 'surround' ? [430, 520] : [480, 660];
        for (let i = 0; i < n; i++) {
          const pt = ringPoint(off + (i / n) * U.TAU, rr[0], rr[1]);
          if (pt) out.push(pt);
        }
      } else { // combined
        const v = ventFallback();
        for (let i = 0; i < n; i++) {
          const pt = i % 2 && v ? cluster(v) : ringPoint(Math.random() * U.TAU);
          if (pt) out.push(pt);
        }
      }
      // completar con rejillas si faltan puntos
      while (out.length < n) {
        const v = ventFallback();
        if (!v) {
          // último recurso: cualquier rejilla lejos del jugador
          const far = g.map.spawnVents.slice().sort((a, b) => U.dist2(b.x, b.y, p.x, p.y) - U.dist2(a.x, a.y, p.x, p.y))[0];
          out.push(cluster(far));
        } else out.push(cluster(v));
      }
      return out;
    }
  }

  HF.WaveManager = WaveManager;
  HF.ENEMY_INTRO = INTRO;
})(window.HF);
