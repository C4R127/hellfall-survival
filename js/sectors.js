'use strict';
/*
 * Sectores (niveles) del Complejo Hellfall. Cada sector define su distribución de muros,
 * coberturas, peligros ambientales, tilesets, iluminación, jefe y fauna característica.
 * Una partida recorre los sectores en orden: tras derrotar al jefe de un sector se evacúa al siguiente.
 */
(function (HF) {
  const T = 32;

  /** Charcos/zonas de peligro por tipo. dps = daño por segundo; slow = multiplicador de velocidad. */
  const POOL_KINDS = {
    toxic: { name: 'Zona contaminada', dps: 8.5, slow: 0.85, bands: ['#24400e', '#335a14', '#3f7018', '#4c861c'], spark: '#7ac02a', bubble: '#b6ff5a', light: '120,255,90' },
    magma: { name: 'Escoria fundida', dps: 12, slow: 0.8, bands: ['#3a1206', '#7a2a08', '#c0520e', '#ff8a1e'], spark: '#ffd04a', bubble: '#ffb040', light: '255,130,40' },
    cryo: { name: 'Fuga criogénica', dps: 3, slow: 0.55, bands: ['#1a3448', '#2c5a78', '#4a8ab0', '#9ad8f0'], spark: '#e8faff', bubble: '#c8f0ff', light: '140,210,255' },
    rift: { name: 'Grieta dimensional', dps: 11, slow: 0.9, bands: ['#1a0a30', '#36125a', '#5a1e8a', '#a050e0'], spark: '#ff4af0', bubble: '#e0a0ff', light: '190,90,255' },
  };

  /* ---------------- utilidades de distribución ---------------- */
  // B = constructor del mapa: rect, wallV, wallH, crate, pillar, generator, consoles, vent, light, pool, barrel
  function cornerRooms(B) {
    B.room(20, 16, 2, 17, 2, 21, 7, 9);
    B.room(54, 16, 2, 17, 54, 73, 7, 63);
    B.room(20, 38, 38, 53, 2, 21, 44, 9);
    B.room(54, 38, 38, 53, 54, 73, 44, 63);
  }

  /* ================= SECTOR 7 · Laboratorios de contención ================= */
  function layoutS7(B, rng) {
    cornerRooms(B);
    B.rect(8, 24, 2, 8); B.rect(66, 24, 2, 8);
    B.rect(29, 8, 7, 2); B.rect(40, 8, 7, 2);
    B.rect(29, 46, 7, 2); B.rect(40, 46, 7, 2);
    for (const [x, y] of [[28, 20], [46, 20], [28, 34], [46, 34]]) B.pillar(x, y);
    for (const c of [
      [13, 20, 2, 2], [61, 20, 2, 2], [13, 34, 2, 2], [61, 34, 2, 2],
      [33, 15, 2, 1], [41, 15, 2, 1], [33, 40, 2, 1], [41, 40, 2, 1],
      [6, 5, 1, 2], [14, 11, 2, 1], [69, 5, 1, 2], [60, 11, 2, 1],
      [6, 48, 1, 2], [14, 43, 2, 1], [69, 48, 1, 2], [60, 43, 2, 1],
      [24, 27, 1, 2], [51, 27, 1, 2],
    ]) B.crate(...c);
    B.generator(16, 4); B.generator(57, 49);
    B.consoles(59, 2, 4, 1); B.consoles(13, 53, 4, 1); B.consoles(2, 30, 1, 3); B.consoles(73, 22, 1, 3);
    for (const v of [[4, 4], [17, 13], [71, 4], [57, 13], [4, 51], [17, 41], [71, 51], [57, 41], [3, 21], [72, 21], [3, 35], [72, 35], [38, 3], [38, 52], [25, 4], [51, 51]]) B.vent(...v);
    for (const [x, y] of [[21, 9], [55, 9], [21, 46], [55, 46], [11, 17], [65, 17], [11, 39], [65, 39], [38, 9], [38, 47]]) B.light('alarm', x, y);
    for (const [x, y, r] of [[11, 9], [65, 9], [11, 46], [65, 46], [30, 24, 220], [46, 24, 220], [30, 32, 220], [46, 32, 220], [38, 18], [38, 38], [5, 28, 200], [71, 28, 200]]) B.light('work', x, y, r);
    B.pool(11, 47, 78); B.pool(64, 9, 66); B.pool(38, 5.5, 50);
    for (const b of [[24, 22], [52, 22], [24, 34], [52, 34], [10, 9], [66, 46], [38, 13], [38, 43], [5, 25], [71, 31]]) B.barrel(...b);
    B.stencil('stencil_s7', 38, 34.1); B.stencil('stencil_lab', 11, 9); B.stencil('stencil_ctrl', 64, 13);
    B.stencil('stencil_bio', 11, 43); B.stencil('stencil_pwr', 64, 42);
  }
  function zoneS7(tx, ty) {
    if (tx <= 21 && ty <= 17) return 'lab';
    if (tx >= 54 && ty <= 17) return 'control';
    if (tx <= 21 && ty >= 38) return 'storage';
    if (tx >= 54 && ty >= 38) return 'power';
    return 'hangar';
  }
  function wallS7(tx, ty) {
    if (tx <= 21 && ty <= 17 && tx >= 2 && ty >= 2) return 'lab';
    if ((ty >= 8 && ty <= 9) || (ty >= 46 && ty <= 47) || (tx <= 21 && ty >= 38 && tx >= 2 && ty <= 53)) return 'concrete';
    return 'steel';
  }

  /* ================= SECTOR 9 · Fundición ================= */
  function layoutFoundry(B) {
    B.wallV(17, 2, 53, [[12, 4], [40, 4]]);
    B.wallV(57, 2, 53, [[12, 4], [40, 4]]);
    B.rect(24, 12, 11, 2); B.rect(42, 12, 11, 2);
    B.rect(24, 42, 11, 2); B.rect(42, 42, 11, 2);
    for (const [x, y] of [[24, 20], [50, 20], [24, 34], [50, 34], [30, 5], [44, 5], [30, 48], [44, 48]]) B.pillar(x, y);
    B.generator(6, 6); B.generator(6, 46); B.generator(67, 6); B.generator(67, 46);
    for (const c of [[11, 20, 2, 2], [11, 33, 2, 2], [62, 20, 2, 2], [62, 33, 2, 2], [31, 24, 2, 1], [43, 24, 2, 1], [31, 33, 2, 1], [43, 33, 2, 1], [4, 27, 1, 2], [71, 27, 1, 2]]) B.crate(...c);
    B.consoles(2, 13, 1, 3); B.consoles(73, 40, 1, 3);
    for (const v of [[4, 3], [4, 52], [71, 3], [71, 52], [13, 9], [13, 46], [62, 9], [62, 46], [21, 3], [54, 3], [21, 52], [54, 52], [38, 17], [38, 39]]) B.vent(...v);
    B.pool(9.5, 27.5, 82); B.pool(66.5, 27.5, 82); B.pool(38, 7, 56); B.pool(38, 49, 56); B.pool(27, 27.5, 40); B.pool(49, 27.5, 40);
    for (const [x, y] of [[7, 7], [7, 47], [68, 7], [68, 47]]) B.light('furnace', x, y, 190);
    for (const [x, y] of [[17, 14], [57, 14], [17, 42], [57, 42], [38, 13], [38, 43]]) B.light('alarm', x, y);
    for (const [x, y] of [[30, 20], [46, 20], [30, 36], [46, 36], [38, 24], [21, 27], [54, 27]]) B.light('work', x, y, 210);
    for (const b of [[21, 8], [54, 8], [21, 47], [54, 47], [33, 17], [42, 17], [33, 38], [42, 38], [14, 27], [61, 27]]) B.barrel(...b);
    B.stencil('stencil_s9', 38, 34.1); B.stencil('stencil_hot', 9.5, 22); B.stencil('stencil_hot', 66.5, 33);
  }

  /* ================= SECTOR 12 · Criogenia ================= */
  function layoutCryo(B) {
    for (const x of [6, 11, 16]) for (const y of [5, 10, 42, 47]) B.crate(x, y, 2, 2);
    for (const x of [57, 62, 67]) for (const y of [5, 10, 42, 47]) B.crate(x, y, 2, 2);
    B.rect(24, 17, 8, 2); B.rect(24, 17, 2, 6);
    B.rect(44, 17, 8, 2); B.rect(50, 17, 2, 6);
    B.rect(24, 37, 8, 2); B.rect(24, 33, 2, 6);
    B.rect(44, 37, 8, 2); B.rect(50, 33, 2, 6);
    B.rect(2, 26, 4, 2); B.rect(70, 28, 4, 2);
    for (const [x, y] of [[12, 27], [62, 27], [38, 10], [37, 44]]) B.pillar(x, y);
    B.consoles(30, 2, 4, 1); B.consoles(42, 53, 4, 1); B.consoles(2, 18, 1, 3); B.consoles(73, 35, 1, 3);
    for (const v of [[3, 3], [3, 52], [72, 3], [72, 52], [21, 8], [21, 47], [54, 8], [54, 47], [3, 37], [72, 18], [38, 3], [30, 52]]) B.vent(...v);
    B.pool(19, 27.5, 62); B.pool(57, 27.5, 62); B.pool(38, 4.5, 46); B.pool(38, 51.5, 46);
    for (const [x, y] of [[9, 8], [9, 45], [64, 8], [64, 45], [30, 27], [46, 27], [38, 20], [38, 36]]) B.light('cold', x, y, 220);
    for (const [x, y] of [[24, 17], [52, 17], [24, 39], [52, 39]]) B.light('alarm', x, y);
    for (const b of [[21, 14], [54, 14], [21, 41], [54, 41], [31, 13], [45, 13], [31, 42], [45, 42], [8, 27], [68, 27]]) B.barrel(...b);
    B.stencil('stencil_s12', 38, 34.1); B.stencil('stencil_cold', 11, 16); B.stencil('stencil_cold', 62, 39);
  }

  /* ================= SECTOR 0 · La Brecha ================= */
  function layoutRift(B) {
    // anillo de contención roto alrededor del terminal
    const cx = 38, cy = 28;
    for (let y = 0; y < 56; y++) for (let x = 0; x < 76; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d < 12.6 || d > 14.2) continue;
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      const gap = [0, Math.PI / 2, Math.PI, -Math.PI / 2].some((g) => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.26);
      const crack = [0.75, 2.35, -0.8, -2.4].some((g) => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.12);
      if (!gap && !crack) B.rect(x, y, 1, 1);
    }
    B.rect(6, 18, 6, 2); B.rect(64, 36, 6, 2); B.rect(29, 3, 2, 5); B.rect(45, 48, 2, 5);
    B.rect(60, 6, 2, 6); B.rect(14, 44, 2, 6);
    for (const [x, y] of [[10, 8], [64, 18], [9, 46], [65, 46], [21, 21], [54, 33], [22, 38], [53, 13]]) B.pillar(x, y);
    for (const c of [[4, 30, 2, 2], [70, 24, 2, 2], [33, 50, 2, 1], [41, 4, 2, 1]]) B.crate(...c);
    for (const v of [[3, 3], [3, 52], [72, 3], [72, 52], [16, 4], [59, 51], [3, 24], [72, 31], [24, 52], [52, 3], [38, 3], [38, 52]]) B.vent(...v);
    B.pool(12, 27.5, 52); B.pool(64, 27.5, 52); B.pool(38, 9, 40); B.pool(38, 47, 40); B.pool(20, 12, 34); B.pool(56, 44, 34);
    for (const [x, y] of [[22, 6], [54, 6], [22, 50], [54, 50], [10, 28], [66, 28], [38, 28]]) B.light('rift', x, y, 200);
    for (const [x, y] of [[38, 15], [38, 41], [25, 28], [51, 28]]) B.light('alarm', x, y);
    for (const b of [[18, 28], [58, 28], [38, 16], [38, 40], [8, 12], [68, 44], [28, 46], [48, 10]]) B.barrel(...b);
    B.stencil('stencil_s0', 38, 34.1);
  }

  const SECTORS = {
    s7: {
      id: 's7', code: 'SECTOR 7', name: 'Laboratorios de contención', boss: 'herald', pool: 'toxic', fauna: [],
      desc: 'Donde empezó todo. Laboratorios, salas de control y almacenes contaminados.',
      layout: layoutS7, zone: zoneS7, wall: wallS7, accent: '#ff5a3a', darkness: 0.74, seed: 7331,
      floors: {
        hangar: [['metal_a', 45], ['metal_b', 20], ['metal_c', 14], ['tread', 10], ['metal_d', 5], ['damaged', 1.5]],
        lab: [['lab_a', 60], ['lab_b', 20], ['lab_crack', 12], ['lab_stain', 8]],
        control: [['control_b', 60], ['control_a', 40]],
        storage: [['concrete_a', 55], ['concrete_crack', 15], ['concrete_stain', 15], ['concrete_patch', 10]],
        power: [['tread', 50], ['metal_b', 30], ['metal_c', 20]],
      },
      nearWall: ['grate_a', 'grate_b'], poolFloor: 'toxic',
      props: {},
    },
    foundry: {
      id: 'foundry', code: 'SECTOR 9', name: 'Fundición', boss: 'forge', pool: 'magma', fauna: ['mortar'],
      desc: 'Hornos fuera de control y ríos de escoria. Los Artilleros dominan la zona.',
      layout: layoutFoundry, zone: (tx) => (tx <= 18 || tx >= 57 ? 'side' : 'hall'), wall: () => 'foundry', accent: '#ff8a2a', darkness: 0.72, seed: 919,
      floors: {
        hall: [['foundry_a', 60], ['foundry_b', 30], ['foundry_c', 8]],
        side: [['foundry_b', 40], ['foundry_a', 40], ['foundry_c', 20]],
      },
      nearWall: ['foundry_grill'], poolFloor: 'foundry_c',
      props: { pillar: 'prop_piston', crate2x2: 'prop_crucible' },
    },
    cryo: {
      id: 'cryo', code: 'SECTOR 12', name: 'Criogenia', boss: 'archon', pool: 'cryo', fauna: ['phantom'],
      desc: 'Cámaras de hibernación rotas. Los Espectros se desvanecen entre las cápsulas.',
      layout: layoutCryo, zone: (tx, ty) => (ty <= 15 || ty >= 40 ? 'pods' : 'plaza'), wall: () => 'cryo', accent: '#7fd8ff', darkness: 0.7, seed: 1212,
      floors: {
        plaza: [['cryo_a', 60], ['cryo_b', 30], ['cryo_c', 10]],
        pods: [['cryo_b', 50], ['cryo_a', 40], ['cryo_c', 10]],
      },
      nearWall: ['cryo_grate'], poolFloor: 'cryo_c',
      props: { pillar: 'prop_cryo_column', crate2x2: 'prop_cryo_pod' },
    },
    rift: {
      id: 'rift', code: 'SECTOR 0', name: 'La Brecha', boss: 'matriarch', pool: 'rift', fauna: ['swarm', 'phantom'],
      desc: 'El origen de la anomalía. La realidad se resquebraja y los Parásitos brotan en enjambres.',
      layout: layoutRift, zone: (tx, ty) => (Math.hypot(tx - 38, ty - 28) < 13 ? 'core' : 'outer'), wall: () => 'rift', accent: '#c07aff', darkness: 0.78, seed: 1,
      floors: {
        core: [['rift_a', 70], ['rift_b', 22], ['rift_c', 8]],
        outer: [['rift_a', 60], ['rift_b', 28], ['rift_c', 12]],
      },
      nearWall: ['rift_a'], poolFloor: 'rift_c',
      props: { pillar: 'prop_crystal', crate2x2: 'prop_crystal' },
    },
  };
  const SECTOR_ORDER = ['s7', 'foundry', 'cryo', 'rift'];

  HF.SECTORS = SECTORS;
  HF.SECTOR_ORDER = SECTOR_ORDER;
  HF.POOL_KINDS = POOL_KINDS;
  HF.nextSector = (id) => SECTOR_ORDER[(SECTOR_ORDER.indexOf(id) + 1) % SECTOR_ORDER.length];
})(window.HF);
