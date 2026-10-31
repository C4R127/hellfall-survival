'use strict';
/*
 * Bot de equilibrado (herramienta de desarrollo, no se carga en el juego).
 * Se inyecta en la página del juego y simula partidas sin renderizar para medir
 * dificultad, economía y duración de oleadas y jefes.
 *
 *   BalanceBot.run({ sector: 's7', maxWave: 40, skill: 1 })  → métricas
 *
 * skill (0..1) controla reflejos: precisión, frecuencia de esquiva y uso del dash.
 * No modifica el guardado: durante la simulación SaveManager.save queda anulado.
 */
(function (HF) {
  const U = HF.U;
  const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft' };
  const UPGRADE_PRIORITY = ['dmg', 'rate', 'maxhp', 'crit', 'armor', 'reload', 'mag', 'pierce', 'regen', 'speed', 'reduction', 'dashcd', 'critdmg', 'multishot', 'ammo', 'magnet', 'evasion', 'explosive', 'abilitycd', 'grenadecd', 'coins', 'drops', 'stamina', 'range', 'dashcharge'];

  const Bot = {
    /** Decide las entradas del jugador para este frame. */
    think(g, skill) {
      const I = HF.Input, p = g.player, map = g.map;
      for (const k in KEYS) I.down.delete(KEYS[k]);
      I.mouse.left = false;
      if (!p || !p.alive) return;

      // ---------- amenazas ----------
      let tx = 0, ty = 0, danger = 0, closest = 1e9;
      g.enemies.forEach((e) => {
        if (!e.alive) return;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        closest = Math.min(closest, d - e.r);
        const reach = e.def.behavior === 'ranged' || e.def.behavior === 'artillery' || e.def.behavior === 'summoner' ? 200 : 260;
        if (d < reach) { const w = (reach - d) / reach * (e.def.behavior === 'explode' ? 3 : e.mass > 3 ? 2 : 1); tx += dx / d * w; ty += dy / d * w; danger += w; }
      });
      const b = g.boss;
      if (b && b.alive && !b.hidden) {
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        closest = Math.min(closest, d - b.r);
        if (d < 330) { const w = (330 - d) / 330 * 3; tx += dx / d * w; ty += dy / d * w; danger += w; }
        if (b.state === 'windup' || b.state === 'charge') { // apartarse de la línea de embestida
          const px = -Math.sin(b.chargeA), py = Math.cos(b.chargeA);
          const side = (p.x - b.x) * px + (p.y - b.y) * py >= 0 ? 1 : -1;
          tx += px * side * 4; ty += py * side * 4; danger += 4;
        }
      }
      let incoming = false;
      g.projectiles.forEach((pr) => {
        if (pr.owner !== 'enemy') return;
        const dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy);
        if (d > 160) return;
        const v = Math.hypot(pr.vx, pr.vy) || 1;
        const toward = (dx * pr.vx + dy * pr.vy) / (d * v || 1);
        if (toward < 0.5) return;
        // esquivar en perpendicular a la bala
        const px = -pr.vy / v, py = pr.vx / v;
        const side = dx * px + dy * py >= 0 ? 1 : -1;
        const w = (160 - d) / 160 * 2.2 * skill;
        tx += px * side * w; ty += py * side * w; danger += w;
        if (d < 45) incoming = true;
      });
      let inTelegraph = false;
      for (const h of g.hazards) {
        if (h.kind === 'telegraph' || h.kind === 'acid' || h.kind === 'well') {
          const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1;
          const R = h.r + 24;
          if (d < R) { const w = (h.kind === 'well' ? 3 : 2.5) * (1 - d / R + 0.3); tx += dx / d * w; ty += dy / d * w; danger += w; if (h.kind === 'telegraph' && h.delay - h.t < 0.3) inTelegraph = true; }
        } else if (h.kind === 'beam' || h.kind === 'chain') {
          const ex = Math.cos(h.a), ey = Math.sin(h.a);
          const along = (p.x - h.x) * ex + (p.y - h.y) * ey;
          if (along > 0 && along < h.len) {
            const perp = -(p.x - h.x) * ey + (p.y - h.y) * ex;
            if (Math.abs(perp) < h.w + 40) { const side = perp >= 0 ? 1 : -1; tx += -ey * side * 3.5; ty += ex * side * 3.5; danger += 3.5; if (h.delay - h.t < 0.25) inTelegraph = true; }
          }
        }
      }
      if (map.inToxic(p.x, p.y)) { const t = map.poolAt(p.x, p.y); const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1; tx += dx / d * 3; ty += dy / d * 3; danger += 3; }

      // ---------- objetivos (recoger objetos útiles cuando es seguro) ----------
      if (danger < 1.2) {
        let best = null, bd = 1e9;
        g.items.forEach((it) => {
          if (!it.canPick(p)) return;
          const want = it.type === 'health' ? (p.hp < p.maxHp * 0.7 ? 3 : 0.4) : it.type === 'log' || it.type === 'crate' || it.type === 'power' ? 2 : 1;
          const d = U.dist(p.x, p.y, it.x, it.y) / want;
          if (d < bd && d < 500) { bd = d; best = it; }
        });
        if (best) { const a = U.angleTo(p.x, p.y, best.x, best.y); tx += Math.cos(a) * 1.2; ty += Math.sin(a) * 1.2; }
        else { // volver hacia el centro de la arena (más espacio para moverse)
          const t = map.terminal, d = U.dist(p.x, p.y, t.x, t.y);
          if (d > 260) { const a = U.angleTo(p.x, p.y, t.x, t.y + 100); tx += Math.cos(a) * 0.6; ty += Math.sin(a) * 0.6; }
        }
      }

      // ---------- elegir dirección libre de muros ----------
      let mv = Math.hypot(tx, ty);
      if (mv > 0.05) {
        const want = Math.atan2(ty, tx);
        let bestA = null, bestScore = -1e9;
        for (let k = 0; k < 16; k++) {
          const a = want + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
          const fx = p.x + Math.cos(a) * 46, fy = p.y + Math.sin(a) * 46;
          if (!map.isFreeCircle(fx, fy, p.r + 2)) continue;
          const score = Math.cos(a - want) - (map.inToxic(fx, fy) ? 1.5 : 0);
          if (score > bestScore) { bestScore = score; bestA = a; }
        }
        if (bestA !== null) {
          const c = Math.cos(bestA), s = Math.sin(bestA);
          if (c > 0.38) I.down.add(KEYS.right); if (c < -0.38) I.down.add(KEYS.left);
          if (s > 0.38) I.down.add(KEYS.down); if (s < -0.38) I.down.add(KEYS.up);
          if (danger > 2.5 && p.stamina > 20) I.down.add(KEYS.sprint);
        }
      }
      // dash defensivo
      if ((incoming || inTelegraph || closest < 18) && Math.random() < 0.5 * skill && p.dash.charges > 0) I.pressedCodes.add('Space');

      // ---------- apuntar y disparar ----------
      let target = null, ts = 1e9;
      const cand = (e) => {
        if (!e.alive || e.hidden || e.invulnerable) return;
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d > 760 || !map.los(p.x, p.y, e.x, e.y)) return;
        const pri = e.isBoss ? 0.7 : e.type === 'bloater' && d < 260 ? 0.3 : e.type === 'warlock' ? 0.6 : 1;
        if (d * pri < ts) { ts = d * pri; target = e; }
      };
      g.enemies.forEach(cand);
      if (b) cand(b);
      if (target) {
        const d = U.dist(p.x, p.y, target.x, target.y);
        const lead = d / 900 * skill;
        const err = (1 - skill) * 26;
        const ax = target.x + (target.vx || 0) * lead + U.rand(-err, err), ay = target.y + (target.vy || 0) * lead + U.rand(-err, err);
        I.mouse.sx = (ax - g.view.x) * g.pixel / g.dpr;
        I.mouse.sy = (ay - g.view.y) * g.pixel / g.dpr;
        I.mouse.left = true;
        this.chooseWeapon(g, p, target, d);
        // granada contra grupos
        let near = 0;
        g.enemies.forEach((e) => { if (e.alive && U.dist(e.x, e.y, target.x, target.y) < 110) near++; });
        if (near >= 4 && d < 380 && p.grenade.t <= 0) I.mouse.rightPressed = true;
      }
      // habilidad
      let crowd = 0;
      g.enemies.forEach((e) => { if (e.alive && U.dist(e.x, e.y, p.x, p.y) < 200) crowd++; });
      const A = p.ability;
      if (A.t <= 0 && ((A.id === 'shockwave' && crowd >= 5) || (A.id === 'shield' && (p.hp < p.maxHp * 0.5 || incoming)) || ((A.id === 'overdrive' || A.id === 'berserk') && (crowd >= 6 || (b && b.alive))))) I.pressedCodes.add('KeyQ');
    },
    chooseWeapon(g, p, target, d) {
      const has = (id) => p.weapons[id] && (p.weapons[id].mag > 0 || p.weapons[id].reserve(p) > 0);
      let want = 'pistol';
      if (has('rifle')) want = 'rifle';
      if (has('plasma') && (target.isBoss || target.mass >= 2)) want = 'plasma';
      if (has('tesla') && d < 400) want = 'tesla';
      if (has('shotgun') && d < 190) want = 'shotgun';
      if (has('launcher') && d > 160) {
        let near = 0;
        g.enemies.forEach((e) => { if (e.alive && U.dist(e.x, e.y, target.x, target.y) < 110) near++; });
        if (near >= 4 || target.isBoss) want = 'launcher';
      }
      if (p.current !== want && !p.weapon.reloading) p.switchTo(want);
    },
    pickUpgrade(g) {
      const ch = HF.UI.luChoices;
      if (!ch) return;
      let best = 0, bs = 1e9;
      ch.forEach((u, i) => { const s = UPGRADE_PRIORITY.indexOf(u.id); const sc = s < 0 ? 50 : s; if (sc < bs) { bs = sc; best = i; } });
      HF.UI.luReadyAt = 0;
      HF.UI.pickLevelUp(best);
    },
    shop(g) {
      const p = g.player;
      const items = HF.UpgradeSystem.shopItems(g);
      const tryBuy = (id) => { const it = items.find((x) => x.id === id || x.id.startsWith(id)); if (it && !it.disabled && p.coins >= it.cost) g.buy(it); };
      if (p.hp < p.maxHp * 0.65) tryBuy('heal');
      if (p.armor < p.maxArmor * 0.4) tryBuy('armor');
      tryBuy('ammo');
      for (const w of ['rifle', 'plasma', 'shotgun', 'launcher', 'tesla']) { tryBuy('buy_' + w); tryBuy('up_' + w); }
      if (g.state === 'levelup') return;
      if (g.state === 'shop') g.startNextFromShop();
    },

    /** Simula una partida completa. Devuelve métricas por oleada y por jefe. */
    async run(opts = {}) {
      const g = HF.game, I = HF.Input, S = HF.SaveManager;
      const skill = opts.skill ?? 0.8, maxWave = opts.maxWave ?? 40, dt = 1 / 60;
      const save = S.save; S.save = () => {};
      const backup = JSON.stringify(S.data);
      const radioWas = S.settings.radio; S.settings.radio = false;
      const res = { waves: [], bosses: [], death: null, errors: [] };
      try {
        if (opts.meta) { S.data.unlockedWeapons = HF.WEAPON_ORDER.slice(); S.data.meta = { hp: 3, dmg: 3, armor: 2, ammo: 2, coins: 2, xp: 2, dash: 1 }; }
        if (opts.fresh) { S.data.unlockedWeapons = ['pistol', 'shotgun', 'rifle']; S.data.meta = {}; }
        g.newRun(opts.sector || 's7');
        if (g.state === 'story') HF.Story.skip();
        let cur = null, boss = null, frames = 0;
        res.sources = {};
        const pl = g.player, orig = pl.takeDamage.bind(pl);
        pl.takeDamage = (amount, o = {}) => {
          const before = pl.hp + pl.armor;
          const r = orig(amount, o);
          const lost = before - (pl.hp + pl.armor);
          if (lost > 0) { const k = (o.source || 'otro') + '@' + g.map.sector.id; res.sources[k] = Math.round((res.sources[k] || 0) + lost); }
          return r;
        };
        const p0 = () => g.player;
        let lastHp = p0().hp + p0().armor;
        const MAX_FRAMES = 60 * 60 * 60;
        const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
        while (frames++ < MAX_FRAMES) {
          if (frames % 2000 === 0) { this.status = { wave: g.waves.wave, frames }; await yieldNow(); }
          const p = g.player;
          if (g.state === 'story') HF.Story.skip();
          if (g.state === 'paused') g.resume();
          if (g.state === 'levelup' && !HF.UI.luChoices) g.state = 'playing';
          if (g.state === 'levelup') this.pickUpgrade(g);
          if (g.state === 'playing' && g.waves.state === 'intermission') {
            if (g.waves.prep) { g.openShop(); this.shop(g); } else g.waves.timer = Math.min(g.waves.timer, 1);
          }
          if (g.state === 'dying' || g.state === 'gameover') { res.death = { wave: g.waves.wave, level: p.level, time: Math.round(g.run.time), sector: g.map.sector.id }; break; }
          if (g.state !== 'playing') { if (g.state === 'shop') g.startNextFromShop(); I.endFrame(); continue; }
          // inicio de oleada
          if (g.waves.state === 'active' && (!cur || cur.n !== g.waves.wave)) {
            if (cur) res.waves.push(cur);
            cur = { n: g.waves.wave, sector: g.map.sector.id, t: 0, dmg: 0, startHp: Math.round(p.hp), coins0: p.run ? 0 : g.run.coinsEarned, kills0: g.run.kills, level: p.level, enemies: g.waves.total };
            if (cur.n > maxWave) break;
          }
          if (g.boss && g.boss.alive && !boss) boss = { type: g.boss.type, wave: g.waves.wave, t: 0, dmg: 0, maxHp: Math.round(g.boss.maxHp), phases: 1 };
          this.think(g, skill);
          try { g.update(dt); } catch (e) { if (res.errors.length < 3) res.errors.push(String(e.stack).slice(0, 300)); }
          I.endFrame();
          const hp = p.hp + p.armor;
          if (hp < lastHp && cur) cur.dmg += lastHp - hp;
          if (hp < lastHp && boss) boss.dmg += lastHp - hp;
          lastHp = hp;
          if (cur && g.waves.state === 'active') cur.t += dt;
          if (boss) {
            boss.t += dt;
            if (g.boss) boss.phases = Math.max(boss.phases, g.boss.phase);
            if (!g.boss || !g.boss.alive) { res.bosses.push({ ...boss, t: Math.round(boss.t), dmg: Math.round(boss.dmg), won: true }); boss = null; }
          }
          if (cur && g.waves.state === 'intermission' && cur.t > 0) {
            cur.coins = g.run.coinsEarned - cur.coins0; cur.kills = g.run.kills - cur.kills0;
            cur.t = Math.round(cur.t); cur.dmg = Math.round(cur.dmg); cur.endHp = Math.round(p.hp); cur.coinsHeld = p.coins;
            res.waves.push(cur); cur = null;
          }
        }
        if (cur) { cur.t = Math.round(cur.t); cur.dmg = Math.round(cur.dmg); res.waves.push(cur); }
        if (boss) res.bosses.push({ ...boss, t: Math.round(boss.t), dmg: Math.round(boss.dmg), won: false });
        res.final = { wave: g.waves.wave, level: g.player.level, coins: g.player.coins, weapons: Object.keys(g.player.weapons).join(','), score: g.run.score };
      } finally {
        S.data = JSON.parse(backup);
        S.save = save;
        S.settings.radio = radioWas;
        HF.Story.clearRadio();
        g.state = 'menu'; g.player = null; g.boss = null;
        g.enemies.clear(); g.projectiles.clear(); g.items.clear(); g.hazards.length = 0; g.spawnMarkers.length = 0;
        HF.UI.showMenu();
      }
      this.results.push(res);
      return res;
    },
    results: [],
    status: null,
    /** Lanza varias partidas seguidas (sin esperar) y deja los resultados en BalanceBot.results. */
    async batch(list) { this.done = false; for (const o of list) await this.run(o); this.done = true; },
  };
  HF.BalanceBot = Bot;
})(window.HF);
