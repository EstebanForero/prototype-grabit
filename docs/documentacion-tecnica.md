# Documentación técnica del MVP

Paquete del capítulo 8 del proyecto de Operaciones TI. El informe académico describe el proceso TO-BE y la arquitectura on-premise, y queda fuera de este repositorio. Este archivo es la documentación técnica: cómo está construido el prototipo y cómo una tercera persona lo despliega, lo configura, lo ejecuta y lo prueba. El [README](../README.md) de la raíz apunta aquí y deja el arranque corto. Los comandos se ejecutan en esa raíz, la carpeta que contiene `package.json`, `web/` y `docs/`. El guion de la grabación está al final; el video publicado, una versión corta de 5 minutos, está enlazado en el README.

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
| `src/core/events.ts` | Avisos que salen de cada decisión y del cambio de alertas |
| `src/core/places.ts` | Compara país y ciudad sin depender de tildes ni mayúsculas. Reconoce los alias de Colombia y Estados Unidos |
| `src/data/store.ts` | Altas, observaciones, anulaciones, consulta y ficha |
| `src/data/schema.sql` | Esquema SQLite que el proceso crea al abrirse |
| `migrations/001_mysql.sql` | El mismo modelo para MySQL on-premise |
| `src/providers/email.ts` | Saca tienda, pedido, guía y transportadora de un correo |
| `src/providers/mime.ts` | Texto de un mensaje simple o multipart |
| `src/providers/mailbox.ts` | Conexión IMAP, escaneo y asociación. Quita la clave de los errores |
| `src/providers/smtp.ts` | Entrega el aviso de Amazon por el SMTP del proveedor. Quita la clave del error |
| `src/providers/webhook.ts` | Verifica la firma y lee el aviso del agregador |
| `src/http/server.ts` | API, archivos de la consola, vigilancia del buzón y webhook |
| `web/` | Frontend React. `bun run build` dentro de `web/`, o `bun run consola` desde la raíz, lo deja en `public/` |
| `src/cli/enviar.ts` | Entrega el aviso por el SMTP del proveedor. No imprime la clave |
| `src/cli/main.ts` | Operación por consola |
| `src/cli/demo.ts` | Recorrido filmable de las tres guías |
| `Dockerfile`, `docker-compose.yml` | Imagen del proceso y, en un perfil aparte, MySQL solo con el esquema. El correo es el del proveedor |
| `fixtures/correos/` | Correos sintéticos de Amazon, Mercado Libre, eBay, Alibaba y Homecenter |
| `correo de despacho workflow.json` | Workflow de n8n que envía el correo de Amazon de la demostración. Los pasos están en el README |
| `tests/` | Historias de operación, flujo persistido y lector de correo |

### Consola

El frontend está en `web/`: React 19, Vite, Tailwind y componentes al estilo de shadcn. El proceso Bun no renderiza la interfaz. Sirve el resultado de la compilación, que cae en `public/` y no se versiona. Si `public/index.html` no existe, la raíz HTTP responde 503 con la instrucción de compilar. La imagen de Docker hace ese build en la etapa `consola` y copia `public/` al proceso final.

Tres pestañas: **Cola de hoy**, **Buzón** y **Registrar compra**. La cola muestra el estado y abre la ficha. Registrar compra da de alta el producto. Buzón guarda la cuenta, prueba IMAP, envía el aviso, enciende la vigilancia de 45 segundos y lista las extracciones en curso y las ejecutadas. El historial sale de `GET /api/correo/procesos` y queda en la tabla SQLite `extraction_runs`, que conserva las 40 más recientes. El esquema MySQL no tiene esa tabla. «Cargar correos de ejemplo» procesa los cinco textos de `fixtures/correos/` con `POST /api/correo/ejemplos`, sin cuenta externa. Una tarjeta «sin producto» permite vincular el pedido con `POST /api/correo/vincular`, que registra el producto y le asocia la guía leída.

En desarrollo se pueden dejar los dos procesos: `bun run start` en el puerto 8787 y `cd web && bun run dev`. Vite publica la interfaz en el puerto 5173 y reenvía `/api` al proceso.

## 5. Cómo decide

El módulo solo propone un estado que esté por delante del actual; un evento viejo no hace retroceder el producto. Una observación automática se aplica solo si se cumplen las cinco condiciones: la fuente es una transportadora o una tienda, el envío está activo, no hay alerta de destino, de revisión o de guía no encontrada, el evento es posterior al registro de la guía y hubo movimiento real. Además, la política (`autoApply`) tiene que permitir la aplicación automática de ese estado. Una etiqueta creada no mueve el estado.

