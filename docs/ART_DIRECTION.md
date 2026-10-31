# Hellfall: Survival — Auditoría visual y dirección artística

## 1. Auditoría del proyecto (estado anterior a la renovación)

| Aspecto | Estado encontrado |
| --- | --- |
| Tecnología | HTML5 Canvas 2D + JavaScript clásico (sin módulos ni dependencias), CSS3 para menús/HUD en DOM. |
| Arranque | `index.html` carga 19 scripts en orden; `main.js` crea `HF.Game` y el bucle `requestAnimationFrame`. |
| Mundo | 76 × 56 tiles de 32 px (2432 × 1792 unidades). 1 unidad = 1 px del mundo. |
| Cámara | Centro con suavizado y anticipación hacia el ratón; zoom **no entero** (0.85–2) aplicado con `setTransform` sobre el canvas físico. |
| Sprites | `sprites.js` generaba siluetas de 16 × 16 (8 × 8 a 32 × 32) con primitivas, escaladas ×2/×3 y **rotadas libremente** → píxeles deformados y luz que gira con el sprite. |
| Animación | Inexistente: 2 "frames" con un píxel desplazado + oscilación por escala. Sin muerte, ataque ni recarga. |
| Proyectiles | Líneas (`lineTo`) y círculos con antialiasing. |
| Efectos | Partículas de líneas/arcos suavizados, explosiones con degradados radiales, flash circular. |
| Escenario | Texturas 16 × 16 ×2 con ruido aleatorio, paredes con rectángulos planos; todas las salas iguales. |
| Iluminación | Mapa de luz con degradados suaves (desenfoque) a media resolución. |
| HUD/menús | DOM + CSS moderno (degradados, `clip-path`), símbolos Unicode (», ●, ◎, ⚡) como iconos. |
| Texto en el mundo | `fillText` con fuente vectorial antialiasada. |
| Colisiones | Círculos (jugador r 13, enemigos r 11–22, jefes r 40–42) contra rejilla de tiles. **No se modifican.** |
| Carga de assets | No había archivos de imagen; solo un `manifest.js` opcional de audio. |

### Inventario de elementos a sustituir

- **Protagonista**: silueta girada → personaje modular con piernas (8 direcciones) y torso + arma (32 direcciones), idle, caminar, correr, disparar, recargar, daño y muerte.
- **6 enemigos**: siluetas giradas → sprites direccionales (8 direcciones) con idle, desplazamiento, preparación, ataque, daño y muerte, más una variante élite de cada uno.
- **2 jefes**: sprites de 112 px en 8 direcciones con dos paletas (normal y enfurecido).
- **6 armas**: rectángulos → armas modeladas en el torso, iconos de HUD y arte para el arsenal.
- **Proyectiles**: líneas y círculos → 10 sprites distinguibles por forma.
- **Efectos**: fogonazos por arma (16 direcciones), impactos, explosiones por capas, humo, portales de aparición, escudo, chispas, rayos pixelados y manchas en el suelo.
- **Objetos**: 15 recogibles con brillo animado.
- **Escenario**: tilesets por zona (laboratorio, control, almacén contaminado, energía y hangar), paredes autoconectadas, puertas, contenedores, pilares, consolas, generadores, terminal, barriles, tuberías, cables, señalización y rejillas.
- **UI**: logotipo, paneles y botones 9-slice, barras pixeladas, más de 40 iconos, fuente bitmap para el canvas y pantalla de carga.

## 2. Dirección artística

- **Estilo**: pixel art top-down oscuro, industrial y de ciencia ficción. Sombreado por bloques (3–5 tonos por material), contorno exterior oscuro teñido del material ("sel-out") y líneas internas de separación entre piezas.
- **Luz**: una única fuente dominante desde arriba a la izquierda, en dirección (−0.5, −0.65, 0.75). Los sprites direccionales se renderizan para cada orientación con la luz **fija en el mundo**, así que la iluminación no gira con el personaje. Los emisores (visores, núcleos, cristales) no reciben sombreado.
- **Paleta** (cada color con una función):

| Rampa | Uso |
| --- | --- |
| Carbón / gris metálico | Estructuras, maquinaria, armas |
| Gris azulado | Armadura del protagonista y tecnología |
| Rojo sangre / rojo emergencia | Daño, alertas, carne mutada |
| Naranja incandescente | Fuego, explosiones, energía interna del Coloso |
| Amarillo industrial | Advertencias, munición, monedas |
| Verde tóxico | Contaminación, Tejedor, ácido |
| Cian | Energía, visor, plasma, escudo |
| Violeta | Guardián, munición especial, Tesla |
| Blanco cálido | Solo para los puntos de máxima luz |

- **Escala**: 1 píxel de arte = 1 unidad del mundo. Protagonista 32 px (torso de 48 px con el arma), Errante/Tejedor/Incinerador/Acechador 32 px, Guardián 40 px, Coloso 56 px, jefes 112 px, objetos 16–24 px y tiles de 32 px. Las colisiones no cambian; el arte se dibujó para que encaje con ellas.
- **Resolución lógica**: el mundo se dibuja en un canvas lógico a 1:1 y se escala con vecino más cercano. Por defecto se usa un **factor entero** según la resolución física (pixel-perfect); como alternativa, la opción "Escalado ajustado" permite un zoom no entero.
- **Rotación**: ningún sprite de personaje o criatura se rota en tiempo de ejecución. Se elige el frame direccional más cercano.
- **Tipografía**: *Silkscreen* para títulos y botones, *Pixelify Sans* para textos y *VT323* para cifras (Google Fonts, con respaldo `monospace`). En el canvas se usa una fuente bitmap propia de 5 × 7.
- **Animación**: duraciones cortas para no bloquear el control. La animación es presentación (`HF.Animator`) y no modifica la lógica.

## 3. Estrategia de integración

1. **Generación de assets** (`tools/build-assets.js`, Node sin dependencias): un rasterizador de primitivas 3D simples (elipsoides, cápsulas cónicas, cajas biseladas y placas) sombrea cada píxel con la luz fija, cuantiza a la rampa del material y aplica contornos. Exporta PNG transparentes (encoder propio) a `assets/` y escribe `assets/manifest.json` y `assets/manifest.js` (el `.js` permite abrir el juego con `file://`).
2. **Carga** (`js/assets.js`): precarga con progreso; si un archivo falla, muestra la lista en pantalla y en consola y dibuja un patrón de depuración magenta. Nada falla en silencio.
3. **Presentación**: `js/animation.js` (Animator), `js/fx.js` (efectos de alto nivel) y `js/pixelfont.js`. Los `render()` existentes se reescriben para usar sprites; `update()`, colisiones, IA, armas, oleadas, mejoras y guardado no cambian. Solo se toca lógica en cambios mínimos y visuales: la duración de la animación de muerte del enemigo (sin efecto en el juego) y los ganchos de efectos.
