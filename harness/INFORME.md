# Taller Harness Engineering — prototype-grabit

**Tarea del agente:** arreglar `parseDispatchEmail` (`src/providers/email.ts`) para que lea un correo de despacho nuevo. El prompt fue el mismo en todas las corridas (está en `harness/correr.sh`).
**Agente:** Grok CLI 1.0.70 en modo headless (`grok -p`, `--sandbox strict`, `--max-turns 40`). Cada corrida es una sesión nueva en una copia limpia (`git archive`) que no incluye los esperados ni el evaluador.
**Evaluación:** `harness/evaluar.ts` revisa los criterios C1 a C5 (ver AGENTS.md) y dos chequeos más: si las pruebas corren sin la carpeta temporal y si lee bien un correo reenviado.

## Tabla comparativa

Todas las columnas están calificadas con el mismo evaluador final (`harness/evaluar.ts`: C1–C5, t1 = pruebas sin `harness/casos`, t2 = correo reenviado). Cada versión se nombra por el commit que guarda sus corridas.

| | Base limpia (88a773e) | Base vieja, archivos de master (f933790) | v1 (7afef88) | v2 / ciclo 1 (d45c480) | v3 / ciclo 2 (4ac43ef) |
|---|---|---|---|---|---|
| Terminados (C1–C5) | 5/5 | 4/5 | 5/5 | 5/5 | 5/5 |
| t1 pruebas sin carpeta temporal | 5/5 | 1/5 | 0/5 | 5/5 | 5/5 |
| t2 reenviado | 5/5 | 5/5 | 4/5 (caso3 falla) | 4/5 (caso3 falla) | 5/5 |
| Tiempo total / promedio | 844 s / 168 s | 962 s / 192 s | 728 s / 145 s | 730 s / 146 s | 775 s / 155 s |
| Llamadas de herramienta | 119 | 160 | 143 | 142 | 164 |
| Veces que el agente corrió `verificar.ts` | 0 (no existe) | 0 | 17 | 18 | 17 |
| Reintentos del Stop hook | — | — | 0 (no corrió, ver abajo) | 0 (no corrió) | 0 (no corrió) |

La base limpia (sesión nueva, sin AGENTS.md ni archivos del arnés, GROK_HOME aislado, correo pegado en el prompt; `harness/correr-base.sh`, logs en `logs/sin-arnes-limpia/`) sacó 5/5 en todo. En estos casos fáciles, la base limpia rinde igual que v3. La base vieja corría sobre los archivos de master y no es comparable del todo.

La tabla original (base vieja contra v1 y v3) era esta:

| | Sin arnés (master) | Con arnés v1 (7afef88) | Con arnés mejorado v3 (4ac43ef) |
|---|---|---|---|
| Correctos de 5 (C1–C5) | 4/5 | 5/5 | 5/5 |
| Correcciones necesarias | 5: caso4 entero y 4 pruebas que leen `harness/casos` | 6: 5 pruebas que leen `harness/casos` y caso3, que rompe los correos reenviados | 0 |
| Peor error | caso4: con "Tracking: pending" devuelve `trackingNumber:null` en vez de error. Rompió un caso que ya pasaba y tocó `store.ts` y `mailbox.ts` | caso3: rechaza correos reenviados. Es un fallo seguro (devuelve error), pero hay que hacerlo a mano | ninguno |
| ¿Se retoma en otra sesión? | No: no hay memoria ni criterio de terminado | Sí: `progreso.md`, `decisiones.md`, el `.json` del caso y `verificar.ts` | Sí, y además el corpus de regresión |

Nota honesta: caso2 y caso4 ya pasaban con el parser original, así que sirven para ver si el agente rompe algo ("no romper"). Los casos son fáciles: sin arnés ya se acertaba 4 de 5. Por eso la diferencia está en el peor error y en las correcciones, no en los aciertos.

## Versiones de instrucciones
Están en `harness/versiones/`: AGENTS v1/v2/v3, SKILL v1/v2/v3 y referencia v1/v2/v3. El registro de errores está en `harness/memoria/errores.md`.

## Cómo se arma cada pieza en Grok CLI (ver `harness/grok-inspect.txt`)
- **Reglas (cap. 1):** `AGENTS.md` se carga como "Project Instructions" (unos 426 tokens). Solo se carga si la carpeta es de confianza (`--trust`).
- **Referencia:** `docs/harness/referencia-correos.md`. AGENTS.md la enlaza y el agente la lee cuando la necesita.
- **Skill (cap. 2):** `.grok/skills/registrar-correo-despacho/SKILL.md`. Aparece como skill "project" y como comando `/registrar-correo-despacho`.
- **Guardarraíl (cap. 5):**
  - `.grok/hooks/arnes.json` configura un PreToolUse que corre `scripts/guardarrail.ts tool` y devuelve exit 2 para negar la acción.
  - `.githooks/pre-commit` bloquea commits que tocan archivos protegidos o que no pasan `verificar.ts`.
  - Lo probé directamente: editar `src/contract.ts` da exit 2, `git push` da exit 2 y el commit de contract.ts queda bloqueado.
  - **Hallazgo (errores.md, ciclo 3):** con `--sandbox strict`, Grok 1.0.70 no corre los hooks del proyecto (ni PreToolUse ni Stop). Lo medí con un hook de prueba. Por eso en las corridas strict (base, v1, v2, v3) el guardarraíl y el Stop hook no estaban activos, y lo que se midió fue la guía, la memoria y `verificar.ts`. Con `--sandbox strict` y sin AGENTS.md, Grok editó `src/contract.ts` (`logs/evidencia/sin-hooks-strict/`).
  - **Bloqueo real** (`logs/evidencia/guardarrail-sin-guia-ws`, `--sandbox workspace`, sin AGENTS.md): "Hook denied: GUARDARRAIL: …/src/contract.ts es un archivo protegido", y el archivo quedó sin cambios (`capturas/hook-deny.png`). El guardarraíl niega también la lectura (`read_file`), lo cual es más estricto de lo necesario.
  - **Con AGENTS.md**, Grok se niega antes de llegar al hook (`logs/evidencia/sin-trust-hooks-no-cargados/guardarrail.*`).
  - **REQUIERE REVISION HUMANA** (`logs/evidencia/revision-humana-ws`): era un caso imposible (el JSON pide DHL y el correo dice Alibaba Logistics). El Stop hook bloqueó 3 veces y luego escribió la línea en progreso.md. La escribió 2 veces porque el hook corrió de nuevo al final; es un defecto menor. En la corrida strict equivalente (sin hooks), Grok cambió el JSON esperado para que pasara, que es justo el riesgo que el hook frena.
  - `grok inspect` muestra "Permissions: (none)": no usé reglas de permisos, solo hooks.
