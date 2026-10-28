# Registro de errores del agente (capítulo 7)

| # | Fase | Error observado | Tipo | Capítulo | Pieza que lo blinda | Comprobado |
|---|---|---|---|---|---|---|
| 1 | con arnés v1 (5/5 corridas) | La prueba nueva lee `harness/casos/<caso>.txt`; al vaciar la bandeja, `bun test` falla (22 pass, 1 fail) | Faltó guía + sensor | 2 Skills / 6 Verificación | Paso 5 de la skill + regla fija en `scripts/verificar.ts` | ciclo 1 |
| 2 | con arnés v1 y ciclo 1 (caso3) | El parser decide la tienda solo con el `From:` del encabezado; un correo reenviado por compras@grabit se rechaza ("no pertenece a una tienda cubierta"), cuando sin arnés sí se leía | Guía equivocada (la referencia decía "lo decide el remitente `From:`") + faltó sensor | 1 Contexto / 6 Verificación | Referencia y decisiones v3 (remitente original) + corpus fijo `harness/regresion/` que corre `verificar.ts` | ciclo 2 |
