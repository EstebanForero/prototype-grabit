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
- lee una guía desde un correo de despacho y la asocia por tienda y número de pedido;
- ofrece una consola web para ver la cola, registrar la compra y leer el buzón por IMAP cuando el correo ya llegó.

Lo que ve el cliente sigue siendo de Grab It: Comprado, Alistamiento, Enviado, En camino, Entregado. Esta consola es la del prototipo, para operar y demostrar el módulo. No reemplaza Control ni el portal.

## 2. Arquitectura simplificada

Producción prevista: los servidores propios de Grab It. Nada del núcleo se aloja en un proveedor de nube del equipo.

```text
Correo IMAP ─────────────┐
                         ├─► lecturas ─► observaciones ─► decisión pura ─► apply / hold
Agregador (webhook) ─────┘                                      │
                                                                ▼
                                                   MySQL de Grab It (producción, esquema listo)
                                                   SQLite en volumen (este prototipo y Docker)
                                                                │
                                                                ▼
                                              Consola web del prototipo: cola, ficha, buzón
                                              Control y portal ya existentes, en producción
```

El prototipo ejecutable usa SQLite para que cualquiera lo reproduzca sin un servidor de base de datos. El archivo `migrations/001_mysql.sql` es el esquema equivalente para el MySQL que ya opera en los servidores de la empresa. El código de decisión no conoce el motor: recibe productos, envíos y observaciones y devuelve una decisión.

En producción el proceso vive en el mismo servidor de aplicaciones, detrás del proxy que ya termina TLS. El único puerto nuevo hacia internet es el webhook del agregador, y solo acepta un cuerpo firmado. El resto no se publica.

## 3. Tecnologías

| Pieza | Uso en el MVP | Papel en los servidores de Grab It |
| --- | --- | --- |
| Bun 1.4 | Runtime, pruebas, servidor HTTP y imagen Docker | Mismo runtime, o Node si operación ya lo estandariza. La decisión no depende de Bun. |
| TypeScript estricto | Contrato, decisión, alertas, consola y CLI | Se copia como carpeta del módulo |
| SQLite (`bun:sqlite`) | Base del prototipo y del contenedor | Solo para la demostración, las pruebas y el despliegue de prueba |
| MySQL 8 | Esquema en `migrations/001_mysql.sql` | Base que ya tiene la empresa. El proceso no abre una conexión MySQL. El perfil Docker `mysql` solo carga el esquema. |
| imapflow | Cliente IMAP del buzón de despacho | Dependencia del proceso. La clave no se versiona ni se devuelve en la API |
| React y shadcn | Consola en `web/`, compilada a estáticos | No entra en la decisión. El mismo proceso Bun sirve el resultado |
| HMAC-SHA256 | Firma del webhook | Secreto en variable de entorno, fuera del repositorio |
| Docker Compose | Despliegue de prueba en un comando | En los servidores de Grab It también puede quedar como unidad de systemd |
| Control / portal | No se reimplementan | En producción consumen la decisión. La consola de este paquete es la superficie del prototipo |

## 4. Componentes

