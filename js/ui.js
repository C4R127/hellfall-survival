'use strict';
/* UIManager: HUD, menús, pantallas, indicadores, toasts y configuración. */
(function (HF) {
  const U = HF.U;
  const $ = (id) => document.getElementById(id);

  const UI = {
    game: null,
    el: {},
    cache: new Map(),
    current: 'menu',
    backTo: 'menu',
    bannerT: 0,
    miniT: 0,
    hpLag: 1,
    bossLag: 1,
    luReadyAt: 0,
    luCallback: null,
    luChoices: null,

    init(game) {
      this.game = game;
      const ids = ['hud', 'h-wave', 'h-score', 'h-combo', 'h-combo-n', 'h-combo-mult', 'h-combo-bar', 'minimap', 'h-enemies',
        'h-intermission', 'h-level', 'h-xp', 'h-hp', 'h-hp-lag', 'h-hp-t', 'h-armor', 'h-armor-t', 'h-stamina', 'h-powers',
        'h-weapon', 'h-wlvl', 'h-mag', 'h-reserve', 'h-ammotype', 'h-slots', 'h-coins', 'boss-bar', 'boss-name', 'boss-phase',
        'boss-hp', 'boss-hp-lag', 'banner', 'banner-title', 'banner-sub', 'hurt-overlay', 'lowhp-overlay', 'toasts'];
      for (const id of ids) this.el[id] = $(id);
      this.mini = this.el.minimap.getContext('2d');
      this.skills = {
        dash: $('sk-dash'), grenade: $('sk-grenade'), ability: $('sk-ability'),
      };

      // navegación
      document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
      document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => this.back()));
      document.addEventListener('click', (e) => { if (e.target.closest('.btn, .tab, .card-btn')) HF.Audio.play('ui'); }, true);
      document.addEventListener('mouseover', (e) => {
        const b = e.target.closest && e.target.closest('.btn:not([disabled])');
        if (b && b !== this._hover) { this._hover = b; HF.Audio.play('ui', { vol: 0.25 }); }
      });
      $('btn-resume').onclick = () => game.resume();
      $('btn-quit').onclick = () => this.confirm('¿Abandonar la partida? Se guardarán tus estadísticas.', () => game.quitToMenu());
      $('btn-again').onclick = () => game.newRun();
      $('btn-menu').onclick = () => game.quitToMenu();
      $('btn-shop-close').onclick = () => game.closeShop();
      $('btn-shop-next').onclick = () => game.startNextFromShop();
      $('btn-reset').onclick = () => this.confirm('¿Borrar todo el progreso (récords, núcleos, armas, mejoras y logros)?', () => {
        HF.SaveManager.reset();
        this.renderMeta();
        this.toast('Progreso reiniciado', 'info');
      });
      $('confirm-no').onclick = () => $('confirm').classList.add('hidden');

      this.initSettings();

      // atajos 1/2/3 en la subida de nivel
      addEventListener('keydown', (e) => {
        if (game.state !== 'levelup' || !this.luChoices) return;
        const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (i >= 0 && this.luChoices[i]) this.pickLevelUp(i);
      });

      this.renderControlsHint();
    },

    setText(el, v) {
      if (this.cache.get(el) === v) return;
      this.cache.set(el, v);
      el.textContent = v;
    },
    setWidth(el, f) {
      const v = (U.clamp(f, 0, 1) * 100).toFixed(1) + '%';
      if (this.cache.get(el) === v) return;
      this.cache.set(el, v);
      el.style.width = v;
    },

    /* ---------------- pantallas ---------------- */
    hideScreens() {
      document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    },
    showScreen(name) {
      this.hideScreens();
      const s = $('screen-' + name);
      s.classList.remove('hidden');
      s.classList.remove('enter');
      void s.offsetWidth;
      s.classList.add('enter');
      this.current = name;
    },
    go(name) {
      HF.Audio.init();
      const g = this.game;
      if (name === 'play') { g.newRun(); return; }
      if (name === 'exit') { this.showScreen('exit'); this.backTo = 'menu'; return; }
      this.backTo = this.current === 'pause' ? 'pause' : 'menu';
      if (name === 'weapons') this.renderWeapons();
      if (name === 'upgrades') this.renderMeta();
      if (name === 'stats') this.renderStats();
      if (name === 'settings') this.syncSettings();
      this.showScreen(name);
    },
    back() {
      HF.Audio.play('uiBack');
      if (this.backTo === 'pause' && this.game.state === 'paused') this.showPause();
      else this.showMenu();
    },
    subScreenOpen() { return this.current !== 'pause'; },

    showMenu() {
      this.el.hud.classList.add('hidden');
      document.body.classList.remove('in-game');
      const d = HF.SaveManager.data;
      $('m-best-wave').textContent = d.best.wave;
      $('m-best-score').textContent = U.fmtNum(d.best.score);
      $('m-cores').textContent = d.cores;
      this.showScreen('menu');
      this.renderControlsHint();
    },
    startRun() {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      this.hideScreens();
      this.current = 'game';
      this.el.hud.classList.remove('hidden');
      document.body.classList.add('in-game');
      this.cache.clear();
      this.hpLag = 1;
      this.hideBoss();
      this.el.toasts.innerHTML = '';
      this.renderSlots();
      this.updateKeyLabels();
    },
    hideOverlays() {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      this.hideScreens();
      this.current = 'game';
      $('confirm').classList.add('hidden');
    },
    showPause() {
      const g = this.game;
      $('pause-info').innerHTML = `
        <div><span>OLEADA</span><b>${g.waves.wave}</b></div>
        <div><span>TIEMPO</span><b>${U.fmtTime(g.run.time)}</b></div>
        <div><span>PUNTUACIÓN</span><b>${U.fmtNum(g.run.score)}</b></div>
        <div><span>ENEMIGOS</span><b>${g.run.kills}</b></div>`;
      this.showScreen('pause');
    },
    confirm(text, onYes) {
      $('confirm-text').textContent = text;
      $('confirm').classList.remove('hidden');
      $('confirm-yes').onclick = () => { $('confirm').classList.add('hidden'); onYes(); };
    },

    /* ---------------- subida de nivel ---------------- */
    showLevelUp(choices, cb) {
      const p = this.game.player;
      this.luChoices = choices;
      this.luCallback = cb;
      this.luReadyAt = performance.now() + 350;
      const pend = this.game.pendingLevelUps;
      $('lu-title').textContent = this.game.levelUpReturn === 'shop' ? 'MÓDULO DE MEJORA'
        : pend > 1 ? `¡NIVEL ${p.level}! (${pend} mejoras)` : `¡NIVEL ${p.level}!`;
      const wrap = $('lu-cards');
      wrap.innerHTML = '';
      choices.forEach((u, i) => {
        const lvl = p.upgrades[u.id] || 0;
        const card = document.createElement('button');
        card.className = `lu-card rarity-${u.rarity} cat-${u.cat.toLowerCase()}`;
        card.innerHTML = `
          <div class="lu-key">${i + 1}</div>
          <div class="lu-cat">${u.cat.toUpperCase()} · ${HF.UpgradeSystem.RARITY[u.rarity].name.toUpperCase()}</div>
          <div class="lu-name">${u.name}</div>
          <div class="lu-desc">${u.desc}</div>
          <div class="lu-lvl">${u.max < 99 ? `NIVEL ${lvl} → ${lvl + 1} / ${u.max}` : ''}</div>`;
        card.style.animationDelay = i * 70 + 'ms';
        card.onclick = () => this.pickLevelUp(i);
        wrap.appendChild(card);
      });
      this.showScreen('levelup');
    },
    pickLevelUp(i) {
      if (performance.now() < this.luReadyAt || !this.luCallback) return;
      const cb = this.luCallback, u = this.luChoices[i];
      this.luCallback = null;
      this.luChoices = null;
      cb(u);
      this.renderSlots();
      this.updateKeyLabels();
    },

    /* ---------------- tienda ---------------- */
    showShop() {
      const g = this.game, p = g.player;
      $('shop-coins').textContent = p.coins;
      $('shop-status').innerHTML = `
        <span>VIDA <b>${Math.ceil(p.hp)}/${p.maxHp}</b></span>
        <span>ARMADURA <b>${Math.ceil(p.armor)}/${p.maxArmor}</b></span>
        <span>NIVEL <b>${p.level}</b></span>
        <span>PRÓXIMA OLEADA <b>${g.waves.wave + 1}${(g.waves.wave + 1) % 10 === 0 ? ' · JEFE' : ''}</b></span>`;
      const grid = $('shop-items');
      grid.innerHTML = '';
      for (const it of HF.UpgradeSystem.shopItems(g)) {
        const b = document.createElement('button');
        const afford = p.coins >= it.cost;
        b.className = 'shop-item' + (it.weapon ? ' weapon' : '');
        b.disabled = it.disabled || !afford;
        b.innerHTML = `<div class="si-name">${it.name}</div><div class="si-desc">${it.disabled ? 'Ya está al máximo.' : it.desc}</div>
          <div class="si-cost ${afford ? '' : 'no'}"><span class="coin-ico"></span>${it.cost}</div>`;
        b.onclick = () => { if (g.buy(it) && g.state === 'shop') this.showShop(); };
        grid.appendChild(b);
      }
      const ab = $('shop-abilities');
      ab.innerHTML = '';
      for (const id in HF.ABILITIES) {
        const a = HF.ABILITIES[id];
        const eq = p.ability.id === id;
        const b = document.createElement('button');
        b.className = 'ability-card' + (eq ? ' equipped' : '');
        b.disabled = eq || p.coins < 30;
        b.innerHTML = `<div class="ab-icon" style="color:${a.color}">${a.icon}</div><div class="ab-name">${a.name}</div>
          <div class="ab-desc">${a.desc}</div><div class="ab-cd">Recarga ${a.cd}s</div><div class="ab-tag">${eq ? 'EQUIPADA' : 'EQUIPAR · 30'}</div>`;
        b.onclick = () => { if (g.equipAbility(id, 30)) this.showShop(); };
        ab.appendChild(b);
      }
      this.renderSlots();
      this.showScreen('shop');
    },

    /* ---------------- game over ---------------- */
    showGameOver(d) {
      this.el.hud.classList.add('hidden');
      $('go-stats').innerHTML = `
        <div><span>OLEADA</span><b>${d.wave}</b></div>
        <div><span>ENEMIGOS</span><b>${d.kills}</b></div>
        <div><span>PUNTUACIÓN</span><b>${U.fmtNum(d.score)}</b></div>
        <div><span>TIEMPO</span><b>${U.fmtTime(d.time)}</b></div>
        <div><span>NIVEL</span><b>${d.level}</b></div>
        <div><span>MEJOR COMBO</span><b>x${d.bestCombo}</b></div>`;
      $('go-records').innerHTML = `
        <div class="${d.newWave ? 'new' : ''}"><span>MEJOR OLEADA</span><b>${d.bestWave}</b>${d.newWave ? '<i>¡NUEVO RÉCORD!</i>' : ''}</div>
        <div class="${d.newScore ? 'new' : ''}"><span>MEJOR PUNTUACIÓN</span><b>${U.fmtNum(d.bestScore)}</b>${d.newScore ? '<i>¡NUEVO RÉCORD!</i>' : ''}</div>`;
      $('go-cores').innerHTML = `+${d.cores} NÚCLEOS <small>(total ${HF.SaveManager.data.cores})</small>`;
      this.showScreen('gameover');
    },

    /* ---------------- jefe / banners / toasts ---------------- */
    showBoss(b) {
      this.el['boss-bar'].classList.remove('hidden');
      this.el['boss-name'].textContent = b.name;
      this.bossLag = 1;
    },
    hideBoss() { this.el['boss-bar'].classList.add('hidden'); },
    banner(title, sub, dur = 2) {
      this.el['banner-title'].textContent = title;
      this.el['banner-sub'].textContent = sub || '';
      const b = this.el.banner;
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
      this.bannerT = dur;
    },
    toast(msg, type = 'info') {
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.textContent = msg;
      const box = this.el.toasts;
      box.appendChild(t);
      while (box.children.length > 5) box.firstChild.remove();
      setTimeout(() => t.classList.add('out'), 2600);
      setTimeout(() => t.remove(), 3100);
    },
    hurt(k) {
      const o = this.el['hurt-overlay'];
      o.style.transition = 'none';
      o.style.opacity = String(0.55 * k);
      void o.offsetWidth;
      o.style.transition = 'opacity 0.45s ease-out';
      o.style.opacity = '0';
    },
    flashWeapon() {
      const w = this.el['h-weapon'];
      w.classList.remove('flash');
      void w.offsetWidth;
      w.classList.add('flash');
      this.renderSlots();
    },

    /* ---------------- HUD ---------------- */
    renderSlots() {
      const p = this.game.player;
      if (!p) return;
      const box = this.el['h-slots'];
      box.innerHTML = '';
      HF.WEAPON_ORDER.forEach((id, i) => {
        const s = document.createElement('div');
        const owned = !!p.weapons[id];
        s.className = 'slot' + (owned ? ' owned' : '') + (p.current === id ? ' current' : '');
        s.innerHTML = `<b>${i + 1}</b><span>${owned ? HF.WEAPONS[id].short.slice(0, 4) : '—'}</span>`;
        box.appendChild(s);
      });
      this.slotCurrent = p.current;
    },
    updateKeyLabels() {
      document.querySelectorAll('.skill .key[data-action]').forEach((k) => {
        k.textContent = HF.Input.codeLabel(HF.Input.bindings[k.dataset.action][0]);
      });
    },

    update(dt) {
      const g = this.game;
      if (this.bannerT > 0) {
        this.bannerT -= dt;
        if (this.bannerT <= 0) this.el.banner.classList.remove('show');
      }
      if (!g.player || this.el.hud.classList.contains('hidden')) return;
      const p = g.player, w = p.weapon, E = this.el, W = g.waves;

      this.setText(E['h-wave'], String(W.wave).padStart(2, '0'));
      this.setText(E['h-score'], U.fmtNum(g.run.score));

      // combo
      const comboOn = g.combo >= 2;
      E['h-combo'].classList.toggle('active', comboOn);
      if (comboOn) {
        this.setText(E['h-combo-n'], 'x' + g.combo);
        this.setText(E['h-combo-mult'], 'PUNTOS x' + g.comboMult.toFixed(1));
        this.setWidth(E['h-combo-bar'], g.comboT / 3.2);
        E['h-combo'].classList.toggle('hot', g.combo >= 15);
      }

      // oleada / enemigos
      this.setText(E['h-enemies'], W.state === 'active' ? String(W.remaining) : '—');
      const inter = E['h-intermission'];
      if (W.state === 'intermission' && g.state !== 'dying') {
        inter.classList.remove('hidden');
        const ready = HF.Input.codeLabel(HF.Input.bindings.ready[0]);
        const use = HF.Input.codeLabel(HF.Input.bindings.interact[0]);
        const txt = W.prep
          ? `ZONA SEGURA · Ve a la terminal [${use}] · [${ready}] iniciar oleada ${W.wave + 1}`
          : `OLEADA ${W.wave + 1} EN ${Math.ceil(Math.max(0, W.timer))} s · [${ready}] adelantar`;
        this.setText(inter, txt);
        inter.classList.toggle('prep', W.prep);
      } else inter.classList.add('hidden');

      // vida / armadura / stamina / xp
      const hpF = p.hp / p.maxHp;
      this.hpLag = Math.max(hpF, U.damp(this.hpLag, hpF, 2.5, dt));
      this.setWidth(E['h-hp'], hpF);
      this.setWidth(E['h-hp-lag'], this.hpLag);
      this.setText(E['h-hp-t'], `${Math.ceil(p.hp)}/${p.maxHp}`);
      this.setWidth(E['h-armor'], p.armor / p.maxArmor);
      this.setText(E['h-armor-t'], `${Math.ceil(p.armor)}/${p.maxArmor}`);
      this.setWidth(E['h-stamina'], p.stamina / p.maxStamina);
      E['h-stamina'].parentElement.classList.toggle('exhausted', p.exhausted);
      this.setText(E['h-level'], String(p.level));
      this.setWidth(E['h-xp'], p.xp / p.xpNext);
      const low = hpF < 0.3 && p.alive;
      E['lowhp-overlay'].style.opacity = low ? String(0.35 + Math.sin(g.time * 6) * 0.15) : '0';

      // power-ups activos
      const pw = [];
      for (const k in p.power) if (p.power[k] > 0) pw.push(`<span style="color:${HF.POWERUPS[k].color}">${HF.POWERUPS[k].name} ${Math.ceil(p.power[k])}s</span>`);
      if (p.ability.active > 0) pw.push(`<span style="color:${p.abilityDef.color}">${p.abilityDef.name.toUpperCase()} ${Math.ceil(p.ability.active)}s</span>`);
      if (p.exhausted) pw.push('<span style="color:#ff8a5a">AGOTADO</span>');
      this.setHTML(E['h-powers'], pw.join(''));

      // habilidades
      const D = p.dash;
      this.setSkill(this.skills.dash, D.charges > 0 ? 0 : 1 - D.t / D.cd, D.max > 1 ? String(D.charges) : '');
      this.setSkill(this.skills.grenade, Math.max(0, p.grenade.t / p.grenade.cd), '');
      const A = p.ability, ad = p.abilityDef;
      this.setSkill(this.skills.ability, A.active > 0 ? 0 : Math.max(0, A.t / p.abilityCd), '', A.active > 0);
      this.setText(this.skills.ability.querySelector('.name'), ad.name.toUpperCase());
      this.setText(this.skills.ability.querySelector('.icon'), ad.icon);

      // arma
      if (this.slotCurrent !== p.current) this.renderSlots();
      this.setText(E['h-weapon'], w.def.short);
      this.setText(E['h-wlvl'], 'NV ' + w.level);
      const ms = w.magSize(p);
      this.setText(E['h-mag'], p.overdriveActive ? '∞' : String(w.mag));
      E['h-mag'].classList.toggle('low', !p.overdriveActive && w.mag <= Math.ceil(ms * 0.25));
      const res = w.reserve(p);
      this.setText(E['h-reserve'], res === Infinity ? '∞' : String(res));
      const at = w.def.ammoType;
      this.setText(E['h-ammotype'], w.reloading ? 'RECARGANDO…' : at ? HF.AMMO_TYPES[at].name.toUpperCase() : 'MUNICIÓN INFINITA');
      E['h-ammotype'].style.color = w.reloading ? '#ffd03a' : at ? HF.AMMO_TYPES[at].color : '#9aa4b2';
      this.setText(E['h-coins'], U.fmtNum(p.coins));

      // jefe
      const b = g.boss;
      if (b && b.alive) {
        const f = b.hp / b.maxHp;
        this.bossLag = Math.max(f, U.damp(this.bossLag, f, 2, dt));
        this.setWidth(E['boss-hp'], f);
        this.setWidth(E['boss-hp-lag'], this.bossLag);
        this.setText(E['boss-phase'], b.phase === 4 ? 'FASE FINAL' : 'FASE ' + b.phase);
      }

      this.miniT -= dt;
      if (this.miniT <= 0) { this.miniT = 0.08; this.drawMinimap(); }
    },
    setHTML(el, html) {
      if (this.cache.get(el) === html) return;
      this.cache.set(el, html);
      el.innerHTML = html;
    },
    setSkill(el, cdFrac, charges, active) {
      const cd = el.querySelector('.cd');
      const v = (U.clamp(cdFrac, 0, 1) * 100).toFixed(0) + '%';
      if (this.cache.get(cd) !== v) { this.cache.set(cd, v); cd.style.height = v; }
      el.classList.toggle('ready', cdFrac <= 0);
      el.classList.toggle('active', !!active);
      const c = el.querySelector('.charges');
      if (c) this.setText(c, charges);
    },

    drawMinimap() {
      const g = this.game, m = g.map, ctx = this.mini;
      const cw = this.el.minimap.width, ch = this.el.minimap.height;
      const k = cw / m.pw;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cw, ch);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(m.mini, 0, 0, cw, ch);
      ctx.globalAlpha = 1;
      // zonas tóxicas
      ctx.fillStyle = 'rgba(120,255,60,0.35)';
      for (const t of m.toxic) { ctx.beginPath(); ctx.arc(t.x * k, t.y * k, t.r * k, 0, U.TAU); ctx.fill(); }
      // terminal en preparación
      if (g.waves && g.waves.state === 'intermission' && g.waves.prep && Math.floor(g.time * 3) % 2) {
        ctx.strokeStyle = '#3affaa'; ctx.lineWidth = 2;
        ctx.strokeRect(m.terminal.x * k - 6, m.terminal.y * k - 6, 12, 12);
      }
      ctx.fillStyle = '#ffd040';
      g.items.forEach((it) => { if (it.type !== 'coin') ctx.fillRect(it.x * k - 1, it.y * k - 1, 2, 2); });
      ctx.fillStyle = '#ff5a2a';
      for (const s of g.spawnMarkers) ctx.fillRect(s.x * k - 1, s.y * k - 1, 3, 3);
      g.enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = e.elite ? '#ffbe28' : '#ff3030';
        const s = e.r > 18 ? 4 : 3;
        ctx.fillRect(e.x * k - s / 2, e.y * k - s / 2, s, s);
      });
      if (g.boss && g.boss.alive) {
        ctx.fillStyle = '#ff2a6a';
        ctx.beginPath(); ctx.arc(g.boss.x * k, g.boss.y * k, 5, 0, U.TAU); ctx.fill();
      }
      const v = g.view;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(v.x * k, v.y * k, v.w * k, v.h * k);
      const p = g.player;
      ctx.save();
      ctx.translate(p.x * k, p.y * k);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#7ff6ff';
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-3, 3.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    },

    /* ---------------- menús de progreso ---------------- */
    spriteCanvas(name, scale = 2) {
      const s = HF.Sprites.get(name);
      const c = U.makeCanvas(s.w * scale, s.h * scale);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(s.img, 0, 0, c.width, c.height);
      c.className = 'pix';
      return c;
    },
    renderWeapons() {
      const d = HF.SaveManager.data;
      document.querySelectorAll('.cores-val').forEach((e) => (e.textContent = d.cores));
      const grid = $('weapons-grid');
      grid.innerHTML = '';
      const bar = (label, f, txt) => `<div class="wstat"><span>${label}</span><div class="mbar"><i style="width:${U.clamp(f, 0.04, 1) * 100}%"></i></div><b>${txt}</b></div>`;
      for (const id of HF.WEAPON_ORDER) {
        const w = HF.WEAPONS[id];
        const unlocked = d.unlockedWeapons.includes(id);
        const card = document.createElement('div');
        card.className = 'wcard' + (unlocked ? '' : ' locked');
        const dps = w.dmg * w.pellets * w.rate;
        const precision = w.type === 'chain' ? 'Automática' : w.spread < 0.04 ? 'Muy alta' : w.spread < 0.08 ? 'Alta' : 'Baja';
        const rangeTxt = w.range >= 850 ? 'Alto' : w.range >= 600 ? 'Medio' : 'Corto';
        card.innerHTML = `
          <div class="wc-head"><span class="wc-slot">${w.slot}</span><div><div class="wc-name">${w.name}</div>
          <div class="wc-ammo" style="color:${w.ammoType ? HF.AMMO_TYPES[w.ammoType].color : '#9aa4b2'}">${w.ammoType ? HF.AMMO_TYPES[w.ammoType].name : 'Munición infinita'}</div></div></div>
          <div class="wc-art"></div>
          <p class="wc-desc">${w.desc}</p>
          ${bar('Daño', (w.dmg * w.pellets) / 100, w.pellets > 1 ? `${w.dmg}×${w.pellets}` : w.dmg + (w.explode ? ' (área)' : ''))}
          ${bar('Cadencia', w.rate / 9, w.rate + '/s')}
          ${bar('DPS', dps / 200, Math.round(dps))}
          ${bar('Cargador', w.mag / 60, w.mag)}
          ${bar('Recarga', 1 - w.reload / 3, w.reload + ' s')}
          <div class="wc-extra"><span>Munición máx.: <b>${w.maxAmmo === Infinity ? '∞' : w.maxAmmo}</b></span><span>Alcance: <b>${rangeTxt}</b></span><span>Precisión: <b>${precision}</b></span><span>Crítico: <b>${Math.round(w.crit * 100)}%</b></span></div>
          <div class="wc-foot"></div>`;
        card.querySelector('.wc-art').appendChild(this.spriteCanvas('w_' + id, 4));
        const foot = card.querySelector('.wc-foot');
        if (unlocked) foot.innerHTML = '<span class="ok">DESBLOQUEADA</span>';
        else {
          const b = document.createElement('button');
          b.className = 'btn small primary card-btn';
          b.textContent = `DESBLOQUEAR · ${w.cost} NÚCLEOS`;
          b.disabled = d.cores < w.cost;
          b.onclick = () => {
            if (d.cores < w.cost) return;
            d.cores -= w.cost;
            d.unlockedWeapons.push(id);
            HF.SaveManager.save();
            HF.Audio.play('buy');
            this.toast(w.name + ' desbloqueada', 'weapon');
            this.renderWeapons();
          };
          foot.appendChild(b);
        }
        grid.appendChild(card);
      }
    },
    renderMeta() {
      const d = HF.SaveManager.data;
      document.querySelectorAll('.cores-val').forEach((e) => (e.textContent = d.cores));
      const list = $('meta-list');
      list.innerHTML = '';
      for (const m of HF.UpgradeSystem.META) {
        const lvl = d.meta[m.id] || 0;
        const row = document.createElement('div');
        row.className = 'meta-row';
        const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        const cost = HF.UpgradeSystem.metaCost(m, lvl);
        row.innerHTML = `<div class="mr-info"><div class="mr-name">${m.name}</div><div class="mr-desc">${m.desc}</div></div>
          <div class="pips">${pips}</div><div class="mr-btn"></div>`;
        const b = document.createElement('button');
        b.className = 'btn small card-btn' + (lvl < m.max ? ' primary' : '');
        if (lvl >= m.max) { b.textContent = 'MÁXIMO'; b.disabled = true; }
        else {
          b.textContent = `MEJORAR · ${cost}`;
          b.disabled = d.cores < cost;
          b.onclick = () => {
            if (d.cores < cost) return;
            d.cores -= cost;
            d.meta[m.id] = lvl + 1;
            HF.SaveManager.save();
            HF.Audio.play('buy');
            this.renderMeta();
          };
        }
        row.querySelector('.mr-btn').appendChild(b);
        list.appendChild(row);
      }
    },
    renderStats() {
      const d = HF.SaveManager.data, s = d.stats;
      const rows = [
        ['Partidas jugadas', s.games], ['Enemigos eliminados', U.fmtNum(s.kills)], ['Tiempo total', U.fmtTime(s.time)],
        ['Mejor oleada', d.best.wave], ['Mejor puntuación', U.fmtNum(d.best.score)], ['Mejor combo', 'x' + s.bestCombo],
        ['Supervivencia más larga', U.fmtTime(d.best.time)], ['Nivel más alto', d.best.level], ['Jefes derrotados', s.bosses],
        ['Disparos realizados', U.fmtNum(s.shots)], ['Daño infligido', U.fmtNum(s.damageDealt)], ['Monedas recogidas', U.fmtNum(s.coinsEarned)],
        ['Núcleos obtenidos', U.fmtNum(s.coresEarned)], ['Núcleos disponibles', d.cores],
      ];
      $('stats-grid').innerHTML = rows.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('');
      const best = $('bestiary');
      best.innerHTML = '';
      for (const id in HF.ENEMIES) {
        const e = HF.ENEMIES[id];
        const row = document.createElement('div');
        row.className = 'beast';
        row.innerHTML = `<div class="b-art"></div><div class="b-info"><div class="b-name">${e.name} <small>${e.role}</small></div>
          <div class="b-desc">${e.desc}</div></div><div class="b-kills">${U.fmtNum(s.killsByType[id] || 0)}</div>`;
        row.querySelector('.b-art').appendChild(this.spriteCanvas(id, 1));
        best.appendChild(row);
      }
      const ach = HF.UpgradeSystem.ACHIEVEMENTS;
      const got = ach.filter((a) => d.achievements[a.id]).length;
      $('ach-count').textContent = `${got}/${ach.length}`;
      $('achievements').innerHTML = ach.map((a) => `<div class="ach ${d.achievements[a.id] ? 'got' : ''}">
        <div class="ach-ico">${d.achievements[a.id] ? '★' : '☆'}</div><div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div></div>`).join('');
    },

    /* ---------------- configuración ---------------- */
    initSettings() {
      const S = HF.SaveManager;
      document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
        document.querySelectorAll('.tab-body').forEach((b) => b.classList.toggle('hidden', b.dataset.body !== t.dataset.tab));
      }));
      document.querySelectorAll('[data-set]').forEach((inp) => {
        const key = inp.dataset.set;
        const handler = () => {
          const s = S.settings;
          if (inp.type === 'checkbox') s[key] = inp.checked;
          else if (inp.type === 'range') s[key] = parseFloat(inp.value);
          else s[key] = inp.value;
          this.updateOutput(inp);
          S.save();
          this.game.applySettings(s);
        };
        inp.addEventListener('input', handler);
        inp.addEventListener('change', handler);
      });
      const fs = $('set-fullscreen');
      fs.addEventListener('change', () => {
        if (fs.checked && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => { fs.checked = false; });
        else if (!fs.checked && document.fullscreenElement) document.exitFullscreen?.();
      });
      document.addEventListener('fullscreenchange', () => { fs.checked = !!document.fullscreenElement; });
      $('btn-reset-keys').onclick = () => {
        S.settings.bindings = null;
        S.save();
        this.game.applySettings(S.settings);
        this.renderBindings();
        this.renderControlsHint();
      };
    },
    updateOutput(inp) {
      const o = inp.parentElement.querySelector('output');
      if (o) o.textContent = inp.dataset.set === 'sensitivity' ? Number(inp.value).toFixed(2) + 'x' : Math.round(inp.value * 100) + '%';
    },
    syncSettings() {
      const s = HF.SaveManager.settings;
      document.querySelectorAll('[data-set]').forEach((inp) => {
        const v = s[inp.dataset.set];
        if (inp.type === 'checkbox') inp.checked = !!v;
        else inp.value = v;
        this.updateOutput(inp);
      });
      $('set-fullscreen').checked = !!document.fullscreenElement;
      this.renderBindings();
    },
    renderBindings() {
      const I = HF.Input, box = $('bindings');
      box.innerHTML = '';
      for (const action in I.ACTION_LABELS) {
        const row = document.createElement('div');
        row.className = 'bind-row';
        row.innerHTML = `<span>${I.ACTION_LABELS[action]}</span>`;
        for (let i = 0; i < 2; i++) {
          const b = document.createElement('button');
          b.className = 'key-btn';
          b.textContent = I.codeLabel(I.bindings[action][i]);
          b.onclick = () => {
            b.textContent = 'Pulsa una tecla…';
            b.classList.add('listening');
            I.onRebind = (code) => {
              if (code) {
                for (const a in I.bindings) I.bindings[a] = I.bindings[a].filter((c) => c !== code);
                const arr = I.bindings[action];
                arr[i] = code;
                I.bindings[action] = arr.filter(Boolean);
                HF.SaveManager.settings.bindings = JSON.parse(JSON.stringify(I.bindings));
                HF.SaveManager.save();
              }
              this.renderBindings();
              this.renderControlsHint();
              this.updateKeyLabels();
            };
          };
          row.appendChild(b);
        }
        box.appendChild(row);
      }
    },
    renderControlsHint() {
      const k = (a) => HF.Input.codeLabel(HF.Input.bindings[a][0]);
      const el = $('controls-hint');
      if (!el) return;
      el.innerHTML = [
        [`${k('up')}${k('left')}${k('down')}${k('right')}`, 'Mover'], [k('sprint'), 'Correr'], ['Ratón', 'Apuntar'], ['Clic izq.', 'Disparar'],
        ['Clic der.', 'Granada'], [k('dash'), 'Dash'], [k('ability'), 'Habilidad'], [k('reload'), 'Recargar'],
        ['1-6 / Rueda', 'Armas'], [k('interact'), 'Interactuar'], [k('pause'), 'Pausa'],
      ].map(([a, b]) => `<span><kbd>${a}</kbd>${b}</span>`).join('');
    },
  };

  HF.UI = UI;
})(window.HF);
