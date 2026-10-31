# Hellfall: Survival

Un survival shooter top-down 2D para el navegador, hecho con **HTML5 Canvas + JavaScript puro**.
No tiene dependencias, no necesita servidor de pago y no usa archivos de recursos externos:
los sprites pixel art se generan con `tools/build-assets.js` (incluidos en `assets/`) y el audio se sintetiza en tiempo real.

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
- **4 sectores (niveles)** con mapa, tileset, iluminación, peligro ambiental, fauna y jefe propios. La partida empieza
  en el sector elegido y, al derrotar a su jefe (cada 10 oleadas), se evacúa al siguiente; los sectores se
  desbloquean al alcanzarlos:
  - **Sector 7 · Laboratorios de contención**: zonas contaminadas. Jefe: El Carcelero.
  - **Sector 9 · Fundición**: escoria fundida (mucho daño). Fauna: Artilleros. Jefe: La Forja Viviente.
  - **Sector 12 · Criogenia**: fugas criogénicas (ralentizan). Fauna: Espectros. Jefe: Arconte del Vacío.
  - **Sector 0 · La Brecha**: grietas dimensionales. Fauna: Parásitos y Espectros. Jefe: Núcleo de Ruptura.
- **9 enemigos** con IA por estados (IDLE, CHASE, ATTACK, HURT, SEARCH, DEATH), navegación con flow field y variante
  élite: Errante, Acechador (salta), Coloso (golpe de área), Tejedor (a distancia), Incinerador (explota),
  Guardián (invoca y protege), **Espectro** (se teletransporta junto a ti), **Artillero** (bombardeo de área
  telegrafiado desde lejos) y **Parásito** (enjambres rápidos y frágiles).
- **4 jefes** con 4 fases, paleta enfurecida y un **ataque final propio**:
  - **El Carcelero**: ráfagas, embestida con aturdimiento al chocar y **cadenas** que te arrastran hacia él.
  - **La Forja Viviente**: anillos de fuego con hueco, lluvia de escoria, martillazo y **marea de escoria** (los charcos crecen).
  - **Arconte del Vacío**: rayos telegrafiados, orbes rastreadores, teletransporte y **espejismos** (copias que disparan).
  - **Núcleo de Ruptura**: crías, zonas de ruptura, grietas y **colapso dimensional** (pozo gravitatorio).
  Su nivel sube en cada vuelta completa al complejo.
- **Historia**: introducción, transmisiones de radio durante el combate (Dra. Varga, Comandante Reyes y la Señal),
  16 registros de datos coleccionables que aparecen en el mapa, escenas al derrotar a cada jefe con su expediente
  y un final al vencer al Núcleo de Ruptura (después la partida continúa en modo infinito). Todo es saltable y
  se puede releer en **HISTORIA** (menú principal). Las transmisiones se pueden desactivar en Accesibilidad.
- **Experiencia y niveles**: al subir de nivel eliges 1 de 3 mejoras (ofensivas, defensivas, movilidad,
  recursos y habilidades) con rarezas.
- **Habilidades**: Dash, Shockwave, Escudo, Overdrive y Berserk, con tiempos de recarga.
- **Drops**: vida, armadura, munición, monedas, energía, power-ups (daño x2, cadencia, invulnerabilidad,
  pulso nuclear) y cajas de armas.
- **Combo y puntuación**: multiplicador por eliminaciones seguidas (se pierde al recibir daño).
- **Terminal de preparación** cada 5 oleadas: curarte, armadura, munición, mejorar y comprar armas,
  módulos de mejora y cambiar de habilidad.
- **Progresión permanente** (LocalStorage): récords, núcleos, armas desbloqueadas, 7 mejoras
  permanentes, estadísticas, bestiario, 18 logros y configuración.
- **Mapa** industrial con salas, pasillos, coberturas, pilares, consolas, generadores, zonas contaminadas
  (dañan), barriles explosivos (reaparecen cada oleada) e iluminación dinámica con luces de emergencia.
- **Efectos**: fogonazos, casquillos, partículas, explosiones, rayos, manchas persistentes, números de
  daño, vibración de pantalla, linterna y luces de colores.
- **Audio** sintetizado con Web Audio: efectos para todo y música procedural (menú, combate, jefe).
- **Configuración**: volúmenes, música/efectos on/off, iluminación, escalado de píxel (automático/entero/ajustado), pantalla
  completa, FPS, números de daño, captura del ratón con sensibilidad, reasignación de teclas y **accesibilidad**
  (intensidad de efectos, vibración, anticipación de cámara, reducir destellos y tamaño de la interfaz).

