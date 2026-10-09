'use strict';
/* SaveManager: guarda y lee el progreso en LocalStorage. */
(function (HF) {
  const KEY = 'hellfall_survival_save_v1';

  function defaults() {
    return {
      version: 1,
      best: { score: 0, wave: 0, time: 0, level: 0 },
      cores: 0,
      unlockedWeapons: ['pistol', 'shotgun', 'rifle'],
      meta: {},
      stats: {
        games: 0, kills: 0, time: 0, bosses: 0, bestCombo: 0, shots: 0,
        coresEarned: 0, coinsEarned: 0, damageDealt: 0, killsByType: {},
      },
      settings: {
        master: 0.8, music: 0.45, sfx: 0.8, musicOn: true, sfxOn: true,
        sensitivity: 1, pointerLock: false, quality: 'high', showFps: false,
        shake: true, damageNumbers: true, bindings: null,
      },
      achievements: {},
    };
  }

  function merge(base, src) {
    if (!src || typeof src !== 'object') return base;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        merge(base[k], v);
      } else if (v !== undefined) {
        base[k] = v;
      }
    }
    return base;
  }

  const SaveManager = {
    data: defaults(),
    available: true,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        this.data = merge(defaults(), raw ? JSON.parse(raw) : null);
      } catch (e) {
        this.available = false;
        this.data = defaults();
      }
      if (!this.data.unlockedWeapons.includes('pistol')) this.data.unlockedWeapons.unshift('pistol');
      return this.data;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        this.available = false;
      }
    },
    reset() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings; // se conserva la configuración
      this.save();
    },
    get settings() { return this.data.settings; },
  };

  HF.SaveManager = SaveManager;
})(window.HF);
