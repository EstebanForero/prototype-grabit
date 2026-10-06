# Seguimiento logístico — MVP

Módulo que convierte eventos de transportadora en una decisión de estado por producto. El estado se aplica solo cuando la evidencia alcanza; si no, se retiene y una persona entra únicamente en ese caso.

El prototipo corre con Bun y SQLite. La consola, en React, permite registrar una compra y leer un buzón IMAP de verdad. El esquema de producción, para MySQL en los servidores de Grab It, está en `migrations/001_mysql.sql`. El proceso de este paquete no abre esa conexión.

## Levantar

Hace falta [Bun](https://bun.sh) 1.1 o superior, o Docker.

```bash
cd prototype
bun install
bun test
cd web && bun install && bun run build && cd ..
bun run demo
bun run start
```

La consola queda en `http://127.0.0.1:8787`. El aviso tiene que llegar al buzón: Gmail con IMAP y contraseña de aplicación, u otro servidor IMAP. «Vigilar buzón» vuelve a leer la bandeja cada 45 segundos, porque IMAP no avisa solo. La clave se guarda en `data/mailbox.json` (permiso 600) y la API no la devuelve. Una guía ya registrada no se duplica.

Con Docker, desde esta misma carpeta, el comando también levanta un servidor SMTP (3025) e IMAP (3143) solo para la demostración. No es el buzón de Grab It y no pide autenticación:

```bash
docker compose up --build
```

Con el contenedor arriba, en Buzón se elige «Contenedor» (servidor `buzon`, puerto 3143, usuario `despacho@grabit.local`, clave `local`, sin TLS). Si el proceso corre con `bun run start` en la máquina y solo el correo está en Docker, se elige «Esta máquina» (`127.0.0.1`). Después, desde `prototype/`:

```bash
bun run enviar
```

Eso entrega un aviso de Amazon por SMTP. La pantalla lo ve al leer IMAP. El pedido `112-4455667-1234567` tiene que estar registrado antes, o la guía queda sin producto.

El perfil `mysql` solo crea la base y carga el esquema para que TI lo revise. No cambia el motor del proceso:

```bash
docker compose --profile mysql up --build
```

`bun test` ejecuta las historias de operación, el flujo persistido y el lector de correo. `bun run demo` recorre en la consola un producto con tres guías y un entregado que no coincide con la ciudad del cliente.

La guía para desplegar, probar y grabar la demostración está en [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).