- **Verificación (cap. 6):** `scripts/verificar.ts` revisa el caso, el corpus `harness/regresion/`, que ninguna prueba lea `harness/casos` y que `bun test` pase. El Stop hook (`scripts/stop-hook.ts`) lo vuelve a correr y bloquea el cierre hasta 3 veces. Después de eso anota REQUIERE REVISION HUMANA.
- **Memoria (cap. 3):** `harness/memoria/progreso.md` y `decisiones.md`.
- **Ojo:** las funciones de la plataforma cambian (hooks, skills, sandbox y `inspect` son de Grok CLI 1.0.70, octubre de 2026). Esto puede variar en otras versiones; conviene revisar `~/.grok/docs` y volver a correr `grok inspect`.

## Validez de las corridas
- Las primeras corridas se hicieron sin sandbox. Grok leyó `/workspace/prototype-grabit` (el arnés) y los esperados, así que las marqué inválidas (`logs/invalidas-sin-sandbox/`) y repetí todo con `--sandbox strict`. `correr.sh` marca CONTAMINADA si la transcripción menciona el repo o los esperados, y ninguna corrida válida quedó marcada.
- Riesgo que queda: el sandbox strict permite leer `~/.grok`, donde están las sesiones anteriores.
- Las corridas en paralelo del ciclo 2 fallaron al arrancar y las repetí una por una (`logs/invalidas-arranque/`).

## Reflexiones
**Capítulo que más ayudó: el 6, verificación.**
Los dos errores reales no los habría visto leyendo el código del agente: las 5 corridas decían VERIFICACION OK.
Aparecieron cuando un sensor externo probó algo que el agente no tenía delante: vaciar la bandeja y probar un correo reenviado.
La lección es que el agente cumple lo que se le mide y nada más.
Convertir cada error en una regla fija dentro de `verificar.ts` hizo que el arreglo no dependiera de que el agente "entendiera".
La regla corre igual en el Stop hook, en el pre-commit y en la evaluación.
También el criterio C5 (el peor error) ayudó a ordenar prioridades: el caso4 sin arnés era el más grave, aunque fuera un solo fallo de 5.

**Pieza que se podría quitar: el Stop hook con contador (en tareas cortas).** La evidencia muestra que sí sirve en un caso imposible, pero en las corridas normales nunca hizo falta.
En las 15 corridas válidas con arnés (con-arnés, ciclo 1 y ciclo 2) el agente corrió `verificar.ts` por su cuenta antes de cerrar.
Nunca llegó a la revisión humana por los 3 intentos.
El pre-commit y el evaluador externo ya cubren el mismo riesgo.
La memoria `progreso.md` sí sirvió: en `logs/evidencia/retomar` una sesión nueva recibió solo "Continúa.", leyó la línea EN CURSO y terminó el caso5 (VERIFICACION OK, 23 pruebas).
Las dejaría solo para tareas largas.

**Lo que sigue necesitando a una persona:**
- Decidir qué es "correcto". Los esperados y el corpus los escribí yo, y si están mal el arnés aprueba lo equivocado.
- Notar los errores que no mide ningún sensor, como pasó con el reenvío: lo descubrí comparando con la versión sin arnés.
- Aprobar cambios en archivos protegidos (contrato, migraciones).
- Hacer push y merge.
- Juzgar si una instrucción como "la tienda la decide el `From:`" es correcta para el negocio.

## Nota sobre v1 caso3
v1 caso3 pasa C1–C5, pero falla t2 (correo reenviado), un chequeo que se agregó después en el ciclo 2. Ciclo 1 caso3 también lo falla. Ver `memoria/errores.md`.

## Revisor (otra sesión de Grok)
`logs/evidencia/revisor-<caso>`: una sesión nueva, que no edita nada, revisó el cambio pendiente de cada caso v3 contra AGENTS.md y la referencia. Los veredictos están en la tabla de `logs/evidencia/RESUMEN.md`. Hay un artefacto del montaje: copié la memoria de la corrida sobre 4ac43ef, así que el diff "borra" secciones de errores.md que se escribieron después. El revisor lo marcó como fuera de alcance, pero no es un error de Grok.

## Capturas
`harness/capturas/`: `hook-deny`, `verificacion-ok`, `revision-humana` y `corrida-grok-ciclo2-caso3`, en .txt y .png. Las imágenes se generaron a partir de los logs reales, no son capturas de pantalla.
