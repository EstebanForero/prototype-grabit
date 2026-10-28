# Registro de errores del agente (capítulo 7)

| # | Fase | Error observado | Tipo | Capítulo | Pieza que lo blinda | Comprobado |
|---|---|---|---|---|---|---|
| 1 | con arnés v1 (5/5 corridas) | La prueba nueva lee `harness/casos/<caso>.txt`; al vaciar la bandeja, `bun test` falla (22 pass, 1 fail) | Faltó guía + sensor | 2 Skills / 6 Verificación | Paso 5 de la skill + regla fija en `scripts/verificar.ts` | ciclo 1 |
