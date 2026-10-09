# Hellfall: Survival

Un survival shooter top-down 2D para el navegador, hecho con **HTML5 Canvas + JavaScript puro**.
No tiene dependencias, no necesita servidor de pago y no usa archivos de recursos externos:
los sprites pixel art, el mapa, los efectos de sonido y la música se generan por código.

> Una instalación experimental sufrió un accidente. El Sector 7 está sellado y lleno de criaturas.
> Sobrevive a las oleadas, consigue armas, mejora tu equipo y derrota a los jefes.

## Cómo jugar

**Opción 1 — abrir directamente:** haz doble clic en `index.html`. Funciona con `file://`
(todos los scripts son clásicos, sin módulos ES).

**Opción 2 — servidor local** (recomendado para recargar sin caché):

```bash
python -m http.server 8765
```

y abre `http://localhost:8765`.

### Controles (reasignables en Configuración → Controles)

| Acción | Tecla |
| --- | --- |
| Moverse | W A S D / flechas |
| Correr (gasta stamina) | Shift |
| Apuntar / Disparar | Ratón / clic izquierdo |
| Granada (ataque alternativo) | Clic derecho / G |
| Dash (invulnerable durante el impulso) | Espacio |
| Habilidad activa | Q |
| Recargar | R |
| Armas | 1–6, rueda del ratón, Z / X |
| Interactuar (terminal) | E |
| Iniciar / adelantar oleada | Enter |
| Pausa | Esc / P |

## Contenido

- **Bucle de oleadas** con dificultad creciente: más enemigos, más vida, daño y velocidad, élites,
  combinaciones temáticas y 6 patrones de aparición (frontal, lateral, circular, rodear, grupos, combinado).
  Los enemigos aparecen con aviso visual, lejos del jugador y nunca dentro de obstáculos.
- **6 armas**: Pistola PX-9 (inicial, munición infinita), Escopeta Rompecráneos, Rifle AR-77,
  Cañón de Plasma (perforante), Lanzacohetes (área) y Bobina Tesla (rayo encadenado que ralentiza).
  Cada una tiene daño, cadencia, alcance, precisión, cargador, munición máxima, recarga, retroceso,
  crítico y nivel de mejora (1–5). 5 tipos de munición.
- **6 enemigos** con IA por estados (IDLE, CHASE, ATTACK, HURT, SEARCH, DEATH) y navegación con
  flow field: Rastrero (básico), Acechador (rápido, salta), Coloso (tanque, golpe de área),
  Escupidor (a distancia), Hinchado (explosivo) e Invocador (invoca y protege a sus aliados).
- **2 jefes** con 4 fases cada uno (cada 10 oleadas, alternándose y escalando):
  Heraldo de la Brecha (ráfagas, embestidas, espirales, golpes de área) y Matriarca de la Colmena
  (crías, charcos de ácido, se entierra y reaparece).
- **Experiencia y niveles**: al subir de nivel eliges 1 de 3 mejoras (ofensivas, defensivas, movilidad,
  recursos y habilidades) con rarezas.
- **Habilidades**: Dash, Shockwave, Escudo, Overdrive y Berserk, con tiempos de recarga.
- **Drops**: vida, armadura, munición, monedas, energía, power-ups (daño x2, cadencia, invulnerabilidad,
  pulso nuclear) y cajas de armas.
- **Combo y puntuación**: multiplicador por eliminaciones seguidas (se pierde al recibir daño).
- **Terminal de preparación** cada 5 oleadas: curarte, armadura, munición, mejorar y comprar armas,
  módulos de mejora y cambiar de habilidad.
- **Progresión permanente** (LocalStorage): récords, núcleos, armas desbloqueadas, 7 mejoras
  permanentes, estadísticas, bestiario, 13 logros y configuración.
- **Mapa** industrial con salas, pasillos, coberturas, pilares, consolas, generadores, zonas contaminadas
  (dañan), barriles explosivos (reaparecen cada oleada) e iluminación dinámica con luces de emergencia.
- **Efectos**: fogonazos, casquillos, partículas, explosiones, rayos, manchas persistentes, números de
  daño, vibración de pantalla, linterna y luces de colores.
- **Audio** sintetizado con Web Audio: efectos para todo y música procedural (menú, combate, jefe).
- **Configuración**: volúmenes, música/efectos on/off, calidad gráfica (alta/media/baja), pantalla
  completa, FPS, vibración, números de daño, captura del ratón con sensibilidad y reasignación de teclas.

## Estructura

```text
hellfall-survival/
├── index.html
├── css/        style.css · menu.css · hud.css · animations.css
├── js/
│   ├── utils.js        matemáticas, Object Pool, Spatial Hash, Input reasignable
│   ├── saveManager.js  guardado en LocalStorage
│   ├── audio.js        efectos y música sintetizados (sustituibles por archivos)
│   ├── sprites.js      sprites pixel art procedurales
│   ├── map.js          mapa, pre-render, flow field y línea de visión
│   ├── collision.js    colisiones círculo/tile y círculo/círculo
│   ├── particle.js     partículas, textos, luces y rayos (pooling)
│   ├── projectile.js   proyectiles
│   ├── weapon.js       armas y munición
│   ├── player.js       jugador y habilidades
│   ├── enemy.js        enemigos e IA
│   ├── boss.js         jefes por fases
│   ├── waveManager.js  oleadas, dificultad y aparición
│   ├── item.js         objetos recogibles
│   ├── upgrade.js      mejoras, tienda, mejoras permanentes y logros
│   ├── ui.js           HUD, menús y pantallas
│   ├── game.js         bucle principal, combate, render e iluminación
│   └── main.js         arranque
└── assets/     carpetas para recursos opcionales (audio/manifest.js permite usar archivos)
```

### Ampliar el juego

- **Nueva arma**: añade una entrada en `WEAPONS` (`js/weapon.js`), su id en `WEAPON_ORDER` y un sprite `w_<id>` en `js/sprites.js`.
- **Nuevo enemigo**: añade una entrada en `ENEMIES` (`js/enemy.js`) con un `behavior` existente, un sprite con el mismo nombre y su peso en `WaveManager.config`.
- **Sonidos o música reales**: coloca los archivos en `assets/audio/` y regístralos en `assets/audio/manifest.js`.
- **Sprites reales**: `HF.Sprites.loadImage('crawler', 'assets/enemies/crawler.png')` sustituye un sprite procedural (orientado hacia la derecha).

## Rendimiento

Object pooling para enemigos, proyectiles, objetos y partículas; rejilla espacial para colisiones;
el mapa se pre-renderiza una vez; la iluminación se calcula a media resolución; la IA recalcula la
línea de visión con escalonado y el flow field solo cuando el jugador cambia de tile. La calidad
"Baja" desactiva la iluminación y reduce partículas.
