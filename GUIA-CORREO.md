# Guía: correo de despacho y 17TRACK

Hay dos demostraciones distintas. El correo muestra que Grab It lee un aviso y lo cruza con una compra. 17TRACK muestra el recorrido de una guía que existe en esa cuenta. Una no dispara la otra.

## 1. Correo

El servidor tiene que estar corriendo desde `prototype`:

```sh
bun run start
```

Abre http://127.0.0.1:8787. La cuenta de Gmail ya está en `.env` (`MAIL_USER` y `MAIL_PASSWORD`, con la contraseña de aplicación). El servidor lee esa bandeja al arrancar y otra vez cada 45 segundos.

### Producto que hay que registrar

En **Registrar compra**, antes de que llegue el correo:

| Campo | Valor |
| --- | --- |
| Identificador | `audifonos` |
| Modo | Internacional, primer tramo a bodega |
| País del cliente | `CO` |
| Ciudad | `Bogotá` |
| Tienda | Amazon |
| Número de pedido de la tienda | `112-4455667-1234567` |

Si el pedido del correo no coincide con este número, la lectura dice que hay guía pero ningún producto.

### Correo de muestra

Este es el aviso. El botón **Enviar aviso**, en **Buzón**, manda exactamente este texto a la misma cuenta, por SMTP. Para eso hacen falta `SMTP_USER` y `SMTP_PASSWORD` en `.env`, con la misma contraseña de aplicación.

```text
From: shipment-tracking@amazon.com
Subject: Your package was shipped

Your Amazon.com order has shipped.

Order #112-4455667-1234567
Carrier: UPS
Tracking ID: 1Z999AA10123456784
```

También sirve reenviar un aviso real de la tienda a esa bandeja. La tienda y el número de pedido del mensaje tienen que ser los del producto.

### Qué se ve

En menos de 45 segundos, **Buzón** muestra una extracción con la guía `1Z999AA10123456784` asociada al pedido. **Cola de hoy** muestra el producto `audifonos` con esa guía. No hace falta pulsar **Vigilar buzón**.

Esa guía es de ejemplo. 17TRACK no la conoce. El correo queda demostrado. El recorrido de la transportadora, no.

## 2. 17TRACK

La página de 17TRACK no puede llamar a este computador. Lo que sí puede hacer la aplicación es pedirle a la API las guías que la cuenta ya tiene registradas y bajar sus eventos.

En **Cola de hoy** hay un bloque **17TRACK**.

**Traer registradas** llama a `POST /api/17track/traer`. Eso usa `gettracklist` y, para cada número, `gettrackinfo`. Cada guía de la cuenta queda guardada en la base de Grab It. La siguiente vez no se duplica. Si ya estaba, solo se actualizan los eventos. Al arrancar con `TRACK17_TOKEN`, el servidor hace este mismo recorrido solo.

**Consultar** sirve para una guía real. Se escribe el número y se pulsa el botón. La aplicación la registra en 17TRACK si todavía no estaba, pide los eventos y, si Grab It no la tenía, abre un producto para que aparezca en la cola. Esto gasta cuota de la cuenta.

Para mostrárselo al cliente:

1. En https://user.17track.net/es registra un paquete que exista, o usa uno que la cuenta ya tenga.
2. En la consola, **Traer registradas**. Si esa guía ya estaba en una compra, la cola se actualiza.
3. Si no estaba, escribe el mismo número en **Consultar**. La tarjeta queda en **Cola de hoy** con el estado que devolvió 17TRACK.

Con `TRACK17_TOKEN` en `.env` estas dos acciones usan la API real. `TRACK17_MODE=mock` no llama a la red: devuelve las historias grabadas de las guías de ejemplo y solo actualiza las que ya estén en la cola.
