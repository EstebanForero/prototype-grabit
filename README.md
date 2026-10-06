# Seguimiento logístico — MVP

Módulo que convierte eventos de transportadora en una decisión de estado por producto. El estado se aplica solo cuando la evidencia alcanza; si no, se retiene y una persona entra únicamente en ese caso.

El prototipo corre con Bun y SQLite. La consola es una aplicación React que se compila y el mismo proceso la sirve. El esquema de producción, para MySQL en los servidores de Grab It, está en `migrations/001_mysql.sql`. El proceso de este paquete no abre esa conexión.

Los comandos de esta página se ejecutan en la raíz de este repositorio, la carpeta que contiene `package.json` y `web/`.

## Documentación técnica

La documentación técnica está en [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).

Ese archivo es la guía para un tercero: arquitectura, componentes, consola, variables de entorno, Docker, unidad de systemd, ejecución, las 22 pruebas y el guion de la grabación. Este README deja el arranque, la consola y la configuración. El informe académico no está en este repositorio.

## Consola

El frontend vive en `web/`. Es React 19, Vite, Tailwind y componentes al estilo de shadcn. No es otro servidor y no reemplaza Control ni el portal.

La pantalla tiene tres pestañas:

- **Cola de hoy.** Productos, estado, retención y ficha.
- **Registrar compra.** Alta del producto antes de que llegue la guía. Para el recorrido de sustentación: id `audifonos`, internacional, país CO, ciudad Bogotá, tienda Amazon, pedido `112-4455667-1234567`.
- **Buzón.** Registra la cuenta IMAP, prueba la conexión, envía el aviso por el SMTP del proveedor, enciende o detiene la vigilancia y lista las extracciones en curso y las ya ejecutadas. Cada extracción terminada muestra Llegó, Lectura y Producto. Una guía ya guardada queda como `ya-estaba`.

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

La cuenta de la sustentación es personal y gratuita: Gmail (`imap.gmail.com`, 993, TLS y contraseña de aplicación), Yahoo o GMX. No hace falta Gmail Workspace. «Vigilar buzón» hace que el servidor vuelva a leer IMAP cada 45 segundos. «Enviar aviso» entrega el pedido `112-4455667-1234567` y la guía `1Z999AA10123456784`. El pedido tiene que estar registrado antes. El historial de extracciones queda en la SQLite del prototipo y sobrevive a recargar. Reiniciar el proceso apaga la vigilancia; las filas quedan.

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
| `SMTP_HOST` | vacío | Si se define, «Enviar aviso» y `bun run enviar` usan este servidor. Si no, Gmail, Yahoo o GMX se deducen del host IMAP |
| `SMTP_PORT` | `587` | Puerto SMTP cuando `SMTP_HOST` está definido |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TO` | vacíos | Solo `bun run enviar`. La pantalla usa la cuenta ya guardada |

La API no devuelve la clave. Un guardado con la clave en blanco conserva la anterior. `GET /api/correo` informa si hay buzón y si la vigilancia está activa.

Presets de la pantalla: Gmail `imap.gmail.com:993`, Yahoo `imap.mail.yahoo.com:993`, GMX `imap.gmx.com:993`. El SMTP correspondiente, si no hay `SMTP_HOST`, es `smtp.gmail.com:587`, `smtp.mail.yahoo.com:587` o `mail.gmx.com:587`.

## Desplegar en esta máquina

Hace falta [Bun](https://bun.sh) 1.1 o superior.

```bash
bun install
bun test
cd web && bun install && bun run build && cd ..
bun run start
```

Salud: `curl -s http://127.0.0.1:8787/health`. Tiene que responder `{"ok":true,"service":"grabit-seguimiento"}`.

`bun test` ejecuta las historias de operación, el flujo persistido y el lector de correo. Son 22 pruebas. `bun run demo` recorre en la terminal un producto con tres guías y un entregado que no coincide con la ciudad del cliente. Escribe en `data/demo.sqlite`, no en la base de la consola.

Con la cuenta ya guardada, este comando repite el mismo envío SMTP que el botón «Enviar aviso»:

```bash
bun run enviar
```

## Desplegar con Docker

Hace falta Docker. El Compose no incluye un servidor de correo. El nombre del proyecto deja este stack aparte de otros contenedores de la máquina.

```bash
docker compose -p grabit-seguimiento up --build -d
```

La consola queda en `http://127.0.0.1:8787`. Los datos quedan en el volumen `seguimiento-data`. Para bajar solo este proyecto:

```bash
docker compose -p grabit-seguimiento down
```

El perfil `mysql` crea una base local y carga `migrations/001_mysql.sql` para que TI lo revise. El proceso sigue en SQLite.

```bash
docker compose -p grabit-seguimiento --profile mysql up --build -d
```

La raíz de ese MySQL es `grabit-local` y la base se llama `seguimiento`.

En los servidores de Grab It el mismo paquete puede quedar como unidad de systemd. Los pasos, el archivo de entorno y la unidad están en la sección 6 de [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).
