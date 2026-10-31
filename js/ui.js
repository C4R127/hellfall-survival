'use strict';
/* UIManager: HUD, menús, pantallas, iconos, indicadores, toasts y configuración. */
(function (HF) {
  const U = HF.U;
  const $ = (id) => document.getElementById(id);
  const ICON = (id) => HF.Assets.url('icon_' + id) || `assets/ui/icons/${id}.png`;
  const WART = (id) => HF.Assets.url('weapon_' + id) || `assets/ui/weapons/${id}.png`;
  const img = (src, cls = '') => `<img src="${src}" alt="" class="${cls}">`;

  const AMMO_ICON = { light: 'ammo_light', shells: 'ammo_shells', heavy: 'ammo_heavy', energy: 'ammo_energy', special: 'ammo_special' };
  const META_ICON = { hp: 'up_maxhp', dmg: 'up_dmg', armor: 'up_armor', ammo: 'up_ammo', coins: 'up_coins', xp: 'level', dash: 'up_dashcd' };
  const TOAST_ICON = { achievement: 'trophy', weapon: 'arsenal', power: 'combo', ability: 'shockwave', info: 'danger' };
  const POWER_ICON = { quad: 'up_dmg', rapid: 'overdrive', invul: 'shield' };
  const upgradeIcon = (u) => (u.id.startsWith('ab_') ? u.id.slice(3) : 'up_' + u.id);

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
        'h-intermission', 'h-level', 'h-xp', 'h-hp', 'h-hp-lag', 'h-hp-t', 'h-armor', 'h-armor-t', 'h-stamina', 'h-stamina-bar', 'h-powers',
        'h-weapon', 'h-weapon-art', 'h-wlvl', 'h-mag', 'h-reserve', 'h-ammotype', 'h-ammo-ico', 'h-slots', 'h-coins', 'boss-bar', 'boss-name', 'boss-phase',
        'boss-hp', 'boss-hp-lag', 'banner', 'banner-title', 'banner-sub', 'toasts'];
      for (const id of ids) this.el[id] = $(id);
      this.mini = this.el.minimap.getContext('2d');
      this.skills = { dash: $('sk-dash'), grenade: $('sk-grenade'), ability: $('sk-ability') };

      document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
      document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => this.back()));
      document.addEventListener('click', (e) => { if (e.target.closest('.btn, .tab, .shop-item, .ability-card, .lu-card')) HF.Audio.play('ui'); }, true);
      document.addEventListener('mouseover', (e) => {
        const b = e.target.closest && e.target.closest('.btn:not([disabled])');
        if (b && b !== this._hover) { this._hover = b; HF.Audio.play('ui', { vol: 0.25 }); }
      });
      $('btn-resume').onclick = () => game.resume();
      $('btn-restart').onclick = () => this.confirm('¿Reiniciar la partida? Se guardarán las estadísticas de la actual.', () => { game.recordRun(false); game.newRun(); });
      $('btn-quit').onclick = () => this.confirm('¿Volver al menú principal? Se guardarán tus estadísticas.', () => game.quitToMenu());
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
      addEventListener('keydown', (e) => {
        if (game.state !== 'levelup' || !this.luChoices) return;
        const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (i >= 0 && this.luChoices[i]) this.pickLevelUp(i);
      });
      this.renderControlsHint();
    },

    setText(el, v) { if (this.cache.get(el) === v) return; this.cache.set(el, v); el.textContent = v; },
    setHTML(el, v) { if (this.cache.get(el) === v) return; this.cache.set(el, v); el.innerHTML = v; },
    setAttr(el, k, v) { const key = el.id + ':' + k; if (this.cache.get(key) === v) return; this.cache.set(key, v); el.setAttribute(k, v); },
    setWidth(el, f) {
      const v = (U.clamp(f, 0, 1) * 100).toFixed(1) + '%';
      if (this.cache.get(el) === v) return;
      this.cache.set(el, v);
      el.style.width = v;
    },

    /* ---------------- pantallas ---------------- */
    hideScreens() { document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden')); },
    showScreen(name) {
      this.hideScreens();
      const s = $('screen-' + name);
      s.classList.remove('hidden', 'enter');
      void s.offsetWidth;
      s.classList.add('enter');
      this.current = name;
    },
    go(name) {
      HF.Audio.init();
      const g = this.game;
      if (name === 'play') { this.backTo = 'menu'; this.renderSectors(); this.showScreen('sectors'); return; }
      if (name === 'exit') { this.backTo = 'menu'; this.showScreen('exit'); return; }
      this.backTo = this.current === 'pause' ? 'pause' : 'menu';
      if (name === 'weapons') this.renderWeapons();
      if (name === 'upgrades') this.renderMeta();
      if (name === 'stats') this.renderStats();
      if (name === 'archive') this.renderArchive();
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
    infoCell(icon, label, value, extra = '') { return `<div class="${extra}">${img(ICON(icon))}<div><span>${label}</span><b>${value}</b></div></div>`; },
    showPause() {
      const g = this.game;
      $('pause-info').innerHTML =
        this.infoCell('wave', 'OLEADA', g.waves.wave) + this.infoCell('clock', 'TIEMPO', U.fmtTime(g.run.time)) +
        this.infoCell('score', 'PUNTUACIÓN', U.fmtNum(g.run.score)) + this.infoCell('kills', 'ENEMIGOS', g.run.kills);
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
        card.className = `lu-card rarity-${u.rarity}`;
        const pips = u.max < 99 ? Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : k === lvl ? 'next' : ''}"></i>`).join('') : '';
        card.innerHTML = `
          <div class="lu-key">${i + 1}</div>
          ${img(ICON(upgradeIcon(u)), 'lu-icon')}
          <div class="lu-cat">${u.cat.toUpperCase()} · ${HF.UpgradeSystem.RARITY[u.rarity].name.toUpperCase()}</div>
          <div class="lu-name">${u.name}</div>
          <div class="lu-desc">${u.desc}</div>
          <div class="lu-lvl">${pips}</div>`;
        card.style.animationDelay = i * 60 + 'ms';
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
        <span>${img(ICON('hp'))}VIDA <b>${Math.ceil(p.hp)}/${p.maxHp}</b></span>
        <span>${img(ICON('armor'))}ARMADURA <b>${Math.ceil(p.armor)}/${p.maxArmor}</b></span>
        <span>${img(ICON('level'))}NIVEL <b>${p.level}</b></span>
        <span>${img(ICON((g.waves.wave + 1) % 10 === 0 ? 'boss' : 'wave'))}PRÓXIMA OLEADA <b>${g.waves.wave + 1}${(g.waves.wave + 1) % 10 === 0 ? ' · JEFE' : ''}</b></span>`;
      const grid = $('shop-items');
      grid.innerHTML = '';
      const iconFor = (it) => it.weapon ? img(WART(it.weapon), 'wart') : img(ICON({ heal: 'hp', armor: 'armor', ammo: 'up_ammo', module: 'level' }[it.id] || 'coin'));
      for (const it of HF.UpgradeSystem.shopItems(g)) {
        const b = document.createElement('button');
        const afford = p.coins >= it.cost;
        b.className = 'shop-item' + (it.weapon ? ' weapon' : '');
        b.disabled = it.disabled || !afford;
        b.innerHTML = `${iconFor(it)}<div class="si-name">${it.name}</div><div class="si-desc">${it.disabled ? 'Ya está al máximo.' : it.desc}</div>
          <div class="si-cost ${afford ? '' : 'no'}">${img(ICON('coin'))}${it.cost}</div>`;
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
        b.innerHTML = `${img(ICON(id))}<div class="ab-name">${a.name}</div><div class="ab-desc">${a.desc}</div>
          <div class="ab-cd">RECARGA ${a.cd} S</div><div class="ab-tag">${eq ? 'EQUIPADA' : 'EQUIPAR · 30'}</div>`;
        b.onclick = () => { if (g.equipAbility(id, 30)) this.showShop(); };
        ab.appendChild(b);
      }
      this.renderSlots();
      this.showScreen('shop');
    },

    /* ---------------- game over ---------------- */
    showGameOver(d) {
      this.el.hud.classList.add('hidden');
      document.body.classList.remove('in-game');
      $('go-stats').innerHTML =
        this.infoCell('wave', 'OLEADA', d.wave) + this.infoCell('kills', 'ENEMIGOS', d.kills) +
        this.infoCell('score', 'PUNTUACIÓN', U.fmtNum(d.score)) + this.infoCell('clock', 'TIEMPO', U.fmtTime(d.time)) +
        this.infoCell('level', 'NIVEL', d.level) + this.infoCell('combo', 'MEJOR COMBO', 'x' + d.bestCombo);
      $('go-records').innerHTML =
        this.infoCell('trophy', 'MEJOR OLEADA', d.bestWave + (d.newWave ? ' <i>¡RÉCORD!</i>' : ''), d.newWave ? 'new' : '') +
        this.infoCell('trophy', 'MEJOR PUNTUACIÓN', U.fmtNum(d.bestScore) + (d.newScore ? ' <i>¡RÉCORD!</i>' : ''), d.newScore ? 'new' : '');
      $('go-cores').innerHTML = `${img(ICON('core'))}+${d.cores} NÚCLEOS <small>(total ${HF.SaveManager.data.cores})</small>`;
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
      const icon = type === 'ability' && this.game && this.game.player ? this.game.player.ability.id : TOAST_ICON[type] || 'danger';
      t.innerHTML = img(ICON(icon)) + '<span></span>';
      t.lastChild.textContent = msg;
      const box = this.el.toasts;
      box.appendChild(t);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => t.classList.add('out'), 2600);
      setTimeout(() => t.remove(), 3000);
    },
    hurt(k) { if (this.game) this.game.hurtFlash = Math.max(this.game.hurtFlash, k); },
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
        s.innerHTML = `<b>${i + 1}</b>${img(WART(id))}`;
        s.title = HF.WEAPONS[id].name;
        box.appendChild(s);
      });
      this.slotCurrent = p.current;
    },
    updateKeyLabels() {
      document.querySelectorAll('.skill .key[data-action]').forEach((k) => {
        k.textContent = HF.Input.codeLabel(HF.Input.bindings[k.dataset.action][0]).slice(0, 4).toUpperCase();
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

      const comboOn = g.combo >= 2;
      E['h-combo'].classList.toggle('active', comboOn);
      if (comboOn) {
        this.setText(E['h-combo-n'], 'x' + g.combo);
        this.setText(E['h-combo-mult'], 'PUNTOS x' + g.comboMult.toFixed(1));
        this.setWidth(E['h-combo-bar'], g.comboT / 3.2);
        E['h-combo'].classList.toggle('hot', g.combo >= 15);
      }

      this.setText(E['h-enemies'], W.state === 'active' ? String(W.remaining) : '—');
      const inter = E['h-intermission'];
      if (W.state === 'intermission' && g.state !== 'dying') {
        inter.classList.remove('hidden');
        const ready = HF.Input.codeLabel(HF.Input.bindings.ready[0]);
        const use = HF.Input.codeLabel(HF.Input.bindings.interact[0]);
        this.setText(inter, W.prep
          ? `ZONA SEGURA · TERMINAL [${use}] · [${ready}] OLEADA ${W.wave + 1}`
          : `OLEADA ${W.wave + 1} EN ${Math.ceil(Math.max(0, W.timer))} S · [${ready}] ADELANTAR`);
        inter.classList.toggle('prep', W.prep);
      } else inter.classList.add('hidden');

      const hpF = p.hp / p.maxHp;
      this.hpLag = Math.max(hpF, U.damp(this.hpLag, hpF, 3, dt));
      this.setWidth(E['h-hp'], hpF);
      this.setWidth(E['h-hp-lag'], this.hpLag);
      this.setText(E['h-hp-t'], `${Math.ceil(p.hp)}/${p.maxHp}`);
      this.setWidth(E['h-armor'], p.armor / p.maxArmor);
      this.setText(E['h-armor-t'], `${Math.ceil(p.armor)}/${p.maxArmor}`);
      this.setWidth(E['h-stamina'], p.stamina / p.maxStamina);
      E['h-stamina-bar'].classList.toggle('exhausted', p.exhausted);
      this.setText(E['h-level'], String(p.level));
      this.setWidth(E['h-xp'], p.xp / p.xpNext);

      const pw = [];
      for (const k in p.power) if (p.power[k] > 0) pw.push(`<span class="power-chip" style="color:${HF.POWERUPS[k].color}">${img(ICON(POWER_ICON[k]))}${HF.POWERUPS[k].name} ${Math.ceil(p.power[k])}S</span>`);
      if (p.ability.active > 0) pw.push(`<span class="power-chip" style="color:${p.abilityDef.color}">${img(ICON(p.ability.id))}${p.abilityDef.name.toUpperCase()} ${Math.ceil(p.ability.active)}S</span>`);
      if (p.exhausted) pw.push(`<span class="power-chip" style="color:#ff8a5a">${img(ICON('danger'))}AGOTADO</span>`);
      this.setHTML(E['h-powers'], pw.join(''));

      const D = p.dash;
      this.setSkill(this.skills.dash, D.charges > 0 ? 0 : 1 - D.t / D.cd, D.max > 1 ? String(D.charges) : '');
      this.setSkill(this.skills.grenade, Math.max(0, p.grenade.t / p.grenade.cd), '');
      const A = p.ability, ad = p.abilityDef;
      this.setSkill(this.skills.ability, A.active > 0 ? 0 : Math.max(0, A.t / p.abilityCd), '', A.active > 0);
      this.setText(this.skills.ability.querySelector('.name'), ad.name.toUpperCase());
      const aico = this.skills.ability.querySelector('.ico');
      if (this.cache.get('aico') !== A.id) { this.cache.set('aico', A.id); aico.src = ICON(A.id); }

      if (this.slotCurrent !== p.current) this.renderSlots();
      this.setText(E['h-weapon'], w.def.short);
      this.setAttr(E['h-weapon-art'], 'src', WART(w.id));
      this.setHTML(E['h-wlvl'], Array.from({ length: HF.WEAPON_MAX_LEVEL }, (_, k) => `<i class="${k < w.level ? 'on' : ''}"></i>`).join(''));
      const ms = w.magSize(p);
      this.setText(E['h-mag'], p.overdriveActive ? '∞' : String(w.mag));
      E['h-mag'].classList.toggle('low', !p.overdriveActive && w.mag <= Math.ceil(ms * 0.25));
      const res = w.reserve(p);
      this.setText(E['h-reserve'], res === Infinity ? '∞' : String(res));
      const at = w.def.ammoType;
      this.setAttr(E['h-ammo-ico'], 'src', ICON(at ? AMMO_ICON[at] : 'ammo_inf'));
      this.setText(E['h-ammotype'], w.reloading ? 'RECARGANDO…' : at ? HF.AMMO_TYPES[at].name.toUpperCase() : 'MUNICIÓN INFINITA');
      E['h-ammotype'].style.color = w.reloading ? '#ffcc3a' : at ? HF.AMMO_TYPES[at].color : '#9aa4b2';
      this.setText(E['h-coins'], U.fmtNum(p.coins));

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
    setSkill(el, cdFrac, charges, active) {
      const cd = el.querySelector('.cd');
      const v = (U.clamp(cdFrac, 0, 1) * 100).toFixed(0) + '%';
      if (this.cache.get(cd) !== v) { this.cache.set(cd, v); cd.style.height = v; }
      el.classList.toggle('ready', cdFrac <= 0 && !active);
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
      ctx.drawImage(m.mini, 0, 0, cw, ch);
      ctx.fillStyle = 'rgba(120,255,60,0.35)';
      for (const t of m.toxic) { const r = Math.round(t.r * k); ctx.fillRect(Math.round(t.x * k - r), Math.round(t.y * k - r), r * 2, r * 2); }
      if (g.waves && g.waves.state === 'intermission' && g.waves.prep && Math.floor(g.time * 3) % 2) {
        ctx.fillStyle = '#3affaa';
        ctx.fillRect(Math.round(m.terminal.x * k) - 5, Math.round(m.terminal.y * k) - 5, 10, 10);
      }
      ctx.fillStyle = '#ffcc3a';
      g.items.forEach((it) => { if (it.type !== 'coin') ctx.fillRect(Math.round(it.x * k) - 1, Math.round(it.y * k) - 1, 2, 2); });
      g.items.forEach((it) => {
        if (it.type !== 'log') return;
        ctx.fillStyle = Math.floor(g.time * 4) % 2 ? '#3affaa' : '#ffffff';
        ctx.fillRect(Math.round(it.x * k) - 3, Math.round(it.y * k) - 3, 6, 6);
      });
      ctx.fillStyle = '#ff5a2a';
      for (const s of g.spawnMarkers) ctx.fillRect(Math.round(s.x * k) - 1, Math.round(s.y * k) - 1, 3, 3);
      g.enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = e.elite ? '#ffcc3a' : '#ff3030';
        const s = e.r > 18 ? 4 : 3;
        ctx.fillRect(Math.round(e.x * k - s / 2), Math.round(e.y * k - s / 2), s, s);
      });
      if (g.boss && g.boss.alive) { ctx.fillStyle = '#ff2a6a'; ctx.fillRect(Math.round(g.boss.x * k) - 4, Math.round(g.boss.y * k) - 4, 8, 8); }
      const v = g.view;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(v.x * k) + 0.5, Math.round(v.y * k) + 0.5, Math.round(v.w * k), Math.round(v.h * k));
      const p = g.player;
      ctx.fillStyle = '#05040a';
      ctx.fillRect(Math.round(p.x * k) - 3, Math.round(p.y * k) - 3, 6, 6);
      ctx.fillStyle = '#7ff6ff';
      ctx.fillRect(Math.round(p.x * k) - 2, Math.round(p.y * k) - 2, 4, 4);
      ctx.fillRect(Math.round(p.x * k + Math.cos(p.angle) * 5), Math.round(p.y * k + Math.sin(p.angle) * 5), 2, 2);
    },

    /* ---------------- menús de progreso ---------------- */
    renderArchive() {
      const St = HF.Story, d = St.data;
      $('archive-count').innerHTML = `${img(ICON('stats'))}REGISTROS <b class="num">${d.logs.length}/${St.LOGS.length}</b>`;
      document.querySelectorAll('[data-atab]').forEach((t) => {
        t.onclick = () => {
          document.querySelectorAll('[data-atab]').forEach((x) => x.classList.toggle('active', x === t));
          document.querySelectorAll('[data-abody]').forEach((b) => b.classList.toggle('hidden', b.dataset.abody !== t.dataset.atab));
        };
      });
      // registros
      const list = $('archive-list'), reader = $('archive-reader');
      list.innerHTML = '';
      reader.innerHTML = '<p class="panel-desc">Los registros aparecen en el mapa al completar oleadas (marca verde en el minimapa). Cada sector guarda cuatro.</p>';
      let first = null;
      for (const log of St.LOGS) {
        const got = d.logs.includes(log.id);
        const S = HF.SECTORS[log.sector];
        const b = document.createElement('button');
        b.className = 'archive-item' + (got ? '' : ' locked');
        b.innerHTML = `<small style="color:${S.accent}">${S.code}</small><span>${got ? log.title : '— Registro no recuperado —'}</span>`;
        if (got) {
          b.onclick = () => {
            list.querySelectorAll('.archive-item').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            reader.innerHTML = `<small class="lbl">${S.code} · ${S.name.toUpperCase()}</small><h3>${log.title}</h3><p></p>`;
            reader.querySelector('p').textContent = log.text;
          };
          if (!first) first = b;
        }
        list.appendChild(b);
      }
      if (first) first.click();
      // expedientes de los jefes
      const dos = $('archive-dossiers');
      dos.innerHTML = '';
      for (const id of HF.SECTOR_ORDER) {
        const S = HF.SECTORS[id], boss = S.boss, got = d.dossiers.includes(boss);
        const scene = St.BOSS_SCENES[boss][0];
        const c = document.createElement('div');
        c.className = 'dossier' + (got ? '' : ' locked');
        c.innerHTML = `<h4>${got ? HF.BOSSES[boss].name : '???'}</h4><div class="dz-art"></div><p></p>`;
        c.querySelector('p').textContent = got ? scene.text : 'Derrota al jefe de ' + S.code + ' para desbloquear su expediente.';
        if (got) c.querySelector('.dz-art').appendChild(HF.Assets.frameCanvas('boss_' + boss, 'idle', 0, 2, 1));
        else c.querySelector('.dz-art').innerHTML = img(ICON('lock'));
        dos.appendChild(c);
      }
      // escenas
      const sc = $('archive-scenes');
      sc.innerHTML = '';
      const add = (label, slides, ok) => {
        const b = document.createElement('button');
        b.className = 'btn' + (ok ? '' : ' ghost');
        b.disabled = !ok;
        b.innerHTML = `${img(ICON(ok ? 'play' : 'lock'))}${label}`;
        b.onclick = () => St.playScene(slides, () => this.showScreen('archive'));
        sc.appendChild(b);
      };
      add('INTRODUCCIÓN', St.INTRO, true);
      for (const id of HF.SECTOR_ORDER) { const boss = HF.SECTORS[id].boss; add('EXPEDIENTE: ' + HF.BOSSES[boss].name, St.BOSS_SCENES[boss], d.dossiers.includes(boss)); }
      add('FINAL', St.ENDING, !!d.endingSeen);
    },
    renderSectors() {
      const d = HF.SaveManager.data, g = this.game;
      const grid = $('sectors-grid');
      grid.innerHTML = '';
      HF.SECTOR_ORDER.forEach((id, i) => {
        const S = HF.SECTORS[id];
        const open = d.unlockedSectors.includes(id);
        const card = document.createElement('div');
        card.className = 'sector-card' + (open ? '' : ' locked') + (g.selectedSector === id ? ' selected' : '');
        card.style.setProperty('--accent', S.accent);
        const boss = HF.BOSSES[S.boss];
        const fauna = S.fauna.map((t) => HF.ENEMIES[t].name).join(', ') || 'Bestiario básico';
        card.innerHTML = `
          <div class="sc-code">${S.code}</div>
          <div class="sc-name">${S.name.toUpperCase()}</div>
          <div class="sc-art"></div>
          <p class="sc-desc">${open ? S.desc : 'Alcanza este sector durante una partida para desbloquearlo.'}</p>
          <div class="sc-info"><span>${img(ICON('boss'))}JEFE</span><b>${open ? boss.name : '???'}</b></div>
          <div class="sc-info"><span>${img(ICON('danger'))}PELIGRO</span><b>${HF.POOL_KINDS[S.pool].name}</b></div>
          <div class="sc-info"><span>${img(ICON('enemy'))}FAUNA</span><b>${open ? fauna : '???'}</b></div>
          <div class="sc-foot"></div>`;
        if (open) card.querySelector('.sc-art').appendChild(HF.Assets.frameCanvas('boss_' + S.boss, 'idle', 0, 2, 1));
        else card.querySelector('.sc-art').innerHTML = img(ICON('lock'), 'sc-lock');
        const b = document.createElement('button');
        b.className = 'btn small' + (open ? ' primary' : '');
        b.disabled = !open;
        b.innerHTML = open ? `${img(ICON('play'))}DESPLEGAR` : `${img(ICON('lock'))}BLOQUEADO`;
        b.onclick = () => { g.selectedSector = id; g.newRun(id); };
        card.querySelector('.sc-foot').appendChild(b);
        card.onmouseenter = () => { if (open && g.state === 'menu' && g.map.sector.id !== id) { g.selectedSector = id; g.loadSector(id); } };
        grid.appendChild(card);
      });
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
        const ammoName = w.ammoType ? HF.AMMO_TYPES[w.ammoType].name : 'Munición infinita';
        card.innerHTML = `
          <div class="wc-head"><span class="wc-slot">${w.slot}</span><div><div class="wc-name">${w.name}</div>
          <div class="wc-ammo" style="color:${w.ammoType ? HF.AMMO_TYPES[w.ammoType].color : '#9aa4b2'}">${img(ICON(w.ammoType ? AMMO_ICON[w.ammoType] : 'ammo_inf'))}${ammoName}</div></div></div>
          <div class="wc-art">${img(WART(id))}</div>
          <p class="wc-desc">${w.desc}</p>
          ${bar('Daño', (w.dmg * w.pellets) / 100, w.pellets > 1 ? `${w.dmg}×${w.pellets}` : w.dmg + (w.explode ? ' área' : ''))}
          ${bar('Cadencia', w.rate / 9, w.rate + '/s')}
          ${bar('DPS', dps / 200, Math.round(dps))}
          ${bar('Cargador', w.mag / 60, w.mag)}
          ${bar('Recarga', 1 - w.reload / 3, w.reload + ' s')}
          <div class="wc-extra"><span>Munición máx.: <b>${w.maxAmmo === Infinity ? '∞' : w.maxAmmo}</b></span><span>Alcance: <b>${rangeTxt}</b></span><span>Precisión: <b>${precision}</b></span><span>Crítico: <b>${Math.round(w.crit * 100)}%</b></span></div>
          <div class="wc-foot"></div>`;
        const foot = card.querySelector('.wc-foot');
        if (unlocked) foot.innerHTML = `<span class="ok">${img(ICON('check'))}DESBLOQUEADA</span>`;
        else {
          const b = document.createElement('button');
          b.className = 'btn small primary';
          b.innerHTML = `${img(ICON('lock'))}DESBLOQUEAR · ${w.cost}`;
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
        row.innerHTML = `${img(ICON(META_ICON[m.id] || 'core'))}<div class="mr-info"><div class="mr-name">${m.name}</div><div class="mr-desc">${m.desc}</div></div>
          <div class="pips">${pips}</div><div class="mr-btn"></div>`;
        const b = document.createElement('button');
        b.className = 'btn small' + (lvl < m.max ? ' primary' : '');
        if (lvl >= m.max) { b.innerHTML = `${img(ICON('check'))}MÁXIMO`; b.disabled = true; }
        else {
          b.innerHTML = `${img(ICON('core'))}MEJORAR · ${cost}`;
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
        ['Sectores descubiertos', `${d.unlockedSectors.length}/${HF.SECTOR_ORDER.length}`], ['Tipos de jefe derrotados', `${Object.keys(s.bossTypes || {}).length}/4`],
      ];
      $('stats-grid').innerHTML = rows.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('');
      const best = $('bestiary');
      best.innerHTML = '';
      for (const id in HF.ENEMIES) {
        const e = HF.ENEMIES[id];
        if (e.hidden) continue;
        const row = document.createElement('div');
        row.className = 'beast';
        row.innerHTML = `<div class="b-art"></div><div class="b-info"><div class="b-name">${e.name} <small>${e.role}</small></div>
          <div class="b-desc">${e.desc}</div></div><div class="b-kills">${U.fmtNum(s.killsByType[id] || 0)}</div>`;
        const sh = HF.Assets.sheet('enemy_' + id);
        row.querySelector('.b-art').appendChild(HF.Assets.frameCanvas('enemy_' + id, 'idle', 0, 2, sh && sh.fw <= 34 ? 2 : 1));
        best.appendChild(row);
      }
      const ach = HF.UpgradeSystem.ACHIEVEMENTS;
      const got = ach.filter((a) => d.achievements[a.id]).length;
      $('ach-count').textContent = `${got}/${ach.length}`;
      $('achievements').innerHTML = ach.map((a) => `<div class="ach ${d.achievements[a.id] ? 'got' : ''}">
        ${img(ICON(d.achievements[a.id] ? 'trophy' : 'lock'))}<div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div></div>`).join('');
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
        else inp.value = String(v);
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
            b.textContent = 'PULSA…';
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