| Ruta | Responsabilidad |
| --- | --- |
| `src/contract.ts` | Estados, tipos de envío, observación, decisión, política y etiquetas |
| `src/core/decision.ts` | Función pura: aplica o retiene. No lee la base ni la red |
| `src/core/alerts.ts` | Las siete alertas, también puras |
| `src/core/normalize.ts` | Traduce el estado de la transportadora a un código propio y valida la forma de la guía |
| `src/core/contact.ts` | Próxima pregunta. La responde una persona; el módulo no aplica ese texto solo |
| `src/data/store.ts` | Altas, observaciones, anulaciones, consulta y ficha |
| `src/data/schema.sql` | Esquema SQLite que el proceso crea al abrirse |
| `migrations/001_mysql.sql` | El mismo modelo para MySQL on-premise |
| `src/providers/email.ts` | Saca tienda, pedido, guía y transportadora de un correo |
| `src/providers/mime.ts` | Texto de un mensaje simple o multipart |
| `src/providers/mailbox.ts` | Conexión IMAP, escaneo y asociación. Quita la clave de los errores |
| `src/providers/webhook.ts` | Verifica la firma y lee el aviso del agregador |
| `src/http/server.ts` | API, archivos de la consola y webhook |
| `web/` | Consola React: cola, ficha, alta de compra y buzón. `bun run build` la deja en `public/` |
| `src/cli/enviar.ts` | Entrega un aviso por SMTP al buzón local de la demostración |
| `src/cli/main.ts` | Operación por consola |
| `src/cli/demo.ts` | Recorrido filmable de las tres guías |
| `Dockerfile`, `docker-compose.yml` | Imagen del proceso, servidor SMTP/IMAP de demostración y, en un perfil aparte, MySQL solo con el esquema |
| `fixtures/correos/` | Correos sintéticos de Amazon, Mercado Libre, eBay, Alibaba y Homecenter |
| `tests/` | Historias de operación, flujo persistido y lector de correo |

## 5. Cómo decide

Una observación automática se aplica solo si se cumplen las cinco condiciones: la fuente es una transportadora o una tienda, el envío está activo, no hay alerta de destino, de revisión o de guía no encontrada, el evento es posterior al registro y hubo movimiento real. Una etiqueta creada no mueve el estado.

`delivered` suma la prueba completa: el envío iba al cliente, es el último tramo que todavía cuenta, el país coincide y la ciudad también cuando la transportadora la informa, no queda ninguna alerta abierta, todas las cajas hacia el cliente llegaron y se cumplió la espera configurada. Si falla una sola, la decisión se guarda como retenida y el estado del producto no cambia.

Una guía siguiente se marca como continuación de la anterior. Eso distingue el relevo (bodega, courier, última milla) de dos cajas paralelas. Las cajas paralelas se registran con `--paralelo` y, si solo llega una, `delivered` queda retenido.

Lo que escribe un contacto no se aplica solo. Quien anota la respuesta puede aplicar el estado en el mismo comando. Si en la respuesta viene una guía, el envío pasa a modo transportadora y desde ahí sigue solo.

Nada se borra. Corregir una guía anula el envío, guarda el motivo y crea otro.

## 6. Desplegar

Hay dos formas. La de prueba es Docker y no pide Bun en el anfitrión. La de los servidores de Grab It puede ser la misma imagen o la unidad de systemd. En ambos casos el proceso que corre usa SQLite. MySQL queda como esquema para cuando TI lo aplique en la instancia que ya opera la empresa.

### 6.1 Despliegue de prueba con Docker

Desde `prototype/`:

```bash
docker compose up --build
```

La imagen construye la consola React y la sirve en `http://127.0.0.1:8787`. Los datos quedan en el volumen `seguimiento-data`. El mismo Compose levanta `buzon`, un GreenMail local: SMTP en el puerto 3025 e IMAP en el 3143, sin autenticación. Sirve para que el aviso entre por correo durante la demostración. No es el buzón de Grab It. En la pantalla, el preset «Contenedor» apunta el proceso a `buzon:3143`, usuario `despacho@grabit.local`, clave `local` y TLS apagado. Desde el anfitrión, `bun run enviar` entrega el aviso por SMTP. Las variables opcionales del buzón real y el secreto del webhook se leen de un `.env` que no se versiona; el modelo está en `.env.example`. Si ese archivo trae el IMAP de Gmail, la pantalla usa esos datos y el servidor local queda solo como alternativa.

Para ver el esquema de producción en un MySQL local, sin conectar el proceso a ese motor:

```bash
docker compose --profile mysql up --build
```

La raíz es `grabit-local` y la base se llama `seguimiento`. Sirve para que TI inspeccione `migrations/001_mysql.sql`. No es el almacén del módulo.

### 6.2 Servidor de Grab It con systemd

Estas instrucciones asumen un Linux con Bun instalado y un usuario de servicio.

1. Instalar Bun y crear el usuario y el directorio.

