# Seguimiento logístico — MVP

Módulo que convierte eventos de transportadora en una decisión de estado por producto. El estado se aplica solo cuando la evidencia alcanza; si no, se retiene y una persona entra únicamente en ese caso.

El prototipo corre con Bun y SQLite. La consola es una aplicación React que se compila y el mismo proceso la sirve. El esquema de producción, para MySQL en los servidores de Grab It, está en `migrations/001_mysql.sql`. El proceso de este paquete no abre esa conexión.

Los comandos de esta página se ejecutan en la raíz de este repositorio, la carpeta que contiene `package.json` y `web/`.

## Documentación técnica

La documentación técnica está en [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).

Ese archivo es la guía para un tercero: arquitectura, componentes, consola, variables de entorno, Docker, unidad de systemd, ejecución, las 22 pruebas y el guion de la grabación. Este README deja el arranque, la consola y la configuración. El informe académico no está en este repositorio.

## Consola

El frontend vive en `web/`. Es React 19, Vite, Tailwind y componentes al estilo de shadcn. No es otro servidor y no reemplaza Control ni el portal.

La pantalla tiene tres pestañas, en este orden:

- **Cola de hoy.** Productos, estado, retención y ficha.
- **Buzón.** Registra la cuenta IMAP, prueba la conexión, envía el aviso por el SMTP del proveedor, enciende o detiene la vigilancia y lista las extracciones en curso y las ya ejecutadas. Cada extracción terminada muestra Llegó, Lectura y Producto. Una guía ya guardada queda como `ya-estaba`. Una tarjeta «sin producto» trae un formulario para vincular el pedido en el momento. El botón «Cargar correos de ejemplo» procesa los cinco correos de `fixtures/correos/` sin cuenta externa.
- **Registrar compra.** Alta del producto antes de que llegue la guía. Para el recorrido de sustentación: id `audifonos`, internacional, país CO, ciudad Bogotá, tienda Amazon, pedido `112-4455667-1234567`.

El correo de ejemplo de Amazon, «Enviar aviso» y el workflow de n8n usan el mismo pedido y la misma guía. Si se cargan los ejemplos antes del recorrido, el correo real ya no crea la guía: responde `ya-estaba`.

La compilación escribe archivos estáticos en `public/`. Esa carpeta no se versiona. Sin ella, `http://127.0.0.1:8787` responde 503 y el texto dice cómo compilar.

```bash
bun install
cd web && bun install && bun run build && cd ..
bun run start
```

`bun run consola` es el mismo build de `web/`. La consola queda en `http://127.0.0.1:8787`.

Para cambiar la interfaz con recarga, deje el proceso en el puerto 8787 y, en otra terminal, arranque Vite. El proxy de Vite reenvía `/api` a ese puerto. La interfaz de desarrollo queda en `http://127.0.0.1:5173`.

```bash
cd web && bun run dev
```

La imagen de Docker construye `web/` en una etapa propia y copia `public/` al proceso. En ese despliegue no hace falta compilar en el anfitrión.

La cuenta de la sustentación es personal y gratuita: Gmail (`imap.gmail.com`, 993, TLS y contraseña de aplicación), Yahoo o GMX. No hace falta Gmail Workspace. «Vigilar buzón» hace que el servidor vuelva a leer IMAP cada 45 segundos. «Enviar aviso» entrega el pedido `112-4455667-1234567` y la guía `1Z999AA10123456784`, enciende la vigilancia si estaba apagada y lanza una lectura unos 8 segundos después. El pedido tiene que estar registrado antes. El historial de extracciones queda en la SQLite del prototipo, con las últimas 40, y sobrevive a recargar. Reiniciar el proceso apaga la vigilancia; las filas quedan.

## Configurar

Copie el modelo y edítelo. `.env` no se versiona.

```bash
cp .env.example .env
```