`delivered` suma la prueba completa: el envío iba al cliente, es el último tramo que todavía cuenta, el país coincide y la ciudad también cuando la transportadora la informa, no queda ninguna alerta abierta, todas las cajas hacia el cliente llegaron y se cumplió la espera configurada. Si falla una sola, la decisión se guarda como retenida y el estado del producto no cambia.

Una guía siguiente se marca como continuación de la anterior. Eso distingue el relevo (bodega, courier, última milla) de dos cajas paralelas. Las cajas paralelas se registran con `--paralelo` y, si solo llega una, `delivered` queda retenido.

Lo que escribe un contacto no se aplica solo. Quien anota la respuesta puede aplicar el estado en el mismo comando. Si en la respuesta viene una guía, el envío pasa a modo transportadora y desde ahí sigue solo.

Nada se borra. Corregir una guía anula el envío, guarda el motivo y crea otro.

## 6. Desplegar

Hay dos formas. La de prueba es Docker y no pide Bun en el anfitrión. La de los servidores de Grab It puede ser la misma imagen o la unidad de systemd. En ambos casos el proceso que corre usa SQLite. MySQL queda como esquema para cuando TI lo aplique en la instancia que ya opera la empresa.

### 6.1 Despliegue de prueba con Docker

Desde la raíz de este repositorio:

```bash
docker compose -p grabit-seguimiento up --build -d
```

La imagen construye la consola React y la sirve en `http://127.0.0.1:8787`. Los datos quedan en el volumen `seguimiento-data`. Compose no levanta un servidor de correo. El aviso viaja por el SMTP y el IMAP del proveedor. Las variables del buzón y el secreto del webhook se leen de un `.env` que no se versiona; el modelo está en `.env.example` y en la sección 6.3. La clave es una contraseña de aplicación, o la clave normal solo en GMX, y no entra al repositorio. Si `.env` no define `AGGREGATOR_SECRET`, la imagen trae `dev-secret`; hay que cambiarlo antes de publicar el webhook. El `env_file` con `required: false` pide Docker Compose 2.24 o superior. Con `-p grabit-seguimiento`, Docker nombra el volumen `grabit-seguimiento_seguimiento-data`.

Para bajar solo este proyecto: `docker compose -p grabit-seguimiento down`.

Para ver el esquema de producción en un MySQL local, sin conectar el proceso a ese motor:

```bash
docker compose -p grabit-seguimiento --profile mysql up --build -d
```

La raíz es `grabit-local` y la base se llama `seguimiento`. Sirve para que TI inspeccione `migrations/001_mysql.sql`. No es el almacén del módulo.

### 6.2 Servidor de Grab It con systemd

Estas instrucciones asumen un Linux con Bun instalado y un usuario de servicio.

1. Instalar Bun 1.4 y crear el usuario y el directorio. Los comandos se ejecutan desde la raíz del repositorio, salvo el último, que entra al directorio instalado.

```bash
sudo useradd --system --create-home --home-dir /opt/grabit-seguimiento grabit
(cd web && bun install && bun run build)
sudo rsync -a --exclude .git --exclude .env --exclude data --exclude node_modules --exclude public ./ /opt/grabit-seguimiento/
sudo rsync -a public/ /opt/grabit-seguimiento/public/
sudo chown -R grabit:grabit /opt/grabit-seguimiento
cd /opt/grabit-seguimiento && sudo -u grabit "$(command -v bun)" install --frozen-lockfile --production
```

La unidad del paso 3 llama a `/usr/local/bin/bun`. Si `command -v bun` devuelve otra ruta, por ejemplo `~/.bun/bin/bun` del instalador oficial, copie el binario a `/usr/local/bin` o cambie `ExecStart`.

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

### 6.3 Configuración

El modelo versionado es `.env.example`. La copia local es `.env` y no entra al repositorio. Docker lee ese archivo si existe (`env_file` con `required: false`) y además fija `GRABIT_DB`, `MAILBOX_FILE` y `PORT` para el volumen `/data`.

