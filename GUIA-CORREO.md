# Guía: correo de despacho y 17TRACK

Hay dos demostraciones distintas. El correo muestra que Grab It lee un aviso y lo cruza con una compra. 17TRACK muestra el recorrido de una guía que existe en esa cuenta. Una no dispara la otra.

## 1. Correo, en dos pasos

El servidor tiene que estar corriendo desde `prototype`:

```sh
bun run start
```

Si esa ventana ya estaba abierta desde antes de este cambio, ciérrala y vuelve a ejecutar el comando. Los botones nuevos viven en ese proceso.

Abre http://127.0.0.1:8787. La cuenta de Gmail ya está en `.env` (`MAIL_USER` y `MAIL_PASSWORD`, con la contraseña de aplicación). El envío usa `SMTP_USER` y `SMTP_PASSWORD`, la misma contraseña de aplicación. El servidor lee la bandeja al arrancar y otra vez cada 45 segundos. Cada botón también pide una lectura unos 8 segundos después.

La guía de este recorrido es `1Z999AA10987654321`. No uses `1Z999AA10123456784`: esa ya está en la cuenta de 17TRACK, entregada en Longview, y se mezclaría con el correo.

### Producto

En **Registrar compra**, antes del primer correo. El modo tiene que ser nacional: el envío va al cliente, y así el segundo correo puede dejarlo en Entregado.

| Campo | Valor |
| --- | --- |
| Identificador | `audifonos` |
| Modo | Nacional, directo al cliente |
| País del cliente | `CO` |
| Ciudad | `Bogotá` |
| Tienda | Amazon |
| Número de pedido de la tienda | `112-4455667-1234567` |

Si `audifonos` ya está en la cola, pulsa **Quitar** en esa tarjeta y regístralo otra vez. Si el pedido del correo no coincide, la lectura dice que hay guía pero ningún producto.

Abre **Cola de hoy**. La tarjeta está en **Comprado**.

### Primer correo: despacho

En la pestaña **Buzón**, pulsa **Enviar despacho**. Sale este texto:

```text
Your Amazon.com order has shipped.

Order #112-4455667-1234567
Carrier: UPS
Tracking ID: 1Z999AA10987654321
```

Vuelve a **Cola de hoy**. En menos de un minuto la tarjeta pasa a **Enviado** y la barra llena hasta esa etapa. Ábrela: el correo dijo que la transportadora recogió el envío que va al cliente. En **Buzón**, la extracción dice que la guía quedó asociada.

### Segundo correo: entrega

Con la tarjeta todavía en **Enviado**, vuelve a **Buzón** y pulsa **Enviar entrega**:

```text
Your Amazon.com order has been delivered.

Order #112-4455667-1234567
Carrier: UPS
Tracking ID: 1Z999AA10987654321
Delivered in Bogotá, CO
```

**Cola de hoy** pasa a **Entregado**. La barra llega al final. Al abrir la tarjeta, la etapa dice que la entrega fue en Bogotá. En **Buzón**, esa lectura queda como estado nuevo.

Si se pulsa **Enviar entrega** otra vez, el correo se lee y no cambia el estado: la entrega ya estaba anotada.

No pulses **Traer registradas** en medio de estos dos correos. Ese botón baja las guías de 17TRACK, y esta demostración es solo el email.

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