```bash
sudo useradd --system --create-home --home-dir /opt/grabit-seguimiento grabit
sudo mkdir -p /opt/grabit-seguimiento
(cd prototype/web && bun install && bun run build)
sudo rsync -a --exclude data --exclude node_modules --exclude public prototype/ /opt/grabit-seguimiento/
sudo rsync -a prototype/public/ /opt/grabit-seguimiento/public/
sudo chown -R grabit:grabit /opt/grabit-seguimiento
sudo -u grabit bun install --frozen-lockfile --production
```

2. Crear el archivo de entorno, con permisos del usuario de servicio. No se versiona.

```bash
sudo -u grabit tee /opt/grabit-seguimiento/.env >/dev/null <<'EOF'
GRABIT_DB=/opt/grabit-seguimiento/data/seguimiento.sqlite
MAILBOX_FILE=/opt/grabit-seguimiento/data/mailbox.json
AGGREGATOR_SECRET=cambiar-por-un-secreto-largo
PORT=8787
MAIL_HOST=imap.gmail.com
MAIL_PORT=993
MAIL_SECURE=true
MAIL_USER=
MAIL_PASSWORD=
MAIL_MAILBOX=INBOX
EOF
sudo chmod 600 /opt/grabit-seguimiento/.env
sudo chown grabit:grabit /opt/grabit-seguimiento/.env
```

`MAIL_PASSWORD` puede quedar vacío si la consola guarda el buzón después, en `mailbox.json`. Ese archivo tampoco se versiona.

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

4. En la red de Grab It, publicar `POST /webhooks/aggregator` hacia el proxy. La consola de este prototipo puede quedar en la red interna para Compras. No es el portal del cliente y no crea usuarios: la clave que pide es la del buzón de despacho.

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

Servidor y consola. La consola se compila antes, porque el proceso solo sirve los archivos estáticos:

```bash
cd web && bun install && bun run build && cd ..
bun install
AGGREGATOR_SECRET=dev-secret bun run start
```

Abrir `http://127.0.0.1:8787`. Salud: `curl -s http://127.0.0.1:8787/health`.

Recorrido real, con el servidor de correo local ya publicado en 3025 y 3143. Primero se registra el producto. Después se guarda el IMAP del buzón local y se entrega el aviso por SMTP. El escaneo lo lee de la bandeja:

```bash
curl -s -X POST http://127.0.0.1:8787/api/productos \
  -H 'content-type: application/json' \
  -d '{"id":"audifonos","mode":"international","customerCountry":"CO","customerCity":"Bogotá","store":"amazon","storeOrderNumber":"112-4455667-1234567"}'
curl -s -X POST http://127.0.0.1:8787/api/correo \
  -H 'content-type: application/json' \
  -d '{"host":"127.0.0.1","port":3143,"secure":false,"user":"despacho@grabit.local","password":"local","mailbox":"INBOX"}'
bun run enviar
curl -s -X POST http://127.0.0.1:8787/api/correo/escanear -H 'content-type: application/json' -d '{"sinceDays":2}'
```

Si el proceso corre dentro de Compose, el host IMAP es `buzon`, no `127.0.0.1`. `bun run enviar` sigue hablando al puerto 3025 del anfitrión. La pantalla hace lo mismo con «Guardar y probar», «Vigilar buzón» y «Leer ahora». Cada mensaje muestra Llegó, Lectura y Producto. Una guía repetida responde `ya-estaba` y no crea otro envío. Un mensaje sin producto queda para vincularlo. `GET /api/correo` informa si hay buzón y no incluye la clave.

En Gmail el usuario activa IMAP y usa una contraseña de aplicación. El preset de la pantalla es `imap.gmail.com`, puerto 993, con TLS. No hace falta mostrar esa clave en la grabación. El buzón local basta para ver el mismo recorrido.

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

Tienen que pasar 22 pruebas.

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
| Correo | Texto multipart, asociación por pedido y los cinco ejemplos sin sobre aparte |

No hay guías reales de Grab It en este repositorio. Los correos de `fixtures/correos/` son sintéticos, escritos para probar el lector. Sustituirlos por correos reales anonimizados no cambia el comando.

