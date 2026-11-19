#set page(paper:"a4", margin:(x:19mm,y:19mm), header:align(right)[#text(size:8pt,fill:rgb("5E6B76"))[GRAB IT · Documentación final]],footer:context align(right)[#text(size:8pt,fill:rgb("5E6B76"))[#counter(page).display()]])
#set text(font:"Fira Sans",size:10pt,lang:"es",fill:rgb("17212B"))
#set par(justify:true,leading:0.63em)
#set heading(numbering:none)
#show heading.where(level:1):it=>block(above:12pt,below:15pt)[#text(size:26pt,weight:"bold",fill:rgb("17324D"))[#it.body]#v(6pt)#line(length:100%,stroke:2pt+rgb("64CCC5"))]
#show heading.where(level:2):it=>block(above:16pt,below:7pt)[#text(size:15pt,weight:"bold",fill:rgb("17324D"))[#it.body]]
#show heading.where(level:3):it=>block(above:10pt,below:5pt)[#text(size:11pt,weight:"bold",fill:rgb("176B87"))[#it.body]]
#set figure(gap:5pt)
#show figure.caption:set text(size:8pt,fill:rgb("5E6B76"))

#let navy=rgb("17324D")
#let blue=rgb("176B87")
#let cyan=rgb("64CCC5")


#set heading(numbering:none)
#show heading.where(level:2):it=>block(above:15pt,below:7pt)[#text(size:14pt,weight:"bold",fill:navy)[#it.body]]
#show heading.where(level:3):it=>block(above:10pt,below:5pt)[#text(size:11pt,weight:"bold",fill:blue)[#it.body]]


#heading(level: 1, numbering: none)[Documentación técnica del MVP]
#line(length: 100%, stroke: 1pt + cyan)


#text[#text("GRAB IT · Seguimiento logístico multicanal · Documentación técnica · 18 de noviembre de 2026")]

#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/docs/README.md")[#text("Centro de documentación")]#text(" · ")#link("https://github.com/EstebanForero/prototype-grabit/blob/master/docs/manual-usuario.md")[#text("Manual de usuario")]#text(" · ")#link("https://github.com/EstebanForero/prototype-grabit")[#text("Código fuente")]#text(" · ")#link("https://www.youtube.com/watch?v=Q6-VDQ_lRcY")[#text("Video del MVP (5:03)")]]

#text[#text("Versión de la implementación: ")#link("https://github.com/EstebanForero/prototype-grabit/tree/babc0da34f2caffc9a9192274b681e00c532394c")[#text("babc0da")]#text(". El historial del repositorio conserva las revisiones del código y de su documentación.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("1. Propósito y alcance real")]]

#text[#text("Esta guía permite instalar, ejecutar, probar y mantener el módulo de seguimiento. Los comandos se ejecutan en la raíz del código fuente, donde están package.json, src y web. La lectura opcional de IA de la sección 4 amplía la interpretación de textos y mantiene las reglas como respaldo. El módulo registra compras y cadenas de guías, extrae guías de correos de despacho y transforma eventos en una decisión por producto: aplicar o retener. La consola se dirige a Compras y operación; la consola constituye la interfaz entregada y no sustituye Control ni el portal existentes. El alcance funcional se dio por concluido y aceptado en la reunión con el cliente.")]

#text[#text("La implementación entregada usa SQLite, también en Docker. La conexión real con 17TRACK v2.2 está implementada y funcionando con la cuenta y las APIs disponibles. MySQL se conserva como esquema de referencia de portabilidad. El modo de respuestas grabadas es una herramienta adicional para reproducir pruebas sin red; complementa la integración real operativa.")]

#text[#text("La consola se opera en el equipo o la red interna controlada prevista para su uso. Sus rutas no implementan una sesión propia: el acceso se administra en el entorno donde se ejecuta. La custodia de credenciales, el respaldo y la revisión de operaciones administrativas son tareas de mantenimiento de la solución aceptada, responsabilidades de operación.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("2. Arquitectura y componentes")]]

#text[#text("El flujo es: correo IMAP o API/webhook de 17TRACK → normalización → observaciones persistidas → motor de decisión → estado aplicado o retenido → consola.")]

