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

La consola queda en `http://127.0.0.1:8787`. El aviso tiene que llegar a un buzón real. Para la sustentación basta una cuenta personal gratuita y vacía: Gmail (`imap.gmail.com`, 993, TLS y contraseña de aplicación), Yahoo o GMX. No hace falta Gmail Workspace. «Vigilar buzón» vuelve a leer la bandeja cada 45 segundos, porque IMAP no avisa solo. La clave se guarda en `data/mailbox.json` (permiso 600) y la API no la devuelve. Una guía ya registrada no se duplica.

El mensaje se redacta en el webmail de esa cuenta, dirigido a ella misma, con el pedido `112-4455667-1234567` y la guía `1Z999AA10123456784`. El pedido tiene que estar registrado antes, o la guía queda sin producto. Si la cuenta ya está guardada, desde esta carpeta también se puede entregar el mismo texto por el SMTP del proveedor:

```bash
bun run enviar
```

Con Docker, desde esta misma carpeta. El contenedor no incluye un servidor de correo:

```bash
docker compose up --build
```

El perfil `mysql` solo crea la base y carga el esquema para que TI lo revise. No cambia el motor del proceso:

```bash
docker compose --profile mysql up --build
```

`bun test` ejecuta las historias de operación, el flujo persistido y el lector de correo. `bun run demo` recorre en la consola un producto con tres guías y un entregado que no coincide con la ciudad del cliente.

La guía para desplegar, probar y grabar la demostración está en [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).
