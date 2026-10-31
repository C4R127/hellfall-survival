'use strict';
/*
 * AssetLoader: precarga los recursos de assets/manifest.js y ofrece funciones de dibujo
 * de hojas animadas (columna = dirección, fila = frame). Si un archivo no carga, se
 * registra el error, se muestra en la pantalla de carga y se usa un patrón de depuración
 * magenta claramente visible (nunca falla en silencio).
 */
(function (HF) {
  const TAU = Math.PI * 2;

  function debugPattern(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    const x = c.getContext('2d');
    for (let y = 0; y < c.height; y += 4) for (let i = 0; i < c.width; i += 4) {
      x.fillStyle = ((i + y) / 4) % 2 ? '#ff00ff' : '#000000';
      x.fillRect(i, y, 4, 4);
    }
    return c;
  }

  const Assets = {
    manifest: null,
    imgs: {},
    errors: [],
    loaded: 0,
    total: 0,
    scratch: null,
    sctx: null,

    load(onProgress) {
      const M = window.HF_ASSET_MANIFEST;
      if (!M) {
        this.errors.push('assets/manifest.js no encontrado. Ejecuta: node tools/build-assets.js');
        return Promise.resolve(false);
      }
      this.manifest = M;
      const jobs = new Map(); // ruta → [ancho, alto]
      for (const k in M.sheets) { const s = M.sheets[k]; jobs.set(s.path, [s.fw * s.dirs, s.fh]); }
      for (const k in M.images) jobs.set(M.images[k].path, [M.images[k].w, M.images[k].h]);
      for (const k in M.atlases) jobs.set(M.atlases[k].path, [512, 64]);
      jobs.set(M.font.fill, [512, 9]);
      jobs.set(M.font.shadow, [512, 9]);
      this.total = jobs.size;
      this.scratch = document.createElement('canvas');
      this.sctx = this.scratch.getContext('2d');
      return new Promise((resolve) => {
        let pending = jobs.size;
        const done = () => { this.loaded++; onProgress && onProgress(this.loaded, this.total); if (--pending === 0) resolve(this.errors.length === 0); };
        for (const [path, [w, h]] of jobs) {
          const im = new Image();
          im.onload = () => { this.imgs[path] = im; done(); };
          im.onerror = () => {
            this.errors.push('No se pudo cargar ' + path);
            console.error('[Assets] No se pudo cargar', path);
            this.imgs[path] = debugPattern(w, h);
            done();
          };
          im.src = path;
        }
      });
    },

    sheet(id) {
      const s = this.manifest && this.manifest.sheets[id];
      if (!s) return null;
      s.img = s.img || this.imgs[s.path];
      return s;
    },
    image(id) {
      const s = this.manifest && this.manifest.images[id];
      if (!s) return null;
      s.img = s.img || this.imgs[s.path];
      return s;
    },
    atlas(id) {
      const s = this.manifest && this.manifest.atlases[id];
      if (!s) return null;
      s.img = s.img || this.imgs[s.path];
      return s;
    },
    url(id) {
      const s = this.manifest && (this.manifest.images[id] || this.manifest.sheets[id]);
      return s ? s.path : '';
    },
    dirIndex(angle, dirs) {
      if (dirs <= 1) return 0;
      const k = Math.round(angle / (TAU / dirs));
      return ((k % dirs) + dirs) % dirs;
    },

    /** Dibuja un frame centrado en (x,y). opts: alpha, flash (0..1 silueta blanca), tint {color, a} */
    draw(ctx, id, anim, frame, dir, x, y, opts) {
      const s = this.sheet(id);
      if (!s) return;
      const a = s.anims[anim] || s.anims[Object.keys(s.anims)[0]];
      const f = Math.max(0, Math.min(a.frames - 1, frame | 0));
      const sx = (dir % s.dirs) * s.fw, sy = (a.row + f) * s.fh;
      const dx = Math.round(x - s.fw / 2), dy = Math.round(y - s.fh / 2);
      const alpha = opts && opts.alpha !== undefined ? opts.alpha : 1;
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(s.img, sx, sy, s.fw, s.fh, dx, dy, s.fw, s.fh);
      if (opts && opts.flash > 0) this.silhouette(ctx, s.img, sx, sy, s.fw, s.fh, dx, dy, '#ffffff', opts.flash * alpha);
      if (opts && opts.tint) this.silhouette(ctx, s.img, sx, sy, s.fw, s.fh, dx, dy, opts.tint.color, opts.tint.a * alpha);
      ctx.globalAlpha = 1;
    },
    silhouette(ctx, img, sx, sy, w, h, dx, dy, color, alpha) {
      const c = this.scratch, x = this.sctx;
      if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, w, h);
      x.drawImage(img, sx, sy, w, h, 0, 0, w, h);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, w, h);
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      ctx.drawImage(c, 0, 0, w, h, dx, dy, w, h);
      ctx.globalAlpha = ga;
    },
    /** Imagen simple centrada (o en esquina si corner=true). variant selecciona una celda horizontal. */
    drawImage(ctx, id, x, y, opts) {
      const s = this.image(id);
      if (!s) return;
      const vw = s.meta && s.meta.w ? s.meta.w : s.w;
      const v = opts && opts.variant ? opts.variant % Math.max(1, Math.floor(s.w / vw)) : 0;
      const dx = opts && opts.corner ? Math.round(x) : Math.round(x - vw / 2);
      const dy = opts && opts.corner ? Math.round(y) : Math.round(y - s.h / 2);
      if (opts && opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      ctx.drawImage(s.img, v * vw, 0, vw, s.h, dx, dy, vw, s.h);
      ctx.globalAlpha = 1;
    },
    /** Copia un frame a un canvas independiente (para menús: bestiario, arsenal). */
    frameCanvas(id, anim, frame, dir, scale = 1) {
      const s = this.sheet(id);
      const c = document.createElement('canvas');
      if (!s) return c;
      const a = s.anims[anim] || s.anims[Object.keys(s.anims)[0]];
      c.width = s.fw * scale; c.height = s.fh * scale;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(s.img, dir * s.fw, (a.row + frame) * s.fh, s.fw, s.fh, 0, 0, c.width, c.height);
      return c;
    },
  };

  HF.Assets = Assets;
})(window.HF);