| Variable | Si no se define | Efecto |
| --- | --- | --- |
| `PORT` | `8787` | Puerto del proceso |
| `GRABIT_DB` | `data/seguimiento.sqlite` | SQLite del proceso. `bun run demo` usa `data/demo.sqlite` y no toca esta |
| `MAILBOX_FILE` | `data/mailbox.json` | JSON del buzón guardado en la pantalla, modo 600 |
| `AGGREGATOR_SECRET` | `dev-secret` | Clave HMAC del encabezado `x-aggregator-signature` |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_MAILBOX` | sin buzón hasta que la pantalla lo guarde | Si host, usuario y clave vienen en el entorno, el proceso los usa al arrancar y no lee el archivo |
| `SMTP_HOST`, `SMTP_PORT` | se deduce del host IMAP, en el puerto 587 | Fuerza el servidor del botón «Enviar aviso» y de `bun run enviar`. `.env.example` trae `smtp.gmail.com`: con Yahoo o GMX hay que vaciarlo o cambiarlo. El puerto 465 usa TLS directo; cualquier otro, STARTTLS |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TO` | la cuenta guardada, y el destinatario es esa misma cuenta | Solo los lee `bun run enviar` |

La pantalla configura el buzón sin tocar el archivo a mano. «Guardar y probar» escribe `mailbox.json`. Una clave en blanco en un guardado posterior conserva la anterior. Ninguna respuesta JSON incluye la clave. Gmail y Yahoo exigen contraseña de aplicación. Gmail: `imap.gmail.com:993` y, para el envío, `smtp.gmail.com:587`. Yahoo: `imap.mail.yahoo.com` y `smtp.mail.yahoo.com`. GMX: `imap.gmx.com` y `mail.gmx.com`, con la clave normal después de activar IMAP. La pantalla ofrece esos tres presets.

La vigilancia no es un temporizador del navegador. `POST /api/correo/vigilar` la deja en el proceso, cada 45 segundos. Reiniciar el proceso la apaga. Las filas de `extraction_runs` siguen en la SQLite del prototipo.

## 7. Ejecutar

Desde la raíz de este repositorio:

```bash
bun test
bun run demo
GRABIT_DB=data/demo.sqlite bun src/cli/main.ts seguimiento
GRABIT_DB=data/demo.sqlite bun src/cli/main.ts ficha --producto audifonos
```

`demo` borra `data/demo.sqlite` y lo vuelve a crear. El resto de la CLI lee `data/seguimiento.sqlite`, o la ruta de `GRABIT_DB`; por eso los dos comandos de después del demo apuntan a la base del demo. Sin esa variable, la ficha de `audifonos` solo existe si se registró antes en la consola.

Alta manual de un producto nacional y su guía:

```bash
bun src/cli/main.ts producto --id taladro --modo national --pais CO --ciudad Medellín --tienda mercadolibre --pedido 2000003847563
bun src/cli/main.ts envio --producto taladro --guia 999001234567 --transportadora Servientrega
bun src/cli/main.ts evento --guia 999001234567 --codigo picked_up --texto "Recogido" --pais CO
bun src/cli/main.ts seguimiento
```

Sin `--en`, el evento toma la hora actual. Una fecha anterior al registro de la guía se retiene a propósito («hay eventos anteriores al registro»), así que un ejemplo con fecha fija deja de aplicarse con el paso de los días.

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

Recorrido real, todo en la consola. Primero se registra el producto. Después «Guardar y probar» deja el IMAP de la cuenta gratuita. «Enviar aviso» entrega el texto por el SMTP de ese proveedor, a la misma cuenta. «Vigilar buzón» hace que el proceso vuelva a abrir IMAP cada 45 segundos. «Leer ahora» dispara una extracción en el momento. La pantalla separa las que están en curso de las ya ejecutadas. El mismo envío se puede repetir con `bun run enviar` si `SMTP_USER` y `SMTP_PASSWORD` están definidos, o si la consola ya guardó la cuenta. El ejemplo de abajo es ese mismo recorrido, escrito para quien no abre el navegador:

```bash
curl -s -X POST http://127.0.0.1:8787/api/productos \
  -H 'content-type: application/json' \
  -d '{"id":"audifonos","mode":"international","customerCountry":"CO","customerCity":"Bogotá","store":"amazon","storeOrderNumber":"112-4455667-1234567"}'
curl -s -X POST http://127.0.0.1:8787/api/correo \
  -H 'content-type: application/json' \
  -d '{"host":"imap.gmail.com","port":993,"secure":true,"user":"cuenta-de-demostracion@gmail.com","password":"contraseña-de-aplicacion","mailbox":"INBOX"}'
curl -s -X POST http://127.0.0.1:8787/api/correo/enviar
curl -s -X POST http://127.0.0.1:8787/api/correo/vigilar -H 'content-type: application/json' -d '{"active":true,"sinceDays":2}'
curl -s http://127.0.0.1:8787/api/correo/procesos
curl -s -X POST http://127.0.0.1:8787/api/correo/escanear -H 'content-type: application/json' -d '{"sinceDays":2}'
```

