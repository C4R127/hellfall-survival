'use strict';
/* UpgradeSystem: mejoras por nivel (en partida), mejoras permanentes, tienda y logros. */
(function (HF) {
  const U = HF.U;

  // rareza → peso relativo
  const RARITY = { common: { w: 10, name: 'Común' }, rare: { w: 4, name: 'Rara' }, epic: { w: 1.3, name: 'Épica' } };

  const UPGRADES = [
    // ofensivas
    { id: 'dmg', cat: 'Ofensiva', name: 'Potencia de fuego', desc: '+12% de daño con todas las armas.', max: 10, rarity: 'common', apply: (p) => { p.dmgMult *= 1.12; } },
    { id: 'rate', cat: 'Ofensiva', name: 'Gatillo rápido', desc: '+10% de cadencia de disparo.', max: 8, rarity: 'common', apply: (p) => { p.rateMult *= 1.1; } },
    { id: 'crit', cat: 'Ofensiva', name: 'Ojo de halcón', desc: '+6% de probabilidad crítica.', max: 6, rarity: 'common', apply: (p) => { p.critChance += 0.06; } },
    { id: 'critdmg', cat: 'Ofensiva', name: 'Puntos débiles', desc: '+35% de daño crítico.', max: 5, rarity: 'rare', apply: (p) => { p.critMult += 0.35; } },
    { id: 'pierce', cat: 'Ofensiva', name: 'Perforación', desc: 'Los proyectiles atraviesan +1 enemigo.', max: 3, rarity: 'rare', apply: (p) => { p.pierce += 1; } },
    { id: 'range', cat: 'Ofensiva', name: 'Cañón largo', desc: '+15% de alcance y +15% de precisión.', max: 4, rarity: 'common', apply: (p) => { p.rangeMult *= 1.15; p.accuracyMult *= 0.85; } },
    { id: 'multishot', cat: 'Ofensiva', name: 'Proyectil doble', desc: '+1 proyectil por disparo (−12% daño).', max: 2, rarity: 'epic', apply: (p) => { p.extraProjectiles += 1; p.dmgMult *= 0.88; } },
    { id: 'explosive', cat: 'Ofensiva', name: 'Carga inestable', desc: '+25% de radio de explosiones; granadas más potentes.', max: 3, rarity: 'rare', apply: (p) => { p.explosionMult *= 1.25; p.grenade.dmg *= 1.3; } },
    // defensivas
    { id: 'maxhp', cat: 'Defensiva', name: 'Vitalidad', desc: '+20 de vida máxima y cura 20.', max: 8, rarity: 'common', apply: (p) => { p.maxHp += 20; p.heal(20); } },
    { id: 'armor', cat: 'Defensiva', name: 'Placas reforzadas', desc: '+25 de armadura máxima y la rellena.', max: 6, rarity: 'common', apply: (p) => { p.maxArmor += 25; p.armor = p.maxArmor; } },
    { id: 'stamina', cat: 'Defensiva', name: 'Pulmones de acero', desc: '+30 de resistencia y recuperación más rápida.', max: 4, rarity: 'common', apply: (p) => { p.maxStamina += 30; p.staminaRegen *= 1.2; } },
    { id: 'reduction', cat: 'Defensiva', name: 'Blindaje interno', desc: '−7% de daño recibido.', max: 5, rarity: 'rare', apply: (p) => { p.dmgReduction = 1 - (1 - p.dmgReduction) * 0.93; } },
    { id: 'regen', cat: 'Defensiva', name: 'Nanobots', desc: 'Regeneras 0.6 de vida por segundo.', max: 5, rarity: 'rare', apply: (p) => { p.regen += 0.6; } },
    // movilidad
    { id: 'speed', cat: 'Movilidad', name: 'Servomotores', desc: '+8% de velocidad de movimiento.', max: 5, rarity: 'common', apply: (p) => { p.speed *= 1.08; } },
    { id: 'dashcd', cat: 'Movilidad', name: 'Propulsores', desc: '−15% de recuperación del dash.', max: 4, rarity: 'common', apply: (p) => { p.dash.cd *= 0.85; } },
    { id: 'dashcharge', cat: 'Movilidad', name: 'Doble impulso', desc: '+1 carga de dash.', max: 2, rarity: 'epic', apply: (p) => { p.dash.max += 1; p.dash.charges += 1; } },
    { id: 'evasion', cat: 'Movilidad', name: 'Reflejos', desc: '+6% de probabilidad de evadir ataques.', max: 5, rarity: 'rare', apply: (p) => { p.evasion += 0.06; } },
    // recursos
    { id: 'mag', cat: 'Recursos', name: 'Cargadores ampliados', desc: '+20% de capacidad de cargador.', max: 5, rarity: 'common', apply: (p) => { p.magMult *= 1.2; } },
    { id: 'reload', cat: 'Recursos', name: 'Manos rápidas', desc: '−15% de tiempo de recarga.', max: 5, rarity: 'common', apply: (p) => { p.reloadMult *= 0.85; } },
    { id: 'ammo', cat: 'Recursos', name: 'Mochila táctica', desc: '+25% de munición máxima y la rellena al 60%.', max: 4, rarity: 'common', apply: (p) => { p.ammoMult *= 1.25; p.refillAmmo(0.6); } },
    { id: 'drops', cat: 'Recursos', name: 'Carroñero', desc: '+20% de probabilidad de drops.', max: 5, rarity: 'common', apply: (p) => { p.dropMult *= 1.2; } },
    { id: 'coins', cat: 'Recursos', name: 'Codicia', desc: '+25% de monedas obtenidas.', max: 5, rarity: 'common', apply: (p) => { p.coinMult *= 1.25; } },
    { id: 'magnet', cat: 'Recursos', name: 'Imán', desc: '+45% de radio de recogida.', max: 4, rarity: 'common', apply: (p) => { p.magnet *= 1.45; } },
    // habilidades
    { id: 'abilitycd', cat: 'Habilidad', name: 'Condensador', desc: '−15% de recuperación de la habilidad.', max: 4, rarity: 'rare', apply: (p) => { p.cdMult *= 0.85; } },
    { id: 'grenadecd', cat: 'Habilidad', name: 'Granadero', desc: '−20% de recuperación de la granada.', max: 3, rarity: 'common', apply: (p) => { p.grenade.cd *= 0.8; } },
    ...['shield', 'overdrive', 'berserk', 'shockwave'].map((id) => ({
      id: 'ab_' + id, cat: 'Habilidad', name: 'Habilidad: ' + HF.ABILITIES[id].name, desc: 'Sustituye tu habilidad. ' + HF.ABILITIES[id].desc,
      max: 99, rarity: 'rare', cond: (p) => p.ability.id !== id, apply: (p) => { p.ability = { id, t: 0, active: 0 }; },
    })),
  ];

  const META = [
    { id: 'hp', name: 'Vitalidad base', desc: '+10 de vida máxima inicial.', max: 5, base: 20 },
    { id: 'dmg', name: 'Calibre', desc: '+5% de daño permanente.', max: 5, base: 30 },
    { id: 'armor', name: 'Blindaje inicial', desc: 'Empiezas con +15 de armadura.', max: 3, base: 25 },
    { id: 'ammo', name: 'Suministros', desc: '+10% de munición máxima.', max: 5, base: 20 },
    { id: 'coins', name: 'Contactos', desc: '+10% de monedas.', max: 5, base: 25 },
    { id: 'xp', name: 'Aprendizaje', desc: '+8% de experiencia.', max: 5, base: 25 },
    { id: 'dash', name: 'Propulsores Mk2', desc: '−8% de recuperación del dash.', max: 3, base: 30 },
  ];
  const metaCost = (m, lvl) => Math.round(m.base * (1 + lvl * 0.8));

  const ACHIEVEMENTS = [
    { id: 'first_blood', name: 'Primera sangre', desc: 'Elimina a tu primer enemigo.' },
    { id: 'wave5', name: 'Superviviente', desc: 'Alcanza la oleada 5.' },
    { id: 'wave10', name: 'Veterano', desc: 'Alcanza la oleada 10.' },
    { id: 'wave20', name: 'Leyenda del Sector 7', desc: 'Alcanza la oleada 20.' },
    { id: 'boss1', name: 'Cazador de jefes', desc: 'Derrota a un jefe.' },
    { id: 'combo25', name: 'Imparable', desc: 'Consigue un combo x25.' },
    { id: 'combo50', name: 'Carnicería', desc: 'Consigue un combo x50.' },
    { id: 'kills1000', name: 'Exterminador', desc: 'Acumula 1000 eliminaciones.' },
    { id: 'arsenal', name: 'Arsenal completo', desc: 'Lleva las 6 armas en una misma partida.' },
    { id: 'untouchable', name: 'Intocable', desc: 'Completa una oleada (3+) sin recibir daño.' },
    { id: 'rich', name: 'Chatarrero rico', desc: 'Consigue 1000 monedas en una partida.' },
    { id: 'level15', name: 'Evolucionado', desc: 'Llega al nivel 15 en una partida.' },
    { id: 'score50k', name: 'Récord de sector', desc: 'Consigue 50,000 puntos en una partida.' },
  ];

  const UpgradeSystem = {
    UPGRADES, META, ACHIEVEMENTS, RARITY, metaCost,

    /** Elige n mejoras distintas, ponderadas por rareza. */
    getChoices(p, n = 3) {
      const pool = UPGRADES.filter((u) => (p.upgrades[u.id] || 0) < u.max && (!u.cond || u.cond(p)));
      // máximo una carta de cambio de habilidad
      const out = [];
      let abilityOffered = false;
      while (out.length < n && pool.length) {
        const list = pool.map((u) => ({ w: RARITY[u.rarity].w, u }));
        const pick = U.weightedPick(list).u;
        pool.splice(pool.indexOf(pick), 1);
        if (pick.id.startsWith('ab_')) { if (abilityOffered) continue; abilityOffered = true; }
        out.push(pick);
      }
      return out;
    },
    apply(p, u) {
      p.upgrades[u.id] = (p.upgrades[u.id] || 0) + 1;
      u.apply(p);
    },

    /** Artículos de la terminal de preparación. */
    shopItems(g) {
      const p = g.player, w = g.waves.wave;
      const items = [];
      items.push({ id: 'heal', name: 'Reparación médica', desc: 'Restaura toda la vida.', cost: 15 + w * 2, disabled: p.hp >= p.maxHp, buy: () => p.heal(p.maxHp) });
      items.push({ id: 'armor', name: 'Placas de blindaje', desc: 'Rellena la armadura.', cost: 12 + w * 2, disabled: p.armor >= p.maxArmor, buy: () => { p.armor = p.maxArmor; } });
      const types = p.ownedAmmoTypes();
      items.push({ id: 'ammo', name: 'Caja de suministros', desc: 'Rellena toda la munición.', cost: 18 + w * 2, disabled: !types.length || types.every((t) => p.ammo[t] >= p.ammoMax(t)), buy: () => p.refillAmmo(1) });
      for (const id of HF.WEAPON_ORDER) {
        const wp = p.weapons[id];
        if (wp && wp.level < HF.WEAPON_MAX_LEVEL) {
          items.push({ id: 'up_' + id, name: `Mejorar ${wp.def.short} (Nv ${wp.level} → ${wp.level + 1})`, desc: '+18% daño, +6% cadencia, +10% cargador.', cost: 35 * wp.level + w * 3, weapon: id, buy: () => { wp.level++; } });
        }
      }
      for (const id of HF.WEAPON_ORDER) {
        if (!p.weapons[id] && HF.SaveManager.data.unlockedWeapons.includes(id)) {
          const def = HF.WEAPONS[id];
          items.push({ id: 'buy_' + id, name: 'Comprar ' + def.name, desc: def.desc, cost: 50 + def.slot * 18, weapon: id, buy: () => { p.addWeapon(id); g.checkArsenal(); } });
        }
      }
      items.push({ id: 'module', name: 'Módulo de mejora', desc: 'Elige una mejora entre tres opciones.', cost: 55 + (g.run.modulesBought || 0) * 30, buy: () => { g.run.modulesBought = (g.run.modulesBought || 0) + 1; g.pendingLevelUps++; } });
      return items;
    },
  };

  HF.UpgradeSystem = UpgradeSystem;
})(window.HF);
