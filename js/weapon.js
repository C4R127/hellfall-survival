'use strict';
/* Armas: definiciones, estadísticas, disparo, munición y recarga. */
(function (HF) {
  const U = HF.U;

  const AMMO_TYPES = {
    light: { name: 'Munición ligera', short: 'LIG', color: '#e8c850', pickup: 40 },
    shells: { name: 'Cartuchos', short: 'CAR', color: '#ff7a4a', pickup: 10 },
    heavy: { name: 'Munición pesada', short: 'PES', color: '#ffa02a', pickup: 3 },
    energy: { name: 'Energía', short: 'ENE', color: '#3ae8ff', pickup: 24 },
    special: { name: 'Munición especial', short: 'ESP', color: '#c9a6ff', pickup: 45 },
  };

  const WEAPONS = {
    pistol: {
      id: 'pistol', slot: 1, name: 'Pistola PX-9', short: 'PISTOLA', ammoType: null,
      desc: 'Arma inicial fiable. Precisa y con munición infinita.',
      dmg: 14, rate: 4.5, mag: 12, maxAmmo: Infinity, reload: 1.0, spread: 0.035, speed: 950, range: 720,
      pellets: 1, recoil: 40, crit: 0.05, knock: 90, type: 'bullet', color: '#ffe9a0', sfx: 'shoot_pistol', shake: 1.5, cost: 0,
    },
    shotgun: {
      id: 'shotgun', slot: 2, name: 'Escopeta Rompecráneos', short: 'ESCOPETA', ammoType: 'shells',
      desc: 'Devastadora a corta distancia. 8 perdigones por disparo.',
      dmg: 10, rate: 1.3, mag: 6, maxAmmo: 48, reload: 2.0, spread: 0.3, speed: 820, range: 360,
      pellets: 8, recoil: 180, crit: 0.03, knock: 200, type: 'pellet', color: '#ffcc66', sfx: 'shoot_shotgun', shake: 5, cost: 0,
    },
    rifle: {
      id: 'rifle', slot: 3, name: 'Rifle AR-77 "Lince"', short: 'RIFLE', ammoType: 'light',
      desc: 'Alta cadencia y buen alcance. El arma más equilibrada.',
      dmg: 15, rate: 8, mag: 30, maxAmmo: 240, reload: 1.8, spread: 0.06, speed: 1100, range: 900,
      pellets: 1, recoil: 30, crit: 0.06, knock: 55, type: 'bullet', color: '#fff3b0', sfx: 'shoot_rifle', shake: 1.6, cost: 0,
    },
    plasma: {
      id: 'plasma', slot: 4, name: 'Cañón de Plasma "Nova"', short: 'PLASMA', ammoType: 'energy',
      desc: 'Esferas de energía de alto daño que atraviesan a 2 enemigos.',
      dmg: 34, rate: 4, mag: 24, maxAmmo: 144, reload: 2.2, spread: 0.03, speed: 700, range: 800,
      pellets: 1, recoil: 60, crit: 0.08, knock: 120, pierce: 2, r: 6, type: 'plasma', color: '#5cf2ff', sfx: 'shoot_plasma', shake: 2.5, cost: 60,
    },
    launcher: {
      id: 'launcher', slot: 5, name: 'Lanzacohetes "Martillo"', short: 'LANZACOHETES', ammoType: 'heavy',
      desc: 'Cohetes con daño de área enorme. Ideal contra grupos.',
      dmg: 95, rate: 1.1, mag: 4, maxAmmo: 20, reload: 2.6, spread: 0.02, speed: 560, range: 950,
      pellets: 1, recoil: 260, crit: 0.02, knock: 0, explode: 115, r: 5, type: 'rocket', color: '#ff9a3a', sfx: 'shoot_launcher', shake: 6, cost: 90,
    },
    tesla: {
      id: 'tesla', slot: 6, name: 'Bobina Tesla "Arco"', short: 'TESLA', ammoType: 'special',
      desc: 'Rayo eléctrico que salta entre 4 enemigos y los ralentiza.',
      dmg: 17, rate: 7, mag: 60, maxAmmo: 240, reload: 2.0, spread: 0.35, range: 430, chains: 4, chainRange: 175,
      pellets: 1, recoil: 15, crit: 0.05, knock: 20, type: 'chain', color: '#c9b8ff', sfx: 'shoot_tesla', shake: 1, cost: 120,
    },
  };
  const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'plasma', 'launcher', 'tesla'];
  const MAX_LEVEL = 5;
  const chainTmp = [];

  class Weapon {
    constructor(id) {
      this.id = id;
      this.def = WEAPONS[id];
      this.level = 1;
      this.mag = 0;
      this.reloading = false;
      this.reloadT = 0;
      this.reloadMax = 1;
      this.cool = 0;
      this.emptyT = 0;
    }
    stats(p) {
      const d = this.def, l = this.level - 1;
      return {
        dmg: d.dmg * (1 + 0.18 * l) * p.dmgTotal,
        rate: d.rate * (1 + 0.06 * l) * p.rateTotal,
        mag: this.magSize(p),
        reload: d.reload * p.reloadMult * (1 - 0.05 * l),
        crit: d.crit + p.critChance,
        range: d.range * p.rangeMult,
      };
    }
    magSize(p) { return Math.max(1, Math.round(this.def.mag * p.magMult * (1 + 0.1 * (this.level - 1)))); }
    reserve(p) { return this.def.ammoType ? p.ammo[this.def.ammoType] : Infinity; }

    update(dt, p) {
      this.cool -= dt;
      this.emptyT -= dt;
      if (this.reloading) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) this.finishReload(p);
      }
    }
    startReload(p) {
      if (this.reloading || this.mag >= this.magSize(p) || this.reserve(p) <= 0) return false;
      this.reloading = true;
      this.reloadMax = this.reloadT = this.stats(p).reload;
      HF.Audio.play('reload');
      return true;
    }
    cancelReload() { this.reloading = false; }
    finishReload(p) {
      const need = this.magSize(p) - this.mag;
      const type = this.def.ammoType;
      const take = type ? Math.min(need, p.ammo[type]) : need;
      this.mag += take;
      if (type) p.ammo[type] -= take;
      this.reloading = false;
      HF.Audio.play('reloadDone');
    }

    tryFire(p, g) {
      if (this.cool > 0 || this.reloading) return false;
      const free = p.overdriveActive;
      if (this.mag <= 0 && !free) {
        if (!this.startReload(p) && this.emptyT <= 0) {
          this.emptyT = 0.4;
          HF.Audio.play('empty');
          g.particles.text(p.x, p.y - 30, 'SIN MUNICIÓN', '#ff6a5a', 12, 0.7);
        }
        return false;
      }
      const d = this.def;
      const s = this.stats(p);
      this.cool = 1 / s.rate;
      if (!free) this.mag--;

      const a = p.angle;
      let mx = p.x + Math.cos(a) * 22, my = p.y + Math.sin(a) * 22;
      if (g.map.blocksShot(mx, my)) { mx = p.x; my = p.y; }

      if (d.type === 'chain') {
        this.fireChain(p, g, mx, my, s);
      } else {
        const pellets = d.pellets + p.extraProjectiles * (d.pellets > 1 ? 2 : 1);
        const spread = d.spread * (1 + p.bloom * 0.8) * p.accuracyMult;
        for (let i = 0; i < pellets; i++) {
          let ang;
          if (d.pellets > 1) ang = a + U.rand(-spread, spread);
          else if (pellets > 1) ang = a + (i - (pellets - 1) / 2) * 0.12 + U.rand(-spread, spread) * 0.5;
          else ang = a + U.rand(-spread, spread);
          const crit = Math.random() < s.crit;
          const proj = g.projectiles.get();
          if (!proj) break;
          proj.init({
            x: mx, y: my, angle: ang, speed: d.speed * (d.pellets > 1 ? U.rand(0.85, 1.1) : 1),
            dmg: s.dmg * (crit ? p.critMult : 1), owner: 'player', type: d.type, color: crit ? '#ff6a3a' : d.color,
            range: s.range * (d.pellets > 1 ? U.rand(0.8, 1.05) : 1), pierce: (d.pierce || 0) + p.pierce,
            crit, knock: d.knock, explode: d.explode ? d.explode * p.explosionMult : 0, r: d.r || 3, weapon: this.id,
          });
        }
        // casquillos
        if (d.type === 'bullet' || d.type === 'pellet') {
          HF.FX.casing(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, a, d.type === 'pellet');
        }
      }

      // fogonazo
      const mz = p.muzzlePoint();
      HF.FX.muzzle(this.id, mz.x, mz.y, mz.a);
      p.shootT = 0.09;

      p.bloom = Math.min(1.6, p.bloom + d.recoil / 450);
      p.kx -= Math.cos(a) * d.recoil * 0.6;
      p.ky -= Math.sin(a) * d.recoil * 0.6;
      p.recoilKick = Math.min(6, p.recoilKick + d.recoil / 40);
      g.shake(d.shake * 0.55);
      HF.Audio.play(d.sfx, { pitch: U.rand(0.94, 1.06) });
      g.run.shots++;

      if (this.mag <= 0 && !free && this.reserve(p) > 0) this.startReload(p);
      return true;
    }

    fireChain(p, g, mx, my, s) {
      const range = s.range;
      // primer objetivo: el enemigo más cercano dentro del cono de apuntado
      let first = null, bestScore = Infinity;
      g.hash.query(p.x, p.y, range, chainTmp);
      for (const e of chainTmp) {
        if (!e.alive || e.invulnerable) continue;
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d > range + e.r) continue;
        const da = Math.abs(U.angleDiff(p.angle, U.angleTo(p.x, p.y, e.x, e.y)));
        if (da > 0.45) continue;
        if (!g.map.los(mx, my, e.x, e.y)) continue;
        const score = d * (1 + da * 2);
        if (score < bestScore) { bestScore = score; first = e; }
      }
      if (!first) {
        const ex = mx + Math.cos(p.angle + U.rand(-0.3, 0.3)) * U.rand(60, 120);
        const ey = my + Math.sin(p.angle + U.rand(-0.3, 0.3)) * U.rand(60, 120);
        g.particles.bolt(mx, my, ex, ey, this.def.color, 0.07, 1);
        return;
      }
      const hit = [first];
      let cur = first, px = mx, py = my;
      const chains = this.def.chains + Math.floor((this.level - 1) / 2);
      for (let i = 0; i <= chains; i++) {
        g.particles.bolt(px, py, cur.x, cur.y, this.def.color, 0.1, 1);
        const crit = Math.random() < s.crit;
        g.damageEnemy(cur, s.dmg * (crit ? p.critMult : 1) * (1 - i * 0.08), { crit, kx: 0, ky: 0, x: cur.x, y: cur.y, weapon: this.id, slow: 1.2 });
        HF.FX.zap(cur.x, cur.y);
        px = cur.x; py = cur.y;
        let next = null, nd = this.def.chainRange * this.def.chainRange;
        g.hash.query(px, py, this.def.chainRange, chainTmp);
        for (const e of chainTmp) {
          if (!e.alive || hit.includes(e) || e.invulnerable) continue;
          const d2 = U.dist2(px, py, e.x, e.y);
          if (d2 < nd) { nd = d2; next = e; }
        }
        if (!next) break;
        hit.push(next);
        cur = next;
      }
    }
  }

  HF.AMMO_TYPES = AMMO_TYPES;
  HF.WEAPONS = WEAPONS;
  HF.WEAPON_ORDER = WEAPON_ORDER;
  HF.WEAPON_MAX_LEVEL = MAX_LEVEL;
  HF.Weapon = Weapon;
})(window.HF);
