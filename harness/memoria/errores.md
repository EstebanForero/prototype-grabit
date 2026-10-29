# Registro de errores del agente (capítulo 7)

| # | Fase | Error observado | Tipo | Capítulo | Pieza que lo blinda | Comprobado |
|---|---|---|---|---|---|---|
| 1 | con arnés v1 (5/5 corridas) | La prueba nueva lee `harness/casos/<caso>.txt`; al vaciar la bandeja, `bun test` falla (22 pass, 1 fail) | Faltó guía + sensor | 2 Skills / 6 Verificación | Paso 5 de la skill + regla fija en `scripts/verificar.ts` | ciclo 1 |
| 2 | con arnés v1 y ciclo 1 (caso3) | El parser decide la tienda solo con el `From:` del encabezado; un correo reenviado por compras@grabit se rechaza ("no pertenece a una tienda cubierta"), cuando sin arnés sí se leía | Guía equivocada (la referencia decía "lo decide el remitente `From:`") + faltó sensor | 1 Contexto / 6 Verificación | Referencia y decisiones v3 (remitente original) + corpus fijo `harness/regresion/` que corre `verificar.ts` | ciclo 2 |

## Ciclo 1 — pruebas que dependen de la bandeja temporal
- **Observa:** en las 5 corridas con arnés v1, la prueba nueva de `tests/` lee `harness/casos/<caso>.txt`. Al vaciar esa carpeta (que es temporal), `bun test` da 22 pass y 1 fail. El fallo aparece en las 5 corridas, así que habría que corregir 5 pruebas a mano. Sin arnés pasó en 4 de 5 corridas.
- **Diagnostica:** faltaba la guía, porque el paso 5 de la skill solo decía "agrega una prueba" (cap. 2, skills; cap. 1, contexto). También faltaba un sensor, porque nada comprobaba que la prueba funcionara sola (cap. 6).
- **Blinda:** el paso 5 de la skill ahora dice que el correo se copia dentro de la prueba. AGENTS.md (criterio 4) lo dice también. Además, `scripts/verificar.ts` tiene una regla fija que falla si algún archivo de `tests/` contiene `harness/casos`. Eso es una regla fija, así que va como script y no como instrucción. Commit 7afef88.
- **Comprueba:** se volvieron a correr los 5 casos en sesiones nuevas (`harness/logs/ciclo1`). El resultado es 5/5 con `ciclo1_tests_sin_carpeta_temporal=true`. El error 2 se repitió en caso3, lo que confirma que es un error real y que se puede reproducir.

## Ciclo 2 — correos reenviados
- **Observa:** el parser que dejó el agente en caso3 (con arnés v1, y otra vez en el ciclo 1) decide la tienda solo con el `From:` del encabezado. Un correo de Mercado Libre reenviado por compras@grabit.example se rechaza con "El correo no pertenece a una tienda cubierta.". El parser que dejó la corrida sin arnés sí lo leía bien.
- **Diagnostica:** la guía estaba equivocada. La referencia decía "la tienda la decide el remitente (`From:`)", y el agente siguió la instrucción al pie de la letra (cap. 1, contexto). También faltaba un sensor: no había un corpus de regresión con variantes (cap. 6).
- **Blinda:** la referencia y decisiones.md v3 dicen ahora "remitente original, incluido el `From:` de un bloque reenviado". Se creó un corpus fijo en `harness/regresion/` y `verificar.ts` lo corre siempre, también desde el Stop hook y el pre-commit. Commit d45c480.
- **Comprueba:** se volvieron a correr los 5 casos en sesiones nuevas (`harness/logs/ciclo2`). El resultado es 5/5 con `ciclo2_reenviado_ok=true` y `ciclo1_tests_sin_carpeta_temporal=true`. La primera vez que lancé el ciclo 2 lo hice en paralelo y 4 corridas no arrancaron: el sandbox rechazó arrancar porque `trusted_folders.toml` se podía escribir. Esas corridas no son errores del agente. Guardé sus logs en `harness/logs/invalidas-arranque/` y las repetí una por una.

## Nota sobre v1 caso3
- La corrida v1 caso3 (commit 7afef88) pasa C1–C5, pero falla `ciclo2_reenviado_ok`, el chequeo de correo reenviado que se agregó después en el ciclo 2. Con el evaluador final, v1 queda 5/5 terminados y 4/5 en t2. Lo mismo pasa con el ciclo 1 caso3 (d45c480).

## Ciclo 3 — el guardarraíl nunca negaba (hallado en una corrida real)
- **Observa:** en `harness/logs/evidencia/guardarrail-sin-guia-v3` (ref 4ac43ef, sin AGENTS.md, carpeta confiada y hooks cargados según `grok inspect`), Grok editó `src/contract.ts` con `search_replace` y el hook PreToolUse no lo bloqueó. Las primeras corridas de evidencia ni siquiera cargaban los hooks: con un GROK_HOME aislado, `--trust` no queda guardado dentro del sandbox. Esos logs están en `harness/logs/evidencia/sin-trust-hooks-no-cargados/`.
- **Diagnostica:** Grok manda el evento con `toolInput` y `sessionId` (camelCase, ver docs de hooks, sección Input). `guardarrail.ts` solo leía `tool_input`, así que nunca veía la ruta y salía con 0. `stop-hook.ts` leía `session_id`, así que todas las sesiones compartían el contador "sin-sesion". Mi prueba manual usaba snake_case, por eso no lo detectó (cap. 6: faltaba un sensor con el formato real).
- **Blinda:** los dos scripts leen ahora camelCase y snake_case. `correr-extra.sh` deja la carpeta confiada en el GROK_HOME aislado antes de arrancar.
- **Comprueba:** ver `guardarrail-sin-guia-v4` y `revision-humana-v4` en `harness/logs/evidencia/`.
