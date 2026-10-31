'use strict';
/*
 * Genera todos los recursos gráficos de Hellfall: Survival en assets/ y su manifiesto.
 *   node tools/build-assets.js
 * Sin dependencias: solo Node (zlib) y los módulos de tools/lib y tools/art.
 */
const fs = require('fs');
const path = require('path');
const { Img } = require('./lib/image');
const { render, sheet } = require('./lib/model');
const PL = require('./art/player');
const { ENEMY_MODELS } = require('./art/enemies');
const { BOSS_MODELS } = require('./art/bosses');
const FX = require('./art/fx');
const TL = require('./art/tiles');
const UIA = require('./art/ui');
const FONT = require('./art/font');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets');
const TAU = Math.PI * 2;

const manifest = { version: 2, generated: new Date().toISOString().slice(0, 10), sheets: {}, images: {}, atlases: {}, font: null };
let files = 0, bytes = 0;

function save(img, rel) {
  const file = path.join(OUT, rel);
  img.save(file);
  files++;
  bytes += fs.statSync(file).size;
  return 'assets/' + rel.replace(/\\/g, '/');
}

/** Hoja animada: anims = { nombre: { frames, fps, loop } }, fn(dirIndex, anim, frame) → Img */
function buildSheet(id, rel, dirs, fw, fh, anims, fn, meta) {
  const order = Object.keys(anims);
  const rows = [];
  const am = {};
  for (const a of order) {
    am[a] = { row: rows.length, frames: anims[a].frames, fps: anims[a].fps, loop: anims[a].loop };
    for (let f = 0; f < anims[a].frames; f++) rows.push([a, f]);
  }
  const img = sheet(dirs, rows.length, fw, fh, (c, r) => fn(c, rows[r][0], rows[r][1]));
  manifest.sheets[id] = { path: save(img, rel), fw, fh, dirs, anims: am, ...(meta ? { meta } : {}) };
}
function image(id, img, rel, meta) {
  manifest.images[id] = { path: save(img, rel), w: img.w, h: img.h, ...(meta ? { meta } : {}) };
}
const dirAngle = (c, dirs) => (c / dirs) * TAU;
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

fs.rmSync(OUT + '/sprites', { recursive: true, force: true });
fs.rmSync(OUT + '/tilesets', { recursive: true, force: true });
fs.rmSync(OUT + '/ui', { recursive: true, force: true });
for (const d of ['player', 'enemies', 'bosses', 'weapons', 'maps', 'effects']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });

/* ======================= PROTAGONISTA ======================= */
buildSheet('player_legs', 'sprites/player/legs.png', 8, 32, 32,
  { idle: { frames: 1, fps: 1, loop: true }, walk: { frames: 6, fps: 11, loop: true }, run: { frames: 6, fps: 15, loop: true } },
  (c, a, f) => render(PL.legs(a, f), { w: 32, h: 32, angle: dirAngle(c, 8) }));
for (const w of Object.keys(PL.WEAPONS)) {
  const W = PL.WEAPONS[w]();
  buildSheet('player_' + w, `sprites/player/torso_${w}.png`, 32, 48, 48,
    { idle: { frames: 2, fps: 1.6, loop: true }, shoot: { frames: 2, fps: 22, loop: false }, reload: { frames: 4, fps: 6, loop: false }, hurt: { frames: 1, fps: 1, loop: false } },
    (c, a, f) => render(PL.torso(w, a, f), { w: 48, h: 48, angle: dirAngle(c, 32) }),
    { muzzle: W.muzzle });
}
buildSheet('player_death', 'sprites/player/death.png', 8, 48, 48, { death: { frames: PL.DEATH_FRAMES, fps: 10, loop: false } },
  (c, a, f) => render(PL.death(f), { w: 48, h: 48, angle: dirAngle(c, 8) }));
log('protagonista');

