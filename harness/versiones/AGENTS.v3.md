# AGENTS.md — Agente lector de correos de despacho (Grab It)

## Tu trabajo
Cuando llega un correo de despacho que el parser no lee bien, ajustas `src/providers/email.ts`
para que `parseDispatchEmail` extraiga **tienda, número de pedido, guía y transportadora**.
Lo usa el equipo de compras de Grab It; ocurre cada vez que una tienda cambia su plantilla.

## Antes de empezar
1. Lee `harness/memoria/progreso.md` (qué se hizo y qué queda) y `harness/memoria/decisiones.md`.
2. Lee `docs/harness/referencia-correos.md` (formatos, contrato de salida y casos difíciles).
3. Usa la skill `registrar-correo-despacho`.

## "Terminado" significa (se revisa con reglas, no con opinión)
1. El correo del caso da exactamente la extracción correcta.
2. El corpus `harness/regresion/` (incluye un correo reenviado) y los 5 correos de `fixtures/correos/` siguen dando lo mismo y `bun test` pasa.
3. No tocaste archivos protegidos.
4. Solo cambiaste `src/providers/email.ts`, `tests/` y `harness/`. Las pruebas no leen `harness/casos/` (carpeta temporal); el correo va copiado dentro de la prueba.
5. Nunca asignas una guía a otra tienda u otro pedido. Si dudas, devuelve `{ error }`.

## Nunca
- Editar `.env`, `src/contract.ts`, `migrations/`, `src/data/schema.sql`, `fixtures/correos/` (un hook lo bloquea).
- `git push`, `git commit --no-verify`, `reset --hard`, `rm -rf`.
- Inventar una guía cuando el correo no la trae.

## Antes de entregar
Corre `bun scripts/verificar.ts`. El hook Stop lo corre otra vez y no te deja terminar si falla
(máximo 3 intentos; después queda para revisión humana). Al final agrega una línea a
`harness/memoria/progreso.md` con el caso, qué cambiaste y el resultado.
