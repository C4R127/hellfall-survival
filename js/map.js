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
    constructor() {
      this.T = T; this.W = W; this.H = H;
      this.pw = W * T; this.ph = H * T;
      this.grid = new Uint8Array(W * H);
      this.floor = new Uint8Array(W * H);
      this.flow = new Uint16Array(W * H);
      this.queue = new Int32Array(W * H);
      this.flowTile = -1;
      this.spawnVents = [];
      this.lights = [];
      this.toxic = [];
      this.barrelSpots = [];
      this.screens = [];
      this.terminal = { x: 0, y: 0 };
      this.playerStart = { x: 0, y: 0 };
      this.generate();
      this.render();
      this.renderMini();
      this.decals = U.makeCanvas(this.pw, this.ph);
      this.dctx = this.decals.getContext('2d');
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
      const g = this.grid;
      const rng = U.mulberry32(7331);
      const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = t; };
      const rect = (x, y, w, h, t) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, t); };

      // borde
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, WALL);

      // salas de esquina (paredes de 2 tiles con puertas de 4)
      const room = (vx, hy, y0, y1, x0, x1, doorY, doorX) => {
        rect(vx, y0, 2, y1 - y0 + 1, WALL);
        rect(x0, hy, x1 - x0 + 1, 2, WALL);
        rect(vx, doorY, 2, 4, FLOOR);
        rect(doorX, hy, 4, 2, FLOOR);
      };
      room(20, 16, 2, 17, 2, 21, 7, 9);      // NO
      room(54, 16, 2, 17, 54, 73, 7, 63);    // NE
      room(20, 38, 38, 53, 2, 21, 44, 9);    // SO
      room(54, 38, 38, 53, 54, 73, 44, 63);  // SE

      // muros cortos de los laterales
      rect(8, 24, 2, 8, WALL);
      rect(66, 24, 2, 8, WALL);
      // búnkeres norte y sur con abertura central
      rect(29, 8, 7, 2, WALL); rect(40, 8, 7, 2, WALL);
      rect(29, 46, 7, 2, WALL); rect(40, 46, 7, 2, WALL);

      // pilares centrales
      for (const [x, y] of [[28, 20], [46, 20], [28, 34], [46, 34]]) rect(x, y, 2, 2, PILLAR);
      // terminal de preparación
      rect(37, 27, 2, 2, TERMINAL);
      this.terminal = { x: 38 * T, y: 28 * T };
      this.playerStart = { x: 38 * T, y: 31.5 * T };

      // coberturas (cajas)
      const crates = [
        [13, 20, 2, 2], [61, 20, 2, 2], [13, 34, 2, 2], [61, 34, 2, 2],
        [33, 15, 2, 1], [41, 15, 2, 1], [33, 40, 2, 1], [41, 40, 2, 1],
        [6, 5, 1, 2], [14, 11, 2, 1], [69, 5, 1, 2], [60, 11, 2, 1],
        [6, 48, 1, 2], [14, 43, 2, 1], [69, 48, 1, 2], [60, 43, 2, 1],
        [24, 27, 1, 2], [51, 27, 1, 2],
      ];
      for (const [x, y, w, h] of crates) rect(x, y, w, h, CRATE);

      // generadores y consolas
      rect(16, 4, 2, 2, GENERATOR);
      rect(57, 49, 2, 2, GENERATOR);
      rect(59, 2, 4, 1, CONSOLE);
      rect(13, 53, 4, 1, CONSOLE);
      rect(2, 30, 1, 3, CONSOLE);
      rect(73, 22, 1, 3, CONSOLE);
      this.screens = [
        ...[59, 60, 61, 62].map((x) => ({ x: x * T + 16, y: 2 * T + 10 })),
        ...[13, 14, 15, 16].map((x) => ({ x: x * T + 16, y: 53 * T + 22 })),
        ...[30, 31, 32].map((y) => ({ x: 2 * T + 10, y: y * T + 16 })),
        ...[22, 23, 24].map((y) => ({ x: 73 * T + 22, y: y * T + 16 })),
      ];

      // tipos de suelo
      const f = this.floor;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let t = 0;
        const r = rng();
        if (r < 0.06) t = 2; else if (r < 0.1) t = 3;
        // rejillas junto a las paredes
        if (this.solidTile(x - 1, y) || this.solidTile(x + 1, y) || this.solidTile(x, y - 1) || this.solidTile(x, y + 1)) {
          if (rng() < 0.35) t = 1;
        }
        // franjas de peligro alrededor del terminal
        if (x >= 35 && x <= 40 && y >= 25 && y <= 30) t = 4;
        f[i] = t;
      }

      // ventilaciones de spawn
      const vents = [
        [4, 4], [17, 13], [71, 4], [57, 13], [4, 51], [17, 41], [71, 51], [57, 41],
        [3, 21], [72, 21], [3, 35], [72, 35], [38, 3], [38, 52], [25, 4], [51, 51],
      ];
      this.spawnVents = vents
        .filter(([x, y]) => !this.solidTile(x, y))
        .map(([x, y]) => ({ x: x * T + 16, y: y * T + 16, tx: x, ty: y }));

      // luces
      const L = this.lights;
      const red = (x, y) => L.push({ x: x * T, y: y * T, r: 190, color: '255,40,30', a: 0.55, rot: true, phase: rng() * 6 });
      const white = (x, y, r = 260) => L.push({ x: x * T, y: y * T, r, color: '170,200,255', a: 0.32, flicker: rng() < 0.3, phase: rng() * 6 });
      const green = (x, y, r = 140) => L.push({ x: x * T, y: y * T, r, color: '120,255,90', a: 0.4, pulse: true, phase: rng() * 6 });
      red(21, 9); red(55, 9); red(21, 46); red(55, 46); red(11, 17); red(65, 17); red(11, 39); red(65, 39);
      red(38, 9); red(38, 47);
      white(11, 9); white(65, 9); white(11, 46); white(65, 46);
      white(30, 24, 220); white(46, 24, 220); white(30, 32, 220); white(46, 32, 220); white(38, 18); white(38, 38);
      white(5, 28, 200); white(71, 28, 200);
      L.push({ x: 38 * T, y: 28 * T, r: 170, color: '60,255,170', a: 0.45, pulse: true, phase: 0 });
      L.push({ x: 17 * T, y: 5 * T, r: 150, color: '255,200,60', a: 0.45, pulse: true, phase: 1 });
      L.push({ x: 58 * T, y: 50 * T, r: 150, color: '255,200,60', a: 0.45, pulse: true, phase: 2 });

      // zonas contaminadas
      this.toxic = [
        { x: 11 * T, y: 47 * T, r: 78 },
        { x: 64 * T, y: 9 * T, r: 66 },
        { x: 38 * T, y: 5.5 * T, r: 50 },
      ];
      for (const t of this.toxic) green(t.x / T, t.y / T, t.r * 2.1);

      this.barrelSpots = [
        [24, 22], [52, 22], [24, 34], [52, 34], [10, 9], [66, 46], [38, 13], [38, 43], [5, 25], [71, 31],
      ].map(([x, y]) => ({ x: x * T + 16, y: y * T + 16 }));
    }

    /* ------------------------------------------------------------ */
    /* Pre-renderizado del mapa                                       */
    /* ------------------------------------------------------------ */
    render() {
      const PA = HF.Sprites.PixelArt;
      const rng = U.mulberry32(99);
      const tex = (fn) => { const p = new PA(16, 16); fn(p); return p.toCanvas(2, { outline: null, shade: false }); };

      const floorPlate = (variant) => tex((p) => {
        p.rect(0, 0, 16, 16, variant ? '#1b1f25' : '#1e2229');
        for (let i = 0; i < 10; i++) p.set(rng() * 16, rng() * 16, '#23282f');
        p.rect(0, 0, 16, 1, '#14171c'); p.rect(0, 0, 1, 16, '#14171c');
        p.rect(0, 15, 16, 1, '#262b33'); p.rect(15, 0, 1, 16, '#262b33');
        p.set(2, 2, '#2e343d'); p.set(13, 2, '#2e343d'); p.set(2, 13, '#2e343d'); p.set(13, 13, '#2e343d');
      });
      const floorGrate = tex((p) => {
        p.rect(0, 0, 16, 16, '#121418');
        for (let i = 1; i < 16; i += 3) { p.rect(i, 0, 1, 16, '#22272e'); }
        p.rect(0, 0, 16, 1, '#2a3038'); p.rect(0, 15, 16, 1, '#0c0e11');
      });
      const floorDamaged = tex((p) => {
        p.rect(0, 0, 16, 16, '#1d2026');
        p.line(2, 3, 7, 8, '#101216'); p.line(7, 8, 6, 14, '#101216'); p.line(7, 8, 13, 9, '#101216');
        p.rect(9, 2, 4, 3, '#3a2a1e'); p.set(10, 5, '#3a2a1e'); p.set(4, 11, '#33261b');
        p.rect(0, 0, 16, 1, '#14171c'); p.rect(0, 0, 1, 16, '#14171c');
      });
      const floorStain = tex((p) => {
        p.rect(0, 0, 16, 16, '#1e2229');
        p.disc(8, 8, 5, '#191c20'); p.disc(7, 9, 3, '#16181c');
        p.rect(0, 0, 16, 1, '#14171c'); p.rect(0, 0, 1, 16, '#14171c');
      });
      const hazard = tex((p) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, ((x + y) >> 2) % 2 ? '#7a6418' : '#16161a');
      });
      const floors = [[floorPlate(0), floorPlate(1)], [floorGrate], [floorDamaged], [floorStain], [hazard]];

      const c = U.makeCanvas(this.pw, this.ph);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const set = floors[this.floor[y * W + x]];
        ctx.drawImage(set[(x * 7 + y * 13) % set.length], x * T, y * T);
      }

      // zonas contaminadas (base)
      for (const t of this.toxic) {
        const gr = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, t.r);
        gr.addColorStop(0, 'rgba(110,200,40,0.85)');
        gr.addColorStop(0.7, 'rgba(70,140,20,0.6)');
        gr.addColorStop(1, 'rgba(40,80,10,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const a = (i / 20) * U.TAU;
          const rr = t.r * (0.85 + rng() * 0.2);
          const px = t.x + Math.cos(a) * rr, py = t.y + Math.sin(a) * rr;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.fill();
      }

      // rejillas de spawn
      for (const v of this.spawnVents) {
        ctx.fillStyle = '#0a0b0d';
        ctx.fillRect(v.x - 20, v.y - 20, 40, 40);
        ctx.fillStyle = '#3a1416';
        for (let i = -16; i <= 12; i += 6) ctx.fillRect(v.x - 16, v.y + i, 32, 3);
        ctx.strokeStyle = '#5a2226';
        ctx.lineWidth = 2;
        ctx.strokeRect(v.x - 19, v.y - 19, 38, 38);
      }

      // tuberías decorativas sobre el suelo junto al borde
      ctx.fillStyle = '#2a3038';
      ctx.fillRect(2 * T, 2 * T + 2, 18 * T, 8);
      ctx.fillRect(56 * T, H * T - 2 * T - 10, 18 * T, 8);
      ctx.fillStyle = '#3a424c';
      ctx.fillRect(2 * T, 2 * T + 2, 18 * T, 2);
      ctx.fillRect(56 * T, H * T - 2 * T - 10, 18 * T, 2);
      for (let x = 2 * T; x < 20 * T; x += 48) { ctx.fillStyle = '#1a1e24'; ctx.fillRect(x, 2 * T, 6, 12); }

      // sólidos
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = this.grid[y * W + x];
        if (t === FLOOR) continue;
        const px = x * T, py = y * T;
        if (t === WALL) this.drawWall(ctx, x, y, px, py);
        else if (t === CRATE) this.drawCrate(ctx, px, py, rng);
        else if (t === PILLAR) this.drawPillar(ctx, px, py, x, y);
        else if (t === CONSOLE) this.drawConsole(ctx, px, py);
        else if (t === GENERATOR) this.drawGenerator(ctx, px, py, x, y);
        else if (t === TERMINAL) this.drawTerminal(ctx, px, py, x, y);
      }
      this.canvas = c;
    }

    drawWall(ctx, x, y, px, py) {
      const s = (dx, dy) => this.tileAt(x + dx, y + dy) === WALL;
      ctx.fillStyle = '#2a2f37';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#323843';
      ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
      ctx.fillStyle = '#262b32';
      if ((x + y) % 3 === 0) ctx.fillRect(px + 8, py + 14, 16, 4);
      // caras y bordes
      if (!s(0, 1)) { // cara frontal
        ctx.fillStyle = '#15181d'; ctx.fillRect(px, py + T - 10, T, 10);
        ctx.fillStyle = (x % 4 < 2) ? '#8a6e18' : '#1a1a1e'; ctx.fillRect(px, py + T - 10, T, 3);
      }
      if (!s(0, -1)) { ctx.fillStyle = '#4b5462'; ctx.fillRect(px, py, T, 3); }
      if (!s(-1, 0)) { ctx.fillStyle = '#3e4652'; ctx.fillRect(px, py, 3, T); }
      if (!s(1, 0)) { ctx.fillStyle = '#1b1f25'; ctx.fillRect(px + T - 3, py, 3, T); }
    }
    drawCrate(ctx, px, py, rng) {
      ctx.fillStyle = '#0c0d10'; ctx.fillRect(px + 3, py + 5, T, T);
      ctx.fillStyle = '#4a3b2a'; ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
      ctx.strokeStyle = '#6a5438'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + T - 4, py + T - 4);
      ctx.moveTo(px + T - 4, py + 4); ctx.lineTo(px + 4, py + T - 4); ctx.stroke();
      ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, T - 4, T - 4);
      if (rng() < 0.5) { ctx.fillStyle = '#c99a20'; ctx.fillRect(px + 10, py + 13, 12, 6); }
    }
    drawPillar(ctx, px, py, x, y) {
      ctx.fillStyle = '#0c0d10'; ctx.fillRect(px + 4, py + 6, T, T);
      ctx.fillStyle = '#3a4048'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#4a525c'; ctx.fillRect(px + 2, py + 2, T - 4, 4);
      ctx.fillStyle = (x + y) % 2 ? '#c9a020' : '#16161a'; ctx.fillRect(px, py + 22, T, 5);
    }
    drawConsole(ctx, px, py) {
      ctx.fillStyle = '#1a1f26'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#0d1a16'; ctx.fillRect(px + 4, py + 4, T - 8, T - 12);
      ctx.fillStyle = '#1aff9a'; ctx.globalAlpha = 0.55;
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6, py + 7 + i * 5, 6 + ((px + i * 7) % 14), 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2c3440'; ctx.fillRect(px + 2, py + T - 6, T - 4, 4);
    }
    drawGenerator(ctx, px, py, x, y) {
      ctx.fillStyle = '#26221a'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = ((x + y) % 2) ? '#c9a020' : '#1a1a1a'; ctx.fillRect(px + 2, py + 2, T - 4, 5);
      ctx.fillStyle = '#5a4a20'; ctx.fillRect(px + 8, py + 10, 16, 16);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(px + 13, py + 14, 6, 8);
    }
    drawTerminal(ctx, px, py, x, y) {
      ctx.fillStyle = '#0b0d10'; ctx.fillRect(px + 2, py + 4, T, T);
      ctx.fillStyle = '#1e252e'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#2a333e'; ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      const lx = x - 37, ly = y - 27;
      if (ly === 0) {
        ctx.fillStyle = '#062a1e'; ctx.fillRect(px + (lx ? 0 : 8), py + 8, T - 8, T - 8);
        ctx.fillStyle = '#3affaa';
        ctx.fillRect(px + (lx ? 2 : 10), py + 12, 14, 2);
        ctx.fillRect(px + (lx ? 2 : 10), py + 18, 9, 2);
      } else {
        ctx.fillStyle = '#3a4450';
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 6, py + 6, 4, 4);
        ctx.fillStyle = '#ff5a3a'; ctx.fillRect(px + 6, py + 16, 4, 4);
      }
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

    clearDecals() { this.dctx.clearRect(0, 0, this.pw, this.ph); }
    splat(x, y, r, color) {
      const d = this.dctx;
      d.fillStyle = color;
      d.globalAlpha = 0.55;
      const n = 3 + ((r / 4) | 0);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * U.TAU, dd = Math.random() * r;
        const s = 2 + Math.random() * r * 0.45;
        d.fillRect(Math.round((x + Math.cos(a) * dd) / 2) * 2, Math.round((y + Math.sin(a) * dd) / 2) * 2, s, s);
      }
      d.globalAlpha = 1;
    }
    scorch(x, y, r) {
      const d = this.dctx;
      const g = d.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(x, y, r, 0, U.TAU); d.fill();
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
    inToxic(x, y) {
      for (const t of this.toxic) if ((x - t.x) ** 2 + (y - t.y) ** 2 < (t.r * 0.85) ** 2) return true;
      return false;
    }
  }

  GameMap.TILE = { FLOOR, WALL, CRATE, PILLAR, CONSOLE, GENERATOR, TERMINAL };
  HF.GameMap = GameMap;
})(window.HF);