/* ======================= ENEMIGOS ======================= */
const ENEMY_NAMES = { crawler: 'wanderer', stalker: 'stalker', brute: 'colossus', spitter: 'weaver', bloater: 'incinerator', warlock: 'guardian', phantom: 'phantom', mortar: 'mortar', swarm: 'parasite' };
for (const id in ENEMY_MODELS) {
  const m = ENEMY_MODELS[id];
  const anims = {};
  for (const a in m.anims) anims[a] = { frames: m.anims[a], fps: m.fps[a], loop: a === 'idle' || a === 'move' };
  for (const elite of [false, true]) {
    const k = elite ? 1.25 : 1;
    const size = Math.ceil((m.size * k) / 2) * 2;
    buildSheet('enemy_' + id + (elite ? '_elite' : ''), `sprites/enemies/${ENEMY_NAMES[id]}/${ENEMY_NAMES[id]}${elite ? '_elite' : ''}.png`, 8, size, size, anims,
      (c, a, f) => render(m.fn(a, f, elite), { w: size, h: size, angle: dirAngle(c, 8), scale: (m.scale || 1) * k }));
  }
}
log('enemigos');

/* ======================= JEFES ======================= */
const BOSS_NAMES = { herald: 'jailer', matriarch: 'rupture_core', forge: 'living_forge', archon: 'void_archon' };
for (const id in BOSS_MODELS) {
  const m = BOSS_MODELS[id];
  const anims = {};
  for (const a in m.anims) anims[a] = { frames: m.anims[a], fps: m.fps[a], loop: a === 'idle' || a === 'move' };
  for (const rage of [false, true]) {
    buildSheet('boss_' + id + (rage ? '_rage' : ''), `sprites/bosses/${BOSS_NAMES[id]}${rage ? '_rage' : ''}.png`, 8, m.size, m.size, anims,
      (c, a, f) => render(m.fn(a, f, rage), { w: m.size, h: m.size, angle: dirAngle(c, 8) }));
  }
}
log('jefes');

/* ======================= PROYECTILES Y EFECTOS ======================= */
for (const id in FX.PROJ) {
  const d = FX.PROJ[id];
  buildSheet('proj_' + id, `sprites/projectiles/${id}.png`, d.dirs, d.size, d.size, { fly: { frames: d.frames, fps: 12, loop: true } },
    (c, a, f) => d.fn(dirAngle(c, d.dirs), f));
}
for (const style in FX.MUZZLE) {
  buildSheet('muzzle_' + style, `sprites/effects/muzzle_${style}.png`, 16, 28, 28, { play: { frames: 2, fps: 30, loop: false } },
    (c, a, f) => FX.directional(28, dirAngle(c, 16), f, FX.MUZZLE[style]));
}
for (const id in FX.EFFECTS) {
  const d = FX.EFFECTS[id];
  buildSheet('fx_' + id, `sprites/effects/${id}.png`, 1, d.size, d.size, { play: { frames: d.frames, fps: d.fps, loop: false } }, (c, a, f) => d.fn(f));
}
for (const col in FX.BLOOD) {
  const im = new Img(24 * 4, 24);
  for (let v = 0; v < 4; v++) im.blit(FX.splat(FX.BLOOD[col], 100 + v * 7 + col.length), v * 24, 0);
  image('decal_' + col, im, `sprites/effects/decals/blood_${col}.png`, { variants: 4, w: 24 });
}
{ const im = new Img(128, 64); im.blit(FX.scorch(5), 0, 0); im.blit(FX.scorch(9), 64, 0); image('decal_scorch', im, 'sprites/effects/decals/scorch.png', { variants: 2, w: 64 }); }
for (const [id, w, h] of [['s', 22, 10], ['m', 30, 14], ['l', 56, 22], ['xl', 96, 36]]) image('shadow_' + id, FX.shadow(w, h), `sprites/effects/shadow_${id}.png`);
log('proyectiles y efectos');