## 9. Guion para la grabación

Duración objetivo: 8 minutos. Quien graba narra con estas palabras, o muy cerca. La pantalla muestra la consola en el navegador y, un momento, la terminal en `prototype/`. No se muestra una clave real.

| Minuto | En pantalla | Narración |
| --- | --- | --- |
| 0:00–0:50 | Nada todavía, o la primera página del informe | Grab It compra para sus clientes y hoy alguien entra a cada transportadora para mover el estado a mano. Cuando la guía cambia, la anterior se pierde. El cliente ve el portal desactualizado y el equipo se entera tarde. |
| 0:50–1:30 | Este documento, sección 2, o `docker compose up` ya en marcha | El módulo vive en los servidores de la empresa. Recibe el evento, lo normaliza y devuelve una decisión: aplicar o retener. No reemplaza Control ni el portal. MySQL es el destino de producción; esta demostración usa SQLite, también dentro de Docker, para poder correrla sin ese servidor. |
| 1:30–2:00 | `bun test` en la terminal | Antes del recorrido, las historias de la operación pasan solas. Si una regla se rompe, la prueba falla. |
| 2:00–3:10 | Consola, «Registrar compra», preset del buzón, «Vigilar buzón» y, en la terminal, `bun run enviar` | Se registra el pedido de Amazon. El aviso entra por SMTP al buzón y la pantalla lo lee por IMAP. La tarjeta muestra de quién llegó, qué guía se leyó y que quedó en el producto. Nadie pega la guía a mano. |
| 3:10–4:20 | `bun run demo`, pasos 1 a 7 | Este otro recorrido, en la terminal, sigue el mismo producto por tres guías: Miami, courier y Deprisa. Un entregado en Doral deja el producto en bodega y enciende la alerta de la guía que falta. La entrega en Bogotá sí se aplica. |
| 4:20–5:20 | Pasos 8 y 9 del mismo demo | El mismo "entregado", en Medellín, se retiene. El cliente seguiría viendo En camino. Cuando la transportadora reporta Bogotá, la prueba completa se cumple. Lo dudoso no llega al cliente. |
| 5:20–6:20 | `bun src/cli/main.ts ficha --producto audifonos` y, si se quiere, la ficha de la consola | La ficha conserva las guías, las observaciones y las decisiones. La guía equivocada se anula con motivo; no se borra. |
| 6:20–7:20 | «Leer ahora» una segunda vez, sin mostrar una clave de Grab It | La misma guía responde que ya estaba y no se duplica. La clave del buzón queda en el servidor. Gmail usa la misma pantalla cuando Grab It entrega la cuenta. |
| 7:20–8:00 | Cierre | El trabajo repetido de consultar transportadoras sale de la persona. Le queda comprar, resolver la excepción y atender lo que el módulo retiene. Sobre la línea base de 300 horas al mes, esa es la palanca del 60% de esfuerzo que el piloto tiene que medir. |

No hace falta mostrar credenciales. Si un comando falla, se lee el mensaje y se vuelve a correr `bun test`: el estado de las pruebas es la evidencia de que el flujo sigue entero.

## 10. Límites conocidos

- No llama a 17TRACK ni a las API de las tiendas. No hay llaves de agregador en el repositorio y no se crearon cuentas a nombre del equipo. El webhook acepta el mismo sobre, firmado, con eventos de ejemplo.
- El lector cubre cinco formatos. El escaneo en vivo lee IMAP. Los textos de `fixtures/correos/` los usan las pruebas, no la pantalla.
- La consulta de seguimiento arma el resultado en el proceso, después de leer las tablas. No es todavía una sola sentencia SQL.
- La espera configurable de `delivered` existe en la política (`deliveredWaitMinutes`) y las pruebas cubren el apagado de un estado. El demo la deja en cero.
- La consola no es Control ni el portal del cliente. En producción, Grab It sigue aplicando la decisión con su sistema. El perfil MySQL de Docker no está cableado al proceso.
