---
name: registrar-correo-despacho
description: Ajustar el parser de correos de despacho de Grab It para que lea un correo nuevo. Úsala cuando un correo en harness/casos no da la extracción correcta o cuando te piden "leer", "registrar" o "arreglar" un correo de despacho.
when-to-use: correo de despacho nuevo, parseDispatchEmail falla, nueva plantilla de tienda
---

# Registrar correo de despacho

## Pasos
1. Lee el correo `harness/casos/<caso>.txt` y `docs/harness/referencia-correos.md`.
2. Escribe a mano `harness/casos/<caso>.json` con la salida correcta según el contrato.
3. Corre `bun scripts/verificar-correos.ts` y mira qué falla.
4. Cambia solo `src/providers/email.ts`, con el cambio más pequeño que resuelva el caso.
5. Agrega una prueba en `tests/` para el caso.
6. Corre `bun scripts/verificar.ts` hasta que diga `VERIFICACION OK`.
7. Anota en `harness/memoria/progreso.md`: caso, cambio, resultado.
