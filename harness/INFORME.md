# Taller Harness Engineering — prototype-grabit

**Tarea del agente:** arreglar `parseDispatchEmail` (`src/providers/email.ts`) para que lea un correo de despacho nuevo. El prompt fue el mismo en todas las corridas (está en `harness/correr.sh`).
**Agente:** Grok CLI 1.0.70 en modo headless (`grok -p`, `--sandbox strict`, `--max-turns 40`). Cada corrida es una sesión nueva en una copia limpia (`git archive`) que no incluye los esperados ni el evaluador.
**Evaluación:** `harness/evaluar.ts` revisa los criterios C1 a C5 (ver AGENTS.md) y dos chequeos más: si las pruebas corren sin la carpeta temporal y si lee bien un correo reenviado.

## Tabla comparativa

| | Sin arnés (master) | Con arnés v1 (f933790) | Con arnés mejorado v3 (d45c480) |
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
  - En las corridas reales el agente nunca intentó tocar un archivo protegido. En `logs/prueba-guardarrail.grok.jsonl` le pedí editar contract.ts y no lo cambió, pero se quedó sin turnos leyendo AGENTS.md. Esa prueba no confirma por sí sola que el hook se dispare.
  - `grok inspect` muestra "Permissions: (none)": no usé reglas de permisos, solo hooks.
- **Verificación (cap. 6):** `scripts/verificar.ts` revisa el caso, el corpus `harness/regresion/`, que ninguna prueba lea `harness/casos` y que `bun test` pase. El Stop hook (`scripts/stop-hook.ts`) lo vuelve a correr y bloquea el cierre hasta 3 veces. Después de eso anota REQUIERE REVISION HUMANA.
- **Memoria (cap. 4):** `harness/memoria/progreso.md` y `decisiones.md`.
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

**Pieza que se podría quitar: el Stop hook con contador.**
En las 20 corridas con arnés el agente corrió `verificar.ts` por su cuenta antes de cerrar.
Nunca llegó a la revisión humana por los 3 intentos.
El pre-commit y el evaluador externo ya cubren el mismo riesgo.
También se podría recortar la memoria `progreso.md`: cada corrida es independiente y nadie la leyó para retomar trabajo real.
Las dejaría solo para tareas largas.

**Lo que sigue necesitando a una persona:**
- Decidir qué es "correcto". Los esperados y el corpus los escribí yo, y si están mal el arnés aprueba lo equivocado.
- Notar los errores que no mide ningún sensor, como pasó con el reenvío: lo descubrí comparando con la versión sin arnés.
- Aprobar cambios en archivos protegidos (contrato, migraciones).
- Hacer push y merge.
- Juzgar si una instrucción como "la tienda la decide el `From:`" es correcta para el negocio.
