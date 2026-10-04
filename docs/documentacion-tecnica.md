# Documentación técnica del MVP

Paquete del capítulo 8 del proyecto de Operaciones TI. El informe académico (capítulos 6 y 7) describe el proceso TO-BE y la arquitectura on-premise. Este documento explica cómo está construido el prototipo y cómo una tercera persona lo despliega, lo ejecuta y lo prueba. El video lo graba otra persona; el guion está al final.

## 1. Qué demuestra

El MVP no es una maqueta. Ante una guía y los eventos de una transportadora, el módulo:

- conserva la cadena de envíos, sin reemplazar una guía por la siguiente;
- normaliza el evento y guarda el texto original;
- decide uno de cinco estados (`pre_alerted`, `in_warehouse`, `shipped`, `in_transit`, `delivered`);
- aplica la decisión cuando las condiciones se cumplen y la retiene, con el motivo, cuando fallan;
- calcula siete alertas, entre ellas la guía que no sigue, el silencio, el destino que no cuadra y la entrega parcial;
- acepta la misma guía para varios productos y rechaza un evento repetido;
- anula una guía mal copiada sin borrarla;
- lee una guía desde un correo de despacho de ejemplo y la asocia por tienda y número de pedido.

Lo que ve el cliente sigue siendo de Grab It: Comprado, Alistamiento, Enviado, En camino, Entregado. El módulo no construye ese portal. La consola imprime la traducción para que la demostración se entienda.

## 2. Arquitectura simplificada

Producción prevista: los servidores propios de Grab It. Nada del núcleo se aloja en un proveedor de nube del equipo.

```text
Correo de despacho ─┐
                    ├─► lecturas ─► observaciones ─► decisión pura ─► apply / hold
Agregador (webhook) ┘                                      │
                                                           ▼
                                              MySQL de Grab It (producción)
                                              SQLite local (este prototipo)
                                                           │
                                                           ▼
                                              Consulta de seguimiento y ficha
                                              Control y portal ya existentes
```

El prototipo ejecutable usa SQLite para que cualquiera lo reproduzca sin un servidor de base de datos. El archivo `migrations/001_mysql.sql` es el esquema equivalente para el MySQL que ya opera en los servidores de la empresa. El código de decisión no conoce el motor: recibe productos, envíos y observaciones y devuelve una decisión.

En producción el proceso vive en el mismo servidor de aplicaciones, detrás del proxy que ya termina TLS. El único puerto nuevo hacia internet es el webhook del agregador, y solo acepta un cuerpo firmado. El resto no se publica.

## 3. Tecnologías

| Pieza | Uso en el MVP | Papel en los servidores de Grab It |
| --- | --- | --- |
| Bun 1.1+ | Runtime, pruebas y servidor HTTP | Mismo runtime, o Node 20 si operación estandariza Node. El código usa TypeScript estándar. |
| TypeScript estricto | Contrato, decisión, alertas, CLI | Se copia como carpeta del módulo |
| SQLite (`bun:sqlite`) | Base del prototipo | Solo para la demostración y las pruebas |
| MySQL 8 | Esquema en `migrations/001_mysql.sql` | Base que ya tiene la empresa. El prototipo no abre una conexión MySQL. |
| HMAC-SHA256 | Firma del webhook | Secreto en variable de entorno, fuera del repositorio |
| Control / portal | No se reimplementan | Consumen la decisión y las dos lecturas |

No hay dependencias de npm. `package.json` solo declara los scripts.

## 4. Componentes

| Ruta | Responsabilidad |
| --- | --- |
| `src/contract.ts` | Estados, tipos de envío, observación, decisión, política y etiquetas |
| `src/core/decision.ts` | Función pura: aplica o retiene. No lee la base ni la red |
| `src/core/alerts.ts` | Las siete alertas, también puras |
| `src/core/normalize.ts` | Traduce el estado de la transportadora a un código propio y valida la forma de la guía |
| `src/core/contact.ts` | Próxima pregunta y el puerto que hoy usa una persona y mañana puede usar un agente |
| `src/data/store.ts` | Altas, observaciones, anulaciones, consulta y ficha |
| `src/data/schema.sql` | Esquema SQLite que el proceso crea al abrirse |
| `migrations/001_mysql.sql` | El mismo modelo para MySQL on-premise |
| `src/providers/email.ts` | Saca tienda, pedido, guía y transportadora de un correo |
| `src/providers/webhook.ts` | Verifica la firma y lee el aviso del agregador |
| `src/http/server.ts` | Salud, seguimiento, ficha y webhook |
| `src/cli/main.ts` | Operación por consola |
| `src/cli/demo.ts` | Recorrido filmable |
| `fixtures/correos/` | Correos sintéticos de Amazon, Mercado Libre, eBay, Alibaba y Homecenter |
| `tests/` | Historias de operación y flujo persistido |

## 5. Cómo decide

