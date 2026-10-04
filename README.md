# Seguimiento logístico — MVP

Módulo que convierte eventos de transportadora en una decisión de estado por producto. El estado se aplica solo cuando la evidencia alcanza; si no, se retiene y una persona entra únicamente en ese caso.

El prototipo corre con Bun y SQLite. La consola web permite registrar una compra, leer un buzón IMAP y cargar los correos de ejemplo sin una cuenta real. El esquema de producción, para MySQL en los servidores de Grab It, está en `migrations/001_mysql.sql`. El proceso de este paquete no abre esa conexión.

## Levantar

Hace falta [Bun](https://bun.sh) 1.1 o superior, o Docker.

```bash
cd prototype
bun install
bun test
bun run demo
bun run start
```

La consola queda en `http://127.0.0.1:8787`. En Buzón, «Cargar ejemplos» asocia las cinco tiendas de `fixtures/correos/` sin pedir una clave. Un buzón real usa IMAP; en Gmail hace falta una contraseña de aplicación. La clave se guarda en `data/mailbox.json` (permiso 600) y la API no la devuelve.

Con Docker, desde esta misma carpeta:

```bash
docker compose up --build
```

El perfil `mysql` solo crea la base y carga el esquema para que TI lo revise. No cambia el motor del proceso:

```bash
docker compose --profile mysql up --build
```

`bun test` ejecuta las historias de operación, el flujo persistido y el lector de correo. `bun run demo` recorre en la consola un producto con tres guías y un entregado que no coincide con la ciudad del cliente.

La guía para desplegar, probar y grabar la demostración está en [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).
