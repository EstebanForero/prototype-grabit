# Referencia: correos de despacho

## Contrato de salida de `parseDispatchEmail(raw)`
Éxito: `{ "store", "storeOrderNumber", "trackingNumber", "carrier" }` en ese orden de claves.
`carrier` se omite si el correo no la nombra. Error: `{ "error": "<mensaje>" }` con uno de:
- `El correo no pertenece a una tienda cubierta.`
- `No se encontró el número de pedido de <tienda>.`
- `El correo no trae una guía.`

## Tiendas cubiertas y formato del pedido
| Tienda | Remitente típico | Pedido |
|---|---|---|
| amazon | `@amazon.com` | `ddd-ddddddd-ddddddd` |
| mercadolibre | `@mercadolibre.com(.co)` | 10 a 16 dígitos ("venta", "pedido") |
| ebay | `@ebay.com` | `dd-ddddd-ddddd` o 10–14 dígitos ("Order number") |
| alibaba | `@alibaba.com` | 12 a 20 dígitos |
| homecenter | `@homecenter.com(.co)` | 6 a 12 dígitos ("Pedido") |

## Etiquetas de guía y transportadora (español e inglés)
Guía: `Tracking ID`, `Tracking number`, `Guía`, `Código de seguimiento`, `Número de seguimiento`, `Rastreo`.
Transportadora: `Carrier`, `Transportadora`, `Transportista`, `Shipped with`, `Enviado con`.

## Casos difíciles
- Un correo puede mencionar otra tienda en el pie o en publicidad. La tienda la decide el remitente **original**, no una palabra suelta del cuerpo. Si el correo fue reenviado (el `From:` del encabezado es un buzón interno como `compras@grabit.example` y dentro hay un bloque `Forwarded message` / `Mensaje reenviado` con su propio `From:`), la tienda sale de ese `From:` interno. Nunca de la publicidad o del pie. El corpus `harness/regresion/` tiene un ejemplo y `verificar.ts` lo comprueba siempre.
- "Tracking: pending" no es una guía: la guía tiene al menos 8 caracteres y al menos un dígito.
- "Item number" no es el número de pedido.

## Cómo registrar un caso
Por cada correo nuevo en `harness/casos/<caso>.txt` crea `harness/casos/<caso>.json` con la salida
correcta leída del correo, a mano, antes de tocar el parser. El verificador compara ambos.