| Variable | Valor de arranque | Qué hace |
| --- | --- | --- |
| `PORT` | `8787` | Puerto HTTP de la API y de la consola |
| `GRABIT_DB` | `data/seguimiento.sqlite` | Base del prototipo. En Docker el Compose la fija en `/data/seguimiento.sqlite` |
| `MAILBOX_FILE` | `data/mailbox.json` | Buzón guardado desde la pantalla, permiso 600. En Docker es `/data/mailbox.json` |
| `AGGREGATOR_SECRET` | hay que cambiarlo | Secreto HMAC del webhook. Si falta, el proceso usa `dev-secret` |
| `MAIL_HOST` | `imap.gmail.com` | Servidor IMAP. Si `MAIL_HOST`, `MAIL_USER` y `MAIL_PASSWORD` están definidos, pisan el archivo guardado |
| `MAIL_PORT` | `993` | Puerto IMAP |
| `MAIL_SECURE` | `true` | `false` apaga TLS. Gmail, Yahoo y GMX usan `true` |
| `MAIL_USER` | vacío | Cuenta. Vacío junto con la clave deja el alta para la pantalla |
| `MAIL_PASSWORD` | vacío | Contraseña de aplicación en Gmail y Yahoo. En GMX, la clave de la cuenta, con IMAP activado |
| `MAIL_MAILBOX` | `INBOX` | Carpeta |
| `SMTP_HOST` | `smtp.gmail.com` | Si se define, «Enviar aviso» y `bun run enviar` usan este servidor. Si queda vacío, Gmail, Yahoo o GMX se deducen del host IMAP. Con Yahoo o GMX, déjelo vacío o cámbielo: el valor del modelo fuerza Gmail |
| `SMTP_PORT` | `587` | Puerto SMTP cuando `SMTP_HOST` está definido. `587` usa STARTTLS y `465` usa TLS directo |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TO` | vacíos | Solo `bun run enviar`. La pantalla usa la cuenta ya guardada |

La API no devuelve la clave. Un guardado con la clave en blanco conserva la anterior. `GET /api/correo` informa si hay buzón y si la vigilancia está activa.

Presets de la pantalla: Gmail `imap.gmail.com:993`, Yahoo `imap.mail.yahoo.com:993`, GMX `imap.gmx.com:993`. El SMTP correspondiente, si no hay `SMTP_HOST`, es `smtp.gmail.com:587`, `smtp.mail.yahoo.com:587` o `mail.gmx.com:587`.

## Desplegar en esta máquina

Hace falta [Bun](https://bun.sh) 1.4, la misma versión de la imagen de Docker (`oven/bun:1.4.2`).

```bash
bun install
bun test
cd web && bun install && bun run build && cd ..
bun run start
```

Salud: `curl -s http://127.0.0.1:8787/health`. Tiene que responder `{"ok":true,"service":"grabit-seguimiento"}`.

`bun test` ejecuta las historias de operación, el flujo persistido y el lector de correo. Son 22 pruebas. `bun run demo` recorre en la terminal dos productos: los audífonos, con tres guías hasta la entrega en Bogotá, y un monitor nacional cuyo primer «entregado» llega desde Medellín y se retiene. Escribe en `data/demo.sqlite`, no en la base de la consola. Para ver la ficha del demo, apunte la CLI a esa base:

```bash
GRABIT_DB=data/demo.sqlite bun src/cli/main.ts ficha --producto audifonos
```

Con la cuenta ya guardada, este comando repite el mismo envío SMTP que el botón «Enviar aviso»:

```bash
bun run enviar
```

## Desplegar con Docker

Hace falta Docker con Compose 2.24 o superior, porque el `env_file` usa `required: false`. El Compose no incluye un servidor de correo. Si `.env` no define `AGGREGATOR_SECRET`, la imagen usa `dev-secret`; cámbielo antes de publicar el webhook. El nombre del proyecto deja este stack aparte de otros contenedores de la máquina.

```bash
docker compose -p grabit-seguimiento up --build -d
```

La consola queda en `http://127.0.0.1:8787`. Los datos quedan en el volumen `seguimiento-data`, que Docker nombra `grabit-seguimiento_seguimiento-data` por el proyecto. Para bajar solo este proyecto:

```bash
docker compose -p grabit-seguimiento down
```

El perfil `mysql` crea una base local y carga `migrations/001_mysql.sql` para que TI lo revise. El proceso sigue en SQLite.

```bash
docker compose -p grabit-seguimiento --profile mysql up --build -d
```

La raíz de ese MySQL es `grabit-local` y la base se llama `seguimiento`.

En los servidores de Grab It el mismo paquete puede quedar como unidad de systemd. Los pasos, el archivo de entorno y la unidad están en la sección 6 de [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).

## Demostración con n8n

Para la demostración, el correo del pedido sale de n8n, que corre en un contenedor aparte, y el módulo lo lee por IMAP desde la cuenta del buzón. n8n no forma parte del `docker-compose.yml`: se creó con `docker run`, escucha en `http://localhost:5678` y guarda sus workflows y credenciales en el volumen `n8n_data`. Ese contenedor no tiene política de reinicio, así que se enciende a mano después de apagar el equipo.

Ninguna clave va en este repositorio. La cuenta del buzón y su contraseña de aplicación se escriben en n8n y en la pestaña Buzón, y no se guardan en archivos versionados.

Los comandos de esta sección están escritos para PowerShell en Windows con Docker Desktop. En Linux o macOS son los mismos, con `curl` en lugar de `curl.exe`.

Pasos:

1. **Crear y encender n8n.** Solo la primera vez:

   ```powershell
   docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
   ```

   Si el puerto 5678 está ocupado o el nombre `n8n` ya existe, el comando falla: `docker ps -a --filter "name=n8n"` muestra si ya hay un contenedor. Espere unos 15 segundos y abra `http://localhost:5678`. En el primer acceso n8n pide crear una cuenta de propietario local (nombre, correo y contraseña). Esa cuenta solo existe en este n8n y no tiene relación con la cuenta del buzón. El nombre del volumen debe ser exactamente `n8n_data`; con otro nombre, n8n arranca vacío.

2. **Importar el workflow.** En n8n cree un workflow nuevo, abra el menú `⋯` de la esquina superior derecha y elija **Import from File**. Seleccione `correo de despacho workflow.json` de la raíz del repositorio. Los nodos que necesitan credenciales aparecen con una advertencia hasta que se configura la del paso siguiente.

   Antes del paso siguiente, genere una contraseña de aplicación para la cuenta de correo que va a usar. En Gmail se crea en `myaccount.google.com/apppasswords` y exige la verificación en dos pasos.

3. **Configurar el nodo Send an Email.** Haga doble clic en el nodo. Cree o edite la credencial SMTP: `User` es la cuenta del buzón, `Password` es su contraseña de aplicación, `Host` es `smtp.gmail.com`, puerto `465` con SSL/TLS activado. El workflow trae `From Email` y `To Email` de ejemplo; cámbielos por las cuentas que utilice. Guarde y pulse Execute workflow, y compruebe que el correo llegó a la bandeja. Si deja la credencial de otro correo y solo cambia el `To`, el correo también llega, pero el remitente que muestra la tarjeta de la consola sería ese otro correo. Por eso conviene cambiar también la credencial.

4. **Registrar el producto en el módulo.** Entre a `http://127.0.0.1:8787`, abra Registrar compra y registre el producto con tienda Amazon y pedido `112-4455667-1234567`, que es el pedido que lleva el correo del workflow. El pedido tiene que estar registrado antes de que el correo se lea; si no, la tarjeta queda como «sin producto».

5. **Conectar el buzón.** En la pestaña Buzón escriba el usuario y la contraseña de aplicación de esa cuenta (puede ser la misma que en n8n o una distinta). Pulse Guardar y probar: debe decir «Conexión correcta». Ponga «Días hacia atrás» en `1` para que solo lea los correos recientes. Al guardar, el módulo sustituye la cuenta anterior; no hace falta borrar nada.

6. **Probar el recorrido.** En n8n pulse Execute workflow para enviar el correo. En Buzón pulse «Leer ahora», o «Vigilar buzón» para que el módulo revise cada 45 segundos. Cuando la extracción termina, la tarjeta muestra Llegó, Lectura y Producto, y el producto queda con su guía. Si se lee otra vez, la guía responde `ya-estaba` y no se duplica.

### Volver a encender después de apagar el equipo

Los datos no se pierden: los volúmenes de Docker (el del módulo y el de n8n) sobreviven a un apagado. Solo hay que volver a encender los contenedores.

1. **Abrir Docker Desktop.** Espere a que abajo a la izquierda diga **Engine running**. Sin eso, ningún comando de Docker funciona.
2. **Levantar el módulo.** En la carpeta del proyecto:

   ```powershell
   docker compose -p grabit-seguimiento up -d
   ```

   Sin `--build`, porque la imagen ya está compilada. Con `restart: unless-stopped`, el contenedor puede haber arrancado solo al abrirse Docker; en ese caso el comando no hace nada y está bien. Compruebe:

   ```powershell
   docker compose -p grabit-seguimiento ps
   curl.exe -s http://127.0.0.1:8787/health
   ```

   Debe aparecer `Up (healthy)` y `{"ok":true,...}`.
3. **Levantar n8n.**

   ```powershell
   docker start n8n
   ```

   Espere unos 15 segundos y abra `http://localhost:5678`. Los workflows y las credenciales siguen ahí. Para que arranque solo en el futuro:

   ```powershell
   docker update --restart unless-stopped n8n
   ```

## Video de demostración

| Dato | Valor |
| --- | --- |
| Enlace | [youtube.com/watch?v=Q6-VDQ_lRcY](https://www.youtube.com/watch?v=Q6-VDQ_lRcY) |
| Duración | 05:03 |
| Contenido | Problemática, funcionalidad y cinco pruebas funcionales con narración |

Pruebas que se muestran, en orden:

1. El estado se aplica solo.
2. Entrega en Medellín (la decisión se retiene).
3. Entrega en Bogotá (el estado se aplica).
4. Una firma inválida, HTTP 401.
5. El mismo correo no duplica la guía.

El video es una versión corta. El guion completo, de unos 8 minutos, está en la sección 9 de [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).
