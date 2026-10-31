'use strict';
/*
 * Mapa de la arena: "Complejo Hellfall — Sector 7".
 * Rejilla de tiles de 32 px con paredes, coberturas, consolas, generadores,
 * zonas contaminadas, rejillas de ventilación (spawn) y luces de emergencia.
 * Incluye flow field (BFS) para que la IA navegue alrededor de obstáculos.
 */
(function (HF) {
  const U = HF.U;
  const T = 32;
  const W = 76, H = 56;

  // tipos de tile
  const FLOOR = 0, WALL = 1, CRATE = 2, PILLAR = 3, CONSOLE = 4, GENERATOR = 5, TERMINAL = 6;

  class GameMap {
    constructor(sectorId = 's7') {
      this.sector = HF.SECTORS[sectorId] || HF.SECTORS.s7;
      this.T = T; this.W = W; this.H = H;
      this.pw = W * T; this.ph = H * T;
      this.grid = new Uint8Array(W * H);
      this.flow = new Uint16Array(W * H);
      this.queue = new Int32Array(W * H);
      this.flowTile = -1;
      this.spawnVents = [];
      this.lights = [];
      this.toxic = [];
      this.barrelSpots = [];
      this.terminal = { x: 0, y: 0 };
      this.playerStart = { x: 0, y: 0 };
      this.generate();
      this.render();
      this.renderMini();
      // capa de trabajo: mapa base + manchas persistentes de la partida (un solo blit por frame)
      this.dctx = this.canvas.getContext('2d');
      this.dctx.imageSmoothingEnabled = false;
    }

    idx(tx, ty) { return ty * W + tx; }
    tileAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return WALL;
      return this.grid[ty * W + tx];
    }
    solidTile(tx, ty) { return this.tileAt(tx, ty) !== FLOOR; }
    solidAt(x, y) { return this.solidTile(Math.floor(x / T), Math.floor(y / T)); }
    /** Bloquea proyectiles: todo excepto suelo. */
    blocksShot(x, y) { return this.solidAt(x, y); }

    isFreeCircle(x, y, r) {
      if (x - r < 0 || y - r < 0 || x + r > this.pw || y + r > this.ph) return false;
      const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
      const y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.solidTile(tx, ty)) continue;
        const cx = U.clamp(x, tx * T, tx * T + T), cy = U.clamp(y, ty * T, ty * T + T);
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return false;
      }
      return true;
    }

    /* ------------------------------------------------------------ */
    generate() {
      const S = this.sector;
      const g = this.grid;
      g.fill(FLOOR);
      const rng = U.mulberry32(S.seed);
      const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = t; };
      const rect = (x, y, w, h, t = WALL) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, t); };
      this.doors = []; this.crateRects = []; this.pillars = []; this.generators = [];
      this.lights = []; this.toxic = []; this.barrelSpots = []; this.stencils = [];
      const vents = [];

      // borde
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, WALL);

      const L = this.lights;
      const LIGHTS = {
        alarm: (x, y) => L.push({ x: x * T, y: y * T, r: 170, color: '255,40,30', a: 0.6, rot: true, phase: rng() * 6 }),
        work: (x, y, r = 230) => L.push({ x: x * T, y: y * T, r, color: '170,200,255', a: 0.5, flicker: rng() < 0.3, phase: rng() * 6 }),
        furnace: (x, y, r = 180) => L.push({ x: x * T, y: y * T, r, color: '255,140,50', a: 0.6, pulse: true, phase: rng() * 6 }),
        cold: (x, y, r = 220) => L.push({ x: x * T, y: y * T, r, color: '150,215,255', a: 0.5, flicker: rng() < 0.2, phase: rng() * 6 }),
        rift: (x, y, r = 200) => L.push({ x: x * T, y: y * T, r, color: '190,90,255', a: 0.55, pulse: true, phase: rng() * 6 }),
      };
      const B = {
        rect,
        room: (vx, hy, y0, y1, x0, x1, doorY, doorX) => {
          rect(vx, y0, 2, y1 - y0 + 1);
          rect(x0, hy, x1 - x0 + 1, 2);
          rect(vx, doorY, 2, 4, FLOOR);
          rect(doorX, hy, 4, 2, FLOOR);
          this.doors.push({ x: vx, y: doorY, w: 2, h: 4, vertical: true }, { x: doorX, y: hy, w: 4, h: 2, vertical: false });
        },
        wallV: (x, y0, y1, gaps = []) => {
          rect(x, y0, 2, y1 - y0 + 1);
          for (const [gy, len] of gaps) { rect(x, gy, 2, len, FLOOR); this.doors.push({ x, y: gy, w: 2, h: len, vertical: true }); }
        },
        wallH: (y, x0, x1, gaps = []) => {
          rect(x0, y, x1 - x0 + 1, 2);
          for (const [gx, len] of gaps) { rect(gx, y, len, 2, FLOOR); this.doors.push({ x: gx, y, w: len, h: 2, vertical: false }); }
        },
        crate: (x, y, w, h) => { rect(x, y, w, h, CRATE); this.crateRects.push([x, y, w, h]); },
        pillar: (x, y) => { rect(x, y, 2, 2, PILLAR); this.pillars.push([x, y]); },
        generator: (x, y) => { rect(x, y, 2, 2, GENERATOR); this.generators.push({ x: (x + 1) * T, y: (y + 1) * T }); },
        consoles: (x, y, w, h) => rect(x, y, w, h, CONSOLE),
        vent: (x, y) => vents.push([x, y]),
        light: (kind, x, y, r) => LIGHTS[kind](x, y, r),
        pool: (x, y, r) => this.toxic.push({ x: x * T, y: y * T, r }),
        barrel: (x, y) => this.barrelSpots.push({ x: x * T + 16, y: y * T + 16 }),
        stencil: (id, x, y) => this.stencils.push([id, x * T, y * T]),
      };
      S.layout(B, rng);

      // terminal de preparación y punto de inicio (comunes a todos los sectores)
      rect(36, 26, 4, 4, FLOOR);
      rect(37, 27, 2, 2, TERMINAL);
      rect(37, 30, 3, 3, FLOOR);
      this.terminal = { x: 38 * T, y: 28 * T };
      this.playerStart = { x: 38 * T, y: 31.5 * T };

      // conectividad: el suelo inalcanzable desde el inicio se sella
      const seen = new Uint8Array(W * H);
      const q = [31 * W + 38];
      seen[q[0]] = 1;
      while (q.length) {
        const i = q.pop(), x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, ni = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || g[ni] !== FLOOR) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
      for (let i = 0; i < W * H; i++) if (g[i] === FLOOR && !seen[i]) g[i] = WALL;

      this.spawnVents = vents
        .filter(([x, y]) => g[y * W + x] === FLOOR)
        .map(([x, y]) => ({ x: x * T + 16, y: y * T + 16, tx: x, ty: y }));
      this.barrelSpots = this.barrelSpots.filter((b) => this.isFreeCircle(b.x, b.y, 14));

      const kind = HF.POOL_KINDS[S.pool];
      this.poolKind = kind;
      for (const t of this.toxic) L.push({ x: t.x, y: t.y, r: t.r * 2.1, color: kind.light, a: 0.42, pulse: true, phase: rng() * 6 });
      L.push({ x: 38 * T, y: 28 * T, r: 170, color: '60,255,170', a: 0.45, pulse: true, phase: 0 });
      for (const gg of this.generators) L.push({ x: gg.x, y: gg.y, r: 150, color: '255,200,60', a: 0.45, pulse: true, phase: rng() * 6 });
    }

    /* ------------------------------------------------------------ */
    /* Pre-renderizado del mapa con tilesets pixel art              */
    /* ------------------------------------------------------------ */
    zoneAt(tx, ty) { return this.sector.zone(tx, ty); }
    wallStyle(tx, ty) { return this.sector.wall(tx, ty); }
    render() {
      const A = HF.Assets;
      const rng = U.mulberry32(99);
      const c = U.makeCanvas(this.pw, this.ph);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const floors = A.atlas('floors');
      const fIdx = {};
      floors.names.forEach((n, i) => { fIdx[n] = i; });
      const drawFloor = (name, tx, ty) => {
        const i = fIdx[name] ?? 0;
        ctx.drawImage(floors.img, (i % floors.cols) * T, Math.floor(i / floors.cols) * T, T, T, tx * T, ty * T, T, T);
      };
      const pickW = (list) => { let s = 0; for (const [, w] of list) s += w; let r = rng() * s; for (const [n, w] of list) { r -= w; if (r <= 0) return n; } return list[0][0]; };
      const S = this.sector;
      const ZF = S.floors;
      const doorTiles = new Set();
      for (const d of this.doors) for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) doorTiles.add((d.y + j) * W + d.x + i);
      this.sparkSpots = [];

      // suelos por zona
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const z = this.zoneAt(x, y);
        let name = pickW(ZF[z]);
        const nearWall = this.tileAt(x - 1, y) === WALL || this.tileAt(x + 1, y) === WALL || this.tileAt(x, y - 1) === WALL || this.tileAt(x, y + 1) === WALL;
        if (nearWall && rng() < 0.35 && (S.id !== 's7' || z === 'hangar')) name = S.nearWall[Math.floor(rng() * S.nearWall.length)];
        if (x >= 35 && x <= 40 && y >= 25 && y <= 30) name = (x === 35 || x === 40 || y === 25 || y === 30) ? 'hazard' : 'tread';
        if (doorTiles.has(i)) name = 'track';
        if (S.id === 's7' && y === 31 && x >= 23 && x <= 34) name = 'cable_h';
        if (S.id === 's7' && (x === 12 || x === 64) && y >= 18 && y <= 37 && this.grid[i] === FLOOR) name = 'cable_v';
        if (this.inToxic(x * T + 16, y * T + 16)) name = S.poolFloor;
        if (name === 'damaged' && this.grid[i] === FLOOR) this.sparkSpots.push({ x: x * T + 17, y: y * T + 15 });
        drawFloor(name, x, y);
      }

      // charcos contaminados con bandas de color (sin degradados)
      for (const t of this.toxic) {
        for (let y = -t.r; y <= t.r; y += 2) for (let x = -t.r; x <= t.r; x += 2) {
          const a = Math.atan2(y, x);
          const edge = t.r * (0.8 + 0.12 * Math.sin(a * 5 + t.x) + 0.06 * Math.sin(a * 11));
          const d = Math.hypot(x, y);
          if (d > edge) continue;
          const k = d / edge;
          const bands = this.poolKind.bands;
          ctx.fillStyle = k > 0.85 ? bands[0] : k > 0.6 ? bands[1] : k > 0.3 ? bands[2] : bands[3];
          ctx.fillRect(Math.round(t.x + x), Math.round(t.y + y), 2, 2);
        }
        for (let n = 0; n < 14; n++) {
          const a = rng() * U.TAU, d = rng() * t.r * 0.6;
          ctx.fillStyle = this.poolKind.spark;
          ctx.fillRect(Math.round(t.x + Math.cos(a) * d), Math.round(t.y + Math.sin(a) * d), 2, 1);
        }
      }

      // sombras de contacto de las paredes sobre el suelo (bandas duras)
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (this.grid[y * W + x] !== FLOOR) continue;
        if (this.solidTile(x, y - 1)) ctx.fillRect(x * T, y * T, T, 5);
        if (this.solidTile(x - 1, y)) ctx.fillRect(x * T, y * T, 4, T);
      }

      // decoración de suelo (no colisiona)
      const deco = (id, x, y) => A.drawImage(ctx, 'prop_' + id, x, y);
      for (const [id, x, y] of this.stencils) deco(id, x, y);
      for (const [x, y, flip] of [[31, 27.5, 0], [45, 28.5, 1], [38, 23, 0], [38, 36, 1]]) {
        const s = A.image('prop_stencil_arrow');
        ctx.save(); ctx.translate(Math.round(x * T), Math.round(y * T)); ctx.scale(flip ? -1 : 1, 1); ctx.drawImage(s.img, -12, -7); ctx.restore();
      }
      for (const [id, x, y] of [['debris_a', 25, 12], ['debris_b', 50, 13], ['remains', 14, 25], ['debris_a', 60, 30], ['remains', 45, 43],
        ['debris_b', 31, 40], ['debris_a', 6, 36], ['remains', 69, 20], ['debris_b', 11, 50], ['debris_a', 66, 52]]) {
        if (this.grid[y * W + x] === FLOOR && !this.inToxic(x * T + 16, y * T + 16)) deco(id, x * T + 16, y * T + 16);
      }
      for (const v of this.spawnVents) A.drawImage(ctx, 'prop_spawn_vent', v.x, v.y);

      // paredes autoconectadas (máscara de vecinos abiertos)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (this.grid[y * W + x] !== WALL) continue;
        const open = (dx, dy) => {
          const X = x + dx, Y = y + dy;
          return X >= 0 && Y >= 0 && X < W && Y < H && this.grid[Y * W + X] !== WALL;
        };
        const mask = (open(0, -1) ? 1 : 0) | (open(1, 0) ? 2 : 0) | (open(0, 1) ? 4 : 0) | (open(-1, 0) ? 8 : 0);
        const at = A.atlas('walls_' + this.wallStyle(x, y));
        const v = (x * 7 + y * 3) % 5 === 0 ? 1 : 0;
        ctx.drawImage(at.img, mask * T, v * T, T, T, x * T, y * T, T, T);
      }
      // tuberías sobre los muros exteriores
      for (let x = 0; x < W; x++) {
        A.drawImage(ctx, 'prop_pipe_h', x * T + 16, 14);
        A.drawImage(ctx, 'prop_pipe_h', x * T + 16, this.ph - 16);
        if (x % 9 === 4) { A.drawImage(ctx, 'prop_valve', x * T + 16, 14); A.drawImage(ctx, 'prop_valve', x * T + 16, this.ph - 16); }
      }
      for (let y = 1; y < H - 1; y++) {
        A.drawImage(ctx, 'prop_pipe_v', 14, y * T + 16);
        A.drawImage(ctx, 'prop_pipe_v', this.pw - 16, y * T + 16);
      }
      // carcasas de puertas de seguridad
      for (const d of this.doors) {
        if (d.vertical) {
          for (let i = 0; i < 2; i++) { A.drawImage(ctx, 'prop_door_v', (d.x + i) * T + 16, (d.y - 1) * T + 16); A.drawImage(ctx, 'prop_door_v', (d.x + i) * T + 16, (d.y + d.h) * T + 16); }
        } else {
          for (let j = 0; j < 2; j++) { A.drawImage(ctx, 'prop_door_h', (d.x - 1) * T + 16, (d.y + j) * T + 16); A.drawImage(ctx, 'prop_door_h', (d.x + d.w) * T + 16, (d.y + j) * T + 16); }
        }
      }
      // señalización y pantallas en las caras de los muros
      this.wallScreens = [];
      this.steamSpots = [];
      let k = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (this.grid[y * W + x] !== WALL || this.grid[(y + 1) * W + x] === WALL) continue;
        if (this.grid[y * W + x - 1] !== WALL || this.grid[y * W + x + 1] !== WALL) continue;
        k++;
        const z = this.zoneAt(x, y + 1);
        if (k % 11 === 3) A.drawImage(ctx, z === 'storage' ? 'prop_sign_bio' : 'prop_sign_warn', x * T + 16, y * T + 25);
        else if (k % 11 === 7 && (z === 'control' || z === 'lab')) { A.drawImage(ctx, 'prop_wall_screen', x * T + 16, y * T + 25); this.wallScreens.push({ x: x * T + 9, y: y * T + 21 }); }
        else if (k % 13 === 9) this.steamSpots.push({ x: x * T + 16, y: y * T + 30 });
      }

      // sólidos: contenedores, cajas, pilares y consolas (con sombra proyectada)
      const shadow = (x, y, w, h) => { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(x + 4, y + 5, w, h); };
      for (const [x, y, w, h] of this.crateRects) {
        const id = w === 2 && h === 2 ? (S.props.crate2x2 || 'prop_container_2x2') : 'prop_' + (w === 2 ? 'container_2x1' : h === 2 ? 'container_1x2' : 'crate');
        shadow(x * T, y * T, w * T, h * T);
        A.drawImage(ctx, id, (x + w / 2) * T, (y + h / 2) * T);
      }
      for (const [x, y] of this.pillars) { shadow(x * T, y * T, 2 * T, 2 * T); A.drawImage(ctx, S.props.pillar || 'prop_pillar', (x + 1) * T, (y + 1) * T); }
      this.consoleScreens = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (this.grid[y * W + x] !== CONSOLE) continue;
        const dir = y <= 2 ? 's' : y >= H - 3 ? 'n' : x <= 2 ? 'e' : 'w';
        A.drawImage(ctx, 'prop_console_' + dir, x * T + 16, y * T + 16);
      }
      for (const g of this.generators) shadow(g.x - T, g.y - T, 2 * T, 2 * T);
      { const t = this.terminal; shadow(t.x - T, t.y - T, 2 * T, 2 * T); }
      this.base = c;
      this.canvas = U.makeCanvas(this.pw, this.ph);
      this.canvas.getContext('2d').drawImage(c, 0, 0);
    }

    /** Minimapa: un píxel por tile. */
    renderMini() {
      const c = U.makeCanvas(W, H);
      const x = c.getContext('2d');
      const img = x.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const t = this.grid[i];
        const col = t === FLOOR ? [22, 26, 32, 255] : t === WALL ? [80, 90, 104, 255] : t === TERMINAL ? [60, 255, 170, 255] : [60, 66, 76, 255];
        img.data.set(col, i * 4);
      }
      x.putImageData(img, 0, 0);
      this.mini = c;
    }

    clearDecals() { this.dctx.clearRect(0, 0, this.pw, this.ph); this.dctx.drawImage(this.base, 0, 0); }
    /** Mancha pixelada persistente (familias: crimson, violet, green, ash, energy, rust, oil). */
    splat(x, y, r, fam) {
      const id = 'decal_' + (HF.Assets.image('decal_' + fam) ? fam : 'crimson');
      const n = r > 30 ? 4 : r > 16 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * U.TAU, d = i ? Math.random() * r * 0.8 : 0;
        HF.Assets.drawImage(this.dctx, id, x + Math.cos(a) * d, y + Math.sin(a) * d, { variant: (Math.random() * 4) | 0 });
      }
    }
    scorch(x, y) {
      HF.Assets.drawImage(this.dctx, 'decal_scorch', x, y, { variant: (Math.random() * 2) | 0 });
    }

    /* ------------------------------------------------------------ */
    /* Navegación                                                     */
    /* ------------------------------------------------------------ */
    updateFlow(px, py) {
      const tx = U.clamp(Math.floor(px / T), 0, W - 1), ty = U.clamp(Math.floor(py / T), 0, H - 1);
      const start = ty * W + tx;
      if (start === this.flowTile) return;
      this.flowTile = start;
      const flow = this.flow, q = this.queue, g = this.grid;
      flow.fill(65535);
      let head = 0, tail = 0;
      flow[start] = 0;
      q[tail++] = start;
      while (head < tail) {
        const i = q[head++];
        const x = i % W, y = (i / W) | 0;
        const nd = flow[i] + 1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (g[ni] !== FLOOR || flow[ni] <= nd) continue;
          if (dx && dy && (g[y * W + nx] !== FLOOR || g[ny * W + x] !== FLOOR)) continue;
          flow[ni] = nd;
          q[tail++] = ni;
        }
      }
    }
    flowDist(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return 65535;
      return this.flow[ty * W + tx];
    }
    /** Devuelve el ángulo hacia la casilla vecina más cercana al jugador, o null. */
    flowDir(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      const g = this.grid, flow = this.flow;
      let best = 65535, bx = 0, by = 0;
      if (tx >= 0 && ty >= 0 && tx < W && ty < H) best = flow[ty * W + tx];
      if (best === 0) return null;
      let found = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (g[ni] !== FLOOR) continue;
        if (dx && dy && (this.solidTile(tx + dx, ty) || this.solidTile(tx, ty + dy))) continue;
        if (flow[ni] < best) { best = flow[ni]; bx = nx; by = ny; found = true; }
      }
      if (!found) return null;
      return Math.atan2(by * T + 16 - y, bx * T + 16 - x);
    }
    /** Línea de visión con muestreo cada 12 px. */
    los(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.ceil(d / 12);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
      }
      return true;
    }
    poolAt(x, y) {
      for (const t of this.toxic) if ((x - t.x) ** 2 + (y - t.y) ** 2 < (t.r * 0.85) ** 2) return t;
      return null;
    }
    inToxic(x, y) {
      for (const t of this.toxic) if ((x - t.x) ** 2 + (y - t.y) ** 2 < (t.r * 0.85) ** 2) return true;
      return false;
    }
  }

  GameMap.TILE = { FLOOR, WALL, CRATE, PILLAR, CONSOLE, GENERATOR, TERMINAL };
  HF.GameMap = GameMap;
})(window.HF);
