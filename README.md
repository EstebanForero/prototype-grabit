# Seguimiento logístico — MVP

Módulo que convierte eventos de transportadora en una decisión de estado por producto. El estado se aplica solo cuando la evidencia alcanza; si no, se retiene y una persona entra únicamente en ese caso.

El prototipo corre en la máquina local con Bun y SQLite. No pide cuentas ni llaves. El esquema de producción, para MySQL en los servidores de Grab It, está en `migrations/001_mysql.sql`.

## Levantar

Hace falta [Bun](https://bun.sh) 1.1 o superior.

```bash
cd prototype
bun test
bun run demo
```

`bun test` ejecuta las historias de operación y el flujo persistido. `bun run demo` recorre en la consola un producto con tres guías y un entregado que no coincide con la ciudad del cliente.

La guía para desplegar, probar y grabar la demostración está en [docs/documentacion-tecnica.md](docs/documentacion-tecnica.md).
