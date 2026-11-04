# Demo: correo de despacho → 17TRACK → estado

Muestra el flujo completo con la API v2.2 de 17TRACK (`https://api.17track.net/track/v2.2`):

1. Se lee un correo de `fixtures/correos/` y se extrae tienda, pedido, guía y transportadora.
2. Se registra la guía con `POST /register` (encabezado `17token`).
3. Se consultan los eventos con `POST /gettrackinfo`.
4. Los eventos entran al motor de estados (que decide si aplicar, retener o alertar).
5. Los avisos posteriores llegan por el webhook `POST /webhook/17track` (TRACKING_UPDATED, firma `sign`).

## Modos

| Modo | Cómo | Qué hace |
|------|------|----------|
| mock (por defecto) | sin `TRACK17_TOKEN` | Respuestas grabadas con la forma real de v2.2. No usa red. |
| live | `TRACK17_TOKEN=<17token>` en `.env` | Llama a la API real. Usa la cuota de la cuenta. |

`TRACK17_MODE=mock` fuerza el modo grabado aunque haya token.

## Comandos

```sh
bun install
bun run demo:17track          # consola: los 6 correos de punta a punta
bun test                      # 31 pruebas, incluye tests/track17.test.ts
```

Con la consola web:

```sh
bun run start                                   # http://127.0.0.1:8787
curl -X POST http://127.0.0.1:8787/api/demo/17track    # corre el flujo y devuelve JSON
curl http://127.0.0.1:8787/api/seguimiento              # estados resultantes
```

Simular un aviso de 17TRACK (sin token no se exige firma):

```sh
curl -X POST http://127.0.0.1:8787/webhook/17track -d '{"event":"TRACKING_UPDATED","data":{"number":"7012345678","track_info":{"latest_status":{"status":"Delivered"},"latest_event":{"time_iso":"2026-11-04T15:00:00-05:00","description":"Entregado","address":{"country":"CO","city":"Bogotá"}}}}}'
```

En modo live, configura en el panel de 17TRACK la URL pública `https://<host>/webhook/17track`; la firma es `sha256(cuerpo + "/" + 17token)`.

## Qué mirar en la demo

- `amazon.txt` (UPS): entregado en Doral = bodega → «En bodega» y alerta de guía siguiente faltante.
- `mercadolibre.txt`: entregado en Bogotá → «Entregado» aplicado solo.
- `caso3-ml-reenviado.txt`: entregado en **Medellín** → se retiene, sigue «En tránsito».
- `caso4-alibaba-sin-guia.txt`: el correo no trae guía → no se inventa ni se registra nada.