/* ======================= OBJETOS RECOGIBLES ======================= */
for (const id in FX.PICKUPS) {
  const d = FX.PICKUPS[id];
  const frames = d.frames || 4;
  buildSheet('pickup_' + id, `sprites/pickups/${id}.png`, 1, d.size, d.size, { idle: { frames, fps: id === 'barrel' ? 6 : 5, loop: true } },
    (c, a, f) => render(d.fn(f), { w: d.size, h: d.size }));
}
log('objetos');

/* ======================= ESCENARIO ======================= */
{
  const names = Object.keys(TL.FLOORS);
  const cols = 8, rows = Math.ceil(names.length / cols);
  const atlas = new Img(cols * 32, rows * 32);
  const r = require('./lib/image').rng(1234);
  names.forEach((n, i) => atlas.blit(TL.FLOORS[n](r), (i % cols) * 32, Math.floor(i / cols) * 32));
  manifest.atlases.floors = { path: save(atlas, 'tilesets/floors/floors.png'), tile: 32, cols, names };
}
for (const style in TL.WALL_STYLES) {
  const r = require('./lib/image').rng(77 + style.length);
  const atlas = new Img(16 * 32, 2 * 32);
  for (let v = 0; v < 2; v++) for (let m = 0; m < 16; m++) atlas.blit(TL.wallTile(style, m, v, r), m * 32, v * 32);
  manifest.atlases['walls_' + style] = { path: save(atlas, `tilesets/walls/walls_${style}.png`), tile: 32, masks: 16, variants: 2 };
}
for (const id in TL.PROPS) {
  const folder = id.startsWith('stencil') || id.startsWith('sign') || id === 'wall_screen' ? 'tilesets/industrial' : id.startsWith('door') ? 'tilesets/doors' : 'sprites/props';
  image('prop_' + id, TL.PROPS[id](), `${folder}/${id}.png`);
}
log('escenario');

/* ======================= INTERFAZ ======================= */
for (const id in UIA.UI) image('ui_' + id, UIA.UI[id](), `ui/panels/${id}.png`);
for (const id in UIA.FILLS) image('fill_' + id, UIA.fill(UIA.FILLS[id]), `ui/bars/fill_${id}.png`);
for (const id in UIA.ICONS) image('icon_' + id, UIA.ICONS[id], `ui/icons/${id}.png`);
for (const id in UIA.PORTRAITS) image('portrait_' + id, UIA.PORTRAITS[id](), `ui/portraits/${id}.png`);
for (const w of Object.keys(PL.WEAPONS)) image('weapon_' + w, UIA.weaponArt(w), `ui/weapons/${w}.png`);
image('logo', UIA.logo(), 'ui/logo/logo.png');
{
  const f = FONT.fontSheets();
  manifest.font = {
    fill: save(f.fill, 'ui/font/font_fill.png'), shadow: save(f.shadow, 'ui/font/font_shadow.png'),
    chars: FONT.CHARS, cw: f.cw, ch: f.ch, advance: FONT.GW + 1,
  };
}
log('interfaz');

/* ======================= MANIFIESTO ======================= */
// comprobación: todas las rutas registradas existen
const missing = [];
const check = (p) => { if (!fs.existsSync(path.join(ROOT, p))) missing.push(p); };
for (const k in manifest.sheets) check(manifest.sheets[k].path);
for (const k in manifest.images) check(manifest.images[k].path);
for (const k in manifest.atlases) check(manifest.atlases[k].path);
check(manifest.font.fill); check(manifest.font.shadow);
if (missing.length) { console.error('Faltan archivos:', missing); process.exit(1); }

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT, 'manifest.js'),
  '/* Generado por tools/build-assets.js — no editar a mano. Copia de manifest.json para poder abrir el juego con file:// */\n' +
  'window.HF_ASSET_MANIFEST = ' + JSON.stringify(manifest) + ';\n');
log(`${files} archivos PNG · ${(bytes / 1024).toFixed(0)} KB · ${Object.keys(manifest.sheets).length} hojas animadas · ${Object.keys(manifest.images).length} imágenes`);
