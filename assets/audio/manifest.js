/*
 * Manifiesto de audio opcional.
 * Por defecto todos los sonidos y la música se sintetizan en tiempo real (js/audio.js).
 * Para sustituir alguno por un archivo, coloca el archivo en esta carpeta y añade su ruta:
 *
 *   window.HF_AUDIO_MANIFEST = {
 *     shoot_pistol: 'assets/audio/pistol.ogg',
 *     explosion:    'assets/audio/explosion.ogg',
 *     music_menu:   'assets/audio/menu.ogg',
 *     music_combat: 'assets/audio/combat.ogg',
 *     music_boss:   'assets/audio/boss.ogg',
 *   };
 *
 * Nombres de efectos disponibles: shoot_pistol, shoot_shotgun, shoot_rifle, shoot_plasma,
 * shoot_launcher, shoot_tesla, explosion, hit, crit, enemyDie, hurt, pickup, coin, heal,
 * levelup, reload, reloadDone, empty, switch, waveStart, waveClear, boss, roar, ui, uiBack,
 * dash, shockwave, shield, power, spit, slam, fuse, summon, enemyShot, buy, deny,
 * achievement, death.
 */
window.HF_AUDIO_MANIFEST = {};