## Gráficos

Todo el arte es **pixel art original** generado por código para este proyecto (sin imágenes externas ni servicios
de pago). El generador `tools/build-assets.js` modela cada sprite con primitivas 3D simples, los sombrea con una
luz fija del mundo, cuantiza a la paleta del juego y exporta **PNG transparentes** a `assets/` junto con
`assets/manifest.json` (y `assets/manifest.js`, una copia que permite abrir el juego con `file://`).

```bash
node tools/build-assets.js
```

- El protagonista tiene piernas en 8 direcciones y torso con arma en 32 direcciones (una hoja por arma).
- 6 enemigos con variante élite y 2 jefes con paleta normal/enfurecida, en 8 direcciones.
- Proyectiles, fogonazos (16 direcciones), explosiones por capas, objetos, tilesets por zona, props, iconos, paneles 9-slice, fuente bitmap y logotipo.
- El mundo se dibuja en un canvas lógico (1 unidad = 1 píxel) escalado con vecino más cercano.

La dirección artística y la auditoría están en [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) y el informe de la renovación visual en [docs/VISUAL_REPORT.md](docs/VISUAL_REPORT.md).

## Estructura

```text
hellfall-survival/
├── index.html
├── css/        style.css · menu.css · hud.css · animations.css
├── js/
│   ├── utils.js        matemáticas, Object Pool, Spatial Hash, Input reasignable
│   ├── saveManager.js  guardado en LocalStorage
│   ├── audio.js        efectos y música sintetizados (sustituibles por archivos)
│   ├── assets.js       carga de assets con progreso, errores visibles y dibujo de hojas
│   ├── animation.js    Animator (estado visual separado de la lógica)
│   ├── pixelfont.js    fuente bitmap para el canvas
│   ├── sectors.js      sectores: distribución, peligros, fauna y jefe de cada nivel
│   ├── map.js          construcción del mapa de un sector, tilesets, flow field y línea de visión
│   ├── collision.js    colisiones círculo/tile y círculo/círculo
│   ├── particle.js     partículas pixeladas, animaciones de hoja, textos y rayos
│   ├── fx.js           efectos de alto nivel (fogonazos, impactos, explosiones…)
│   ├── projectile.js   proyectiles
│   ├── weapon.js       armas y munición
│   ├── player.js       jugador, habilidades y animación
│   ├── enemy.js        enemigos, IA y animación
│   ├── boss.js         jefes por fases
│   ├── waveManager.js  oleadas, dificultad y aparición
│   ├── item.js         objetos recogibles
│   ├── upgrade.js      mejoras, tienda, mejoras permanentes y logros
│   ├── story.js        historia: escenas, radio, registros y final
│   ├── ui.js           HUD, menús y pantallas
│   ├── game.js         bucle, combate, render pixel-perfect e iluminación
│   └── main.js         arranque
├── assets/     sprites/, tilesets/, ui/, audio/, manifest.json, manifest.js (generados)
├── tools/      build-assets.js + lib/ (PNG, rasterizador) + art/ (modelos) + preview/
└── docs/       ART_DIRECTION.md, VISUAL_REPORT.md
```

### Ampliar el juego

- **Nueva arma**: añade una entrada en `WEAPONS` (`js/weapon.js`), su id en `WEAPON_ORDER` y su modelo en `tools/art/player.js` (`WEAPONS`); ejecuta `node tools/build-assets.js`.
- **Nuevo enemigo**: añade una entrada en `ENEMIES` (`js/enemy.js`) con un `behavior` existente, su modelo en `tools/art/enemies.js` y su peso en `WaveManager.config`; regenera los assets.
- **Sonidos o música reales**: coloca los archivos en `assets/audio/` y regístralos en `assets/audio/manifest.js`.
- **Retocar el arte**: los scripts de `tools/preview/` generan hojas de contacto ampliadas para revisar sprites.

## Rendimiento

Object pooling para enemigos, proyectiles, objetos y partículas; rejilla espacial para colisiones; el mapa
se pre-renderiza una vez (las manchas se pintan sobre esa misma capa); las hojas de sprites se precargan
una sola vez; la iluminación se calcula a media resolución lógica; el destello de impacto usa un único canvas
auxiliar; se descartan las entidades fuera de cámara. La opción "Iluminación: desactivada" y la intensidad
de efectos baja reducen el coste en equipos modestos.
