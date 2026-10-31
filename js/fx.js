'use strict';
/*
 * Efectos visuales de alto nivel (capa de presentación). Los sistemas de juego llaman a
 * estas funciones en sus eventos; aquí no se modifica ninguna regla de gameplay.
 */
(function (HF) {
  const U = HF.U;

  const MUZZLE_STYLE = { pistol: 'small', shotgun: 'wide', rifle: 'rapid', plasma: 'energy', launcher: 'heavy', tesla: 'electric' };
  const BLOOD = {
    crimson: ['#2a0608', '#4a0c0e', '#6a1414', '#8a2a1e'],
    violet: ['#1e0a2a', '#36124a', '#4e1e6a', '#6a3a8a'],
    green: ['#122a08', '#1e4a0e', '#2e6a16', '#5aa02a'],
    ash: ['#1a0e08', '#2e1a0e', '#4a2a12', '#ff8a2a'],
    energy: ['#1a0a3a', '#2e145a', '#46207e', '#b07aff'],
    rust: ['#24090a', '#3e100e', '#5a1a12', '#8a3a24'],
    oil: ['#060608', '#0c0c10', '#16161c', '#24242c'],
    frost: ['#0e2a3a', '#1a4a6a', '#2a6a9a', '#8ad8ff'],
  };
  const FAMILY = { crawler: 'crimson', stalker: 'violet', brute: 'rust', spitter: 'green', bloater: 'ash', warlock: 'energy', herald: 'rust', matriarch: 'energy', phantom: 'frost', mortar: 'rust', swarm: 'crimson', forge: 'ash', archon: 'energy', mirage: 'energy' };

  const FX = {
    BLOOD, FAMILY, MUZZLE_STYLE,
    get P() { return HF.game.particles; },
    get level() { return HF.game.fxLevel; },

    muzzle(weaponId, x, y, angle) {
      const P = this.P;
      P.anim('muzzle_' + MUZZLE_STYLE[weaponId], x, y, { dir: HF.Assets.dirIndex(angle, 16), add: true });
      const warm = weaponId === 'plasma' ? '120,230,255' : weaponId === 'tesla' ? '190,150,255' : '255,200,120';
      P.light(x, y, weaponId === 'launcher' || weaponId === 'shotgun' ? 130 : 95, warm, 0.85, 0.06);
      if (weaponId === 'launcher') P.anim('fx_smoke', x - Math.cos(angle) * 6, y - Math.sin(angle) * 6, { vx: -Math.cos(angle) * 30, vy: -Math.sin(angle) * 30 });
    },
    casing(x, y, angle, shell) {
      const ca = angle + Math.PI / 2 + U.rand(-0.3, 0.3);
      this.P.spawn('debris', x, y, Math.cos(ca) * 110, Math.sin(ca) * 110, 0.5, shell ? 3 : 2, shell ? '#c03a22' : '#d8b04a', { drag: 6, layer: -1 });
    },
    impactWall(x, y, angle, kind) {
      const P = this.P;
      if (kind === 'plasma') { P.anim('fx_energyHit', x, y, { add: true }); P.light(x, y, 60, '90,240,255', 0.6, 0.1); return; }
      if (kind === 'enemy') { P.burst(x, y, 4, { type: 'dot', angle: angle + Math.PI, spread: 1.2, speed: [30, 120], life: [0.15, 0.3], size: [1, 2], color: ['#ffffff', '#c8c8d0'] }); return; }
      P.anim('fx_impact', x, y, { add: true });
      P.burst(x, y, 3, { type: 'spark', angle: angle + Math.PI, spread: 1, speed: [70, 200], life: [0.08, 0.2], size: [1, 1], color: ['#ffd060', '#fff0c0'], add: true });
    },
    hit(e, x, y, angle, crit, weapon) {
      const P = this.P;
      const fam = BLOOD[FAMILY[e.type] || 'crimson'];
      if (weapon === 'plasma') P.anim('fx_energyHit', x, y, { add: true });
      else P.anim(crit ? 'fx_critHit' : 'fx_hit', x, y, { add: true });
      P.burst(x, y, crit ? 6 : 3, { type: 'dot', angle: angle, spread: 0.8, speed: [60, 200], life: [0.2, 0.4], size: [1, 2], color: [fam[2], fam[3]], drag: 6 });
    },
    explosion(x, y, R, kind) {
      const P = this.P, g = HF.game;
      const energy = kind === 'energy';
      P.anim(energy ? 'fx_explosionEnergy' : 'fx_explosion', x, y);
      P.spawn('ring', x, y, 0, 0, 0.32, R, energy ? '#7ff6ff' : '#ffb050', { add: true });
      P.spawn('ring', x, y, 0, 0, 0.22, R * 0.65, '#fff4c0', { add: true });
      P.burst(x, y, 18 * this.level, { type: 'spark', speed: [140, 420], life: [0.15, 0.4], size: [1, 1], color: energy ? ['#7ff6ff', '#ff4af0'] : ['#ffd070', '#ff8a2a', '#fff2c0'], add: true, drag: 4 });
      P.burst(x, y, 8 * this.level, { type: 'debris', speed: [90, 260], life: [0.4, 0.8], size: [2, 4], color: ['#2a2a2e', '#4a3e36'], drag: 4 });
      for (let i = 0; i < 4 * this.level; i++) {
        const a = Math.random() * U.TAU, d = Math.random() * R * 0.6;
        P.anim('fx_smoke', x + Math.cos(a) * d, y + Math.sin(a) * d, { vx: Math.cos(a) * 25, vy: Math.sin(a) * 25 - 10, speed: 0.6 });
      }
      for (let i = 0; i < 6 * this.level; i++) P.spawn('dot', x + U.rand(-R * 0.4, R * 0.4), y + U.rand(-R * 0.4, R * 0.4), U.rand(-30, 30), U.rand(-60, -20), U.rand(0.5, 1.1), 1, '#ffb040', { add: true, flick: true, drag: 1 });
      P.light(x, y, R * 2.6, energy ? '120,230,255' : '255,160,60', 1, 0.35);
      if (g.quality === 'high') g.map.scorch(x, y, R);
    },
    death(e) {
      const P = this.P, g = HF.game;
      const famKey = FAMILY[e.type] || 'crimson', fam = BLOOD[famKey];
      P.burst(e.x, e.y, 10, { type: 'dot', speed: [50, 220], life: [0.3, 0.7], size: [1, 3], color: [fam[1], fam[2], fam[3]], drag: 5 });
      P.burst(e.x, e.y, 4, { type: 'debris', speed: [60, 180], life: [0.4, 0.7], size: [2, 3], color: fam[1], drag: 5 });
      if (g.quality === 'high') g.map.splat(e.x, e.y, e.r, famKey);
    },
    shockwave(x, y, R) {
      const P = this.P;
      P.spawn('ring', x, y, 0, 0, 0.45, R, '#7fdcff', { add: true });
      P.spawn('ring', x, y, 0, 0, 0.32, R * 0.66, '#ffffff', { add: true });
      P.spawn('ring', x, y, 0, 0, 0.22, R * 0.33, '#7ff6ff', { add: true });
      P.burst(x, y, 24 * this.level, { type: 'spark', speed: [200, 500], life: [0.2, 0.35], size: [1, 1], color: ['#7ff6ff', '#ffffff'], add: true, drag: 3 });
      P.light(x, y, 320, '120,200,255', 0.9, 0.3);
    },
    pickup(x, y) { this.P.anim('fx_sparkle', x, y, { add: true }); },
    levelUp(p) { this.P.anim('fx_levelup', p.x, p.y, { add: true }); },
    zap(x, y) { this.P.anim('fx_zap', x, y, { add: true }); },
    smoke(x, y, vx = 0, vy = -12) { this.P.anim('fx_smoke', x, y, { vx, vy, speed: 0.7 }); },
    steam(x, y, vx, vy) { this.P.anim('fx_steam', x, y, { vx, vy, speed: 0.55, drag: 1 }); },
    spawnBurst(x, y, elite) {
      this.P.burst(x, y, 10, { type: 'spark', speed: [50, 180], life: [0.2, 0.4], size: [1, 1], color: elite ? ['#ffcc3a', '#fff4b8'] : ['#ff4a2a', '#ffb090'], add: true });
      this.P.light(x, y, 110, elite ? '255,200,60' : '255,60,40', 0.7, 0.3);
    },
  };

  HF.FX = FX;
})(window.HF);
