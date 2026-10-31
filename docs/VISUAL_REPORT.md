# Informe de la renovación visual — Hellfall: Survival

## Resumen

Todo el aspecto visual se ha sustituido por pixel art original y coherente, integrado en el código existente sin
cambiar las reglas de juego. Los recursos se generan con `node tools/build-assets.js` (Node, sin dependencias):
**211 PNG transparentes (≈2,6 MB)**, 71 hojas animadas y 134 imágenes, todas registradas en `assets/manifest.json`.
El manifiesto se valida al generarlo: si una ruta registrada no existe en disco, la generación falla.

## Recursos creados

| Categoría | Contenido | Archivos |
| --- | --- | --- |
| Protagonista | Piernas 8 dir. (idle, walk ×6, run ×6); torso + arma 32 dir. por arma (idle ×2, disparo ×2, recarga ×4, daño); muerte 8 dir. ×8 | `assets/sprites/player/` |
| Enemigos | Errante, Acechador, Coloso, Tejedor, Incinerador, Guardián + variante élite (×1,25, placas óseas y energía dorada). 8 dir.; idle, movimiento, preparación, ataque, daño y muerte | `assets/sprites/enemies/<nombre>/` |
| Jefes | El Carcelero y Núcleo de Ruptura, 112 px, 8 dir., paleta normal y enfurecida (fases 3–4); idle, movimiento, preparación, ataque, daño, muerte y desplazamiento dimensional | `assets/sprites/bosses/` |
| Proyectiles | Trazador, trazador crítico, perdigón, plasma, cohete (16 dir.), granada, glóbulo tóxico, orbe, astilla y anillo de ruptura: formas distintas además de colores | `assets/sprites/projectiles/` |
| Efectos | Fogonazos por arma (16 dir.), impacto, golpe, crítico, impacto de energía, explosión de 10 capas/frames, explosión de energía, humo, vapor, chispa, rayo, subida de nivel, escudo, portales (rojo/élite/violeta) | `assets/sprites/effects/` |
| Suelo | Manchas por familia de criatura (4 variantes), quemaduras y sombras de contacto | `assets/sprites/effects/decals/`, `shadow_*.png` |
| Recogibles | Botiquín, botiquín grande, armadura, 5 municiones, chip-moneda, cristal de energía, 4 power-ups, caja de armas y barril explosivo (todos con brillo animado) | `assets/sprites/pickups/` |
| Escenario | 23 suelos (hangar, laboratorio, control, hormigón, energía, rejillas, cables, peligro, carril de puerta, dañado, contaminado); paredes autoconectadas en 3 estilos (16 máscaras × 2 variantes) | `assets/tilesets/` |
| Props | Contenedores (3 tamaños), caja, pilar, consolas (4 orientaciones), generador (2 fases), terminal (inactiva/activa), rejilla de aparición, tuberías, válvula, carcasas de puerta, escombros, restos, balizas (4 fases), señales, pantalla mural, señalización pintada | `assets/sprites/props/`, `assets/tilesets/industrial|doors/` |
| Interfaz | Paneles 9-slice (normal, alerta, inset, cartas por rareza), botones (5 estados), rellenos de barra, 60 iconos, arte de armas, logotipo y fuente bitmap 5×7 con contorno | `assets/ui/` |

## Archivos modificados o nuevos

- **Nuevos**: `tools/` (generador, rasterizador, encoder PNG y modelos), `js/assets.js`, `js/animation.js`,
  `js/pixelfont.js`, `js/fx.js`, `docs/ART_DIRECTION.md` y este informe.