Una observación automática se aplica solo si se cumplen las cinco condiciones: la fuente es una transportadora o una tienda, el envío está activo, no hay alerta de destino, de revisión o de guía no encontrada, el evento es posterior al registro y hubo movimiento real. Una etiqueta creada no mueve el estado.

`delivered` suma la prueba completa: el envío iba al cliente, es el último tramo que todavía cuenta, el país coincide y la ciudad también cuando la transportadora la informa, no queda ninguna alerta abierta, todas las cajas hacia el cliente llegaron y se cumplió la espera configurada. Si falla una sola, la decisión se guarda como retenida y el estado del producto no cambia.

Una guía siguiente se marca como continuación de la anterior. Eso distingue el relevo (bodega, courier, última milla) de dos cajas paralelas. Las cajas paralelas se registran con `--paralelo` y, si solo llega una, `delivered` queda retenido.

Lo que escribe un contacto no se aplica solo. Quien anota la respuesta puede aplicar el estado en el mismo comando. Si en la respuesta viene una guía, el envío pasa a modo transportadora y desde ahí sigue solo.

Nada se borra. Corregir una guía anula el envío, guarda el motivo y crea otro.

## 6. Desplegar en el servidor de Grab It

Estas instrucciones asumen un Linux con Bun instalado y un usuario de servicio. El prototipo que se va a evaluar también corre, sin este paso, en la máquina de quien revisa.

1. Instalar Bun y crear el usuario y el directorio.

```bash
sudo useradd --system --create-home --home-dir /opt/grabit-seguimiento grabit
sudo mkdir -p /opt/grabit-seguimiento
sudo rsync -a --exclude data prototype/ /opt/grabit-seguimiento/
sudo chown -R grabit:grabit /opt/grabit-seguimiento
```

2. Crear el archivo de entorno, con permisos del usuario de servicio. No se versiona.

```bash
sudo -u grabit tee /opt/grabit-seguimiento/.env >/dev/null <<'EOF'
GRABIT_DB=/opt/grabit-seguimiento/data/seguimiento.sqlite
AGGREGATOR_SECRET=cambiar-por-un-secreto-largo
PORT=8787
EOF
```

3. Crear la unidad de systemd.

```ini
[Unit]
Description=Seguimiento logístico Grab It
After=network.target

[Service]
User=grabit
WorkingDirectory=/opt/grabit-seguimiento
EnvironmentFile=/opt/grabit-seguimiento/.env
ExecStart=/usr/local/bin/bun src/http/server.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

4. Publicar solo `POST /webhooks/aggregator` en el proxy inverso, hacia `127.0.0.1:8787`. El resto de las rutas queda en localhost para Control.

5. Cuando operación aplique el esquema en el MySQL existente, ejecutar `migrations/001_mysql.sql` sobre una base nueva, no sobre las tablas actuales de pedidos. El módulo guarda el id del producto como texto opaco y no escribe el estado en las tablas de Grab It: entrega la decisión para que Grab It la aplique con su propia lógica.

El adaptador en vivo de 17TRACK no está conectado. Hace falta la llave que crea Grab It. Mientras tanto, el webhook acepta el mismo sobre que enviaría el agregador y las pruebas usan eventos de ejemplo. Cambiar de agregador no toca la función de decisión: solo el normalizador.

## 7. Ejecutar

Desde `prototype/`:

```bash
bun test
bun run demo
bun src/cli/main.ts seguimiento
bun src/cli/main.ts ficha --producto audifonos
```

`demo` borra `data/demo.sqlite` y lo vuelve a crear. El uso manual escribe en `data/seguimiento.sqlite`, o en la ruta de `GRABIT_DB`.

Alta manual de un producto nacional y su guía:

```bash
bun src/cli/main.ts producto --id taladro --modo national --pais CO --ciudad Medellín --tienda mercadolibre --pedido 2000003847563
bun src/cli/main.ts envio --producto taladro --guia 999001234567 --transportadora Servientrega
bun src/cli/main.ts evento --guia 999001234567 --codigo picked_up --texto "Recogido" --pais CO --en 2026-10-04T15:00:00.000Z
bun src/cli/main.ts seguimiento
```

Correo de despacho, después de registrar el producto con la misma tienda y el mismo pedido:

```bash
bun src/cli/main.ts correo --archivo fixtures/correos/amazon.txt
```

Servidor local:

```bash
AGGREGATOR_SECRET=dev-secret bun run webhook
```

Salud: `curl -s http://127.0.0.1:8787/health`

Aviso firmado:

```bash
body='{"trackingNumber":"999001234567","events":[{"timeIso":"2026-10-04T18:00:00.000Z","description":"En camino","status":"InTransit","country":"CO","destinationCountry":"CO"}]}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac dev-secret | awk '{print $2}')
curl -s -X POST http://127.0.0.1:8787/webhooks/aggregator \
  -H "content-type: application/json" \
  -H "x-aggregator-signature: $sig" \
  --data "$body"
```

Una firma incorrecta responde 401. El mismo cuerpo, repetido, no crea otra observación.