Ese `password` del ejemplo no es una clave real. En Gmail es la contraseña de aplicación, no la clave de la cuenta, y no se escribe en el repositorio. Yahoo usa `imap.mail.yahoo.com` y su propia contraseña de aplicación. GMX usa `imap.gmx.com` y la clave de la cuenta, con IMAP activado en el webmail. La pantalla hace lo mismo con «Guardar y probar», «Enviar aviso», «Vigilar buzón» y «Leer ahora». Cada extracción guarda inicio, conteos y, si falló, el error. Al abrirla, cada mensaje muestra Llegó, Lectura y Producto. Una guía repetida responde `ya-estaba` y no crea otro envío. Un mensaje sin producto queda para vincularlo. `GET /api/correo` informa si hay buzón y si la vigilancia está activa, y no incluye la clave. `GET /api/correo/procesos` devuelve la vigilancia y las últimas lecturas. Esas filas viven en la SQLite del prototipo. El esquema MySQL de producción no las tiene. Reiniciar el proceso apaga la vigilancia; el historial queda.

No hace falta mostrar la clave en la grabación. La cuenta se conecta en la consola, o el campo se cubre. El aviso se envía desde «Enviar aviso» y la tarjeta aparece cuando la extracción lo lee.

Aviso firmado:

```bash
now=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
body='{"trackingNumber":"999001234567","events":[{"timeIso":"'"$now"'","description":"En camino","status":"InTransit","country":"CO","destinationCountry":"CO"}]}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac dev-secret | awk '{print $2}')
curl -s -X POST http://127.0.0.1:8787/webhooks/aggregator \
  -H "content-type: application/json" \
  -H "x-aggregator-signature: $sig" \
  --data "$body"
```

El evento lleva la hora actual por la misma razón que en la CLI. Una firma incorrecta responde 401. El mismo cuerpo, repetido, no crea otra observación.

Envío sin guía:

```bash
bun src/cli/main.ts envio --producto taladro --contacto "Distribuidor" --canal whatsapp
bun src/cli/main.ts preguntas
bun src/cli/main.ts anotar --envio <id> --texto "Salió hoy" --aplicar shipped
```

## 8. Probar

```bash
bun test
```

Tienen que pasar 22 pruebas, en tres archivos: `tests/stories.test.ts` (14), `tests/flow.test.ts` (5) y `tests/mail.test.ts` (3).

| Prueba | Cuántas | Qué fija |
| --- | --- | --- |
| Historia 1 y su variante | 2 | Tres guías, y también el caso en que el courier llega hasta la puerta |
| Historia 2 | 1 | Una guía nacional. La etiqueta creada no es un despacho |
| Historia 3 | 1 | El contacto no aplica el estado; la persona sí, en la misma acción |
| Historia 4 | 1 | El silencio depende del modo y una nota reinicia el plazo |
| Historia 5 | 1 | Aduana u otra excepción no se convierte en estado |
| Historia 7 | 1 | Guía no encontrada a las 48 horas, y destino que no cuadra |
| Historia 8 y su variante | 2 | Entregado en otra ciudad, y entrega parcial |
| Reglas generales | 3 | Un evento viejo no retrocede el estado, la política puede apagar la aplicación automática y un envío anulado no produce alertas |
| Normalización | 2 | Etiqueta creada frente a movimiento real, y un número de pedido que no pasa por guía |
| Flujo persistido | 5 | Una guía para varios productos, anulación, correo de Amazon, webhook firmado y las cinco tiendas |
| Correo | 3 | Texto multipart, asociación por pedido y los cinco ejemplos sin sobre aparte |

No hay una prueba con el número de historia 6.

No hay guías reales de Grab It en este repositorio. Los correos de `fixtures/correos/` son sintéticos, escritos para probar el lector. Sustituirlos por correos reales anonimizados no cambia el comando.

## 9. Guion para la grabación

