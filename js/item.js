'use strict';
/* Objetos recogibles: vida, armadura, munición, monedas, energía, power-ups y cajas de armas. */
(function (HF) {
  const U = HF.U;

  const POWERUPS = {
    quad: { name: 'DAÑO x2', dur: 10, color: '#ff3a3a' },
    rapid: { name: 'CADENCIA x1.6', dur: 10, color: '#ffd03a' },
    invul: { name: 'INVULNERABLE', dur: 6, color: '#3affff' },
    nuke: { name: 'PULSO NUCLEAR', dur: 0, color: '#ff8a2a' },
  };

  class Item {
    constructor() { this.active = false; }
    init(type, x, y, data) {
      this.type = type;
      this.data = data;
      this.x = x; this.y = y;
      const a = Math.random() * U.TAU, s = U.rand(60, 170);
      this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
      this.r = type === 'crate' ? 14 : type === 'coin' ? 7 : 10;
      this.life = type === 'crate' ? 60 : type === 'power' ? 20 : 16;
      this.bob = Math.random() * 10;
      this.magnetized = false;
      this.sprite = 'pickup_' + (type === 'log' ? 'datalog' : type === 'power' ? data : type === 'health' && data > 30 ? 'healthBig' : type === 'ammo' ? 'ammo_' + data.type : type);
      this.age = 0;
      return this;
    }

    canPick(p) {
      switch (this.type) {
        case 'health': return p.hp < p.maxHp;
        case 'armor': return p.armor < p.maxArmor;
        case 'ammo': return p.ammo[this.data.type] < p.ammoMax(this.data.type);
        default: return true;
      }
    }

    update(dt, g) {
      const p = g.player;
      this.life -= dt;
      this.age += dt;
      if (this.life <= 0) return false;
      this.bob += dt * 4;
      const d2 = U.dist2(this.x, this.y, p.x, p.y);
      const can = this.canPick(p);
      if (can && (this.magnetized || d2 < p.magnet * p.magnet) && this.type !== 'crate') {
        this.magnetized = true;
        const d = Math.sqrt(d2) || 1;
        const s = 560;
        this.vx = U.damp(this.vx, ((p.x - this.x) / d) * s, 10, dt);
        this.vy = U.damp(this.vy, ((p.y - this.y) / d) * s, 10, dt);
      } else {
        const k = Math.exp(-5 * dt);
        this.vx *= k; this.vy *= k;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (!this.magnetized) HF.Collision.resolveCircleMap(this, g.map);

      if (can && d2 < (p.r + this.r) ** 2) {
        this.apply(g, p);
        return false;
      }
      return true;
    }

    apply(g, p) {
      const P = g.particles;
      switch (this.type) {
        case 'health':
          p.heal(this.data);
          P.text(p.x, p.y - 24, '+' + this.data + ' VIDA', '#ff5a6a', 13);
          HF.Audio.play('heal');
          break;
        case 'armor':
          p.addArmor(this.data);
          P.text(p.x, p.y - 24, '+' + this.data + ' ARMADURA', '#5ab0ff', 13);
          HF.Audio.play('pickup');
          break;
        case 'ammo': {
          const t = this.data.type;
          p.addAmmo(t, this.data.amount);
          P.text(p.x, p.y - 24, '+' + HF.AMMO_TYPES[t].name.toUpperCase(), HF.AMMO_TYPES[t].color, 12);
          HF.Audio.play('pickup');
          break;
        }
        case 'coin': {
          const v = p.addCoins(this.data);
          P.text(p.x, p.y - 22, '+' + v, '#ffd040', 12, 0.6);
          HF.Audio.play('coin');
          break;
        }
        case 'energy':
          p.ability.t = Math.max(0, p.ability.t - 3);
          p.grenade.t = Math.max(0, p.grenade.t - 2);
          P.text(p.x, p.y - 24, 'ENERGÍA', '#2affd0', 13);
          HF.Audio.play('pickup');
          break;
        case 'power': {
          const def = POWERUPS[this.data];
          if (this.data === 'nuke') g.nuke();
          else p.power[this.data] = def.dur;
          g.ui.toast(def.name, 'power');
          P.light(p.x, p.y, 260, '255,255,255', 0.8, 0.3);
          HF.Audio.play('power');
          break;
        }
        case 'crate':
          g.openWeaponCrate(this.data);
          break;
        case 'log':
          HF.Story.collectLog(this.data);
          HF.Audio.play('achievement');
          break;
      }
      HF.FX.pickup(this.x, this.y);
    }

    render(ctx, g) {
      const A = HF.Assets;
      if (this.life < 4 && Math.floor(this.life * 8) % 2 === 0) return; // parpadeo antes de desaparecer
      const s = A.sheet(this.sprite);
      if (!s) return;
      const by = Math.round(Math.sin(this.bob) * 1.5);
      A.drawImage(ctx, s.fw > 20 ? 'shadow_m' : 'shadow_s', this.x, this.y + Math.round(s.fh * 0.35));
      const f = Math.floor(g.time * 5 + this.bob) % s.anims.idle.frames;
      const pop = this.age < 0.12;
      A.draw(ctx, this.sprite, 'idle', f, 0, this.x, this.y - 2 + by, { flash: pop ? 0.8 : 0 });
      if (this.type === 'power' || this.type === 'crate' || this.type === 'log') {
        // destellos que orbitan para destacar objetos especiales
        ctx.fillStyle = this.type === 'crate' ? '#ffcc3a' : '#ffffff';
        const r = s.fw * 0.6;
        for (let i = 0; i < 2; i++) {
          const a = g.time * 3 + i * Math.PI;
          ctx.fillRect(Math.round(this.x + Math.cos(a) * r), Math.round(this.y - 2 + by + Math.sin(a) * r * 0.6), 1, 1);
        }
      }
    }
  }

  HF.POWERUPS = POWERUPS;
  HF.Item = Item;
})(window.HF);
