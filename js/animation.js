'use strict';
/*
 * Animator: estado de presentación de una entidad (hoja, animación, frame, tiempo).
 * Es puramente visual: la lógica de juego nunca depende de él.
 */
(function (HF) {
  class Animator {
    constructor() {
      this.sheet = null;
      this.anim = null;
      this.t = 0;
      this.frame = 0;
      this.done = false;
    }
    /** Cambia de animación (reinicia solo si cambia o si restart = true). */
    set(sheet, anim, restart) {
      if (sheet !== this.sheet || anim !== this.anim || restart) {
        this.sheet = sheet;
        this.anim = anim;
        this.t = 0;
        this.frame = 0;
        this.done = false;
      }
      return this;
    }
    info() {
      const s = HF.Assets.sheet(this.sheet);
      return s ? s.anims[this.anim] : null;
    }
    update(dt, speed = 1) {
      const a = this.info();
      if (!a) return;
      this.t += dt * speed;
      const f = Math.floor(this.t * a.fps);
      if (a.loop) this.frame = f % a.frames;
      else { this.frame = Math.min(f, a.frames - 1); this.done = f >= a.frames; }
    }
    /** Frame según progreso 0..1 (preparaciones y recargas sincronizadas con la lógica). */
    progress(p) {
      const a = this.info();
      if (!a) return;
      this.frame = Math.max(0, Math.min(a.frames - 1, Math.floor(p * a.frames)));
    }
    draw(ctx, dir, x, y, opts) {
      HF.Assets.draw(ctx, this.sheet, this.anim, this.frame, dir, x, y, opts);
    }
  }

  HF.Animator = Animator;
})(window.HF);