#text[#text(" Cada producto puede compartir una guía con otros productos y conservar una sucesión de tramos. Una guía siguiente se diferencia de una caja paralela.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Componente")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Archivo o carpeta")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Responsabilidad"))),
[#text[#text("Contrato")]],
[#text[#text("src/contract.ts")]],
[#text[#text("Estados, etiquetas, política y tipos comunes")]],
[#text[#text("Decisión")]],
[#text[#text("src/core/decision.ts")]],
[#text[#text("Función pura que determina aplicar o retener")]],
[#text[#text("Alertas")]],
[#text[#text("src/core/alerts.ts")]],
[#text[#text("Siete clases de alerta operacional")]],
[#text[#text("Normalización")]],
[#text[#text("src/core/normalize.ts")]],
[#text[#text("Estados externos, forma de guías y texto original")]],
[#text[#text("Persistencia")]],
[#text[#text("src/data/store.ts")]],
[#text[#text("Registro, asociación, historial y decisiones en SQLite")]],
[#text[#text("Correo")]],
[#text[#text("src/providers/email.ts, mime.ts, mailbox.ts")]],
[#text[#text("Lectura, extracción y asociación tienda + pedido")]],
[#text[#text("Lectura asistida por IA")]],
[#text[#text("src/providers/status-model.ts")]],
[#text[#text("Clasifica texto de eventos con xAI, valida respuesta y conserva reglas de respaldo")]],
[#text[#text("Seguimiento")]],
[#text[#text("src/providers/track17.ts, track17-sync.ts")]],
[#text[#text("Cliente API real o grabado y sincronización")]],
[#text[#text("Webhooks")]],
[#text[#text("src/providers/webhook.ts; src/http/server.ts")]],
[#text[#text("Recepción y comprobación de firmas")]],
[#text[#text("Envío de aviso")]],
[#text[#text("src/providers/smtp.ts")]],
[#text[#text("Correo de ejemplo por SMTP")]],
[#text[#text("Consola")]],
[#text[#text("web/")]],
[#text[#text("React compilado y servido por Bun")]],
[#text[#text("CLI")]],
[#text[#text("src/cli/")]],
[#text[#text("Operación y demostraciones sin navegador")]],
[#text[#text("Esquemas")]],
[#text[#text("src/data/schema.sql; migrations/001_mysql.sql")]],
[#text[#text("SQLite ejecutado; MySQL de referencia")]],
[#text[#text("Workflow opcional")]],
[#text[#text("correo de despacho workflow.json")]],
[#text[#text("n8n envía el aviso de demostración")]],
)]

#heading(level: 3, numbering: none, outlined: false)[#text[#text("Tecnologías y dependencias")]]

#text[#text("Bun ejecuta TypeScript, HTTP, pruebas y bun:sqlite. La imagen Docker fija oven/bun:1.4.2; la verificación de la implementación utilizó Bun 1.4.4. La dependencia del backend es imapflow 2.2.4 según bun.lock. El frontend usa React 19, Vite 7, TypeScript 5.9, Tailwind 4 y Radix; web/bun.lock conserva las versiones resueltas. Los comandos con --frozen-lockfile evitan resolver versiones distintas.")]

#text[#text("Node por sí solo no ejecuta este paquete, pues depende de bun:sqlite y Bun.serve. Una migración a Node exige sustituir esas interfaces. Docker Compose 2.24 o posterior interpreta env_file con required: false. El perfil opcional mysql usa MySQL 8.4.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("3. Instalación reproducible")]]

#heading(level: 3, numbering: none, outlined: false)[#text[#text("Opción A: Bun")]]

#text[#text("Requisitos: Git, Bun 1.4 y acceso a los paquetes durante la instalación. El recorrido de pruebas y demostración puede ejecutarse después sin buzón ni cuenta de 17TRACK.")]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("git clone https://github.com/EstebanForero/prototype-grabit.git\ncd prototype-grabit\ngit checkout babc0da34f2caffc9a9192274b681e00c532394c\nbun install --frozen-lockfile\nbun test\ncd web\nbun install --frozen-lockfile\nbun run build\ncd ..\nTRACK17_MODE=mock bun run start", block: true)
]

#text[#text("Abra http://127.0.0.1:8787. La carpeta public se genera al compilar web; no viene versionada. Sin public/index.html, la raíz responde HTTP 503 con instrucciones de compilación. Para comprobar salud:")]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("curl -s http://127.0.0.1:8787/health", block: true)
]

#text[#text("Debe aparecer ok: true y service: grabit-seguimiento. El objeto track17 informa configuración; su indicador apiReady depende de que también existan correo y contraseña de la consola de 17TRACK. No sustituye una consulta real de la API.")]

#text[#text("En Windows PowerShell, establezca $env:TRACK17_MODE=\"mock\" y luego ejecute bun run start. Para terminar el servidor local use Ctrl+C. Durante desarrollo, bun run dev dentro de web abre Vite en 5173 con proxy /api hacia 8787.")]

#heading(level: 3, numbering: none, outlined: false)[#text[#text("Opción B: Docker")]]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("cp .env.example .env\n# Edite .env y establezca TRACK17_MODE=mock para la demostración.\ndocker compose -p grabit-seguimiento up --build -d\ndocker compose -p grabit-seguimiento ps", block: true)
]

#text[#text("La imagen compila el frontend y conserva los datos en el volumen grabit-seguimiento_seguimiento-data, montado en /data. Compose publica 8787 en el equipo anfitrión; revise las reglas de red antes de ejecutarlo en una máquina compartida. Para detener sin borrar los datos:")]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("docker compose -p grabit-seguimiento down", block: true)
]

#text[#text("No agregue --volumes si quiere conservar los datos. El perfil siguiente solo permite inspeccionar el esquema MySQL y no migra ni cambia la base del módulo:")]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("docker compose -p grabit-seguimiento --profile mysql up --build -d", block: true)
]

#text[#text("Ese servicio de demostración usa la base seguimiento y una contraseña local incluida en Compose. No debe publicarse como servidor productivo. En Linux puede ejecutarse el mismo proceso con un usuario de servicio y systemd: WorkingDirectory debe ser la raíz instalada; ExecStart debe apuntar al Bun instalado y a src/http/server.ts; EnvironmentFile debe contener la configuración protegida. El usuario necesita escritura únicamente en los directorios de datos.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("4. Configuración e integraciones")]]

#text[#text("Copie .env.example a .env solo cuando necesite configuración persistente. No incluya .env, mailbox.json ni bases con datos personales en el control de versiones. Para una demostración sin red, deje vacías las credenciales y fuerce TRACK17_MODE=mock.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Variable")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Valor por defecto o referencia")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Función"))),
[#text[#text("PORT")]],
[#text[#text("8787")]],
[#text[#text("HTTP de consola y API")]],
[#text[#text("GRABIT_DB")]],
[#text[#text("data/seguimiento.sqlite")]],
[#text[#text("Ruta de SQLite; Docker fija /data/seguimiento.sqlite")]],
[#text[#text("MAILBOX_FILE")]],
[#text[#text("data/mailbox.json")]],
[#text[#text("Cuenta guardada desde la consola; permiso 600")]],
[#text[#text("AGGREGATOR_SECRET")]],
[#text[#text("dev-secret si se omite")]],
[#text[#text("HMAC del webhook genérico; sustituir antes de exponerlo")]],
[#text[#text("MAIL_HOST / PORT / SECURE")]],
[#text[#text("Modelo: imap.gmail.com / 993 / true")]],
[#text[#text("Servidor IMAP y TLS")]],
[#text[#text("MAIL_USER / PASSWORD / MAILBOX")]],
[#text[#text("Sin cuenta; INBOX")]],
[#text[#text("Usuario, contraseña de aplicación y carpeta")]],
[#text[#text("SMTP_HOST / PORT")]],
[#text[#text("Inferido de IMAP; 587")]],
[#text[#text("Envío del aviso; 465 usa TLS directo")]],
[#text[#text("SMTP_USER / PASSWORD / TO")]],
[#text[#text("Cuenta guardada si falta")]],
[#text[#text("Sobrescritura solo para bun run enviar")]],
[#text[#text("TRACK17_TOKEN")]],
[#text[#text("Vacío")]],
[#text[#text("Llave 17token; habilita API real por defecto")]],
[#text[#text("TRACK17_MODE")]],
[#text[#text("live con token; mock sin token")]],
[#text[#text("Fuerza mock o live; live exige token")]],
[#text[#text("TRACK17_EMAIL / PASSWORD")]],
[#text[#text("Vacíos")]],
[#text[#text("Datos de consola 17TRACK; no sustituyen la llave API")]],
[#text[#text("TRACK17_CONSOLE_URL")]],
[#text[#text("https://user.17track.net/es")]],
[#text[#text("Dirección de consola informativa")]],
[#text[#text("XAI_API_KEY")]],
[#text[#text("Vacía")]],
[#text[#text("Llave privada de xAI; habilita la lectura flexible del texto en el servidor")]],
[#text[#text("XAI_MODEL")]],
[#text[#text("grok-4.7")]],
[#text[#text("Identificador de modelo solicitado a la API")]],
[#text[#text("GRABIT_STATUS_MODEL")]],
[#text[#text("Automático; off la desactiva")]],
[#text[#text("Permite desactivar la lectura de IA sin modificar las reglas")]],
)]

#text[#text("MAIL_HOST, MAIL_USER y MAIL_PASSWORD completos tienen prioridad sobre mailbox.json. Guardar la cuenta en Buzón conserva la clave anterior si el nuevo campo queda vacío. La respuesta de la API no devuelve la contraseña, pero mailbox.json la almacena en texto legible con permiso de archivo 600; requiere protección del servidor y de los respaldos.")]

#text[#text("El vigilante de IMAP se ejecuta en el servidor cada 45 segundos. Al guardar una cuenta se activa; al reiniciar se activa de nuevo si se carga una cuenta válida. El historial conserva las 40 extracciones más recientes. Una lectura examina como máximo 30 mensajes dentro del periodo solicitado; capacidad y recuperación de atrasos se supervisan durante la operación.")]

#heading(level: 3, numbering: none, outlined: false)[#text[#text("17TRACK y webhooks")]]

#text[#text("Operación con la API real ya disponible: conserve TRACK17_TOKEN en la configuración protegida y utilice TRACK17_MODE=live. Ejecute bun run start. El servidor utiliza la conexión real para consultar e importar guías; el token no se imprime ni se incorpora al informe. El modo mock se reserva a los ejemplos de práctica y a las pruebas sin red.")]

#text[#text("El cliente utiliza https://api.17track.net/track/v2.2 con POST register, gettrackinfo y gettracklist y el encabezado 17token. Consultar una guía puede registrarla en la cuenta. Traer registradas pagina hasta diez páginas y consulta eventos en grupos de 40; no es una sincronización ilimitada. La cuota y el volumen de la cuenta se administran como parte de la operación de la conexión real.")]

#text[#text("POST /webhooks/aggregator exige x-aggregator-signature con HMAC-SHA256 del cuerpo exacto y AGGREGATOR_SECRET. POST /webhook/17track procesa TRACKING_UPDATED y compara el encabezado sign con SHA256(cuerpo + \"/\" + TRACK17_TOKEN), cuando hay token. Si falta el token, el endpoint nativo no verifica firma: debe permanecer inaccesible desde internet. Las pruebas cubren firma inválida y válida con token. No hay protección implementada contra repetición por antigüedad del mensaje; la deduplicación evita repetir observaciones iguales.")]

#text[#text("La importación de guías puede crear productos auxiliares; consultar una guía desconocida asume Amazon, destino Bogotá y modo internacional. Compras debe validar asociación, destino y modalidad antes de aceptar esos registros como datos de negocio. La importación de guías y la asociación con compras se documentan por separado de cualquier adaptación del sistema Control.")]

#text[#text("Las tiendas cubiertas por el parser son Amazon, Mercado Libre, eBay, Alibaba y Homecenter. No hay conectores autenticados de pedidos con las API de esas tiendas. n8n es opcional para enviar el correo de prueba; el workflow necesita credenciales SMTP del usuario. El backend también puede enviar el aviso directamente con la consola o bun run enviar.")]

#heading(level: 3, numbering: none, outlined: false)[#text[#text("Lectura de texto con IA (xAI)")]]

#text[#text("src/providers/status-model.ts llama a POST https://api.x.ai/v1/responses desde el servidor cuando existe XAI_API_KEY. El modelo solicitado por defecto es grok-4.7; puede cambiarse con XAI_MODEL. Para desactivar esta función, establezca GRABIT_STATUS_MODEL=off y reinicie el proceso. La llave nunca se envía al navegador.")]

#text[#text("La lectura se usa en dos situaciones: un evento de seguimiento quedó como unknown después de normalizarlo, o las reglas del correo solo obtuvieron picked_up y se busca interpretar mejor el texto. La respuesta se limita a los códigos del contrato, ciudad, país y un motivo breve. La incorporación al estado continúa pasando por el motor de decisión: destino, tramos y evidencia siguen siendo relevantes. Un aviso claro de despacho no se convierte en entrega aunque el modelo responda delivered.")]

#text[#text("El pedido pide no inventar ubicaciones, y la integración valida el código y la estructura de salida. La función conserva los valores obtenidos por las reglas y no reduce un evento que estas ya entendieron. Si el proveedor falla, devuelve una salida inválida o supera el tiempo de espera de 20 segundos, se conserva la lectura por reglas; no se detiene la operación por faltar la respuesta de IA.")]

#text[#text("Esta integración transmite hasta los primeros 4.000 caracteres del correo o evento al proveedor xAI y, en lectura de correo, puede incluir la ciudad y el país del cliente como contexto. TI administra la llave, el consumo, los datos autorizados y el acceso de red en el entorno aceptado. Las pruebas usan respuestas inyectadas y no consumen una cuenta real del modelo.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("5. Modelo de datos y reglas")]]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Tabla SQLite")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Clave / relación")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Contenido"))),
[#text[#text("products")]],
[#text[#text("id")]],
[#text[#text("Estado, modo, destino y tienda + pedido")]],
[#text[#text("shipments")]],
[#text[#text("id; continues_from_id")]],
[#text[#text("Tramos, guía, destino, origen y anulación")]],
[#text[#text("shipment_products")]],
[#text[#text("shipment_id + product_id")]],
[#text[#text("Relación muchos a muchos")]],
[#text[#text("observations")]],
[#text[#text("id; dedupe_key UNIQUE")]],
[#text[#text("Evento, lugar, fuente, cuerpo original y fecha")]],
[#text[#text("decisions")]],
[#text[#text("id; product_id")]],
[#text[#text("Aplicar/retener, comprobaciones y motivos")]],
[#text[#text("notes")]],
[#text[#text("id; shipment_id")]],
[#text[#text("Respuestas humanas e historial")]],
[#text[#text("module_events")]],
[#text[#text("id; product_id")]],
[#text[#text("Avisos de aplicación, retención y alertas")]],
[#text[#text("extraction_runs")]],
[#text[#text("id")]],
[#text[#text("Ejecución de correo, conteos y resultados")]],
)]

#text[#text("SQLite define índices para búsqueda por producto, envío y fecha de decisión. El esquema MySQL propone claves foráneas y tipos JSON; no contiene extraction_runs. Si se acuerda una variante MySQL en el futuro, su adaptación incluirá esa tabla, persistencia, identificadores, fechas y pruebas de integridad. La versión aceptada usa SQLite y no requiere ejecutar esa migración.")]

#text[#text("Los estados decididos son pre_alerted, in_warehouse, shipped, in_transit y delivered. Grab It los traduce al cliente como Alistamiento, Enviado, En camino y Entregado, manteniendo Comprado como inicio del recorrido. El contrato admite otros estados de compra y cancelación que el módulo no decide automáticamente.")]

#text[#text("Un evento antiguo no hace retroceder el producto. Una etiqueta creada no demuestra movimiento. Para entregado se verifica que el tramo sea al cliente, que el destino coincida, que las cajas necesarias estén entregadas y que no existan alertas impeditivas. La política predeterminada habilita los cinco estados, espera cero minutos para delivered, alerta de silencio a cinco días internacional o dos nacional y guía no encontrada a 48 horas. Los objetivos operacionales del informe no son resultados medidos por estas reglas.")]

#text[#text("Anular una guía preserva el registro y guarda el motivo. En cambio, Quitar usa DELETE /api/productos/{id}: elimina el producto y decisiones, y también observaciones de guías no compartidas. No tiene papelera. Ese botón es para datos descartables de la demostración; la operación real requiere un procedimiento de conservación aprobado.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("6. Referencia de API")]]

#text[#text("Base local: http://127.0.0.1:8787. Cuerpos de entrada y salida en JSON. Los endpoints administrativos carecen de autenticación propia en esta implementación.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Método y ruta")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Entrada principal")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Resultado"))),
[#text[#text("GET /health o /api/salud")]],
[#text[#text("Ninguna")]],
[#text[#text("Salud y configuración de 17TRACK")]],
[#text[#text("GET /api/seguimiento")]],
[#text[#text("Ninguna")]],
[#text[#text("Cola de productos con estado y alertas")]],
[#text[#text("POST /api/productos")]],
[#text[#text("mode, customerCountry; id, customerCity, store, storeOrderNumber opcionales")]],
[#text[#text("Producto; HTTP 201")]],
[#text[#text("GET /api/productos/{id}")]],
[#text[#text("ID en ruta")]],
[#text[#text("Ficha y recorrido")]],
[#text[#text("DELETE /api/productos/{id}")]],
[#text[#text("ID en ruta")]],
[#text[#text("Eliminación permanente; ok")]],
[#text[#text("GET /api/correo")]],
[#text[#text("Ninguna")]],
[#text[#text("Configuración pública y vigilancia")]],
[#text[#text("POST /api/correo")]],
[#text[#text("host, user, password; port, secure, mailbox")]],
[#text[#text("Guarda cuenta y activa vigilancia")]],
[#text[#text("POST /api/correo/probar")]],
[#text[#text("Ninguna")]],
[#text[#text("Prueba conexión IMAP")]],
[#text[#text("POST /api/correo/escanear")]],
[#text[#text("sinceDays opcional")]],
[#text[#text("Última extracción")]],
[#text[#text("POST /api/correo/vigilar")]],
[#text[#text("active; sinceDays opcional")]],
[#text[#text("Inicia o detiene vigilancia")]],
[#text[#text("GET /api/correo/procesos")]],
[#text[#text("Ninguna")]],
[#text[#text("Vigilancia y últimas 40 lecturas")]],
[#text[#text("POST /api/correo/enviar")]],
[#text[#text("step: aviso o entrega")]],
[#text[#text("Envía aviso de ejemplo por SMTP")]],
[#text[#text("POST /api/correo/ejemplos")]],
[#text[#text("Ninguna")]],
[#text[#text("Procesa nueve archivos sintéticos")]],
[#text[#text("POST /api/correo/vincular")]],
[#text[#text("store, storeOrderNumber, trackingNumber y destino")]],
[#text[#text("Crea producto y asocia guía")]],
[#text[#text("POST /api/17track/consultar")]],
[#text[#text("number o trackingNumber")]],
[#text[#text("Registra, consulta y devuelve estado")]],
[#text[#text("POST /api/17track/traer")]],
[#text[#text("Ninguna")]],
[#text[#text("Importa guías; saved, updated, failed")]],
[#text[#text("POST /api/demo/17track")]],
[#text[#text("Ninguna")]],
[#text[#text("Ejecuta casos de demo en la base activa")]],
[#text[#text("POST /webhooks/aggregator")]],
[#text[#text("Cuerpo firmado genérico")]],
[#text[#text("received y resultados")]],
[#text[#text("POST /webhook/17track")]],
[#text[#text("Cuerpo TRACKING_UPDATED y sign")]],
[#text[#text("received y resultados")]],
)]

#text[#text("El servidor devuelve 400 ante errores de entrada y muchos fallos operacionales, 404 cuando el mensaje indica entidad inexistente, 401 ante firma inválida y 422 si el webhook genérico no tiene eventos reconocibles. No existe un esquema OpenAPI generado. Revise src/http/server.ts al ampliar el contrato.")]

#text[#text("Ejemplo mínimo sin credenciales:")]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("curl -X POST http://127.0.0.1:8787/api/productos \\\n  -H 'content-type: application/json' \\\n  -d '{\"id\":\"audifonos\",\"mode\":\"international\",\"customerCountry\":\"CO\",\n\"customerCity\":\"Bogotá\",\"store\":\"amazon\",\n\"storeOrderNumber\":\"112-4455667-1234567\"}'\ncurl -X POST http://127.0.0.1:8787/api/correo/ejemplos\ncurl -s http://127.0.0.1:8787/api/productos/audifonos", block: true)
]

#text[#text("Los saltos de línea dentro del JSON son válidos. En PowerShell use los formularios de la consola o adapte el entrecomillado; curl.exe no interpreta las comillas como Bash.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("7. Ejecución, pruebas y evidencia")]]

#block(width: 100%, fill: rgb("F5F7F9"), inset: 8pt, radius: 3pt, breakable: true)[#set text(size: 7.5pt, font: "DejaVu Sans Mono")
#raw("bun test\nbun run demo\nGRABIT_DB=data/demo.sqlite bun src/cli/main.ts ficha --producto audifonos\nTRACK17_MODE=mock bun run demo:17track", block: true)
]

#text[#text("bun run demo recrea data/demo.sqlite; demo:17track recrea data/demo-17track.sqlite. No los use como nombre de una base que quiera conservar. El servidor usa data/seguimiento.sqlite salvo configuración distinta. La demo HTTP de 17TRACK, a diferencia de la CLI, usa la base activa del servidor: resérvela para una instalación descartable.")]

#text[#text("Resultados de verificación: las dependencias se instalaron con sus archivos de bloqueo; bun test aprobó 43 pruebas, cero fallos y 159 comprobaciones en cuatro archivos. También pasó la compilación del frontend con TypeScript y Vite. La suite automatizada utiliza servicios simulados y datos sintéticos. La conectividad con servicios externos y los procedimientos de restauración se supervisan mediante las pruebas operativas descritas en este manual.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Archivo")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Pruebas")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Cobertura"))),
[#text[#text("tests/stories.test.ts")]],
[#text[#text("14")]],
[#text[#text("Tramos, destinos, silencio, entrega parcial, política y normalización")]],
[#text[#text("tests/flow.test.ts")]],
[#text[#text("5")]],
[#text[#text("Persistencia, guía compartida, anulación, correo y firma HMAC")]],
[#text[#text("tests/mail.test.ts")]],
[#text[#text("12")]],
[#text[#text("MIME, tiendas, asociación, estados sucesivos y lectura de IA con protección de despacho")]],
[#text[#text("tests/track17.test.ts")]],
[#text[#text("12")]],
[#text[#text("Parser ampliado, modo real con red simulada, cronología y firma nativa")]],
)]

#text[#text("Los correos y guías de fixtures son sintéticos. Para comprobar una integración real use una cuenta de prueba autorizada, fuerce TRACK17_MODE=live, cargue la llave de API y documente fecha, guía, transportadora y respuesta, sin publicar credenciales. El ")#link("https://www.youtube.com/watch?v=Q6-VDQ_lRcY")[#text("video narrado del MVP")]#text(", de 5:03, muestra el problema, la solución y cinco comprobaciones funcionales: aplicación automática de estado, entrega en ciudad incorrecta retenida, entrega en destino correcto aplicada, firma inválida rechazada y correo repetido sin duplicar la guía. La grabación constituye evidencia audiovisual de esos comportamientos.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("8. Operación y mantenimiento")]]

#text[#text("Responsable TI: revisar salud, espacio, errores de sincronización y respaldo. Responsable Compras: validar asociaciones, destinos y tarjetas retenidas. Responsable del proyecto: conservar el cierre acordado con el cliente y comparar los indicadores de operación con el modelo de beneficios.")]

#text[#text("Respaldo local sencillo: detener el proceso o contenedor, copiar SQLite y la configuración protegida a una ubicación segura, reiniciar y comprobar /health. No copie una base activa sin un mecanismo consistente de SQLite. Pruebe restauración en una carpeta distinta, con TRACK17_MODE=mock y credenciales vacías, y compruebe productos, observaciones y decisiones. La periodicidad, retención y objetivos de recuperación corresponden al plan de mantenimiento del entorno de operación.")]

#text[#text("Si cambia un formato de tienda, siga el procedimiento de mantenimiento asistido por IA de la sección 10. El parser debe devolver un error ante datos ambiguos. Conserve bun.lock y web/bun.lock y ejecute pruebas y compilación después de actualizar dependencias.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 2fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Síntoma")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Comprobación y acción"))),
[#text[#text("Página 503")]],
[#text[#text("Compilar web y verificar public/index.html")]],
[#text[#text("Puerto ocupado")]],
[#text[#text("Detener otra instancia o establecer PORT distinto")]],
[#text[#text("No llegan correos")]],
[#text[#text("Verificar cuenta, IMAP/TLS, periodo consultado y vigilancia")]],
[#text[#text("Correo sin producto")]],
[#text[#text("Comparar tienda + pedido; vincular con destino correcto")]],
[#text[#text("Ya estaba")]],
[#text[#text("Deduplicación normal; no borrar para volver a ingresar")]],
[#text[#text("17TRACK sin eventos")]],
[#text[#text("Revisar modo, token, rechazo y cuota; conservar estado actual")]],
[#text[#text("Firma 401")]],
[#text[#text("Usar el cuerpo exacto y el secreto/token correspondiente")]],
[#text[#text("Estado retenido")]],
[#text[#text("Revisar destino, fechas, cajas y motivo; no forzar entregado")]],
[#text[#text("Datos no aparecen")]],
[#text[#text("Comprobar GRABIT_DB; demo y servidor usan bases diferentes")]],
)]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("9. Alcance de operación y continuidad")]]

#text[#text("La operación del módulo se realiza en el entorno interno autorizado, con persistencia SQLite e integración real con 17TRACK. La continuidad requiere gestión de secretos, verificación de firmas de webhook, respaldo, conservación del historial, monitoreo y administración de cuota. Las adaptaciones de infraestructura o identidad corporativa deben documentarse y validarse antes de incorporarse.")]

#text[#text("Fuentes de esta guía: código, esquema, archivos de bloqueo y pruebas del commit indicado; documentación original del repositorio; manual de usuario y capturas sintéticas incluidos en docs. El historial del repositorio permite identificar las versiones del código y de su documentación.")]


#heading(level: 2, numbering: none, outlined: false)[#text[#text("10. Mantenimiento asistido por IA del lector de correos")]]

#text[#text("El repositorio incorpora un arnés de ingeniería para un agente de programación (Grok CLI) que ayuda a adaptar src/providers/email.ts cuando una tienda cambia su correo de despacho. Este arnés es una segunda aplicación de IA, distinta de la lectura de eventos de xAI descrita en la sección 4. El agente propone cambios de código; las comprobaciones y una revisión humana controlan su incorporación.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Pieza")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Ubicación")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Función"))),
[#text[#text("Instrucciones del proyecto")]],
[#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/AGENTS.md")[#text("AGENTS.md")]]],
[#text[#text("Define alcance, resultado esperado y archivos protegidos")]],
[#text[#text("Procedimiento del agente")]],
[#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/.grok/skills/registrar-correo-despacho/SKILL.md")[#text("Skill de registro de correo")]]],
[#text[#text("Pasos para reproducir el fallo, ajustar y comprobar")]],
[#text[#text("Referencia del negocio")]],
[#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/docs/harness/referencia-correos.md")[#text("Formatos y contrato")]]],
[#text[#text("Tiendas, pedidos, guías y casos ambiguos")]],
[#text[#text("Memoria entre sesiones")]],
[#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/harness/memoria")[#text("harness/memoria/")]]],
[#text[#text("Conserva progreso, decisiones y errores")]],
[#text[#text("Casos permanentes")]],
[#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/harness/regresion")[#text("harness/regresion/")]]],
[#text[#text("Evita volver a romper correos reenviados")]],
[#text[#text("Verificador")]],
[#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/scripts/verificar.ts")[#text("scripts/verificar.ts")]]],
[#text[#text("Ejecuta casos, regresión y suite; rechaza pruebas dependientes de casos temporales")]],
)]

#text[#text("Para mantener el parser:")]

+ #text[#text("Conserve un correo anonimizado que reproduzca el problema y determine una persona la tienda, el pedido, la guía y la transportadora correctos.")]
+ #text[#text("Registre el caso temporal y su salida esperada siguiendo la referencia y la skill. No modifique la salida esperada para acomodarla a una respuesta errónea del agente.")]
+ #text[#text("Pida al agente el cambio mínimo de src/providers/email.ts; copie el correo en una prueba permanente. El contrato y las migraciones se conservan.")]
+ #text[#text("Ejecute bun scripts/verificar.ts. Debe terminar con VERIFICACION OK; comprueba casos, correos reenviados y bun test.")]
+ #text[#text("Revise el cambio y la asociación tienda + pedido. Una persona aprueba su incorporación al repositorio y anota el resultado en la memoria.")]
