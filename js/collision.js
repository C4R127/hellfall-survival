'use strict';
/* Colisiones: círculo contra tiles y círculo contra círculo. */
(function (HF) {
  const U = HF.U;

  const Collision = {
    /** Empuja un círculo {x,y,r} fuera de los tiles sólidos. Devuelve true si chocó. */
    resolveCircleMap(e, map) {
      const T = map.T, r = e.r;
      let hit = false;
      for (let pass = 0; pass < 2; pass++) {
        const x0 = Math.floor((e.x - r) / T), x1 = Math.floor((e.x + r) / T);
        const y0 = Math.floor((e.y - r) / T), y1 = Math.floor((e.y + r) / T);
        for (let ty = y0; ty <= y1; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            if (!map.solidTile(tx, ty)) continue;
            const left = tx * T, top = ty * T;
            const cx = U.clamp(e.x, left, left + T), cy = U.clamp(e.y, top, top + T);
            const dx = e.x - cx, dy = e.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            hit = true;
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2), push = r - d;
              e.x += (dx / d) * push;
              e.y += (dy / d) * push;
            } else {
              // centro dentro del tile: salir por el lado más cercano
              const l = e.x - left, rr = left + T - e.x, t = e.y - top, b = top + T - e.y;
              const m = Math.min(l, rr, t, b);
              if (m === l) e.x = left - r; else if (m === rr) e.x = left + T + r;
              else if (m === t) e.y = top - r; else e.y = top + T + r;
            }
          }
        }
      }
      e.x = U.clamp(e.x, r, map.pw - r);
      e.y = U.clamp(e.y, r, map.ph - r);
      return hit;
    },

    circles(a, b, extra = 0) {
      const r = a.r + b.r + extra;
      return U.dist2(a.x, a.y, b.x, b.y) < r * r;
    },

    /** Separa dos círculos según su masa. */
    separate(a, b, ma = 1, mb = 1) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const r = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r || d2 < 1e-6) return false;
      const d = Math.sqrt(d2), o = r - d;
      const total = ma + mb;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * o * (mb / total);
      a.y -= ny * o * (mb / total);
      b.x += nx * o * (ma / total);
      b.y += ny * o * (ma / total);
      return true;
    },
  };

  HF.Collision = Collision;
})(window.HF);
