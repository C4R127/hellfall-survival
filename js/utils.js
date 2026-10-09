'use strict';
/* Utilidades compartidas: matemáticas, object pooling, spatial hash e input. */
window.HF = window.HF || {};

(function (HF) {
  const TAU = Math.PI * 2;

  const U = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    chance: (p) => Math.random() < p,
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    angleTo: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    angleDiff(a, b) {
      let d = (b - a) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      return d;
    },
    /** Suavizado exponencial independiente del framerate. */
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    weightedPick(list) {
      let total = 0;
      for (const it of list) total += it.w;
      let r = Math.random() * total;
      for (const it of list) { r -= it.w; if (r <= 0) return it; }
      return list[list.length - 1];
    },
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    fmtNum: (n) => Math.floor(n).toLocaleString('en-US'),
    fmtTime(sec) {
      sec = Math.max(0, Math.floor(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    mulberry32(seed) {
      return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    makeCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    },
  };
  HF.U = U;

  /** Object pool con lista libre: evita crear/destruir objetos en caliente. */
  class Pool {
    constructor(factory, size) {
      this.items = [];
      this.free = [];
      for (let i = 0; i < size; i++) {
        const o = factory();
        o.active = false;
        this.items.push(o);
        this.free.push(o);
      }
    }
    get() {
      const o = this.free.pop();
      if (!o) return null;
      o.active = true;
      return o;
    }
    release(o) {
      if (!o.active) return;
      o.active = false;
      this.free.push(o);
    }
    forEach(fn) {
      const it = this.items;
      for (let i = 0; i < it.length; i++) if (it[i].active) fn(it[i]);
    }
    clear() {
      for (const o of this.items) if (o.active) { o.active = false; this.free.push(o); }
    }
    get count() { return this.items.length - this.free.length; }
  }
  HF.Pool = Pool;

  /** Rejilla espacial para consultas de vecinos baratas (colisiones proyectil/enemigo). */
  class SpatialHash {
    constructor(cell) {
      this.cell = cell;
      this.map = new Map();
      this.used = [];
    }
    clear() {
      for (const a of this.used) a.length = 0;
      this.used.length = 0;
    }
    insert(o) {
      const k = ((o.x / this.cell) | 0) + ((o.y / this.cell) | 0) * 4096;
      let a = this.map.get(k);
      if (!a) { a = []; this.map.set(k, a); }
      if (a.length === 0) this.used.push(a);
      a.push(o);
    }
    query(x, y, r, out) {
      out.length = 0;
      const c = this.cell;
      const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
      const y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const a = this.map.get(cx + cy * 4096);
          if (a) for (let i = 0; i < a.length; i++) out.push(a[i]);
        }
      }
      return out;
    }
  }
  HF.SpatialHash = SpatialHash;

  /* ------------------------------------------------------------------ */
  /* Input con acciones reasignables                                      */
  /* ------------------------------------------------------------------ */
  const DEFAULT_BINDINGS = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    dash: ['Space'],
    interact: ['KeyE'],
    reload: ['KeyR'],
    ability: ['KeyQ'],
    grenade: ['KeyG'],
    ready: ['Enter'],
    pause: ['Escape', 'KeyP'],
    weapon1: ['Digit1'],
    weapon2: ['Digit2'],
    weapon3: ['Digit3'],
    weapon4: ['Digit4'],
    weapon5: ['Digit5'],
    weapon6: ['Digit6'],
    prevWeapon: ['KeyZ'],
    nextWeapon: ['KeyX'],
  };

  const ACTION_LABELS = {
    up: 'Mover arriba', down: 'Mover abajo', left: 'Mover izquierda', right: 'Mover derecha',
    sprint: 'Correr', dash: 'Dash', interact: 'Interactuar', reload: 'Recargar',
    ability: 'Habilidad', grenade: 'Granada (o clic derecho)', ready: 'Iniciar oleada', pause: 'Pausa',
    weapon1: 'Arma 1', weapon2: 'Arma 2', weapon3: 'Arma 3', weapon4: 'Arma 4', weapon5: 'Arma 5', weapon6: 'Arma 6',
    prevWeapon: 'Arma anterior', nextWeapon: 'Arma siguiente',
  };

  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

  const Input = {
    DEFAULT_BINDINGS,
    ACTION_LABELS,
    bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
    down: new Set(),
    pressedCodes: new Set(),
    mouse: { sx: 0, sy: 0, left: false, right: false, leftPressed: false, rightPressed: false },
    wheel: 0,
    pointerLock: false,
    sensitivity: 1,
    onRebind: null,
    canvas: null,

    init(canvas) {
      this.canvas = canvas;
      this.mouse.sx = innerWidth / 2;
      this.mouse.sy = innerHeight / 2;

      addEventListener('keydown', (e) => {
        if (this.onRebind) {
          e.preventDefault();
          const cb = this.onRebind;
          this.onRebind = null;
          cb(e.code === 'Escape' ? null : e.code);
          return;
        }
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT') return;
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressedCodes.add(e.code);
        this.down.add(e.code);
      });
      addEventListener('keyup', (e) => this.down.delete(e.code));
      addEventListener('blur', () => {
        this.down.clear();
        this.mouse.left = this.mouse.right = false;
      });

      addEventListener('mousemove', (e) => {
        if (this.pointerLock && document.pointerLockElement === canvas) {
          this.mouse.sx = U.clamp(this.mouse.sx + e.movementX * this.sensitivity, 0, innerWidth);
          this.mouse.sy = U.clamp(this.mouse.sy + e.movementY * this.sensitivity, 0, innerHeight);
        } else {
          this.mouse.sx = e.clientX;
          this.mouse.sy = e.clientY;
        }
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
        if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
        if (this.pointerLock && document.pointerLockElement !== canvas && HF.game && HF.game.state === 'playing') {
          canvas.requestPointerLock && canvas.requestPointerLock();
        }
      });
      addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.left = false;
        if (e.button === 2) this.mouse.right = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.wheel += Math.sign(e.deltaY);
      }, { passive: false });
    },

    setBindings(b) {
      this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
      if (b) for (const k in b) if (this.bindings[k] && Array.isArray(b[k])) this.bindings[k] = b[k].slice();
    },
    isDown(action) {
      const codes = this.bindings[action];
      if (!codes) return false;
      for (const c of codes) if (this.down.has(c)) return true;
      return false;
    },
    pressed(action) {
      const codes = this.bindings[action];
      if (!codes) return false;
      for (const c of codes) if (this.pressedCodes.has(c)) return true;
      return false;
    },
    endFrame() {
      this.pressedCodes.clear();
      this.mouse.leftPressed = false;
      this.mouse.rightPressed = false;
      this.wheel = 0;
    },
    codeLabel(code) {
      if (!code) return '—';
      const map = {
        ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espacio',
        ShiftLeft: 'Shift', ShiftRight: 'Shift Der.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl Der.',
        AltLeft: 'Alt', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Retroceso', CapsLock: 'Bloq Mayús',
      };
      if (map[code]) return map[code];
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
      return code;
    },
  };
  HF.Input = Input;
})(window.HF);
