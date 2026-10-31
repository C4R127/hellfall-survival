'use strict';
/* Fuente bitmap 5×7 con contorno, teñible por color (copias cacheadas, no por frame). */
(function (HF) {
  const PixelFont = {
    tinted: {},
    meta: null,
    map: null,

    init() {
      const M = HF.Assets.manifest;
      if (!M || !M.font) return;
      this.meta = M.font;
      this.map = {};
      [...M.font.chars].forEach((c, i) => { this.map[c] = i; });
    },
    fill(color) {
      if (this.tinted[color]) return this.tinted[color];
      const src = HF.Assets.imgs[this.meta.fill];
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      return (this.tinted[color] = c);
    },
    width(text, scale = 1) { return this.meta ? (text.length * this.meta.advance - 1) * scale : 0; },
    /** align: 'left' | 'center' | 'right'. (x,y) = esquina superior del texto (o centro si align center). */
    draw(ctx, text, x, y, color = '#ffffff', opts = {}) {
      if (!this.meta) return;
      const M = this.meta, s = opts.scale || 1;
      const str = String(text).toUpperCase();
      const w = this.width(str, s);
      let cx = Math.round(opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x) - s;
      const cy = Math.round(opts.vcenter ? y - (M.ch * s) / 2 : y) - s;
      const shadow = HF.Assets.imgs[M.shadow], fill = this.fill(color);
      if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      for (const ch of str) {
        const i = this.map[ch] ?? this.map[' '];
        if (opts.shadow !== false) ctx.drawImage(shadow, i * M.cw, 0, M.cw, M.ch, cx, cy, M.cw * s, M.ch * s);
        ctx.drawImage(fill, i * M.cw, 0, M.cw, M.ch, cx, cy, M.cw * s, M.ch * s);
        cx += M.advance * s;
      }
      ctx.globalAlpha = 1;
    },
  };

  HF.PixelFont = PixelFont;
})(window.HF);
