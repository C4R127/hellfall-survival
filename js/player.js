'use strict';
/* Jugador: movimiento, vida, armadura, armas, munición, habilidades y experiencia. */
(function (HF) {
  const U = HF.U;

  const ABILITIES = {
    shockwave: { id: 'shockwave', name: 'Shockwave', desc: 'Onda expansiva que daña y empuja a los enemigos cercanos.', cd: 11, dur: 0, color: '#6cf', icon: '◎' },
    shield: { id: 'shield', name: 'Escudo', desc: 'Escudo que bloquea todo el daño durante 4 s.', cd: 18, dur: 4, color: '#3affff', icon: '⬡' },
    overdrive: { id: 'overdrive', name: 'Overdrive', desc: 'Cadencia x1.8 y munición ilimitada durante 6 s.', cd: 20, dur: 6, color: '#ffd03a', icon: '⚡' },
    berserk: { id: 'berserk', name: 'Berserk', desc: 'Daño x1.75 y +20% velocidad durante 6 s.', cd: 20, dur: 6, color: '#ff3a3a', icon: '✸' },
  };

  const xpForLevel = (l) => Math.floor(45 + 25 * l + 5 * l * l);

  class Player {
    constructor(game) {
      this.game = game;
      const s = HF.SaveManager.data;
      const meta = (id) => s.meta[id] || 0;

      this.x = game.map.playerStart.x;
      this.y = game.map.playerStart.y;
      this.r = 13;
      this.angle = -Math.PI / 2;
      this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;

      // estadísticas base + mejoras permanentes
      this.maxHp = 100 + meta('hp') * 10;
      this.hp = this.maxHp;
      this.maxArmor = 50;
      this.armor = Math.min(this.maxArmor, meta('armor') * 15);
      this.armorAbsorb = 0.6;
      this.speed = 205;
      this.sprintMult = 1.45;
      this.maxStamina = 100;
      this.stamina = 100;
      this.staminaRegen = 26;
      this.exhausted = false;
      this.dmgMult = 1 + meta('dmg') * 0.05;
      this.rateMult = 1;
      this.critChance = 0.05;
      this.critMult = 2;
      this.pierce = 0;
      this.rangeMult = 1;
      this.accuracyMult = 1;
      this.extraProjectiles = 0;
      this.dmgReduction = 0;
      this.regen = 0;
      this.evasion = 0;
      this.magMult = 1;
      this.reloadMult = 1;
      this.ammoMult = 1 + meta('ammo') * 0.1;
      this.dropMult = 1;
      this.coinMult = 1 + meta('coins') * 0.1;
      this.xpMult = 1 + meta('xp') * 0.08;
      this.magnet = 80;
      this.explosionMult = 1;
      this.cdMult = 1;

      this.dash = { charges: 1, max: 1, cd: 2.3 * (1 - meta('dash') * 0.08), t: 0, active: 0, dx: 0, dy: 0, ghostT: 0 };
      this.grenade = { cd: 7, t: 0, radius: 110, dmg: 70 };
      this.ability = { id: 'shockwave', t: 0, active: 0 };
      this.power = { quad: 0, rapid: 0, invul: 0 };

      this.level = 1;
      this.xp = 0;
      this.xpNext = xpForLevel(1);
      this.coins = 0;
      this.upgrades = {};

      this.ammo = { light: 0, shells: 0, heavy: 0, energy: 0, special: 0 };
      this.weapons = {};
      this.current = 'pistol';
      this.addWeapon('pistol');

      this.iframes = 0;
      this.hurtFlash = 0;
      this.bloom = 0;
      this.recoilKick = 0;
      this.walkPhase = 0;
      this.toxicT = 0;
      this.alive = true;
      this.hitThisWave = false;
    }

    /* ---------------- propiedades derivadas ---------------- */
    get weapon() { return this.weapons[this.current]; }
    get berserkActive() { return this.ability.id === 'berserk' && this.ability.active > 0; }
    get overdriveActive() { return this.ability.id === 'overdrive' && this.ability.active > 0; }
    get shieldActive() { return this.ability.id === 'shield' && this.ability.active > 0; }
    get dmgTotal() { return this.dmgMult * (this.power.quad > 0 ? 2 : 1) * (this.berserkActive ? 1.75 : 1); }
    get rateTotal() { return this.rateMult * (this.power.rapid > 0 ? 1.6 : 1) * (this.overdriveActive ? 1.8 : 1); }
    get abilityDef() { return ABILITIES[this.ability.id]; }
    get abilityCd() { return this.abilityDef.cd * this.cdMult; }
    ammoMax(type) { return Math.round(HF.WEAPONS[this.ammoOwner(type)]?.maxAmmo * this.ammoMult) || 0; }
    ammoOwner(type) {
      for (const id of HF.WEAPON_ORDER) if (HF.WEAPONS[id].ammoType === type) return id;
      return null;
    }
    ownedAmmoTypes() {
      const out = [];
      for (const id in this.weapons) { const t = HF.WEAPONS[id].ammoType; if (t && !out.includes(t)) out.push(t); }
      return out;
    }

    addWeapon(id) {
      if (this.weapons[id]) return false;
      const w = new HF.Weapon(id);
      this.weapons[id] = w;
      w.mag = w.magSize(this);
      const t = w.def.ammoType;
      if (t) this.ammo[t] = Math.max(this.ammo[t], Math.round(this.ammoMax(t) * 0.5));
      return true;
    }
    switchTo(id) {
      if (!this.weapons[id] || id === this.current) return;
      this.weapon.cancelReload();
      this.current = id;
      this.weapon.cool = Math.max(this.weapon.cool, 0.18);
      HF.Audio.play('switch');
      this.game.ui.flashWeapon();
    }
    cycleWeapon(dir) {
      const owned = HF.WEAPON_ORDER.filter((id) => this.weapons[id]);
      if (owned.length < 2) return;
      const i = owned.indexOf(this.current);
      this.switchTo(owned[(i + dir + owned.length) % owned.length]);
    }

    /* ---------------- actualización ---------------- */
    update(dt) {
      const g = this.game, I = HF.Input, map = g.map;

      // movimiento
      let mx = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
      let my = (I.isDown('down') ? 1 : 0) - (I.isDown('up') ? 1 : 0);
      const moving = mx || my;
      if (moving) { const l = Math.hypot(mx, my); mx /= l; my /= l; }

      let speed = this.speed * (this.berserkActive ? 1.2 : 1);
      if (I.isDown('sprint') && moving && !this.exhausted && this.stamina > 0) {
        speed *= this.sprintMult;
        this.stamina -= 30 * dt;
        if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; }
      } else {
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
        if (this.exhausted && this.stamina > this.maxStamina * 0.35) this.exhausted = false;
      }
      if (map.inToxic(this.x, this.y)) speed *= 0.85;

      // dash
      const D = this.dash;
      if (D.charges < D.max) {
        D.t += dt;
        if (D.t >= D.cd) { D.t = 0; D.charges++; }
      }
      if (I.pressed('dash') && D.charges > 0 && D.active <= 0) {
        const dx = moving ? mx : Math.cos(this.angle), dy = moving ? my : Math.sin(this.angle);
        D.dx = dx; D.dy = dy; D.active = 0.16; D.charges--;
        if (D.charges === D.max - 1) D.t = 0;
        this.iframes = Math.max(this.iframes, 0.22);
        HF.Audio.play('dash');
        g.particles.burst(this.x, this.y, 10, { type: 'smoke', speed: [20, 80], life: [0.3, 0.5], size: [5, 9], color: '#556', grow: 8 });
      }

      if (D.active > 0) {
        D.active -= dt;
        this.vx = D.dx * 900; this.vy = D.dy * 900;
        D.ghostT -= dt;
        if (D.ghostT <= 0) {
          D.ghostT = 0.025;
          g.particles.spawn('ghost', this.x, this.y, 0, 0, 0.25, 1, '#fff', { img: HF.Sprites.get('player', 0).img, angle: this.angle });
        }
        if (D.active <= 0) { this.vx *= 0.3; this.vy *= 0.3; }
      } else {
        this.vx = U.damp(this.vx, mx * speed, 16, dt);
        this.vy = U.damp(this.vy, my * speed, 16, dt);
      }
      const kd = Math.exp(-9 * dt);
      this.kx *= kd; this.ky *= kd;
      this.x += (this.vx + this.kx) * dt;
      this.y += (this.vy + this.ky) * dt;
      HF.Collision.resolveCircleMap(this, map);
      for (const b of g.barrels) if (b.alive) HF.Collision.separate(b, this, 1000, 1);
      if (moving) this.walkPhase += dt * speed * 0.05;

      // apuntado
      const mw = g.mouseWorld();
      this.angle = Math.atan2(mw.y - this.y, mw.x - this.x);

      // armas
      for (let i = 0; i < 6; i++) if (I.pressed('weapon' + (i + 1))) this.switchTo(HF.WEAPON_ORDER[i]);
      if (I.wheel) this.cycleWeapon(I.wheel > 0 ? 1 : -1);
      if (I.pressed('nextWeapon')) this.cycleWeapon(1);
      if (I.pressed('prevWeapon')) this.cycleWeapon(-1);
      if (I.pressed('reload')) this.weapon.startReload(this);
      for (const id in this.weapons) this.weapons[id].update(id === this.current ? dt : 0, this);
      if (I.mouse.left || I.mouse.leftPressed) this.weapon.tryFire(this, g);

      // granada (clic derecho o tecla)
      this.grenade.t -= dt;
      if ((I.mouse.rightPressed || I.pressed('grenade')) && this.grenade.t <= 0) this.throwGrenade();

      // habilidad
      const A = this.ability;
      A.t -= dt;
      if (A.active > 0) A.active -= dt;
      if (I.pressed('ability')) {
        if (A.t <= 0) this.useAbility();
        else HF.Audio.play('deny');
      }

      // temporizadores
      for (const k in this.power) if (this.power[k] > 0) this.power[k] -= dt;
      this.iframes -= dt;
      this.hurtFlash -= dt;
      this.bloom = Math.max(0, this.bloom - dt * 2.2);
      this.recoilKick = Math.max(0, this.recoilKick - dt * 40);
      if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

      // zona contaminada
      if (map.inToxic(this.x, this.y)) {
        this.toxicT -= dt;
        if (this.toxicT <= 0) {
          this.toxicT = 0.35;
          this.takeDamage(3, { env: true, iframes: 0 });
          g.particles.burst(this.x, this.y, 3, { type: 'dot', speed: [20, 60], life: [0.3, 0.6], size: [2, 3], color: '#8aff3a' });
        }
      }
    }

    throwGrenade() {
      const g = this.game;
      this.grenade.t = this.grenade.cd;
      const p = g.projectiles.get();
      if (!p) return;
      const mw = g.mouseWorld();
      const d = U.clamp(U.dist(this.x, this.y, mw.x, mw.y), 80, 420);
      p.init({
        x: this.x, y: this.y, angle: this.angle, speed: d * 2.2, dmg: this.grenade.dmg * this.dmgTotal,
        owner: 'player', type: 'grenade', explode: this.grenade.radius * this.explosionMult, fuse: 0.85, drag: 2.4, r: 5,
      });
      HF.Audio.play('switch');
    }

    useAbility() {
      const g = this.game, A = this.ability, def = this.abilityDef;
      A.t = this.abilityCd;
      A.active = def.dur;
      switch (A.id) {
        case 'shockwave': {
          const R = 230;
          HF.Audio.play('shockwave');
          g.shake(8);
          g.particles.spawn('ring', this.x, this.y, 0, 0, 0.45, R, '#7fdcff', { add: true });
          g.particles.spawn('ring', this.x, this.y, 0, 0, 0.3, R * 0.6, '#ffffff', { add: true });
          g.particles.light(this.x, this.y, 320, '120,200,255', 0.9, 0.3);
          g.forEachEnemyInRadius(this.x, this.y, R, (e, d) => {
            const a = U.angleTo(this.x, this.y, e.x, e.y);
            const f = 1 - d / (R + e.r);
            g.damageEnemy(e, 45 * this.dmgTotal * (0.5 + f * 0.5), { kx: Math.cos(a) * 900 * f, ky: Math.sin(a) * 900 * f, stagger: true, x: e.x, y: e.y });
          });
          g.forEachEnemyProjectile((pr) => {
            if (U.dist2(pr.x, pr.y, this.x, this.y) < R * R) g.projectiles.release(pr);
          });
          break;
        }
        case 'shield': HF.Audio.play('shield'); break;
        case 'overdrive':
        case 'berserk': HF.Audio.play('power'); break;
      }
      g.ui.toast(def.name.toUpperCase() + '!', 'ability');
    }

    /* ---------------- daño y recursos ---------------- */
    takeDamage(amount, opts = {}) {
      const g = this.game;
      if (!this.alive || g.state !== 'playing') return false;
      if (!opts.env && (this.iframes > 0 || this.dash.active > 0)) return false;
      if (this.power.invul > 0) return false;
      if (this.shieldActive) {
        g.particles.spawn('ring', this.x, this.y, 0, 0, 0.2, 30, '#3affff', { add: true });
        return false;
      }
      if (!opts.env && this.evasion > 0 && Math.random() < this.evasion) {
        g.particles.text(this.x, this.y - 26, 'EVADIDO', '#9fd0ff', 13);
        this.iframes = 0.2;
        return false;
      }
      amount *= 1 - this.dmgReduction;
      const absorbed = Math.min(this.armor, amount * this.armorAbsorb);
      this.armor -= absorbed;
      const real = amount - absorbed;
      this.hp -= real;
      this.hurtFlash = 0.2;
      this.iframes = opts.iframes ?? 0.4;
      if (opts.x !== undefined) {
        const a = U.angleTo(opts.x, opts.y, this.x, this.y);
        this.kx += Math.cos(a) * 260; this.ky += Math.sin(a) * 260;
      }
      g.onPlayerHurt(amount, opts);
      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
        g.onPlayerDeath();
      }
      return true;
    }
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    addArmor(n) { this.armor = Math.min(this.maxArmor, this.armor + n); }
    addAmmo(type, n) {
      const max = this.ammoMax(type);
      this.ammo[type] = Math.min(max, this.ammo[type] + Math.round(n * this.ammoMult));
    }
    refillAmmo(frac = 1) {
      for (const t of this.ownedAmmoTypes()) {
        this.ammo[t] = Math.max(this.ammo[t], Math.round(this.ammoMax(t) * frac));
      }
    }
    gainXp(n) {
      this.xp += n * this.xpMult;
      while (this.xp >= this.xpNext) {
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = xpForLevel(this.level);
        this.game.onLevelUp();
      }
    }
    addCoins(n) {
      const v = Math.max(1, Math.round(n * this.coinMult));
      this.coins += v;
      this.game.run.coinsEarned += v;
      return v;
    }

    /* ---------------- render ---------------- */
    render(ctx) {
      const g = this.game;
      const t = g.time;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(this.x + 3, this.y + 6, 14, 10, 0, 0, U.TAU); ctx.fill();

      if (this.iframes > 0 && this.dash.active <= 0 && Math.floor(t * 30) % 2 === 0) ctx.globalAlpha = 0.5;

      const moving = Math.abs(this.vx) + Math.abs(this.vy) > 20;
      const frame = moving ? Math.floor(this.walkPhase) % 2 : 0;
      const spr = HF.Sprites.get('player', frame);
      const wsp = HF.Sprites.get('w_' + this.current);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      const kick = -this.recoilKick;
      ctx.drawImage(wsp.img, 14 + kick, 4 - wsp.h / 2 + 2);
      const bob = moving ? Math.sin(this.walkPhase * Math.PI) * 0.04 : 0;
      ctx.scale(1 + bob, 1 - bob);
      ctx.drawImage(spr.img, -spr.w / 2, -spr.h / 2);
      if (this.hurtFlash > 0) {
        ctx.globalAlpha = this.hurtFlash * 4;
        ctx.drawImage(spr.white, -spr.w / 2, -spr.h / 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // escudo / auras
      if (this.shieldActive || this.power.invul > 0) {
        ctx.strokeStyle = '#3affff';
        ctx.globalAlpha = 0.5 + Math.sin(t * 12) * 0.2;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, 24, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 0.12; ctx.fillStyle = '#3affff'; ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (this.berserkActive || this.power.quad > 0) {
        ctx.strokeStyle = '#ff3a3a'; ctx.globalAlpha = 0.45; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, 20 + Math.sin(t * 10) * 2, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (this.overdriveActive || this.power.rapid > 0) {
        if (Math.random() < 0.4) g.particles.spawn('spark', this.x + U.rand(-12, 12), this.y + U.rand(-12, 12), 0, -60, 0.2, 1.5, '#ffd03a', { add: true });
      }
      // barra de recarga
      const w = this.weapon;
      if (w.reloading) {
        const f = 1 - w.reloadT / w.reloadMax;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - 18, this.y + 22, 36, 5);
        ctx.fillStyle = '#ffd03a'; ctx.fillRect(this.x - 17, this.y + 23, 34 * f, 3);
      }
    }
  }

  HF.ABILITIES = ABILITIES;
  HF.Player = Player;
})(window.HF);