Envío sin guía:

```bash
bun src/cli/main.ts envio --producto taladro --contacto "Distribuidor" --canal whatsapp
bun src/cli/main.ts preguntas
bun src/cli/main.ts anotar --envio <id> --texto "Salió hoy" --aplicar shipped
```

## 8. Probar

```bash
cd prototype
bun test
```

Tienen que pasar 19 pruebas.

| Prueba | Qué fija |
| --- | --- |
| Historia 1 y su variante | Tres guías, y también el caso en que el courier llega hasta la puerta |
| Historia 2 | Una guía nacional. La etiqueta creada no es un despacho |
| Historia 3 | El contacto no aplica el estado; la persona sí, en la misma acción |
| Historia 4 | El silencio depende del modo y una nota reinicia el plazo |
| Historia 5 | Aduana u otra excepción no se convierte en estado |
| Historia 7 | Guía no encontrada a las 48 horas, y destino que no cuadra |
| Historia 8 y su variante | Entregado en otra ciudad, y entrega parcial |
| Flujo persistido | Tres productos en una guía, anulación, correo, webhook |

No hay guías reales de Grab It en este repositorio. Los correos de `fixtures/correos/` son sintéticos, escritos para probar el lector. Sustituirlos por correos reales anonimizados no cambia el comando.

## 9. Guion para la grabación

Duración objetivo: 8 minutos. Quien graba ejecuta los comandos y narra con estas palabras, o muy cerca. La pantalla muestra la terminal en `prototype/` y, un momento, el resultado de las pruebas.

| Minuto | En pantalla | Narración |
| --- | --- | --- |
| 0:00–0:50 | Nada todavía, o la primera página del informe | Grab It compra para sus clientes y hoy alguien entra a cada transportadora para mover el estado a mano. Cuando la guía cambia, la anterior se pierde. El cliente ve el portal desactualizado y el equipo se entera tarde. |
| 0:50–1:40 | Este documento, sección 2 | El módulo vive en los servidores de la empresa. Recibe el evento, lo normaliza y devuelve una decisión: aplicar o retener. No reemplaza Control ni el portal. MySQL es el destino de producción; esta demostración usa SQLite para poder correrla sin ese servidor. |
| 1:40–2:10 | `bun test` | Antes del recorrido, las ocho historias de la operación pasan solas. Si una regla se rompe, la prueba falla. |
| 2:10–4:40 | `bun run demo`, pasos 1 a 7 | Este producto sale de Amazon hacia la bodega de Miami, sigue con el courier y termina en Deprisa. Nadie confirma el estado. Un entregado en Doral deja el producto en bodega, no en entregado, y enciende la alerta de que falta la guía siguiente. La entrega en Bogotá sí se aplica, porque la ciudad y el país coinciden y ese envío es el último. |
| 4:40–5:40 | Pasos 8 y 9 del mismo demo | El mismo evento "entregado", en Medellín, se retiene. El cliente seguiría viendo En camino. Cuando la transportadora reporta Bogotá, la prueba completa se cumple y ahí sí se aplica. Esa es la mejora: lo dudoso no llega al cliente. |
| 5:40–6:30 | `bun src/cli/main.ts ficha --producto audifonos` | La ficha conserva las tres guías, las observaciones y las cinco decisiones. La guía equivocada se anula con motivo; no se borra. En las pruebas, tres productos que viajan juntos producen tres decisiones con un solo evento. |
| 6:30–7:20 | `bun src/cli/main.ts correo --archivo fixtures/correos/amazon.txt` después de registrar el producto, o mostrar el test que ya lo hizo | La segunda parte del alcance empieza aquí: la guía entra desde el correo de despacho, asociada por el número de pedido, y pasa por las mismas reglas que una guía pegada a mano. |
| 7:20–8:00 | Cierre, sin comando nuevo | El trabajo repetido de consultar transportadoras sale de la persona. Le queda comprar, resolver la excepción y atender lo que el módulo retiene. Sobre la línea base de 300 horas al mes, esa es la palanca del 60% de esfuerzo que el piloto tiene que medir. |

No hace falta mostrar credenciales. Si un comando falla, se lee el mensaje y se vuelve a correr `bun test`: el estado de las pruebas es la evidencia de que el flujo sigue entero.

## 10. Límites conocidos

- No llama a 17TRACK, Amazon ni a las otras tiendas. No hay llaves en el repositorio y no se crearon cuentas a nombre del equipo.
- El lector de correo cubre cinco formatos de ejemplo. No abre un buzón IMAP.
- La consulta de seguimiento arma el resultado en el proceso, después de leer las tablas. No es todavía una sola sentencia SQL.
- La espera configurable de `delivered` existe en la política (`deliveredWaitMinutes`) y las pruebas cubren el apagado de un estado. El demo la deja en cero.
- La interfaz de Control no forma parte de este paquete. Grab It la construye sobre `seguimiento` y `ficha`.
