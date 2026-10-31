# Equilibrado de Hellfall: Survival

## Herramienta

`tools/sim/balance-bot.js` es un bot que juega partidas completas sin renderizar: se mueve, esquiva balas y áreas
telegrafiadas, usa el dash, cambia de arma, compra en la terminal y elige mejoras. Mide por oleada la duración, el
daño recibido, la economía y las peleas contra jefes, y desglosa el daño recibido por fuente. No escribe en el
guardado.

Uso (en la consola del navegador, con el juego abierto):

```js
const src = await fetch('tools/sim/balance-bot.js').then((r) => r.text()); (0, eval)(src);
HF.BalanceBot.batch([{ skill: 0.5, fresh: true }, { skill: 0.8, meta: true }]);
// cuando HF.BalanceBot.done sea true:
HF.BalanceBot.results
```

- `skill` (0–1): reflejos (esquiva, puntería, uso del dash).
- `fresh`: sin armas extra ni mejoras permanentes. `meta`: todas las armas y mejoras permanentes a medio nivel.

> El bot ve todas las balas a la vez y esquiva mejor que una persona: los resultados son una cota optimista.

## Problemas detectados y cambios

| Problema | Dato | Cambio |
| --- | --- | --- |
| Oleadas 1–4 lentas y sin riesgo | 0 de daño, hasta 40 s | Más enemigos (10/16), aparición más rápida y grupos de 3 |
| Oleadas que no terminaban | Oleada 9: 151 bajas frente a 63 previstas, 171 s | El Guardián invoca como máximo 3 veces |
| El Tejedor era la mayor fuente de daño | 130–270 por partida | Daño 11 → 9, cadencia y velocidad de la bola menores |
| Tus explosiones te mataban | Hasta 571 de autodaño por partida (escalaba con tus mejoras) | Máximo 10 de autodaño por explosión; cohetes y granadas al 20 % |
| Muro en la Fundición | Todos los perfiles morían entre las oleadas 13 y 16 | Artillero: daño 20 → 15, más lento y con más aviso; escoria 16 → 12 de daño/s |
| La Forja como muro | 140–230 de daño en menos de 1 min | Lluvia de escoria con un impacto menos, más aviso y charcos más débiles |
| Jefes demasiado fáciles | El Núcleo caía en 29 s | Vida de los jefes +30 %, Carcelero con más daño |
| Escalado tardío brusco | — | Vida y daño enemigos crecen más despacio; máx. 80 enemigos a la vez |
| Monedas sin uso | Hasta 4.700 sobrantes | Las monedas restantes dan núcleos al final (máx. 30) |
| **Fallo:** jefes atascados en esquinas | El Carcelero quedó 30+ min inmóvil | Detección de atasco: si no avanza ni ve al jugador, salta cerca de él |
| **Fallo:** enemigos dentro de muros | Un Parásito empujado dentro del borde bloqueaba la oleada | Recolisión tras los empujones y reubicación si queda atrapado 3 s |

## Resultado (tras los cambios)

| Perfil | Llega a | Duración |
| --- | --- | --- |
| Novato, sin progresión | Oleada ~19 (Fundición) | 12–16 min |
| Medio, sin progresión | Oleadas 24–33 | 24 min o más |
| Experto con progresión | Completa los 4 sectores (45 oleadas) | ~60 min |

## Pendiente

La economía final sigue dejando monedas de sobra en partidas muy largas. Además, conviene validar estas cifras jugando
de verdad: el bot es mejor esquivando que una persona.
