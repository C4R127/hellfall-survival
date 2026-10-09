'use strict';
/* Punto de entrada: carga el guardado, construye los recursos e inicia el bucle. */
(function (HF) {
  function boot() {
    HF.SaveManager.load();
    HF.Sprites.build();

    const canvas = document.getElementById('game');
    HF.Input.init(canvas);
    HF.Input.setBindings(HF.SaveManager.settings.bindings);

    const game = new HF.Game(canvas);
    HF.game = game;
    HF.UI.init(game);
    HF.UI.showMenu();

    // el audio solo puede arrancar tras un gesto del usuario
    const unlockAudio = () => {
      HF.Audio.init();
      HF.Audio.applySettings(HF.SaveManager.settings);
      if (game.state === 'menu') HF.Audio.playMusic('menu');
    };
    addEventListener('pointerdown', unlockAudio, { once: true });
    addEventListener('keydown', unlockAudio, { once: true });

    const loop = (t) => {
      try {
        game.frame(t);
      } catch (err) {
        console.error(err);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    document.getElementById('loading').classList.add('done');
    if (!HF.SaveManager.available) HF.UI.toast('LocalStorage no disponible: el progreso no se guardará', 'info');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.HF);
