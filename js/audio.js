'use strict';
/*
 * AudioManager: efectos y música generados con Web Audio (sin archivos).
 * Para sustituir un sonido por un archivo real basta con añadirlo en
 * assets/audio/manifest.js (p. ej. shoot_pistol: 'assets/audio/pistol.ogg',
 * music_combat: 'assets/audio/combat.ogg'). Si existe entrada, se usa el archivo.
 */
(function (HF) {
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const A = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    noiseBuf: null,
    last: {},
    voices: 0,
    settings: { master: 0.8, music: 0.45, sfx: 0.8, musicOn: true, sfxOn: true },
    manifest: {},
    fileCache: {},
    musicEl: null,
    track: null,
    step: 0,
    nextTime: 0,
    timer: null,

    init() {
      this.manifest = window.HF_AUDIO_MANIFEST || {};
      if (this.ctx) { this.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(c.destination);
      this.master = c.createGain();
      this.master.connect(comp);
      this.musicGain = c.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain = c.createGain();
      this.sfxGain.connect(this.master);

      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.applySettings(this.settings);
      const t = this.track;
      this.track = null;
      if (t) this.playMusic(t);
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    applySettings(s) {
      Object.assign(this.settings, s);
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.settings.master, now, 0.05);
      this.musicGain.gain.setTargetAtTime(this.settings.musicOn ? this.settings.music * 0.55 : 0, now, 0.05);
      this.sfxGain.gain.setTargetAtTime(this.settings.sfxOn ? this.settings.sfx : 0, now, 0.05);
      if (this.musicEl) this.musicEl.volume = this.settings.musicOn ? this.settings.music * this.settings.master : 0;
    },

    /* ---------------- primitivas de síntesis ---------------- */
    osc(type, f0, f1, dur, vol, t0, dest, attack = 0.004) {
      const c = this.ctx;
      t0 = t0 || c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f0), t0);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(dest || this.sfxGain);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
      return o;
    },
    noise(dur, vol, ftype, f0, f1, t0, dest, q = 1) {
      const c = this.ctx;
      t0 = t0 || c.currentTime;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = ftype;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, t0);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f);
      f.connect(g);
      g.connect(dest || this.sfxGain);
      s.start(t0, Math.random() * 0.5);
      s.stop(t0 + dur + 0.02);
      return s;
    },

    /** Reproduce un efecto. opts: { vol, pitch } */
    play(name, opts) {
      if (!this.ctx || !this.settings.sfxOn) return;
      const now = this.ctx.currentTime;
      const gap = SFX_GAP[name] ?? 0.03;
      if (this.last[name] && now - this.last[name] < gap) return;
      if (this.voices > 28) return;
      this.last[name] = now;
      const vol = (opts && opts.vol) ?? 1;
      if (vol < 0.02) return;
      const file = this.manifest[name];
      if (file) { this.playFile(file, vol); return; }
      const fn = SFX[name];
      if (!fn) return;
      this.voices++;
      setTimeout(() => this.voices--, 250);
      fn(this, vol, (opts && opts.pitch) || 1, now);
    },
    playFile(url, vol) {
      let base = this.fileCache[url];
      if (!base) { base = new Audio(url); this.fileCache[url] = base; }
      const el = base.cloneNode();
      el.volume = Math.min(1, vol * this.settings.sfx * this.settings.master);
      el.play().catch(() => {});
    },

    /* ---------------- música procedural ---------------- */
    playMusic(name) {
      if (this.track === name) return;
      this.stopMusic();
      this.track = name;
      if (!this.ctx) return;
      const file = this.manifest['music_' + name];
      if (file) {
        this.musicEl = new Audio(file);
        this.musicEl.loop = true;
        this.applySettings({});
        this.musicEl.play().catch(() => {});
        return;
      }
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    },
    stopMusic() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (this.musicEl) { this.musicEl.pause(); this.musicEl = null; }
      this.track = null;
    },
    schedule() {
      const tr = TRACKS[this.track];
      if (!tr || !this.ctx) return;
      const stepDur = 60 / tr.bpm / 4;
      while (this.nextTime < this.ctx.currentTime + 0.15) {
        tr.step(this, this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    },
  };

  const SFX_GAP = { hit: 0.025, enemyDie: 0.04, coin: 0.04, shoot_rifle: 0.05, shoot_tesla: 0.06, step: 0.2, spit: 0.08 };

  const SFX = {
    shoot_pistol(a, v, p) {
      a.noise(0.09, 0.35 * v, 'highpass', 1400 * p, 600, 0);
      a.osc('square', 260 * p, 70, 0.07, 0.18 * v);
    },
    shoot_shotgun(a, v, p) {
      a.noise(0.32, 0.7 * v, 'lowpass', 2400 * p, 200, 0);
      a.osc('sine', 110 * p, 35, 0.22, 0.5 * v);
    },
    shoot_rifle(a, v, p) {
      a.noise(0.07, 0.32 * v, 'bandpass', 2200 * p, 900, 0, null, 0.8);
      a.osc('square', 330 * p, 110, 0.06, 0.14 * v);
    },
    shoot_plasma(a, v, p) {
      a.osc('sawtooth', 1100 * p, 180, 0.16, 0.16 * v);
      a.osc('sine', 600 * p, 1400, 0.08, 0.12 * v);
    },
    shoot_launcher(a, v, p) {
      a.noise(0.35, 0.5 * v, 'lowpass', 900 * p, 120, 0);
      a.osc('triangle', 180 * p, 50, 0.3, 0.35 * v);
    },
    shoot_tesla(a, v, p) {
      a.noise(0.1, 0.25 * v, 'bandpass', 3800 * p, 2000, 0, null, 4);
      a.osc('square', 90 * p, 140, 0.09, 0.08 * v);
    },
    explosion(a, v) {
      a.noise(0.8, 0.9 * v, 'lowpass', 1400, 60, 0);
      a.osc('sine', 95, 28, 0.6, 0.7 * v);
    },
    hit(a, v, p) { a.osc('square', 200 * p, 120, 0.04, 0.07 * v); },
    crit(a, v) { a.osc('square', 900, 1500, 0.06, 0.08 * v); },
    enemyDie(a, v, p) {
      a.noise(0.18, 0.25 * v, 'bandpass', 700 * p, 200, 0, null, 1.5);
      a.osc('sawtooth', 240 * p, 45, 0.18, 0.12 * v);
    },
    hurt(a, v) {
      a.osc('sawtooth', 190, 70, 0.22, 0.28 * v);
      a.noise(0.12, 0.25 * v, 'lowpass', 900, 200, 0);
    },
    pickup(a, v) { a.osc('sine', 620, 1240, 0.09, 0.2 * v); },
    coin(a, v) {
      const t = a.ctx.currentTime;
      a.osc('square', 988, 988, 0.06, 0.07 * v, t);
      a.osc('square', 1319, 1319, 0.12, 0.07 * v, t + 0.05);
    },
    heal(a, v) {
      const t = a.ctx.currentTime;
      [523, 659, 784].forEach((f, i) => a.osc('triangle', f, f, 0.14, 0.15 * v, t + i * 0.05));
    },
    levelup(a, v) {
      const t = a.ctx.currentTime;
      [440, 554, 659, 880, 1109].forEach((f, i) => a.osc('square', f, f, 0.18, 0.1 * v, t + i * 0.07));
    },
    reload(a, v) {
      const t = a.ctx.currentTime;
      a.noise(0.04, 0.3 * v, 'highpass', 2500, 2500, t);
      a.noise(0.05, 0.35 * v, 'highpass', 1800, 1800, t + 0.16);
    },
    reloadDone(a, v) { a.noise(0.05, 0.35 * v, 'bandpass', 1500, 1500, 0, null, 2); },
    empty(a, v) { a.osc('square', 1200, 1100, 0.03, 0.06 * v); },
    switch(a, v) { a.noise(0.06, 0.25 * v, 'highpass', 3000, 3000, 0); },
    waveStart(a, v) {
      const t = a.ctx.currentTime;
      for (let i = 0; i < 3; i++) a.osc('sawtooth', 420, 760, 0.38, 0.12 * v, t + i * 0.42, null, 0.05);
    },
    waveClear(a, v) {
      const t = a.ctx.currentTime;
      [392, 523, 659, 784].forEach((f, i) => a.osc('triangle', f, f, 0.3, 0.14 * v, t + i * 0.09));
    },
    boss(a, v) {
      const t = a.ctx.currentTime;
      a.osc('sawtooth', 70, 40, 1.6, 0.4 * v, t, null, 0.1);
      a.osc('sawtooth', 73, 38, 1.6, 0.3 * v, t, null, 0.1);
      a.noise(1.4, 0.4 * v, 'lowpass', 500, 80, t);
    },
    roar(a, v) {
      a.osc('sawtooth', 120, 50, 0.9, 0.35 * v, 0, null, 0.05);
      a.noise(0.8, 0.3 * v, 'bandpass', 600, 150, 0, null, 2);
    },
    ui(a, v) { a.osc('sine', 760, 760, 0.05, 0.12 * v); },
    uiBack(a, v) { a.osc('sine', 500, 380, 0.07, 0.12 * v); },
    dash(a, v) { a.noise(0.2, 0.3 * v, 'bandpass', 600, 3000, 0, null, 2); },
    shockwave(a, v) {
      a.osc('sine', 200, 40, 0.5, 0.5 * v);
      a.noise(0.5, 0.4 * v, 'lowpass', 2000, 100, 0);
    },
    shield(a, v) { a.osc('triangle', 300, 900, 0.4, 0.2 * v); },
    power(a, v) {
      const t = a.ctx.currentTime;
      a.osc('sawtooth', 220, 880, 0.35, 0.15 * v, t);
      a.osc('square', 330, 1320, 0.35, 0.08 * v, t + 0.05);
    },
    spit(a, v) { a.noise(0.15, 0.2 * v, 'bandpass', 900, 400, 0, null, 3); },
    slam(a, v) {
      a.osc('sine', 80, 30, 0.4, 0.5 * v);
      a.noise(0.3, 0.35 * v, 'lowpass', 600, 80, 0);
    },
    fuse(a, v) { a.osc('square', 880, 1760, 0.4, 0.06 * v); },
    summon(a, v) { a.osc('sine', 200, 600, 0.5, 0.15 * v); a.osc('sine', 203, 590, 0.5, 0.12 * v); },
    enemyShot(a, v) { a.osc('triangle', 500, 200, 0.12, 0.08 * v); },
    buy(a, v) {
      const t = a.ctx.currentTime;
      a.osc('square', 660, 660, 0.06, 0.08 * v, t);
      a.osc('square', 990, 990, 0.1, 0.08 * v, t + 0.06);
    },
    deny(a, v) { a.osc('square', 180, 140, 0.15, 0.1 * v); },
    achievement(a, v) {
      const t = a.ctx.currentTime;
      [659, 784, 988, 1319].forEach((f, i) => a.osc('triangle', f, f, 0.25, 0.12 * v, t + i * 0.08));
    },
    death(a, v) {
      a.osc('sawtooth', 300, 40, 1.4, 0.35 * v, 0, null, 0.02);
      a.noise(1.2, 0.35 * v, 'lowpass', 1200, 60, 0);
    },
  };

  /* ---- Instrumentos de la música ---- */
  function kick(a, t, v = 0.7) { a.osc('sine', 150, 38, 0.28, v, t, a.musicGain, 0.002); }
  function snare(a, t, v = 0.35) {
    a.noise(0.16, v, 'bandpass', 1800, 1200, t, a.musicGain, 0.7);
    a.osc('triangle', 210, 160, 0.08, v * 0.4, t, a.musicGain);
  }
  function hat(a, t, v = 0.08) { a.noise(0.035, v, 'highpass', 8000, 8000, t, a.musicGain); }
  function bass(a, t, m, dur, v = 0.22) {
    const c = a.ctx;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = midi(m);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(a.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function pad(a, t, notes, dur, v = 0.05) {
    const c = a.ctx;
    for (const m of notes) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        const f = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.value = midi(m);
        o.detune.value = det;
        f.type = 'lowpass';
        f.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(a.musicGain);
        o.start(t); o.stop(t + dur + 0.05);
      }
    }
  }
  function bell(a, t, m, v = 0.06) {
    a.osc('sine', midi(m), midi(m), 1.2, v, t, a.musicGain, 0.005);
    a.osc('sine', midi(m + 12) * 1.01, midi(m + 12), 0.6, v * 0.4, t, a.musicGain, 0.005);
  }

  const TRACKS = {
    menu: {
      bpm: 70,
      step(a, s, t, sd) {
        const bar = Math.floor(s / 16) % 4;
        const i = s % 16;
        const roots = [45, 41, 43, 40];
        const r = roots[bar];
        if (i === 0) {
          pad(a, t, [r, r + 3, r + 7], sd * 16, 0.035);
          bass(a, t, r - 12, sd * 14, 0.12);
        }
        if (i === 6 || i === 11 || (i === 14 && bar % 2)) bell(a, t, r + 24 + [0, 3, 7, 10][(s * 7) % 4], 0.03);
        if (i % 8 === 4) hat(a, t, 0.025);
      },
    },
    combat: {
      bpm: 128,
      step(a, s, t, sd) {
        const bar = Math.floor(s / 16) % 4;
        const i = s % 16;
        const roots = [33, 33, 29, 31];
        const r = roots[bar];
        if (i % 4 === 0) kick(a, t, 0.55);
        if (i === 4 || i === 12) snare(a, t, 0.25);
        if (i % 2 === 1) hat(a, t, 0.05);
        const pat = [0, 0, 12, 0, 0, 10, 0, 12, 0, 0, 12, 0, 7, 0, 10, 12];
        if (i % 2 === 0 || i === 7 || i === 15) bass(a, t, r + pat[i], sd * 1.6, 0.18);
        if (i === 0 && bar === 0) pad(a, t, [r + 24, r + 27, r + 31], sd * 32, 0.025);
      },
    },
    boss: {
      bpm: 150,
      step(a, s, t, sd) {
        const bar = Math.floor(s / 16) % 4;
        const i = s % 16;
        const roots = [33, 34, 33, 32];
        const r = roots[bar];
        if (i % 4 === 0 || i === 14) kick(a, t, 0.65);
        if (i === 4 || i === 12) snare(a, t, 0.32);
        hat(a, t, i % 2 ? 0.06 : 0.03);
        bass(a, t, r + (i % 4 === 3 ? 12 : 0), sd * 0.9, 0.2);
        if (i === 0) a.osc('sawtooth', midi(r + 36), midi(r + 35), sd * 6, 0.03, t, a.musicGain, 0.05);
      },
    },
  };

  HF.Audio = A;
})(window.HF);