Duración objetivo: 8 minutos. El video publicado (05:03, enlazado en el README) es una versión corta: muestra cinco pruebas funcionales e incluye la firma inválida del webhook, que este guion no filma. Quien graba narra con estas palabras, o muy cerca. La pantalla muestra la consola en el navegador y, un momento, la terminal en la raíz de este repositorio. No se muestra una clave real.

| Minuto | En pantalla | Narración |
| --- | --- | --- |
| 0:00–0:50 | Nada todavía, o la primera página del informe | Grab It compra para sus clientes y hoy alguien entra a cada transportadora para mover el estado a mano. Cuando la guía cambia, la anterior se pierde. El cliente ve el portal desactualizado y el equipo se entera tarde. |
| 0:50–1:30 | Este documento, sección 2, o `docker compose up` ya en marcha | El módulo vive en los servidores de la empresa. Recibe el evento, lo normaliza y devuelve una decisión: aplicar o retener. No reemplaza Control ni el portal. MySQL es el destino de producción; esta demostración usa SQLite, también dentro de Docker, para poder correrla sin ese servidor. |
| 1:30–2:00 | `bun test` en la terminal | Antes del recorrido, las historias de la operación pasan solas. Si una regla se rompe, la prueba falla. |
| 2:00–3:10 | Consola: Registrar compra, Guardar y probar, Enviar aviso, y la lista En curso / Ejecutadas | Se registra el pedido de Amazon. El aviso sale desde la misma pantalla, por el SMTP del proveedor. No se contrató Workspace ni el agregador. La extracción en curso pasa a ejecutada y la tarjeta muestra de quién llegó, qué guía se leyó y que quedó en el producto. |
| 3:10–4:20 | `bun run demo`, pasos 1 a 7 | Este otro recorrido, en la terminal, sigue el mismo producto por tres guías: Miami, courier y Deprisa. Un entregado en Doral deja el producto en bodega y enciende la alerta de la guía que falta. La entrega en Bogotá sí se aplica. |
| 4:20–5:20 | Pasos 8 y 9 del mismo demo | Otro producto, un monitor nacional para Bogotá. Su "entregado" llega desde Medellín y se retiene. El cliente seguiría viendo En camino. Cuando la transportadora reporta Bogotá, la prueba completa se cumple. Lo dudoso no llega al cliente. |
| 5:20–6:20 | `GRABIT_DB=data/demo.sqlite bun src/cli/main.ts ficha --producto audifonos` y, si se quiere, la ficha de la consola | La ficha conserva las tres guías, las observaciones y las decisiones. Nada se borra: una guía equivocada se anula con motivo y queda en la ficha. |
| 6:20–7:20 | «Leer ahora» una segunda vez, sin mostrar la contraseña de aplicación | La misma guía responde que ya estaba y no se duplica. La clave queda en el servidor. En Grab It el buzón es el que la empresa ya tiene. |
| 7:20–8:00 | Cierre | El trabajo repetido de consultar transportadoras sale de la persona. Le queda comprar, resolver la excepción y atender lo que el módulo retiene. Sobre la línea base de 300 horas al mes, esa es la palanca del 60% de esfuerzo que el piloto tiene que medir. |

No hace falta mostrar credenciales. Si un comando falla, se lee el mensaje y se vuelve a correr `bun test`: el estado de las pruebas es la evidencia de que el flujo sigue entero.

## 10. Límites conocidos

- No llama a 17TRACK ni a las API de las tiendas. No hay llaves de agregador en el repositorio y no se crearon cuentas a nombre del equipo. El webhook acepta el mismo sobre, firmado, con eventos de ejemplo.
- El lector cubre cinco formatos. El escaneo en vivo lee IMAP. Los textos de `fixtures/correos/` los usan las pruebas y el botón «Cargar correos de ejemplo» de la pantalla. El de Amazon tiene el mismo pedido y la misma guía que «Enviar aviso» y el workflow de n8n, así que, si se carga antes, el correo real responde `ya-estaba`.
- La consulta de seguimiento arma el resultado en el proceso, después de leer las tablas. No es todavía una sola sentencia SQL.
- La espera configurable de `delivered` existe en la política (`deliveredWaitMinutes`) y las pruebas cubren el apagado de un estado. El demo la deja en cero.
- La consola no es Control ni el portal del cliente. En producción, Grab It sigue aplicando la decisión con su sistema. El perfil MySQL de Docker no está cableado al proceso.
