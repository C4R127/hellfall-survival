'use strict';
/* Punto de entrada: carga el guardado y los assets (con progreso y errores visibles) e inicia el bucle. */
(function (HF) {
  const $ = (id) => document.getElementById(id);

  function showLoadErrors(errors) {
    const box = $('loading-errors');
    box.classList.remove('hidden');
    box.innerHTML = '<b>ERROR DE CARGA DE RECURSOS</b>' + errors.map((e) => `<div>${e}</div>`).join('') +
      '<div class="hint">Se usará un patrón de depuración magenta para los recursos que faltan.</div>';
  }

  async function boot() {
    HF.SaveManager.load();
    const bar = $('loading-bar'), pct = $('loading-pct');
    const ok = await HF.Assets.load((n, total) => {
      const f = n / total;
      bar.style.width = (f * 100).toFixed(0) + '%';
      pct.textContent = Math.round(f * 100) + '%';
    });
    if (!HF.Assets.manifest) {
      showLoadErrors(HF.Assets.errors);
      return; // sin manifiesto no hay arte: el juego no arranca a ciegas
    }
    HF.PixelFont.init();

    const canvas = $('game');
    HF.Input.init(canvas);
    HF.Input.setBindings(HF.SaveManager.settings.bindings);

    const game = new HF.Game(canvas);
    HF.game = game;
    HF.UI.init(game);
    HF.Story.init(game);
    HF.UI.showMenu();

    const unlockAudio = () => {
      HF.Audio.init();
      HF.Audio.applySettings(HF.SaveManager.settings);
      if (game.state === 'menu') HF.Audio.playMusic('menu');
    };
    addEventListener('pointerdown', unlockAudio, { once: true });
    addEventListener('keydown', unlockAudio, { once: true });

    let errors = 0;
    const loop = (t) => {
      try {
        game.frame(t);
      } catch (err) {
        if (errors++ < 5) console.error(err);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    if (!ok) {
      showLoadErrors(HF.Assets.errors);
      setTimeout(() => $('loading').classList.add('done'), 4000);
    } else {
      $('loading').classList.add('done');
    }
    if (!HF.SaveManager.available) HF.UI.toast('LocalStorage no disponible: el progreso no se guardará', 'info');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.HF);