- **Eliminado**: `js/sprites.js` (los antiguos sprites procedurales girados).
- **Reescritos** (presentación): `js/particle.js`, `js/ui.js`, `js/main.js`, `index.html`, `css/*.css`.
- **Modificados solo en su parte visual**: `js/game.js` (canvas lógico pixel-perfect, iluminación por bandas,
  marco de daño, retícula, render), `js/map.js` (render con tilesets y zonas; la generación y la navegación no
  cambian), `js/player.js`, `js/enemy.js`, `js/boss.js`, `js/projectile.js`, `js/item.js` y `js/weapon.js`
  (`render`/`animate` y llamadas a `HF.FX`), `js/saveManager.js` (nuevas opciones).
- **Cambios mínimos fuera del render**, todos sin efecto en el juego:
  - Duración de la animación de muerte de los enemigos (0,22 → 0,45 s). El enemigo ya no está vivo y no cuenta para la oleada.
  - Temporizadores visuales `attackVis` y `shootT`.
  - Tipo visual `rift` para los disparos del Núcleo de Ruptura.
  - Nombres visibles renovados. Los identificadores internos no cambian, para conservar el guardado.

## Pruebas realizadas

- **Generación**: `node tools/build-assets.js` termina sin errores y verifica que todas las rutas del manifiesto existen.
- **Sintaxis**: `node --check` sobre todos los scripts.
- **Ejecución real** en el navegador (servidor local), revisando capturas ampliadas del canvas lógico:
  - Menú, HUD, subida de nivel, tienda, pausa, Game Over, arsenal, estadísticas (con bestiario) y configuración.
  - Protagonista con las 6 armas, los 6 enemigos y sus élites, los 2 jefes, todos los proyectiles, la explosión por capas y la animación de muerte.
- **Regresión jugable automatizada**: un bot jugó desde la oleada 1 hasta la 15 renderizando periódicamente, con armas, habilidades, granadas, dash, tienda, subidas de nivel, el Carcelero y el Núcleo de Ruptura en sus 4 fases. No hubo **ningún error**, y también salieron bien la muerte, el Game Over y los logros.
- **Opciones**: calidad baja con efectos al mínimo, reducción de destellos, escalado entero, ajustado y automático, y tamaño de interfaz. Todo sin errores.
- **Errores de carga**: al ocultar un PNG, la pantalla de carga lo lista, la consola lo registra y el juego usa el patrón magenta de depuración.
- **Rendimiento**: unos 8 ms por frame (update + render) con ~40 enemigos a 1000 × 563 lógicos. Se detectó y corrigió un cuello de botella: el marco de daño pasó de 86 ms a un blit cacheado.

## Pendiente o limitaciones conocidas

- **Arte generado por código, no pintado a mano**: el arte es original y coherente porque sale del mismo rasterizador, la misma luz y la misma paleta, pero no tiene el acabado de un artista retocando cada frame. Los modelos de `tools/art/` están pensados para iterar o para reemplazarse por PNG pintados manteniendo el manifiesto.
- **Puntería del torso**: el torso usa 32 direcciones (11,25°). El arma dibujada puede desviarse hasta ~5,6° del cursor; las balas salen siempre del ángulo real.
- **Escalado automático no entero**: en pantallas cuyo factor entero daría una vista demasiado amplia o estrecha (p. ej. 1280 × 720 o 1366 × 768 físicos), el modo automático usa un factor no entero y algunos píxeles se ven ligeramente desiguales. La opción "Entero" fuerza el escalado pixel-perfect.
- **Animaciones omitidas a propósito**: no hay pose específica de "usar habilidad" (las habilidades se comunican con efectos) ni animación de aturdimiento del Coloso, porque esa mecánica no existe.
- **Tipografías CSS**: se cargan de Google Fonts y sin conexión se usa `monospace`. El texto del canvas usa la fuente bitmap propia, que es local.
- **FPS reales**: no se midieron con GPU, porque el panel de pruebas estaba oculto y el navegador pausa `requestAnimationFrame`; las cifras son de tiempo de CPU por frame.
- **`file://`**: no se probó en este entorno. El juego no lee píxeles de las imágenes (sin `getImageData` sobre assets) y el manifiesto se carga como `.js`, así que debería funcionar.
